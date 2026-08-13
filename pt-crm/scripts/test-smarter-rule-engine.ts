/**
 * Pure smarter-rule-engine contracts (no DB).
 * Run: npx tsx scripts/test-smarter-rule-engine.ts
 */
import { resolveAvailableEquipmentIds } from "../src/lib/client-equipment";
import {
  determineMesocyclePhase,
  enforceHardSafetyGates,
  evaluateClientRules,
  evaluateDeficiencyRules,
  measurementsFromRow,
  normalizeString,
  prioritizeAndRotateCorrectives,
  primarySwapHintsFor,
  scoreExerciseForPrimarySwaps,
  secondaryPatternsFor,
} from "../src/lib/smarter-rule-engine";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Real keys, not plan sample keys
const defs = evaluateDeficiencyRules({
  client: {
    injuriesText: "",
    contraindicationsText: "",
    medicalHistoryText: "",
    sex: "male",
  },
  measurements: measurementsFromRow({
    heightCm: 175,
    weightKg: 110,
    waistCm: 110,
    hipsCm: 100,
  }),
  assessments: [
    {
      templateSlug: "back-scratch",
      results: { left_pass: "fail", right_pass: "pass", left_over: 6 },
    },
    {
      templateSlug: "overhead-squat",
      results: {
        heels: "fail",
        valgus: "fail",
        lumbar_arch: "fail",
        excessive_lean: "pass",
      },
    },
    {
      templateSlug: "posture-static",
      results: { head: "forward", shoulders: "rounded", pelvis: "anterior_tilt" },
    },
    {
      templateSlug: "ankle-df-wall",
      results: { left_cm: 4, right_cm: 9 },
    },
  ],
});

const slugs = defs.map((d) => d.slug);
assert(slugs.includes("upper_cross_syndrome"), "UCS from back-scratch + posture");
assert(slugs.includes("lower_cross_syndrome"), "LCS from lumbar_arch + APT");
assert(slugs.includes("ankle_mobility_restriction"), "ankle from left_cm + heels");
assert(slugs.includes("knee_valgus_collapse"), "valgus from OHS");
assert(slugs.includes("high_bmi_joint_stress"), "BMI >= 30");
assert(!slugs.includes("forward_head_posture"), "FHP skipped when UCS present");

const zero = evaluateDeficiencyRules({
  client: {
    injuriesText: "",
    contraindicationsText: "",
    medicalHistoryText: "",
  },
  measurements: null,
  assessments: [],
});
assert(zero.length === 0, "no false positives");
assert(determineMesocyclePhase(zero, "hypertrophy") === "hypertrophy", "0-def goal phase");
assert(determineMesocyclePhase(defs, "hypertrophy") === "corrective_prep", "defs force corrective");

assert(normalizeString("behind_the-neck!") === "behind the neck", "normalize");

const gated = enforceHardSafetyGates(
  [
    { id: "1", name: "Behind-the-Neck Pulldown" },
    { id: "2", name: "Neutral Grip Lat Pulldown" },
    { id: "3", name: "Jefferson Curl" },
  ],
  {
    client: {
      injuriesText: "shoulder impingement",
      contraindicationsText: "",
      medicalHistoryText: "",
    },
    measurements: null,
    assessments: [],
    detectedDeficiencies: [
      { slug: "upper_cross_syndrome", name: "UCS", severity: "moderate" },
      { slug: "lower_cross_syndrome", name: "LCS", severity: "moderate" },
    ],
  }
);
assert(
  gated.every((e) => e.id !== "1" && e.id !== "3"),
  "hard gates block behind-neck + jefferson"
);
assert(gated.some((e) => e.id === "2"), "safe pulldown remains");

const rotated = prioritizeAndRotateCorrectives(
  defs,
  3,
  {
    client: {
      injuriesText: "",
      contraindicationsText: "",
      medicalHistoryText: "",
    },
    measurements: null,
    assessments: [],
    detectedDeficiencies: defs.map((d) => ({
      slug: d.slug,
      name: d.name,
      severity: d.severity,
    })),
  },
  [
    { id: "fp", name: "Band Face Pulls", tags: "shoulder,scapula", movementPattern: "mobility" },
    { id: "gb", name: "Glute Bridge", tags: "glute,hip", movementPattern: "hinge" },
    { id: "ank", name: "Knee-to-Wall Ankle Mobilization", tags: "ankle,mobility", movementPattern: "mobility" },
  ]
);
assert(rotated.get(1)!.length <= 2, "cap 2/day");
assert((secondaryPatternsFor("squat") || []).includes("hinge"), "secondary matrix");

const ankleSlugs = ["ankle_mobility_restriction"];
assert(
  scoreExerciseForPrimarySwaps(
    { name: "Goblet Squat", movementPattern: "squat" },
    ankleSlugs
  ) >
    scoreExerciseForPrimarySwaps(
      { name: "Barbell Back Squat", movementPattern: "squat" },
      ankleSlugs
    ),
  "goblet squat preferred over barbell back squat for ankle DF"
);
const ucsSlugs = ["upper_cross_syndrome"];
assert(
  scoreExerciseForPrimarySwaps(
    { name: "Landmine Press", movementPattern: "vertical_push" },
    ucsSlugs
  ) >
    scoreExerciseForPrimarySwaps(
      { name: "Standing Barbell Overhead Press", movementPattern: "vertical_push" },
      ucsSlugs
    ),
  "landmine press preferred over standing barbell overhead press for UCS"
);
const adipositySlugs = ["abdominal_adiposity_core_restriction"];
assert(
  scoreExerciseForPrimarySwaps(
    { name: "Pallof Press", movementPattern: "core" },
    adipositySlugs
  ) >
    scoreExerciseForPrimarySwaps(
      { name: "Sit-Up", movementPattern: "core" },
      adipositySlugs
    ),
  "pallof preferred over sit-up for abdominal adiposity"
);
assert(
  primarySwapHintsFor(["upper_cross_syndrome"]).some((h) => h.pattern === "vertical_push"),
  "UCS swap hints include vertical_push"
);

const evalRes = evaluateClientRules(
  {
    client: {
      injuriesText: "",
      contraindicationsText: "",
      medicalHistoryText: "",
    },
    measurements: null,
    assessments: [],
  },
  "general"
);
assert(evalRes.mesocyclePhase === "general_prep", "empty eval general_prep");

assert(
  resolveAvailableEquipmentIds({
    mode: "combined",
    orgIds: ["a", "b"],
    clientIds: ["b", "c"],
  }).join(",") === "b",
  "combined intersection"
);
assert(
  resolveAvailableEquipmentIds({
    mode: "client",
    orgIds: ["a"],
    clientIds: [],
  }).join(",") === "a",
  "empty home falls back to org"
);

console.log("smarter-rule-engine contracts ok", { slugs, phase: determineMesocyclePhase(defs, "general") });
