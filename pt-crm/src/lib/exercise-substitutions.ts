/**
 * Pure exercise substitution ranking — no DB.
 * Score a pool of alternatives for a current exercise (floor / program builder).
 */

export type ExerciseLike = {
  id: string;
  name: string;
  movementPattern: string;
  tags: string;
  difficulty: string;
  available: boolean;
  equipmentNames: string[];
  cues: string | null;
  primaryMuscles: string;
  missingEquipment?: string[];
};

export type SubCandidate = {
  exercise: ExerciseLike;
  score: number;
  reasons: string[];
};

/** Optional constraint scoring — duck-typed to avoid circular imports. */
export type ConstraintProfileLike = {
  preferTags?: string[];
  avoidTags?: string[];
  avoidNamePatterns?: string[];
  forceMobility?: boolean;
  injuryFlags?: string[];
};

export type RankSubstitutionOpts = {
  current: ExerciseLike;
  pool: ExerciseLike[];
  limit?: number;
  /** Prefer same movement pattern (filter when possible). Default true. */
  preferSamePattern?: boolean;
  /** Only rank available equipment. Default true. */
  requireAvailable?: boolean;
  /** Client injury/goal profile — boost safer options, penalize conflicts. */
  constraintProfile?: ConstraintProfileLike | null;
  /**
   * Prefer easier (regression) or harder (progression) relative to current difficulty.
   * Default neutral.
   */
  difficultyBias?: "easier" | "harder" | "neutral";
};

const DIFF_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
}

