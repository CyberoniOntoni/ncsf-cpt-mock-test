/** Shared exercise movement-pattern labels & tones for library / pickers / coach. */

export const PATTERN_LABEL: Record<string, string> = {
  squat: "Squat",
  hinge: "Hinge",
  horizontal_push: "Horiz. push",
  vertical_push: "Vert. push",
  horizontal_pull: "Horiz. pull",
  vertical_pull: "Vert. pull",
  carry: "Carry",
  core: "Core",
  mobility: "Mobility",
  cardio: "Cardio",
  plyometric: "Plyometric",
  other: "Other",
};

/**
 * Session design order: prep → power → primary compounds → accessories → finisher.
 * (Distinct from PATTERN_ORDER which is library grouping.)
 */
export const SESSION_PATTERN_ORDER = [
  "mobility",
  "plyometric",
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "carry",
  "core",
  "cardio",
  "other",
] as const;

export const PATTERN_ORDER = [
  "mobility",
  "squat",
  "hinge",
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "core",
  "carry",
  "plyometric",
  "cardio",
  "other",
] as const;

/** Antagonist / balance pairs for push–pull programming. */
export const PATTERN_ANTAGONISTS: Record<string, string[]> = {
  horizontal_push: ["horizontal_pull"],
  horizontal_pull: ["horizontal_push"],
  vertical_push: ["vertical_pull"],
  vertical_pull: ["vertical_push"],
  squat: ["hinge"],
  hinge: ["squat"],
};

/**
 * One-line exercise-science role for each pattern (library headers, pickers).
 */
export const PATTERN_SCIENCE: Record<string, string> = {
  mobility:
    "Prep & tissue quality — open ranges you’ll train; don’t fatigue the main lifts.",
  squat:
    "Knee-dominant lower — depth you own; primary strength/hypertrophy driver.",
  hinge:
    "Hip-dominant posterior chain — load the hips, protect the lumbar hinge.",
  horizontal_push:
    "Horizontal pressing — pair with rows for shoulder balance.",
  vertical_push:
    "Overhead pressing — needs scapular upward rotation + trunk stability.",
  horizontal_pull:
    "Horizontal rows — posture, scapular control, balances bench volume.",
  vertical_pull:
    "Vertical pulls — lat + scap depression; balances overhead press.",
  core: "Anti-movement trunk — brace transfer for big lifts; usually last.",
  carry: "Loaded locomotion — posture under fatigue; great finisher.",
  plyometric:
    "Power / elastic — early in the session while fresh; quality over volume.",
  cardio: "Work capacity / conditioning — separate from heavy strength when possible.",
  other: "Accessory or specialty pattern — program with intent.",
};

export const DIFFICULTY_TONE: Record<
  string,
  "default" | "green" | "amber" | "red"
> = {
  beginner: "green",
  intermediate: "default",
  advanced: "amber",
};

export function patternLabel(pattern: string): string {
  return PATTERN_LABEL[pattern] || pattern.replace(/_/g, " ");
}

/** Coach blurb for a movement pattern (science role). */
export function patternScienceBlurb(pattern: string): string {
  const p = (pattern || "other").trim().toLowerCase() || "other";
  return PATTERN_SCIENCE[p] || PATTERN_SCIENCE.other;
}

/** Patterns that balance this one (push↔pull, squat↔hinge). */
export function antagonistPatterns(pattern: string): string[] {
  const p = (pattern || "").trim().toLowerCase();
  return PATTERN_ANTAGONISTS[p] ? [...PATTERN_ANTAGONISTS[p]] : [];
}

/** Sort patterns for library chips / pickers (canonical order). */
export function sortPatternsForUi(patterns: string[]): string[] {
  return [...patterns].sort((a, b) => {
    const ia = PATTERN_ORDER.indexOf(a as (typeof PATTERN_ORDER)[number]);
    const ib = PATTERN_ORDER.indexOf(b as (typeof PATTERN_ORDER)[number]);
    const oa = ia === -1 ? 99 : ia;
    const ob = ib === -1 ? 99 : ib;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b);
  });
}

/** Short coach-facing blurb when an exercise has no description. */
export function defaultExerciseDescription(input: {
  name: string;
  pattern: string;
  muscles: string;
  difficulty?: string;
}): string {
  const pat = patternLabel(input.pattern).toLowerCase();
  const level = input.difficulty || "intermediate";
  const muscles = input.muscles?.trim() || "full body";
  return `${input.name} — ${level} ${pat} emphasis on ${muscles}.`;
}

/** Generic coaching cue by pattern when no exercise-specific cue exists. */
export function defaultExerciseCues(pattern: string): string {
  switch (pattern) {
    case "mobility":
      return "Move pain-free; breathe into end ranges; quality over range.";
    case "squat":
      return "Brace lightly; knees track toes; control depth you own.";
    case "hinge":
      return "Soft knees; hips back; long spine; load close to the body.";
    case "horizontal_push":
      return "Stack ribs over pelvis; full ROM you control; lockout without shrug.";
    case "vertical_push":
      return "Glutes on; ribs down; press in a path that stays pain-free overhead.";
    case "horizontal_pull":
      return "Initiate with scapula; pull to ribs; avoid lumbar yank.";
    case "vertical_pull":
      return "Depress scapula first; drive elbows down; avoid shrugging into the neck.";
    case "core":
      return "Own the brace; move limbs without losing rib-pelvis stack.";
    case "carry":
      return "Tall posture; short steps; pack shoulders; even breathing.";
    case "cardio":
      return "Smooth rhythm; sustainable effort; clean transitions between intervals.";
    case "plyometric":
      return "Soft landings; quiet feet; stop if form degrades.";
    default:
      return "Quality reps only; stop 1–2 reps before form breaks.";
  }
}

/** Resolve cues: exercise-specific first, then pattern default. */
export function resolveExerciseCues(
  cues: string | null | undefined,
  pattern: string | null | undefined
): string {
  const own = (cues || "").trim();
  if (own) return own;
  return defaultExerciseCues(pattern || "other");
}
