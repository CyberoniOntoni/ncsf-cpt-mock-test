import type { SessionSetLog } from "@/db/schema";

export type ProgressionSuggestion = {
  message: string;
  kind: "load" | "reps" | "hold" | "form";
  /** Suggested working weight if applicable */
  suggestedKg?: number | null;
};

/** Parse planned reps like "8-10", "5", "8–12", "AMRAP". */
export function parseRepRange(
  plannedReps: string | null | undefined
): { low: number; high: number } | null {
  if (!plannedReps) return null;
  const s = plannedReps.trim();
  if (/amrap/i.test(s)) return null;
  const m = s.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
  if (m) return { low: Number(m[1]), high: Number(m[2]) };
  const single = s.match(/^(\d+)\s*$/);
  if (single) {
    const n = Number(single[1]);
    return { low: n, high: n };
  }
  return null;
}

function avgRpe(sets: SessionSetLog[]): number | null {
  const vals = sets
    .map((s) => {
      const n = parseFloat(String(s.rpe ?? "").replace(",", "."));
      return Number.isFinite(n) ? n : null;
    })
    .filter((n): n is number => n != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function workingSets(sets: SessionSetLog[]): SessionSetLog[] {
  // Prefer completed working sets; ignore empty warm-up-ish zero loads if mixed
  const done = sets.filter((s) => s.completed);
  return done.length ? done : sets.filter((s) => s.weightKg != null);
}

/**
 * Suggest next-session progression from the last logged performance.
 * Conservative PT rules — never aggressive.
 */
export function suggestProgression(input: {
  plannedReps?: string | null;
  lastSets: SessionSetLog[];
}): ProgressionSuggestion | null {
  const sets = workingSets(input.lastSets);
  if (!sets.length) return null;

  const allDone = sets.every((s) => s.completed);
  if (!allDone && !sets.some((s) => s.completed)) return null;

  const weights = sets
    .map((s) => s.weightKg)
    .filter((w): w is number => w != null && !Number.isNaN(w));
  const topKg = weights.length ? Math.max(...weights) : null;
  const rpe = avgRpe(sets);
  const range = parseRepRange(input.plannedReps);

  const repNums = sets
    .map((s) => {
      const m = String(s.reps || "").match(/(\d+)/);
      return m ? Number(m[1]) : null;
    })
    .filter((n): n is number => n != null);

  const hitTopOfRange =
    range != null &&
    repNums.length > 0 &&
    repNums.every((r) => r >= range.high);

  const hitTarget =
    range != null &&
    repNums.length > 0 &&
    repNums.every((r) => r >= range.low);

  // Hard session — hold or deload cue
  if (rpe != null && rpe >= 9) {
    return {
      kind: "hold",
      message: `Last RPE ~${rpe.toFixed(1)} — hold load or drop 5–10% and own form.`,
      suggestedKg: topKg,
    };
  }

  // Clean top-end sets → bump load
  if (
    allDone &&
    hitTopOfRange &&
    topKg != null &&
    (rpe == null || rpe <= 7.5)
  ) {
    const bump = topKg >= 60 ? 2.5 : topKg >= 20 ? 2 : 1;
    const next = Math.round((topKg + bump) * 2) / 2;
    return {
      kind: "load",
      message: `Hit top of range clean${rpe != null ? ` @ RPE ${rpe.toFixed(1)}` : ""} — try ${next} kg next.`,
      suggestedKg: next,
    };
  }

  // In range but room for more reps
  if (
    allDone &&
    hitTarget &&
    range &&
    !hitTopOfRange &&
    (rpe == null || rpe <= 8)
  ) {
    return {
      kind: "reps",
      message: `Solid sets — push toward ${range.high} reps before adding load.`,
      suggestedKg: topKg,
    };
  }

  // Incomplete last time
  if (!allDone) {
    return {
      kind: "form",
      message: "Last session incomplete — match prior completed sets first.",
      suggestedKg: topKg,
    };
  }

  if (topKg != null) {
    return {
      kind: "hold",
      message: `Last top set ${topKg} kg — repeat and chase clean reps.`,
      suggestedKg: topKg,
    };
  }

  return null;
}

/** Compact one-line last performance for floor UI. */
export function formatLastPerformance(sets: SessionSetLog[]): string | null {
  const done = sets.filter((s) => s.completed || s.weightKg != null);
  if (!done.length) return null;
  const parts = done.slice(0, 5).map((s) => {
    if (s.weightKg != null) return `${s.reps || "?"}@${s.weightKg}`;
    return s.reps || "?";
  });
  return parts.join(", ");
}
