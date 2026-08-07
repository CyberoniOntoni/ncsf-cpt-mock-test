import type { SessionSetLog } from "@/db/schema";
import { ensureSetLogs } from "@/lib/session-sets";

type SummaryLog = {
  exerciseName: string;
  completed: boolean;
  setLogs?: SessionSetLog[] | null;
  plannedReps?: string | null;
  plannedSets?: number | null;
  weightKg?: number | null;
  rpe?: string | null;
  actualReps?: string | null;
  setScheme?: string | null;
};

type SummarySession = {
  title: string;
  durationMin?: number | null;
  overallRpe?: string | null;
  painNotes?: string | null;
  notes?: string | null;
  performedAt?: Date | string | null;
  status?: string;
};

/** Build plain-text summary (share / clipboard / notes). */
export function buildSessionSummaryText(input: {
  session: SummarySession;
  clientName?: string | null;
  programTitle?: string | null;
  logs: SummaryLog[];
}): string {
  const { session: row, clientName, programTitle, logs } = input;
  const when = row.performedAt
    ? new Date(row.performedAt).toLocaleString()
    : "";

  let setsLogged = 0;
  let volume = 0;
  for (const l of logs) {
    for (const s of ensureSetLogs(l)) {
      if (!s.completed) continue;
      setsLogged++;
      const reps = parseInt(String(s.reps || "").match(/(\d+)/)?.[1] || "0", 10);
      if (s.weightKg != null && reps > 0) volume += s.weightKg * reps;
    }
  }

  const lines: string[] = [
    `Session: ${row.title}`,
    clientName ? `Client: ${clientName}` : null,
    programTitle ? `Program: ${programTitle}` : null,
    when ? `When: ${when}` : null,
    row.durationMin != null ? `Duration: ${row.durationMin} min` : null,
    row.overallRpe ? `Session RPE: ${row.overallRpe}` : null,
    row.painNotes ? `Pain/flags: ${row.painNotes}` : null,
    setsLogged > 0
      ? `Logged: ${setsLogged} sets${volume > 0 ? ` · ~${Math.round(volume)} kg volume` : ""}`
      : null,
    "",
    "Exercises:",
  ].filter((x): x is string => x != null);

  for (const l of logs) {
    const sets = ensureSetLogs(l);
    const done = sets.filter((s) => s.completed);
    const source = done.length ? done : sets;
    const detail = source
      .map((s) => {
        const rpe = s.rpe ? ` RPE${s.rpe}` : "";
        if (s.weightKg != null) return `${s.reps || "?"}@${s.weightKg}kg${rpe}`;
        return `${s.reps || "—"}${rpe}`;
      })
      .join(", ");
    const mark = l.completed || done.length === sets.length ? "✓" : "·";
    const scheme =
      l.setScheme && l.setScheme !== "straight" ? ` [${l.setScheme}]` : "";
    lines.push(`${mark} ${l.exerciseName}${scheme}: ${detail || "—"}`);
  }

  if (row.notes) {
    lines.push("", `Notes: ${row.notes}`);
  }
  lines.push("", "— logged in FloorScribe");
  return lines.join("\n");
}

/** Relative time for floor UI ("2d ago", "today"). */
export function formatRelativeSessionDay(
  d: Date | string | null | undefined
): string | null {
  if (!d) return null;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startThat = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const days = Math.round(
    (startToday.getTime() - startThat.getTime()) / 86400000
  );
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days > 1 && days < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}
