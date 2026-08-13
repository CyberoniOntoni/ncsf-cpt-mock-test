export const MARKETPLACE_SPECIALTIES = [
  { slug: "strength", label: "Strength" },
  { slug: "hypertrophy", label: "Muscle / hypertrophy" },
  { slug: "fat_loss", label: "Fat loss" },
  { slug: "beginner", label: "Beginners" },
  { slug: "mobility", label: "Mobility" },
  { slug: "sports", label: "Sports performance" },
  { slug: "older_adults", label: "Older adults" },
  { slug: "prenatal", label: "Pre / postnatal" },
  { slug: "rehab_friendly", label: "Post-rehab friendly" },
  { slug: "online", label: "Online coaching" },
] as const;

export const MARKETPLACE_SERVICE_MODES = [
  { slug: "studio", label: "My studio" },
  { slug: "at_gym", label: "Client’s gym" },
  { slug: "in_home", label: "In-home" },
  { slug: "online", label: "Online" },
] as const;

export const MARKETPLACE_CURRENCIES = ["SGD", "USD"] as const;

export function parseCsvSlugs(raw?: string | null): string[] {
  return (raw || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinCsvSlugs(slugs: string[]): string {
  return [...new Set(slugs.map((s) => s.trim()).filter(Boolean))].join(",");
}

export function specialtyLabel(slug: string): string {
  return MARKETPLACE_SPECIALTIES.find((s) => s.slug === slug)?.label || slug;
}
