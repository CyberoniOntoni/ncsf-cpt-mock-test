/**
 * Exercise-science helpers for program design polish.
 *
 * Landmarks are practical PT heuristics (approx. Schoenfeld weekly set
 * ranges, Israetel-style MEV→MRV bands, NSCA rest intervals) — coach-facing
 * guidance, not medical protocol.
 */

import { patternLabel } from "@/lib/exercise-meta";
import { sessionPhase, shouldPrecede } from "@/lib/exercise-order";
import { parseRepRange } from "@/lib/progression";

export type ProgramScienceGoal =
  | "strength"
  | "hypertrophy"
  | "fat_loss"
  | "general"
  | "mobility"
  | string;

export type PlannedExercise = {
  sets: number;
  reps?: string | null;
  rpe?: string | null;
  restSec?: number | null;
  isWarmup?: boolean;
  movementPattern?: string | null;
  exerciseName?: string;
  setScheme?: string | null;
};

export type DayPlan = {
  name: string;
  exercises: PlannedExercise[];
};

export type PatternBand = "low" | "ok" | "high" | "na";

export type PatternSetRow = {
  pattern: string;
  label: string;
  sets: number;
  band: PatternBand;
  /** e.g. "6–16 / wk" */
  guide: string;
};

export type PlanFlag = {
  severity: "info" | "warn";
  message: string;
};

export type ProgramPlanAnalysis = {
  weeklyWorkingSets: number;
  byPattern: PatternSetRow[];
  pushSets: number;
  pullSets: number;
  /** pull / push; null if no push sets */
  pushPullRatio: number | null;
  pushPullNote: string | null;
  dayEstimates: Array<{
    name: string;
    minutes: number;
    workingSets: number;
    overSessionCap: boolean;
  }>;
  flags: PlanFlag[];
  orderHints: PlanFlag[];
};

const PUSH = new Set(["horizontal_push", "vertical_push"]);
const PULL = new Set(["horizontal_pull", "vertical_pull"]);
const LOWER = new Set(["squat", "hinge"]);
const COMPOUND = new Set([
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
]);
const ACCESSORY = new Set(["core", "carry", "mobility", "cardio"]);
const POWER = new Set(["plyometric"]);

/** Patterns we track weekly set landmarks for. */
const LANDMARK_PATTERNS = [
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "core",
  "carry",
] as const;

function normPattern(p?: string | null): string {
  return (p || "other").trim().toLowerCase() || "other";
}

export function isCompoundPattern(pattern?: string | null): boolean {
  return COMPOUND.has(normPattern(pattern));
}

export function isPushPattern(pattern?: string | null): boolean {
  return PUSH.has(normPattern(pattern));
}

export function isPullPattern(pattern?: string | null): boolean {
  return PULL.has(normPattern(pattern));
}

/**
 * Weekly working-set band by pattern + goal.
 * Returns [low, high] ideal window; sets outside get low/high flags.
 */
export function weeklySetBand(
  pattern: string,
  goal: ProgramScienceGoal = "general"
): { low: number; high: number; guide: string } | null {
  const p = normPattern(pattern);
  if (p === "mobility" || p === "cardio" || p === "other" || p === "plyometric") {
    return null;
  }

  const g = (goal || "general").toLowerCase();

  // Core / carry — quality + density, not heavy progressive overload volume
  if (p === "core" || p === "carry") {
    if (g === "strength") return { low: 2, high: 8, guide: "2–8 / wk" };
    if (g === "mobility") return { low: 4, high: 12, guide: "4–12 / wk" };
    return { low: 4, high: 12, guide: "4–12 / wk" };
  }

  // Primary compounds
  if (LOWER.has(p) || PUSH.has(p) || PULL.has(p)) {
    if (g === "strength") {
      // Higher intensity → fewer hard sets (Helms / NSCA strength)
      return { low: 6, high: 14, guide: "6–14 hard / wk" };
    }
    if (g === "hypertrophy") {
      // Schoenfeld ~10+ sets/muscle/wk often productive; cap before junk volume
      return { low: 8, high: 18, guide: "8–18 / wk" };
    }
    if (g === "fat_loss") {
      return { low: 6, high: 14, guide: "6–14 / wk" };
    }
    if (g === "mobility") {
      return { low: 4, high: 10, guide: "4–10 / wk" };
    }
    // general
    return { low: 6, high: 16, guide: "6–16 / wk" };
  }

  return null;
}

