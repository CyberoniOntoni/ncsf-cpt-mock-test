/**
 * Exercise-science session prep: warm-up (RAMP-inspired) + cool-down.
 * Pure helpers — used by program builder and UI badges.
 *
 * RAMP (Jeffreys): Raise → Activate → Mobilize → Potentiate
 * Cool-down: gradual downshift + lengthen (not static-only dogma; brief easy movement first).
 */

export type PrepPhase = "warmup" | "cooldown";

export type PrepRole =
  | "raise"
  | "activate"
  | "mobilize"
  | "potentiate"
  | "downshift"
  | "lengthen"
  | "restore";

export type PrepSlot = {
  patterns: string[];
  phase: PrepPhase;
  role: PrepRole;
  preferTags: string[];
  /** Short coach label for meta.summary */
  label: string;
};

export type PrepDensity = "short" | "standard" | "long";

export type PrepSessionKind =
  | "full_a"
  | "full_b"
  | "full_c"
  | "upper"
  | "lower"
  | "push"
  | "pull"
  | "legs"
  | "mobility";

export function densityFromMinutes(minutes: number): PrepDensity {
  if (minutes < 40) return "short";
  if (minutes >= 55) return "long";
  return "standard";
}

/** Prefer tags / patterns for activation by session kind. */
function activationFor(kind: PrepSessionKind): PrepSlot {
  switch (kind) {
    case "lower":
    case "legs":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "hinge", "squat"],
        preferTags: ["warmup", "glute", "activation", "band", "bridge"],
        label: "Activate · posterior / glutes",
      };
    case "upper":
    case "push":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "horizontal_pull"],
        preferTags: ["warmup", "shoulder", "scap", "face pull", "band", "cuff"],
        label: "Activate · scapulae / cuff",
      };
    case "pull":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "horizontal_pull", "core"],
        preferTags: ["warmup", "scap", "dead bug", "core", "band"],
        label: "Activate · scap + trunk",
      };
    case "full_a":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "squat", "core"],
        preferTags: ["warmup", "glute", "activation", "core"],
        label: "Activate · squat pattern prep",
      };
    case "full_b":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "hinge", "core"],
        preferTags: ["warmup", "glute", "hinge", "activation"],
        label: "Activate · hinge pattern prep",
      };
    case "full_c":
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "core", "squat"],
        preferTags: ["warmup", "single-leg", "balance", "core"],
        label: "Activate · unilateral / trunk",
      };
    case "mobility":
    default:
      return {
        phase: "warmup",
        role: "activate",
        patterns: ["mobility", "core"],
        preferTags: ["warmup", "breath", "core"],
        label: "Activate · breath + brace",
      };
  }
}

function mobilizeFor(kind: PrepSessionKind): PrepSlot {
  switch (kind) {
    case "lower":
    case "legs":
    case "full_a":
    case "full_c":
      return {
        phase: "warmup",
        role: "mobilize",
        patterns: ["mobility"],
        preferTags: ["hip", "ankle", "warmup", "mobility", "90/90", "open"],
        label: "Mobilize · hips / ankles",
      };
    case "upper":
    case "push":
    case "pull":
    case "full_b":
      return {
        phase: "warmup",
        role: "mobilize",
        patterns: ["mobility"],
        preferTags: ["tspine", "thoracic", "shoulder", "warmup", "mobility"],
        label: "Mobilize · T-spine / shoulders",
      };
    case "mobility":
    default:
      return {
        phase: "warmup",
        role: "mobilize",
        patterns: ["mobility"],
        preferTags: ["mobility", "warmup", "open"],
        label: "Mobilize · session ranges",
      };
  }
}

function raiseSlot(): PrepSlot {
  return {
    phase: "warmup",
    role: "raise",
    patterns: ["cardio", "mobility", "plyometric"],
    preferTags: ["warmup", "cardio", "conditioning", "jump rope", "bike"],
    label: "Raise · temperature / circulation",
  };
}

function potentiateFor(kind: PrepSessionKind): PrepSlot | null {
  if (kind === "mobility" || kind === "pull") return null;
  if (kind === "upper" || kind === "push") {
    return {
      phase: "warmup",
      role: "potentiate",
      patterns: ["plyometric", "horizontal_push", "vertical_push"],
      preferTags: ["warmup", "plyo", "med ball", "explosive"],
      label: "Potentiate · crisp light power",
    };
  }
  return {
    phase: "warmup",
    role: "potentiate",
    patterns: ["plyometric", "squat", "hinge"],
    preferTags: ["warmup", "plyo", "jump", "explosive", "skip"],
    label: "Potentiate · light lower power",
  };
}

/**
 * Warm-up slots after correctives (RAMP). Always ≥1 for training days.
 */
