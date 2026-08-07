/**
 * Pure client constraint profile for program building.
 * JSON-friendly (regex sources as strings, not RegExp objects).
 */

export type ClientConstraintProfile = {
  preferTags: string[];
  avoidTags: string[];
  /** Regex source strings (case-insensitive when compiled). */
  avoidNamePatterns: string[];
  forceMobility: boolean;
  notes: string[];
  injuryFlags: string[];
};

export type ConstraintExercise = {
  name: string;
  tags: string;
  movementPattern: string;
  difficulty?: string;
};

type InjuryFlag =
  | "shoulder"
  | "knee"
  | "lumbar"
  | "hip"
  | "ankle"
  | "elbow_wrist";

/** Per-flag prefer tags, avoid name patterns, and avoid tags for aggressive loading. */
const FLAG_RULES: Record<
  InjuryFlag,
  {
    preferTags: string[];
    avoidTags: string[];
    avoidNamePatterns: string[];
    note: string;
  }
> = {
  shoulder: {
    preferTags: [
      "shoulder-friendly",
      "mobility",
      "scapula",
      "posture",
      "shoulder",
    ],
    avoidTags: ["overhead", "vertical_push_aggressive"],
    avoidNamePatterns: [
      "overhead|ohp|military",
      "behind[- ]?the[- ]?neck|behind[- ]?neck",
      "upright\\s*row",
      "kipping|muscle[- ]?up",
      "wide[- ]?grip\\s*(pull|chin|press)",
    ],
    note: "Shoulder sensitivity — prefer landmine/neutral grip; monitor overhead.",
  },
  knee: {
    preferTags: ["knee-friendly", "mobility", "glute", "hip"],
    avoidTags: ["plyometric", "deep-knee", "high-impact"],
    avoidNamePatterns: [
      "pistol\\s*squat|shrimp\\s*squat",
      "box\\s*jump|depth\\s*jump|broad\\s*jump",
      "sissy\\s*squat|heels[- ]?elevated\\s*sissy",
      "jump\\s*(squat|lunge)|lunge\\s*jump",
      "full\\s*depth\\s*ass[- ]?to[- ]?grass",
    ],
    note: "Knee flag — bias controlled ranges; de-emphasize deep closed-chain impact.",
  },
  lumbar: {
    preferTags: ["core", "mobility", "hip", "anti-extension", "glute"],
    avoidTags: ["axial-load-heavy", "flexion-bias", "rounded"],
    avoidNamePatterns: [
      "good\\s*morning",
      "toes[- ]?to[- ]?bar|knees[- ]?to[- ]?elbow",
      "sit[- ]?up|crunch|v[- ]?up",
      "jefferson\\s*curl|rounded[- ]?back",
      "superman|back\\s*extension\\s*heavy",
      "max[- ]?effort\\s*deadlift|deficit\\s*deadlift",
    ],
    note: "Lumbar flag — brace-first core; avoid loaded end-range flexion/extension spikes.",
  },
  hip: {
    preferTags: ["hip", "mobility", "glute", "hip-friendly"],
    avoidTags: ["deep-hip-end-range"],
    avoidNamePatterns: [
      "cossack\\s*squat",
      "deep\\s*sumo",
      "pigeon\\s*(loaded|weighted)",
      "hurdle\\s*step[- ]?over\\s*loaded",
    ],
    note: "Hip flag — dose mobility + control; avoid forced end-range under load.",
  },
  ankle: {
    preferTags: ["mobility", "ankle", "knee-friendly", "heel-elevated"],
    avoidTags: ["barefoot-impact", "deep-dorsiflexion-load"],
    avoidNamePatterns: [
      "barefoot\\s*(sprint|run|jump)",
      "single[- ]?leg\\s*rdl\\s*on\\s*bosu",
      "deep\\s*overhead\\s*squat",
    ],
    note: "Ankle flag — allow heel elevation / limited DF options; avoid barefoot impact.",
  },
  elbow_wrist: {
    preferTags: ["neutral-grip", "shoulder-friendly", "machine"],
    avoidTags: ["false-grip", "extreme-wrist-extension"],
    avoidNamePatterns: [
      "skull\\s*crusher|french\\s*press|lying\\s*tricep",
      "false\\s*grip",
      "planche|handstand\\s*push",
      "wide[- ]?grip\\s*(pull[- ]?up|chin)",
      "thumbless|suicide\\s*grip",
    ],
    note: "Elbow/wrist flag — prefer neutral grips and machines; avoid extreme wrist positions.",
  },
};

