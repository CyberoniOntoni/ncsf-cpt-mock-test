import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  gymFacilities,
  marketplaceProfileFacilities,
  marketplaceProfiles,
  platformCharges,
  users,
} from "@/db/schema";
import { listingVisibleInSearch } from "@/lib/marketplace/fees";
import { rankMarketplaceProfiles } from "@/lib/marketplace/rank";

export type PublicProfileCard = {
  id: string;
  displayName: string;
  title: string | null;
  headline: string;
  city: string;
  region: string | null;
  hourlyRateCents: number | null;
  currency: string;
  serviceModes: string[];
  facilityNames: string[];
  featured: boolean;
  lat: number | null;
  lng: number | null;
};

function splitCsv(s: string | null | undefined): string[] {
  return (s || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

async function unpaidIntroCounts(
  orgIds: string[]
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (orgIds.length === 0) return map;
  const db = await getDb();
  const rows = await db
    .select({
      organizationId: platformCharges.organizationId,
      status: platformCharges.status,
      kind: platformCharges.kind,
    })
    .from(platformCharges)
    .where(inArray(platformCharges.organizationId, orgIds));
  for (const r of rows) {
    if (r.kind === "intro_accept" && r.status === "due") {
      map.set(r.organizationId, (map.get(r.organizationId) || 0) + 1);
    }
  }
  return map;
}

export async function listPublicGyms(): Promise<
  { id: string; name: string; slug: string; city: string; brand: string | null }[]
> {
  const db = await getDb();
  const rows = await db.select().from(gymFacilities);
  return rows.map((g) => ({
    id: g.id,
    name: g.name,
    slug: g.slug,
    city: g.city,
    brand: g.brand,
  }));
}

export function listPublicBrands(
  gyms: { brand: string | null }[]
): string[] {
  return [
    ...new Set(
      gyms
        .map((g) => (g.brand || "").trim())
        .filter(Boolean)
    ),
  ].sort((a, b) => a.localeCompare(b));
}

export async function searchPublicProfiles(input: {
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  brand?: string | null;
  radiusKm?: number;
  now?: Date;
}): Promise<PublicProfileCard[]> {
  const db = await getDb();
  const now = input.now ?? new Date();
  const published = await db
    .select({
      id: marketplaceProfiles.id,
      organizationId: marketplaceProfiles.organizationId,
      userId: marketplaceProfiles.userId,
      headline: marketplaceProfiles.headline,
      city: marketplaceProfiles.city,
      region: marketplaceProfiles.region,
      hourlyRateCents: marketplaceProfiles.hourlyRateCents,
      currency: marketplaceProfiles.currency,
      serviceModes: marketplaceProfiles.serviceModes,
      lat: marketplaceProfiles.lat,
      lng: marketplaceProfiles.lng,
      featuredUntil: marketplaceProfiles.featuredUntil,
      published: marketplaceProfiles.published,
    })
    .from(marketplaceProfiles)
    .where(eq(marketplaceProfiles.published, true));

  const unpaid = await unpaidIntroCounts(
    published.map((p) => p.organizationId)
  );
  const visible = published.filter((p) =>
    listingVisibleInSearch({
      published: p.published,
      unpaidIntroCharges: unpaid.get(p.organizationId) || 0,
    })
  );
  if (visible.length === 0) return [];

  const links = await db
    .select()
    .from(marketplaceProfileFacilities)
    .where(
      inArray(
        marketplaceProfileFacilities.profileId,
        visible.map((p) => p.id)
      )
    );
  const facilityByProfile = new Map<string, string[]>();
  for (const l of links) {
    const arr = facilityByProfile.get(l.profileId) || [];
    arr.push(l.facilityId);
    facilityByProfile.set(l.profileId, arr);
  }

  const facilityIdsEarly = [...new Set(links.map((l) => l.facilityId))];
  const gymsForRank =
    facilityIdsEarly.length === 0
      ? []
      : await db
          .select()
          .from(gymFacilities)
          .where(inArray(gymFacilities.id, facilityIdsEarly));
  const gymById = new Map(gymsForRank.map((g) => [g.id, g]));

  const ranked = rankMarketplaceProfiles(
    visible.map((p) => {
      const fids = facilityByProfile.get(p.id) || [];
      const brands = [
        ...new Set(
          fids
            .map((fid) => gymById.get(fid)?.brand)
            .filter((b): b is string => !!b)
        ),
      ];
      return {
        id: p.id,
        featuredUntil: p.featuredUntil,
        facilityIds: fids,
        brands,
        lat: p.lat,
        lng: p.lng,
      };
    }),
    {
      now,
      lat: input.lat,
      lng: input.lng,
      facilityId: input.facilityId,
      brand: input.brand,
      radiusKm: input.radiusKm,
    }
  );

  const userIds = [...new Set(visible.map((p) => p.userId))];
  const userRows = await db
    .select({ id: users.id, name: users.name, title: users.title })
    .from(users)
    .where(inArray(users.id, userIds));
  const userById = new Map(userRows.map((u) => [u.id, u]));

  const byId = new Map(visible.map((p) => [p.id, p]));
  return ranked.map((r) => {
    const p = byId.get(r.id)!;
    const u = userById.get(p.userId);
    const fids = facilityByProfile.get(p.id) || [];
    return {
      id: p.id,
      displayName: u?.name || "Trainer",
      title: u?.title ?? null,
      headline: p.headline,
      city: p.city,
      region: p.region,
      hourlyRateCents: p.hourlyRateCents,
      currency: p.currency,
      serviceModes: splitCsv(p.serviceModes),
      facilityNames: fids
        .map((id) => gymById.get(id)?.name)
        .filter((n): n is string => !!n),
      featured: !!(p.featuredUntil && p.featuredUntil > now),
      lat: p.lat,
      lng: p.lng,
    };
  });
}

export async function getPublicProfile(
  profileId: string
): Promise<(PublicProfileCard & { bio: string; specialties: string[] }) | null> {
  const db = await getDb();
  const [p] = await db
    .select()
    .from(marketplaceProfiles)
    .where(
      and(
        eq(marketplaceProfiles.id, profileId),
        eq(marketplaceProfiles.published, true)
      )
    )
    .limit(1);
  if (!p) return null;
  const unpaid = await unpaidIntroCounts([p.organizationId]);
  if (
    !listingVisibleInSearch({
      published: true,
      unpaidIntroCharges: unpaid.get(p.organizationId) || 0,
    })
  ) {
    return null;
  }
  const cards = await searchPublicProfiles({
    lat: p.lat,
    lng: p.lng,
    radiusKm: 500,
  });
  const card = cards.find((c) => c.id === p.id);
  if (!card) return null;
  return {
    ...card,
    bio: p.bio,
    specialties: splitCsv(p.specialties),
  };
}
