/**
 * Set-scheme catalog for program design and floor logging.
 * Schemes drive planned set rows (reps/roles/tempo) and coach cues.
 */

import type { SessionSetLog } from "@/db/schema";

export type SetSchemeId =
  | "straight"
  | "pyramid"
  | "reverse_pyramid"
  | "wave"
  | "drop"
  | "rest_pause"
  | "cluster"
  | "myo_reps"
  | "negative"
  | "tempo"
  | "contrast"
  | "complex"
  | "superset"
  | "amrap"
  | "emom";

export type PlannedSetRow = {
  reps: string;
  rpe?: string;
  role?: string;
  tempo?: string;
  restSec?: number;
  note?: string;
};

export type GroupMemberSpec = {
  role: string;
  label: string;
  /** Preferred movement patterns to pick from bank */
  patterns: string[];
  reps: string;
  rpe: string;
  /** Rest after this exercise before the next in the same round */
  restAfterSec: number;
  note?: string;
  tempo?: string;
};

export type SetSchemeMeta = {
  /** Short coach summary shown in UI */
  summary?: string;
  howTo?: string;
  plannedSets?: PlannedSetRow[];
  /** Default tempo e.g. 3-1-X-1 */
  tempo?: string;
  /** Drop-set extras after main sets */
  drops?: number;
  /** Cluster: mini-sets inside a "cluster" */
  clusterReps?: string;
  clusterIntraRestSec?: number;
  clusters?: number;
  /** Contrast pairs (strength + power) */
  contrastPairs?: number;
  /** Complex movement cues */
  complexMovements?: string[];
  /** Superset partner label */
  partnerHint?: string;
  emomMinutes?: number;
  group?: {
    kind: string;
    label: string;
    rounds: number;
    restBetweenExercisesSec: number;
    restBetweenRoundsSec: number;
  };
};

/** Multi-exercise schemes that must expand into separate program rows */
export const MULTI_EXERCISE_SCHEMES: SetSchemeId[] = [
  "contrast",
  "complex",
  "superset",
];

export function isMultiExerciseScheme(id: string | null | undefined): boolean {
  return MULTI_EXERCISE_SCHEMES.includes((id || "") as SetSchemeId);
}

/**
 * Spec for building a multi-exercise group (contrast / complex / superset).
 */
