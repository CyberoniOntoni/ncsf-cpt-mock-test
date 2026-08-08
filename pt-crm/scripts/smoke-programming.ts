/**
 * Lane B programming brain smoke — pure libs only (no DB / Next server).
 * Run: npx tsx scripts/smoke-programming.ts
 */

import { buildConstraintProfile } from "../src/lib/program-constraints";
import {
  rankSubstitutions,
  type ExerciseLike,
} from "../src/lib/exercise-substitutions";
import {
  applyMesocycleToPrescription,
  getMesocycleWeek,
  nextMesocycleWeek,
  stripMesocycleNotes,
  suggestMesocycleWeekFromStartDate,
} from "../src/lib/mesocycle";
import { correctivesFromAssessmentResults } from "../src/lib/assessment-correctives";
import {
  accumulateVolumeByPattern,
  sessionsToAdvanceMesocycle,
  shouldAutoAdvanceMesocycle,
} from "../src/lib/program-volume";
import {
  nextProgramExerciseSortOrder,
  defaultAddExerciseRx,
  rankBankByNameQuery,
  rxFromSessionSetLogs,
  canPromoteSessionLogToProgram,
} from "../src/lib/program-exercise-add";
import {
  analyzeProgramPlan,
  bandForSets,
  defaultRxForGoal,
  estimateDayMinutes,
  planBalanceSummaryLine,
  recommendedRestSec,
  sessionOrderHints,
  suggestFillPatterns,
  weeklySetBand,
} from "../src/lib/program-science";
import {
  antagonistPatterns,
  patternScienceBlurb,
  resolveExerciseCues,
  sortPatternsForUi,
} from "../src/lib/exercise-meta";
import { suggestProgression } from "../src/lib/progression";
import { detectIntent } from "../src/lib/ai/intents";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function ex(
  partial: Partial<ExerciseLike> & Pick<ExerciseLike, "id" | "name" | "movementPattern">
): ExerciseLike {
  return {
    tags: "",
    difficulty: "intermediate",
    available: true,
    equipmentNames: [],
    cues: null,
    primaryMuscles: "",
    ...partial,
  };
}

