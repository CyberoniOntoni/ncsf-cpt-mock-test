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
