/**
 * Deterministic smarter program rule engine.
 * Uses *actual* assessment template keys (not the plan's sample names).
 */

export type DeficiencySeverity = "mild" | "moderate" | "severe";
export type DeficiencySource = "assessment" | "measurement" | "history" | "trainer_override";
export type MesocyclePhase =
  | "corrective_prep"
  | "general_prep"
  | "hypertrophy"
  | "strength_build";

export type ClientMeasurementsContext = {
  heightCm: number | null;
  weightKg: number | null;
  bodyFatPct: number | null;
  bmi: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  waistToHipRatio: number | null;
};

export type AssessmentContextRow = {
  templateSlug: string;
  templateName?: string;
  results: Record<string, unknown>;
  takenAt?: Date | string | null;
  summary?: string | null;
};

export type DetectedDeficiency = {
  slug: string;
  name: string;
  category: string;
  severity: DeficiencySeverity;
  affectedSide: "left" | "right" | "bilateral";
  source: DeficiencySource;
  triggerDescription: string;
  identifiedAt: Date;
};

export type ClientEvaluationContext = {
  client: {
    id?: string;
    sex?: string | null;
    injuriesText: string;
    contraindicationsText: string;
    medicalHistoryText: string;
    goalsText?: string;
    experienceLevel?: string;
  };
  measurements: ClientMeasurementsContext | null;
  assessments: AssessmentContextRow[];
  detectedDeficiencies?: Array<{
    slug: string;
    name: string;
    severity: DeficiencySeverity;
  }>;
  availableEquipmentIds?: string[];
};

export type GateExercise = {
  id: string;
  name: string;
  movementPattern?: string | null;
  tags?: string | null;
  contraindications?: string[] | null;
  equipmentIds?: string[] | null;
  equipmentAny?: boolean | null;
  available?: boolean;
};

export type PrescribedCorrective = {
  deficiencySlug: string;
  placement: "warmup";
  exerciseId: string | null;
  exerciseName: string;
  movementPattern: string;
  sets: number;
  reps: string;
  rpe: string;
  restSec: number;
  rationale: string;
};

export type RuleEngineEvaluationResult = {
  deficiencies: DetectedDeficiency[];
  mesocyclePhase: MesocyclePhase;
  rulesFired: string[];
  blockedExerciseIds: string[];
};

export class InsufficientSafeExercisesError extends Error {
  readonly code = "insufficient_safe_exercises" as const;
  readonly pattern: string;
  readonly secondaryTried: string[];

  constructor(pattern: string, secondaryTried: string[] = []) {
    super(
      `No safe executable exercises for ${pattern}` +
        (secondaryTried.length
          ? ` (also tried ${secondaryTried.join(", ")})`
          : "")
    );
    this.name = "InsufficientSafeExercisesError";
    this.pattern = pattern;
    this.secondaryTried = secondaryTried;
  }
}

export const SECONDARY_PATTERN_MATRIX: Record<string, string[]> = {
  squat: ["hinge", "core"],
  hinge: ["squat", "core"],
  vertical_push: ["horizontal_push", "core"],
  horizontal_push: ["vertical_push", "core"],
  vertical_pull: ["horizontal_pull"],
  horizontal_pull: ["vertical_pull"],
  carry: ["core", "hinge"],
  core: ["mobility"],
  mobility: ["core"],
};

const CORRECTIVE_HINTS: Record<
  string,
  { nameHints: string[]; tags: string[] }
