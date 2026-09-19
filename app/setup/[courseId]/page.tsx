import { BackgroundBlobs } from "@/components/BackgroundBlobs";
import { CourseSetupForm } from "@/components/CourseSetupForm";
import { Logo } from "@/components/ui/Logo";
import { Pill } from "@/components/ui/Pill";

type PageProps = {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CourseSetupPage({ params, searchParams }: PageProps) {
  const { courseId } = await params;
  const { session_id: sessionId } = await searchParams;

  return (
    <main className="relative flex min-h-dvh w-full flex-1 flex-col overflow-hidden">
      <BackgroundBlobs intensity={0.8} />
      <header className="relative z-10 flex h-16 items-center px-4 sm:px-6 lg:px-10">
        <Logo />
      </header>
      <div className="relative z-10 flex w-full flex-1 flex-col items-center justify-center px-4 pb-16 pt-6 sm:px-8">
        {sessionId ? (
          <Pill tone="mint" className="mb-5 px-4 py-2 text-sm" icon={<span aria-hidden="true">✅</span>}>
            Payment received. You are all set.
          </Pill>
        ) : null}
        <CourseSetupForm courseId={courseId} />
      </div>
    </main>
  );
}
