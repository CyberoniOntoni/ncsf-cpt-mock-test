import type { ExerciseWithAvailability } from "@/lib/exercises";
import { listExercisesForOrg } from "@/lib/exercises";
import {
  correctivesFromAssessmentResults,
  correctivesFromClientHistory,
  matchExercisesForCorrective,
  mergeCorrectives,
  type CorrectiveExercisePoolItem,
  type CorrectivePrescription,
} from "@/lib/assessment-correctives";
import {
  applyMesocycleToPrescription,
  getMesocycleWeek,
  type MesocyclePlan,
} from "@/lib/mesocycle";
import {
  buildConstraintProfile,
  exerciseViolatesConstraints,
  formatConstraintSummary,
  scoreExerciseForConstraints,
  type ClientConstraintProfile,
} from "@/lib/program-constraints";
import {
  assignSetScheme,
  buildSchemePlan,
  getGroupMemberSpecs,
  isMultiExerciseScheme,
  type SetSchemeId,
  type SetSchemeMeta,
} from "@/lib/set-schemes";
import {
  cooldownSlotsForSession,
  densityFromMinutes,
  prepHowTo,
  prepPrescription,
  prepSummary,
  warmupSlotsForSession,
  type PrepSessionKind,
  type PrepSlot,
} from "@/lib/session-prep";
import { sortExercisesForSession } from "@/lib/exercise-order";
import { isCompoundPattern, recommendedRestSec } from "@/lib/program-science";
import { id } from "@/lib/utils";
import {
  enforceHardSafetyGates,
  evaluateClientRules,
  filterExercisesByEquipment,
  InsufficientSafeExercisesError,
  prioritizeAndRotateCorrectives,
  scoreExerciseForPrimarySwaps,
  secondaryPatternsFor,
  type ClientEvaluationContext,
  type PrescribedCorrective,
  type RuleEngineEvaluationResult,
} from "@/lib/smarter-rule-engine";

export type ProgramGoal =
  | "strength"
  | "hypertrophy"
  | "fat_loss"
  | "general"
  | "mobility";

export type AssessmentHint = {
  templateSlug: string;
  results: Record<string, unknown>;
  summary?: string | null;
};

export type ProgramBuilderInput = {
  organizationId: string;
  title?: string;
  goal: ProgramGoal;
  daysPerWeek: number;
  sessionMinutes: number;
  experienceLevel?: string;
  notes?: string;
  /** Client constraints from CRM */
  clientInjuries?: string | null;
  clientGoals?: string | null;
  preferMobility?: boolean;
  contraindications?: string | null;
  /** Mesocycle week 1–6 (defaults to 1 when applying volume/RPE scaling) */
  mesocycleWeek?: number;
  /** Latest assessment results used for corrective warm-ups */
  assessmentHints?: AssessmentHint[];
  /** Change this to get a different exercise variation (Regenerate) */
  variationSeed?: number;
  /** Optional smarter-engine context (measurements, medical history, equipment). */
  evaluationContext?: ClientEvaluationContext | null;
  facilityEquipmentMode?: "org" | "client" | "combined";
  facilityEquipmentIds?: string[];
  /** Exercise bank ids the trainer pinned — keep these in the plan if possible */
  pinnedExerciseIds?: string[];
  /** Deficiency slugs the trainer dismissed (do not inject correctives for these) */
  suppressedDeficiencySlugs?: string[];
};

export type BuiltExercise = {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  movementPattern: string | null;
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
  notes: string | null;
  sortOrder: number;
  isWarmup: boolean;
  setScheme: SetSchemeId;
  setSchemeMeta: SetSchemeMeta;
  groupId?: string | null;
  groupKind?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
  restAfterSec?: number | null;
  restBetweenRoundsSec?: number | null;
  groupRole?: string | null;
};

export type BuiltDay = {
  id: string;
  dayIndex: number;
  name: string;
  focus: string;
  exercises: BuiltExercise[];
};

export type BuiltProgram = {
  title: string;
  goal: ProgramGoal;
  daysPerWeek: number;
  sessionMinutes: number;
  splitType: string;
  experienceLevel: string;
  notes: string | null;
  days: BuiltDay[];
  meta: Record<string, unknown>;
};

type SessionKind =
  | "full_a"
  | "full_b"
  | "full_c"
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "legs"
  | "mobility";

type SlotIntensity = "strength" | "hypertrophy" | "technique";

type Slot = {
  patterns: string[];
  warmup?: boolean;
  cooldown?: boolean;
  label?: string;
  preferTags?: string[];
  prepRole?: string;
  /** Work-slot intensity. Same-day second squat/hinge is volume, not a second heavy primary. */
  tag?: SlotIntensity;
};

type Density = "short" | "standard" | "long";

function densityForMinutes(minutes: number): Density {
  if (minutes < 40) return "short";
  if (minutes >= 55) return "long";
  return "standard";
}

/** Strip markdown-ish emphasis so UI notes stay plain prose. */
function plainText(s: string | null | undefined): string | null {
  if (!s) return null;
  const cleaned = s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || null;
}

