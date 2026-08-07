/**
 * Weekly / session volume by movement pattern (Lane B+).
 * Pure helpers — no DB.
 */

import { parseRepsCount } from "@/lib/set-performance";
import { patternLabel } from "@/lib/exercise-meta";

export type VolumeSetInput = {
  movementPattern?: string | null;
  exerciseName?: string;
  isWarmup?: boolean;
  setLogs?: Array<{
    reps?: string | null;
    weightKg?: number | null;
    completed?: boolean;
  }> | null;
  /** Fallback if no set logs */
  weightKg?: number | null;
  actualSets?: number | null;
  actualReps?: string | null;
  completed?: boolean;
};

export type PatternVolumeRow = {
  pattern: string;
  label: string;
  sets: number;
  reps: number;
  volumeKg: number;
  topSetKg: number | null;
};

export type VolumeReport = {
  totalSets: number;
  totalReps: number;
  totalVolumeKg: number;
  byPattern: PatternVolumeRow[];
  /** ISO date range label for UI */
  rangeLabel?: string;
};

function patternKey(p?: string | null): string {
  const k = (p || "other").trim().toLowerCase() || "other";
  return k;
}

/**
 * Accumulate completed working sets into pattern buckets.
 * Skips warm-ups by default.
 */
export function accumulateVolumeByPattern(
  rows: VolumeSetInput[],
  opts?: { includeWarmups?: boolean }
): VolumeReport {
  const includeWarmups = !!opts?.includeWarmups;
  const map = new Map<
    string,
    { sets: number; reps: number; volumeKg: number; topSetKg: number | null }
  >();

  for (const row of rows) {
    if (row.isWarmup && !includeWarmups) continue;
    const key = patternKey(row.movementPattern);
    const bucket = map.get(key) || {
      sets: 0,
      reps: 0,
      volumeKg: 0,
      topSetKg: null as number | null,
    };

    const logs = row.setLogs;
    if (logs && logs.length) {
      for (const s of logs) {
        if (!s.completed) continue;
        const r = parseRepsCount(s.reps || "") || 0;
        const w =
          s.weightKg != null && Number.isFinite(s.weightKg) ? s.weightKg : 0;
        bucket.sets += 1;
        bucket.reps += r;
        if (w > 0 && r > 0) bucket.volumeKg += w * r;
        if (w > 0 && (bucket.topSetKg == null || w > bucket.topSetKg)) {
          bucket.topSetKg = w;
        }
      }
    } else if (row.completed) {
      // Legacy summary row
      const sets = Math.max(1, row.actualSets || 1);
      const r = parseRepsCount(row.actualReps || "") || 0;
      const w =
        row.weightKg != null && Number.isFinite(row.weightKg)
          ? row.weightKg
          : 0;
      bucket.sets += sets;
      bucket.reps += r * sets;
      if (w > 0 && r > 0) bucket.volumeKg += w * r * sets;
      if (w > 0 && (bucket.topSetKg == null || w > bucket.topSetKg)) {
        bucket.topSetKg = w;
      }
    }

    map.set(key, bucket);
  }

  const byPattern: PatternVolumeRow[] = Array.from(map.entries())
    .map(([pattern, b]) => ({
      pattern,
      label: patternLabel(pattern),
      sets: b.sets,
      reps: b.reps,
      volumeKg: Math.round(b.volumeKg * 10) / 10,
      topSetKg: b.topSetKg,
    }))
    .filter((r) => r.sets > 0)
    .sort((a, b) => b.volumeKg - a.volumeKg || b.sets - a.sets);

  const totalSets = byPattern.reduce((n, r) => n + r.sets, 0);
  const totalReps = byPattern.reduce((n, r) => n + r.reps, 0);
  const totalVolumeKg =
    Math.round(byPattern.reduce((n, r) => n + r.volumeKg, 0) * 10) / 10;

  return { totalSets, totalReps, totalVolumeKg, byPattern };
}

/** Sessions needed to complete one mesocycle “week” of training (default = days/week). */
export function sessionsToAdvanceMesocycle(
  daysPerWeek: number,
  override?: number | null
): number {
  if (override != null && override > 0) return Math.round(override);
  return Math.min(6, Math.max(2, daysPerWeek || 3));
}

/**
 * Whether to auto-advance: completed sessions in current week window
 * reached threshold, and we haven't already advanced for this counter.
 */
export function shouldAutoAdvanceMesocycle(opts: {
  completedInWindow: number;
  threshold: number;
  /** Sessions count when we last advanced (or 0) */
  sessionsAtLastAdvance: number;
}): boolean {
  if (opts.threshold <= 0) return false;
  if (opts.completedInWindow < opts.threshold) return false;
  // Advance when we've completed another full threshold since last advance
  const since = opts.completedInWindow - opts.sessionsAtLastAdvance;
  return since >= opts.threshold;
}
