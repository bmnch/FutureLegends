import { BrainDumpHero } from "@/components/BrainDumpHero";
import { HowItWorks } from "@/components/HowItWorks";

type PageProps = {
  searchParams: Promise<{ auth?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialAuthRequired = params.auth === "required";

  return (
    <main className="bg-neutral-950">
      <BrainDumpHero initialAuthRequired={initialAuthRequired} />
      <div className="relative overflow-hidden bg-neutral-950">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/4 top-0 h-64 w-64 rounded-full bg-violet-600/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-1/4 top-20 h-56 w-56 rounded-full bg-cyan-400/15 blur-3xl"
        />
        <HowItWorks />
      </div>
    </main>
  );
}