export function bandForSets(
  sets: number,
  band: { low: number; high: number } | null
): PatternBand {
  if (!band) return "na";
  if (sets < band.low) return "low";
  if (sets > band.high) return "high";
  return "ok";
}

/**
 * NSCA-ish rest: longer for strength / low-rep compounds; shorter for pump / isolation.
 */
export function recommendedRestSec(opts: {
  goal?: ProgramScienceGoal | null;
  pattern?: string | null;
  isWarmup?: boolean;
  reps?: string | null;
}): { restSec: number; rationale: string } {
  if (opts.isWarmup) {
    return {
      restSec: 30,
      rationale:
        "Warm-up — short rest; stay warm. Quality activation, not fatigue.",
    };
  }

  // Cool-down lengthen / restore often has near-zero rest
  if (
    opts.pattern === "mobility" &&
    opts.reps &&
    /(hold|breath|min easy)/i.test(opts.reps)
  ) {
    return {
      restSec: 20,
      rationale: "Cool-down / mobility — minimal rest; keep breathing easy.",
    };
  }

  const p = normPattern(opts.pattern);
  const goal = (opts.goal || "general").toLowerCase();
  const range = parseRepRange(opts.reps || "");
  const highRep =
    range != null ? range.high >= 12 : /15|amrap|12-15|10-15/i.test(opts.reps || "");
  const lowRep = range != null ? range.high <= 6 : /[1-5](-[1-6])?$/.test(opts.reps || "");

  if (p === "mobility" || p === "cardio") {
    return { restSec: 45, rationale: "Mobility/cardio — keep transitions tight." };
  }
  if (p === "core" || p === "carry") {
    return {
      restSec: 60,
      rationale: "Core/carry — ~60s keeps quality without turning into HIIT noise.",
    };
  }
  if (POWER.has(p)) {
    return {
      restSec: 120,
      rationale: "Power/plyo — full recovery so the next rep stays crisp.",
    };
  }

  if (goal === "strength" || lowRep) {
    const rest = isCompoundPattern(p) ? 180 : 120;
    return {
      restSec: rest,
      rationale:
        rest >= 180
          ? "Strength / low-rep compound — 2.5–3 min for ATP-PC recovery."
          : "Strength accessory — ~2 min between hard sets.",
    };
  }

  if (goal === "fat_loss" || highRep) {
    return {
      restSec: isCompoundPattern(p) ? 60 : 45,
      rationale: "Density / higher reps — shorter rest raises average HR without junk volume.",
    };
  }

  if (goal === "hypertrophy") {
    return {
      restSec: isCompoundPattern(p) ? 120 : 75,
      rationale: isCompoundPattern(p)
        ? "Hypertrophy compound — ~2 min protects load across sets."
        : "Hypertrophy isolation — 60–90s keeps local fatigue productive.",
    };
  }

  // general
  return {
    restSec: isCompoundPattern(p) ? 90 : 60,
    rationale: "General fitness — moderate rest for quality reps.",
  };
}

/**
 * Goal-aware default prescription when appending a bank exercise.
 */