export function getGroupMemberSpecs(
  schemeId: SetSchemeId,
  opts?: { pattern?: string | null; goal?: string }
): {
  kind: string;
  label: string;
  rounds: number;
  restBetweenRoundsSec: number;
  howTo: string;
  members: GroupMemberSpec[];
} | null {
  const pattern = opts?.pattern || "hinge";

  if (schemeId === "contrast") {
    const powerPatterns =
      pattern === "squat"
        ? ["squat", "plyometric", "cardio"]
        : pattern === "hinge"
          ? ["hinge", "plyometric", "cardio"]
          : pattern.includes("push")
            ? ["horizontal_push", "vertical_push", "plyometric"]
            : ["horizontal_pull", "vertical_pull", "plyometric"];
    return {
      kind: "contrast",
      label: "Contrast pair",
      rounds: 3,
      restBetweenRoundsSec: 120,
      howTo:
        "A: heavy strength → rest ~60–90s → B: explosive. Rest ~2 min after each full pair. Stay crisp on the power move.",
      members: [
        {
          role: "heavy",
          label: "A · Strength",
          patterns: [pattern, "squat", "hinge", "horizontal_push"].filter(
            Boolean
          ) as string[],
          reps: "3-5",
          rpe: "8",
          restAfterSec: 75,
          note: "Heavy controlled · full rest before power",
        },
        {
          role: "explosive",
          label: "B · Explosive",
          patterns: powerPatterns,
          reps: "3-5",
          rpe: "7",
          restAfterSec: 0,
          note: "Speed / jump / throw · light & crisp",
        },
      ],
    };
  }

  if (schemeId === "complex") {
    const movements =
      pattern === "hinge"
        ? [
            {
              role: "complex-1",
              label: "1 · Hinge",
              patterns: ["hinge"],
              reps: "6",
              note: "First movement in complex",
            },
            {
              role: "complex-2",
              label: "2 · Pull / shrug",
              patterns: ["horizontal_pull", "vertical_pull", "hinge"],
              reps: "6",
              note: "Flow without putting implement down",
            },
            {
              role: "complex-3",
              label: "3 · Squat / lunge",
              patterns: ["squat"],
              reps: "6",
              note: "Finish complex · load by weakest link",
            },
          ]
        : pattern === "squat"
          ? [
              {
                role: "complex-1",
                label: "1 · Squat",
                patterns: ["squat"],
                reps: "6",
                note: "First movement",
              },
              {
                role: "complex-2",
                label: "2 · Press",
                patterns: ["vertical_push", "horizontal_push"],
                reps: "6",
                note: "Keep torso braced",
              },
              {
                role: "complex-3",
                label: "3 · Lunge / carry",
                patterns: ["squat", "carry"],
                reps: "6/side",
                note: "Finish · same implement if possible",
              },
            ]
          : [
              {
                role: "complex-1",
                label: "1 · Pull",
                patterns: ["horizontal_pull", "vertical_pull"],
                reps: "6",
                note: "First movement",
              },
              {
                role: "complex-2",
                label: "2 · Hinge",
                patterns: ["hinge"],
                reps: "6",
                note: "Flow",
              },
              {
                role: "complex-3",
                label: "3 · Push",
                patterns: ["horizontal_push", "vertical_push"],
                reps: "6",
                note: "Finish complex",
              },
            ];

    return {
      kind: "complex",
      label: "Complex",
      rounds: 3,
      restBetweenRoundsSec: 90,
      howTo:
        "Perform movements back-to-back with little rest between (0–15s). Rest 60–90s only after the full complex. Choose load for the weakest movement.",
      members: movements.map((m, i, arr) => ({
        role: m.role,
        label: m.label,
        patterns: m.patterns,
        reps: m.reps,
        rpe: "7",
        restAfterSec: i < arr.length - 1 ? 10 : 0,
        note: m.note,
      })),
    };
  }

  if (schemeId === "superset") {
    const pairPatterns = pattern.includes("push")
      ? ["horizontal_pull", "vertical_pull"]
      : pattern.includes("pull")
        ? ["horizontal_push", "vertical_push"]
        : pattern === "squat"
          ? ["hinge"]
          : pattern === "hinge"
            ? ["squat"]
            : ["core", "carry"];
    return {
      kind: "superset",
      label: "Superset",
      rounds: 3,
      restBetweenRoundsSec: 90,
      howTo:
        "A then B with minimal rest (~15–30s). Rest 60–90s after the pair. Keep form on both sides.",
      members: [
        {
          role: "A",
          label: "A",
          patterns: [pattern],
          reps: "8-12",
          rpe: "7-8",
          restAfterSec: 20,
          note: "Then straight into B",
        },
        {
          role: "B",
          label: "B · Pair",
          patterns: pairPatterns,
          reps: "8-12",
          rpe: "7-8",
          restAfterSec: 0,
          note: "Antagonist / complementary",
        },
      ],
    };
  }

  return null;
}

export type SetSchemeDef = {
  id: SetSchemeId;
  label: string;
  shortLabel: string;
  description: string;
  howTo: string;
  /** When builder may auto-assign */
  goodFor: Array<"strength" | "hypertrophy" | "fat_loss" | "general" | "mobility" | "warmup">;
};

