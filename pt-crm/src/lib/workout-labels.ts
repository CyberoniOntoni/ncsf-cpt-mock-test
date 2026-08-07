/**
 * Clean, coach-facing labels for schemes, roles, and rest in workout UI.
 */

import { getSetScheme, schemeLabel as rawSchemeLabel } from "./set-schemes";

/** Human set-role labels (snake/id → title) */
const SET_ROLE_LABELS: Record<string, string> = {
  work: "Work",
  build: "Build",
  top: "Top",
  "back-off": "Back-off",
  pump: "Pump",
  wave: "Wave",
  main: "Main",
  "drop-1": "Drop 1",
  "drop-2": "Drop 2",
  "drop-3": "Drop 3",
  primary: "Primary",
  "RP-1": "Rest-pause 1",
  "RP-2": "Rest-pause 2",
  "rp-1": "Rest-pause 1",
  "rp-2": "Rest-pause 2",
  cluster: "Cluster",
  activation: "Activation",
  mini: "Mini-set",
  eccentric: "Eccentric",
  tempo: "Tempo",
  heavy: "Strength",
  explosive: "Power",
  complex: "Complex",
  "complex-1": "Move 1",
  "complex-2": "Move 2",
  "complex-3": "Move 3",
  A: "A",
  B: "B",
  amrap: "AMRAP",
  emom: "EMOM",
};

/** Group member role → short badge (A, B, 1…) */
const GROUP_BADGE: Record<string, string> = {
  heavy: "A",
  explosive: "B",
  A: "A",
  B: "B",
  "complex-1": "1",
  "complex-2": "2",
  "complex-3": "3",
};

/** Group member role → full subtitle under exercise name */
const GROUP_ROLE_TITLE: Record<string, string> = {
  heavy: "Strength",
  explosive: "Power / explosive",
  A: "Exercise A",
  B: "Exercise B",
  "complex-1": "First movement",
  "complex-2": "Second movement",
  "complex-3": "Third movement",
};

export function formatSetRole(role: string | null | undefined): string | null {
  if (!role) return null;
  if (SET_ROLE_LABELS[role]) return SET_ROLE_LABELS[role];
  // drop-1 style
  const drop = role.match(/^drop[-_]?(\d+)$/i);
  if (drop) return `Drop ${drop[1]}`;
  // complex-N
  const cx = role.match(/^complex[-_]?(\d+)$/i);
  if (cx) return `Move ${cx[1]}`;
  // Title-case fallback
  return role
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatGroupBadge(
  groupRole: string | null | undefined,
  index = 0
): string {
  if (groupRole && GROUP_BADGE[groupRole]) return GROUP_BADGE[groupRole];
  if (groupRole && GROUP_BADGE[groupRole.toLowerCase()]) {
    return GROUP_BADGE[groupRole.toLowerCase()];
  }
  if (groupRole && /^[A-Z]$/i.test(groupRole)) return groupRole.toUpperCase();
  if (groupRole && /^\d+$/.test(groupRole)) return groupRole;
  return String.fromCharCode(65 + index); // A, B, C…
}

export function formatGroupRoleTitle(
  groupRole: string | null | undefined
): string | null {
  if (!groupRole) return null;
  if (GROUP_ROLE_TITLE[groupRole]) return GROUP_ROLE_TITLE[groupRole];
  return formatSetRole(groupRole);
}

/** Clean scheme name for badges */
export function formatSchemeName(id: string | null | undefined): string {
  if (!id) return "Straight";
  return rawSchemeLabel(id);
}

export function formatSchemeFullName(id: string | null | undefined): string {
  return getSetScheme(id).label;
}

/** Rest for floor: "Rest 75s", "Rest 2 min", "No rest" */
export function formatRestLabel(sec: number | null | undefined): string {
  if (sec == null) return "";
  if (sec <= 0) return "No rest";
  if (sec < 60) return `Rest ${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (!s) return `Rest ${m} min`;
  return `Rest ${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Rest cue for a set row — EMOM uses the 60s clock (rest = remainder of the minute).
 */
export function formatSetRestLabel(opts: {
  restSec?: number | null;
  role?: string | null;
  setScheme?: string | null;
}): string {
  const isEmom =
    opts.setScheme === "emom" ||
    opts.role === "emom" ||
    /emom/i.test(opts.role || "");
  if (isEmom) {
    const sec =
      opts.restSec != null && opts.restSec > 0 ? opts.restSec : 60;
    if (sec === 60) return "EMOM · rest remainder of minute";
    return `EMOM · ${formatRestLabel(sec)} to next minute`;
  }
  return formatRestLabel(opts.restSec);
}

/** Compact prescription e.g. "3 × 8–10 · RPE 7–8" */
export function formatPrescription(opts: {
  sets?: number | null;
  reps?: string | null;
  rpe?: string | null;
  summary?: string | null;
}): string {
  if (opts.summary?.trim()) {
    // Clean noisy summaries: "RPT heavy→lighter" ok; strip " · " chains if too long
    const s = opts.summary.trim();
    if (s.length <= 42) return s;
  }
  const sets = opts.sets != null ? String(opts.sets) : null;
  const reps = opts.reps?.replace(/-/g, "–") || null;
  const parts: string[] = [];
  if (sets && reps) parts.push(`${sets} × ${reps}`);
  else if (reps) parts.push(reps);
  else if (sets) parts.push(`${sets} sets`);
  if (opts.rpe) parts.push(`RPE ${opts.rpe}`);
  return parts.join(" · ") || "—";
}

/** Pattern slug → short label */
export function formatPattern(pattern: string | null | undefined): string | null {
  if (!pattern) return null;
  const map: Record<string, string> = {
    squat: "Squat",
    hinge: "Hinge",
    horizontal_push: "Push",
    vertical_push: "Overhead",
    horizontal_pull: "Row",
    vertical_pull: "Pull-up",
    carry: "Carry",
    core: "Core",
    mobility: "Mobility",
    cardio: "Cardio",
    plyometric: "Power",
    other: "Other",
  };
  return map[pattern] || pattern.replace(/_/g, " ");
}

/** Set note cleanup — drop redundant filler */
export function formatSetNote(note: string | null | undefined): string | null {
  if (!note?.trim()) return null;
  let n = note.trim();
  // Shorten common builder phrases
  n = n
    .replace(/^Round (\d+)\/(\d+)$/i, "Round $1 of $2")
    .replace(/·/g, "·")
    .replace(/\s+/g, " ");
  if (n.length > 48) n = n.slice(0, 46) + "…";
  return n;
}

/** Tempo display */
export function formatTempo(tempo: string | null | undefined): string | null {
  if (!tempo?.trim()) return null;
  return `Tempo ${tempo.trim()}`;
}

/** Group title for amber banner */
export function formatGroupTitle(
  kind: string | null | undefined,
  label: string | null | undefined
): string {
  const scheme = formatSchemeName(kind);
  if (label && label !== scheme && !label.toLowerCase().includes(scheme.toLowerCase())) {
    return `${scheme} · ${label}`;
  }
  if (label) return label;
  return scheme;
}

/** Flow line: A → B → C with clean names */
export function formatGroupFlow(
  members: Array<{ groupRole?: string | null; exerciseName: string }>
): string {
  return members
    .map((m, i) => {
      const badge = formatGroupBadge(m.groupRole, i);
      const title = formatGroupRoleTitle(m.groupRole);
      if (title && title !== badge) return `${badge} ${title}`;
      return badge;
    })
    .join("  →  ");
}
