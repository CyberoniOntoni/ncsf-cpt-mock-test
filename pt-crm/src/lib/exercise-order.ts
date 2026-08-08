/**
 * Within-session exercise order from practical exercise science
 * (NSCA sequencing, RAMP prep, compound→isolation, neural demand first).
 *
 * Not medical protocol. Used by program builder + desk append insert position.
 */

import { isCooldownMeta } from "@/lib/session-prep";

export type OrderableExercise = {
  exerciseName?: string | null;
  name?: string | null;
  movementPattern?: string | null;
  isWarmup?: boolean | null;
  setScheme?: string | null;
  setSchemeMeta?: {
    phase?: string;
    summary?: string;
  } | null;
  groupId?: string | null;
  groupOrder?: number | null;
  sortOrder?: number | null;
};

export type SessionOrderContext = {
  /** Session kind / focus string (e.g. "push", "lower", "Full body A") */
  focus?: string | null;
  sessionKind?: string | null;
  goal?: string | null;
};

/** Lower = earlier in the session. */
export type OrderScore = {
  /** Primary sort key */
  rank: number;
  /** Debug / coach-facing reason for top of stack */
  reason: string;
};

const PHASE = {
  warmup: 0,
  power: 100,
  primary: 200,
  secondary: 300,
  accessory: 400,
  isolation: 500,
  core_carry: 600,
  cooldown: 700,
  other: 800,
} as const;

/**
 * Pattern base order inside the working block (after warm-up power).
 * Horizontal press before vertical press (bench before OHP).
 * Horizontal pull often before vertical when both present (rows → pull-ups),
 * unless session is vertical-priority.
 */
const PATTERN_BASE: Record<string, number> = {
  plyometric: 0,
  squat: 10,
  hinge: 20,
  horizontal_push: 30,
  vertical_push: 40,
  horizontal_pull: 50,
  vertical_pull: 60,
  carry: 70,
  core: 80,
  cardio: 90,
  mobility: 95,
  other: 100,
};

function normPattern(p?: string | null): string {
  return (p || "other").trim().toLowerCase() || "other";
}

function nameOf(ex: OrderableExercise): string {
  return (ex.exerciseName || ex.name || "").trim();
}

function nameKey(ex: OrderableExercise): string {
  return nameOf(ex).toLowerCase();
}

/** Session phase bucket. */
export function sessionPhase(
  ex: OrderableExercise
): "warmup" | "work" | "cooldown" {
  if (ex.isWarmup) return "warmup";
  if (isCooldownMeta(ex.setSchemeMeta)) return "cooldown";
  if (ex.setSchemeMeta?.phase === "warmup") return "warmup";
  if (ex.setSchemeMeta?.phase === "cooldown") return "cooldown";
  return "work";
}

/** Coach-facing phase label for desk section headers. */
export function sessionPhaseLabel(
  phase: "warmup" | "work" | "cooldown"
): string {
  if (phase === "warmup") return "Warm-up";
  if (phase === "cooldown") return "Cool-down";
  return "Work";
}

/**
 * True if the day's current order already matches science sort.
 * Compare only — never mutates or reorders. Empty / single = sorted.
 */
export function matchesScienceOrder(
  exercises: OrderableExercise[],
  ctx?: SessionOrderContext
): boolean {
  if (exercises.length <= 1) return true;
  const original = [...exercises].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
  const sorted = sortExercisesForSession(
    original.map((e) => ({ ...e })),
    ctx
  );
  for (let i = 0; i < original.length; i++) {
    const a = original[i]!;
    const b = sorted[i]!;
    const idA = (a as { id?: string }).id;
    const idB = (b as { id?: string }).id;
    if (idA && idB) {
      if (idA !== idB) return false;
    } else if (nameOf(a) !== nameOf(b) || sessionPhase(a) !== sessionPhase(b)) {
      return false;
    }
  }
  return true;
}

/**
 * Movement “size” / compound tier within a pattern.
 * 0 = primary free-weight compound, higher = more accessory/isolation.
 */
