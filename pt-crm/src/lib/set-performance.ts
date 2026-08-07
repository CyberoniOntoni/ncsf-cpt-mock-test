/**
 * Floor PR / estimated 1RM helpers (pure TS, no I/O).
 * Epley e1RM: weight × (1 + reps/30). Valid for ~1–12 reps.
 */

export type SetPerf = {
  weightKg: number | null;
  reps: string;
  completed?: boolean;
};

/**
 * Epley estimated 1RM.
 * - null if weight ≤ 0 or reps ≤ 0
 * - null if reps > 15 (too far from formula validity)
 * - for 13–15 reps, caps formula input at 12
 * - for 1–12, uses actual reps
 */
export function estimateE1RM(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps > 0)) return null;
  if (reps > 15) return null;
  const r = Math.min(reps, 12);
  return weightKg * (1 + r / 30);
}

/** First integer found in a reps string (e.g. "8-10" → 8, "AMRAP" → null). */
export function parseRepsCount(reps: string | null | undefined): number | null {
  if (reps == null || reps === "") return null;
  const m = String(reps).match(/(\d+)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

type WorkingBest = { weightKg: number; reps: number; e1rm: number };

/**
 * Best working set by e1RM, then heaviest weight.
 * Prefers completed sets; if none completed, uses sets that have weight.
 */
export function bestWorkingSet(sets: SetPerf[]): WorkingBest | null {
  if (!sets?.length) return null;

  const completed = sets.filter((s) => s.completed);
  const pool =
    completed.length > 0
      ? completed
      : sets.filter((s) => s.weightKg != null && s.weightKg > 0);

  let best: WorkingBest | null = null;

  for (const s of pool) {
    const w = s.weightKg;
    if (w == null || !(w > 0)) continue;
    const r = parseRepsCount(s.reps);
    if (r == null) continue;
    const e1rm = estimateE1RM(w, r);
    if (e1rm == null) continue;

    if (
      !best ||
      e1rm > best.e1rm + 1e-9 ||
      (Math.abs(e1rm - best.e1rm) < 1e-9 && w > best.weightKg)
    ) {
      best = { weightKg: w, reps: r, e1rm };
    }
  }

  return best;
}

export type PrComparison = {
  kind: "pr" | "match" | "under" | "none";
  message: string;
  currentE1rm?: number;
  previousE1rm?: number;
};

/** Compact kg label for floor UI (e.g. "2.5", "100"). */
function fmtNum(n: number): string {
  const a = Math.abs(n);
  if (Number.isInteger(n) || a >= 10) return n.toFixed(0);
  return n.toFixed(1);
}

/**
 * Compare current sets to previous session for the same lift.
 * - pr: current best e1rm > previous by ≥ 0.5 kg, or heavier top set
 * - match: within ~1% e1rm
 * - under: clearly worse
 * - none: insufficient data
 */
export function compareToPrevious(
  current: SetPerf[],
  previous: SetPerf[]
): PrComparison {
  const cur = bestWorkingSet(current);
  const prev = bestWorkingSet(previous);

  if (!cur && !prev) {
    return { kind: "none", message: "No sets to compare" };
  }
  if (!cur) {
    return {
      kind: "none",
      message: "No current working set",
      previousE1rm: prev?.e1rm,
    };
  }
  if (!prev) {
    return {
      kind: "none",
      message: "No previous session",
      currentE1rm: cur.e1rm,
    };
  }

  const delta = cur.e1rm - prev.e1rm;
  const pct =
    prev.e1rm > 0 ? Math.abs(delta) / prev.e1rm : Number.POSITIVE_INFINITY;
  const heavierTop = cur.weightKg > prev.weightKg + 0.05;

  // PR: e1RM up by ≥ 0.5 kg equivalent, or heavier top set
  if (delta >= 0.5 || heavierTop) {
    const msg =
      delta >= 0.5
        ? `PR · e1RM +${fmtNum(delta)} kg`
        : `PR · heavier top set ${fmtNum(cur.weightKg)} kg`;
    return {
      kind: "pr",
      message: msg,
      currentE1rm: cur.e1rm,
      previousE1rm: prev.e1rm,
    };
  }

  // Match: within ~1% e1RM, or absolute delta under 0.5 kg
  if (pct <= 0.01 || Math.abs(delta) < 0.5) {
    return {
      kind: "match",
      message: "Match · same ballpark",
      currentE1rm: cur.e1rm,
      previousE1rm: prev.e1rm,
    };
  }

  return {
    kind: "under",
    message: `Under · e1RM ${fmtNum(delta)} kg`,
    currentE1rm: cur.e1rm,
    previousE1rm: prev.e1rm,
  };
}

/**
 * Short floor UI strip line from a comparison (optional last exercise line).
 * e.g. "PR · e1RM +2.5 kg" or "Match · same ballpark · Squat"
 */
export function formatPrStrip(
  comparison: PrComparison,
  lastLine?: string | null
): string {
  const base = comparison.message?.trim() || "—";
  const tag = lastLine?.trim();
  if (!tag) return base;
  if (base === "—") return tag;
  return `${base} · ${tag}`;
}
