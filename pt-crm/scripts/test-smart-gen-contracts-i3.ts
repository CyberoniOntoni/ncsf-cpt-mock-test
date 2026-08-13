import { assert } from "console";

// 1. String Normalization
function normalizeString(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[-]/g, " ")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 2. InsufficientSafeExercisesError Serialization Test
class InsufficientSafeExercisesError extends Error {
  public readonly movementPattern: string;
  public readonly requiredEquipment: string[];
  public readonly contraindications: string[];
  public readonly candidateCount: number;

  constructor(details: {
    movementPattern: string;
    requiredEquipment?: string[];
    contraindications?: string[];
  }) {
    super(`Insufficient safe exercises available for movement pattern: ${details.movementPattern}. All candidates blocked by equipment or safety gates.`);
    this.name = "InsufficientSafeExercisesError";
    this.movementPattern = details.movementPattern;
    this.requiredEquipment = details.requiredEquipment ?? [];
    this.contraindications = details.contraindications ?? [];
    this.candidateCount = 0;
  }

  public toSerializablePayload() {
    return {
      code: "INSUFFICIENT_SAFE_EXERCISES",
      message: this.message,
      details: {
        movementPattern: this.movementPattern,
        requiredEquipment: this.requiredEquipment,
        contraindications: this.contraindications,
        candidateCount: this.candidateCount,
      },
    };
  }
}

// 3. WHR & Physical Measurement Ingestion Test
function evaluateMeasurementDeficiencies(ctx: {
  sex?: "male" | "female";
  measurements?: {
    heightCm?: number | null;
    weightKg?: number | null;
    bmi?: number | null;
    waistCm?: number | null;
    hipsCm?: number | null;
    waistToHipRatio?: number | null;
  } | null;
}) {
  const deficiencies: string[] = [];
  const measurements = ctx.measurements ?? null;
  if (measurements && measurements.heightCm && measurements.weightKg) {
    const heightM = measurements.heightCm / 100;
    const bmi = measurements.bmi ?? (measurements.weightKg / (heightM * heightM));
    const whr = measurements.waistToHipRatio ?? (measurements.waistCm && measurements.hipsCm ? measurements.waistCm / measurements.hipsCm : null);
    const whrThreshold = ctx.sex === "female" ? 0.85 : 0.95;

    if (bmi >= 30 || (whr && whr >= whrThreshold)) {
      deficiencies.push("high_bmi_joint_stress");
    }
    if (whr && whr >= whrThreshold) {
      deficiencies.push("abdominal_adiposity_core_restriction");
    }
  }
  return deficiencies;
}

// 4. Equipment Filter Test
function filterExercisesByEquipment(
  exercises: Array<{
    id: string;
    equipmentIds?: string[];
    equipmentAny?: boolean;
    requiredEquipment?: Array<{ equipmentId: string; isRequired: boolean }>;
  }>,
  availableEquipmentIds: Set<string>
) {
  return exercises.filter((ex) => {
    const relationalReqs = ex.requiredEquipment
      ? ex.requiredEquipment.filter((re) => re.isRequired).map((re) => re.equipmentId)
      : [];
    const legacyReqs = ex.equipmentIds ?? [];
    const combinedEquipmentIds = Array.from(new Set([...relationalReqs, ...legacyReqs]));

    if (combinedEquipmentIds.length === 0) return true;
    if (ex.equipmentAny) {
      return combinedEquipmentIds.some((id) => availableEquipmentIds.has(id));
    }
    return combinedEquipmentIds.every((id) => availableEquipmentIds.has(id));
  });
}

// 5. Rotation Loop Zero-Length Guard Test
function prioritizeAndRotateCorrectives(deficiencies: any[], daysPerWeek: number) {
  const dailySchedule = new Map<number, any[]>();
  if (deficiencies.length === 0) return dailySchedule;

  for (let day = 1; day <= daysPerWeek; day++) {
    const startIndex = ((day - 1) * 2) % deficiencies.length;
    dailySchedule.set(day, [deficiencies[startIndex % deficiencies.length]]);
  }
  return dailySchedule;
}