export function defaultRxForGoal(
  isWarmup: boolean,
  opts?: {
    goal?: ProgramScienceGoal | null;
    pattern?: string | null;
  }
): { sets: number; reps: string; rpe: string; restSec: number } {
  const goal = (opts?.goal || "general").toLowerCase();
  const pattern = normPattern(opts?.pattern);
  const rest = recommendedRestSec({
    goal,
    pattern,
    isWarmup,
  }).restSec;

  if (isWarmup) {
    // RAMP-style activation defaults when appending a warm-up row by hand
    if (pattern === "mobility") {
      return { sets: 2, reps: "6-10/side", rpe: "4-5", restSec: 30 };
    }
    return { sets: 2, reps: "8-12", rpe: "4-5", restSec: 30 };
  }

  if (pattern === "mobility") {
    return { sets: 2, reps: "8-10/side", rpe: "5-6", restSec: 45 };
  }
  if (pattern === "core" || pattern === "carry") {
    return {
      sets: 3,
      reps: pattern === "carry" ? "30-40m" : "8-12",
      rpe: "6-7",
      restSec: 60,
    };
  }
  if (POWER.has(pattern)) {
    return { sets: 3, reps: "3-5", rpe: "6-7", restSec: 120 };
  }

  switch (goal) {
    case "strength":
      return {
        sets: isCompoundPattern(pattern) ? 4 : 3,
        reps: isCompoundPattern(pattern) ? "3-5" : "5-8",
        rpe: "7-8",
        restSec: rest,
      };
    case "hypertrophy":
      return {
        sets: 3,
        reps: isCompoundPattern(pattern) ? "6-10" : "8-12",
        rpe: "7-8",
        restSec: rest,
      };
    case "fat_loss":
      return {
        sets: 3,
        reps: "10-15",
        rpe: "6-7",
        restSec: rest,
      };
    case "mobility":
      return { sets: 2, reps: "8-12", rpe: "5-6", restSec: 45 };
    default:
      return {
        sets: 3,
        reps: "8-10",
        rpe: "7",
        restSec: rest,
      };
  }
}

/**
 * Rough session length: work time + rests (warmup lighter).
 * Used to flag days that blow the programmed session minutes.
 */
export function estimateDayMinutes(exercises: PlannedExercise[]): number {
  let sec = 0;
  // Setup / transitions between exercises
  const working = exercises.filter((e) => !e.isWarmup);
  const warmups = exercises.filter((e) => e.isWarmup);
  sec += warmups.length * 45;
  sec += Math.max(0, working.length - 1) * 30; // transitions

  for (const ex of exercises) {
    const sets = Math.max(0, ex.sets || 0);
    if (sets === 0) continue;
    const workPerSet = ex.isWarmup ? 25 : 40; // seconds under tension-ish
    const rest =
      ex.restSec != null && ex.restSec > 0
        ? ex.restSec
        : recommendedRestSec({
            pattern: ex.movementPattern,
            isWarmup: ex.isWarmup,
            reps: ex.reps,
          }).restSec;
    // rest between sets only (sets - 1)
    sec += sets * workPerSet + Math.max(0, sets - 1) * rest;
  }

  // Warm-up block padding if any warmups
  if (warmups.length) sec += 120;

  return Math.max(1, Math.round(sec / 60));
}

/**
 * Session order heuristics using exercise-order scores.
 * Flags inverted pairs (e.g. OHP before bench, isolation before compounds).
 */
export function sessionOrderHints(
  dayName: string,
  exercises: PlannedExercise[]
): PlanFlag[] {
  const flags: PlanFlag[] = [];
  if (exercises.length < 2) return flags;

  let sawCompound = false;
  let sawAccessoryBeforeCompound = false;
  let sawCoreBeforeCompound = false;
  let sawPowerAfterCompound = false;
  let sawVerticalBeforeHorizontalPush = false;

  for (let i = 0; i < exercises.length; i++) {
    const ex = exercises[i]!;
    const p = normPattern(ex.movementPattern);
    const phase = sessionPhase(ex);
    if (phase !== "work") continue;

    if (COMPOUND.has(p)) sawCompound = true;
    if (ACCESSORY.has(p) && p !== "core" && !sawCompound) {
      sawAccessoryBeforeCompound = true;
    }
    if (p === "core" && !sawCompound) sawCoreBeforeCompound = true;
    if (POWER.has(p) && sawCompound) sawPowerAfterCompound = true;

    // Specific: any later horizontal primary vs earlier vertical push
    if (p === "vertical_push") {
      for (let j = i + 1; j < exercises.length; j++) {
        const later = exercises[j]!;
        if (sessionPhase(later) !== "work") continue;
        if (
          normPattern(later.movementPattern) === "horizontal_push" &&
          shouldPrecede(later, ex)
        ) {
          sawVerticalBeforeHorizontalPush = true;
        }
      }
    }
  }

  if (sawPowerAfterCompound) {
    flags.push({
      severity: "warn",
      message: `${dayName}: power/plyo after heavy compounds — move explosive work earlier for quality.`,
    });
  }
  if (sawVerticalBeforeHorizontalPush) {
    flags.push({
      severity: "warn",
      message: `${dayName}: vertical press before horizontal (e.g. OHP before bench) — put the bigger horizontal press first when both are hard sets.`,
    });
  }
  if (sawAccessoryBeforeCompound) {
    flags.push({
      severity: "info",
      message: `${dayName}: isolation before main compounds — fine for pre-ex, otherwise put big lifts first.`,
    });
  }
  if (sawCoreBeforeCompound) {
    flags.push({
      severity: "info",
      message: `${dayName}: core before compounds can fatigue the brace — usually better last (or as warm-up only).`,
    });
  }

  const firstWorking = exercises.findIndex((e) => sessionPhase(e) === "work");
  const warmupAfterWork = exercises.some(
    (e, i) => sessionPhase(e) === "warmup" && firstWorking >= 0 && i > firstWorking
  );
  if (warmupAfterWork) {
    flags.push({
      severity: "warn",
      message: `${dayName}: warm-up sets appear after working lifts — keep activation first.`,
    });
  }

  return flags;
}

