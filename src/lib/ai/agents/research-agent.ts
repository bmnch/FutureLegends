import type { ResearchFacts, SyllabusOutline } from "@/lib/types";
import { runChat } from "../workers-ai";

/**
 * Research Agent
 * --------------
 * First stage of the pipeline. Reads the learner's raw brain dump and decides
 * which *factual* context is missing or must be pinned down before anyone
 * writes a syllabus: jurisdiction (labour law, tax, ID requirements), the
 * specific transit system, banking norms, licensing bodies, and so on.
 *
 * The agent never invents specifics it cannot support: every constraint is
 * tagged with a confidence level and a "verifyWith" authority so the Content
 * Agent can phrase low-confidence items as "confirm with X" rather than as
 * hard facts.
 */

const SYSTEM_PROMPT = `You are the Research Agent inside CiviorAI, a system that turns a person's messy "brain dump" about their life situation into a localized, practical course.

Your ONLY job is to establish the factual grounding that every later agent must respect.

Steps:
1. Infer the learner's location (city, region/province/state, country) from clues in the text. If you cannot, set the fields to null and confidence "low".
2. Describe the learner in one paragraph (audienceProfile): role, life stage, constraints, tone that will resonate.
3. Produce a list of factual constraints (8 to 16 items). Each constraint must be:
   - specific to the inferred locale (name the actual transit agency, the actual employment-standards act, the actual banking or ID documents, etc.)
   - directly relevant to what the learner wants to master
   - tagged with confidence: "high" if you are certain it is accurate for that locale, "medium" if likely, "low" if you are inferring.
   - accompanied by "verifyWith": the official authority, website, or person who can confirm it.
4. List openQuestions: things the learner should confirm that would change the advice (e.g. employer size, contract type, visa status).

Rules:
- Never fabricate statute numbers, fare prices, or dates. If you are unsure of a number, describe how to find it and use confidence "low".
- Prefer official names (e.g. "Toronto Transit Commission (TTC)", "Ontario Employment Standards Act, 2000").
- Output ONLY a JSON object matching the schema. No prose, no markdown fences.`;

export const RESEARCH_SCHEMA = {
  type: "object",
  properties: {
    locale: {
      type: "object",
      properties: {
        city: { type: ["string", "null"] },
        region: { type: ["string", "null"] },
        country: { type: ["string", "null"] },
        confidence: { type: "string", enum: ["high", "medium", "low"] },
      },
      required: ["city", "region", "country", "confidence"],
    },
    audienceProfile: { type: "string" },
    constraints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" },
          fact: { type: "string" },
          whyItMatters: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          verifyWith: { type: "string" },
        },
        required: ["topic", "fact", "whyItMatters", "confidence", "verifyWith"],
      },
    },
    openQuestions: { type: "array", items: { type: "string" } },
  },
  required: ["locale", "audienceProfile", "constraints", "openQuestions"],
} as const;

function normalize(raw: unknown): ResearchFacts {
  const r = (raw ?? {}) as Record<string, unknown>;
  const locale = (r.locale ?? {}) as Record<string, unknown>;
  const asConfidence = (v: unknown): ResearchFacts["locale"]["confidence"] =>
    v === "high" || v === "medium" || v === "low" ? v : "low";

  const constraints = Array.isArray(r.constraints) ? r.constraints : [];

  return {
    locale: {
      city: typeof locale.city === "string" ? locale.city : null,
      region: typeof locale.region === "string" ? locale.region : null,
      country: typeof locale.country === "string" ? locale.country : null,
      confidence: asConfidence(locale.confidence),
    },
    audienceProfile:
      typeof r.audienceProfile === "string" ? r.audienceProfile : "",
    constraints: constraints
      .map((item) => {
        const c = (item ?? {}) as Record<string, unknown>;
        return {
          topic: typeof c.topic === "string" ? c.topic : "General",
          fact: typeof c.fact === "string" ? c.fact : "",
          whyItMatters:
            typeof c.whyItMatters === "string" ? c.whyItMatters : "",
          confidence: asConfidence(c.confidence),
          verifyWith:
            typeof c.verifyWith === "string" ? c.verifyWith : "Official source",
        };
      })
      .filter((c) => c.fact.length > 0),
    openQuestions: Array.isArray(r.openQuestions)
      ? r.openQuestions.filter((q): q is string => typeof q === "string")
      : [],
  };
}

export type ResearchAgentInput = {
  brainDump: string;
  outline?: SyllabusOutline | null;
  signal?: AbortSignal;
};

export async function runResearchAgent(
  input: ResearchAgentInput,
): Promise<{ facts: ResearchFacts; model: string }> {
  const outlineHint = input.outline
    ? `\n\nThe learner already previewed this syllabus outline and paid for it - keep your research aligned with these modules:\n${input.outline.modules
        .map((m, i) => `${i + 1}. ${m.title} - ${m.description}`)
        .join("\n")}`
    : "";

  const result = await runChat<unknown>({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `LEARNER BRAIN DUMP:\n"""\n${input.brainDump}\n"""${outlineHint}`,
      },
    ],
    jsonSchema: { name: "research_facts", schema: RESEARCH_SCHEMA },
    maxTokens: 4096,
    temperature: 0.2,
    signal: input.signal,
  });

  const facts = normalize(result.output);
  if (facts.constraints.length === 0) {
    throw new Error("Research Agent returned no factual constraints.");
  }
  return { facts, model: result.model };
}

/** Compact, prompt-ready rendering of the research facts. */
export function renderFactsForPrompt(facts: ResearchFacts): string {
  const locale = [facts.locale.city, facts.locale.region, facts.locale.country]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `Locale: ${locale || "unknown"} (confidence ${facts.locale.confidence})`,
    `Audience: ${facts.audienceProfile}`,
    "",
    "FACTUAL CONSTRAINTS (respect these exactly; phrase low-confidence items as 'confirm with ...'):",
    ...facts.constraints.map(
      (c, i) =>
        `${i + 1}. [${c.confidence.toUpperCase()}] ${c.topic}: ${c.fact} - why: ${c.whyItMatters} - verify with: ${c.verifyWith}`,
    ),
  ];
  if (facts.openQuestions.length > 0) {
    lines.push("", "OPEN QUESTIONS the learner should confirm:");
    lines.push(...facts.openQuestions.map((q) => `- ${q}`));
  }
  return lines.join("\n");
}
