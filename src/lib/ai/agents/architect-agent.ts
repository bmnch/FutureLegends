import type {
  ArchitectSyllabus,
  ResearchFacts,
  SyllabusOutline,
} from "@/lib/types";
import { runChat } from "../workers-ai";
import { renderFactsForPrompt } from "./research-agent";

/**
 * Architect Agent
 * ---------------
 * Consumes the Research Agent's factual constraints plus the learner's brain
 * dump and designs a deeply structured syllabus: ordered modules, each with a
 * measurable objective, concrete sub-topics, and "localization hooks" - the
 * specific local facts the Content Agent must weave into that module.
 *
 * Runs on the frontier model with reasoning enabled: curriculum design is
 * the highest-leverage decision in the pipeline.
 */

const SYSTEM_PROMPT = `You are the Architect Agent inside CiviorAI, a master curriculum designer who builds short, intensely practical courses for one specific person.

You will receive (a) the learner's brain dump and (b) a list of factual constraints produced by a Research Agent. Design the syllabus.

Design rules:
- 4 to 6 modules, ordered so each one unlocks the next (orientation → logistics → money → rights → mastery is a common arc, adapt it).
- Every module has ONE measurable objective phrased as "By the end of this module you can ..." and 3 to 6 concrete subtopics.
- Every module lists 2 to 5 localizationHooks: the exact local facts (from the constraints) that MUST appear in that module's content. Reference agencies, laws, documents, places by their real names.
- estimatedMinutes is realistic for reading + one scenario + one quiz (12 to 30 minutes).
- Title is specific and motivating (max 80 chars). targetAudience is one sentence describing exactly who this is for. summary is two sentences.
- If the learner previewed an outline, preserve its spirit and module themes but you may improve ordering, split or merge modules, and sharpen objectives.

Output ONLY a JSON object matching the schema. No prose, no markdown fences.`;

export const ARCHITECT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    targetAudience: { type: "string" },
    summary: { type: "string" },
    modules: {
      type: "array",
      minItems: 3,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          objective: { type: "string" },
          subtopics: { type: "array", items: { type: "string" } },
          estimatedMinutes: { type: "number" },
          localizationHooks: { type: "array", items: { type: "string" } },
        },
        required: [
          "title",
          "objective",
          "subtopics",
          "estimatedMinutes",
          "localizationHooks",
        ],
      },
    },
  },
  required: ["title", "targetAudience", "summary", "modules"],
} as const;

function normalize(raw: unknown, fallbackTitle: string): ArchitectSyllabus {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawModules = Array.isArray(r.modules) ? r.modules : [];

  const modules = rawModules
    .map((item) => {
      const m = (item ?? {}) as Record<string, unknown>;
      const strings = (v: unknown) =>
        Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : [];
      return {
        title: typeof m.title === "string" ? m.title.trim() : "",
        objective: typeof m.objective === "string" ? m.objective.trim() : "",
        subtopics: strings(m.subtopics),
        estimatedMinutes:
          typeof m.estimatedMinutes === "number" && m.estimatedMinutes > 0
            ? Math.round(m.estimatedMinutes)
            : 20,
        localizationHooks: strings(m.localizationHooks),
      };
    })
    .filter((m) => m.title.length > 0);

  if (modules.length < 3) {
    throw new Error("Architect Agent produced fewer than 3 modules.");
  }

  return {
    title:
      typeof r.title === "string" && r.title.trim()
        ? r.title.trim().slice(0, 120)
        : fallbackTitle,
    targetAudience:
      typeof r.targetAudience === "string" && r.targetAudience.trim()
        ? r.targetAudience.trim()
        : "Learner described in the brain dump",
    summary: typeof r.summary === "string" ? r.summary.trim() : "",
    modules: modules.slice(0, 7),
  };
}

export type ArchitectAgentInput = {
  brainDump: string;
  facts: ResearchFacts;
  outline?: SyllabusOutline | null;
  signal?: AbortSignal;
};

export async function runArchitectAgent(
  input: ArchitectAgentInput,
): Promise<{ syllabus: ArchitectSyllabus; model: string }> {
  const outlineSection = input.outline
    ? `\n\nPREVIEWED OUTLINE (the learner paid for this - honour its themes):\nTitle: ${input.outline.courseTitle}\n${input.outline.modules
        .map(
          (m, i) =>
            `${i + 1}. ${m.title} - ${m.description} - topics: ${m.topics.join("; ")}`,
        )
        .join("\n")}`
    : "";

  const result = await runChat<unknown>({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `LEARNER BRAIN DUMP:\n"""\n${input.brainDump}\n"""\n\nRESEARCH AGENT FINDINGS:\n${renderFactsForPrompt(input.facts)}${outlineSection}`,
      },
    ],
    jsonSchema: { name: "course_syllabus", schema: ARCHITECT_SCHEMA },
    maxTokens: 6144,
    temperature: 0.5,
    signal: input.signal,
  });

  const fallbackTitle = input.outline?.courseTitle ?? "Your CiviorAI Intensive";
  return { syllabus: normalize(result.output, fallbackTitle), model: result.model };
}
