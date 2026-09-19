import Stripe from "stripe";
import type { SyllabusOutline } from "@/lib/types";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json(
        { error: "STRIPE_SECRET_KEY is not configured." },
        { status: 500 },
      );
    }

    const body = (await request.json()) as { syllabus?: SyllabusOutline };
    if (!body.syllabus) {
      return Response.json({ error: "syllabus is required." }, { status: 400 });
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-08-26.dahlia",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const origin = new URL(request.url).origin;
    const courseId = crypto.randomUUID();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${origin}/setup/${courseId}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: 499,
            product_data: {
              name: "CiviorAI Full Intensive Course",
              description:
                "Unlock detailed course expansion + AI voice narration for your custom syllabus.",
            },
          },
        },
      ],
      metadata: {
        courseId,
        syllabusTitle: body.syllabus.courseTitle?.slice(0, 400) ??
          body.syllabus.title?.slice(0, 400) ??
          "CiviorAI Course",
        // Compact pointer — full syllabus should be stored server-side in production.
        brainDumpPreview: (body.syllabus.rawBrainDump ?? "").slice(0, 450),
      },
    });

    if (!session.url) {
      return Response.json(
        { error: "Stripe did not return a checkout URL." },
        { status: 502 },
      );
    }

    return Response.json({ url: session.url, courseId, sessionId: session.id });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create checkout session.",
      },
      { status: 500 },
    );
  }
}
