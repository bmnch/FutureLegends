import type { SyllabusOutline } from "@/lib/types";

export const runtime = "edge";

const MODEL = "@cf/qwen/qwen3.8-27b";

const SYSTEM_PROMPT = `You are CiviorAI, an expert curriculum designer for hyper-localized onboarding.
Given a user's brain dump, return ONLY valid JSON (no markdown fences) matching:
{
  "title": string,
  "locale": string,
  "audience": string,
  "learningGoals": string[],
  "modules": [
    {
      "id": string,
      "title": string,
      "summary": string,
      "localContext": string,
      "estimatedMinutes": number,
      "lessons": [
        { "id": string, "title": string, "objective": string }
      ]
    }
  ]
}
Make the syllabus highly specific to the user's city, institutions, transit, banking, workplace rights, and timeline. Prefer concrete local names and actionable steps.`;

function fallbackSyllabus(brainDump: string): SyllabusOutline {
  return {
    title: "Localized Onboarding Intensive",
    locale: "Inferred from your brain dump",
    audience: "Learner with a new work + city context",
    learningGoals: [
      "Navigate local transit confidently for work shifts",
      "Set up payroll-ready banking",
      "Understand core workplace rights for your role",
    ],
    modules: [
      {
        id: "mod-transit",
        title: "Transit & First-Week Commute",
        summary:
          "Map routes, fare options, and backup paths from your location to work.",
        localContext:
          "Derived from locations mentioned in your brain dump (campus / downtown / workplace).",
        estimatedMinutes: 35,
        lessons: [
          {
            id: "les-route",
            title: "Primary commute plan",
            objective: "Identify the fastest reliable route for peak hours.",
          },
          {
            id: "les-backup",
            title: "Disruption fallback",
            objective: "Prepare an alternate route and timing buffer.",
          },
        ],
      },
      {
        id: "mod-banking",
        title: "Payroll Banking Setup",
        summary: "Open/update accounts and direct deposit for your employer.",
        localContext: "Local bank / credit union options near your workplace.",
        estimatedMinutes: 40,
        lessons: [
          {
            id: "les-account",
            title: "Account checklist",
            objective: "Confirm ID, address, and deposit requirements.",
          },
          {
            id: "les-deposit",
            title: "Direct deposit forms",
            objective: "Complete employer payroll banking details correctly.",
          },
        ],
      },
      {
        id: "mod-rights",
        title: "Workplace Rights Snapshot",
        summary: "Breaks, wages, scheduling, and who to contact for issues.",
        localContext: "Jurisdiction-specific rules for your workplace type.",
        estimatedMinutes: 45,
        lessons: [
          {
            id: "les-basics",
            title: "Protected basics",
            objective: "Know minimum wage, breaks, and overtime triggers.",
          },
          {
            id: "les-escalate",
            title: "Escalation path",
            objective: "Document issues and use the correct complaint channel.",
          },
        ],
      },
    ],
    rawBrainDump: brainDump,
  };
}

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

async function runWorkersAi(prompt: string): Promise<string> {
  // Prefer Workers AI REST when credentials are present (works in local + edge).
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (accountId && apiToken) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 2048,
        }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Workers AI request failed: ${response.status} ${detail}`);
    }

    const payload = (await response.json()) as {
      result?: { response?: string; message?: { content?: string } };
    };

    const content =
      payload.result?.response ??
      payload.result?.message?.content ??
      "";

    if (!content) {
      throw new Error("Workers AI returned an empty response.");
    }

    return content;
  }

  // OpenNext / Workers binding path when deployed with [ai] binding.
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = await getCloudflareContext({ async: true });
    const ai = (env as { AI?: { run: (model: string, input: unknown) => Promise<unknown> } }).AI;

    if (ai?.run) {
      const result = (await ai.run(MODEL, {
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 2048,
      })) as { response?: string };

      if (result?.response) return result.response;
    }
  } catch {
    // Binding unavailable in local Next.js without Wrangler proxy.
  }

  throw new Error(
    "Workers AI is not configured. Set CF_ACCOUNT_ID and CF_API_TOKEN, or deploy with an AI binding.",
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { brainDump?: string };
    const brainDump = body.brainDump?.trim();

    if (!brainDump) {
      return Response.json(
        { error: "brainDump is required." },
        { status: 400 },
      );
    }

    let syllabus: SyllabusOutline;

    try {
      const raw = await runWorkersAi(
        `Create a localized JSON syllabus for this brain dump:\n\n${brainDump}`,
      );
      const parsed = extractJson(raw) as SyllabusOutline;
      syllabus = {
        ...parsed,
        rawBrainDump: brainDump,
        modules: parsed.modules ?? [],
        learningGoals: parsed.learningGoals ?? [],
      };
    } catch {
      // Keep onboarding usable before Cloudflare credentials are wired.
      syllabus = fallbackSyllabus(brainDump);
    }

    return Response.json({ syllabus });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate outline.",
      },
      { status: 500 },
    );
  }
}
