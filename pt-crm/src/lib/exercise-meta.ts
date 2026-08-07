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