/**
 * Analyze a full program’s planned (not logged) weekly structure.
 */
export function analyzeProgramPlan(
  days: DayPlan[],
  opts?: {
    goal?: ProgramScienceGoal | null;
    sessionMinutes?: number | null;
  }
): ProgramPlanAnalysis {
  const goal = opts?.goal || "general";
  const sessionCap = opts?.sessionMinutes && opts.sessionMinutes > 0
    ? opts.sessionMinutes
    : null;

  const setMap = new Map<string, number>();
  let weeklyWorkingSets = 0;
  let pushSets = 0;
  let pullSets = 0;

  const dayEstimates: ProgramPlanAnalysis["dayEstimates"] = [];
  const orderHints: PlanFlag[] = [];

  for (const day of days) {
    const minutes = estimateDayMinutes(day.exercises);
    let dayWorking = 0;
    for (const ex of day.exercises) {
      if (ex.isWarmup) continue;
      const sets = Math.max(0, Math.round(ex.sets || 0));
      if (sets <= 0) continue;
      dayWorking += sets;
      weeklyWorkingSets += sets;
      const p = normPattern(ex.movementPattern);
      setMap.set(p, (setMap.get(p) || 0) + sets);
      if (PUSH.has(p)) pushSets += sets;
      if (PULL.has(p)) pullSets += sets;
    }
    dayEstimates.push({
      name: day.name,
      minutes,
      workingSets: dayWorking,
      overSessionCap: sessionCap != null ? minutes > sessionCap + 8 : false,
    });
    orderHints.push(...sessionOrderHints(day.name, day.exercises));
  }

  const byPattern: PatternSetRow[] = [];
  // Always show landmark patterns that appear OR are primary for goal
  const patternsToShow = new Set<string>([
    ...LANDMARK_PATTERNS,
    ...setMap.keys(),
  ]);

  for (const p of patternsToShow) {
    const sets = setMap.get(p) || 0;
    if (sets === 0 && !LANDMARK_PATTERNS.includes(p as (typeof LANDMARK_PATTERNS)[number])) {
      continue;
    }
    // Skip zero-set non-core landmarks to reduce noise? Keep main six + any with sets
    const isMain =
      LOWER.has(p) || PUSH.has(p) || PULL.has(p) || p === "core" || p === "carry";
    if (sets === 0 && !isMain) continue;
    if (sets === 0 && (p === "carry")) continue; // only show carry if present

    const bandSpec = weeklySetBand(p, goal);
    const band = bandForSets(sets, bandSpec);
    // Hide empty patterns that are "ok" empty for mobility goal? Still show majors if program has work
    if (sets === 0 && weeklyWorkingSets > 0) {
      // only flag empty majors that matter
      if (!LOWER.has(p) && !PUSH.has(p) && !PULL.has(p)) continue;
    }
    if (sets === 0 && weeklyWorkingSets === 0) continue;

    byPattern.push({
      pattern: p,
      label: patternLabel(p),
      sets,
      band: sets === 0 ? "low" : band,
      guide: bandSpec?.guide || "—",
    });
  }

  // Sort: by sets desc, then label
  byPattern.sort((a, b) => b.sets - a.sets || a.label.localeCompare(b.label));

  const flags: PlanFlag[] = [];

  // Push:pull — prefer ≥1:1 pull for desk athletes (more pull OK)
  let pushPullRatio: number | null = null;
  let pushPullNote: string | null = null;
  if (pushSets > 0 || pullSets > 0) {
    if (pushSets === 0) {
      pushPullRatio = null;
      pushPullNote = "Pull volume without push — fine for a pull day; watch weekly balance.";
      flags.push({
        severity: "info",
        message: "No push patterns this week in the plan (OK if split is pull-only days).",
      });
    } else {
      pushPullRatio = Math.round((pullSets / pushSets) * 100) / 100;
      if (pushPullRatio < 0.75) {
        pushPullNote = `Pull:push ≈ ${pushPullRatio}:1 — add horizontal/vertical pulls (posture + shoulder health).`;
        flags.push({
          severity: "warn",
          message: pushPullNote,
        });
      } else if (pushPullRatio > 2.2) {
        pushPullNote = `Pull:push ≈ ${pushPullRatio}:1 — pull-heavy is fine; ensure pressing keeps progressing.`;
        flags.push({ severity: "info", message: pushPullNote });
      } else {
        pushPullNote = `Pull:push ≈ ${pushPullRatio}:1 — balanced.`;
      }
    }
  }

  // Pattern volume flags
  for (const row of byPattern) {
    if (row.sets === 0 && (LOWER.has(row.pattern) || PUSH.has(row.pattern) || PULL.has(row.pattern))) {
      flags.push({
        severity: "info",
        message: `No ${row.label.toLowerCase()} work in the weekly plan — intentional for the split?`,
      });
    } else if (row.band === "low" && row.sets > 0) {
      flags.push({
        severity: "info",
        message: `${row.label}: ${row.sets} working sets/wk is low for ${String(goal).replace(/_/g, " ")} (guide ${row.guide}).`,
      });
    } else if (row.band === "high") {
      flags.push({
        severity: "warn",
        message: `${row.label}: ${row.sets} working sets/wk is high (guide ${row.guide}) — watch recovery / junk volume.`,
      });
    }
  }

  // Session length
  for (const d of dayEstimates) {
    if (d.overSessionCap && sessionCap) {
      flags.push({
        severity: "warn",
        message: `${d.name}: ~${d.minutes} min estimated vs ${sessionCap} min target — cut sets, shorten rest, or supersets.`,
      });
    }
    if (d.workingSets > 25) {
      flags.push({
        severity: "warn",
        message: `${d.name}: ${d.workingSets} working sets is a long day — quality often drops past ~20–25 hard sets.`,
      });
    }
  }

  // Strength goal with high-rep only plan
  if (String(goal).toLowerCase() === "strength") {
    let lowRepSets = 0;
    let allWorking = 0;
    for (const day of days) {
      for (const ex of day.exercises) {
        if (ex.isWarmup) continue;
        const s = Math.max(0, ex.sets || 0);
        allWorking += s;
        const range = parseRepRange(ex.reps || "");
        if (range && range.high <= 6) lowRepSets += s;
      }
    }
    if (allWorking >= 6 && lowRepSets / allWorking < 0.35) {
      flags.push({
        severity: "info",
        message:
          "Strength goal but most sets are >6 reps — keep main lifts in a lower rep band (≈1–6) for neural strength.",
      });
    }
  }

  return {
    weeklyWorkingSets,
    byPattern: byPattern.filter((r) => r.sets > 0 || r.band === "low"),
    pushSets,
    pullSets,
    pushPullRatio,
    pushPullNote,
    dayEstimates,
    flags: dedupeFlags([...flags, ...orderHints.filter((f) => f.severity === "warn")]),
    orderHints,
  };
}

