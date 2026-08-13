import Link from "next/link";
import { FindSearch } from "@/components/find-search";
import { listPublicGyms, searchPublicProfiles } from "@/db/queries/marketplace";
import { DEFAULT_RADIUS_KM } from "@/lib/marketplace/types";

export const dynamic = "force-dynamic";

export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ gym?: string; lat?: string; lng?: string; radius?: string }>;
}) {
  const sp = await searchParams;
  const gyms = await listPublicGyms();
  const gymParam = (sp.gym || "").trim();
  const facility =
    gyms.find((g) => g.id === gymParam || g.slug === gymParam) || null;
  const lat = sp.lat != null && sp.lat !== "" ? Number(sp.lat) : null;
  const lng = sp.lng != null && sp.lng !== "" ? Number(sp.lng) : null;
  const radius = sp.radius != null ? Number(sp.radius) : DEFAULT_RADIUS_KM;
  const cards = await searchPublicProfiles({
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    facilityId: facility?.id ?? null,
    radiusKm: Number.isFinite(radius) ? radius : DEFAULT_RADIUS_KM,
  });

  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 text-zinc-100">
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
        gym={facility?.id || gymParam}
        lat={sp.lat}
        lng={sp.lng}
        radius={sp.radius}
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
                <p className="mt-1 text-xs text-zinc-500">
                  {[c.city, c.region].filter(Boolean).join(" · ")}
                  {c.facilityNames.length
                    ? ` · ${c.facilityNames.join(", ")}`
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
