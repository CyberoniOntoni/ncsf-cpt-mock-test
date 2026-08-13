import { notFound } from "next/navigation";
import { FindChrome } from "@/components/find-chrome";
import { FindIntroForm } from "@/components/find-intro-form";
import { getPublicProfile, listPublicGyms } from "@/db/queries/marketplace";
import { specialtyLabel } from "@/lib/marketplace/specialties";
import { getSeekerById, optionalSeekerSession } from "@/lib/seeker-auth";

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
  const session = await optionalSeekerSession();
  const seeker = session ? await getSeekerById(session.seekerId) : null;

  return (
    <main className="mx-auto max-w-xl space-y-4 px-4 py-8 text-zinc-100">
      <FindChrome />
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Find a trainer
      </p>
      <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
      {profile.credentials || profile.title ? (
        <p className="text-sm text-zinc-400">
          {profile.credentials || profile.title}
        </p>
      ) : null}
      <p className="text-lg">{profile.headline}</p>
      <p className="whitespace-pre-wrap text-sm text-zinc-300">{profile.bio}</p>
      {(profile.region || profile.facilityNames.length) ? (
        <p className="text-sm text-zinc-400">
          Trains in {[profile.region, ...profile.facilityNames].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {profile.specialties.length ? (
        <p className="text-sm text-zinc-400">
          {profile.specialties.map(specialtyLabel).join(" · ")}
        </p>
      ) : null}
      {profile.hourlyRateCents != null || profile.sessionRateCents != null ? (
        <p className="text-sm">
          {profile.hourlyRateCents != null
            ? `${profile.hourlyRateCents / 100} ${profile.currency}/hr`
            : ""}
          {profile.hourlyRateCents != null && profile.sessionRateCents != null
            ? " · "
            : ""}
          {profile.sessionRateCents != null
            ? `${profile.sessionRateCents / 100} ${profile.currency}/session`
            : ""}
        </p>
      ) : null}
      <p className="text-xs text-zinc-500">
        FloorScribe introduces you. Training and session payments are between
        you and the trainer.
      </p>
      <FindIntroForm
        profileId={profile.id}
        facilities={facilities}
        defaultName={
          seeker ? `${seeker.firstName} ${seeker.lastName}`.trim() : ""
        }
        defaultEmail={seeker?.email || ""}
        defaultFacilityId={seeker?.preferredFacilityId || ""}
      />
    </main>
  );
}
