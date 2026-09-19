import type {
  ArchitectModule,
  ArchitectSyllabus,
  ContentAgentModule,
  ContentAgentQuiz,
  ContentAgentScenario,
  ContentAgentSection,
  ResearchFacts,
} from "@/lib/types";
import { stripLeadingTitleHeading } from "@/lib/markdown-utils";
import { runChat } from "../workers-ai";
import { renderFactsForPrompt } from "./research-agent";

/**
 * Content Agent
 * -------------
 * Writes the actual learning material for ONE module. The orchestrator fans
 * out one Content Agent per module in parallel (`Promise.all`) so a 6-module
 * course takes roughly as long as a single module.
 *
 * Every module is guaranteed to contain:
 *   - 2 to 4 markdown sections (engaging, interactive prose)
 *   - exactly one practical, localized scenario
 *   - at least one multiple-choice validation quiz with per-option feedback
 */

const SYSTEM_PROMPT = `You are the Content Agent inside CiviorAI. You write one module of a hyper-practical, localized course for one specific learner.

Voice: direct, warm, second-person ("you"). Assume the learner is smart but new to this place/situation. Zero filler.

You MUST produce:
1. sections — 2 to 4 sections of rich Markdown. Use ## headings inside the markdown, bullet lists, numbered steps, bold for the exact names of documents/agencies/places, blockquotes for "Pro tip:" callouts, and a small table when comparing options. Each section is 180 to 420 words. Weave EVERY localizationHook into the sections by name. Where a fact is low-confidence, write "confirm with <authority>" instead of stating it as certain.
2. scenario — ONE practical scenario set in the learner's actual city/situation. "narrative" (Markdown, 120-220 words) drops the learner into a concrete moment with real place names. "challenge" is the decision or task they must handle. "walkthrough" (Markdown, numbered steps) is the model answer. "debrief" is 2-3 sentences on the transferable lesson.
3. quizzes — 1 to 3 multiple-choice questions that validate the module objective. Each has exactly 4 options, exactly ONE with correct=true. Each option has "feedback": one or two sentences explaining why that choice is right or wrong, referencing the local specifics. "explanation" summarises the correct reasoning.

Output ONLY a JSON object matching the schema. No prose outside JSON, no markdown fences around the JSON. Markdown belongs INSIDE the string fields.`;

export const CONTENT_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          markdown: { type: "string" },
        },
        required: ["title", "markdown"],
      },
    },
    scenario: {
      type: "object",
      properties: {
        title: { type: "string" },
        setting: { type: "string" },
        narrative: { type: "string" },
        challenge: { type: "string" },
        walkthrough: { type: "string" },
        debrief: { type: "string" },
      },
      required: [
        "title",
        "setting",
        "narrative",
        "challenge",
        "walkthrough",
        "debrief",
      ],
    },
    quizzes: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          question: { type: "string" },
          options: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: {
              type: "object",
              properties: {
                text: { type: "string" },
                correct: { type: "boolean" },
                feedback: { type: "string" },
              },
              required: ["text", "correct", "feedback"],
            },
          },
          explanation: { type: "string" },
        },
        required: ["question", "options", "explanation"],
      },
    },
  },
  required: ["sections", "scenario", "quizzes"],
} as const;

const OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

function normalizeSections(raw: unknown): ContentAgentSection[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr
    .map((item) => {
      const s = (item ?? {}) as Record<string, unknown>;
      return {
        title: typeof s.title === "string" ? s.title.trim() : "",
        markdown: typeof s.markdown === "string" ? s.markdown.trim() : "",
      };
    })
    .filter((s) => s.markdown.length > 40)
    .map((s, i) => {
      const title = s.title || `Part ${i + 1}`;
      // The model tends to open with a heading that repeats the section title,
      // which the player already renders — drop it so headings aren't doubled.
      return { title, markdown: stripLeadingTitleHeading(s.markdown, title) };
    });
}

function normalizeScenario(raw: unknown): ContentAgentScenario | null {
  const s = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const scenario = {
    title: str(s.title) || "Real-world scenario",
    setting: str(s.setting),
    narrative: str(s.narrative),
    challenge: str(s.challenge),
    walkthrough: str(s.walkthrough),
    debrief: str(s.debrief),
  };
  return scenario.narrative.length > 40 && scenario.walkthrough.length > 20
    ? scenario
    : null;
}

