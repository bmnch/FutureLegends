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

  return <CoursePlayer initialCourse={course} />;
}
