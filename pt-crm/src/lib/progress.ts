import {
  compareAssessments,
  overallTrend,
  type AssessmentFieldDef,
  type FieldDelta,
} from "./assessments";
import {
  ALL_MEASUREMENT_FIELDS,
  flattenMeasurementValues,
} from "./measurements";
import type { SessionSetLog } from "@/db/schema";

export type SeriesPoint = {
  date: string; // ISO date yyyy-mm-dd
  label: string;
  value: number;
};

export type MetricSeries = {
  key: string;
  label: string;
  unit: string;
  points: SeriesPoint[];
  latest: number | null;
  first: number | null;
  delta: number | null;
  deltaPct: number | null;
};

export type AssessmentProgressRow = {
  templateId: string;
  name: string;
  timesTested: number;
  baselineAt: string | null;
  latestAt: string | null;
  baselineSummary: string;
  latestSummary: string;
  trend: ReturnType<typeof overallTrend>;
  deltas: FieldDelta[];
};

export type SessionVolumePoint = {
  sessionId: string;
  date: string;
  label: string;
  title: string;
  volumeKg: number;
  setsCompleted: number;
  status: string;
  durationMin: number | null;
  overallRpe: string | null;
};

export type ExerciseBest = {
  exerciseName: string;
  bestWeightKg: number;
  bestReps: string | null;
  lastSeenAt: string | null;
  timesLogged: number;
};

export type WeekVolume = {
  weekStart: string;
  label: string;
  volumeKg: number;
  sessions: number;
};

function toDateKey(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  } catch {
    return null;
  }
}

function shortLabel(d: Date | string | null | undefined): string {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function parseReps(reps: string | null | undefined): number {
  if (!reps) return 0;
  const m = String(reps).match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
}

/** Volume from per-set logs; falls back to top-level weight × sets × reps. */
export function exerciseVolumeKg(log: {
  isWarmup?: boolean | null;
  weightKg?: number | null;
  actualSets?: number | null;
  actualReps?: string | null;
  setLogs?: SessionSetLog[] | null;
}): number {
  if (log.isWarmup) return 0;
  const sets = log.setLogs || [];
  if (sets.length) {
    let vol = 0;
    for (const s of sets) {
      if (!s.completed) continue;
      const w = s.weightKg;
      if (w == null || Number.isNaN(w)) continue;
      const r = parseReps(s.reps);
      vol += w * (r || 1);
    }
    return vol;
  }
  if (log.weightKg != null && !Number.isNaN(log.weightKg)) {
    const setsN = log.actualSets || 0;
    const repsN = parseReps(log.actualReps);
    return log.weightKg * setsN * (repsN || 1);
  }
  return 0;
}

export function countCompletedSets(log: {
  isWarmup?: boolean | null;
  actualSets?: number | null;
  setLogs?: SessionSetLog[] | null;
}): number {
  if (log.isWarmup) return 0;
  const sets = log.setLogs || [];
  if (sets.length) return sets.filter((s) => s.completed).length;
  return log.actualSets || 0;
}

export function buildMetricSeries(
  measurements: Array<{
    takenAt: Date | string | null;
    weightKg?: number | null;
    bodyFatPct?: number | null;
    waistCm?: number | null;
    chestCm?: number | null;
    hipsCm?: number | null;
    heightCm?: number | null;
    metrics?: Record<string, number | string> | null;
  }>
): MetricSeries[] {
  // Chronological for charts
  const sorted = [...measurements].sort((a, b) => {
    const ta = a.takenAt ? new Date(a.takenAt).getTime() : 0;
    const tb = b.takenAt ? new Date(b.takenAt).getTime() : 0;
    return ta - tb;
  });

  return ALL_MEASUREMENT_FIELDS.map((def) => {
    // Height rarely charted as progress
    if (def.key === "heightCm") {
      return {
        key: def.key,
        label: def.label,
        unit: def.unit,
        points: [] as SeriesPoint[],
        latest: null,
        first: null,
        delta: null,
        deltaPct: null,
      };
    }
    const points: SeriesPoint[] = [];
    for (const m of sorted) {
      const flat = flattenMeasurementValues(m);
      const raw = flat[def.key];
      if (typeof raw !== "number" || Number.isNaN(raw)) continue;
      const date = toDateKey(m.takenAt);
      if (!date) continue;
      points.push({
        date,
        label: shortLabel(m.takenAt),
        value: raw,
      });
    }
    if (!points.length) {
      return {
        key: def.key,
        label: def.label,
        unit: def.unit,
        points: [],
        latest: null,
        first: null,
        delta: null,
        deltaPct: null,
      };
    }
    const first = points[0].value;
    const latest = points[points.length - 1].value;
    const delta = latest - first;
    const deltaPct = first !== 0 ? (delta / first) * 100 : null;
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      points,
      latest,
      first,
      delta,
      deltaPct,
    };
  }).filter((s) => s.points.length > 0);
}