export function compoundTier(ex: OrderableExercise): {
  tier: number;
  reason: string;
} {
  const n = nameKey(ex);
  const p = normPattern(ex.movementPattern);

  // Explicit isolation / prehab last within pattern
  if (
    /face\s*pull|external\s*rotat|cuff|rear\s*delt|lateral\s*raise|front\s*raise|shrug|wrist|calf|concentration|kickback|pushdown|curl|extension|fly|flye|pec\s*deck|leg\s*extension|leg\s*curl|adductor|abductor|hip\s*abduct|hip\s*adduct/i.test(
      n
    )
  ) {
    return { tier: 80, reason: "isolation / prehab" };
  }

  // Machines generally after free-weight compounds (same pattern)
  const machine = /machine|smith|cable(?!\s*row)|stack|selectorized/i.test(n);

  // --- Horizontal push: flat bench > incline > decline > dip > landmine/push-up > machine ---
  if (p === "horizontal_push" || /bench|press|push-?up|dip|floor\s*press/i.test(n)) {
    if (/military|overhead|ohp|shoulder\s*press|strict\s*press|z\s*press/i.test(n)) {
      // mis-tagged OHP
      return { tier: 25, reason: "overhead press (after horizontal)" };
    }
    if (/flat|competition\s*bench|^bench\s*press$|barbell\s*bench/i.test(n) ||
        (/bench/i.test(n) && !/incline|decline|close/i.test(n))) {
      return { tier: machine ? 12 : 0, reason: "primary flat bench" };
    }
    if (/incline/i.test(n)) return { tier: machine ? 18 : 8, reason: "incline press" };
    if (/decline/i.test(n)) return { tier: machine ? 20 : 10, reason: "decline press" };
    if (/close[- ]?grip/i.test(n)) return { tier: 15, reason: "close-grip bench" };
    if (/dumbbell.*bench|db\s*bench|bench.*dumbbell/i.test(n))
      return { tier: 6, reason: "DB bench" };
    if (/floor\s*press/i.test(n)) return { tier: 10, reason: "floor press" };
    if (/dip/i.test(n)) return { tier: 22, reason: "dips" };
    if (/push-?up|press-?up/i.test(n)) return { tier: 28, reason: "push-up" };
    if (/landmine/i.test(n)) return { tier: 24, reason: "landmine press" };
    if (/chest\s*press|pec/i.test(n)) return { tier: 30, reason: "machine chest press" };
    if (machine) return { tier: 32, reason: "machine press" };
  }

  // --- Vertical push: strict OHP > push press > landmine > machine ---
  if (p === "vertical_push" || /overhead|military|ohp|shoulder\s*press/i.test(n)) {
    if (/push\s*press|jerk/i.test(n)) return { tier: 8, reason: "push press / jerk" };
    if (/military|strict|overhead\s*press|ohp|shoulder\s*press/i.test(n))
      return { tier: machine ? 15 : 0, reason: "primary overhead press" };
    if (/arnold|dumbbell.*press|db\s*press/i.test(n) && /shoulder|overhead/i.test(n))
      return { tier: 10, reason: "DB overhead" };
    if (/landmine/i.test(n)) return { tier: 18, reason: "landmine OH" };
    if (machine) return { tier: 25, reason: "machine shoulder press" };
  }

  // --- Squat pattern: high-bar/low-bar back squat > front > goblet > lunge/split ---
  if (p === "squat" || /squat|lunge|step[- ]?up|leg\s*press/i.test(n)) {
    if (/back\s*squat|high[- ]?bar|low[- ]?bar|^squat$/i.test(n) ||
        (/barbell\s*squat/i.test(n) && !/front|goblet|split/i.test(n)))
      return { tier: machine ? 12 : 0, reason: "primary back squat" };
    if (/front\s*squat/i.test(n)) return { tier: 5, reason: "front squat" };
    if (/safety\s*bar|ssb/i.test(n)) return { tier: 6, reason: "SSB squat" };
    if (/zercher/i.test(n)) return { tier: 8, reason: "zercher squat" };
    if (/goblet/i.test(n)) return { tier: 15, reason: "goblet squat" };
    if (/hack|pendulum/i.test(n)) return { tier: 18, reason: "hack / machine squat" };
    if (/leg\s*press/i.test(n)) return { tier: 22, reason: "leg press" };
    if (/split\s*squat|bulgarian|lunge|step[- ]?up|reverse\s*lunge/i.test(n))
      return { tier: 30, reason: "unilateral squat pattern" };
    if (machine) return { tier: 25, reason: "machine squat pattern" };
  }

  // --- Hinge: conventional/sumo DL > RDL/SLDL > good morning > kickback ---
  if (p === "hinge" || /deadlift|rdl|hinge|good\s*morning|hip\s*thrust|swing/i.test(n)) {
    if (/conventional|sumo|trap\s*bar|hex\s*bar|deadlift/i.test(n) &&
        !/rdl|romanian|stiff|single|deficit.*rdl/i.test(n))
      return { tier: machine ? 12 : 0, reason: "primary deadlift" };
    if (/romanian|rdl|stiff[- ]?leg/i.test(n)) return { tier: 10, reason: "RDL / SLDL" };
    if (/good\s*morning/i.test(n)) return { tier: 18, reason: "good morning" };
    if (/hip\s*thrust|glute\s*bridge/i.test(n)) return { tier: 20, reason: "hip thrust" };
    if (/kettlebell\s*swing|kb\s*swing|swing/i.test(n)) return { tier: 22, reason: "swing" };
    if (/single[- ]?leg|1[- ]?leg|b[- ]?stance/i.test(n))
      return { tier: 28, reason: "unilateral hinge" };
    if (machine) return { tier: 25, reason: "machine hinge" };
  }

  // --- Horizontal pull: chest-supported/pendlay/barbell row > cable > face ---
  if (p === "horizontal_pull" || /row|face\s*pull/i.test(n)) {
    if (/face\s*pull/i.test(n)) return { tier: 70, reason: "face pull last" };
    if (/pendlay|barbell\s*row|bent[- ]?over\s*row/i.test(n))
      return { tier: machine ? 12 : 0, reason: "primary barbell row" };
    if (/chest[- ]?supported|seal\s*row/i.test(n)) return { tier: 8, reason: "chest-supported row" };
    if (/dumbbell\s*row|db\s*row|single[- ]?arm\s*row/i.test(n))
      return { tier: 12, reason: "DB row" };
    if (/t[- ]?bar|landmine\s*row/i.test(n)) return { tier: 10, reason: "T-bar/landmine row" };
    if (/cable\s*row|seated\s*row/i.test(n)) return { tier: 20, reason: "cable/seated row" };
    if (/inverted\s*row|ring\s*row/i.test(n)) return { tier: 25, reason: "bodyweight row" };
    if (machine) return { tier: 22, reason: "machine row" };
  }

  // --- Vertical pull: weighted pull-up > chin-up > lat pulldown > straight-arm ---
  if (p === "vertical_pull" || /pull[- ]?up|chin[- ]?up|pulldown|lat\s*pull/i.test(n)) {
    if (/weighted\s*pull|pull[- ]?up|chin[- ]?up/i.test(n))
      return { tier: 0, reason: "pull-up / chin-up" };
    if (/lat\s*pulldown|pulldown/i.test(n)) return { tier: 15, reason: "lat pulldown" };
    if (/straight[- ]?arm|pull[- ]?over/i.test(n)) return { tier: 40, reason: "straight-arm pull" };
    if (machine) return { tier: 20, reason: "machine vertical pull" };
  }

  // Power / plyo: higher skill first, but whole block already early
  if (p === "plyometric" || /jump|bound|med\s*ball|throw|clean|snatch/i.test(n)) {
    if (/clean|snatch|jerk/i.test(n)) return { tier: 0, reason: "olympic lift" };
    if (/med\s*ball|medicine/i.test(n)) return { tier: 10, reason: "med ball" };
    return { tier: 15, reason: "plyometric" };
  }

  if (p === "core" || /plank|dead\s*bug|pallof|crunch|sit[- ]?up/i.test(n)) {
    if (/ab\s*wheel|hanging\s*leg|toes[- ]?to/i.test(n)) return { tier: 10, reason: "harder core" };
    return { tier: 20, reason: "core" };
  }

  if (p === "carry" || /carry|farmer|suitcase|yoke/i.test(n)) {
    return { tier: 10, reason: "loaded carry" };
  }

  if (machine) return { tier: 40, reason: "machine accessory" };
  return { tier: 30, reason: "accessory" };
}

