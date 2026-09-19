// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";

type GenerateBody = {
  courseId?: string;
  voicePersona?: string;
  playbackSpeed?: number;
};

/**
 * Kick off intensive course generation after post-checkout preference capture.
 * In production this should enqueue Workers Queue / Workflow jobs for:
 *  - detailed LLM text expansion
 *  - TTS audio generation with the selected voice persona + playback defaults
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateBody;
    const courseId = body.courseId?.trim();
    const voicePersona = body.voicePersona?.trim();
    const playbackSpeed = body.playbackSpeed;

    if (!courseId) {
      return Response.json({ error: "courseId is required." }, { status: 400 });
    }
    if (!voicePersona) {
      return Response.json(
        { error: "voicePersona is required." },
        { status: 400 },
      );
    }
    if (
      typeof playbackSpeed !== "number" ||
      ![1, 1.25, 1.5].includes(playbackSpeed)
    ) {
      return Response.json(
        { error: "playbackSpeed must be 1, 1.25, or 1.5." },
        { status: 400 },
      );
    }

    // TODO: persist preferences (D1) and enqueue intensive LLM + TTS generation.
    console.log("CiviorAI course generation requested", {
      courseId,
      voicePersona,
      playbackSpeed,
    });

    return Response.json({
      ok: true,
      courseId,
      status: "generating",
      preferences: { voicePersona, playbackSpeed },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to start course generation.",
      },
      { status: 500 },
    );
  }
}
