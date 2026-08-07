/**
 * EMOM wall-clock helpers (every minute on the minute).
 * Pure timing math — no React, no DB.
 */

/** Standard EMOM clock interval (work + rest remainder of the minute). */
export const EMOM_INTERVAL_SEC = 60;

/**
 * Seconds until the next wall-clock minute boundary.
 * Returns ceil seconds in 1..60; if exactly on the mark, returns 60 (next full minute).
 */
export function secondsUntilNextMinuteMark(now: Date = new Date()): number {
  const msIntoMinute = now.getTime() % 60_000;
  if (msIntoMinute === 0) return 60;
  return Math.ceil((60_000 - msIntoMinute) / 1000);
}

/**
 * Rest remaining for an EMOM set before the next work window.
 *
 * Prefer workStartedAt: rest = intervalSec − elapsed work, clamped 5..intervalSec.
 * Else workEndedAt: rest until the next minute mark from that timestamp.
 * Else: rest until the next minute mark from now.
 */
export function emomRestSeconds(opts: {
  workStartedAt?: Date | null;
  workEndedAt?: Date | null;
  now?: Date;
  intervalSec?: number;
}): number {
  const intervalSec = opts.intervalSec ?? EMOM_INTERVAL_SEC;
  const now = opts.now ?? new Date();

  if (opts.workStartedAt != null) {
    const elapsedSec =
      (now.getTime() - opts.workStartedAt.getTime()) / 1000;
    const rest = Math.ceil(intervalSec - elapsedSec);
    return Math.min(intervalSec, Math.max(5, rest));
  }

  if (opts.workEndedAt != null) {
    return secondsUntilNextMinuteMark(opts.workEndedAt);
  }

  return secondsUntilNextMinuteMark(now);
}

/** True when scheme id or set role indicates EMOM. */
export function isEmomScheme(
  setScheme?: string | null,
  role?: string | null
): boolean {
  return (
    setScheme === "emom" ||
    role === "emom" ||
    /emom/i.test(role || "") ||
    /emom/i.test(setScheme || "")
  );
}

/** Coach-facing rest cue, e.g. "EMOM · 0:42 to next minute". */
export function formatEmomRestLabel(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `EMOM · ${m}:${String(s).padStart(2, "0")} to next minute`;
}
