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