> = {
  upper_cross_syndrome: {
    nameHints: [
      "face pull",
      "prone y",
      "wall slide",
      "chin tuck",
      "pec",
      "doorway",
      "pull-apart",
    ],
    tags: ["shoulder", "scapula", "posture", "mobility", "tspine"],
  },
  lower_cross_syndrome: {
    nameHints: [
      "hip flexor",
      "glute bridge",
      "dead bug",
      "deadbug",
      "rkc plank",
      "plank",
    ],
    tags: ["hip", "core", "glute", "posture", "apt"],
  },
  ankle_mobility_restriction: {
    nameHints: ["ankle", "knee-to-wall", "calf", "soleus", "dorsiflex"],
    tags: ["ankle", "mobility", "calf"],
  },
  knee_valgus_collapse: {
    nameHints: ["clamshell", "monster walk", "lateral walk", "glute bridge"],
    tags: ["glute", "hip", "knee", "band"],
  },
  forward_head_posture: {
    nameHints: ["chin tuck", "cervical", "thoracic", "foam"],
    tags: ["posture", "neck", "tspine"],
  },
  high_bmi_joint_stress: {
    nameHints: ["scapular retraction", "isometric", "seated"],
    tags: ["mobility", "low-impact"],
  },
  abdominal_adiposity_core_restriction: {
    nameHints: ["pallof", "bird dog", "bird-dog", "farmer", "anti-rotation"],
    tags: ["core", "anti-rotation", "carry"],
  },
};

export type PrimarySwapHint = {
  /** movementPattern this hint applies to (squat, hinge, vertical_push, …) */
  pattern: string;
  preferNameHints: string[];
  avoidNameHints: string[];
  preferTags: string[];
};

/** Meso-1 primary lift swaps keyed by deficiency slug. */
const PRIMARY_SWAP_MATRIX: Record<string, PrimarySwapHint[]> = {
  upper_cross_syndrome: [
    {
      pattern: "vertical_push",
      preferNameHints: ["landmine", "incline", "half-kneeling"],
      avoidNameHints: ["overhead press", "military", "behind the neck"],
      preferTags: ["landmine", "incline"],
    },
    {
      pattern: "vertical_pull",
      preferNameHints: ["neutral", "lat pulldown"],
      avoidNameHints: ["behind"],
      preferTags: ["neutral"],
    },
  ],
  lower_cross_syndrome: [
    {
      pattern: "vertical_push",
      preferNameHints: ["half-kneeling", "landmine"],
      avoidNameHints: [],
      preferTags: ["landmine"],
    },
    {
      pattern: "hinge",
      preferNameHints: ["trap bar", "rdl", "romanian"],
      avoidNameHints: ["conventional deadlift", "stiff leg"],
      preferTags: ["trap bar", "rdl"],
    },
  ],
  ankle_mobility_restriction: [
    {
      pattern: "squat",
      preferNameHints: ["goblet", "box squat", "heel", "trap bar squat"],
      avoidNameHints: ["back squat", "barbell squat"],
      preferTags: ["goblet", "heel"],
    },
  ],
  knee_valgus_collapse: [
    {
      pattern: "squat",
      preferNameHints: ["goblet", "bulgarian", "split squat", "band"],
      avoidNameHints: ["back squat"],
      preferTags: ["goblet", "split", "band"],
    },
  ],
  forward_head_posture: [
    {
      pattern: "horizontal_pull",
      preferNameHints: ["chest-supported", "seal row"],
      avoidNameHints: [],
      preferTags: ["chest-supported"],
    },
    {
      pattern: "carry",
      preferNameHints: [],
      avoidNameHints: ["shrug", "farmer"],
      preferTags: [],
    },
  ],
  high_bmi_joint_stress: [
    {
      pattern: "squat",
      preferNameHints: ["leg press", "belt squat", "goblet"],
      avoidNameHints: ["jump", "plyo", "back squat"],
      preferTags: ["goblet", "machine"],
    },
  ],
  abdominal_adiposity_core_restriction: [
    {
      pattern: "core",
      preferNameHints: ["pallof", "bird dog", "anti-rotation", "dead bug"],
      avoidNameHints: ["sit-up", "crunch", "v-up"],
      preferTags: ["pallof", "anti-rotation"],
    },
  ],
};

