import { NextResponse } from "next/server";
import { getDb } from "@/src/db";
import { getSessionUser } from "@/src/lib/auth-session";
import { getPlayerCourse } from "@/src/lib/course/queries";

// Workers already executes at the edge; @opennextjs/cloudflare cannot load
// Next.js `edge` runtime bundles, so route handlers must stay on nodejs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/courses/[courseId]
 * Returns the hydrated course (modules → blocks) for the signed-in owner.
 * The player polls this while `status === "generating"`.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { courseId } = await context.params;
  const db = await getDb();
  const course = await getPlayerCourse(db, courseId, user.id);

  if (!course) {
    return NextResponse.json({ error: "Course not found." }, { status: 404 });
  }

  return NextResponse.json(
    { course },
    { headers: { "Cache-Control": "no-store" } },
  );
}
