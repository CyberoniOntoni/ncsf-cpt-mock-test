/** Next sortOrder when appending to a program day (max existing + 1, or 0). */
export function nextProgramExerciseSortOrder(
  existingSortOrders: number[]
): number {
  if (!existingSortOrders.length) return 0;
  return Math.max(...existingSortOrders) + 1;
}

export function defaultAddExerciseRx(isWarmup: boolean): {
  sets: number;
  reps: string;
  rpe: string;
  restSec: number;
} {
  if (isWarmup) {
    return { sets: 2, reps: "8-10", rpe: "5-6", restSec: 45 };
  }
  return { sets: 3, reps: "8-10", rpe: "7", restSec: 90 };
}

/** Rank bank exercises by name query for coach append (includes match, startsWith first). */
export function rankBankByNameQuery<
  T extends { name: string; available?: boolean },
>(bank: T[], query: string): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return bank
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      const aAvail = a.available === false ? 1 : 0;
      const bAvail = b.available === false ? 1 : 0;
      if (aAvail !== bAvail) return aAvail - bAvail;
      return a.name.length - b.name.length;
    });
}

/** Prescription snapshot from completed session sets (for promote → program). */
export function rxFromSessionSetLogs(
  setLogs: Array<{
    completed?: boolean | null;
    reps?: string | null;
    rpe?: string | null;
  }> | null | undefined,
  fallback?: { sets?: number | null; reps?: string | null; rpe?: string | null }
): { sets: number; reps: string; rpe: string | null } {
  const done = (setLogs || []).filter((s) => s.completed);
  const source = done.length > 0 ? done : setLogs || [];
  const sets =
    done.length > 0
      ? done.length
      : Math.max(1, fallback?.sets || source.length || 3);
  const last = source[source.length - 1];
  const reps =
    (last?.reps || "").trim() ||
    (fallback?.reps || "").trim() ||
    "8-10";
  const rpe =
    (last?.rpe || "").trim() ||
    (fallback?.rpe || "").trim() ||
    null;
  return { sets, reps, rpe: rpe || null };
}

/** True when session log can be promoted onto a program day (needs bank id + day). */
export function canPromoteSessionLogToProgram(opts: {
  programDayId: string | null | undefined;
  exerciseId: string | null | undefined;
  alreadyOnDay: boolean;
}): boolean {
  return !!(
    opts.programDayId &&
    opts.exerciseId &&
    !opts.alreadyOnDay
  );
}
