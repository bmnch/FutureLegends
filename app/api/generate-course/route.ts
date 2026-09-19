import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import type { GenerationEvent, SyllabusOutline } from "@/lib/types";
import { getDb } from "@/src/db";
import { courses } from "@/src/db/schema";
import {
  markCourseFailed,
  runCourseGeneration,
} from "@/src/lib/ai/orchestrator";
import { getSessionUser } from "@/src/lib/auth-session";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/generate-course
 *
 * Supervisor endpoint for the multi-agent pipeline. The full job can take
 * several minutes (Research → Architect → N parallel Content Agents → TTS →
 * D1 persist), which is far beyond the 30 s `waitUntil()` budget, so instead
 * of fire-and-forget we keep the client connected and **stream NDJSON progress
 * events**. Workers impose no wall-clock limit while a response is streaming.
 *
 * Body: {
 *   brainDump: string;                // required — the learner's raw context
 *   courseId?: string;                // optional — reuse the id minted at checkout
 *   outline?: SyllabusOutline;        // optional — the previewed syllabus
 *   voicePersona?: "professional" | "warm" | "energetic";
 * }
 *
 * Response: `application/x-ndjson`, one `GenerationEvent` per line. The final
 * line is `{ type: "complete", courseId, title, moduleCount }`.
 */

type GenerateCourseBody = {
  brainDump?: string;
  courseId?: string;
  outline?: SyllabusOutline | null;
  voicePersona?: string;
};

const VOICE_PERSONAS = new Set(["professional", "warm", "energetic"]);
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: GenerateCourseBody;
  try {
    body = (await request.json()) as GenerateCourseBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 },
    );
  }

  const brainDump = body.brainDump?.trim();
  if (!brainDump || brainDump.length < 20) {
    return NextResponse.json(
      { error: "brainDump must be at least 20 characters." },
      { status: 400 },
    );
  }
  if (brainDump.length > 12_000) {
    return NextResponse.json(
      { error: "brainDump is too long (max 12,000 characters)." },
      { status: 400 },
    );
  }

  const voicePersona =
    body.voicePersona && VOICE_PERSONAS.has(body.voicePersona)
      ? body.voicePersona
      : "professional";

  const requestedId = body.courseId?.trim();
  if (requestedId && !UUID_RE.test(requestedId)) {
    return NextResponse.json({ error: "courseId must be a UUID." }, { status: 400 });
  }

  const db = await getDb();

  // Reuse the checkout-minted id when it is unused; otherwise, if it already
  // belongs to this user and finished, refuse to regenerate silently.
  const courseId = requestedId ?? crypto.randomUUID();
  if (requestedId) {
    const existing = await db.query.courses.findFirst({
      where: eq(courses.id, requestedId),
      columns: { id: true, userId: true, status: true },
    });
    if (existing) {
      if (existing.userId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (existing.status === "ready") {
        return NextResponse.json(
          { error: "This course has already been generated.", courseId },
          { status: 409 },
        );
      }
      // A previous attempt failed / was interrupted → wipe and regenerate.
      await db.delete(courses).where(eq(courses.id, requestedId));
    }
  }

  const initialTitle =
    body.outline?.courseTitle?.trim() ||
    body.outline?.title?.trim() ||
    "Generating your intensive…";

  await db.insert(courses).values({
    id: courseId,
    userId: user.id,
    title: initialTitle,
    targetAudience: "Personalised from your brain dump",
    status: "generating",
    brainDump,
    researchFacts: null,
    generationMeta: { voicePersona, startedAt: new Date().toISOString() },
    generatedAt: new Date(),
  });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const emit = (event: GenerationEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          closed = true;
        }
      };

      emit({ type: "accepted", courseId });

      // Heartbeat keeps intermediaries from idling out the connection while
      // a slow model call is in flight.
      const heartbeat = setInterval(() => {
        emit({ type: "log", message: "…" });
      }, 15_000);

      (async () => {
        try {
          const result = await runCourseGeneration({
            db,
            courseId,
            userId: user.id,
            brainDump,
            outline: body.outline ?? null,
            voicePersona,
            emit,
            signal: abort.signal,
          });
          emit({ type: "complete", ...result });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Course generation failed.";
          console.error("[generate-course] pipeline failed", { courseId, message });
          try {
            await markCourseFailed(db, courseId, message);
          } catch (dbError) {
            console.error("[generate-course] failed to mark course failed", dbError);
          }
          emit({ type: "error", message, courseId });
        } finally {
          clearInterval(heartbeat);
          closed = true;
          try {
            controller.close();
          } catch {
            // already closed by the client
          }
        }
      })();
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
      "X-Course-Id": courseId,
    },
  });
}
