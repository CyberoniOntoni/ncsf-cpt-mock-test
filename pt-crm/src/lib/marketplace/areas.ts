export type TrainingArea = {
  slug: string;
  label: string;
  city: string;
  lat: number;
  lng: number;
};

/** Named training areas. Clients pick a label; lat/lng stay internal for distance. */
export const TRAINING_AREAS: TrainingArea[] = [
  { slug: "ang-mo-kio", label: "Ang Mo Kio", city: "Singapore", lat: 1.3691, lng: 103.8454 },
  { slug: "bedok", label: "Bedok", city: "Singapore", lat: 1.3236, lng: 103.9273 },
  { slug: "bishan", label: "Bishan", city: "Singapore", lat: 1.3526, lng: 103.8352 },
  { slug: "bukit-timah", label: "Bukit Timah", city: "Singapore", lat: 1.3294, lng: 103.8021 },
  { slug: "clementi", label: "Clementi", city: "Singapore", lat: 1.3162, lng: 103.7649 },
  { slug: "harbourfront", label: "HarbourFront", city: "Singapore", lat: 1.2654, lng: 103.822 },
  { slug: "jurong-east", label: "Jurong East", city: "Singapore", lat: 1.3329, lng: 103.7436 },
  { slug: "marine-parade", label: "Marine Parade", city: "Singapore", lat: 1.303, lng: 103.9072 },
  { slug: "novena", label: "Novena", city: "Singapore", lat: 1.3201, lng: 103.8439 },
  { slug: "orchard", label: "Orchard", city: "Singapore", lat: 1.3048, lng: 103.8318 },
  { slug: "pasir-ris", label: "Pasir Ris", city: "Singapore", lat: 1.3721, lng: 103.9474 },
  { slug: "punggol", label: "Punggol", city: "Singapore", lat: 1.4052, lng: 103.9023 },
  { slug: "queenstown", label: "Queenstown", city: "Singapore", lat: 1.2942, lng: 103.7861 },
  { slug: "sengkang", label: "Sengkang", city: "Singapore", lat: 1.3917, lng: 103.895 },
  { slug: "tampines", label: "Tampines", city: "Singapore", lat: 1.3496, lng: 103.9568 },
  { slug: "tanjong-pagar", label: "Tanjong Pagar", city: "Singapore", lat: 1.2764, lng: 103.8458 },
  { slug: "toa-payoh", label: "Toa Payoh", city: "Singapore", lat: 1.3343, lng: 103.8563 },
  { slug: "woodlands", label: "Woodlands", city: "Singapore", lat: 1.436, lng: 103.7865 },
];

export const TRAINING_CITIES = ["Singapore"] as const;

export function findTrainingArea(slug?: string | null): TrainingArea | null {
  if (!slug) return null;
  const key = slug.trim().toLowerCase();
  return TRAINING_AREAS.find((a) => a.slug === key) ?? null;
}

export function areaFromCoords(
  lat?: number | null,
  lng?: number | null
): TrainingArea | null {
  if (lat == null || lng == null) return null;
  let best: TrainingArea | null = null;
  let bestD = Number.POSITIVE_INFINITY;
  for (const area of TRAINING_AREAS) {
    const d = (area.lat - lat) ** 2 + (area.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = area;
    }
  }
  return best;
}

export function resolveSearchOrigin(opts: {
  areaSlug?: string | null;
  lat?: number | null;
  lng?: number | null;
}): { lat: number; lng: number; area: TrainingArea } | null {
  const named = findTrainingArea(opts.areaSlug);
  if (named) return { lat: named.lat, lng: named.lng, area: named };
  const inferred = areaFromCoords(opts.lat, opts.lng);
  if (inferred) return { lat: inferred.lat, lng: inferred.lng, area: inferred };
  return null;
}