/**
 * Bias pattern order by session focus (e.g. pull day: vertical/horizontal pull early).
 */
function patternBias(
  pattern: string,
  ctx?: SessionOrderContext
): number {
  const focus = `${ctx?.sessionKind || ""} ${ctx?.focus || ""}`.toLowerCase();
  let bias = 0;

  if (/push/.test(focus) && !/pull/.test(focus)) {
    if (pattern === "horizontal_push") bias -= 8;
    if (pattern === "vertical_push") bias -= 4;
    if (pattern.includes("pull")) bias += 15;
  }
  if (/pull/.test(focus) && !/push/.test(focus)) {
    if (pattern === "horizontal_pull") bias -= 8;
    if (pattern === "vertical_pull") bias -= 6;
    if (pattern.includes("push")) bias += 15;
  }
  if (/leg|lower|squat/.test(focus)) {
    if (pattern === "squat") bias -= 10;
    if (pattern === "hinge") bias -= 6;
    if (pattern.includes("push") || pattern.includes("pull")) bias += 12;
  }
  if (/hinge|dead|posterior/.test(focus)) {
    if (pattern === "hinge") bias -= 10;
    if (pattern === "squat") bias -= 4;
  }
  if (/upper/.test(focus)) {
    if (pattern.includes("push") || pattern.includes("pull")) bias -= 5;
    if (pattern === "squat" || pattern === "hinge") bias += 20;
  }
  // Full body A squat-bias, B hinge-bias
  if (/\bfull.*\ba\b|squat\s*emphasis|squat\s*primary/i.test(focus)) {
    if (pattern === "squat") bias -= 8;
  }
  if (/\bfull.*\bb\b|hinge\s*emphasis|hinge\s*primary/i.test(focus)) {
    if (pattern === "hinge") bias -= 8;
  }

  return bias;
}

