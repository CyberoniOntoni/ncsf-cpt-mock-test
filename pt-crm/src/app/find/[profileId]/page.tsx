import { notFound } from "next/navigation";
import { FindIntroForm } from "@/components/find-intro-form";
import { getPublicProfile, listPublicGyms } from "@/db/queries/marketplace";

export const dynamic = "force-dynamic";

export default async function FindProfilePage({
  params,
}: {
  params: Promise<{ profileId: string }>;
}) {
  const { profileId } = await params;
  const profile = await getPublicProfile(profileId);
  if (!profile) notFound();
  const gyms = await listPublicGyms();
  const facilities = gyms
    .filter((g) => profile.facilityNames.includes(g.name))
    .map((g) => ({ id: g.id, name: g.name }));

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8 text-zinc-100">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Find a trainer
      </p>
      <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
      {profile.title ? (
        <p className="text-sm text-zinc-400">{profile.title}</p>
      ) : null}
      <p className="text-lg">{profile.headline}</p>
      <p className="whitespace-pre-wrap text-sm text-zinc-300">{profile.bio}</p>
      {profile.specialties.length ? (
        <p className="text-sm text-zinc-400">
          {profile.specialties.join(" · ")}
        </p>
      ) : null}
      {profile.hourlyRateCents != null ? (
        <p className="text-sm">
          {(profile.hourlyRateCents / 100).toFixed(0)} {profile.currency}/hr
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        FloorScribe introduces you. Training and session payments are between
        you and the trainer.
      </p>
      <FindIntroForm profileId={profile.id} facilities={facilities} />
    </main>
  );
}