/** Aggressive movement signals used when avoidTags overlap exercise tags/patterns. */
const AGGRESSIVE_NAME =
  /max[- ]?effort|1rm|near[- ]?max|plyo|depth\s*jump|kipping|deficit|ass[- ]?to[- ]?grass|supramax/i;

function uniq(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const k = item.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function combinedText(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(" \n ").toLowerCase();
}

function detectFlags(text: string): InjuryFlag[] {
  const flags: InjuryFlag[] = [];
  if (/shoulder|rotator|apley|scratch|impinge/i.test(text)) flags.push("shoulder");
  if (/\bknee\b|patell|acl|mcl|menisc/i.test(text)) flags.push("knee");
  if (/low\s*back|lumbar|disc|herniat|sciatic/i.test(text)) flags.push("lumbar");
  if (/\bhip\b|femoroacetabular|labr(al|um)\s*hip|groin/i.test(text)) flags.push("hip");
  if (/\bankle\b|achilles|dorsiflex/i.test(text)) flags.push("ankle");
  if (/\bwrist\b|\belbow\b|tennis\s*elbow|golfer.?s\s*elbow|epicondyl/i.test(text)) {
    flags.push("elbow_wrist");
  }
  return flags;
}

function tagList(tags: string): string[] {
  return tags
    .toLowerCase()
    .split(/[,;|/\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function nameMatchesAny(name: string, patterns: string[]): boolean {
  const n = name.toLowerCase();
  for (const src of patterns) {
    try {
      if (new RegExp(src, "i").test(n)) return true;
    } catch {
      // ignore invalid sources
    }
  }
  return false;
}

function emptyProfile(): ClientConstraintProfile {
  return {
    preferTags: [],
    avoidTags: [],
    avoidNamePatterns: [],
    forceMobility: false,
    notes: [],
    injuryFlags: [],
  };
}

/**
 * Build a client constraint profile from free-text CRM fields.
 * Detection is case-insensitive over injuries, goals, and contraindications.
 */
export function buildConstraintProfile(input: {
  injuries?: string | null;
  goals?: string | null;
  preferMobility?: boolean;
  contraindications?: string | null;
}): ClientConstraintProfile {
  const text = combinedText([
    input.injuries,
    input.goals,
    input.contraindications,
  ]);
  const flags = detectFlags(text);
  const profile = emptyProfile();

  for (const flag of flags) {
    const rule = FLAG_RULES[flag];
    profile.injuryFlags.push(flag);
    profile.preferTags.push(...rule.preferTags);
    profile.avoidTags.push(...rule.avoidTags);
    profile.avoidNamePatterns.push(...rule.avoidNamePatterns);
    profile.notes.push(rule.note);
  }

  // Goal language can soft-boost mobility without full injury flagging
  if (/mobility|corrective|rehab|prehab|range\s*of\s*motion/i.test(text)) {
    profile.preferTags.push("mobility");
    if (!profile.notes.some((n) => /mobility emphasis/i.test(n))) {
      profile.notes.push("Mobility emphasis from goals / history language.");
    }
  }

  profile.preferTags = uniq(profile.preferTags);
  profile.avoidTags = uniq(profile.avoidTags);
  profile.avoidNamePatterns = uniq(profile.avoidNamePatterns);
  profile.injuryFlags = uniq(profile.injuryFlags);
  profile.notes = uniq(profile.notes);

  const mobilityFromFlags =
    flags.includes("shoulder") ||
    flags.includes("lumbar") ||
    flags.includes("hip") ||
    flags.includes("ankle");

  profile.forceMobility = !!(
    input.preferMobility ||
    mobilityFromFlags ||
    /mobility|scratch|apley/i.test(text)
  );

  if (profile.forceMobility && !profile.preferTags.includes("mobility")) {
    profile.preferTags.push("mobility");
  }

  if (input.preferMobility && !profile.notes.some((n) => /prefer mobility/i.test(n))) {
    profile.notes.push("Coach requested prefer mobility warm-ups.");
  }

  if (!profile.notes.length && !profile.injuryFlags.length) {
    profile.notes.push("No injury or contraindication flags detected.");
  }

  return profile;
}

/**
 * True when the exercise clearly conflicts with the profile:
 * name hits an avoid pattern, or tags heavily overlap avoidTags on aggressive moves.
 */
export function exerciseViolatesConstraints(
  ex: ConstraintExercise,
  profile: ClientConstraintProfile
): boolean {
  if (!profile.injuryFlags.length && !profile.avoidNamePatterns.length) {
    return false;
  }

  if (nameMatchesAny(ex.name, profile.avoidNamePatterns)) {
    return true;
  }

  const tags = tagList(ex.tags);
  const pattern = (ex.movementPattern || "").toLowerCase();
  const hay = `${ex.tags} ${pattern} ${ex.name}`.toLowerCase();

  let avoidHits = 0;
  for (const t of profile.avoidTags) {
    const key = t.toLowerCase();
    if (tags.includes(key) || hay.includes(key)) avoidHits += 1;
  }

  // Shoulder + vertical press is a hard conflict when name looks overhead-aggressive
  if (
    profile.injuryFlags.includes("shoulder") &&
    pattern === "vertical_push" &&
    /overhead|military|strict\s*press|push\s*press|jerk/i.test(ex.name)
  ) {
    return true;
  }

  // Knee + plyometric pattern
  if (
    profile.injuryFlags.includes("knee") &&
    (pattern === "plyometric" || /plyo|jump/i.test(hay))
  ) {
    return true;
  }

  // Multiple avoid-tag hits plus aggressive loading language → violate
  if (avoidHits >= 2 && AGGRESSIVE_NAME.test(ex.name)) return true;
  if (
    avoidHits >= 1 &&
    (ex.difficulty === "advanced" || AGGRESSIVE_NAME.test(ex.name)) &&
    profile.injuryFlags.length > 0
  ) {
    return true;
  }

  return false;
}

/**
 * Higher is better for selection among candidates.
 * Boosts prefer tags; penalizes avoid tags / name patterns / hard violations.
 */
export function scoreExerciseForConstraints(
  ex: ConstraintExercise,
  profile: ClientConstraintProfile
): number {
  let score = 0;
  const name = ex.name.toLowerCase();
  const tags = tagList(ex.tags);
  const hay = `${ex.tags} ${ex.movementPattern} ${ex.name}`.toLowerCase();

  for (const t of profile.preferTags) {
    const key = t.toLowerCase();
    if (tags.includes(key) || hay.includes(key) || name.includes(key)) {
      score += 3;
    }
  }

  for (const t of profile.avoidTags) {
    const key = t.toLowerCase();
    if (tags.includes(key) || hay.includes(key)) {
      score -= 4;
    }
  }

  if (nameMatchesAny(ex.name, profile.avoidNamePatterns)) {
    score -= 12;
  }

  if (exerciseViolatesConstraints(ex, profile)) {
    score -= 25;
  }

  // Soft pattern affinity when flags are active
  const pattern = (ex.movementPattern || "").toLowerCase();
  if (profile.forceMobility && pattern === "mobility") score += 4;
  if (profile.injuryFlags.includes("shoulder") && pattern === "vertical_push") {
    score -= 3;
  }
  if (profile.injuryFlags.includes("knee") && pattern === "plyometric") {
    score -= 6;
  }
  if (profile.injuryFlags.includes("lumbar") && pattern === "hinge") {
    // hinge is fine when controlled; slight caution only
    score -= 1;
  }

  if (ex.difficulty === "beginner") score += 1;
  if (ex.difficulty === "advanced" && profile.injuryFlags.length) score -= 2;

  // Friendly name cues for constrained clients
  if (
    profile.injuryFlags.length &&
    /goblet|landmine|neutral|machine|cable|supported|regressed|floor\s*press|push[- ]?up/i.test(
      ex.name
    )
  ) {
    score += 2;
  }

  return score;
}

/** Coach-facing one-block summary of the constraint profile. */
export function formatConstraintSummary(profile: ClientConstraintProfile): string {
  if (
    !profile.injuryFlags.length &&
    !profile.forceMobility &&
    profile.notes.length === 1 &&
    /no injury/i.test(profile.notes[0] || "")
  ) {
    return "Constraints: none detected.";
  }

  const lines: string[] = [];

  if (profile.injuryFlags.length) {
    lines.push(`Flags: ${profile.injuryFlags.join(", ")}`);
  } else {
    lines.push("Flags: none");
  }

  if (profile.forceMobility) {
    lines.push("Mobility emphasis: on");
  }

  if (profile.preferTags.length) {
    lines.push(`Prefer tags: ${profile.preferTags.slice(0, 8).join(", ")}`);
  }

  if (profile.avoidNamePatterns.length) {
    lines.push(
      `Avoid name patterns: ${profile.avoidNamePatterns.slice(0, 6).join(" · ")}`
    );
  }

  if (profile.avoidTags.length) {
    lines.push(`Avoid tags: ${profile.avoidTags.join(", ")}`);
  }

  for (const n of profile.notes.slice(0, 6)) {
    lines.push(`• ${n}`);
  }

  return lines.join("\n");
}