export const SET_SCHEMES: SetSchemeDef[] = [
  {
    id: "straight",
    label: "Straight sets",
    shortLabel: "Straight",
    description: "Same target reps and load across working sets.",
    howTo: "Keep load constant. Rest fully between sets. Stop 1–2 reps in reserve unless noted.",
    goodFor: ["strength", "hypertrophy", "fat_loss", "general", "mobility", "warmup"],
  },
  {
    id: "pyramid",
    label: "Ascending pyramid",
    shortLabel: "Pyramid ↑",
    description: "Increase load and drop reps set to set.",
    howTo: "Start lighter / higher reps, add weight each set as reps fall. Leave 1–2 RIR until top set.",
    goodFor: ["strength", "hypertrophy", "general"],
  },
  {
    id: "reverse_pyramid",
    label: "Reverse pyramid",
    shortLabel: "RPT ↓",
    description: "Heaviest top set first, then strip load and raise reps.",
    howTo: "Warm up thoroughly. Hit a hard top set, rest long, then drop ~10–15% and do higher reps.",
    goodFor: ["strength", "hypertrophy"],
  },
  {
    id: "wave",
    label: "Wave loading",
    shortLabel: "Wave",
    description: "Repeating waves of increasing intensity (e.g. 5, 3, 2 × 2 waves).",
    howTo: "Treat each wave as a build. Second wave can nudge load if first wave was clean.",
    goodFor: ["strength"],
  },
  {
    id: "drop",
    label: "Drop sets",
    shortLabel: "Drop",
    description: "Main sets, then strip weight and continue with little rest.",
    howTo: "Complete main sets. Immediately reduce load 20–30% for drop segments. Minimal rest between drops.",
    goodFor: ["hypertrophy", "fat_loss"],
  },
  {
    id: "rest_pause",
    label: "Rest-pause",
    shortLabel: "Rest-pause",
    description: "Work to near-failure, short rest, then mini-sets.",
    howTo: "Push close to failure, rest 15–20s, squeeze more reps. Repeat for prescribed mini-bouts.",
    goodFor: ["hypertrophy", "fat_loss"],
  },
  {
    id: "cluster",
    label: "Cluster sets",
    shortLabel: "Cluster",
    description: "Heavy singles/doubles with short intra-set rests.",
    howTo: "Within a cluster, rest 10–20s between mini-reps. Full rest between clusters. Quality over fatigue.",
    goodFor: ["strength"],
  },
  {
    id: "myo_reps",
    label: "Myo-reps",
    shortLabel: "Myo",
    description: "Activation set then short rest mini-sets for efficient volume.",
    howTo: "Do a longer activation set (~12–20). Rest ~5 breaths, then mini-sets of 3–5 until total mini-reps are done.",
    goodFor: ["hypertrophy", "fat_loss"],
  },
  {
    id: "negative",
    label: "Eccentric / negatives",
    shortLabel: "Negatives",
    description: "Emphasize slow lowering; optional assisted concentric.",
    howTo: "Control the eccentric 3–5s. Use a spot or lighter load if concentric is limited. Quality over load.",
    goodFor: ["strength", "hypertrophy", "general"],
  },
  {
    id: "tempo",
    label: "Tempo sets",
    shortLabel: "Tempo",
    description: "Prescribed eccentric-pause-concentric-pause rhythm.",
    howTo: "Count tempo (e.g. 3-1-X-1). Don’t rush the pause. Reduce load if tempo breaks.",
    goodFor: ["hypertrophy", "general", "mobility", "strength"],
  },
  {
    id: "contrast",
    label: "Contrast sets",
    shortLabel: "Contrast",
    description: "Heavy strength set paired with an explosive/power set.",
    howTo: "Heavy controlled set → full rest → explosive set (jumps, throws, or light bar speed). Stay crisp, not exhausted.",
    goodFor: ["strength", "general"],
  },
  {
    id: "complex",
    label: "Complex / combination",
    shortLabel: "Complex",
    description: "Several movements strung together as one set with one implement.",
    howTo: "Flow movements without putting the implement down. Choose load by the weakest movement in the complex.",
    goodFor: ["fat_loss", "general", "hypertrophy"],
  },
  {
    id: "superset",
    label: "Superset",
    shortLabel: "Superset",
    description: "Pair with another exercise; minimal rest between A↔B.",
    howTo: "Alternate with the paired movement. Rest after the pair. Keep form on both sides.",
    goodFor: ["hypertrophy", "fat_loss", "general"],
  },
  {
    id: "amrap",
    label: "AMRAP",
    shortLabel: "AMRAP",
    description: "As many quality reps as possible in the set or window.",
    howTo: "Stop if form fails. Log total clean reps. Leave 0–1 RIR unless noted as true failure.",
    goodFor: ["fat_loss", "hypertrophy", "general"],
  },
  {
    id: "emom",
    label: "EMOM",
    shortLabel: "EMOM",
    description: "Every minute on the minute for prescribed minutes.",
    howTo:
      "Start the work at the top of each minute. Rest for the remainder of that 60s window, then go again. Load so the set finishes cleanly with time left to breathe.",
    goodFor: ["fat_loss", "general", "strength"],
  },
];