/** Hints from detected deficiency slugs. */
export function primarySwapHintsFor(slugs: string[]): PrimarySwapHint[] {
  const out: PrimarySwapHint[] = [];
  const seen = new Set<string>();
  for (const raw of slugs) {
    const slug = lower(raw).replace(/[\s-]+/g, "_");
    if (seen.has(slug)) continue;
    seen.add(slug);
    const rows = PRIMARY_SWAP_MATRIX[slug];
    if (rows) out.push(...rows);
  }
  return out;
}

/**
 * Score an exercise for meso-1 primary modifications.
 * Positive = prefer, negative = avoid. 0 if no relevant hint for this pattern.
 */
export function scoreExerciseForPrimarySwaps(
  ex: { name: string; tags?: string | null; movementPattern?: string | null },
  slugs: string[]
): number {
  const pattern = lower(ex.movementPattern);
  if (!pattern) return 0;
  const hints = primarySwapHintsFor(slugs).filter((h) => lower(h.pattern) === pattern);
  if (hints.length === 0) return 0;
  const name = normalizeString(ex.name);
  const tags = normalizeString(ex.tags ?? "");
  let score = 0;
  for (const hint of hints) {
    for (const h of hint.preferNameHints) {
      if (name.includes(normalizeString(h))) score += 3;
    }
    for (const t of hint.preferTags) {
      if (tags.includes(normalizeString(t))) score += 2;
    }
    for (const h of hint.avoidNameHints) {
      if (name.includes(normalizeString(h))) score -= 4;
    }
  }
  return score;
}

function lower(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim().toLowerCase();
}