/**
 * Goal nuance: strength slightly prioritizes lowest-rep compounds;
 * hypertrophy still compounds first but accessories closer.
 */
function goalNudge(ex: OrderableExercise, ctx?: SessionOrderContext): number {
  const goal = (ctx?.goal || "general").toLowerCase();
  const { tier } = compoundTier(ex);
  if (goal === "strength" && tier <= 10) return -3;
  if (goal === "hypertrophy" && tier >= 40) return -1; // accessories still after compounds
  if (goal === "fat_loss" && normPattern(ex.movementPattern) === "cardio") return -2;
  return 0;
}

/**
 * Score one exercise for session order (lower = earlier).
 */
export function scoreExerciseOrder(
  ex: OrderableExercise,
  ctx?: SessionOrderContext
): OrderScore {
  const phase = sessionPhase(ex);
  const p = normPattern(ex.movementPattern);
  const { tier, reason: tierReason } = compoundTier(ex);
  const n = nameKey(ex);

  if (phase === "warmup") {
    // Keep relative order among warm-ups via role hints in summary
    let sub = 50;
    const sum = (ex.setSchemeMeta?.summary || "").toLowerCase();
    if (/corrective/.test(sum)) sub = 10;
    else if (/raise/.test(sum)) sub = 20;
    else if (/activate/.test(sum)) sub = 30;
    else if (/mobilize/.test(sum)) sub = 40;
    else if (/potentiate/.test(sum)) sub = 55;
    return { rank: PHASE.warmup + sub, reason: "warm-up" };
  }

  if (phase === "cooldown") {
    let sub = 50;
    const sum = (ex.setSchemeMeta?.summary || "").toLowerCase();
    if (/downshift/.test(sum)) sub = 10;
    else if (/lengthen/.test(sum)) sub = 30;
    else if (/restore/.test(sum)) sub = 50;
    return { rank: PHASE.cooldown + sub, reason: "cool-down" };
  }

  // Working sets
  // Power / olympic / high-velocity early (after warm-up)
  if (
    p === "plyometric" ||
    /clean|snatch|jerk|med\s*ball|plyo|jump\s*squat|bound/i.test(n)
  ) {
    return {
      rank: PHASE.power + tier + goalNudge(ex, ctx),
      reason: "power / high velocity first",
    };
  }

  // Contrast/complex groups: keep group cluster early-ish as secondary compounds
  if (ex.groupId && /contrast|complex/i.test(ex.setSchemeMeta?.summary || ex.setScheme || "")) {
    const go = ex.groupOrder ?? 0;
    return {
      rank: PHASE.secondary + go + patternBias(p, ctx) * 0.1,
      reason: "multi-lift complex/contrast",
    };
  }

  const patBase = PATTERN_BASE[p] ?? PATTERN_BASE.other;
  const biased = patBase + patternBias(p, ctx);

  // Core & carry near end of work
  if (p === "core" || p === "carry") {
    return {
      rank: PHASE.core_carry + biased + tier + goalNudge(ex, ctx),
      reason: p === "carry" ? "carry finisher" : "core late",
    };
  }

  // Isolation tier → isolation band
  if (tier >= 70) {
    return {
      rank: PHASE.isolation + biased + tier + goalNudge(ex, ctx),
      reason: tierReason,
    };
  }

  // Primary compounds (tier 0–15)
  if (tier <= 15) {
    return {
      rank:
        PHASE.primary +
        biased +
        tier +
        goalNudge(ex, ctx),
      reason: `${tierReason}; pattern order (e.g. bench before OHP)`,
    };
  }

  // Secondary compounds / unilateral
  if (tier <= 40) {
    return {
      rank: PHASE.secondary + biased + tier + goalNudge(ex, ctx),
      reason: tierReason,
    };
  }

  return {
    rank: PHASE.accessory + biased + tier + goalNudge(ex, ctx),
    reason: tierReason,
  };
}

