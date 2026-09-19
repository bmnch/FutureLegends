import Stripe from "stripe";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";

/**
 * Stripe webhook listener for successful CiviorAI checkouts.
 *
 * Configure in Stripe Dashboard / CLI:
 *   endpoint: /api/webhooks/stripe
 *   events: checkout.session.completed
 */
export async function POST(request: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return Response.json(
      { error: "Stripe webhook secrets are not configured." },
      { status: 500 },
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: "2026-08-26.dahlia",
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return Response.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      payload,
      signature,
      webhookSecret,
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? `Webhook signature verification failed: ${error.message}`
            : "Webhook signature verification failed.",
      },
      { status: 400 },
    );
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const courseId = session.metadata?.courseId;
    const syllabusTitle = session.metadata?.syllabusTitle;
    const brainDumpPreview = session.metadata?.brainDumpPreview;

    // ---------------------------------------------------------------------------
    // POST-PAYMENT: FULL INTENSIVE COURSE GENERATION
    // ---------------------------------------------------------------------------
    // After a successful payment, kick off the heavyweight pipeline that turns
    // the unlocked syllabus into a complete CiviorAI intensive:
    //
    // 1) DETAILED TEXT EXPANSION
    //    - Load the persisted syllabus outline associated with `courseId`
    //      (or reconstruct from stored brain-dump + outline JSON).
    //    - Call Cloudflare Workers AI (e.g. @cf/qwen/qwen3.8-27b) to expand
    //      each module/lesson into full instructional prose:
    //        • localized step-by-step guides
    //        • checklists, scripts, and escalation paths
    //        • city/employer-specific references from the brain dump
    //    - Persist the expanded course document (KV / D1 / R2) keyed by courseId
    //      so `app/dashboard/[courseId]` can stream it into the left-pane reader.
    //
    // 2) TTS AUDIO GENERATION
    //    - Chunk the expanded text into narration-friendly segments.
    //    - Generate AI voice audio via Workers AI TTS (or an external TTS provider).
    //    - Store audio objects in R2 (or equivalent) and save public/signed URLs
    //      on the course record as `narrationUrl` (and optional chapter markers).
    //    - Wire those URLs into the right-pane NarrationPlayer on the dashboard.
    //
    // 3) STATUS / NOTIFICATIONS
    //    - Mark course status: paid → generating → ready.
    //    - Optionally email the learner a "your course is ready" link to
    //      /dashboard/{courseId}.
    //
    // Keep this handler fast: enqueue a Queue / Workflow for the long-running
    // expansion + TTS work instead of awaiting the full pipeline inline.
    // ---------------------------------------------------------------------------

    console.log("CiviorAI payment succeeded", {
      courseId,
      syllabusTitle,
      brainDumpPreview,
      sessionId: session.id,
      customerEmail: session.customer_details?.email,
    });

    // TODO: enqueueGenerateFullCourse({ courseId, sessionId: session.id })
    // TODO: enqueueGenerateNarrationAudio({ courseId })
  }

  return Response.json({ received: true });
}
