import { isCooldownMeta, isWarmupMeta } from "@/lib/session-prep";
import {
  formatGroupTitle,
  formatPrescription,
  formatRestLabel,
  formatSchemeName,
} from "@/lib/workout-labels";

export type PortalExerciseIn = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
  notes: string | null;
  sortOrder: number;
  isWarmup: boolean;
  setScheme: string | null;
  setSchemeMeta: {
    phase?: string;
    summary?: string;
    howTo?: string;
  } | null;
  groupId: string | null;
  groupKind: string | null;
  groupLabel: string | null;
  groupOrder: number | null;
};

export type PortalClientExercise = {
  id: string;
  name: string;
  prescription: string;
  restLabel: string;
  schemeLabel: string | null;
  cue: string | null;
};

export type PortalClientBlock = {
  key: string;
  phase: "warmup" | "work" | "cooldown";
  groupLabel: string | null;
  items: PortalClientExercise[];
};

export type PortalClientDay = {
  id: string;
  name: string;
  focus: string | null;
  blocks: PortalClientBlock[];
};

export type PortalClientProgram = {
  title: string;
  goal: string;
  daysPerWeek: number;
  sessionMinutes: number;
  days: PortalClientDay[];
};

const INTERNAL = /mesocycle|smarter engine|corrective|deficiency/i;

export function clientExerciseCue(
  notes: string | null,
  howTo: string | null
): string | null {
  const how = (howTo || "").trim();
  if (how && !INTERNAL.test(how)) return how;
  const raw = (notes || "")
    .split("·")
    .map((p) => p.trim())
    .filter((p) => p && !INTERNAL.test(p));
  if (!raw.length) return null;
  return raw.join(" · ");
}

function clientFacingSummary(summary: string | null | undefined): string | null {
  const s = (summary || "").trim();
  if (!s || INTERNAL.test(s)) return null;
  return s;
}

export function exercisePhase(
  ex: PortalExerciseIn
): "warmup" | "work" | "cooldown" {
  if (isCooldownMeta(ex.setSchemeMeta)) return "cooldown";
  if (isWarmupMeta(ex.setSchemeMeta, ex.isWarmup)) return "warmup";
  return "work";
}

function toItem(ex: PortalExerciseIn): PortalClientExercise {
  const scheme = ex.setScheme && ex.setScheme !== "straight" ? ex.setScheme : null;
  return {
    id: ex.id,
    name: ex.exerciseName,
    prescription: formatPrescription({
      sets: ex.sets,
      reps: ex.reps,
      rpe: ex.rpe,
      summary: clientFacingSummary(ex.setSchemeMeta?.summary),
    }),
    restLabel: formatRestLabel(ex.restSec),
    schemeLabel: scheme ? formatSchemeName(scheme) : null,
    cue: clientExerciseCue(ex.notes, ex.setSchemeMeta?.howTo || null),
  };
}

export function toClientProgramView(input: {
  title: string;
  goal: string;
  daysPerWeek: number;
  sessionMinutes: number;
  days: Array<{
    id: string;
    name: string;
    focus: string | null;
    exercises: PortalExerciseIn[];
  }>;
}): PortalClientProgram {
  return {
    title: input.title,
    goal: input.goal,
    daysPerWeek: input.daysPerWeek,
    sessionMinutes: input.sessionMinutes,
    days: input.days.map((day) => {
      const sorted = day.exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      const blocks: PortalClientBlock[] = [];
      for (const ex of sorted) {
        const phase = exercisePhase(ex);
        const groupKey = ex.groupId || `solo-${ex.id}`;
        const last = blocks[blocks.length - 1];
        if (last && last.key === `${phase}:${groupKey}`) {
          last.items.push(toItem(ex));
          continue;
        }
        blocks.push({
          key: `${phase}:${groupKey}`,
          phase,
          groupLabel: ex.groupId
            ? formatGroupTitle(ex.groupKind, ex.groupLabel)
            : null,
          items: [toItem(ex)],
        });
      }
      return {
        id: day.id,
        name: day.name,
        focus: day.focus,
        blocks,
      };
    }),
  };
}
