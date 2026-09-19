import { eq } from "drizzle-orm";
import Stripe from "stripe";
import type { SyllabusOutline } from "@/lib/types";
import { getDb } from "@/src/db";
import { users } from "@/src/db/schema";
import { getSessionUser } from "@/src/lib/auth-session";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return Response.json({ error: "Please log in first." }, { status: 401 });
    }

    const body = (await request.json()) as { syllabus?: SyllabusOutline };
    if (!body.syllabus) {
      return Response.json({ error: "syllabus is required." }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const courseId = crypto.randomUUID();

    // Premium accounts skip Stripe and go straight to the setup / generate flow.
    const db = await getDb();
    const rows = await db
      .select({ plan: users.plan })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1);
    if (rows[0]?.plan === "premium") {
      return Response.json({
        url: `${origin}/setup/${courseId}`,
        courseId,
        skippedCheckout: true,
      });
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return Response.json(
        { error: "STRIPE_SECRET_KEY is not configured." },
        { status: 500 },
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: "2026-08-26.dahlia",
      httpClient: Stripe.createFetchHttpClient(),
    });

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
        userId: sessionUser.id,
        syllabusTitle: body.syllabus.courseTitle?.slice(0, 400) ??
          body.syllabus.title?.slice(0, 400) ??
          "CiviorAI Course",
        // Compact pointer - full syllabus should be stored server-side in production.
        brainDumpPreview: (body.syllabus.rawBrainDump ?? "").slice(0, 450),
      },
    });

    if (!session.url) {
      return Response.json(
        { error: "Checkout did not start. Try again in a moment." },
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
