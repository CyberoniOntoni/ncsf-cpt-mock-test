/**
 * Group program/session exercise rows for multi-exercise schemes
 * (contrast, complex, superset).
 */

export type GroupableExercise = {
  id: string;
  sortOrder?: number | null;
  groupId?: string | null;
  groupKind?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
  restAfterSec?: number | null;
  restBetweenRoundsSec?: number | null;
  groupRole?: string | null;
  setScheme?: string | null;
  setSchemeMeta?: {
    howTo?: string;
    summary?: string;
    group?: {
      rounds?: number;
      restBetweenExercisesSec?: number;
      restBetweenRoundsSec?: number;
    };
  } | null;
};

export type ExerciseBlock<T extends GroupableExercise> =
  | { type: "single"; exercise: T }
  | {
      type: "group";
      groupId: string;
      kind: string;
      label: string;
      howTo?: string;
      rounds: number;
      restBetweenRoundsSec: number;
      members: T[];
    };

export function groupExercisesIntoBlocks<T extends GroupableExercise>(
  exercises: T[]
): ExerciseBlock<T>[] {
  const sorted = [...exercises].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const blocks: ExerciseBlock<T>[] = [];
  const seenGroups = new Set<string>();

  for (const ex of sorted) {
    if (ex.groupId) {
      if (seenGroups.has(ex.groupId)) continue;
      seenGroups.add(ex.groupId);
      const members = sorted
        .filter((e) => e.groupId === ex.groupId)
        .sort((a, b) => (a.groupOrder ?? 0) - (b.groupOrder ?? 0));
      const first = members[0];
      const last = members[members.length - 1];
      const rounds =
        first?.setSchemeMeta?.group?.rounds ||
        Math.max(...members.map((m) => (m as { sets?: number }).sets || 0), 3);
      blocks.push({
        type: "group",
        groupId: ex.groupId,
        kind: first?.groupKind || ex.setScheme || "group",
        label: first?.groupLabel || "Exercise group",
        howTo: first?.setSchemeMeta?.howTo,
        rounds,
        restBetweenRoundsSec:
          last?.restBetweenRoundsSec ??
          first?.setSchemeMeta?.group?.restBetweenRoundsSec ??
          90,
        members,
      });
    } else {
      blocks.push({ type: "single", exercise: ex });
    }
  }

  return blocks;
}

export function formatRestCue(sec: number | null | undefined): string {
  if (sec == null) return "";
  if (sec <= 0) return "No rest — flow";
  if (sec < 60) return `${sec}s rest`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s rest` : `${m} min rest`;
}