/** Standard EMOM clock interval (work + rest remainder). */
export const EMOM_INTERVAL_SEC = 60;

const byId = new Map(SET_SCHEMES.map((s) => [s.id, s]));

export function getSetScheme(id: string | null | undefined): SetSchemeDef {
  return byId.get((id as SetSchemeId) || "straight") || SET_SCHEMES[0];
}

export function schemeLabel(id: string | null | undefined): string {
  return getSetScheme(id).shortLabel;
}

/** Build planned set rows + summary for a scheme given base prescription. */
export function buildSchemePlan(
  schemeId: SetSchemeId,
  base: { sets: number; reps: string; rpe: string | null; restSec: number | null },
  opts?: { pattern?: string; isWarmup?: boolean }
): {
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
  setScheme: SetSchemeId;
  setSchemeMeta: SetSchemeMeta;
  notesExtra: string | null;
} {
  const def = getSetScheme(schemeId);
  const rest = base.restSec ?? 90;
  const rpe = base.rpe || "7";

  if (opts?.isWarmup || schemeId === "straight") {
    const planned: PlannedSetRow[] = Array.from({ length: base.sets }, () => ({
      reps: base.reps,
      rpe,
      role: "work",
      restSec: rest,
    }));
    return {
      sets: base.sets,
      reps: base.reps,
      rpe,
      restSec: rest,
      setScheme: opts?.isWarmup ? "straight" : schemeId,
      setSchemeMeta: {
        summary: `${base.sets}×${base.reps}`,
        howTo: def.howTo,
        plannedSets: planned,
      },
      notesExtra: null,
    };
  }

  switch (schemeId) {
    case "pyramid": {
      const ladders = [
        { reps: "12", rpe: "6" },
        { reps: "10", rpe: "7" },
        { reps: "8", rpe: "7-8" },
        { reps: "6", rpe: "8" },
      ].slice(0, Math.max(3, base.sets));
      const planned = ladders.map((l, i) => ({
        reps: l.reps,
        rpe: l.rpe,
        role: i === ladders.length - 1 ? "top" : "build",
        restSec: rest,
        note: i === 0 ? "Lightest" : i === ladders.length - 1 ? "Heaviest" : undefined,
      }));
      return pack(schemeId, planned, rest, def, `Pyramid ${planned.map((p) => p.reps).join("→")}`);
    }
    case "reverse_pyramid": {
      const planned: PlannedSetRow[] = [
        { reps: "4-6", rpe: "8-9", role: "top", restSec: Math.max(rest, 150), note: "Heaviest first" },
        { reps: "6-8", rpe: "8", role: "back-off", restSec: rest, note: "−10–15% load" },
        { reps: "8-12", rpe: "7-8", role: "back-off", restSec: rest, note: "−10–15% again" },
      ];
      if (base.sets > 3) {
        planned.push({
          reps: "10-15",
          rpe: "7",
          role: "pump",
          restSec: 75,
          note: "Optional pump set",
        });
      }
      return pack(schemeId, planned.slice(0, Math.max(3, base.sets)), rest, def, "RPT heavy→lighter");
    }
    case "wave": {
      const wave: PlannedSetRow[] = [
        { reps: "5", rpe: "7", role: "wave", restSec: rest },
        { reps: "3", rpe: "8", role: "wave", restSec: rest },
        { reps: "2", rpe: "8-9", role: "wave", restSec: Math.max(rest, 150) },
      ];
      const planned = [...wave, ...wave.map((w) => ({ ...w, note: "Wave 2" }))];
      return pack(schemeId, planned, rest, def, "Wave 5-3-2 × 2");
    }
    case "drop": {
      const main = Math.max(2, base.sets - 1);
      const planned: PlannedSetRow[] = [
        ...Array.from({ length: main }, () => ({
          reps: base.reps,
          rpe,
          role: "main",
          restSec: rest,
        })),
        {
          reps: base.reps,
          rpe: "9",
          role: "drop-1",
          restSec: 10,
          note: "Strip ~25%, minimal rest",
        },
        {
          reps: "AMRAP",
          rpe: "9-10",
          role: "drop-2",
          restSec: rest,
          note: "Strip again",
        },
      ];
      return pack(
        schemeId,
        planned,
        rest,
        def,
        `${main} main + 2 drops`,
        { drops: 2 }
      );
    }
    case "rest_pause": {
      const planned: PlannedSetRow[] = [
        { reps: base.reps, rpe: "9", role: "primary", restSec: 15, note: "Near failure" },
        { reps: "3-5", rpe: "9", role: "RP-1", restSec: 15, note: "15–20s rest" },
        { reps: "2-4", rpe: "9-10", role: "RP-2", restSec: rest, note: "15–20s rest" },
      ];
      return pack(schemeId, planned, rest, def, "Rest-pause finisher");
    }
    case "cluster": {
      const clusters = Math.min(5, Math.max(3, base.sets));
      const planned: PlannedSetRow[] = Array.from({ length: clusters }, (_, i) => ({
        reps: "2+2+2",
        rpe: "8",
        role: "cluster",
        restSec: Math.max(rest, 120),
        note: `Cluster ${i + 1} · 15s intra-rest`,
        tempo: undefined,
      }));
      return pack(schemeId, planned, Math.max(rest, 120), def, `${clusters} clusters of 2+2+2`, {
        clusters,
        clusterReps: "2",
        clusterIntraRestSec: 15,
      });
    }
    case "myo_reps": {
      const planned: PlannedSetRow[] = [
        { reps: "12-20", rpe: "8-9", role: "activation", restSec: 15, note: "Activation set" },
        ...Array.from({ length: 4 }, (_, i) => ({
          reps: "3-5",
          rpe: "8-9",
          role: "mini",
          restSec: i === 3 ? rest : 12,
          note: "5 breaths rest",
        })),
      ];
      return pack(schemeId, planned, rest, def, "Myo: activation + minis");
    }
    case "negative": {
      const planned: PlannedSetRow[] = Array.from({ length: Math.max(3, base.sets) }, () => ({
        reps: "3-5",
        rpe: "8",
        role: "eccentric",
        tempo: "5-0-1-0",
        restSec: Math.max(rest, 120),
        note: "3–5s lower",
      }));
      return pack(schemeId, planned, Math.max(rest, 120), def, "Slow eccentrics 3–5s", {
        tempo: "5-0-1-0",
      });
    }
    case "tempo": {
      const tempo = "3-1-X-1";
      const planned: PlannedSetRow[] = Array.from({ length: base.sets }, () => ({
        reps: base.reps,
        rpe,
        role: "tempo",
        tempo,
        restSec: rest,
      }));
      return pack(schemeId, planned, rest, def, `Tempo ${tempo}`, { tempo });
    }
    case "contrast": {
      const pairs = Math.min(4, Math.max(3, Math.ceil(base.sets / 2)));
      const planned: PlannedSetRow[] = [];
      for (let i = 0; i < pairs; i++) {
        planned.push({
          reps: "3-5",
          rpe: "8",
          role: "heavy",
          restSec: 90,
          note: `Pair ${i + 1} · strength`,
        });
        planned.push({
          reps: "3-5",
          rpe: "7",
          role: "explosive",
          restSec: Math.max(rest, 120),
          note: `Pair ${i + 1} · speed / jump / throw`,
        });
      }
      return pack(schemeId, planned, rest, def, `${pairs} contrast pairs`, {
        contrastPairs: pairs,
      });
    }
    case "complex": {
      const movements =
        opts?.pattern === "hinge"
          ? ["RDL", "Hang clean / jump shrug", "Front squat"]
          : opts?.pattern === "squat"
            ? ["Goblet squat", "OH press", "Reverse lunge"]
            : ["Row", "RDL", "Push-up / press"];
      const planned: PlannedSetRow[] = Array.from({ length: Math.max(3, base.sets) }, () => ({
        reps: "6 each",
        rpe: "7",
        role: "complex",
        restSec: rest,
        note: movements.join(" → "),
      }));
      return pack(
        schemeId,
        planned,
        rest,
        def,
        `Complex: ${movements.join(" → ")}`,
        { complexMovements: movements }
      );
    }
    case "superset": {
      const planned: PlannedSetRow[] = Array.from({ length: base.sets }, () => ({
        reps: base.reps,
        rpe,
        role: "A",
        restSec: 30,
        note: "Then pair B with little rest",
      }));
      return pack(schemeId, planned, rest, def, "Superset A (pair with antagonist)", {
        partnerHint: "Pair with opposing pattern or isolation",
      });
    }
    case "amrap": {
      const planned: PlannedSetRow[] = Array.from({ length: Math.max(2, base.sets) }, (_, i) => ({
        reps: "AMRAP",
        rpe: i === 0 ? "8" : "9",
        role: "amrap",
        restSec: rest,
        note: "Quality reps only",
      }));
      return pack(schemeId, planned, rest, def, `${planned.length}× AMRAP`);
    }
    case "emom": {
      // One row per minute. restSec is the full 60s interval so the floor timer
      // and labels match “every minute on the minute” (work + rest remainder).
      // Previously restSec was 0 → “No rest” in UI and fell through to 90s default.
      const minutes = Math.min(12, Math.max(6, base.sets * 2));
      const interval = EMOM_INTERVAL_SEC;
      const planned: PlannedSetRow[] = Array.from(
        { length: minutes },
        (_, i) => ({
          reps: base.reps.includes("-")
            ? base.reps.split("-")[0]!.trim()
            : base.reps || "5",
          rpe: "7",
          role: "emom",
          restSec: interval,
          note: `Min ${i + 1}/${minutes} · rest remainder of minute`,
        })
      );
      return pack(
        schemeId,
        planned,
        interval,
        def,
        `EMOM ${minutes} × ${interval}s`,
        {
          emomMinutes: minutes,
        }
      );
    }
    default:
      return buildSchemePlan("straight", base, opts);
  }
}

