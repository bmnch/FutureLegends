import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { SyllabusOutline } from "@/lib/types";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT =
  "You are CiviorAI, a master curriculum architect. Write titles and descriptions in a warm, plain, conversational voice. Never use em dashes. Based on the user's context, generate a highly specific, localized, and actionable 3-module syllabus. You MUST return ONLY valid JSON matching this exact structure: { \"courseTitle\": \"string\", \"modules\": [ { \"title\": \"string\", \"description\": \"string\", \"estimatedMinutes\": number, \"topics\": [\"string\", \"string\"] } ] }. Do not include markdown formatting, backticks, or conversational text. Output pure JSON.";

// Workers AI models differ: some return `response` as a JSON string, newer ones
// return an already-decoded object.
type AiRunResult = {
  response?: string | Record<string, unknown>;
};

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Model did not return valid JSON.");
  }
}

function normalizeSyllabus(
  parsed: Record<string, unknown>,
  userContext: string,
): SyllabusOutline {
  const courseTitle =
    (typeof parsed.courseTitle === "string" && parsed.courseTitle) ||
    (typeof parsed.title === "string" && parsed.title) ||
    "CiviorAI Custom Syllabus";

  const rawModules = Array.isArray(parsed.modules) ? parsed.modules : [];
  const modules = rawModules.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    const topics = Array.isArray(entry.topics)
      ? entry.topics.filter((t): t is string => typeof t === "string")
      : [];

    return {
      title: typeof entry.title === "string" ? entry.title : "Untitled module",
      description:
        typeof entry.description === "string"
          ? entry.description
          : typeof entry.summary === "string"
            ? entry.summary
            : "",
      estimatedMinutes:
        typeof entry.estimatedMinutes === "number"
          ? entry.estimatedMinutes
          : 30,
      topics,
    };
  });

  if (modules.length === 0) {
    throw new Error("Syllabus JSON did not include any modules.");
  }

  return {
    courseTitle,
    title: courseTitle,
    modules,
    rawBrainDump: userContext,
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userContext?: string;
      brainDump?: string;
    };

    const userContext = (body.userContext ?? body.brainDump)?.trim();
    if (!userContext) {
      return NextResponse.json(
        { error: "userContext is required." },
        { status: 400 },
      );
    }

    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as CloudflareEnv).AI;

    if (!ai?.run) {
      return NextResponse.json(
        { error: "Cloudflare Workers AI binding is unavailable." },
        { status: 500 },
      );
    }

    const result = (await ai.run(MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContext },
      ],
      max_tokens: 2048,
    })) as AiRunResult;

    const response = result?.response;
    if (!response || (typeof response === "string" && !response.trim())) {
      return NextResponse.json(
        { error: "Our AI came back empty. Try again in a moment." },
        { status: 500 },
      );
    }

    let parsed: unknown;
    try {
      parsed =
        typeof response === "string" ? extractJson(response) : response;
    } catch {
      return NextResponse.json(
        {
          error:
            "We could not read the plan our AI wrote. Try again.",
        },
        { status: 500 },
      );
    }

    if (!parsed || typeof parsed !== "object") {
      return NextResponse.json(
        { error: "We could not read the plan our AI wrote. Try again." },
        { status: 500 },
      );
    }

    const syllabus = normalizeSyllabus(
      parsed as Record<string, unknown>,
      userContext,
    );

    return NextResponse.json({ syllabus });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "We could not build the outline. Try again.",
      },
      { status: 500 },
    );
  }
}
