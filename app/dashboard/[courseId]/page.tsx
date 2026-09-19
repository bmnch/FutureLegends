import { CourseReader } from "@/components/CourseReader";
import { NarrationPlayer } from "@/components/NarrationPlayer";
import type { CourseContent } from "@/lib/types";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

function buildPlaceholderCourse(courseId: string): CourseContent {
  return {
    courseId,
    title: "Your CiviorAI Intensive",
    narrationUrl: undefined,
    sections: [
      {
        id: "sec-welcome",
        heading: "Welcome & How to Use This Course",
        body: `Course ID: ${courseId}

This split-pane player is ready for your unlocked intensive.

After Stripe confirms payment, the webhook pipeline will expand your syllabus into detailed instructional text (left pane) and generate AI voice narration (right pane).

Until generation completes, use this placeholder content to verify layout, keyboard navigation, and media controls.`,
      },
      {
        id: "sec-transit",
        heading: "Module 1 — Transit Reality Check",
        body: `Map your primary commute for peak shift times.

1. Identify the nearest reliable stop/station to home and work.
2. Compare fare products (day pass vs monthly) against your schedule.
3. Save a disruption backup that still lands you on time.

Localize every step with the city and employer context from your brain dump.`,
      },
      {
        id: "sec-banking",
        heading: "Module 2 — Payroll Banking",
        body: `Prepare a payroll-ready account before your first paycheck.

- Confirm ID and address documents your bank accepts.
- Set up direct deposit with the exact account + routing details.
- Verify the first deposit window with your manager or payroll contact.`,
      },
      {
        id: "sec-rights",
        heading: "Module 3 — Workplace Rights",
        body: `Know the non-negotiables for your role and jurisdiction.

- Breaks, minimum wage, and overtime triggers
- Scheduling notice expectations
- Where to document issues and escalate safely

This section will be rewritten with jurisdiction-specific guidance once the post-payment expansion job runs.`,
      },
    ],
  };
}

export default async function DashboardCoursePage({ params }: PageProps) {
  const { courseId } = await params;
  const course = buildPlaceholderCourse(courseId);

  return (
    <main className="min-h-[100svh] bg-background grid-atmosphere">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-neon">
              CiviorAI Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              Course player
            </h1>
          </div>
          <p className="font-mono text-xs text-muted">ID {courseId}</p>
        </header>

        <div className="grid min-h-[70svh] grid-cols-1 gap-4 lg:grid-cols-2">
          <CourseReader course={course} />
          <NarrationPlayer title={course.title} src={course.narrationUrl} />
        </div>
      </div>
    </main>
  );
}
