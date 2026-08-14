import { redirect } from "next/navigation";

export default async function FindProfileRedirect({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  redirect(`/portal/find/${profileId}`);
}