function pack(
  setScheme: SetSchemeId,
  planned: PlannedSetRow[],
  restSec: number | null,
  def: SetSchemeDef,
  summary: string,
  extra?: Partial<SetSchemeMeta>
) {
  return {
    sets: planned.length,
    reps: summarizeReps(planned),
    rpe: planned[0]?.rpe || null,
    restSec,
    setScheme,
    setSchemeMeta: {
      summary,
      howTo: def.howTo,
      plannedSets: planned,
      ...extra,
    },
    notesExtra: `${def.label}: ${def.howTo}`,
  };
}

function summarizeReps(planned: PlannedSetRow[]): string {
  const reps = planned.map((p) => p.reps);
  if (reps.every((r) => r === reps[0])) return reps[0];
  if (reps.length <= 5) return reps.join("/");
  return `${reps[0]}…${reps[reps.length - 1]}`;
}

/**
 * Auto-pick a scheme for program builder based on goal, pattern, and position.
 * Intentionally varies schemes so previews clearly show non-straight work.
 */
export function assignSetScheme(opts: {
  goal: string;
  pattern: string | null | undefined;
  isWarmup: boolean;
  sortOrder: number;
  experience?: string;
}): SetSchemeId {
  if (opts.isWarmup) return "straight";
  const goal = opts.goal;
  const pattern = opts.pattern || "";
  const main =
    /squat|hinge|horizontal_push|vertical_push|horizontal_pull|vertical_pull/.test(
      pattern
    );
  const accessory = /core|carry|mobility|cardio/.test(pattern);
  const advanced = /advanced/i.test(opts.experience || "");
  const n = opts.sortOrder;

  if (pattern === "mobility" || goal === "mobility") {
    return n % 2 === 0 ? "tempo" : "straight";
  }

  if (accessory) {
    if (goal === "hypertrophy") return n % 2 === 0 ? "drop" : "myo_reps";
    if (goal === "fat_loss") return n % 2 === 0 ? "superset" : "amrap";
    if (goal === "strength") return "straight";
    return n % 2 === 0 ? "superset" : "tempo";
  }

  // Main compounds
  if (goal === "strength") {
    if (n === 0) return "reverse_pyramid";
    if (n === 1) return advanced ? "cluster" : "pyramid";
    if (n === 2) return "wave";
    return "straight";
  }

  if (goal === "hypertrophy") {
    if (n === 0) return "reverse_pyramid";
    if (n === 1) return "pyramid";
    if (n === 2) return "drop";
    return n % 2 === 0 ? "myo_reps" : "rest_pause";
  }

  if (goal === "fat_loss") {
    if (n === 0) return "straight";
    if (n === 1) return "complex";
    if (n === 2) return "superset";
    return "emom";
  }

  // general fitness — show variety on every main lift
  if (n === 0) return advanced ? "contrast" : "pyramid";
  if (n === 1) return "reverse_pyramid";
  if (n === 2) return "tempo";
  return n % 2 === 0 ? "superset" : "drop";
}

