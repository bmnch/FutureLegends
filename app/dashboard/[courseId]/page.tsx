import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CoursePlayer } from "@/components/player/CoursePlayer";
import { getDb } from "@/src/db";
import { getSessionUser } from "@/src/lib/auth-session";
import { getPlayerCourse } from "@/src/lib/course/queries";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function DashboardCoursePage({ params }: PageProps) {
  const { courseId } = await params;

  const user = await getSessionUser();
  if (!user) {
    redirect("/?auth=required");
  }

  const db = await getDb();
  const course = await getPlayerCourse(db, courseId, user.id);
  if (!course) {
    notFound();
  }

  return (
    <div className="relative min-h-[100svh] overflow-hidden bg-neutral-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-[28rem] w-[28rem] rounded-full bg-violet-600/15 blur-3xl"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1500px] px-3 py-3 sm:px-4 sm:py-4">
        <div className="mb-3 flex items-center justify-between gap-3 px-1">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-300 transition hover:text-cyan-200"
          >
            CiviorAI
          </Link>
          <p className="truncate font-mono text-[11px] text-neutral-500">
            {user.email}
          </p>
        </div>
        <CoursePlayer initialCourse={course} />
      </div>
    </div>
  );
}
