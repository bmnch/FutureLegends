import { NextResponse } from "next/server";
import type { ChatTurn, ContentBlockPayload } from "@/lib/types";
import { getDb } from "@/src/db";
import { renderFactsForPrompt } from "@/src/lib/ai/agents/research-agent";
import { CHAT_MODEL_CHAIN } from "@/src/lib/ai/models";
import {
  cosineSimilarity,
  embedTexts,
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
 * "Chat with Module": answers a learner's question strictly from the current
 * module's generated material. The module text is injected as system context;
 * the highest-capability embedding model ranks the module's passages by
 * relevance so the most pertinent ones lead the context window and are cited.
 *
 * Body: { courseId, moduleId, question, history?: ChatTurn[] }
 * Response: { answer, model, sources: [{ blockId, title, type, score }] }
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
          title: "Knowledge check",
          text: `Question: ${c.question}\n${c.options
            .map((o) => `- ${o.text} (${o.correct ? "correct" : "incorrect"}): ${o.feedback}`)
            .join("\n")}\nExplanation: ${c.explanation}`,
        },
      ];
    case "audio":
      // Transcript duplicates the text blocks — skip to avoid double-counting.
      return [];
    default:
      return [];
  }
}

const SYSTEM_PROMPT = `You are the in-course tutor for CiviorAI. The learner is working through ONE module of a course that was generated specifically for their situation and location.

Answer the learner's question using ONLY the module material provided below. Rules:
- If the material answers the question, respond concisely (2-6 sentences, or a short list) and mention which passage it comes from, e.g. "(see: Payroll setup)".
- If the material does NOT cover it, say so plainly in one sentence, then point the learner to the most relevant authority named in the material or research facts (e.g. "confirm with the Ontario Ministry of Labour"). Never invent local rules, prices, or dates.
- Keep the learner's locale and situation front-of-mind; do not generalise to other cities or countries.
- Plain text or light Markdown only. No preamble.`;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ModuleChatBody;
  try {
    body = (await request.json()) as ModuleChatBody;
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const courseId = body.courseId?.trim();
  const moduleId = body.moduleId?.trim();
  const question = body.question?.trim();
  if (!courseId || !moduleId) {
    return NextResponse.json({ error: "courseId and moduleId are required." }, { status: 400 });
  }
  if (!question || question.length < 2) {
    return NextResponse.json({ error: "question is required." }, { status: 400 });
  }
  if (question.length > 2000) {
    return NextResponse.json({ error: "question is too long (max 2,000 characters)." }, { status: 400 });
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
    return NextResponse.json({ error: "Module not found." }, { status: 404 });
  }

  const passages = data.module.blocks.flatMap(blockToPassages);
  if (passages.length === 0) {
    return NextResponse.json({ error: "This module has no content yet." }, { status: 409 });
  }

  // ── Rank passages by semantic relevance (best-effort; falls back to order) ──
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
        `### Passage ${i + 1} — ${p.title} [${p.type}]${p.score ? ` (relevance ${p.score.toFixed(2)})` : ""}\n${p.text}`,
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
    const result = await runChat({
      messages,
      models: CHAT_MODEL_CHAIN,
      maxTokens: 1024,
      temperature: 0.3,
      enableThinking: false,
      signal: request.signal,
    });

    return NextResponse.json({
      answer: result.output,
      model: result.model,
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
      { error: error instanceof Error ? error.message : "Chat failed." },
      { status: 502 },
    );
  }
}
