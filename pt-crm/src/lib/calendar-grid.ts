/**
 * Pure month-grid helpers for FloorScribe calendar (local timezone).
 */

export type CalendarDayCell = {
  /** Local calendar date YYYY-MM-DD */
  dateKey: string;
  year: number;
  month: number; // 1–12
  day: number;
  /** Day falls outside the focused month */
  outside: boolean;
  isToday: boolean;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Local date key from a Date (uses local Y/M/D). */
export function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Parse YYYY-MM-DD as local midnight. */
export function parseLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) {
    return null;
  }
  return dt;
}

/** datetime-local value for 9:00 on a local date key. */
export function bookAtLocalFromDateKey(dateKey: string, hour = 9, minute = 0): string {
  const d = parseLocalDateKey(dateKey);
  if (!d) return "";
  d.setHours(hour, minute, 0, 0);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Build a Sunday-start month grid (6 weeks × 7 days).
 * @param year full year
 * @param month 1–12
 */
export function buildMonthGrid(year: number, month: number): CalendarDayCell[] {
  const todayKey = toLocalDateKey(new Date());
  const first = new Date(year, month - 1, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const gridStart = new Date(year, month - 1, 1 - startOffset);
  const cells: CalendarDayCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + i
    );
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const dateKey = `${y}-${pad2(m)}-${pad2(day)}`;
    cells.push({
      dateKey,
      year: y,
      month: m,
      day,
      outside: m !== month || y !== year,
      isToday: dateKey === todayKey,
    });
  }
  return cells;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number
): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function monthTitle(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

/** Inclusive range covering the full Sunday–Sat grid for a month. */
export function monthGridRange(year: number, month: number): {
  rangeStart: Date;
  rangeEnd: Date;
} {
  const cells = buildMonthGrid(year, month);
  const first = parseLocalDateKey(cells[0]!.dateKey)!;
  const last = parseLocalDateKey(cells[cells.length - 1]!.dateKey)!;
  const rangeEnd = new Date(last);
  rangeEnd.setHours(23, 59, 59, 999);
  return { rangeStart: first, rangeEnd };
}

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
