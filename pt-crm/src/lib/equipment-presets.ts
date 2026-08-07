/**
 * Studio inventory presets — slug sets applied from the equipment page.
 * Bodyweight is always implied (not listed in catalog UI).
 */

export type EquipmentPreset = {
  id: string;
  label: string;
  blurb: string;
  /** If "all" / "none", ignore slugs. Else enable only these slugs. */
  mode: "slugs" | "all" | "none";
  slugs?: string[];
};

/** Common small-studio baseline (matches seed DEFAULT_OFF inverted). */
const STUDIO_CORE = [
  "dumbbell",
  "barbell",
  "kettlebell",
  "ez-bar",
  "weight-plate",
  "cable",
  "lat-pulldown",
  "seated-row",
  "chest-press-machine",
  "shoulder-press-machine",
  "pec-deck",
  "leg-press",
  "leg-extension",
  "leg-curl",
  "hip-abductor",
  "hip-adductor",
  "calf-raise-machine",
  "pullup-bar",
  "dip-bars",
  "bench",
  "rack",
  "bands",
  "foam-roller",
  "lacrosse-ball",
  "medicine-ball",
  "slam-ball",
  "suspension",
  "box",
  "ab-wheel",
  "stability-ball",
  "bosu",
  "parallette",
  "pvc-pipe",
  "yoga-mat",
  "cardio-bike",
  "treadmill",
  "elliptical",
  "jump-rope",
];

export const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  {
    id: "studio",
    label: "PT studio",
    blurb: "Typical floor gear — specialty machines off",
    mode: "slugs",
    slugs: STUDIO_CORE,
  },
  {
    id: "commercial",
    label: "Full commercial",
    blurb: "Everything on — big-box inventory",
    mode: "all",
  },
  {
    id: "garage",
    label: "Garage gym",
    blurb: "Barbell, rack, DBs, bench, basics",
    mode: "slugs",
    slugs: [
      "dumbbell",
      "barbell",
      "kettlebell",
      "trap-bar",
      "ez-bar",
      "weight-plate",
      "swiss-bar",
      "pullup-bar",
      "dip-bars",
      "bench",
      "rack",
      "bands",
      "foam-roller",
      "landmine",
      "box",
      "ab-wheel",
      "pvc-pipe",
      "yoga-mat",
      "jump-rope",
      "sled",
    ],
  },
  {
    id: "home",
    label: "Home minimal",
    blurb: "DBs, bands, bodyweight tools",
    mode: "slugs",
    slugs: [
      "dumbbell",
      "kettlebell",
      "bands",
      "bench",
      "pullup-bar",
      "foam-roller",
      "lacrosse-ball",
      "suspension",
      "box",
      "ab-wheel",
      "yoga-mat",
      "jump-rope",
      "parallette",
      "stability-ball",
    ],
  },
  {
    id: "hotel",
    label: "Travel / hotel",
    blurb: "Bands, TRX, rope, mat only",
    mode: "slugs",
    slugs: [
      "bands",
      "suspension",
      "jump-rope",
      "yoga-mat",
      "foam-roller",
      "lacrosse-ball",
      "ab-wheel",
    ],
  },
  {
    id: "bw",
    label: "Bodyweight only",
    blurb: "No free weights or machines",
    mode: "slugs",
    slugs: [
      "pullup-bar",
      "dip-bars",
      "bands",
      "suspension",
      "box",
      "parallette",
      "ab-wheel",
      "stability-ball",
      "bosu",
      "foam-roller",
      "lacrosse-ball",
      "yoga-mat",
      "pvc-pipe",
      "jump-rope",
    ],
  },
  {
    id: "none",
    label: "Clear all",
    blurb: "Disable every catalog item",
    mode: "none",
  },
];

export function presetAvailability(
  preset: EquipmentPreset,
  catalog: { id: string; slug: string }[]
): { equipmentId: string; available: boolean }[] {
  if (preset.mode === "all") {
    return catalog.map((c) => ({ equipmentId: c.id, available: true }));
  }
  if (preset.mode === "none") {
    return catalog.map((c) => ({ equipmentId: c.id, available: false }));
  }
  const on = new Set(preset.slugs || []);
  return catalog.map((c) => ({
    equipmentId: c.id,
    available: on.has(c.slug),
  }));
}
