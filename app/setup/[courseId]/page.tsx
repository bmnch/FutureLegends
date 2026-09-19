import { CourseSetupForm } from "@/components/CourseSetupForm";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CourseSetupPage({
  params,
  searchParams,
}: PageProps) {
  const { courseId } = await params;
  const { session_id: sessionId } = await searchParams;

  return (
    <main className="relative min-h-[100svh] overflow-hidden bg-neutral-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-violet-600/25 blur-3xl"
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-4xl flex-col justify-center px-6 py-16 sm:px-8">
        {sessionId ? (
          <p className="mb-4 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-300/90">
            Payment confirmed · Session {sessionId.slice(0, 12)}…
          </p>
        ) : null}
        <CourseSetupForm courseId={courseId} />
      </div>
    </main>
  );
}