function normalizeQuizzes(raw: unknown): ContentAgentQuiz[] {
  const arr = Array.isArray(raw) ? raw : [];
  const quizzes: ContentAgentQuiz[] = [];

  for (const item of arr) {
    const q = (item ?? {}) as Record<string, unknown>;
    const question = typeof q.question === "string" ? q.question.trim() : "";
    const rawOptions = Array.isArray(q.options) ? q.options : [];
    const options = rawOptions
      .map((o, i) => {
        const opt = (o ?? {}) as Record<string, unknown>;
        return {
          id: OPTION_IDS[i] ?? String(i),
          text: typeof opt.text === "string" ? opt.text.trim() : "",
          correct: opt.correct === true,
          feedback:
            typeof opt.feedback === "string" && opt.feedback.trim()
              ? opt.feedback.trim()
              : opt.correct === true
                ? "Correct — this matches the local rules covered in this module."
                : "Not quite — revisit the section above and try again.",
        };
      })
      .filter((o) => o.text.length > 0);

    const correctCount = options.filter((o) => o.correct).length;
    if (!question || options.length < 2 || correctCount === 0) continue;

    // Enforce exactly one correct answer for gating semantics.
    if (correctCount > 1) {
      let seen = false;
      for (const option of options) {
        if (option.correct) {
          if (seen) option.correct = false;
          seen = true;
        }
      }
    }

    quizzes.push({
      question,
      options,
      explanation:
        typeof q.explanation === "string" && q.explanation.trim()
          ? q.explanation.trim()
          : options.find((o) => o.correct)?.feedback ?? "",
    });
  }

  return quizzes;
}

function validate(raw: unknown): ContentAgentModule {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sections = normalizeSections(r.sections);
  const scenario = normalizeScenario(r.scenario);
  const quizzes = normalizeQuizzes(r.quizzes);

  const problems: string[] = [];
  if (sections.length < 1) problems.push("no usable sections");
  if (!scenario) problems.push("scenario missing or too short");
  if (quizzes.length < 1) problems.push("no valid quiz");
  if (problems.length > 0) {
    throw new Error(`Content Agent output invalid: ${problems.join(", ")}`);
  }

  return { sections, scenario: scenario!, quizzes };
}

export type ContentAgentInput = {
  brainDump: string;
  facts: ResearchFacts;
  syllabus: ArchitectSyllabus;
  module: ArchitectModule;
  moduleIndex: number;
  signal?: AbortSignal;
  /** Called when the first attempt fails validation and a retry starts. */
  onRetry?: (attempt: number, reason: string) => void;
};

export async function runContentAgent(
  input: ContentAgentInput,
): Promise<{ content: ContentAgentModule; model: string; attempts: number }> {
  const { module, syllabus, moduleIndex } = input;
  const siblings = syllabus.modules
    .map((m, i) => `${i + 1}. ${m.title}${i === moduleIndex ? "  ← YOU ARE WRITING THIS ONE" : ""}`)
    .join("\n");

  const userPrompt = `COURSE: ${syllabus.title}
TARGET AUDIENCE: ${syllabus.targetAudience}

ALL MODULES (for continuity — do not repeat other modules' content):
${siblings}

MODULE ${moduleIndex + 1}: ${module.title}
OBJECTIVE: ${module.objective}
SUBTOPICS TO COVER:
${module.subtopics.map((s) => `- ${s}`).join("\n")}
LOCALIZATION HOOKS (must appear by name):
${module.localizationHooks.map((h) => `- ${h}`).join("\n") || "- (use the research facts below)"}
TARGET LENGTH: about ${module.estimatedMinutes} minutes of learning.

LEARNER BRAIN DUMP:
"""
${input.brainDump}
"""

RESEARCH AGENT FINDINGS:
${renderFactsForPrompt(input.facts)}`;

  const MAX_ATTEMPTS = 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await runChat<unknown>({
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        jsonSchema: { name: "module_content", schema: CONTENT_SCHEMA },
        maxTokens: 8192,
        temperature: 0.65,
        // Long-form writing benefits little from chain-of-thought and the
        // pipeline fans out N of these in parallel — keep latency bounded.
        enableThinking: false,
        signal: input.signal,
      });
      return { content: validate(result.output), model: result.model, attempts: attempt };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        input.onRetry?.(
          attempt,
          error instanceof Error ? error.message : String(error),
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Content Agent failed after retries.");
}

/** Strip markdown to plain prose for narration + retrieval. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/\|/g, " ")
    .replace(/^[\s:-]{3,}$/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
