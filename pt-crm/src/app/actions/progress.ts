"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  assessmentTemplates,
  clientAssessments,
  clientMeasurements,
  clients,
  sessionExerciseLogs,
  trainingSessions,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  buildAssessmentProgress,
  buildExerciseBests,
  buildMetricSeries,
  buildSessionVolume,
  buildWeeklyVolume,
  inLastDays,
  type AssessmentProgressRow,
  type ExerciseBest,
  type MetricSeries,
  type SessionVolumePoint,
  type WeekVolume,
} from "@/lib/progress";
import { ensureSetLogs } from "@/lib/session-sets";

export type ClientProgressData = {
  clientId: string;
  clientName: string;
  metrics: MetricSeries[];
  assessments: AssessmentProgressRow[];
  sessionVolumes: SessionVolumePoint[];
  weeklyVolume: WeekVolume[];
  exerciseBests: ExerciseBest[];
  stats: {
    sessionsTotal: number;
    sessionsCompleted: number;
    sessionsLast30: number;
    volumeLast30Kg: number;
    volumeAllKg: number;
    screensWithRetest: number;
    screensImproved: number;
    screensDeclined: number;
    lastSessionAt: string | null;
    activeDaysSpan: number | null;
  };
};

export async function getClientProgressAction(
  clientId: string
): Promise<ClientProgressData | null> {
  const session = await requireSession();
  const db = await getDb();

  const [client] = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!client) return null;

  const measurements = await db
    .select()
    .from(clientMeasurements)
    .where(eq(clientMeasurements.clientId, clientId))
    .orderBy(desc(clientMeasurements.takenAt));

  const assessmentRows = await db
    .select({
      assessment: clientAssessments,
      template: assessmentTemplates,
    })
    .from(clientAssessments)
    .leftJoin(
      assessmentTemplates,
      eq(clientAssessments.templateId, assessmentTemplates.id)
    )
    .where(eq(clientAssessments.clientId, clientId))
    .orderBy(desc(clientAssessments.takenAt));

  const sessions = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.clientId, clientId)
      )
    )
    .orderBy(desc(trainingSessions.performedAt))
    .limit(80);

  const logsBySession = new Map<
    string,
    Array<{
      exerciseName: string;
      isWarmup?: boolean | null;
      weightKg?: number | null;
      actualSets?: number | null;
      actualReps?: string | null;
      setLogs?: ReturnType<typeof ensureSetLogs> | null;
    }>
  >();

  if (sessions.length) {
    const ids = sessions.map((s) => s.id);
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(inArray(sessionExerciseLogs.sessionId, ids));

    for (const log of logs) {
      const list = logsBySession.get(log.sessionId) || [];
      list.push({
        exerciseName: log.exerciseName,
        isWarmup: log.isWarmup,
        weightKg: log.weightKg,
        actualSets: log.actualSets,
        actualReps: log.actualReps,
        setLogs: ensureSetLogs(log),
      });
      logsBySession.set(log.sessionId, list);
    }
  }

  const metrics = buildMetricSeries(measurements);
  const assessments = buildAssessmentProgress(
    assessmentRows.map((r) => ({
      assessment: {
        id: r.assessment.id,
        templateId: r.assessment.templateId,
        takenAt: r.assessment.takenAt,
        results: (r.assessment.results || {}) as Record<string, unknown>,
        summary: r.assessment.summary,
      },
      template: r.template
        ? {
            id: r.template.id,
            name: r.template.name,
            fields: r.template.fields,
          }
        : null,
    }))
  );

  const sessionVolumes = buildSessionVolume(sessions, logsBySession);
  const weeklyVolume = buildWeeklyVolume(sessionVolumes, 8);
  const exerciseBests = buildExerciseBests(sessions, logsBySession, 8);

  const completed = sessionVolumes.filter((s) => s.status === "completed");
  const last30 = completed.filter((s) => inLastDays(s.date, 30));
  const volumeLast30Kg = last30.reduce((a, s) => a + s.volumeKg, 0);
  const volumeAllKg = completed.reduce((a, s) => a + s.volumeKg, 0);

  const retests = assessments.filter((a) => a.timesTested > 1);
  const screensImproved = retests.filter((a) => a.trend === "improved").length;
  const screensDeclined = retests.filter((a) => a.trend === "declined").length;

  const lastSession = sessions[0];
  const firstSession = sessions.length
    ? sessions[sessions.length - 1]
    : null;
  let activeDaysSpan: number | null = null;
  if (firstSession?.performedAt && lastSession?.performedAt) {
    const a = new Date(firstSession.performedAt).getTime();
    const b = new Date(lastSession.performedAt).getTime();
    if (!Number.isNaN(a) && !Number.isNaN(b)) {
      activeDaysSpan = Math.max(
        0,
        Math.round(Math.abs(b - a) / (1000 * 60 * 60 * 24))
      );
    }
  }

  return {
    clientId,
    clientName: [client.firstName, client.lastName].filter(Boolean).join(" "),
    metrics,
    assessments,
    sessionVolumes,
    weeklyVolume,
    exerciseBests,
    stats: {
      sessionsTotal: sessions.length,
      sessionsCompleted: completed.length,
      sessionsLast30: last30.length,
      volumeLast30Kg,
      volumeAllKg,
      screensWithRetest: retests.length,
      screensImproved,
      screensDeclined,
      lastSessionAt: lastSession?.performedAt
        ? new Date(lastSession.performedAt).toISOString()
        : null,
      activeDaysSpan,
    },
  };
}
