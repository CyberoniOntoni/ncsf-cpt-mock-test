import assert from "node:assert/strict";
import {
  clientExerciseCue,
  exercisePhase,
  toClientProgramView,
} from "../src/lib/portal-program";

assert.equal(
  clientExerciseCue(
    "Knees stacked; exhale open. · Mesocycle: W1",
    null
  ),
  "Knees stacked; exhale open."
);
assert.equal(
  clientExerciseCue(
    "Smarter engine: 1 deficiency → Mesocycle 1 corrective_prep.",
    "Count tempo. Don’t rush the pause."
  ),
  "Count tempo. Don’t rush the pause."
);
assert.equal(clientExerciseCue("Mesocycle: W1", null), null);
assert.equal(
  clientExerciseCue(
    "Smarter engine: 1 deficiency → Mesocycle 1 corrective_prep.",
    "Smarter engine: keep this internal."
  ),
  null
);

assert.equal(
  exercisePhase({
    id: "a",
    exerciseName: "Wall slides",
    sets: 2,
    reps: "8",
    rpe: "5",
    restSec: 30,
    notes: null,
    sortOrder: 0,
    isWarmup: true,
    setScheme: "straight",
    setSchemeMeta: { summary: "Warm-up · session ranges" },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
  }),
  "warmup"
);
assert.equal(
  exercisePhase({
    id: "b",
    exerciseName: "Sleeper stretch",
    sets: 2,
    reps: "4 breaths",
    rpe: "2",
    restSec: 20,
    notes: null,
    sortOrder: 7,
    isWarmup: false,
    setScheme: "straight",
    setSchemeMeta: { phase: "cooldown", summary: "Cool-down · breath" },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
  }),
  "cooldown"
);

const view = toClientProgramView({
  title: "Mobility · 3 days/wk",
  goal: "mobility",
  daysPerWeek: 3,
  sessionMinutes: 45,
  days: [
    {
      id: "d1",
      name: "Mobility 1",
      focus: "T-spine and shoulders",
      exercises: [
        {
          id: "e1",
          exerciseName: "Wall slides",
          sets: 2,
          reps: "8",
          rpe: "5",
          restSec: 30,
          notes: "Mesocycle: W1",
          sortOrder: 0,
          isWarmup: true,
          setScheme: "straight",
          setSchemeMeta: { howTo: "Low back on the wall. Pain-free range." },
          groupId: null,
          groupKind: null,
          groupLabel: null,
          groupOrder: null,
        },
        {
          id: "e2",
          exerciseName: "Landmine press",
          sets: 3,
          reps: "8",
          rpe: "7",
          restSec: 90,
          notes: "Finish tall.",
          sortOrder: 1,
          isWarmup: false,
          setScheme: "straight",
          setSchemeMeta: null,
          groupId: "g1",
          groupKind: "superset",
          groupLabel: "A1/A2",
          groupOrder: 0,
        },
        {
          id: "e3",
          exerciseName: "Face pull",
          sets: 3,
          reps: "12",
          rpe: "6",
          restSec: 45,
          notes: null,
          sortOrder: 2,
          isWarmup: false,
          setScheme: "straight",
          setSchemeMeta: null,
          groupId: "g1",
          groupKind: "superset",
          groupLabel: "A1/A2",
          groupOrder: 1,
        },
      ],
    },
  ],
});

assert.equal(view.title, "Mobility · 3 days/wk");
assert.equal(view.days[0].blocks[0].phase, "warmup");
assert.equal(view.days[0].blocks[0].items[0].cue, "Low back on the wall. Pain-free range.");
assert.equal(view.days[0].blocks[1].phase, "work");
assert.equal(view.days[0].blocks[1].items.length, 2);
assert.equal(view.days[0].blocks[1].groupLabel, "Superset · A1/A2");
assert.match(view.days[0].blocks[1].items[0].prescription, /3/);
assert.match(view.days[0].blocks[1].items[0].restLabel, /Rest/);
assert.doesNotMatch(JSON.stringify(view), /Mesocycle/);

const correctiveView = toClientProgramView({
  title: "Warmup leak check",
  goal: "mobility",
  daysPerWeek: 1,
  sessionMinutes: 30,
  days: [
    {
      id: "d-corr",
      name: "Day A",
      focus: null,
      exercises: [
        {
          id: "e-wu",
          exerciseName: "Wall slides",
          sets: 2,
          reps: "8",
          rpe: "5",
          restSec: 30,
          notes: null,
          sortOrder: 0,
          isWarmup: true,
          setScheme: "straight",
          setSchemeMeta: { summary: "Warm-up · Corrective · Upper Cross" },
          groupId: null,
          groupKind: null,
          groupLabel: null,
          groupOrder: null,
        },
      ],
    },
  ],
});
const correctiveJson = JSON.stringify(correctiveView);
assert.doesNotMatch(correctiveJson, /Warm-up · Corrective · Upper Cross/);
assert.doesNotMatch(correctiveJson, /Corrective/);
assert.doesNotMatch(correctiveJson, /Upper Cross/);
assert.match(correctiveView.days[0].blocks[0].items[0].prescription, /2\s*×\s*8/);

console.log("portal-program mapper ok");
