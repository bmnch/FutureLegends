import { redirect } from "next/navigation";
import { DashboardExperience } from "@/components/dashboard/DashboardExperience";
import { getDb } from "@/src/db";
import { getSessionUser } from "@/src/lib/auth-session";
import { listCoursesForUser } from "@/src/lib/course/queries";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/?auth=required");
  }

  const db = await getDb();
  const courses = await listCoursesForUser(db, user.id);

  return (
    <main className="flex w-full flex-1 flex-col">
      <DashboardExperience user={user} courses={courses} />
    </main>
  );
}
