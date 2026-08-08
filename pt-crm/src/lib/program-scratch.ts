/**
 * Pure helpers for “build from scratch” program shells.
 */

export type ScratchSplitId =
  | "full_body"
  | "upper_lower"
  | "ppl"
  | "custom";

export type ScratchDaySpec = {
  name: string;
  focus: string | null;
};

export type ScratchSplitLayout = {
  id: ScratchSplitId;
  label: string;
  hint: string;
  /** Preferred day counts this layout is designed for */
  days: number[];
  /** Map daysPerWeek → day shells */
  daysFor: (n: number) => ScratchDaySpec[];
};

const LETTER = ["A", "B", "C", "D", "E", "F"] as const;

function letterDays(n: number, focus?: (i: number) => string | null): ScratchDaySpec[] {
  return Array.from({ length: n }, (_, i) => ({
    name: `Day ${LETTER[i] ?? i + 1}`,
    focus: focus?.(i) ?? null,
  }));
}

export const SCRATCH_SPLITS: ScratchSplitLayout[] = [
  {
    id: "full_body",
    label: "Full body",
    hint: "Same pattern each day — best 2–4×/wk",
    days: [2, 3, 4],
    daysFor: (n) =>
      letterDays(n, () => "Full body — compounds first, accessories later"),
  },
  {
    id: "upper_lower",
    label: "Upper / lower",
    hint: "Alternate push-pull upper with legs",
    days: [2, 4],
    daysFor: (n) => {
      const cycle: ScratchDaySpec[] = [
        { name: "Upper A", focus: "Horizontal push/pull + arms" },
        { name: "Lower A", focus: "Squat / hinge + accessories" },
        { name: "Upper B", focus: "Vertical push/pull variation" },
        { name: "Lower B", focus: "Hinge priority + single-leg" },
      ];
      if (n <= 2) return cycle.slice(0, 2);
      if (n === 3) {
        return [
          cycle[0]!,
          cycle[1]!,
          { name: "Full / weak point", focus: "Catch-up or full body" },
        ];
      }
      return cycle.slice(0, Math.min(4, n));
    },
  },
  {
    id: "ppl",
    label: "Push / pull / legs",
    hint: "Classic split — natural at 3 or 6 days",
    days: [3, 6],
    daysFor: (n) => {
      const once: ScratchDaySpec[] = [
        { name: "Push", focus: "Chest, shoulders, triceps" },
        { name: "Pull", focus: "Back, rear delts, biceps" },
        { name: "Legs", focus: "Squat, hinge, calves" },
      ];
      if (n <= 3) return once.slice(0, n);
      return [
        ...once,
        { name: "Push B", focus: "Press variation + laterals" },
        { name: "Pull B", focus: "Row variation + arms" },
        { name: "Legs B", focus: "Hinge priority + single-leg" },
      ].slice(0, n);
    },
  },
  {
    id: "custom",
    label: "Blank days",
    hint: "Generic Day A/B/C — name them yourself",
    days: [2, 3, 4, 5, 6],
    daysFor: (n) => letterDays(n),
  },
];

export function getScratchSplit(id: ScratchSplitId | string | null | undefined) {
  return SCRATCH_SPLITS.find((s) => s.id === id) || SCRATCH_SPLITS[3]!;
}

export function defaultTitleForScratch(opts: {
  goal: string;
  splitId: ScratchSplitId;
  daysPerWeek: number;
  forLater?: boolean;
}): string {
  const goal = opts.goal.replace(/_/g, " ");
  const split = getScratchSplit(opts.splitId).label;
  const base = `${goal} · ${split} · ${opts.daysPerWeek}×`;
  return opts.forLater ? `${base} (template)` : base;
}

export function scratchBuildProgress(days: Array<{ exercises: unknown[] }>): {
  daysWithWork: number;
  totalDays: number;
  totalExercises: number;
  emptyDayIndexes: number[];
  complete: boolean;
} {
  const emptyDayIndexes: number[] = [];
  let daysWithWork = 0;
  let totalExercises = 0;
  days.forEach((d, i) => {
    const n = d.exercises?.length || 0;
    totalExercises += n;
    if (n > 0) daysWithWork += 1;
    else emptyDayIndexes.push(i);
  });
  return {
    daysWithWork,
    totalDays: days.length,
    totalExercises,
    emptyDayIndexes,
    complete: days.length > 0 && emptyDayIndexes.length === 0,
  };
}
