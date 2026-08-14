import { redirect } from "next/navigation";

export default async function FindRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value) q.set(key, value);
  }
  const suffix = q.size ? `?${q.toString()}` : "";
  redirect(`/portal/find${suffix}`);
}
