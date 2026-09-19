import { HomeExperience } from "@/components/HomeExperience";

type PageProps = {
  searchParams: Promise<{ auth?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialAuthRequired = params.auth === "required";

  return (
    <main className="bg-neutral-950">
      <HomeExperience initialAuthRequired={initialAuthRequired} />
    </main>
  );
}
