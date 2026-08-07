export type AssessmentFieldDef = {
  key: string;
  label: string;
  type: string;
  options?: string[];
  side?: string;
  help?: string;
};

export type FieldDelta = {
  key: string;
  label: string;
  baseline: string;
  latest: string;
  /** improved | declined | same | unknown */
  change: "improved" | "declined" | "same" | "unknown";
};

function str(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

/** Heuristic change direction for PT screens */
export function classifyChange(
  fieldType: string,
  key: string,
  baseline: unknown,
  latest: unknown
): FieldDelta["change"] {
  if (baseline === latest || str(baseline) === str(latest)) return "same";
  if (baseline === undefined || baseline === null || baseline === "") return "unknown";
  if (latest === undefined || latest === null || latest === "") return "unknown";

  if (fieldType === "pass_fail" || /pass/i.test(key)) {
    const b = String(baseline).toLowerCase();
    const l = String(latest).toLowerCase();
    if (b === "fail" && l === "pass") return "improved";
    if (b === "pass" && l === "fail") return "declined";
    return "same";
  }

  const bn = Number(baseline);
  const ln = Number(latest);
  if (!Number.isNaN(bn) && !Number.isNaN(ln)) {
    // Back-scratch gap/over: smaller (or more negative overlap) is better.
    // Ankle wall-test cm, stance seconds, scores: larger is better.
    const lowerBetter = /gap|_over|pain_score|rpe|time_to/i.test(key);
    if (lowerBetter) {
      if (ln < bn) return "improved";
      if (ln > bn) return "declined";
      return "same";
    }
    if (ln > bn) return "improved";
    if (ln < bn) return "declined";
    return "same";
  }

  // select quality: good > limited > poor
  const rank: Record<string, number> = {
    good: 3,
    limited: 2,
    poor: 1,
    neutral: 2,
    pass: 2,
    fail: 0,
  };
  const br = rank[String(baseline).toLowerCase()];
  const lr = rank[String(latest).toLowerCase()];
  if (br != null && lr != null) {
    if (lr > br) return "improved";
    if (lr < br) return "declined";
    return "same";
  }

  return "unknown";
}

export function compareAssessments(
  fields: AssessmentFieldDef[],
  baselineResults: Record<string, unknown>,
  latestResults: Record<string, unknown>
): FieldDelta[] {
  const keys = new Set([
    ...Object.keys(baselineResults || {}),
    ...Object.keys(latestResults || {}),
    ...fields.map((f) => f.key),
  ]);

  const labelByKey = new Map(fields.map((f) => [f.key, f.label]));
  const typeByKey = new Map(fields.map((f) => [f.key, f.type]));

  const deltas: FieldDelta[] = [];
  for (const key of keys) {
    if (!key) continue;
    const b = baselineResults?.[key];
    const l = latestResults?.[key];
    if ((b === undefined || b === "") && (l === undefined || l === "")) continue;
    deltas.push({
      key,
      label: labelByKey.get(key) || key,
      baseline: formatResultValue(b),
      latest: formatResultValue(l),
      change: classifyChange(typeByKey.get(key) || "text", key, b, l),
    });
  }
  return deltas;
}

function formatResultValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function summarizeResults(
  fields: AssessmentFieldDef[],
  results: Record<string, unknown>
): string {
  return fields
    .map((f) => {
      const v = results[f.key];
      if (v === undefined || v === null || v === "") return null;
      return `${f.label}: ${formatResultValue(v)}`;
    })
    .filter(Boolean)
    .join("; ");
}

export function overallTrend(deltas: FieldDelta[]): "improved" | "declined" | "mixed" | "same" | "n/a" {
  if (!deltas.length) return "n/a";
  const imp = deltas.filter((d) => d.change === "improved").length;
  const dec = deltas.filter((d) => d.change === "declined").length;
  if (imp && dec) return "mixed";
  if (imp) return "improved";
  if (dec) return "declined";
  if (deltas.every((d) => d.change === "same")) return "same";
  return "mixed";
}
