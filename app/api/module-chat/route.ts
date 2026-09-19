import { NextResponse } from "next/server";
import { ARTIFACT_TYPES, normalizeArtifact, type Artifact } from "@/lib/artifacts";
import { stripEmDashes } from "@/lib/markdown-utils";
import type { ChatTurn, ContentBlockPayload } from "@/lib/types";
import { getDb } from "@/src/db";
import { renderFactsForPrompt } from "@/src/lib/ai/agents/research-agent";
import { CHAT_MODEL_CHAIN } from "@/src/lib/ai/models";
import {
  cosineSimilarity,
  embedTexts,
  extractJson,
  runChat,
  type ChatMessage,
} from "@/src/lib/ai/workers-ai";
import { getSessionUser } from "@/src/lib/auth-session";
import { getModuleForChat } from "@/src/lib/course/queries";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/module-chat
 *
 * The in-course tutor. Answers strictly from the current module's material and
 * can attach one visual "artifact" (checklist, steps, table, chart, graph,
 * calculator, code, flashcards or a simulated UI screen) that the player
 * renders above the chat.
 *
 * Body: { courseId, moduleId, question, history?: ChatTurn[] }
 * Response: { answer, artifact, model, sources: [{ blockId, title, type, score }] }
 */

type ModuleChatBody = {
  courseId?: string;
  moduleId?: string;
  question?: string;
  history?: ChatTurn[];
};

type Passage = {
  blockId: string;
  type: ContentBlockPayload["kind"];
  title: string;
  text: string;
};

function blockToPassages(block: {
  id: string;
  type: string;
  content: ContentBlockPayload;
}): Passage[] {
  const c = block.content;
  switch (c.kind) {
    case "text":
      return [{ blockId: block.id, type: "text", title: c.title, text: c.plainText || c.markdown }];
    case "scenario":
      return [
        {
          blockId: block.id,
          type: "scenario",
          title: `Scenario: ${c.title}`,
          text: `${c.setting}\n\n${c.narrative}\n\nChallenge: ${c.challenge}\n\nWalkthrough:\n${c.walkthrough}\n\nDebrief: ${c.debrief}`,
        },
      ];
    case "quiz":
      return [
        {
          blockId: block.id,
          type: "quiz",
          title: "Quick check",
          text: `Question: ${c.question}\n${c.options
            .map((o) => `- ${o.text} (${o.correct ? "correct" : "incorrect"}): ${o.feedback}`)
            .join("\n")}\nExplanation: ${c.explanation}`,
        },
      ];
    case "audio":
      // Transcript duplicates the text blocks, so skip it.
      return [];
    default:
      return [];
  }
}

const SYSTEM_PROMPT = `You are the friendly in-course tutor inside CiviorAI. The learner is working through ONE module of a course built for their exact situation and location.

Answer using ONLY the module material below.
- If the material covers it: answer in 2 to 6 short sentences or a tight list. Mention where it comes from, like "(see: Payroll setup)".
- If the material does NOT cover it: say so in one plain sentence, then point to the most relevant authority named in the material or research facts. Never invent local rules, prices or dates.
- Stay in the learner's city and situation. Do not generalise to other places.
- Tone: warm, direct, conversational. No filler, no preamble.
- Never use em dashes. Use commas, periods or colons instead.

You may attach ONE visual artifact when it genuinely helps understanding. Pick the best fit:
- "steps": a procedure or sequence. { "type":"steps", "title", "steps":[{ "title", "detail" }] }
- "checklist": things to bring, prepare or verify. { "type":"checklist", "title", "items":[{ "text", "detail" }] }
- "table": comparing options. { "type":"table", "title", "columns":[...], "rows":[[...],[...]] }
- "chart": a handful of numbers from the material (fares, costs, hours). { "type":"chart", "title", "kind":"bar"|"line", "unit", "data":[{ "label", "value" }] }
- "calculator": the learner is asking "how much" and the material gives a formula or rates. { "type":"calculator", "title", "inputs":[{ "id","label","default","min","max","step","unit" }], "outputs":[{ "label","expression","unit" }] } Expressions use input ids as variables plus + - * / ^ and min/max/round.
- "graph": a mathematical function. { "type":"graph", "title", "functions":[{ "expression", "label" }], "xMin", "xMax" } Expressions use the variable x.
- "code": a programming or command line question. { "type":"code", "title", "language", "code" }
- "mockup": simulate an app, kiosk, form or ticket screen the learner will face (for example a fare reload screen or a payroll form). { "type":"mockup", "title", "screen":{ "heading", "subheading", "fields":[{ "label","value","placeholder","kind":"text"|"number"|"select"|"toggle","options":[...] }], "actions":["..."], "note" } }
- "flashcards": key terms to memorise. { "type":"flashcards", "title", "cards":[{ "front", "back" }] }
Every artifact may include a one sentence "caption". Only use facts from the material. If nothing visual helps, set "artifact": null.

Respond with ONLY a JSON object: { "answer": "<markdown answer>", "artifact": <artifact object or null> }`;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    answer: { type: "string" },
    artifact: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          properties: {
            type: { type: "string", enum: [...ARTIFACT_TYPES, "timeline", "ui"] },
            title: { type: "string" },
            caption: { type: "string" },
          },
          required: ["type", "title"],
          additionalProperties: true,
        },
      ],
    },
  },
  required: ["answer", "artifact"],
} as const;

type TutorReply = { answer?: unknown; artifact?: unknown };