/** Truncate howTo / cue snippets for optional exercise notes. */
function truncateNote(s: string, max = 120): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > 40 ? cut.slice(0, sp) : cut).trim()}…`;
}

/**
 * Base sets/reps/RPE/rest by goal, pattern, experience, and slot intensity.
 * Rest comes from recommendedRestSec (NSCA / ACSM compound vs accessory).
 * Same-day second squat/hinge uses volume (hypertrophy) loading, not a second heavy primary.
 */
function prescription(
  goal: ProgramGoal,
  pattern: string,
  experience: string,
  intensity?: SlotIntensity
) {
  const beginner = /beginner/i.test(experience);
  const advanced = /advanced|elite/i.test(experience);
  const volumeBias = intensity === "hypertrophy" || intensity === "technique";
  const effectiveGoal: ProgramGoal =
    volumeBias && goal === "strength" ? "hypertrophy" : goal;
  const compound = isCompoundPattern(pattern);

  let sets: number;
  let reps: string;
  let rpe: string;

  if (pattern === "mobility" || pattern === "cardio") {
    sets = 2;
    reps = pattern === "cardio" ? "8-12 min" : "8-10/side";
    rpe = beginner ? "4-5" : "5-6";
  } else if (pattern === "core" || pattern === "carry") {
    sets = beginner ? 2 : 3;
    reps = pattern === "carry" ? "30-40m" : "8-12";
    rpe = beginner ? "5-6" : "6-7";
  } else {
    switch (effectiveGoal) {
      case "strength":
        sets = beginner ? 3 : advanced ? (compound ? 5 : 4) : compound ? 4 : 3;
        reps = beginner
          ? compound
            ? "5-6"
            : "6-8"
          : advanced
            ? compound
              ? "2-5"
              : "5-8"
            : compound
              ? "3-5"
              : "5-8";
        rpe = beginner ? "6-7" : advanced ? "8-9" : "7-8";
        break;
      case "hypertrophy":
        sets = beginner ? 3 : advanced ? 4 : 3;
        reps = compound ? "6-10" : "8-12";
        rpe =
          intensity === "technique"
            ? beginner
              ? "5-6"
              : "6-7"
            : beginner
              ? "6-7"
              : "7-8";
        break;
      case "fat_loss":
        sets = beginner ? 2 : 3;
        reps = "10-15";
        rpe = beginner ? "5-6" : "6-7";
        break;
      case "mobility":
        sets = 2;
        reps = "8-12";
        rpe = beginner ? "4-5" : "5-6";
        break;
      default:
        sets = beginner ? 2 : advanced ? 4 : 3;
        reps = "8-10";
        rpe = beginner ? "6-7" : "7";
    }
  }

  const restSec = recommendedRestSec({
    goal: effectiveGoal,
    pattern,
    reps,
  }).restSec;

  return { sets, reps, rpe, restSec };
}

function goalLabel(goal: ProgramGoal): string {
  switch (goal) {
    case "strength":
      return "Strength";
    case "hypertrophy":
      return "Hypertrophy";
    case "fat_loss":
      return "Fat loss";
    case "mobility":
      return "Mobility";
    default:
      return "General fitness";
  }
}

function splitTypeLabel(splitType: string): string {
  switch (splitType) {
    case "full_body":
      return "full body";
    case "upper_lower":
      return "upper/lower";
    case "ppl":
      return "push/pull/legs";
    default:
      return splitType.replace(/_/g, " ");
  }
}

function splitRationaleFor(daysPerWeek: number, goal: ProgramGoal, splitType: string): string {
  if (goal === "mobility") {
    return "Mobility-focused sessions keep volume low and recovery high while opening restricted areas.";
  }
  if (daysPerWeek <= 2) {
    return "With 1–2 training days, full-body sessions hit squat, hinge, push, and pull each visit.";
  }
  if (daysPerWeek === 3) {
    return "Three full-body days balance frequency and recovery: A squat-bias, B hinge-bias, C unilateral and accessories.";
  }
  if (daysPerWeek === 4) {
    return "Four days suit an upper/lower split so each muscle group is trained twice with room for intensity.";
  }
  if (daysPerWeek === 5) {
    return "Five days use push/pull/legs plus extra upper and lower volume days without overcrowding any session.";
  }
  return `Six days run a repeated ${splitTypeLabel(splitType)} rotation for high frequency with manageable per-session volume.`;
}

function splitForDays(days: number, goal: ProgramGoal): { kind: SessionKind; name: string; focus: string }[] {
  if (goal === "mobility") {
    return Array.from({ length: Math.min(days, 4) }, (_, i) => ({
      kind: "mobility" as const,
      name: `Mobility ${i + 1}`,
      focus: "Soft tissue, T-spine, hip and shoulder openers, light core",
    }));
  }
  if (days <= 2) {
    return (
      [
        {
          kind: "full_a" as const,
          name: "Full body A",
          focus: "Squat primary, horizontal push and pull, trunk finish",
        },
        {
          kind: "full_b" as const,
          name: "Full body B",
          focus: "Hinge primary, vertical push and pull, trunk finish",
        },
      ] as { kind: SessionKind; name: string; focus: string }[]
    ).slice(0, days);
  }
  if (days === 3) {
    return [
      {
        kind: "full_a" as const,
        name: "Full body A",
        focus: "Squat emphasis with horizontal push and pull",
      },
      {
        kind: "full_b" as const,
        name: "Full body B",
        focus: "Hinge emphasis with vertical push and pull",
      },
      {
        kind: "full_c" as const,
        name: "Full body C",
        focus: "Unilateral lower body, mixed upper, carry or core",
      },
    ];
  }
  if (days === 4) {
    return [
      {
        kind: "upper" as const,
        name: "Upper A",
        focus: "Horizontal and vertical push/pull strength",
      },
      {
        kind: "lower" as const,
        name: "Lower A",
        focus: "Bilateral squat and hinge strength",
      },
      {
        kind: "upper" as const,
        name: "Upper B",
        focus: "Upper volume, balanced push and pull",
      },
      {
        kind: "lower" as const,
        name: "Lower B",
        focus: "Unilateral lower and posterior chain",
      },
    ];
  }
  // 5–6 → PPL-ish
  const ppl = [
    {
      kind: "push" as const,
      name: "Push",
      focus: "Chest, shoulders, triceps (horizontal then vertical)",
    },
    {
      kind: "pull" as const,
      name: "Pull",
      focus: "Back, rear delts, biceps (horizontal then vertical)",
    },
    {
      kind: "legs" as const,
      name: "Legs",
      focus: "Squat pattern, hinge, and trunk stability",
    },
  ];
  if (days === 5) {
    return [
      ...ppl,
      {
        kind: "upper" as const,
        name: "Upper accessory",
        focus: "Extra upper push/pull volume and balance work",
      },
      {
        kind: "lower" as const,
        name: "Lower accessory",
        focus: "Extra unilateral lower and posterior work",
      },
    ];
  }
  return [
    ...ppl,
    {
      kind: "push" as const,
      name: "Push 2",
      focus: "Second push: volume and secondary angles",
    },
    {
      kind: "pull" as const,
      name: "Pull 2",
      focus: "Second pull: volume and secondary angles",
    },
    {
      kind: "legs" as const,
      name: "Legs 2",
      focus: "Second legs: unilateral bias and posterior chain",
    },
  ];
}

function prepSlotToBuilderSlot(p: PrepSlot): Slot {
  return {
    patterns: p.patterns,
    warmup: p.phase === "warmup",
    cooldown: p.phase === "cooldown",
    label: p.label,
    preferTags: p.preferTags,
    prepRole: p.role,
  };
}

/**
 * When squat and hinge share a day, only the first stays a heavy primary.
 * Later lower-body slots become volume / technique (NSCA same-session recovery).
 */
function tagSameDaySquatHinge(slots: Slot[]): Slot[] {
  let sawHeavyLower = false;
  return slots.map((slot) => {
    if (slot.warmup || slot.cooldown) return slot;
    const primary = slot.patterns[0];
    if (primary !== "squat" && primary !== "hinge") return slot;
    if (!sawHeavyLower) {
      sawHeavyLower = true;
      return slot;
    }
    return { ...slot, tag: slot.tag ?? "hypertrophy" };
  });
}

/**
 * Work slots only (no warm-up/cool-down). Prep is layered in buildProgramDraft.
 * short (<40): lean main lifts
 * standard (40–54): main lifts + core when sensible
 * long (≥55): +1 accessory/unilateral or second push/pull, capped
 *
 * extraLowerVolume (hypertrophy, ≤2 days/wk): add the missing squat or hinge
 * so both patterns reach ≥2 weekly exposures (Schoenfeld frequency).
 */
function workSlotsForKind(
  kind: SessionKind,
  minutes: number,
  opts?: { extraLowerVolume?: boolean }
): Slot[] {
  const density = densityForMinutes(minutes);
  const short = density === "short";
  const long = density === "long";
  const maxWork = short ? 4 : long ? 6 : 5;
  const extraLower = !!opts?.extraLowerVolume;

  const cap = (slots: Slot[]) => slots.slice(0, maxWork);

  switch (kind) {
    case "mobility":
      return cap([
        { patterns: ["mobility"] },
        { patterns: ["mobility", "core"] },
        { patterns: ["core"] },
        ...(long ? [{ patterns: ["mobility", "carry"] }] : []),
      ]);
    case "full_a":
      return cap([
        { patterns: ["squat"] },
        { patterns: ["horizontal_push"] },
        { patterns: ["horizontal_pull"] },
        ...(short ? [] : [{ patterns: ["core", "carry"] }]),
        // long already includes a secondary lower; 2-day hypertrophy adds hinge on shorter days
        ...(long
          ? [{ patterns: ["hinge", "squat"], tag: "hypertrophy" as const }]
          : extraLower
            ? [{ patterns: ["hinge"], tag: "hypertrophy" as const }]
            : []),
      ]);
    case "full_b":
      return cap([
        { patterns: ["hinge"] },
        { patterns: ["vertical_push", "horizontal_push"] },
        { patterns: ["vertical_pull", "horizontal_pull"] },
        ...(short ? [] : [{ patterns: ["core"] }]),
        ...(long ? [{ patterns: ["horizontal_pull", "horizontal_push"] }] : []),
        ...(extraLower
          ? [{ patterns: ["squat"], tag: "hypertrophy" as const }]
          : []),
      ]);
    case "full_c":
      return cap([
        { patterns: ["squat"] },
        { patterns: ["hinge"] },
        { patterns: ["horizontal_pull", "horizontal_push"] },
        { patterns: ["core", "carry"] },
        ...(long && !short ? [{ patterns: ["vertical_pull", "vertical_push"] }] : []),
      ]);
    case "upper":
      return cap([
        { patterns: ["horizontal_push"] },
        { patterns: ["horizontal_pull"] },
        { patterns: ["vertical_push", "horizontal_push"] },
        { patterns: ["vertical_pull", "horizontal_pull"] },
        ...(short ? [] : [{ patterns: ["core"] }]),
        ...(long ? [{ patterns: ["horizontal_pull", "horizontal_push"] }] : []),
      ]);
    case "lower":
      return cap([
        { patterns: ["squat"] },
        { patterns: ["hinge"] },
        { patterns: ["squat", "hinge"] },
        ...(short ? [] : [{ patterns: ["core", "carry"] }]),
        ...(long ? [{ patterns: ["hinge", "squat"] }] : []),
      ]);
    case "push":
      return cap([
        { patterns: ["horizontal_push"] },
        { patterns: ["vertical_push", "horizontal_push"] },
        { patterns: ["horizontal_push"] },
        ...(short ? [] : [{ patterns: ["core"] }]),
        ...(long ? [{ patterns: ["vertical_push", "horizontal_push"] }] : []),
      ]);
    case "pull":
      return cap([
        { patterns: ["horizontal_pull"] },
        { patterns: ["vertical_pull", "horizontal_pull"] },
        { patterns: ["horizontal_pull"] },
        ...(short ? [] : [{ patterns: ["core"] }]),
        ...(long ? [{ patterns: ["vertical_pull", "horizontal_pull"] }] : []),
      ]);
    case "legs":
      return cap([
        { patterns: ["squat"] },
        { patterns: ["hinge"] },
        { patterns: ["squat"] },
        { patterns: ["core", "carry"] },
        ...(long ? [{ patterns: ["hinge", "squat"] }] : []),
      ]);
    default:
      return cap([
        { patterns: ["squat"] },
        { patterns: ["horizontal_push"] },
        { patterns: ["horizontal_pull"] },
      ]);
  }
}

function toConstraintExercise(e: ExerciseWithAvailability) {
  return {
    name: e.name,
    tags: e.tags,
    movementPattern: e.movementPattern,
    difficulty: e.difficulty,
  };
}

function uniqueIds(ids?: string[] | null): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function pickPinnedFromCandidates(
  candidates: ExerciseWithAvailability[],
  pinnedExerciseIds: string[] | undefined,
  usedIds: Set<string>
): ExerciseWithAvailability | null {
  if (!pinnedExerciseIds?.length || !candidates.length) return null;
  const byId = new Map(candidates.map((c) => [c.id, c]));
  for (const pid of pinnedExerciseIds) {
    if (usedIds.has(pid)) continue;
    const hit = byId.get(pid);
    if (hit) return hit;
  }
  return null;
}

function pickExercise(
  pool: ExerciseWithAvailability[],
  patterns: string[],
  usedIds: Set<string>,
  preferTags: string[] = [],
  variationSeed = 0,
  slotSalt = 0,
  profile?: ClientConstraintProfile | null,
  /** Soft-penalize patterns already used that day (avoid stacking violated-ish work). */
  dayPatternCounts?: Map<string, number>,
  evalCtx?: ClientEvaluationContext | null,
  requireSafe = false,
  pinnedExerciseIds?: string[]
): ExerciseWithAvailability | null {
  let candidates = pool.filter(
    (e) => e.available && patterns.includes(e.movementPattern) && !usedIds.has(e.id)
  );

  // Hard-skip constraint violations when safer options exist
  if (profile && candidates.length) {
    const safe = candidates.filter(
      (e) => !exerciseViolatesConstraints(toConstraintExercise(e), profile)
    );
    if (safe.length) candidates = safe;
  }

  if (evalCtx) {
    candidates = enforceHardSafetyGates(
      candidates.map((e) => ({
        id: e.id,
        name: e.name,
        movementPattern: e.movementPattern,
        tags: e.tags,
        contraindications: (e as { contraindications?: string[] }).contraindications,
        equipmentIds: e.equipmentIds,
        equipmentAny: e.equipmentAny,
        available: e.available,
      })),
      evalCtx
    )
      .map((g) => candidates.find((c) => c.id === g.id))
      .filter((x): x is ExerciseWithAvailability => !!x);
  }

  const pinnedHit = pickPinnedFromCandidates(
    candidates,
    pinnedExerciseIds,
    usedIds
  );
  if (pinnedHit) return pinnedHit;

  if (!candidates.length) {
    const secondary = patterns.flatMap((p) => secondaryPatternsFor(p));
    if (secondary.length) {
      const alt = pickExercise(
        pool,
        secondary,
        usedIds,
        preferTags,
        variationSeed,
        slotSalt + 17,
        profile,
        dayPatternCounts,
        evalCtx,
        false,
        pinnedExerciseIds
      );
      if (alt) return alt;
      if (requireSafe && pool.some((e) => e.available)) {
        throw new InsufficientSafeExercisesError(patterns[0] || "unknown", secondary);
      }
    }
    // fallback any unused available in pattern family
    let soft = pool.filter((e) => e.available && !usedIds.has(e.id));
    if (profile && soft.length) {
      const safeSoft = soft.filter(
        (e) => !exerciseViolatesConstraints(toConstraintExercise(e), profile)
      );
      if (safeSoft.length) soft = safeSoft;
    }
    if (evalCtx && soft.length) {
      const gated = enforceHardSafetyGates(
        soft.map((e) => ({
          id: e.id,
          name: e.name,
          tags: e.tags,
          contraindications: (e as { contraindications?: string[] })
            .contraindications,
        })),
        evalCtx
      );
      const allowed = new Set(gated.map((g) => g.id));
      soft = soft.filter((e) => allowed.has(e.id));
    }
    if (!soft.length) {
      if (requireSafe && pool.some((e) => e.available)) {
        throw new InsufficientSafeExercisesError(patterns[0] || "unknown", secondary);
      }
      return null;
    }
    if (variationSeed) {
      // Mix id hash so regenerate is less sticky on the same index
      const salt =
        Math.abs(variationSeed * 2654435761 + slotSalt * 97 + soft.length * 13) >>> 0;
      return soft[salt % soft.length];
    }
    return soft[0];
  }
  // Prefer matching tags / constraints / avoid advanced if possible
  const scored = candidates.map((e) => {
    let s = 0;
    for (const t of preferTags) {
      if (e.tags.toLowerCase().includes(t) || e.name.toLowerCase().includes(t)) s += 2;
    }
    if (e.difficulty === "beginner") s += 1;
    // Prefer simpler names for full body
    if (/goblet|push-up|row|rdl|dead bug|plank|wall/i.test(e.name)) s += 1;
    if (evalCtx?.detectedDeficiencies?.length) {
      s += scoreExerciseForPrimarySwaps(
        e,
        evalCtx.detectedDeficiencies.map((d) => d.slug)
      );
    }
    if (profile) {
      s += scoreExerciseForConstraints(toConstraintExercise(e), profile);
      // Extra soft penalty if this pattern was already used and still risky
      if (
        dayPatternCounts &&
        (dayPatternCounts.get(e.movementPattern) || 0) >= 1 &&
        exerciseViolatesConstraints(toConstraintExercise(e), profile)
      ) {
        s -= 3;
      }
    }
    // Prefer not stacking the same pattern many times when alternatives exist
    if (dayPatternCounts && patterns.length > 1) {
      const count = dayPatternCounts.get(e.movementPattern) || 0;
      if (count >= 2) s -= 1.5;
      else if (count >= 1) s -= 0.4;
    }
    // slight seed noise so regenerate can diversify among good options
    if (variationSeed) {
      const noise =
        ((variationSeed * 31 + slotSalt * 17 + e.id.length * 13 + e.name.length * 7) % 11) *
        0.08;
      s += noise;
    }
    return { e, s };
  });
  scored.sort((a, b) => b.s - a.s);
  // Among top scorers, pick by seed for variation
  const topScore = scored[0].s;
  const top = scored.filter((x) => x.s >= topScore - 0.5);
  if (variationSeed && top.length > 1) {
    const idx =
      Math.abs(variationSeed * 17 + slotSalt * 31 + top.length * 3) % top.length;
    return top[idx].e;
  }
  return scored[0].e;
}

function applyMeso(
  rx: { sets: number; reps: string; rpe: string | null; restSec: number | null },
  plan: MesocyclePlan
) {
  return applyMesocycleToPrescription(rx, plan);
}

/** Rough session length from sets × rest heuristic, clamped near target. */
function estimateMinutesForDay(
  exercises: BuiltExercise[],
  sessionMinutes: number
): number {
  let workSets = 0;
  let restTotal = 0;
  for (const ex of exercises) {
    const sets = Math.max(1, ex.sets || 1);
    workSets += sets;
    const rest = ex.restSec ?? (ex.isWarmup ? 30 : 90);
    // rest after each set except roughly last of day — coarse
    restTotal += rest * Math.max(0, sets - (ex.isWarmup ? 0 : 0.25));
  }
  // ~45s effort per set + rests, + 5 min setup
  const raw = 5 + workSets * 0.75 + restTotal / 60;
  // Blend toward requested session length so UI feels coherent
  const blended = raw * 0.55 + sessionMinutes * 0.45;
  return Math.max(20, Math.min(90, Math.round(blended)));
}

function buildSchemeMix(days: BuiltDay[]): { scheme: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const d of days) {
    for (const ex of d.exercises) {
      const key = ex.setScheme || "straight";
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([scheme, count]) => ({ scheme, count }))
    .sort((a, b) => b.count - a.count || a.scheme.localeCompare(b.scheme));
}

function composeExerciseNotes(parts: Array<string | null | undefined>): string | null {
  const joined = parts
    .map((p) => plainText(p))
    .filter((p): p is string => !!p && p.length > 0)
    .join(" · ");
  return joined || null;
}

function buildCorrectiveWarmups(opts: {
  correctives: CorrectivePrescription[];
  pool: ExerciseWithAvailability[];
  usedIds: Set<string>;
  limit?: number;
}): BuiltExercise[] {
  const limit = opts.limit ?? 2;
  if (!opts.correctives.length || limit <= 0) return [];

  const poolItems: CorrectiveExercisePoolItem[] = opts.pool.map((e) => ({
    id: e.id,
    name: e.name,
    tags: e.tags,
    movementPattern: e.movementPattern,
    available: e.available,
    cues: e.cues,
  }));

  const out: BuiltExercise[] = [];
  const usedInWarmup = new Set<string>();

  for (const corrective of opts.correctives) {
    if (out.length >= limit) break;
    const matches = matchExercisesForCorrective(corrective, poolItems, 6);
    const pick = matches.find(
      (m) =>
        m.available &&
        !opts.usedIds.has(m.id) &&
        !usedInWarmup.has(m.id)
    );
    if (!pick) continue;

    usedInWarmup.add(pick.id);
    opts.usedIds.add(pick.id);

    const bank = opts.pool.find((e) => e.id === pick.id);
    const reason = plainText(corrective.reason) || corrective.reason;
    const rx = prepPrescription("mobilize");
    out.push({
      id: id("pe"),
      exerciseId: pick.id,
      exerciseName: pick.name,
      movementPattern: pick.movementPattern || "mobility",
      sets: rx.sets,
      reps: rx.reps,
      rpe: rx.rpe,
      restSec: rx.restSec,
      notes: composeExerciseNotes([
        reason,
        "Corrective first — quality before load.",
        bank?.cues,
      ]),
      sortOrder: 0,
      isWarmup: true,
      setScheme: "straight",
      setSchemeMeta: {
        phase: "warmup",
        summary: `Warm-up · Corrective · ${reason}`,
        howTo:
          plainText(bank?.cues || corrective.reason) ||
          "Pain-free range; stop short of aggravating symptoms.",
      },
      groupId: null,
      groupKind: null,
      groupLabel: null,
      groupOrder: null,
      restAfterSec: null,
      restBetweenRoundsSec: null,
      groupRole: null,
    });
  }

  return out;
}

function leftoverPinnedRow(
  ex: ExerciseWithAvailability,
  goal: ProgramGoal,
  experience: string,
  mesoPlan: MesocyclePlan,
  sort: number,
  intensity?: SlotIntensity,
  schemeIndex = 0
): BuiltExercise {
  const rx = prescription(goal, ex.movementPattern, experience, intensity);
  const schemeId = assignSetScheme({
    goal,
    pattern: ex.movementPattern,
    isWarmup: false,
    sortOrder: schemeIndex,
    experience,
  });
  const planned = buildSchemePlan(schemeId, rx, {
    pattern: ex.movementPattern,
    isWarmup: false,
  });
  const mesoRx = applyMeso(
    {
      sets: planned.sets,
      reps: planned.reps,
      rpe: planned.rpe,
      restSec: planned.restSec,
    },
    mesoPlan
  );
  return {
    id: id("pe"),
    exerciseId: ex.id,
    exerciseName: ex.name,
    movementPattern: ex.movementPattern,
    sets: mesoRx.sets,
    reps: mesoRx.reps,
    rpe: mesoRx.rpe,
    restSec: mesoRx.restSec,
    notes: composeExerciseNotes([ex.cues, "Trainer pin — kept on rebuild"]),
    sortOrder: sort,
    isWarmup: false,
    setScheme: planned.setScheme,
    setSchemeMeta: {
      ...planned.setSchemeMeta,
      summary: planned.setSchemeMeta?.summary,
    },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
    restAfterSec: null,
    restBetweenRoundsSec: null,
    groupRole: null,
  };
}

function leftoverPinnedAvailable(
  pinnedExerciseIds: string[],
  usedIds: Set<string>,
  pool: ExerciseWithAvailability[],
  evalCtx?: ClientEvaluationContext | null
): ExerciseWithAvailability[] {
  const leftover: ExerciseWithAvailability[] = [];
  const byId = new Map(pool.map((e) => [e.id, e]));
  for (const pid of pinnedExerciseIds) {
    if (usedIds.has(pid)) continue;
    const ex = byId.get(pid);
    if (!ex || !ex.available) continue;
    leftover.push(ex);
  }
  if (!leftover.length || !evalCtx) return leftover;
  const allowed = new Set(
    enforceHardSafetyGates(
      leftover.map((e) => ({
        id: e.id,
        name: e.name,
        movementPattern: e.movementPattern,
        tags: e.tags,
        contraindications: (e as { contraindications?: string[] }).contraindications,
        equipmentIds: e.equipmentIds,
        equipmentAny: e.equipmentAny,
        available: e.available,
      })),
      evalCtx
    ).map((g) => g.id)
  );
  return leftover.filter((e) => allowed.has(e.id));
}

function prescribedToWarmups(
  items: PrescribedCorrective[],
  limit: number
): BuiltExercise[] {
  return items.slice(0, limit).map((p) => ({
    id: id("pe"),
    exerciseId: p.exerciseId,
    exerciseName: p.exerciseName,
    movementPattern: p.movementPattern || "mobility",
    sets: p.sets,
    reps: p.reps,
    rpe: p.rpe,
    restSec: p.restSec,
    notes: composeExerciseNotes([p.rationale, "Corrective first — quality before load."]),
    sortOrder: 0,
    isWarmup: true,
    setScheme: "straight" as SetSchemeId,
    setSchemeMeta: {
      summary: `Warm-up · Corrective · ${p.deficiencySlug.replace(/_/g, " ")}`,
      howTo: p.rationale,
    },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
    restAfterSec: null,
    restBetweenRoundsSec: null,
    groupRole: null,
  }));
}

export async function buildProgramDraft(
  input: ProgramBuilderInput
): Promise<BuiltProgram> {
  const daysPerWeek = Math.min(6, Math.max(2, input.daysPerWeek || 3));
  const sessionMinutes = input.sessionMinutes || 45;
  const experience = input.experienceLevel || "intermediate";
  const goal = input.goal || "general";
  const density = densityForMinutes(sessionMinutes);

  const constraintProfile = buildConstraintProfile({
    injuries: input.clientInjuries,
    goals: input.clientGoals,
    preferMobility: input.preferMobility || goal === "mobility",
    contraindications: input.contraindications,
  });

  const preferMobility =
    !!input.preferMobility ||
    goal === "mobility" ||
    constraintProfile.forceMobility;

  const mesoWeek = input.mesocycleWeek ?? 1;
  const mesoPlan = getMesocycleWeek(mesoWeek);

  const assessmentHints = input.assessmentHints || [];
  const correctives = mergeCorrectives([
    correctivesFromClientHistory(input.clientInjuries),
    ...assessmentHints.map((h) =>
      correctivesFromAssessmentResults({
        templateSlug: h.templateSlug,
        results: h.results || {},
        summary: h.summary,
      })
    ),
  ]);
  const correctiveIds = correctives.map((c) => c.id);

  const evalCtx: ClientEvaluationContext | null = input.evaluationContext
    ? {
        ...input.evaluationContext,
        assessments:
          input.evaluationContext.assessments?.length
            ? input.evaluationContext.assessments
            : assessmentHints.map((h) => ({
                templateSlug: h.templateSlug,
                results: h.results || {},
                summary: h.summary,
              })),
      }
    : assessmentHints.length || input.clientInjuries
      ? {
          client: {
            injuriesText: input.clientInjuries || "",
            contraindicationsText: input.contraindications || "",
            medicalHistoryText: "",
            goalsText: input.clientGoals || "",
            experienceLevel: experience,
          },
          measurements: null,
          assessments: assessmentHints.map((h) => ({
            templateSlug: h.templateSlug,
            results: h.results || {},
            summary: h.summary,
          })),
        }
      : null;

  const smarterEval: RuleEngineEvaluationResult | null = evalCtx
    ? evaluateClientRules(evalCtx, goal)
    : null;

  const pinnedExerciseIds = uniqueIds(input.pinnedExerciseIds);
  const suppressedDeficiencySlugs = uniqueIds(input.suppressedDeficiencySlugs);
  const suppressed = new Set(suppressedDeficiencySlugs);
  if (smarterEval && suppressed.size) {
    smarterEval.deficiencies = smarterEval.deficiencies.filter(
      (d) => !suppressed.has(d.slug)
    );
  }

  const mode = input.facilityEquipmentMode ?? "org";
  const resolved = input.facilityEquipmentIds;
  let pool: ExerciseWithAvailability[];
  let available: ExerciseWithAvailability[];
  if ((mode === "client" || mode === "combined") && resolved?.length) {
    pool = await listExercisesForOrg(input.organizationId, { equipmentIds: resolved });
    available = pool.filter((e) => e.available);
  } else {
    pool = await listExercisesForOrg(input.organizationId);
    const availableBase = pool.filter((e) => e.available);
    available = evalCtx
      ? filterExercisesByEquipment(
          availableBase,
          input.facilityEquipmentIds ?? evalCtx.availableEquipmentIds
        )
      : availableBase;
  }

  const gatedCtx: ClientEvaluationContext | null =
    evalCtx && smarterEval
      ? {
          ...evalCtx,
          detectedDeficiencies: smarterEval.deficiencies.map((d) => ({
            slug: d.slug,
            name: d.name,
            severity: d.severity,
          })),
        }
      : evalCtx;

  const rotatedCorrectives =
    gatedCtx && smarterEval && smarterEval.deficiencies.length > 0
      ? prioritizeAndRotateCorrectives(
          smarterEval.deficiencies,
          daysPerWeek,
          gatedCtx,
          available.map((e) => ({
            id: e.id,
            name: e.name,
            movementPattern: e.movementPattern,
            tags: e.tags,
            equipmentIds: e.equipmentIds,
            equipmentAny: e.equipmentAny,
            available: e.available,
          }))
        )
      : null;

  if (rotatedCorrectives && suppressed.size) {
    for (const [dayNum, items] of rotatedCorrectives) {
      const kept = items.filter((p) => !suppressed.has(p.deficiencySlug));
      if (kept.length) rotatedCorrectives.set(dayNum, kept);
      else rotatedCorrectives.delete(dayNum);
    }
  }

  const split = splitForDays(daysPerWeek, goal);
  const splitType =
    goal === "mobility"
      ? "mobility"
      : daysPerWeek <= 3
        ? "full_body"
        : daysPerWeek === 4
          ? "upper_lower"
          : daysPerWeek >= 5
            ? "ppl"
            : "custom";

  const preferTags: string[] = [...constraintProfile.preferTags];
  if (goal === "fat_loss") preferTags.push("conditioning", "cardio");

  const usedGlobal = new Set<string>();
  const days: BuiltDay[] = [];
  const variationSeed = input.variationSeed ?? 0;
  // Day-index salt mixes regenerate variety across the whole week, not just slot order
  let slotSalt = (variationSeed * 7) % 97;

  for (let i = 0; i < split.length; i++) {
    const session = split[i];
    const prepDensity = densityFromMinutes(sessionMinutes);
    const kind = session.kind as PrepSessionKind;
    const workSlots = tagSameDaySquatHinge(
      workSlotsForKind(session.kind, sessionMinutes, {
        extraLowerVolume: goal === "hypertrophy" && daysPerWeek <= 2,
      })
    );
    const warmupSlots = warmupSlotsForSession(kind, prepDensity, {
      preferMobility,
    }).map(prepSlotToBuilderSlot);
    const cooldownSlots = cooldownSlotsForSession(kind, prepDensity).map(
      prepSlotToBuilderSlot
    );
    // Order: correctives → RAMP warm-up → main work → cool-down
    const slots: Slot[] = [...warmupSlots, ...workSlots, ...cooldownSlots];
    const dayUsed = new Set<string>();
    const dayPatternCounts = new Map<string, number>();
    const exercises: BuiltExercise[] = [];
    let sort = 0;
    let workSlotIndex = 0;

    // Prepend up to 2 assessment/history corrective mobility warm-ups per day
    const dayLimit = densityForMinutes(sessionMinutes) === "short" ? 1 : 2;
    const rotated = rotatedCorrectives?.get(i + 1) ?? [];
    const correctiveWarmups =
      rotated.length > 0
        ? prescribedToWarmups(rotated, dayLimit)
        : buildCorrectiveWarmups({
            correctives,
            pool: available,
            usedIds: new Set([...dayUsed, ...usedGlobal]),
            limit: dayLimit,
          });
    for (const wu of correctiveWarmups) {
      if (wu.exerciseId) {
        dayUsed.add(wu.exerciseId);
        usedGlobal.add(wu.exerciseId);
      }
      if (wu.movementPattern) {
        dayPatternCounts.set(
          wu.movementPattern,
          (dayPatternCounts.get(wu.movementPattern) || 0) + 1
        );
      }
      wu.sortOrder = sort++;
      exercises.push(wu);
    }

    for (const slot of slots) {
      slotSalt += 1 + i;
      const primaryPattern = slot.patterns[0] || "squat";
      const isPrep = !!(slot.warmup || slot.cooldown);
      const schemeId = assignSetScheme({
        goal,
        pattern: primaryPattern,
        isWarmup: isPrep,
        // Scheme rotation uses work-slot index, not global sort after RAMP/correctives
        sortOrder: isPrep ? 0 : workSlotIndex,
        experience,
      });

      // ── Multi-exercise group (contrast / complex / superset) ──
      if (!isPrep && isMultiExerciseScheme(schemeId)) {
        const groupSpec = getGroupMemberSpecs(schemeId, {
          pattern: primaryPattern,
          goal,
        });
        if (groupSpec) {
          const groupId = id("pg");
          const mesoRounds = applyMeso(
            {
              sets: groupSpec.rounds,
              reps: groupSpec.members[0]?.reps || "8",
              rpe: groupSpec.members[0]?.rpe || null,
              restSec: groupSpec.restBetweenRoundsSec,
            },
            mesoPlan
          );
          const scaledRounds = Math.max(1, mesoRounds.sets);

          const groupHowTo = plainText(groupSpec.howTo) || groupSpec.howTo;
          const groupMeta: SetSchemeMeta = {
            summary: `${groupSpec.label} · ${scaledRounds} rounds · ${groupSpec.members.map((m) => m.label).join(" → ")}`,
            howTo: groupHowTo,
            group: {
              kind: groupSpec.kind,
              label: groupSpec.label,
              rounds: scaledRounds,
              restBetweenExercisesSec:
                groupSpec.members[0]?.restAfterSec ?? 20,
              restBetweenRoundsSec: groupSpec.restBetweenRoundsSec,
            },
            complexMovements:
              schemeId === "complex"
                ? groupSpec.members.map((m) => m.label)
                : undefined,
            contrastPairs:
              schemeId === "contrast" ? scaledRounds : undefined,
            partnerHint:
              schemeId === "superset"
                ? groupSpec.members.map((m) => m.label).join(" + ")
                : undefined,
          };

          let groupAdded = 0;
          groupSpec.members.forEach((member, mi) => {
            slotSalt += 1;
            let ex = pickExercise(
              available,
              member.patterns,
              new Set([...dayUsed, ...usedGlobal]),
              preferTags,
              variationSeed,
              slotSalt,
              constraintProfile,
              dayPatternCounts,
              gatedCtx,
              !!gatedCtx,
              pinnedExerciseIds
            );
            if (!ex) {
              ex = pickExercise(
                available,
                member.patterns,
                dayUsed,
                preferTags,
                variationSeed,
                slotSalt + 50,
                constraintProfile,
                dayPatternCounts,
                gatedCtx,
                false,
                pinnedExerciseIds
              );
            }
            if (!ex) {
              // last resort: any available
              ex = pickExercise(
                available,
                slot.patterns,
                dayUsed,
                preferTags,
                variationSeed,
                slotSalt + 77,
                constraintProfile,
                dayPatternCounts,
                gatedCtx,
                false,
                pinnedExerciseIds
              );
            }
            if (!ex) return;
            groupAdded += 1;

            dayUsed.add(ex.id);
            usedGlobal.add(ex.id);
            if (ex.movementPattern) {
              dayPatternCounts.set(
                ex.movementPattern,
                (dayPatternCounts.get(ex.movementPattern) || 0) + 1
              );
            }

            const isLast = mi === groupSpec.members.length - 1;
            const restAfter = isLast ? 0 : member.restAfterSec;
            const restRounds = isLast ? groupSpec.restBetweenRoundsSec : null;

            // RPE bias only once (sets already scaled via scaledRounds)
            let memberRpe = member.rpe;
            if (mesoPlan.isDeload && member.rpe) {
              const parsed = parseFloat(String(member.rpe).replace(",", "."));
              if (Number.isFinite(parsed)) {
                memberRpe = String(
                  Math.max(1, Math.round((parsed + mesoPlan.rpeBias) * 2) / 2)
                );
              }
            }

            const plannedSets = Array.from(
              { length: scaledRounds },
              (_, ri) => ({
                reps: member.reps,
                rpe: memberRpe,
                role: member.role,
                restSec: isLast
                  ? groupSpec.restBetweenRoundsSec
                  : member.restAfterSec,
                note:
                  ri === 0
                    ? member.note
                    : `Round ${ri + 1}/${scaledRounds}`,
                tempo: member.tempo,
              })
            );

            let notes = composeExerciseNotes([
              ex.cues,
              member.note,
              isLast
                ? `Rest ${groupSpec.restBetweenRoundsSec}s after full round`
                : `Rest ${member.restAfterSec}s → next movement`,
              mesoRounds.note,
            ]);

            if (!notes && groupHowTo) {
              notes = truncateNote(groupHowTo);
            }

            if (
              constraintProfile.injuryFlags.includes("shoulder") &&
              /overhead|ohp|military/i.test(ex.name)
            ) {
              notes = composeExerciseNotes([
                notes,
                "Monitor shoulder comfort; landmine/neutral grip preferred if irritable.",
              ]);
            }

            exercises.push({
              id: id("pe"),
              exerciseId: ex.id,
              exerciseName: ex.name,
              movementPattern: ex.movementPattern,
              sets: scaledRounds,
              reps: member.reps,
              rpe: memberRpe,
              restSec: isLast
                ? groupSpec.restBetweenRoundsSec
                : member.restAfterSec,
              notes,
              sortOrder: sort++,
              isWarmup: false,
              setScheme: schemeId,
              setSchemeMeta: {
                ...groupMeta,
                plannedSets,
                summary: `${member.label} · ${scaledRounds}×${member.reps}`,
                howTo: groupHowTo,
              },
              groupId,
              groupKind: groupSpec.kind,
              groupLabel: groupSpec.label,
              groupOrder: mi,
              restAfterSec: restAfter,
              restBetweenRoundsSec: restRounds,
              groupRole: member.role,
            });
          });
          if (!isPrep && groupAdded > 0) workSlotIndex += 1;
          continue;
        }
      }

      // ── Single-exercise scheme ──
      const slotTags = [
        ...preferTags,
        ...(slot.preferTags || []),
        ...(slot.warmup ? ["warmup"] : []),
        ...(slot.cooldown ? ["cooldown", "mobility"] : []),
      ];
      let ex = pickExercise(
        available,
        slot.patterns,
        new Set([...dayUsed, ...usedGlobal]),
        slotTags,
        variationSeed,
        slotSalt,
        constraintProfile,
        isPrep ? undefined : dayPatternCounts,
        gatedCtx,
        !isPrep && !!gatedCtx,
        pinnedExerciseIds
      );
      if (!ex) {
        ex = pickExercise(
          available,
          slot.patterns,
          dayUsed,
          slotTags,
          variationSeed,
          slotSalt + 99,
          constraintProfile,
          isPrep ? undefined : dayPatternCounts,
          gatedCtx,
          false,
          pinnedExerciseIds
        );
      }
      if (!ex) continue;

      dayUsed.add(ex.id);
      usedGlobal.add(ex.id);
      if (ex.movementPattern) {
        dayPatternCounts.set(
          ex.movementPattern,
          (dayPatternCounts.get(ex.movementPattern) || 0) + 1
        );
      }

      const role = (slot.prepRole ||
        (slot.warmup ? "activate" : slot.cooldown ? "lengthen" : "")) as
        | import("@/lib/session-prep").PrepRole
        | "";
      const prepRx =
        isPrep && role
          ? prepPrescription(role as import("@/lib/session-prep").PrepRole)
          : null;
      const rx =
        prepRx ||
        prescription(goal, ex.movementPattern, experience, slot.tag);
      const planned = buildSchemePlan(
        schemeId,
        {
          sets: rx.sets,
          reps: rx.reps,
          rpe: rx.rpe,
          restSec: rx.restSec,
        },
        { pattern: ex.movementPattern, isWarmup: isPrep }
      );

      // Don't mesocycle-scale warm-up/cool-down volume
      const mesoRx = isPrep
        ? {
            sets: planned.sets,
            reps: planned.reps,
            rpe: planned.rpe,
            restSec: planned.restSec,
            note: null as string | null,
          }
        : applyMeso(
            {
              sets: planned.sets,
              reps: planned.reps,
              rpe: planned.rpe,
              restSec: planned.restSec,
            },
            mesoPlan
          );

      const prepHow =
        isPrep && role
          ? prepHowTo(role as import("@/lib/session-prep").PrepRole)
          : null;

      let notes = composeExerciseNotes([
        isPrep ? slot.label || null : null,
        ex.cues,
        prepHow,
        isPrep ? null : planned.notesExtra,
        isPrep ? null : mesoRx.note,
      ]);

      if (!notes) {
        const howTo = plainText(planned.setSchemeMeta?.howTo);
        if (howTo) notes = truncateNote(howTo);
      }

      if (
        constraintProfile.injuryFlags.includes("shoulder") &&
        /overhead|ohp|military/i.test(ex.name)
      ) {
        notes = composeExerciseNotes([
          notes,
          "Monitor shoulder comfort; landmine/neutral grip preferred if irritable.",
        ]);
      }

      const metaHowTo =
        plainText(prepHow || planned.setSchemeMeta?.howTo) ||
        planned.setSchemeMeta?.howTo;

      const phase = slot.cooldown
        ? "cooldown"
        : slot.warmup
          ? "warmup"
          : undefined;
      const summaryFromSlot =
        slot.cooldown || slot.warmup
          ? prepSummary({
              patterns: slot.patterns,
              phase: slot.cooldown ? "cooldown" : "warmup",
              role: (role ||
                "activate") as import("@/lib/session-prep").PrepRole,
              preferTags: slot.preferTags || [],
              label: slot.label || (slot.cooldown ? "Cool-down" : "Warm-up"),
            })
          : planned.setSchemeMeta?.summary;

      exercises.push({
        id: id("pe"),
        exerciseId: ex.id,
        exerciseName: ex.name,
        movementPattern: ex.movementPattern,
        sets: mesoRx.sets,
        reps: mesoRx.reps,
        rpe: mesoRx.rpe,
        restSec: mesoRx.restSec,
        notes,
        sortOrder: sort++,
        isWarmup: !!slot.warmup,
        setScheme: planned.setScheme,
        setSchemeMeta: {
          ...planned.setSchemeMeta,
          phase,
          summary: summaryFromSlot || planned.setSchemeMeta?.summary,
          howTo: metaHowTo,
        },
        groupId: null,
        groupKind: null,
        groupLabel: null,
        groupOrder: null,
        restAfterSec: null,
        restBetweenRoundsSec: null,
        groupRole: null,
      });
      if (!isPrep) workSlotIndex += 1;
    }

    // Science order: warm-up → power → primary compounds (bench before OHP) →
    // secondary → isolation → core/carry → cool-down
    const ordered = sortExercisesForSession(exercises, {
      sessionKind: session.kind,
      focus: session.focus,
      goal,
    });

    days.push({
      id: id("pd"),
      dayIndex: i,
      name: session.name,
      focus: session.focus,
      exercises: ordered,
    });
  }

  if (pinnedExerciseIds.length && days.length) {
    const leftover = leftoverPinnedAvailable(
      pinnedExerciseIds,
      usedGlobal,
      available,
      gatedCtx
    ).slice(0, 4);
    if (leftover.length) {
      const day0 = days[0];
      let sort = day0.exercises.length;
      let leftoverWorkIndex = 0;
      const dayHasPattern = (pattern: string) =>
        day0.exercises.some(
          (row) => !row.isWarmup && row.movementPattern === pattern
        );
      for (const ex of leftover) {
        usedGlobal.add(ex.id);
        const pat = ex.movementPattern;
        const secondLower =
          (pat === "squat" || pat === "hinge") && dayHasPattern(pat);
        day0.exercises.push(
          leftoverPinnedRow(
            ex,
            goal,
            experience,
            mesoPlan,
            sort++,
            secondLower ? "hypertrophy" : undefined,
            leftoverWorkIndex++
          )
        );
      }
      const session0 = split[0];
      day0.exercises = sortExercisesForSession(day0.exercises, {
        sessionKind: session0.kind,
        focus: session0.focus,
        goal,
      });
      day0.exercises.forEach((row, idx) => {
        row.sortOrder = idx;
      });
    }
  }

  const gLabel = goalLabel(goal);
  const sLabel = splitTypeLabel(splitType);
  const title =
    input.title?.trim() ||
    `${gLabel} · ${daysPerWeek} days/wk · ${sLabel}`;

  const constraintSummary = formatConstraintSummary(constraintProfile);
  const splitRationale = splitRationaleFor(daysPerWeek, goal, splitType);
  const schemeMix = buildSchemeMix(days);
  const estimatedMinutesPerDay = days.map((d) =>
    estimateMinutesForDay(d.exercises, sessionMinutes)
  );
  const avgEstimatedMinutes = estimatedMinutesPerDay.length
    ? Math.round(
        estimatedMinutesPerDay.reduce((a, b) => a + b, 0) / estimatedMinutesPerDay.length
      )
    : sessionMinutes;

  const generationNotes: string[] = [];
  if (goal === "mobility") {
    generationNotes.push(
      "Mobility sessions keep volume low and rest short so range-of-motion work stays quality, not fatigue."
    );
  } else {
    generationNotes.push(
      "Frequency: squat, hinge, push, and pull hit ≥2×/week when the split allows (Schoenfeld hypertrophic frequency)."
    );
  }
  generationNotes.push(
    "Rest: compounds ~3 min on strength / ~2 min hypertrophy; accessories 45–90s (NSCA / ACSM rest intervals)."
  );
  if (/beginner/i.test(experience)) {
    generationNotes.push(
      "Novice (NSCA): straight sets, pyramid, or tempo only — no drop sets, myo-reps, or rest-pause."
    );
  } else {
    generationNotes.push(
      "Order: power → primary compounds (bench before overhead) → accessories → core/carry."
    );
  }
  if (split.some((s) => s.kind === "full_c" || s.kind === "lower" || s.kind === "legs")) {
    generationNotes.push(
      "Same-day squat + hinge: the second lower pattern is volume/technique, not a second heavy primary."
    );
  } else if (goal === "hypertrophy" && daysPerWeek <= 2) {
    generationNotes.push(
      "2-day hypertrophy: extra squat and hinge volume slots so both patterns get a second weekly exposure."
    );
  } else if (smarterEval?.deficiencies.length) {
    generationNotes.push(
      `Smarter engine: ${smarterEval.deficiencies.length} deficienc${smarterEval.deficiencies.length === 1 ? "y" : "ies"} → Mesocycle 1 ${smarterEval.mesocyclePhase}.`
    );
  } else if (correctiveIds.length || rotatedCorrectives?.size) {
    generationNotes.push(
      `Corrective warm-ups: rotated per day (cap ${densityForMinutes(sessionMinutes) === "short" ? 1 : 2}/day), safety-gated.`
    );
  }

  const noteParts = [
    input.notes,
    input.clientGoals ? `Client goal: ${input.clientGoals}` : null,
    input.clientInjuries ? `Constraints: ${input.clientInjuries}` : null,
    input.contraindications
      ? `Contraindications: ${input.contraindications}`
      : null,
    constraintSummary !== "Constraints: none detected."
      ? constraintSummary
      : null,
    mesoPlan.notes,
    `Uses only equipment marked available in Library (${available.length} exercises in pool).`,
  ].filter(Boolean);

  return {
    title,
    goal,
    daysPerWeek,
    sessionMinutes,
    splitType,
    experienceLevel: experience,
    notes: noteParts.join("\n") || null,
    days,
    meta: {
      availableExerciseCount: available.length,
      preferMobility,
      variationSeed,
      generatedAt: new Date().toISOString(),
      constraintSummary,
      mesocycle: mesoPlan,
      mesocycleWeek: mesoWeek,
      mesocyclePhase: smarterEval?.mesocyclePhase ?? null,
      rulesFired: smarterEval?.rulesFired ?? [],
      detectedDeficiencies: smarterEval?.deficiencies ?? [],
      correctiveIds,
      // UI-facing enrichment
      splitRationale,
      schemeMix,
      estimatedMinutesPerDay: avgEstimatedMinutes,
      estimatedMinutesByDay: estimatedMinutesPerDay,
      sessionDensity: density,
      generationNotes: generationNotes.slice(0, 4),
      pinnedExerciseIds,
      suppressedDeficiencySlugs,
      facilityEquipmentMode: input.facilityEquipmentMode ?? "org",
    },
  };
}
