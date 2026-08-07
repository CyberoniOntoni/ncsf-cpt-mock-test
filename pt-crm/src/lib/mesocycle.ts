/**
 * Pure mesocycle week plans and prescription scaling (Lane B).
 * No I/O — safe for client and server.
 */

export type MesocycleWeek = 1 | 2 | 3 | 4 | 5 | 6;

export type MesocyclePlan = {
  week: MesocycleWeek;
  label: string;
  isDeload: boolean;
  volumeMult: number;
  intensityHint: string;
  rpeBias: number;
  notes: string;
};

const PLANS: Record<MesocycleWeek, MesocyclePlan> = {
  1: {
    week: 1,
    label: "W1 · Intro",
    isDeload: false,
    volumeMult: 0.9,
    intensityHint: "easier",
    rpeBias: -0.5,
    notes: "Introductory week — slightly reduced volume, own technique.",
  },
  2: {
    week: 2,
    label: "W2 · Build",
    isDeload: false,
    volumeMult: 1.0,
    intensityHint: "build",
    rpeBias: 0,
    notes: "Build week — standard volume and progressive load.",
  },
  3: {
    week: 3,
    label: "W3 · Peak",
    isDeload: false,
    volumeMult: 1.08,
    intensityHint: "peak",
    rpeBias: 0.5,
    notes: "Peak week — modest volume bump; push quality sets.",
  },
  4: {
    week: 4,
    label: "W4 · Deload",
    isDeload: true,
    volumeMult: 0.65,
    intensityHint: "deload",
    rpeBias: -1,
    notes: "Deload — cut volume and ease RPE; recover and reinforce form.",
  },
  5: {
    week: 5,
    label: "W5 · Rebuild",
    isDeload: false,
    volumeMult: 1.0,
    intensityHint: "rebuild",
    rpeBias: 0,
    notes: "Rebuild week — return to baseline volume after deload.",
  },
  6: {
    week: 6,
    label: "W6 · Peak",
    isDeload: false,
    volumeMult: 1.05,
    intensityHint: "peak",
    rpeBias: 0.5,
    notes: "Second peak — slight volume uptick before cycle reset.",
  },
};

function clampMesocycleWeek(week: number): MesocycleWeek {
  if (!Number.isFinite(week)) return 1;
  const n = Math.round(week);
  if (n < 1) return 1;
  if (n > 6) return 6;
  return n as MesocycleWeek;
}

/** Resolve plan for a mesocycle week number (clamped to 1–6). */
export function getMesocycleWeek(week: number): MesocyclePlan {
  return PLANS[clampMesocycleWeek(week)];
}

function parseRpe(rpe: string | null): number | null {
  if (rpe == null || String(rpe).trim() === "") return null;
  const n = parseFloat(String(rpe).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Marker appended to exercise notes for mesocycle tags (stripped on re-apply). */
export const MESOCYCLE_NOTE_MARKERS = [
  "Deload week",
  "Mesocycle: W1",
  "Mesocycle: W2",
  "Mesocycle: W3",
  "Mesocycle: W4",
  "Mesocycle: W5",
  "Mesocycle: W6",
] as const;

export type Prescription = {
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
};

function applyRpeBias(rpe: string | null, bias: number): string | null {
  if (bias === 0) return rpe;
  const parsed = parseRpe(rpe);
  if (parsed == null) return rpe;
  const next = Math.max(1, Math.min(10, Math.round((parsed + bias) * 2) / 2));
  return String(next);
}

/**
 * Scale a prescription by mesocycle plan.
 * Deload: reduce sets (min 1), lower RPE if parseable, note "Deload week".
 * Build/peak/intro: scale sets by volumeMult when sets >= 2 (round, min 1);
 * apply rpeBias when non-zero.
 * Always scale from the *baseline* prescription you pass in — not already-scaled values.
 */
export function applyMesocycleToPrescription(
  input: Prescription,
  plan: MesocyclePlan
): Prescription & { note: string | null } {
  const baseSets = Number.isFinite(input.sets)
    ? Math.max(0, Math.round(input.sets))
    : 0;

  if (plan.isDeload) {
    const sets = Math.max(1, Math.round(baseSets * plan.volumeMult) || 1);
    return {
      sets,
      reps: input.reps,
      rpe: applyRpeBias(input.rpe, plan.rpeBias),
      restSec: input.restSec,
      note: "Deload week",
    };
  }

  let sets = baseSets;
  if (baseSets >= 2) {
    sets = Math.max(1, Math.round(baseSets * plan.volumeMult));
  }

  const rpe = applyRpeBias(input.rpe, plan.rpeBias);
  const note =
    plan.week === 2 && plan.volumeMult === 1 && plan.rpeBias === 0
      ? null
      : `Mesocycle: W${plan.week}`;

  return {
    sets,
    reps: input.reps,
    rpe,
    restSec: input.restSec,
    note,
  };
}

/** Remove prior mesocycle tags from free-text notes. */
export function stripMesocycleNotes(notes: string | null | undefined): string | null {
  if (!notes) return notes ?? null;
  let out = notes;
  for (const m of MESOCYCLE_NOTE_MARKERS) {
    out = out
      .split(" · ")
      .map((p) => p.trim())
      .filter((p) => p && p !== m && !p.startsWith("Mesocycle: W"))
      .join(" · ");
  }
  // Also strip inline "Deload week" remnants
  out = out
    .replace(/\s*·\s*Deload week/gi, "")
    .replace(/Deload week\s*·\s*/gi, "")
    .replace(/\bDeload week\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out || null;
}

/** Next week in 1–6 cycle (wraps 6 → 1). */
export function nextMesocycleWeek(week: number): MesocycleWeek {
  const w = clampMesocycleWeek(week);
  return (w === 6 ? 1 : ((w + 1) as MesocycleWeek));
}

/**
 * Suggest mesocycle week from program start date (calendar weeks elapsed + 1).
 * Caps at 6; resets interpretation is caller's job.
 */
export function suggestMesocycleWeekFromStartDate(
  startedAt: Date | string | null | undefined,
  now: Date = new Date()
): MesocycleWeek {
  if (!startedAt) return 1;
  const start = new Date(startedAt);
  if (Number.isNaN(start.getTime())) return 1;
  const ms = now.getTime() - start.getTime();
  if (ms < 0) return 1;
  const weeks = Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
  return clampMesocycleWeek(weeks + 1);
}

/** UI select options for mesocycle weeks. */
export const MESOCYCLE_WEEK_OPTIONS: { value: number; label: string }[] = (
  [1, 2, 3, 4, 5, 6] as MesocycleWeek[]
).map((w) => ({
  value: w,
  label: PLANS[w].label,
}));