function coerceReply(raw: unknown): { answer: string; artifact: Artifact | null } {
  let parsed: TutorReply | null = null;
  if (raw && typeof raw === "object") {
    parsed = raw as TutorReply;
  } else if (typeof raw === "string") {
    try {
      parsed = extractJson<TutorReply>(raw);
    } catch {
      return { answer: stripEmDashes(raw.trim()), artifact: null };
    }
  }
  const answer =
    parsed && typeof parsed.answer === "string" && parsed.answer.trim()
      ? parsed.answer.trim()
      : typeof raw === "string"
        ? raw.trim()
        : "";
  const artifact = parsed ? normalizeArtifact(parsed.artifact) : null;
  if (artifact) {
    // Apply the no em dash rule to the visible artifact strings too.
    const walk = (value: unknown): unknown => {
      if (typeof value === "string") return stripEmDashes(value);
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, k === "code" || k === "expression" ? v : walk(v)]));
      }
      return value;
    };
    return { answer: stripEmDashes(answer), artifact: walk(artifact) as Artifact };
  }
  return { answer: stripEmDashes(answer), artifact: null };
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Please log in first." }, { status: 401 });
  }

  let body: ModuleChatBody;
  try {
    body = (await request.json()) as ModuleChatBody;
  } catch {
    return NextResponse.json({ error: "That request was not valid JSON." }, { status: 400 });
  }

  const courseId = body.courseId?.trim();
  const moduleId = body.moduleId?.trim();
  const question = body.question?.trim();
  if (!courseId || !moduleId) {
    return NextResponse.json({ error: "courseId and moduleId are required." }, { status: 400 });
  }
  if (!question || question.length < 2) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "Keep questions under 2,000 characters." }, { status: 400 });
  }

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (t): t is ChatTurn =>
            !!t &&
            (t.role === "user" || t.role === "assistant") &&
            typeof t.content === "string" &&
            t.content.trim().length > 0,
        )
        .slice(-8)
    : [];

  const db = await getDb();
  const data = await getModuleForChat(db, courseId, moduleId, user.id);
  if (!data) {
    return NextResponse.json({ error: "We could not find that module." }, { status: 404 });
  }

  const passages = data.module.blocks.flatMap(blockToPassages);
  if (passages.length === 0) {
    return NextResponse.json({ error: "This module has no content yet." }, { status: 409 });
  }

  // Rank passages by semantic relevance (best effort, falls back to order).
  let ranked: Array<Passage & { score: number }> = passages.map((p) => ({ ...p, score: 0 }));
  let embeddingModel: string | null = null;
  try {
    const [queryEmbedding, docEmbeddings] = await Promise.all([
      embedTexts([question], "query"),
      embedTexts(passages.map((p) => `${p.title}\n${p.text}`.slice(0, 6000)), "document"),
    ]);
    embeddingModel = docEmbeddings.model;
    const q = queryEmbedding.vectors[0]!;
    ranked = passages
      .map((p, i) => ({ ...p, score: cosineSimilarity(q, docEmbeddings.vectors[i]!) }))
      .sort((a, b) => b.score - a.score);
  } catch (error) {
    console.warn("[module-chat] embedding ranking unavailable, using document order", error);
  }

  const contextText = ranked
    .map(
      (p, i) =>
        `### Passage ${i + 1}: ${p.title} [${p.type}]${p.score ? ` (relevance ${p.score.toFixed(2)})` : ""}\n${p.text}`,
    )
    .join("\n\n");

  const factsText = data.course.researchFacts
    ? `\n\nRESEARCH FACTS FOR THIS LEARNER:\n${renderFactsForPrompt(data.course.researchFacts)}`
    : "";

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${SYSTEM_PROMPT}

COURSE: ${data.course.title}
AUDIENCE: ${data.course.targetAudience}
MODULE: ${data.module.title}
OBJECTIVE: ${data.module.objective}

MODULE MATERIAL (ranked most relevant first):
${contextText}${factsText}`,
    },
    ...history.map<ChatMessage>((t) => ({ role: t.role, content: t.content })),
    { role: "user", content: question },
  ];

  try {
    let model: string;
    let reply: { answer: string; artifact: Artifact | null };
    try {
      const result = await runChat<TutorReply>({
        messages,
        models: CHAT_MODEL_CHAIN,
        maxTokens: 1600,
        temperature: 0.3,
        enableThinking: false,
        signal: request.signal,
        jsonSchema: { name: "tutor_reply", schema: RESPONSE_SCHEMA as unknown as Record<string, unknown> },
      });
      model = result.model;
      reply = coerceReply(result.output);
    } catch (jsonError) {
      // JSON mode misbehaved: fall back to a plain answer with no artifact.
      console.warn("[module-chat] JSON mode failed, retrying as plain text", jsonError);
      const result = await runChat({
        messages: [
          { ...messages[0]!, content: `${messages[0]!.content}\n\nIgnore the JSON instruction. Reply with the markdown answer only.` },
          ...messages.slice(1),
        ],
        models: CHAT_MODEL_CHAIN,
        maxTokens: 1024,
        temperature: 0.3,
        enableThinking: false,
        signal: request.signal,
      });
      model = result.model;
      reply = coerceReply(result.output);
    }

    if (!reply.answer) {
      throw new Error("The tutor came back empty. Try asking again.");
    }

    return NextResponse.json({
      answer: reply.answer,
      artifact: reply.artifact,
      model,
      embeddingModel,
      sources: ranked.slice(0, 3).map((p) => ({
        blockId: p.blockId,
        title: p.title,
        type: p.type,
        score: Number(p.score.toFixed(3)),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "The tutor is taking a break. Try again." },
      { status: 502 },
    );
  }
}