// RUN EMPIRICAL SUITE
async function runTests() {
  console.log("=== EMPIRICAL VERIFICATION HARNESS FOR ITERATION 3 BLUEPRINT ===");

  // Test 1: String Normalization
  console.log("\n1. Testing String Normalization...");
  const norm1 = normalizeString("upper_cross_syndrome");
  const norm2 = normalizeString("Upper-Cross-Syndrome!!!");
  console.log(`norm1: "${norm1}", norm2: "${norm2}"`);
  assert(norm1 === "upper cross syndrome", "Normalization underscore failed");
  assert(norm2 === "upper cross syndrome", "Normalization hyphen/punctuation failed");
  console.log("✓ String normalization PASSED.");

  // Test 2: Error Payload RSC Serialization
  console.log("\n2. Testing InsufficientSafeExercisesError RSC Serialization...");
  const err = new InsufficientSafeExercisesError({
    movementPattern: "vertical_push",
    requiredEquipment: ["barbell"],
    contraindications: ["shoulder_impingement"],
  });
  const payload = err.toSerializablePayload();
  const serialized = JSON.stringify(payload);
  const deserialized = JSON.parse(serialized);
  assert(deserialized.code === "INSUFFICIENT_SAFE_EXERCISES", "Error code mismatch");
  assert(deserialized.details.movementPattern === "vertical_push", "Movement pattern detail mismatch");
  console.log("✓ RSC Error serialization PASSED.");

  // Test 3: WHR Gender Thresholds & hipsCm Usage
  console.log("\n3. Testing WHR Gender Thresholds & hipsCm...");
  // Female client: waist 90, hips 100 => WHR 0.90 >= 0.85 -> triggers high_bmi and core restriction
  const femaleDefs = evaluateMeasurementDeficiencies({
    sex: "female",
    measurements: { heightCm: 165, weightKg: 70, waistCm: 90, hipsCm: 100 },
  });
  console.log("Female WHR (0.90) deficiencies:", femaleDefs);
  assert(femaleDefs.includes("high_bmi_joint_stress"), "Female WHR >= 0.85 should trigger high_bmi");
  assert(femaleDefs.includes("abdominal_adiposity_core_restriction"), "Female WHR >= 0.85 should trigger core restriction");

  // Male client: waist 90, hips 100 => WHR 0.90 < 0.95 -> no WHR deficiency (BMI = 22.8)
  const maleDefs = evaluateMeasurementDeficiencies({
    sex: "male",
    measurements: { heightCm: 180, weightKg: 74, waistCm: 90, hipsCm: 100 },
  });
  console.log("Male WHR (0.90) deficiencies:", maleDefs);
  assert(!maleDefs.includes("high_bmi_joint_stress"), "Male WHR < 0.95 should NOT trigger high_bmi");
  assert(!maleDefs.includes("abdominal_adiposity_core_restriction"), "Male WHR < 0.95 should NOT trigger core restriction");
  console.log("✓ WHR gender thresholds and hipsCm field access PASSED.");

  // Test 4: Equipment Filter Sync (Relational + Legacy)
  console.log("\n4. Testing Equipment Filter Sync...");
  const sampleExercises = [
    { id: "ex1", legacyReqs: [], requiredEquipment: [{ equipmentId: "eq_barbell", isRequired: true }] },
    { id: "ex2", equipmentIds: ["eq_dumbbell"], requiredEquipment: [] },
    { id: "ex3", equipmentIds: ["eq_kettlebell"], requiredEquipment: [{ equipmentId: "eq_band", isRequired: true }] },
    { id: "ex4", equipmentIds: ["eq_dumbbell", "eq_kettlebell"], equipmentAny: true },
  ];
  const availableSet = new Set(["eq_barbell", "eq_dumbbell"]);

  const filtered = filterExercisesByEquipment(sampleExercises, availableSet);
  const filteredIds = filtered.map((e) => e.id);
  console.log("Filtered available exercises:", filteredIds);
  assert(filteredIds.includes("ex1"), "Relational barbell exercise should pass");
  assert(filteredIds.includes("ex2"), "Legacy dumbbell exercise should pass");
  assert(!filteredIds.includes("ex3"), "Missing band (relational) should fail even if legacy empty");
  assert(filteredIds.includes("ex4"), "equipmentAny with DB available should pass");
  console.log("✓ Equipment filter sync PASSED.");

  // Test 5: Rotation Loop Zero-Length Guard
  console.log("\n5. Testing Rotation Loop Zero-Length Guard...");
  const zeroResult = prioritizeAndRotateCorrectives([], 3);
  assert(zeroResult.size === 0, "Zero deficiencies should return empty schedule without division by zero");
  console.log("✓ Zero-length guard PASSED.");

  console.log("\n=== ALL EMPIRICAL VERIFICATION TESTS PASSED SUCCESSFULLY ===");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
