import { HomeWorkspace } from "@/components/home-workspace";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  await requireSession();
  const params = await searchParams;
  return <HomeWorkspace initialClientId={params.client ?? null} />;
}
