import Link from "next/link";
import { FindSearch } from "@/components/find-search";
import { FindTrainerMeta } from "@/components/find-trainer-meta";
import {
  listPublicBrands,
  listPublicGyms,
  searchPublicProfiles,
} from "@/db/queries/marketplace";
import { resolveSearchOrigin } from "@/lib/marketplace/areas";
import { DEFAULT_RADIUS_KM } from "@/lib/marketplace/types";
import { getSeekerById, optionalSeekerSession } from "@/lib/seeker-auth";

export const dynamic = "force-dynamic";

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{
    gym?: string;
    brand?: string;
    area?: string;
    radius?: string;
  }>;
}) {
  const sp = await searchParams;
  const gyms = await listPublicGyms();
  const brands = listPublicBrands(gyms);
  const session = await optionalSeekerSession();
  const seeker = session ? await getSeekerById(session.seekerId) : null;

  const gymParam = (
    sp.gym !== undefined ? sp.gym : seeker?.preferredFacilityId || ""
  ).trim();
  const brandParam = (
    sp.brand !== undefined ? sp.brand : seeker?.preferredBrand || ""
  ).trim();
  const areaParam = (
    sp.area !== undefined ? sp.area : seeker?.preferredArea || ""
  ).trim();
  const facility =
    gyms.find((g) => g.id === gymParam || g.slug === gymParam) || null;
  const origin = resolveSearchOrigin({ areaSlug: areaParam });
  const lat = origin?.lat ?? null;
  const lng = origin?.lng ?? null;
  const radius =
    sp.radius != null && sp.radius !== ""
      ? Number(sp.radius)
      : seeker?.radiusKm ?? DEFAULT_RADIUS_KM;
  const cards = await searchPublicProfiles({
    lat,
    lng,
    facilityId: facility?.id ?? null,
    brand: brandParam || null,
    radiusKm: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_KM,
  });

  return (
    <main className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">
          Find a trainer
        </p>
        <h1 className="text-2xl font-semibold">Train near you or at your gym</h1>
        <p className="mt-2 text-sm text-zinc-400">
          FloorScribe introduces you. Training and session payments are between
          you and the trainer.
        </p>
      </div>
      <FindSearch
        gyms={gyms}
        brands={brands}
        gym={facility?.id || gymParam}
        brand={brandParam}
        area={origin?.area.slug || areaParam}
        radius={String(Number.isFinite(radius) ? radius : DEFAULT_RADIUS_KM)}
      />
      {cards.length === 0 ? (
        <p className="text-sm text-zinc-400">
          No trainers in that area yet. Try a wider radius or another gym.
        </p>
      ) : (
        <ul className="space-y-3">
          {cards.map((c) => (
            <li key={c.id}>
              <Link
                href={`/find/${c.id}`}
                className="block rounded-xl border border-zinc-800 bg-zinc-950 p-4 hover:border-emerald-800"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-medium">{c.displayName}</h2>
                  {c.featured ? (
                    <span className="text-xs text-emerald-400">Featured</span>
                  ) : null}
                </div>
                <p className="text-sm text-zinc-400">{c.headline}</p>
                <FindTrainerMeta
                  credentials={c.credentials}
                  title={c.title}
                  region={c.region}
                  city={c.city}
                  facilityNames={c.facilityNames}
                  specialties={c.specialties}
                  serviceModes={c.serviceModes}
                  hourlyRateCents={c.hourlyRateCents}
                  sessionRateCents={c.sessionRateCents}
                  currency={c.currency}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
