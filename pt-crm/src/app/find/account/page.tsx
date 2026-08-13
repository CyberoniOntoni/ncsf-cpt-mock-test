import Link from "next/link";
import { FindChrome } from "@/components/find-chrome";
import { SeekerAccountForms } from "@/components/seeker-account-forms";
import {
  listPublicBrands,
  listPublicGyms,
  searchPublicProfiles,
} from "@/db/queries/marketplace";
import {
  getSeekerById,
  listLinkedTrainerProgress,
  listSeekerMeasurements,
  requireSeekerSession,
} from "@/lib/seeker-auth";

export const dynamic = "force-dynamic";

export default async function FindAccountPage() {
  const session = await requireSeekerSession();
  const seeker = await getSeekerById(session.seekerId);
  if (!seeker) return null;
  const gyms = await listPublicGyms();
  const brands = listPublicBrands(gyms);
  const [selfMeas, trainerProgress, nearby] = await Promise.all([
    listSeekerMeasurements(seeker.id),
    listLinkedTrainerProgress(seeker.email),
    searchPublicProfiles({
      lat: seeker.lat,
      lng: seeker.lng,
      facilityId: seeker.preferredFacilityId,
      brand: seeker.preferredBrand,
      radiusKm: seeker.radiusKm,
    }),
  ]);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-8 text-zinc-100">
      <FindChrome />
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Your profile
        </p>
        <h1 className="text-2xl font-semibold">
          {seeker.firstName} {seeker.lastName}
        </h1>
        <p className="text-sm text-zinc-400">{seeker.email}</p>
      </div>

      <SeekerAccountForms seeker={seeker} gyms={gyms} brands={brands} />

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Your measurements
        </h2>
        {selfMeas.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            Nothing logged yet. Add a check-in above when you want.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {selfMeas.map((m) => (
              <li
                key={m.id}
                className="flex justify-between rounded-xl border border-zinc-800 px-3 py-2 text-sm"
              >
                <span className="text-zinc-400">
                  {new Date(m.takenAt).toLocaleDateString()}
                </span>
                <span className="tabular-nums">
                  {m.weightKg != null ? `${m.weightKg} kg` : "—"}
                  {m.waistCm != null ? ` · waist ${m.waistCm}` : ""}
                  {m.heightCm != null ? ` · ht ${m.heightCm}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {trainerProgress.map((block) => (
        <section key={block.organizationName}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            With {block.organizationName}
          </h2>
          {block.measurements.length === 0 && block.assessments.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              Your trainer has not logged progress yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {block.measurements.map((m) => (
                <li key={m.id} className="rounded-xl border border-zinc-800 px-3 py-2">
                  {new Date(m.takenAt).toLocaleDateString()} ·{" "}
                  {m.weightKg != null ? `${m.weightKg} kg` : "logged"}
                </li>
              ))}
              {block.assessments.map((a) => (
                <li key={a.id} className="rounded-xl border border-zinc-800 px-3 py-2">
                  {new Date(a.takenAt).toLocaleDateString()} ·{" "}
                  {a.summary || "Movement check"}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Trainers for your gym / area
          </h2>
          <Link href="/find" className="text-sm text-emerald-400">
            Open search
          </Link>
        </div>
        {nearby.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No published trainers match your gym, network, or area yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {nearby.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/find/${c.id}`}
                  className="block rounded-xl border border-zinc-800 px-3 py-3 hover:border-emerald-800"
                >
                  <p className="font-medium">{c.displayName}</p>
                  <p className="text-sm text-zinc-400">{c.headline}</p>
                  <p className="text-xs text-zinc-500">
                    {c.facilityNames.join(", ") || c.city}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
