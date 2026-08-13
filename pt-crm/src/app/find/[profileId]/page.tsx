import { notFound } from "next/navigation";
import { FindIntroForm } from "@/components/find-intro-form";
import { FindTrainerMeta } from "@/components/find-trainer-meta";
import { getPublicProfile, listPublicGyms } from "@/db/queries/marketplace";
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
    <main className="mx-auto max-w-xl space-y-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">
        Find a trainer
      </p>
      <h1 className="text-2xl font-semibold">{profile.displayName}</h1>
      <p className="text-lg">{profile.headline}</p>
      <p className="whitespace-pre-wrap text-sm text-zinc-300">{profile.bio}</p>
      <FindTrainerMeta
        credentials={profile.credentials}
        title={profile.title}
        region={profile.region}
        city={profile.city}
        facilityNames={profile.facilityNames}
        specialties={profile.specialties}
        serviceModes={profile.serviceModes}
        hourlyRateCents={profile.hourlyRateCents}
        sessionRateCents={profile.sessionRateCents}
        currency={profile.currency}
      />
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