export function buildAssessmentProgress(
  rows: Array<{
    assessment: {
      id: string;
      templateId: string;
      takenAt: Date | string | null;
      results: Record<string, unknown>;
      summary: string | null;
    };
    template: {
      id?: string;
      name: string;
      fields?: AssessmentFieldDef[] | null;
    } | null;
  }>
): AssessmentProgressRow[] {
  const byTemplate = new Map<
    string,
    {
      name: string;
      fields: AssessmentFieldDef[];
      history: Array<{
        id: string;
        takenAt: Date | string | null;
        results: Record<string, unknown>;
        summary: string | null;
      }>;
    }
  >();

  for (const row of rows) {
    const tid = row.assessment.templateId;
    if (!byTemplate.has(tid)) {
      byTemplate.set(tid, {
        name: row.template?.name || "Assessment",
        fields: (row.template?.fields || []) as AssessmentFieldDef[],
        history: [],
      });
    }
    byTemplate.get(tid)!.history.push(row.assessment);
  }

  const out: AssessmentProgressRow[] = [];
  for (const [templateId, g] of byTemplate) {
    const history = [...g.history].sort((a, b) => {
      const ta = a.takenAt ? new Date(a.takenAt).getTime() : 0;
      const tb = b.takenAt ? new Date(b.takenAt).getTime() : 0;
      return ta - tb; // oldest first
    });
    const baseline = history[0];
    const latest = history[history.length - 1];
    const deltas =
      history.length > 1
        ? compareAssessments(
            g.fields,
            (baseline.results || {}) as Record<string, unknown>,
            (latest.results || {}) as Record<string, unknown>
          )
        : [];
    out.push({
      templateId,
      name: g.name,
      timesTested: history.length,
      baselineAt: toDateKey(baseline?.takenAt),
      latestAt: toDateKey(latest?.takenAt),
      baselineSummary:
        baseline?.summary ||
        (baseline
          ? Object.entries(baseline.results || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")
          : ""),
      latestSummary:
        latest?.summary ||
        (latest
          ? Object.entries(latest.results || {})
              .map(([k, v]) => `${k}: ${v}`)
              .join("; ")
          : ""),
      trend: overallTrend(deltas),
      deltas,
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildSessionVolume(
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    performedAt: Date | string | null;
    durationMin: number | null;
    overallRpe: string | null;
  }>,
  logsBySession: Map<
    string,
    Array<{
      isWarmup?: boolean | null;
      weightKg?: number | null;
      actualSets?: number | null;
      actualReps?: string | null;
      setLogs?: SessionSetLog[] | null;
    }>
  >
): SessionVolumePoint[] {
  return sessions
    .map((s) => {
      const logs = logsBySession.get(s.id) || [];
      const volumeKg = logs.reduce((sum, l) => sum + exerciseVolumeKg(l), 0);
      const setsCompleted = logs.reduce(
        (sum, l) => sum + countCompletedSets(l),
        0
      );
      return {
        sessionId: s.id,
        date: toDateKey(s.performedAt) || "",
        label: shortLabel(s.performedAt),
        title: s.title,
        volumeKg: Math.round(volumeKg),
        setsCompleted,
        status: s.status,
        durationMin: s.durationMin,
        overallRpe: s.overallRpe,
      };
    })
    .filter((p) => p.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function buildWeeklyVolume(
  points: SessionVolumePoint[],
  weeks = 8
): WeekVolume[] {
  const completed = points.filter((p) => p.status === "completed");
  if (!completed.length) {
    // still show empty weeks? return []
    return [];
  }

  // End at current week (Monday-based ISO-ish)
  const now = new Date();
  const end = startOfWeek(now);
  const buckets: WeekVolume[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(end);
    start.setDate(start.getDate() - i * 7);
    const key = start.toISOString().slice(0, 10);
    const endDay = new Date(start);
    endDay.setDate(endDay.getDate() + 7);
    const inWeek = completed.filter((p) => {
      const d = new Date(p.date + "T12:00:00");
      return d >= start && d < endDay;
    });
    buckets.push({
      weekStart: key,
      label: start.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      volumeKg: inWeek.reduce((s, p) => s + p.volumeKg, 0),
      sessions: inWeek.length,
    });
  }
  return buckets;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  x.setDate(x.getDate() + diff);
  return x;
}

export function buildExerciseBests(
  sessions: Array<{
    id: string;
    performedAt: Date | string | null;
    status: string;
  }>,
  logsBySession: Map<
    string,
    Array<{
      exerciseName: string;
      isWarmup?: boolean | null;
      weightKg?: number | null;
      actualReps?: string | null;
      setLogs?: SessionSetLog[] | null;
    }>
  >,
  limit = 8
): ExerciseBest[] {
  const map = new Map<
    string,
    {
      bestWeightKg: number;
      bestReps: string | null;
      lastSeenAt: string | null;
      timesLogged: number;
    }
  >();

  for (const s of sessions) {
    if (s.status === "cancelled") continue;
    const logs = logsBySession.get(s.id) || [];
    const seenAt = toDateKey(s.performedAt);
    for (const l of logs) {
      if (l.isWarmup) continue;
      const name = (l.exerciseName || "").trim();
      if (!name) continue;

      let bestW = 0;
      let bestReps: string | null = null;
      const sets = l.setLogs || [];
      if (sets.length) {
        for (const set of sets) {
          if (!set.completed || set.weightKg == null) continue;
          if (set.weightKg > bestW) {
            bestW = set.weightKg;
            bestReps = set.reps || null;
          }
        }
      } else if (l.weightKg != null) {
        bestW = l.weightKg;
        bestReps = l.actualReps || null;
      }
      if (bestW <= 0) continue;

      const cur = map.get(name);
      if (!cur) {
        map.set(name, {
          bestWeightKg: bestW,
          bestReps,
          lastSeenAt: seenAt,
          timesLogged: 1,
        });
      } else {
        cur.timesLogged += 1;
        if (bestW > cur.bestWeightKg) {
          cur.bestWeightKg = bestW;
          cur.bestReps = bestReps;
        }
        if (
          seenAt &&
          (!cur.lastSeenAt || seenAt > cur.lastSeenAt)
        ) {
          cur.lastSeenAt = seenAt;
        }
      }
    }
  }

  return Array.from(map.entries())
    .map(([exerciseName, v]) => ({ exerciseName, ...v }))
    .sort((a, b) => b.bestWeightKg - a.bestWeightKg)
    .slice(0, limit);
}

export function daysBetween(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round(Math.abs(tb - ta) / (1000 * 60 * 60 * 24));
}

export function inLastDays(
  date: Date | string | null | undefined,
  days: number
): boolean {
  if (!date) return false;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return false;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}