function main() {
  // 1) Constraint profile: "left shoulder pain" → shoulder flag
  const profile = buildConstraintProfile({
    injuries: "left shoulder pain",
  });
  assert(
    profile.injuryFlags.includes("shoulder"),
    `expected shoulder flag, got [${profile.injuryFlags.join(", ")}]`
  );
  console.log("ok buildConstraintProfile shoulder flag", profile.injuryFlags);

  // 2) rankSubstitutions prefers same movement pattern
  const current = ex({
    id: "bb-bench",
    name: "Barbell Bench Press",
    movementPattern: "horizontal_push",
    tags: "chest,push",
    primaryMuscles: "pectoralis major",
  });
  const pool: ExerciseLike[] = [
    ex({
      id: "db-bench",
      name: "Dumbbell Bench Press",
      movementPattern: "horizontal_push",
      tags: "chest,push",
      primaryMuscles: "pectoralis major",
    }),
    ex({
      id: "lat-pd",
      name: "Lat Pulldown",
      movementPattern: "vertical_pull",
      // Attractive tags/muscles if pattern weren't preferred — still filtered out
      tags: "chest,push,back",
      primaryMuscles: "latissimus dorsi pectoralis",
      difficulty: "beginner",
    }),
    ex({
      id: "pushup",
      name: "Push-Up",
      movementPattern: "horizontal_push",
      tags: "chest,push",
      primaryMuscles: "pectoralis major",
      difficulty: "beginner",
    }),
  ];
  const ranked = rankSubstitutions({ current, pool, limit: 5 });
  assert(ranked.length > 0, "expected at least one substitute");
  for (const c of ranked) {
    assert(
      c.exercise.movementPattern === "horizontal_push",
      `expected same pattern, got ${c.exercise.name} (${c.exercise.movementPattern})`
    );
  }
  assert(
    ranked[0].exercise.movementPattern === current.movementPattern,
    "top substitute should match current pattern"
  );
  console.log(
    "ok rankSubstitutions prefers same pattern",
    ranked.map((c) => c.exercise.name)
  );

  // 3) Mesocycle week 4 is deload
  const w4 = getMesocycleWeek(4);
  assert(w4.isDeload === true, `week 4 should be deload, got isDeload=${w4.isDeload}`);
  assert(w4.week === 4, `week should be 4, got ${w4.week}`);
  console.log("ok getMesocycleWeek(4).isDeload", w4.label, w4.volumeMult);

  // 4) Back-scratch fail → correctives
  const correctives = correctivesFromAssessmentResults({
    templateSlug: "back-scratch",
    results: {
      right_pass: "fail",
      left_pass: "fail",
    },
  });
  assert(
    correctives.length > 0,
    "expected correctives for back-scratch fails"
  );
  console.log(
    "ok correctivesFromAssessmentResults",
    correctives.map((c) => c.id)
  );

  // 5) Deload reduces sets
  const base = { sets: 4, reps: "8-10", rpe: "8", restSec: 90 };
  const deloadRx = applyMesocycleToPrescription(base, w4);
  assert(
    deloadRx.sets < base.sets,
    `deload should reduce sets: ${base.sets} → ${deloadRx.sets}`
  );
  assert(deloadRx.sets >= 1, "deload sets min 1");
  assert(deloadRx.note === "Deload week", `note should be Deload week, got ${deloadRx.note}`);
  console.log(
    "ok applyMesocycleToPrescription deload",
    `${base.sets} sets → ${deloadRx.sets} sets, rpe ${base.rpe} → ${deloadRx.rpe}`
  );

  // 6) Re-apply from same baseline must not compound
  const again = applyMesocycleToPrescription(base, w4);
  assert(
    again.sets === deloadRx.sets,
    `re-apply from baseline should match: ${again.sets} vs ${deloadRx.sets}`
  );
  console.log("ok mesocycle re-apply stable from baseline");

  // 7) next week wraps
  assert(nextMesocycleWeek(6) === 1, "week 6 next → 1");
  assert(nextMesocycleWeek(3) === 4, "week 3 next → 4");
  console.log("ok nextMesocycleWeek wrap");

  // 8) strip notes
  const stripped = stripMesocycleNotes("Cues here · Deload week · more");
  assert(
    stripped != null && !/deload/i.test(stripped),
    `strip failed: ${stripped}`
  );
  console.log("ok stripMesocycleNotes");

  // 9) calendar week suggestion
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const cal = suggestMesocycleWeekFromStartDate(twoWeeksAgo);
  assert(cal === 3, `14 days ago → W3, got W${cal}`);
  console.log("ok suggestMesocycleWeekFromStartDate", cal);

  // 10) constraint-aware ranking drops overhead for shoulder
  const shoulderProfile = buildConstraintProfile({
    injuries: "rotator cuff irritation",
  });
  const ohp = ex({
    id: "ohp",
    name: "Barbell overhead press",
    movementPattern: "vertical_push",
    tags: "shoulders,push",
    primaryMuscles: "delts",
  });
  const landmine = ex({
    id: "lm",
    name: "Landmine press",
    movementPattern: "vertical_push",
    tags: "shoulders,push,shoulder-friendly",
    primaryMuscles: "delts",
  });
  const rankedConstrained = rankSubstitutions({
    current: ohp,
    pool: [landmine, ohp],
    constraintProfile: shoulderProfile,
    difficultyBias: "easier",
  });
  assert(
    rankedConstrained.length > 0 && rankedConstrained[0].exercise.id === "lm",
    "landmine should rank above self-excluded ohp for shoulder"
  );
  console.log(
    "ok constraint-aware rank",
    rankedConstrained.map((c) => c.exercise.name)
  );

  // B+: volume + auto-advance helpers
  const vol = accumulateVolumeByPattern([
    {
      movementPattern: "squat",
      setLogs: [
        { reps: "8", weightKg: 100, completed: true },
        { reps: "8", weightKg: 100, completed: true },
      ],
    },
    {
      movementPattern: "hinge",
      isWarmup: true,
      setLogs: [{ reps: "10", weightKg: 40, completed: true }],
    },
  ]);
  assert(vol.totalSets === 2, `warmups excluded: sets=${vol.totalSets}`);
  assert(vol.totalVolumeKg === 1600, `volume ${vol.totalVolumeKg}`);
  assert(vol.byPattern[0].pattern === "squat", "squat first by volume");
  console.log("ok accumulateVolumeByPattern", vol.totalVolumeKg);

  assert(sessionsToAdvanceMesocycle(3) === 3, "threshold = days/week");
  assert(
    shouldAutoAdvanceMesocycle({
      completedInWindow: 3,
      threshold: 3,
      sessionsAtLastAdvance: 0,
    }),
    "should advance at 3"
  );
  assert(
    !shouldAutoAdvanceMesocycle({
      completedInWindow: 5,
      threshold: 3,
      sessionsAtLastAdvance: 3,
    }),
    "no advance until +3 more"
  );
  assert(
    shouldAutoAdvanceMesocycle({
      completedInWindow: 6,
      threshold: 3,
      sessionsAtLastAdvance: 3,
    }),
    "advance again at 6"
  );
  console.log("ok shouldAutoAdvanceMesocycle");

  // program-exercise-add pure helpers
  assert(nextProgramExerciseSortOrder([]) === 0, "empty day sort 0");
  assert(nextProgramExerciseSortOrder([0, 1, 4]) === 5, "max+1");
  assert(defaultAddExerciseRx(false).sets === 3, "main sets");
  assert(defaultAddExerciseRx(true).restSec === 45, "warmup rest");
  {
    const rx = rxFromSessionSetLogs(
      [
        { completed: true, reps: "8", rpe: "7" },
        { completed: true, reps: "10", rpe: "8" },
        { completed: false, reps: "12", rpe: "9" },
      ],
      { sets: 3, reps: "8-10", rpe: "7" }
    );
    assert(rx.sets === 2, "rx sets from completed only");
    assert(rx.reps === "10", "rx last completed reps");
    assert(rx.rpe === "8", "rx last completed rpe");
    assert(
      canPromoteSessionLogToProgram({
        programDayId: "day1",
        exerciseId: "ex1",
        alreadyOnDay: false,
      }),
      "promotable"
    );
    assert(
      !canPromoteSessionLogToProgram({
        programDayId: "day1",
        exerciseId: "ex1",
        alreadyOnDay: true,
      }),
      "not promotable if on day"
    );
    assert(
      !canPromoteSessionLogToProgram({
        programDayId: null,
        exerciseId: "ex1",
        alreadyOnDay: false,
      }),
      "not promotable without day"
    );
  }
  {
    const ranked = rankBankByNameQuery(
      [
        { name: "Band Face Pull", available: true },
        { name: "Face Pull", available: true },
        { name: "Cable Row", available: true },
        { name: "Face Pull (DB)", available: false },
      ],
      "face pull"
    );
    assert(ranked[0]?.name === "Face Pull", "startsWith preferred");
    assert(ranked.every((e) => /face pull/i.test(e.name)), "includes only");
  }
  console.log("ok program-exercise-add");

  // detectIntent: append vs correctives anchors
  {
    const append = detectIntent("add face pulls to day 1");
    assert(append.kind === "append_exercise", "add face pulls → append_exercise");
    if (append.kind === "append_exercise") {
      assert(append.dayHint === 1, "dayHint 1");
      assert(
        /face\s*pull/i.test(append.exerciseQuery || ""),
        "exerciseQuery face pulls"
      );
    }
    const broad = detectIntent("add exercise variety");
    assert(
      broad.kind !== "append_exercise",
      "bare 'add exercise variety' must not append"
    );
    const corr = detectIntent("insert correctives");
    assert(corr.kind === "insert_correctives", "insert correctives");
  }
  console.log("ok detectIntent append/correctives");

  // program-science: rest, volume bands, push:pull, order, duration
  {
    const strengthRest = recommendedRestSec({
      goal: "strength",
      pattern: "squat",
      reps: "3-5",
    });
    assert(strengthRest.restSec >= 150, "strength compound rest ≥150s");

    const hypIso = recommendedRestSec({
      goal: "hypertrophy",
      pattern: "core",
      reps: "10-15",
    });
    assert(hypIso.restSec <= 90, "hypertrophy isolation rest ≤90s");

    const strRx = defaultRxForGoal(false, {
      goal: "strength",
      pattern: "hinge",
    });
    assert(
      strRx.reps.includes("3") || strRx.reps.includes("5"),
      "strength low reps"
    );
    assert(strRx.restSec >= 150, "strength rest long");

    // Goal-aware append defaults
    const strAppend = defaultAddExerciseRx(false, {
      goal: "strength",
      pattern: "squat",
    });
    assert(strAppend.restSec >= 150, "append strength rest");
    assert(defaultAddExerciseRx(true).restSec === 45, "warmup rest");

    const hypBand = weeklySetBand("horizontal_pull", "hypertrophy");
    assert(
      !!hypBand && hypBand.low <= 8 && hypBand.high >= 16,
      "hypertrophy pull band"
    );
    assert(bandForSets(4, hypBand) === "low", "4 sets low for hypertrophy pull");
    assert(bandForSets(12, hypBand) === "ok", "12 sets ok");
    assert(bandForSets(30, hypBand) === "high", "30 sets high");

    const analysis = analyzeProgramPlan(
      [
        {
          name: "Day A",
          exercises: [
            {
              sets: 3,
              reps: "5",
              restSec: 180,
              movementPattern: "squat",
              isWarmup: false,
            },
            {
              sets: 3,
              reps: "8",
              restSec: 90,
              movementPattern: "horizontal_push",
              isWarmup: false,
            },
            {
              sets: 2,
              reps: "12",
              restSec: 60,
              movementPattern: "horizontal_pull",
              isWarmup: false,
            },
          ],
        },
        {
          name: "Day B",
          exercises: [
            {
              sets: 4,
              reps: "5",
              restSec: 180,
              movementPattern: "hinge",
              isWarmup: false,
            },
            {
              sets: 3,
              reps: "10",
              restSec: 75,
              movementPattern: "horizontal_pull",
              isWarmup: false,
            },
          ],
        },
      ],
      { goal: "hypertrophy", sessionMinutes: 45 }
    );
    assert(analysis.weeklyWorkingSets === 15, "weekly working sets 15");
    assert(analysis.pullSets === 5, "pull sets 5");
    assert(analysis.pushSets === 3, "push sets 3");
    assert(
      analysis.pushPullRatio != null && analysis.pushPullRatio > 1,
      "pull:push > 1"
    );
    assert(analysis.dayEstimates.length === 2, "two day estimates");
    assert(
      estimateDayMinutes([
        { sets: 5, restSec: 180, movementPattern: "squat" },
        { sets: 5, restSec: 180, movementPattern: "hinge" },
        { sets: 4, restSec: 120, movementPattern: "horizontal_push" },
        { sets: 4, restSec: 90, movementPattern: "horizontal_pull" },
        { sets: 3, restSec: 60, movementPattern: "core" },
      ]) > 40,
      "long day estimate > 40 min"
    );

    const order = sessionOrderHints("Day X", [
      { sets: 3, movementPattern: "core", isWarmup: false },
      { sets: 4, movementPattern: "squat", isWarmup: false },
      { sets: 3, movementPattern: "plyometric", isWarmup: false },
    ]);
    assert(
      order.some((f) => /power|plyo/i.test(f.message)),
      "order flags plyo after compound"
    );

    const fills = suggestFillPatterns(analysis, {
      goal: "hypertrophy",
      limit: 4,
    });
    assert(fills.length >= 1, "fill suggestions non-empty");
    assert(
      planBalanceSummaryLine(analysis).includes("working sets"),
      "summary line"
    );

    assert(
      antagonistPatterns("horizontal_push").includes("horizontal_pull"),
      "push antagonist is pull"
    );
    assert(
      /press|row|shoulder/i.test(patternScienceBlurb("horizontal_push")),
      "pattern science blurb"
    );
    assert(
      sortPatternsForUi(["core", "squat", "mobility"])[0] === "mobility",
      "pattern ui order mobility first"
    );
    assert(
      resolveExerciseCues(null, "hinge").toLowerCase().includes("hip"),
      "default hinge cue"
    );
    assert(
      resolveExerciseCues("Own the brace", "core") === "Own the brace",
      "custom cue wins"
    );

    // Double progression messaging
    const prog = suggestProgression({
      plannedReps: "8-10",
      lastSets: [
        { setIndex: 0, reps: "10", weightKg: 60, rpe: "7", completed: true },
        { setIndex: 1, reps: "10", weightKg: 60, rpe: "7", completed: true },
        { setIndex: 2, reps: "10", weightKg: 60, rpe: "7.5", completed: true },
      ],
    });
    assert(prog?.kind === "load", "double progression load");
    assert(/double progression/i.test(prog?.message || ""), "DP message");

    const holdHard = suggestProgression({
      plannedReps: "5",
      lastSets: [
        { setIndex: 0, reps: "3", weightKg: 100, rpe: "9.5", completed: true },
      ],
    });
    assert(holdHard?.kind === "hold", "high RPE hold");
  }
  console.log("ok program-science");

  console.log("\nLane B programming smoke: ALL PASS");
}

try {
  main();
  process.exit(0);
} catch (e) {
  console.error(e);
  process.exit(1);
}
