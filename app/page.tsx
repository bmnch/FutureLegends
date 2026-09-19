import { HomeExperience } from "@/components/HomeExperience";
import { getSessionUser } from "@/src/lib/auth-session";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{ auth?: string; checkout?: string }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const user = await getSessionUser();

  return (
    <main className="flex w-full flex-1 flex-col">
      <HomeExperience
        initialUser={user}
        initialAuthRequired={params.auth === "required"}
        checkoutCancelled={params.checkout === "cancelled"}
      />
    </main>
  );
}