/**
 * Stable sort: rank, then original sortOrder, then name.
 * Reassigns sortOrder 0..n-1. Preserves group-relative order when same groupId.
 */
export function sortExercisesForSession<T extends OrderableExercise>(
  exercises: T[],
  ctx?: SessionOrderContext
): T[] {
  if (exercises.length <= 1) {
    return exercises.map((e, i) => ({ ...e, sortOrder: i }));
  }

  const decorated = exercises.map((ex, originalIndex) => ({
    ex,
    originalIndex,
    score: scoreExerciseOrder(ex, ctx),
  }));

  // Keep multi-exercise groups contiguous: use min rank in group as group key
  const groupMin = new Map<string, number>();
  for (const d of decorated) {
    const gid = d.ex.groupId;
    if (!gid) continue;
    const prev = groupMin.get(gid);
    if (prev == null || d.score.rank < prev) groupMin.set(gid, d.score.rank);
  }

  decorated.sort((a, b) => {
    const ga = a.ex.groupId ? groupMin.get(a.ex.groupId)! : a.score.rank;
    const gb = b.ex.groupId ? groupMin.get(b.ex.groupId)! : b.score.rank;
    if (ga !== gb) return ga - gb;

    // Inside same group: groupOrder
    if (a.ex.groupId && a.ex.groupId === b.ex.groupId) {
      const oa = a.ex.groupOrder ?? 0;
      const ob = b.ex.groupOrder ?? 0;
      if (oa !== ob) return oa - ob;
    }

    if (a.score.rank !== b.score.rank) return a.score.rank - b.score.rank;
    const sa = a.ex.sortOrder ?? a.originalIndex;
    const sb = b.ex.sortOrder ?? b.originalIndex;
    if (sa !== sb) return sa - sb;
    return nameOf(a.ex).localeCompare(nameOf(b.ex));
  });

  return decorated.map((d, i) => ({
    ...d.ex,
    sortOrder: i,
  }));
}

/**
 * Where to insert a new exercise on a day (desk append) for correct science order.
 * Returns target sortOrder (0-based index in the final list).
 */
export function suggestedInsertSortOrder(
  existing: OrderableExercise[],
  incoming: OrderableExercise,
  ctx?: SessionOrderContext
): number {
  const withIncoming = [
    ...existing,
    { ...incoming, sortOrder: existing.length },
  ];
  const sorted = sortExercisesForSession(withIncoming, ctx);
  const name = nameOf(incoming);
  const idHint = (incoming as { id?: string }).id;
  const idx = sorted.findIndex((e) => {
    if (idHint && (e as { id?: string }).id === idHint) return true;
    return nameOf(e) === name && sessionPhase(e) === sessionPhase(incoming);
  });
  return idx >= 0 ? idx : sorted.length - 1;
}

/**
 * True if A should appear before B in a typical session (work block).
 * Used in smoke tests (bench before military).
 */
export function shouldPrecede(
  a: OrderableExercise,
  b: OrderableExercise,
  ctx?: SessionOrderContext
): boolean {
  return scoreExerciseOrder(a, ctx).rank < scoreExerciseOrder(b, ctx).rank;
}