function dedupeFlags(flags: PlanFlag[]): PlanFlag[] {
  const seen = new Set<string>();
  const out: PlanFlag[] = [];
  for (const f of flags) {
    const k = `${f.severity}:${f.message}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}

/** Short rest label for UI chips */
export function formatRestSuggestion(restSec: number): string {
  if (restSec >= 60 && restSec % 60 === 0) return `${restSec / 60} min`;
  if (restSec >= 60) {
    const m = Math.floor(restSec / 60);
    const s = restSec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${restSec}s`;
}

export type FillSuggestion = {
  pattern: string;
  label: string;
  /** Sets still needed to reach low band (approx.) */
  setsShort: number;
  reason: string;
};

/**
 * Patterns to add next for balance / MEV (coach “fill the plan” chips).
 * Prefers low-band landmarks, then antagonist gaps for push/pull.
 */
export function suggestFillPatterns(
  analysis: ProgramPlanAnalysis,
  opts?: { goal?: ProgramScienceGoal | null; limit?: number }
): FillSuggestion[] {
  const limit = opts?.limit ?? 4;
  const goal = opts?.goal || "general";
  const out: FillSuggestion[] = [];
  const seen = new Set<string>();

  // 1) Patterns below MEV
  const lows = [...analysis.byPattern]
    .filter((r) => r.band === "low")
    .sort((a, b) => a.sets - b.sets);
  for (const row of lows) {
    if (seen.has(row.pattern)) continue;
    const band = weeklySetBand(row.pattern, goal);
    const need = band ? Math.max(1, band.low - row.sets) : 2;
    seen.add(row.pattern);
    out.push({
      pattern: row.pattern,
      label: row.label,
      setsShort: need,
      reason:
        row.sets === 0
          ? `No ${row.label.toLowerCase()} yet — guide ${row.guide}`
          : `${row.sets} sets/wk is light — ~${need} more toward ${row.guide}`,
    });
    if (out.length >= limit) return out;
  }

  // 2) Antagonist gaps when push-heavy
  if (
    analysis.pushSets > 0 &&
    (analysis.pushPullRatio == null || analysis.pushPullRatio < 0.9)
  ) {
    for (const p of ["horizontal_pull", "vertical_pull"] as const) {
      if (seen.has(p)) continue;
      const row = analysis.byPattern.find((r) => r.pattern === p);
      const sets = row?.sets ?? 0;
      if (sets >= (weeklySetBand(p, goal)?.low ?? 6)) continue;
      seen.add(p);
      out.push({
        pattern: p,
        label: patternLabel(p),
        setsShort: Math.max(2, (weeklySetBand(p, goal)?.low ?? 6) - sets),
        reason: "Add pull volume to balance pressing (shoulder health / posture).",
      });
      if (out.length >= limit) return out;
    }
  }

  // 3) Squat/hinge imbalance
  const squat = analysis.byPattern.find((r) => r.pattern === "squat")?.sets ?? 0;
  const hinge = analysis.byPattern.find((r) => r.pattern === "hinge")?.sets ?? 0;
  if (squat >= 6 && hinge < squat * 0.5 && !seen.has("hinge")) {
    seen.add("hinge");
    out.push({
      pattern: "hinge",
      label: patternLabel("hinge"),
      setsShort: Math.max(2, Math.ceil(squat / 2) - hinge),
      reason: "Squat-heavy week — add hinge for posterior chain balance.",
    });
  } else if (hinge >= 6 && squat < hinge * 0.5 && !seen.has("squat")) {
    seen.add("squat");
    out.push({
      pattern: "squat",
      label: patternLabel("squat"),
      setsShort: Math.max(2, Math.ceil(hinge / 2) - squat),
      reason: "Hinge-heavy week — add squat pattern for knee-dominant work.",
    });
  }

  return out.slice(0, limit);
}

/**
 * Compact one-liner for wizard / cards.
 */
export function planBalanceSummaryLine(analysis: ProgramPlanAnalysis): string {
  const parts = [
    `${analysis.weeklyWorkingSets} working sets/wk`,
  ];
  if (analysis.pushSets + analysis.pullSets > 0) {
    parts.push(`pull ${analysis.pullSets} · push ${analysis.pushSets}`);
  }
  const warns = analysis.flags.filter((f) => f.severity === "warn").length;
  if (warns) parts.push(`${warns} watch-out${warns === 1 ? "" : "s"}`);
  return parts.join(" · ");
}