export function warmupSlotsForSession(
  kind: PrepSessionKind,
  density: PrepDensity,
  opts?: { preferMobility?: boolean }
): PrepSlot[] {
  const preferMobility = !!opts?.preferMobility;
  const act = activationFor(kind);
  const mob = mobilizeFor(kind);

  if (kind === "mobility") {
    return [
      raiseSlot(),
      { ...mob, preferTags: [...mob.preferTags, "breath"] },
      act,
    ].slice(0, density === "short" ? 2 : 3);
  }

  if (density === "short") {
    // Contact-time trim: specific only (activate + optional mobilize)
    return preferMobility ? [act, mob] : [act];
  }

  if (density === "standard") {
    const slots = [raiseSlot(), act, mob];
    return preferMobility ? slots : [raiseSlot(), act];
  }

  // long
  const pot = potentiateFor(kind);
  const slots: PrepSlot[] = [raiseSlot(), act, mob];
  if (pot) slots.push(pot);
  return slots;
}

/**
 * Cool-down: downshift HR then lengthen / restore (not skip entirely).
 */
export function cooldownSlotsForSession(
  kind: PrepSessionKind,
  density: PrepDensity
): PrepSlot[] {
  if (kind === "mobility") {
    return [
      {
        phase: "cooldown",
        role: "restore",
        patterns: ["mobility", "core"],
        preferTags: ["breath", "restore", "relax", "mobility"],
        label: "Restore · breath + easy range",
      },
    ];
  }

  const downshift: PrepSlot = {
    phase: "cooldown",
    role: "downshift",
    patterns: ["cardio", "mobility", "carry"],
    preferTags: ["walk", "easy", "cooldown", "cardio", "bike"],
    label: "Downshift · easy rhythm",
  };

  const lengthen: PrepSlot = {
    phase: "cooldown",
    role: "lengthen",
    patterns: ["mobility"],
    preferTags:
      kind === "upper" || kind === "push" || kind === "pull"
        ? ["chest", "lat", "pec", "shoulder", "mobility", "stretch"]
        : ["hip", "hamstring", "quad", "mobility", "stretch"],
    label:
      kind === "upper" || kind === "push" || kind === "pull"
        ? "Lengthen · upper openers"
        : "Lengthen · hips / posterior",
  };

  if (density === "short") {
    return [lengthen]; // even 1 soft drill beats a hard stop
  }
  if (density === "standard") {
    return [downshift, lengthen];
  }
  return [
    downshift,
    lengthen,
    {
      phase: "cooldown",
      role: "restore",
      patterns: ["core", "mobility"],
      preferTags: ["breath", "dead bug", "90/90", "restore"],
      label: "Restore · brace soft + breath",
    },
  ];
}

export function prepPrescription(
  role: PrepRole
): { sets: number; reps: string; rpe: string; restSec: number } {
  switch (role) {
    case "raise":
      return { sets: 1, reps: "2-4 min easy", rpe: "3-4", restSec: 30 };
    case "activate":
      return { sets: 2, reps: "8-12", rpe: "4-5", restSec: 30 };
    case "mobilize":
      return { sets: 2, reps: "6-10/side", rpe: "4-5", restSec: 30 };
    case "potentiate":
      return { sets: 2, reps: "3-5", rpe: "5-6", restSec: 60 };
    case "downshift":
      return { sets: 1, reps: "3-5 min easy", rpe: "2-3", restSec: 0 };
    case "lengthen":
      return { sets: 1, reps: "20-40s hold ×2", rpe: "3-4", restSec: 20 };
    case "restore":
      return { sets: 2, reps: "4-6 slow breaths", rpe: "2-3", restSec: 20 };
    default:
      return { sets: 2, reps: "8-10", rpe: "4-5", restSec: 45 };
  }
}

export function prepHowTo(role: PrepRole): string {
  switch (role) {
    case "raise":
      return "Easy continuous movement until you feel warmer and breathing is up slightly — not a pre-fatigue cardio block.";
    case "activate":
      return "Light load or band; crisp quality. Feel the target tissues without chasing fatigue.";
    case "mobilize":
      return "Controlled ranges you’ll use under load. Pain-free end ranges only; pair with breath.";
    case "potentiate":
      return "Low volume, high intent, full recovery between efforts. Stop if landings or bar path get sloppy.";
    case "downshift":
      return "Gradually lower intensity — walking or easy bike. Avoid a hard stop after heavy sets (pooling / lightheadedness).";
    case "lengthen":
      return "Gentle long holds or slow breathing into range. No aggressive forcing after max effort.";
    case "restore":
      return "Quiet breathing and easy control work. Leave the floor calmer than you arrived.";
    default:
      return "Quality over intensity.";
  }
}

export function prepSummary(slot: PrepSlot): string {
  const prefix = slot.phase === "warmup" ? "Warm-up" : "Cool-down";
  return `${prefix} · ${slot.label.replace(/^(Activate|Mobilize|Raise|Potentiate|Downshift|Lengthen|Restore) · /, "")}`;
}

/** Detect cool-down rows without a schema column. */
export function isCooldownMeta(
  meta: { phase?: string; summary?: string } | null | undefined
): boolean {
  if (!meta) return false;
  if (meta.phase === "cooldown") return true;
  return /^cool-?down/i.test(meta.summary || "");
}

export function isWarmupMeta(
  meta: { phase?: string; summary?: string } | null | undefined,
  isWarmupFlag?: boolean
): boolean {
  if (isWarmupFlag) return true;
  if (!meta) return false;
  if (meta.phase === "warmup") return true;
  return /^warm-?up/i.test(meta.summary || "");
}