/** Expand scheme into session set log rows (optionally seed weights from previous). */
export function initSetLogsFromScheme(
  schemeId: string | null | undefined,
  meta: SetSchemeMeta | null | undefined,
  fallbackSets: number | null | undefined,
  fallbackReps: string | null | undefined,
  previous?: SessionSetLog[] | null
): SessionSetLog[] {
  const planned = meta?.plannedSets;
  const isEmom =
    schemeId === "emom" || (meta?.emomMinutes != null && meta.emomMinutes > 0);
  if (planned?.length) {
    return planned.map((p, i) => {
      const prev = previous?.[i] ?? previous?.[previous.length - 1];
      let restSec = p.restSec ?? null;
      // Legacy EMOM rows stored restSec: 0 — treat as full 60s interval
      if (isEmom || p.role === "emom") {
        if (restSec == null || restSec <= 0) restSec = EMOM_INTERVAL_SEC;
      }
      return {
        setIndex: i + 1,
        reps: p.reps || fallbackReps || "8-10",
        weightKg: prev?.weightKg ?? null,
        rpe: p.rpe ?? prev?.rpe ?? null,
        completed: false,
        role: p.role || null,
        tempo: p.tempo || meta?.tempo || null,
        restSec,
        note: p.note || null,
        pain: null,
      };
    });
  }

  // Fallback straight sets
  const n = Math.max(1, fallbackSets || 3);
  const reps = fallbackReps || "8-10";
  return Array.from({ length: n }, (_, i) => {
    const prev = previous?.[i] ?? previous?.[previous.length - 1];
    return {
      setIndex: i + 1,
      reps,
      weightKg: prev?.weightKg ?? null,
      rpe: prev?.rpe ?? null,
      completed: false,
      role: schemeId && schemeId !== "straight" ? "work" : null,
      tempo: meta?.tempo || null,
      restSec: null,
      note: null,
      pain: null,
    };
  });
}

export function formatSchemeBadge(
  schemeId: string | null | undefined,
  meta?: SetSchemeMeta | null
): string {
  const def = getSetScheme(schemeId);
  if (meta?.summary) return `${def.shortLabel} · ${meta.summary}`;
  return def.shortLabel;
}
