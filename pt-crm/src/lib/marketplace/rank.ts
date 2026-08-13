import { DEFAULT_RADIUS_KM } from "./types";
import { haversineKm } from "./geo";

export type RankableProfile = {
  id: string;
  featuredUntil: Date | null;
  facilityIds: string[];
  brands: string[];
  lat: number | null;
  lng: number | null;
};

export type RankQuery = {
  now: Date;
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  brand?: string | null;
  radiusKm?: number;
};

export function rankMarketplaceProfiles(
  profiles: RankableProfile[],
  query: RankQuery
): RankableProfile[] {
  const radius = query.radiusKm ?? DEFAULT_RADIUS_KM;
  const origin =
    query.lat != null && query.lng != null
      ? { lat: query.lat, lng: query.lng }
      : null;

  const brand = (query.brand || "").trim().toLowerCase();
  const kept = profiles.filter((p) => {
    if (query.facilityId && !p.facilityIds.includes(query.facilityId)) {
      return false;
    }
    if (brand && !p.brands.some((b) => b.toLowerCase() === brand)) {
      return false;
    }
    if (!origin || p.lat == null || p.lng == null) return true;
    return haversineKm(origin, { lat: p.lat, lng: p.lng }) <= radius;
  });

  return kept.sort((a, b) => {
    const aFeat = a.featuredUntil && a.featuredUntil > query.now ? 1 : 0;
    const bFeat = b.featuredUntil && b.featuredUntil > query.now ? 1 : 0;
    if (bFeat !== aFeat) return bFeat - aFeat;
    const fid = query.facilityId;
    if (fid) {
      const aGym = a.facilityIds.includes(fid) ? 1 : 0;
      const bGym = b.facilityIds.includes(fid) ? 1 : 0;
      if (bGym !== aGym) return bGym - aGym;
    }
    if (brand) {
      const aNet = a.brands.some((b) => b.toLowerCase() === brand) ? 1 : 0;
      const bNet = b.brands.some((b) => b.toLowerCase() === brand) ? 1 : 0;
      if (bNet !== aNet) return bNet - aNet;
    }
    if (origin && a.lat != null && a.lng != null && b.lat != null && b.lng != null) {
      return (
        haversineKm(origin, { lat: a.lat, lng: a.lng }) -
        haversineKm(origin, { lat: b.lat, lng: b.lng })
      );
    }
    return a.id.localeCompare(b.id);
  });
}
