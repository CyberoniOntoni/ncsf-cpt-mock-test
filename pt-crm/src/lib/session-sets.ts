import type { SessionSetLog } from "@/db/schema";

/** Build empty/planned set rows from planned sets + reps. */
export function initSetLogs(
  plannedSets: number | null | undefined,
  plannedReps: string | null | undefined,
  prev?: SessionSetLog[] | null
): SessionSetLog[] {
  const n = Math.max(1, plannedSets || 3);
  const reps = plannedReps || "8-10";
  if (prev?.length) {
    // Resize if needed
    const out = prev.map((s, i) => ({
      setIndex: i + 1,
      reps: s.reps || reps,
      weightKg: s.weightKg ?? null,
      rpe: s.rpe ?? null,
      completed: !!s.completed,
      role: s.role ?? null,
      tempo: s.tempo ?? null,
      restSec: s.restSec ?? null,
      note: s.note ?? null,
      pain: s.pain ?? null,
    }));
    while (out.length < n) {
      const last = out[out.length - 1];
      out.push({
        setIndex: out.length + 1,
        reps: last?.reps || reps,
        weightKg: last?.weightKg ?? null,
        rpe: null,
        completed: false,
        role: last?.role ?? null,
        tempo: last?.tempo ?? null,
        restSec: last?.restSec ?? null,
        note: null,
        pain: null,
      });
    }
    return out.slice(0, Math.max(n, prev.length));
  }
  return Array.from({ length: n }, (_, i) => ({
    setIndex: i + 1,
    reps,
    weightKg: null,
    rpe: null,
    completed: false,
    pain: null,
  }));
}

export function aggregateFromSetLogs(setLogs: SessionSetLog[]): {
  actualSets: number;
  actualReps: string | null;
  weightKg: number | null;
  rpe: string | null;
  completed: boolean;
} {
  const done = setLogs.filter((s) => s.completed);
  const source = done.length ? done : setLogs;
  const weights = source
    .map((s) => s.weightKg)
    .filter((w): w is number => w != null && !Number.isNaN(w));
  const rpes = source.map((s) => s.rpe).filter((r): r is string => !!r);
  const repsList = source.map((s) => s.reps).filter(Boolean);

  return {
    actualSets: done.length || setLogs.length,
    actualReps: repsList.length ? (repsList.every((r) => r === repsList[0]) ? repsList[0] : repsList.join(", ")) : null,
    weightKg: weights.length ? Math.max(...weights) : null,
    rpe: rpes.length ? rpes[rpes.length - 1] : null,
    completed: setLogs.length > 0 && setLogs.every((s) => s.completed),
  };
}

/** Copy weights (and optionally reps) from a previous set log array onto current. */
export function applyPreviousWeights(
  current: SessionSetLog[],
  previous: SessionSetLog[]
): SessionSetLog[] {
  if (!previous.length) return current;
  return current.map((s, i) => {
    const p = previous[i] ?? previous[previous.length - 1];
    return {
      ...s,
      weightKg: p.weightKg ?? s.weightKg,
      // keep current planned reps unless empty
      reps: s.reps || p.reps,
    };
  });
}

/** Legacy rows without set_logs → synthesize one summary set */
export function ensureSetLogs(log: {
  setLogs?: SessionSetLog[] | null;
  plannedSets?: number | null;
  plannedReps?: string | null;
  actualSets?: number | null;
  actualReps?: string | null;
  weightKg?: number | null;
  rpe?: string | null;
  completed?: boolean;
}): SessionSetLog[] {
  if (log.setLogs && Array.isArray(log.setLogs) && log.setLogs.length > 0) {
    return log.setLogs.map((s, i) => {
      let restSec = s.restSec ?? null;
      // Legacy EMOM stored restSec: 0 — clock is still 60s per minute
      if (
        (s.role === "emom" || /emom/i.test(s.role || "")) &&
        (restSec == null || restSec <= 0)
      ) {
        restSec = 60;
      }
      return {
        setIndex: s.setIndex || i + 1,
        reps: s.reps || log.plannedReps || "",
        weightKg: s.weightKg ?? null,
        rpe: s.rpe ?? null,
        completed: !!s.completed,
        role: s.role ?? null,
        tempo: s.tempo ?? null,
        restSec,
        note: s.note ?? null,
        pain: s.pain ?? null,
      };
    });
  }
  const n = Math.max(1, log.actualSets || log.plannedSets || 3);
  return Array.from({ length: n }, (_, i) => ({
    setIndex: i + 1,
    reps: log.actualReps || log.plannedReps || "8-10",
    weightKg: log.weightKg ?? null,
    rpe: log.rpe ?? null,
    completed: !!log.completed,
    role: null,
    tempo: null,
    restSec: null,
    note: null,
    pain: null,
  }));
}