function tagList(tags: string): string[] {
  return tags
    .toLowerCase()
    .split(/[,\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function muscleWords(primaryMuscles: string): string[] {
  return tokenize(primaryMuscles);
}

function nameHitsAvoidPattern(
  name: string,
  patterns: string[] | undefined
): boolean {
  if (!patterns?.length) return false;
  for (const src of patterns) {
    try {
      if (new RegExp(src, "i").test(name)) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

function scoreOne(
  current: ExerciseLike,
  candidate: ExerciseLike,
  opts?: Pick<RankSubstitutionOpts, "constraintProfile" | "difficultyBias">
): SubCandidate {
  let score = 0;
  const reasons: string[] = [];

  if (
    candidate.movementPattern &&
    candidate.movementPattern === current.movementPattern
  ) {
    score += 5;
    reasons.push(`Same pattern (${candidate.movementPattern})`);
  }

  const curTags = new Set(tagList(current.tags));
  const candTags = tagList(candidate.tags);
  let tagHits = 0;
  for (const t of candTags) {
    if (curTags.has(t)) {
      score += 1;
      tagHits += 1;
    }
  }
  if (tagHits) reasons.push(`${tagHits} shared tag${tagHits > 1 ? "s" : ""}`);

  const curMuscles = new Set(muscleWords(current.primaryMuscles));
  const candMuscles = muscleWords(candidate.primaryMuscles);
  let muscleHits = 0;
  const seenMuscle = new Set<string>();
  for (const m of candMuscles) {
    if (curMuscles.has(m) && !seenMuscle.has(m)) {
      seenMuscle.add(m);
      score += 2;
      muscleHits += 1;
    }
  }
  if (muscleHits) {
    reasons.push(
      `${muscleHits} shared muscle word${muscleHits > 1 ? "s" : ""}`
    );
  }

  // Shared equipment (easier swap on floor)
  const curEq = new Set(
    (current.equipmentNames || []).map((e) => e.toLowerCase())
  );
  let eqHits = 0;
  for (const e of candidate.equipmentNames || []) {
    if (curEq.has(e.toLowerCase())) eqHits += 1;
  }
  if (eqHits) {
    score += Math.min(3, eqHits);
    reasons.push("Similar equipment");
  }

  if (candidate.available) {
    score += 2;
    reasons.push("Available");
  }

  if (candidate.difficulty === "beginner") {
    score += 1;
    reasons.push("Beginner-friendly");
  }

  if (
    candidate.difficulty &&
    candidate.difficulty === current.difficulty
  ) {
    score += 1;
    reasons.push(`Same difficulty (${candidate.difficulty})`);
  }

  const bias = opts?.difficultyBias || "neutral";
  const curD = DIFF_RANK[current.difficulty] ?? 1;
  const candD = DIFF_RANK[candidate.difficulty] ?? 1;
  if (bias === "easier" && candD < curD) {
    score += 3;
    reasons.push("Easier regression");
  } else if (bias === "harder" && candD > curD) {
    score += 3;
    reasons.push("Harder progression");
  } else if (bias === "easier" && candD > curD) {
    score -= 2;
  } else if (bias === "harder" && candD < curD) {
    score -= 2;
  }

  // Soft name token overlap
  const curName = new Set(tokenize(current.name));
  const candName = tokenize(candidate.name);
  let nameHits = 0;
  const seenName = new Set<string>();
  for (const t of candName) {
    if (curName.has(t) && !seenName.has(t)) {
      seenName.add(t);
      score += 1;
      nameHits += 1;
    }
  }
  if (nameHits) {
    reasons.push(`${nameHits} name token${nameHits > 1 ? "s" : ""} overlap`);
  }

  // Constraint profile
  const profile = opts?.constraintProfile;
  if (profile) {
    const hay = `${candidate.tags} ${candidate.name} ${candidate.movementPattern}`.toLowerCase();
    for (const t of profile.preferTags || []) {
      if (hay.includes(t.toLowerCase())) {
        score += 2;
        reasons.push(`Fits constraint (${t})`);
        break;
      }
    }
    if (nameHitsAvoidPattern(candidate.name, profile.avoidNamePatterns)) {
      score -= 15;
      reasons.push("Conflicts with injury constraints");
    }
    for (const t of profile.avoidTags || []) {
      if (hay.includes(t.toLowerCase())) score -= 3;
    }
    if (
      profile.forceMobility &&
      candidate.movementPattern === "mobility"
    ) {
      score += 2;
    }
    if (
      (profile.injuryFlags || []).includes("shoulder") &&
      /landmine|neutral|half[- ]?kneeling|floor\s*press|cable/i.test(
        candidate.name
      )
    ) {
      score += 3;
      reasons.push("Shoulder-friendlier option");
    }
  }

  return { exercise: candidate, score, reasons };
}

/**
 * Rank substitution candidates for `current` from `pool`.
 * Excludes current.id; requireAvailable defaults true; preferSamePattern defaults true.
 */
export function rankSubstitutions(opts: RankSubstitutionOpts): SubCandidate[] {
  const {
    current,
    pool,
    limit = 8,
    preferSamePattern = true,
    requireAvailable = true,
    constraintProfile = null,
    difficultyBias = "neutral",
  } = opts;

  let candidates = pool.filter((e) => e.id !== current.id);
  if (requireAvailable) {
    candidates = candidates.filter((e) => e.available);
  }

  // Drop hard constraint violations when alternatives remain
  if (constraintProfile?.avoidNamePatterns?.length) {
    const safe = candidates.filter(
      (e) => !nameHitsAvoidPattern(e.name, constraintProfile.avoidNamePatterns)
    );
    if (safe.length) candidates = safe;
  }

  if (preferSamePattern) {
    const same = candidates.filter(
      (e) => e.movementPattern === current.movementPattern
    );
    if (same.length) candidates = same;
  }

  const ranked = candidates
    .map((e) =>
      scoreOne(current, e, { constraintProfile, difficultyBias })
    )
    .filter((c) => c.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.exercise.name.localeCompare(b.exercise.name);
    });

  return ranked.slice(0, limit);
}

/** Best single substitute, or null if none. */
export function bestSubstitution(
  opts: Omit<RankSubstitutionOpts, "limit">
): ExerciseLike | null {
  const [top] = rankSubstitutions({ ...opts, limit: 1 });
  return top?.exercise ?? null;
}

/** Same-pattern alternatives only (available preferred via pool order/filter by caller). */
export function samePatternAlternatives(
  pattern: string,
  pool: ExerciseLike[],
  excludeId: string,
  limit = 8
): ExerciseLike[] {
  return pool
    .filter(
      (e) =>
        e.id !== excludeId &&
        e.movementPattern === pattern
    )
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (a.difficulty === "beginner" && b.difficulty !== "beginner") return -1;
      if (b.difficulty === "beginner" && a.difficulty !== "beginner") return 1;
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}