function isFail(v: unknown): boolean {
  const s = lower(v);
  return s === "fail" || s === "poor" || s === "limited" || s === "yes" || s === "true";
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function findAssessment(
  assessments: AssessmentContextRow[],
  ...slugs: string[]
): AssessmentContextRow | undefined {
  return assessments.find((a) => {
    const s = (a.templateSlug || "").toLowerCase();
    return slugs.some((want) => s === want || s.includes(want));
  });
}

export function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeBmi(
  heightCm: number | null | undefined,
  weightKg: number | null | undefined
): number | null {
  if (!heightCm || !weightKg || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function computeWhr(
  waistCm: number | null | undefined,
  hipsCm: number | null | undefined
): number | null {
  if (!waistCm || !hipsCm || hipsCm <= 0) return null;
  return waistCm / hipsCm;
}

export function measurementsFromRow(row: {
  heightCm?: number | null;
  weightKg?: number | null;
  bodyFatPct?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
}): ClientMeasurementsContext {
  const heightCm = row.heightCm ?? null;
  const weightKg = row.weightKg ?? null;
  const waistCm = row.waistCm ?? null;
  const hipsCm = row.hipsCm ?? null;
  return {
    heightCm,
    weightKg,
    bodyFatPct: row.bodyFatPct ?? null,
    bmi: computeBmi(heightCm, weightKg),
    waistCm,
    hipsCm,
    waistToHipRatio: computeWhr(waistCm, hipsCm),
  };
}

export function evaluateDeficiencyRules(
  ctx: ClientEvaluationContext
): DetectedDeficiency[] {
  const deficiencies: DetectedDeficiency[] = [];
  const assessments = ctx.assessments ?? [];
  const measurements = ctx.measurements ?? null;
  const textBody = normalizeString(
    `${ctx.client.injuriesText ?? ""} ${ctx.client.contraindicationsText ?? ""} ${ctx.client.medicalHistoryText ?? ""}`
  );

  const backScratch = findAssessment(
    assessments,
    "back-scratch",
    "apley-back-scratch"
  );
  const posture = findAssessment(assessments, "posture-static");
  const seated = findAssessment(assessments, "seated-posture-screen");
  const wallAngel = findAssessment(assessments, "wall-angel-screen");
  const ohs = findAssessment(assessments, "overhead-squat", "ohs");
  const ankleDf = findAssessment(assessments, "ankle-df-wall");
  const sls = findAssessment(assessments, "single-leg-stance");
  const hinge = findAssessment(assessments, "hip-hinge-screen");
  const pushup = findAssessment(assessments, "pushup-screen");
  const slBridge = findAssessment(assessments, "single-leg-glute-bridge");

  const hasShoulderText =
    /shoulder|impingement|rotator cuff|thoracic/.test(textBody);
  const backFail =
    !!backScratch &&
    (isFail(backScratch.results.left_pass) ||
      isFail(backScratch.results.right_pass) ||
      (num(backScratch.results.left_over) != null &&
        num(backScratch.results.left_over)! > 2) ||
      (num(backScratch.results.right_over) != null &&
        num(backScratch.results.right_over)! > 2));
  const postureUpper =
    (posture &&
      (lower(posture.results.head) === "forward" ||
        lower(posture.results.shoulders) === "rounded")) ||
    (seated &&
      (lower(seated.results.head) === "forward" ||
        lower(seated.results.shoulders) === "rounded"));
  const wallFail = wallAngel && isFail(wallAngel.results.result);
  const armsFall = ohs && isFail(ohs.results.arms_fall);
  const scapWing = pushup && isFail(pushup.results.scap_wing);

  if (
    backFail ||
    postureUpper ||
    wallFail ||
    armsFall ||
    scapWing ||
    hasShoulderText
  ) {
    deficiencies.push({
      slug: "upper_cross_syndrome",
      name: "Upper Cross Syndrome",
      category: "postural",
      severity: hasShoulderText ? "severe" : "moderate",
      affectedSide: "bilateral",
      source: backScratch || posture || wallAngel || ohs ? "assessment" : "history",
      triggerDescription:
        "Shoulder/T-spine screen fail, rounded/forward posture, or reported shoulder history.",
      identifiedAt: new Date(),
    });
  }

  const forwardHead =
    (posture && lower(posture.results.head) === "forward") ||
    (seated && lower(seated.results.head) === "forward");
  if (
    forwardHead &&
    !deficiencies.some((d) => d.slug === "upper_cross_syndrome")
  ) {
    deficiencies.push({
      slug: "forward_head_posture",
      name: "Forward Head Posture",
      category: "postural",
      severity: "mild",
      affectedSide: "bilateral",
      source: "assessment",
      triggerDescription: "Forward head on standing or seated posture screen.",
      identifiedAt: new Date(),
    });
  }

  const hasLumbarText = /lumbar|lower back|pelvis|hip flexor/.test(textBody);
  const ohsLcs =
    ohs &&
    (isFail(ohs.results.lumbar_arch) || isFail(ohs.results.excessive_lean));
  const apt = posture && lower(posture.results.pelvis) === "anterior_tilt";
  const ribFlare = seated && lower(seated.results.trunk_stack) === "rib_flare";
  const hingeFlex = hinge && isFail(hinge.results.lumbar_flex);
  const sag = pushup && isFail(pushup.results.lumbar_sag);
  const bridgePoor =
    slBridge &&
    (isFail(slBridge.results.left_quality) ||
      isFail(slBridge.results.right_quality));

  if (ohsLcs || apt || ribFlare || hingeFlex || sag || bridgePoor || hasLumbarText) {
    deficiencies.push({
      slug: "lower_cross_syndrome",
      name: "Lower Cross Syndrome",
      category: "postural",
      severity: hasLumbarText ? "severe" : "moderate",
      affectedSide: "bilateral",
      source: ohs || posture || hinge || slBridge ? "assessment" : "history",
      triggerDescription:
        "Anterior tilt / lumbar arch / sag, or lumbar–hip history.",
      identifiedAt: new Date(),
    });
  }

  const ankleRes = ankleDf?.results;
  const leftCm = num(ankleRes?.left_cm);
  const rightCm = num(ankleRes?.right_cm);
  const leftRestricted = leftCm != null && leftCm < 8;
  const rightRestricted = rightCm != null && rightCm < 8;
  const heelsRise = ohs && isFail(ohs.results.heels);
  const heelLift = ankleDf && isFail(ankleDf.results.heel_lift);
  const hasAnkleText = /ankle|achilles|calf|dorsiflexion/.test(textBody);

  if (leftRestricted || rightRestricted || heelsRise || heelLift || hasAnkleText) {
    deficiencies.push({
      slug: "ankle_mobility_restriction",
      name: "Ankle Dorsiflexion Restriction",
      category: "mobility",
      severity:
        (leftCm != null && leftCm < 5) || (rightCm != null && rightCm < 5)
          ? "severe"
          : "moderate",
      affectedSide:
        leftRestricted && rightRestricted
          ? "bilateral"
          : leftRestricted
            ? "left"
            : rightRestricted
              ? "right"
              : "bilateral",
      source: ankleDf || ohs ? "assessment" : "history",
      triggerDescription:
        "Knee-to-wall DF < 8 cm, heel lift, or OHS heels rise.",
      identifiedAt: new Date(),
    });
  }

  const valgus =
    (ohs && isFail(ohs.results.valgus)) ||
    (sls && isFail(sls.results.hip_drop)) ||
    /valgus|knee collapse|patellofemoral/.test(textBody);
  if (valgus) {
    deficiencies.push({
      slug: "knee_valgus_collapse",
      name: "Knee Valgus Collapse",
      category: "motor_control",
      severity: "moderate",
      affectedSide: "bilateral",
      source: ohs || sls ? "assessment" : "history",
      triggerDescription: "OHS valgus or single-leg hip drop / valgus history.",
      identifiedAt: new Date(),
    });
  }

  if (measurements && (measurements.heightCm || measurements.bmi)) {
    const bmi =
      measurements.bmi ??
      computeBmi(measurements.heightCm, measurements.weightKg);
    const whr = measurements.waistToHipRatio;
    const sex = lower(ctx.client.sex);
    const whrThreshold = sex === "female" ? 0.85 : 0.95;
    if ((bmi != null && bmi >= 30) || (whr != null && whr >= whrThreshold)) {
      deficiencies.push({
        slug: "high_bmi_joint_stress",
        name: "High BMI & Joint Loading Risk",
        category: "joint_stress",
        severity: bmi != null && bmi >= 35 ? "severe" : "moderate",
        affectedSide: "bilateral",
        source: "measurement",
        triggerDescription: `BMI ${bmi != null ? bmi.toFixed(1) : "n/a"} or WHR ${whr != null ? whr.toFixed(2) : "n/a"}.`,
        identifiedAt: new Date(),
      });
    }
    const waistLimit = sex === "female" ? 88 : 102;
    if (
      (whr != null && whr >= whrThreshold) ||
      (measurements.waistCm != null && measurements.waistCm > waistLimit)
    ) {
      deficiencies.push({
        slug: "abdominal_adiposity_core_restriction",
        name: "Abdominal Adiposity & Core Restriction",
        category: "mobility",
        severity: "moderate",
        affectedSide: "bilateral",
        source: "measurement",
        triggerDescription: "Elevated waist or WHR — anti-rotation core bias.",
        identifiedAt: new Date(),
      });
    }
  }

  const seen = new Set<string>();
  return deficiencies.filter((d) => {
    if (seen.has(d.slug)) return false;
    seen.add(d.slug);
    return true;
  });
}

export function determineMesocyclePhase(
  detectedDeficiencies: DetectedDeficiency[],
  goal: string
): MesocyclePhase {
  if (detectedDeficiencies.length > 0) return "corrective_prep";
  switch (goal) {
    case "hypertrophy":
      return "hypertrophy";
    case "strength":
      return "strength_build";
    default:
      return "general_prep";
  }
}

export function evaluateClientRules(
  ctx: ClientEvaluationContext,
  goal = "general"
): RuleEngineEvaluationResult {
  const deficiencies = evaluateDeficiencyRules(ctx);
  const mesocyclePhase = determineMesocyclePhase(deficiencies, goal);
  const rulesFired = deficiencies.map(
    (d) => `${d.slug}:${d.severity}:${d.source}`
  );
  return {
    deficiencies,
    mesocyclePhase,
    rulesFired,
    blockedExerciseIds: [],
  };
}

export function enforceHardSafetyGates<T extends GateExercise>(
  candidates: T[],
  ctx: ClientEvaluationContext
): T[] {
  const forbiddenKeywords = new Set<string>();
  const textBody = normalizeString(
    `${ctx.client.injuriesText ?? ""} ${ctx.client.contraindicationsText ?? ""} ${ctx.client.medicalHistoryText ?? ""}`
  );
  const detectedSlugs = new Set(
    (ctx.detectedDeficiencies ?? []).map((d) => normalizeString(d.slug))
  );

  const hasUcs =
    detectedSlugs.has("upper cross syndrome") ||
    /shoulder|rotator cuff|impingement/.test(textBody);
  const hasLcs =
    detectedSlugs.has("lower cross syndrome") ||
    /lumbar|herniated disc|spondylolisthesis/.test(textBody);
  const hasKnee =
    detectedSlugs.has("knee valgus collapse") ||
    /knee|acl|meniscus/.test(textBody);
  const hasNeck =
    detectedSlugs.has("forward head posture") ||
    /cervical|\bneck\b/.test(textBody);
  const hasBmi = detectedSlugs.has("high bmi joint stress");
  const hasCore = detectedSlugs.has("abdominal adiposity core restriction");

  if (hasUcs) {
    for (const k of [
      "behind the neck",
      "behind neck",
      "upright row",
      "french press",
      "behind neck pulldown",
    ]) {
      forbiddenKeywords.add(k);
    }
  }
  if (hasLcs) {
    for (const k of [
      "good morning",
      "jefferson curl",
      "stiff leg deadlift",
      "stiff leg",
      "straight leg deadlift",
    ]) {
      forbiddenKeywords.add(k);
    }
  }
  if (hasKnee) {
    for (const k of ["sissy squat", "deep leg extension"]) {
      forbiddenKeywords.add(k);
    }
  }
  if (hasNeck) {
    for (const k of ["behind neck press", "heavy barbell shrug"]) {
      forbiddenKeywords.add(k);
    }
  }
  if (hasBmi) {
    for (const k of ["box jump", "depth jump", "kipping"]) {
      forbiddenKeywords.add(k);
    }
  }
  if (hasCore) {
    for (const k of ["sit up", "situp", "crunch", "v up"]) {
      forbiddenKeywords.add(k);
    }
  }

  return candidates.filter((ex) => {
    const normName = normalizeString(ex.name);
    for (const kw of forbiddenKeywords) {
      if (normName.includes(kw)) return false;
    }
    const contra = ex.contraindications;
    if (Array.isArray(contra)) {
      for (const rawKey of contra) {
        const normKey = normalizeString(rawKey);
        if (!normKey) continue;
        if (textBody.includes(normKey) || detectedSlugs.has(normKey)) {
          return false;
        }
      }
    }
    return true;
  });
}

export function filterExercisesByEquipment<T extends GateExercise>(
  candidates: T[],
  availableEquipmentIds: string[] | undefined
): T[] {
  if (!availableEquipmentIds || availableEquipmentIds.length === 0) {
    return candidates;
  }
  const have = new Set(availableEquipmentIds);
  return candidates.filter((ex) => {
    const ids = ex.equipmentIds ?? [];
    if (!ids.length) return true;
    if (ex.equipmentAny) return ids.some((id) => have.has(id));
    return ids.every((id) => have.has(id));
  });
}

export function secondaryPatternsFor(primary: string): string[] {
  return SECONDARY_PATTERN_MATRIX[primary] ?? [];
}

function scoreCorrectiveCandidate(
  ex: GateExercise,
  slug: string
): number {
  const hints = CORRECTIVE_HINTS[slug];
  if (!hints) return 0;
  const name = lower(ex.name);
  const tags = lower(ex.tags);
  let s = 0;
  for (const h of hints.nameHints) {
    if (name.includes(h)) s += 4;
  }
  for (const t of hints.tags) {
    if (tags.includes(t) || name.includes(t)) s += 2;
  }
  return s;
}

export function getCorrectiveCandidatesForSlug<T extends GateExercise>(
  slug: string,
  pool: T[],
  ctx: ClientEvaluationContext,
  mappingRanks?: Map<string, number>
): T[] {
  const gated = enforceHardSafetyGates(pool, ctx);
  const hasMap = mappingRanks && mappingRanks.size > 0;
  const scored = gated
    .map((ex) => {
      const mapped = mappingRanks?.get(ex.id);
      const hint = scoreCorrectiveCandidate(ex, slug);
      const score = hasMap
        ? mapped != null
          ? 1000 - mapped
          : hint
        : hint;
      return { ex, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.map((x) => x.ex);
}

export function prioritizeAndRotateCorrectives(
  deficiencies: DetectedDeficiency[],
  daysPerWeek: number,
  ctx: ClientEvaluationContext,
  pool: GateExercise[],
  mappingsBySlug?: Map<string, Map<string, number>>
): Map<number, PrescribedCorrective[]> {
  const severityScore: Record<DeficiencySeverity, number> = {
    severe: 3,
    moderate: 2,
    mild: 1,
  };
  const sorted = [...deficiencies].sort((a, b) => {
    if (severityScore[b.severity] !== severityScore[a.severity]) {
      return severityScore[b.severity] - severityScore[a.severity];
    }
    return (b.identifiedAt?.getTime() ?? 0) - (a.identifiedAt?.getTime() ?? 0);
  });

  const daily = new Map<number, PrescribedCorrective[]>();
  if (sorted.length === 0 || daysPerWeek <= 0) return daily;

  for (let day = 1; day <= daysPerWeek; day++) {
    const startIndex = ((day - 1) * 2) % sorted.length;
    const picks = [
      sorted[startIndex % sorted.length],
      sorted[(startIndex + 1) % sorted.length],
    ].filter(Boolean);
    const unique: DetectedDeficiency[] = [];
    const seen = new Set<string>();
    for (const d of picks) {
      if (seen.has(d.slug)) continue;
      seen.add(d.slug);
      unique.push(d);
    }

    const dayCorrectives: PrescribedCorrective[] = [];
    const usedIds = new Set<string>();
    for (const def of unique) {
      const candidates = getCorrectiveCandidatesForSlug(
        def.slug,
        pool,
        ctx,
        mappingsBySlug?.get(def.slug)
      ).filter((c) => !usedIds.has(c.id));
      const selected = candidates[0];
      if (!selected) continue; // do not push a nameless primer
      usedIds.add(selected.id);
      dayCorrectives.push({
        deficiencySlug: def.slug,
        placement: "warmup",
        exerciseId: selected.id,
        exerciseName: selected.name,
        movementPattern: selected.movementPattern || "mobility",
        sets: 2,
        reps: "10-12",
        rpe: "5-6",
        restSec: 45,
        rationale: `Mesocycle 1 corrective for ${def.name} (${def.severity}). ${def.triggerDescription}`,
      });
    }
    daily.set(day, dayCorrectives.slice(0, 2));
  }
  return daily;
}

export function isInsufficientSafeExercisesError(
  err: unknown
): err is InsufficientSafeExercisesError {
  return (
    err instanceof InsufficientSafeExercisesError ||
    (typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "insufficient_safe_exercises")
  );
}
