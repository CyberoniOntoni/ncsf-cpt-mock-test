/**
 * Measurement field catalog — core columns + extra girths in `metrics` JSON.
 */

export type MeasurementFieldKey =
  | "heightCm"
  | "weightKg"
  | "bodyFatPct"
  | "chestCm"
  | "waistCm"
  | "hipsCm"
  | "neck_cm"
  | "shoulders_cm"
  | "biceps_r_cm"
  | "biceps_l_cm"
  | "forearm_r_cm"
  | "forearm_l_cm"
  | "wrist_r_cm"
  | "wrist_l_cm"
  | "thigh_r_cm"
  | "thigh_l_cm"
  | "calf_r_cm"
  | "calf_l_cm"
  | "ankle_r_cm"
  | "ankle_l_cm";

export type MeasurementFieldDef = {
  key: MeasurementFieldKey;
  label: string;
  unit: string;
  /** Stored on dedicated column vs metrics JSON */
  storage: "column" | "metrics";
  /** Lower is typically “good” for progress colour (BF, waist, etc.) */
  invertDelta?: boolean;
  group: "core" | "torso" | "arms" | "legs";
};

/** Columns on client_measurements table */
export const COLUMN_FIELDS: MeasurementFieldDef[] = [
  {
    key: "weightKg",
    label: "Weight",
    unit: "kg",
    storage: "column",
    group: "core",
  },
  {
    key: "bodyFatPct",
    label: "Body fat",
    unit: "%",
    storage: "column",
    invertDelta: true,
    group: "core",
  },
  {
    key: "heightCm",
    label: "Height",
    unit: "cm",
    storage: "column",
    group: "core",
  },
  {
    key: "chestCm",
    label: "Chest",
    unit: "cm",
    storage: "column",
    group: "torso",
  },
  {
    key: "waistCm",
    label: "Waist",
    unit: "cm",
    storage: "column",
    invertDelta: true,
    group: "torso",
  },
  {
    key: "hipsCm",
    label: "Hips",
    unit: "cm",
    storage: "column",
    invertDelta: true,
    group: "torso",
  },
];

/** Extra girths stored in metrics JSONB */
export const METRIC_GIRTH_FIELDS: MeasurementFieldDef[] = [
  {
    key: "neck_cm",
    label: "Neck",
    unit: "cm",
    storage: "metrics",
    group: "torso",
  },
  {
    key: "shoulders_cm",
    label: "Shoulders",
    unit: "cm",
    storage: "metrics",
    group: "torso",
  },
  {
    key: "biceps_r_cm",
    label: "Biceps (R)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "biceps_l_cm",
    label: "Biceps (L)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "forearm_r_cm",
    label: "Forearm (R)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "forearm_l_cm",
    label: "Forearm (L)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "wrist_r_cm",
    label: "Wrist (R)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "wrist_l_cm",
    label: "Wrist (L)",
    unit: "cm",
    storage: "metrics",
    group: "arms",
  },
  {
    key: "thigh_r_cm",
    label: "Thigh (R)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
  {
    key: "thigh_l_cm",
    label: "Thigh (L)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
  {
    key: "calf_r_cm",
    label: "Calf (R)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
  {
    key: "calf_l_cm",
    label: "Calf (L)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
  {
    key: "ankle_r_cm",
    label: "Ankle (R)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
  {
    key: "ankle_l_cm",
    label: "Ankle (L)",
    unit: "cm",
    storage: "metrics",
    group: "legs",
  },
];

export const ALL_MEASUREMENT_FIELDS: MeasurementFieldDef[] = [
  ...COLUMN_FIELDS,
  ...METRIC_GIRTH_FIELDS,
];

export const METRIC_KEYS = METRIC_GIRTH_FIELDS.map((f) => f.key);

export type MeasurementRowLike = {
  heightCm?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  chestCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  notes?: string | null;
  metrics?: Record<string, number | string> | null;
};

const labelByKey = new Map(
  ALL_MEASUREMENT_FIELDS.map((f) => [f.key, f] as const)
);

export function getFieldDef(key: string): MeasurementFieldDef | undefined {
  return labelByKey.get(key as MeasurementFieldKey);
}

/** Flatten column + metrics into a single map of numeric values */
export function flattenMeasurementValues(
  m: MeasurementRowLike
): Record<string, number> {
  const out: Record<string, number> = {};
  if (m.heightCm != null && !Number.isNaN(m.heightCm)) out.heightCm = m.heightCm;
  if (m.weightKg != null && !Number.isNaN(m.weightKg)) out.weightKg = m.weightKg;
  if (m.bodyFatPct != null && !Number.isNaN(m.bodyFatPct))
    out.bodyFatPct = m.bodyFatPct;
  if (m.chestCm != null && !Number.isNaN(m.chestCm)) out.chestCm = m.chestCm;
  if (m.waistCm != null && !Number.isNaN(m.waistCm)) out.waistCm = m.waistCm;
  if (m.hipsCm != null && !Number.isNaN(m.hipsCm)) out.hipsCm = m.hipsCm;

  const metrics = m.metrics || {};
  for (const [k, v] of Object.entries(metrics)) {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isNaN(n)) out[k] = n;
  }
  return out;
}

/** One-line summary for lists */
export function formatMeasurementSummary(m: MeasurementRowLike): string {
  const flat = flattenMeasurementValues(m);
  const parts: string[] = [];
  const order = ALL_MEASUREMENT_FIELDS.map((f) => f.key);
  for (const key of order) {
    const v = flat[key];
    if (v == null) continue;
    const def = getFieldDef(key);
    if (!def) continue;
    // Compact: skip height in summary if weight present (less clutter)
    if (key === "heightCm" && flat.weightKg != null) continue;
    parts.push(`${def.label} ${v}${def.unit === "%" ? "%" : ` ${def.unit}`}`);
  }
  if (m.notes?.trim()) parts.push(m.notes.trim());
  return parts.join(" · ") || "—";
}

export function parseMetricsFromFormData(
  formData: FormData
): Record<string, number> {
  const metrics: Record<string, number> = {};
  for (const field of METRIC_GIRTH_FIELDS) {
    const raw = String(formData.get(field.key) ?? "").trim();
    if (!raw) continue;
    const n = Number(raw);
    if (Number.isNaN(n)) throw new Error(`${field.label}: use a number`);
    metrics[field.key] = n;
  }
  return metrics;
}
