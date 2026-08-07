"use server";

import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  clientAppointments,
  clients,
  clientNotes,
  exercises,
  programDays,
  programExercises,
  programs,
  sessionExerciseLogs,
  trainingSessions,
  type SessionSetLog,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { defaultExerciseCues } from "@/lib/exercise-meta";
import { aggregateFromSetLogs, ensureSetLogs } from "@/lib/session-sets";
import {
  formatLastPerformance,
  suggestProgression,
  type ProgressionSuggestion,
} from "@/lib/progression";
import {
  isProgramMetaDump,
  seedSessionNotes,
} from "@/lib/session-notes";
import { assertClientInOrg, getClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";

export async function findInProgressSessionForDayAction(programDayId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.programDayId, programDayId),
        eq(trainingSessions.status, "in_progress")
      )
    )
    .orderBy(desc(trainingSessions.updatedAt))
    .limit(1);
  return row || null;
}

/** Bidirectional booking ↔ floor log link (idempotent). */
async function linkSessionAndAppointment(
  sessionId: string,
  appointmentId: string,
  clientId: string | null | undefined
) {
  const db = await getDb();
  await db
    .update(trainingSessions)
    .set({ appointmentId, updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));
  await db
    .update(clientAppointments)
    .set({ sessionId })
    .where(
      clientId
        ? and(
            eq(clientAppointments.id, appointmentId),
            eq(clientAppointments.clientId, clientId)
          )
        : eq(clientAppointments.id, appointmentId)
    );
  revalidatePath("/calendar");
  revalidatePath("/");
  if (clientId) revalidatePath(`/clients/${clientId}`);
}

/**
 * Start (or resume) a floor session from a booked appointment.
 * Uses the client's active program first day when no session is linked yet.
 */
export async function startSessionFromAppointmentAction(appointmentId: string) {
  const session = await requireSession();
  const db = await getDb();
  const orgId = session.organizationId;

  const [appt] = await db
    .select({
      appt: clientAppointments,
      clientOrg: clients.organizationId,
    })
    .from(clientAppointments)
    .innerJoin(clients, eq(clientAppointments.clientId, clients.id))
    .where(eq(clientAppointments.id, appointmentId))
    .limit(1);

  if (!appt || appt.clientOrg !== orgId) {
    throw new Error("Appointment not found");
  }
  const row = appt.appt;
  if (row.status === "cancelled") {
    throw new Error("This booking was cancelled");
  }

  // Resume linked in-progress session
  if (row.sessionId) {
    const [linked] = await db
      .select()
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.id, row.sessionId),
          eq(trainingSessions.organizationId, orgId)
        )
      )
      .limit(1);
    if (linked?.status === "in_progress") {
      return {
        sessionId: linked.id,
        resumed: true as const,
        clientId: row.clientId,
      };
    }
    if (linked?.status === "completed") {
      // Point trainer at the log instead of starting a second floor day
      return {
        sessionId: linked.id,
        resumed: false as const,
        clientId: row.clientId,
        alreadyCompleted: true as const,
      };
    }
    // Cancelled / missing log — clear stale link and continue to start
    if (!linked || linked.status === "cancelled") {
      await db
        .update(clientAppointments)
        .set({ sessionId: null })
        .where(eq(clientAppointments.id, row.id));
    }
  }

  // Active program → first day
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, orgId),
        eq(programs.clientId, row.clientId),
        eq(programs.status, "active")
      )
    )
    .orderBy(desc(programs.updatedAt))
    .limit(1);

  if (!program) {
    throw new Error(
      "No active program for this client — design a plan before starting from the booking"
    );
  }

  const [day] = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, program.id))
    .orderBy(asc(programDays.dayIndex))
    .limit(1);
  if (!day) {
    throw new Error("Program has no days");
  }

  const res = await startSessionFromProgramDayAction(day.id, {
    appointmentId: row.id,
  });
  revalidatePath("/calendar");
  revalidatePath(`/clients/${row.clientId}`);
  revalidatePath("/");
  return {
    sessionId: res.sessionId,
    resumed: res.resumed,
    clientId: row.clientId,
  };
}

/**
 * Start a new session for a program day, or resume an existing in-progress one.
 */
export async function startSessionFromProgramDayAction(
  programDayId: string,
  opts?: { forceNew?: boolean; appointmentId?: string | null }
) {
  const session = await requireSession();
  const db = await getDb();
  const appointmentId = opts?.appointmentId?.trim() || null;

  if (!opts?.forceNew) {
    const existing = await findInProgressSessionForDayAction(programDayId);
    if (existing) {
      // Attach booking to an already-open day log when starting from calendar
      if (appointmentId && !existing.appointmentId) {
        await linkSessionAndAppointment(existing.id, appointmentId, existing.clientId);
      }
      return { sessionId: existing.id, resumed: true as const };
    }
  }

  const [day] = await db
    .select()
    .from(programDays)
    .where(eq(programDays.id, programDayId))
    .limit(1);
  if (!day) throw new Error("Program day not found");

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, day.programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  const dayExercises = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, day.id))
    .orderBy(asc(programExercises.sortOrder));

  // Prefill weights from last completed session for this client when possible
  const lastByKey = await loadLastSetLogsMap(
    session.organizationId,
    program.clientId
  );

  const sessionId = id("ses");
  const title = `${day.name} · ${program.title}`;

  await db.insert(trainingSessions).values({
    id: sessionId,
    organizationId: session.organizationId,
    clientId: program.clientId,
    programId: program.id,
    programDayId: day.id,
    createdByUserId: session.userId,
    title,
    status: "in_progress",
    performedAt: new Date(),
    appointmentId: appointmentId,
  });

  if (appointmentId) {
    await linkSessionAndAppointment(sessionId, appointmentId, program.clientId);
  }

  const { initSetLogsFromScheme } = await import("@/lib/set-schemes");

  // Bank cues for floor coaching — seed into log notes when program has none
  const exerciseIds = [
    ...new Set(
      dayExercises
        .map((e) => e.exerciseId)
        .filter((x): x is string => typeof x === "string" && x.length > 0)
    ),
  ];
  const bankCueById = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const bankRows = await db
      .select({ id: exercises.id, cues: exercises.cues })
      .from(exercises)
      .where(inArray(exercises.id, exerciseIds));
    for (const row of bankRows) {
      const cue = row.cues?.trim();
      if (cue) bankCueById.set(row.id, cue);
    }
  }

  for (const ex of dayExercises) {
    const key = exerciseKey(ex.exerciseId, ex.exerciseName);
    const prevSets = lastByKey.get(key) || null;
    const scheme = ex.setScheme || "straight";
    const schemeMeta = ex.setSchemeMeta || null;
    const setLogs = initSetLogsFromScheme(
      scheme,
      schemeMeta,
      ex.sets,
      ex.reps,
      prevSets
    );
    const agg = aggregateFromSetLogs(setLogs);

    // Prefer short program notes; else bank cue; never seed meta dumps
    const seededNotes = seedSessionNotes({
      programNotes: ex.notes,
      bankCue: ex.exerciseId ? bankCueById.get(ex.exerciseId) : null,
    });

    await db.insert(sessionExerciseLogs).values({
      id: id("sel"),
      sessionId,
      programExerciseId: ex.id,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      movementPattern: ex.movementPattern,
      sortOrder: ex.sortOrder,
      isWarmup: ex.isWarmup,
      plannedSets: setLogs.length || ex.sets,
      plannedReps: ex.reps,
      actualSets: agg.actualSets,
      actualReps: agg.actualReps,
      weightKg: agg.weightKg,
      rpe: ex.rpe,
      completed: false,
      notes: seededNotes,
      setLogs,
      setScheme: scheme,
      setSchemeMeta: schemeMeta,
      groupId: ex.groupId || null,
      groupKind: ex.groupKind || null,
      groupLabel: ex.groupLabel || null,
      groupOrder: ex.groupOrder ?? null,
      restAfterSec: ex.restAfterSec ?? null,
      restBetweenRoundsSec: ex.restBetweenRoundsSec ?? null,
      groupRole: ex.groupRole || null,
    });
  }

  revalidatePath(`/programs/${program.id}`);
  if (program.clientId) revalidatePath(`/clients/${program.clientId}`);
  revalidatePath("/sessions");
  return { sessionId, resumed: false as const };
}

function exerciseKey(exerciseId: string | null | undefined, name: string) {
  return exerciseId || `name:${name.toLowerCase().trim()}`;
}

async function loadLastSetLogsMap(
  organizationId: string,
  clientId: string | null
): Promise<Map<string, SessionSetLog[]>> {
  const map = new Map<string, SessionSetLog[]>();
  if (!clientId) return map;

  const db = await getDb();
  const completed = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, organizationId),
        eq(trainingSessions.clientId, clientId),
        eq(trainingSessions.status, "completed")
      )
    )
    .orderBy(desc(trainingSessions.performedAt))
    .limit(15);

  for (const s of completed) {
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(eq(sessionExerciseLogs.sessionId, s.id));
    for (const log of logs) {
      const key = exerciseKey(log.exerciseId, log.exerciseName);
      if (map.has(key)) continue;
      const sets = ensureSetLogs(log);
      if (sets.some((x) => x.weightKg != null || x.completed)) {
        map.set(key, sets);
      }
    }
  }
  return map;
}

/** Last logged sets for one exercise (for copy button). */
export async function getLastWeightsForExerciseAction(opts: {
  clientId?: string | null;
  exerciseId?: string | null;
  exerciseName: string;
  excludeSessionId?: string;
  plannedReps?: string | null;
}) {
  const session = await requireSession();
  if (!opts.clientId) return { setLogs: [] as SessionSetLog[] };
  await assertClientInOrg(opts.clientId, session.organizationId);

  const db = await getDb();
  const completed = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.clientId, opts.clientId),
        eq(trainingSessions.status, "completed")
      )
    )
    .orderBy(desc(trainingSessions.performedAt))
    .limit(20);

  for (const s of completed) {
    if (opts.excludeSessionId && s.id === opts.excludeSessionId) continue;
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(eq(sessionExerciseLogs.sessionId, s.id));
    for (const log of logs) {
      const matchId =
        opts.exerciseId && log.exerciseId && opts.exerciseId === log.exerciseId;
      const matchName =
        log.exerciseName.toLowerCase().trim() ===
        opts.exerciseName.toLowerCase().trim();
      if (!matchId && !matchName) continue;
      const sets = ensureSetLogs(log);
      if (sets.some((x) => x.weightKg != null || x.completed)) {
        return {
          setLogs: sets,
          sessionTitle: s.title,
          performedAt: s.performedAt,
          lastLine: formatLastPerformance(sets),
          suggestion: suggestProgression({
            plannedReps: opts.plannedReps ?? log.plannedReps,
            lastSets: sets,
          }),
        };
      }
    }
  }
  return { setLogs: [] as SessionSetLog[] };
}

export type PreviousLoadEntry = {
  setLogs: SessionSetLog[];
  lastLine: string | null;
  sessionTitle: string | null;
  performedAt: Date | string | null;
  suggestion: ProgressionSuggestion | null;
};

/**
 * Batch last-performance + progression for every exercise on a session
 * (floor logger header / suggestions).
 */
export async function getPreviousLoadsForSessionAction(sessionId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row?.clientId) return {} as Record<string, PreviousLoadEntry>;

  const logs = await db
    .select()
    .from(sessionExerciseLogs)
    .where(eq(sessionExerciseLogs.sessionId, sessionId));

  const lastByKey = await loadLastSetLogsMapDetailed(
    session.organizationId,
    row.clientId,
    sessionId
  );

  const out: Record<string, PreviousLoadEntry> = {};
  for (const log of logs) {
    const key = exerciseKey(log.exerciseId, log.exerciseName);
    const hit = lastByKey.get(key);
    if (!hit) continue;
    out[log.id] = {
      setLogs: hit.setLogs,
      lastLine: formatLastPerformance(hit.setLogs),
      sessionTitle: hit.sessionTitle,
      performedAt: hit.performedAt,
      suggestion: suggestProgression({
        plannedReps: log.plannedReps,
        lastSets: hit.setLogs,
      }),
    };
  }
  return out;
}

export type ExerciseCueEntry = {
  cue: string;
  source: "notes" | "bank" | "pattern";
};

/**
 * Floor coaching cues per session log: coach notes → bank cues → pattern default.
 * Fail-soft: empty map on error / missing catalog.
 */
export async function getExerciseCuesForSessionAction(
  sessionId: string
): Promise<Record<string, ExerciseCueEntry>> {
  try {
    const session = await requireSession();
    const db = await getDb();
    const [row] = await db
      .select({ id: trainingSessions.id })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingSessions.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (!row) return {};

    const logs = await db
      .select({
        id: sessionExerciseLogs.id,
        exerciseId: sessionExerciseLogs.exerciseId,
        notes: sessionExerciseLogs.notes,
        movementPattern: sessionExerciseLogs.movementPattern,
      })
      .from(sessionExerciseLogs)
      .where(eq(sessionExerciseLogs.sessionId, sessionId));

    const exerciseIds = [
      ...new Set(
        logs
          .map((l) => l.exerciseId)
          .filter((x): x is string => typeof x === "string" && x.length > 0)
      ),
    ];

    const bankById = new Map<string, string | null>();
    if (exerciseIds.length > 0) {
      const rows = await db
        .select({
          id: exercises.id,
          cues: exercises.cues,
          movementPattern: exercises.movementPattern,
        })
        .from(exercises)
        .where(inArray(exercises.id, exerciseIds));
      for (const e of rows) {
        bankById.set(e.id, e.cues);
      }
    }

    const out: Record<string, ExerciseCueEntry> = {};
    for (const log of logs) {
      const note = log.notes?.trim() || "";
      // Prefer short coach notes; skip mesocycle/scheme dump for floor cue strip
      const noteIsCue = note.length > 0 && !isProgramMetaDump(note);
      if (noteIsCue) {
        out[log.id] = { cue: note, source: "notes" };
        continue;
      }
      if (log.exerciseId) {
        const bank = bankById.get(log.exerciseId)?.trim();
        if (bank) {
          out[log.id] = { cue: bank, source: "bank" };
          continue;
        }
      }
      // First clause of long notes (before " · ") often has the real cue
      if (note) {
        const first = note.split(/\s*·\s*/)[0]?.trim();
        if (first && !isProgramMetaDump(first) && first.length <= 120) {
          out[log.id] = { cue: first, source: "notes" };
          continue;
        }
      }
      const pattern = (log.movementPattern || "other").trim() || "other";
      const fallback = defaultExerciseCues(pattern).trim();
      if (fallback) {
        out[log.id] = { cue: fallback, source: "pattern" };
      }
    }
    return out;
  } catch {
    return {};
  }
}

async function loadLastSetLogsMapDetailed(
  organizationId: string,
  clientId: string,
  excludeSessionId?: string
): Promise<
  Map<
    string,
    {
      setLogs: SessionSetLog[];
      sessionTitle: string | null;
      performedAt: Date | string | null;
    }
  >
> {
  const map = new Map<
    string,
    {
      setLogs: SessionSetLog[];
      sessionTitle: string | null;
      performedAt: Date | string | null;
    }
  >();
  const db = await getDb();
  const completed = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, organizationId),
        eq(trainingSessions.clientId, clientId),
        eq(trainingSessions.status, "completed")
      )
    )
    .orderBy(desc(trainingSessions.performedAt))
    .limit(15);

  for (const s of completed) {
    if (excludeSessionId && s.id === excludeSessionId) continue;
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(eq(sessionExerciseLogs.sessionId, s.id));
    for (const log of logs) {
      const key = exerciseKey(log.exerciseId, log.exerciseName);
      if (map.has(key)) continue;
      const sets = ensureSetLogs(log);
      if (sets.some((x) => x.weightKg != null || x.completed)) {
        map.set(key, {
          setLogs: sets,
          sessionTitle: s.title,
          performedAt: s.performedAt,
        });
      }
    }
  }
  return map;
}

/** Plain-text session summary for share / clipboard / client notes. */
export async function getSessionSummaryTextAction(sessionId: string) {
  const data = await getSessionAction(sessionId);
  if (!data) throw new Error("Session not found");
  const { session: row, client, program, logs } = data;
  const { buildSessionSummaryText } = await import("@/lib/session-summary");
  return buildSessionSummaryText({
    session: row,
    clientName: client
      ? [client.firstName, client.lastName].filter(Boolean).join(" ")
      : "Client",
    programTitle: program?.title,
    logs,
  });
}

export async function getSessionAction(sessionId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) return null;

  let client = null;
  if (row.clientId) {
    client = await getClientInOrg(row.clientId, session.organizationId);
  }

  let program = null;
  if (row.programId) {
    const [p] = await db
      .select()
      .from(programs)
      .where(
        and(
          eq(programs.id, row.programId),
          eq(programs.organizationId, session.organizationId)
        )
      )
      .limit(1);
    program = p || null;
  }

  const logs = await db
    .select()
    .from(sessionExerciseLogs)
    .where(eq(sessionExerciseLogs.sessionId, sessionId))
    .orderBy(asc(sessionExerciseLogs.sortOrder));

  // Normalize setLogs for UI
  const normalized = logs.map((l) => ({
    ...l,
    setLogs: ensureSetLogs(l),
  }));

  return { session: row, client, program, logs: normalized };
}

export async function listSessionsAction(opts?: {
  clientId?: string;
  programId?: string;
  limit?: number;
  status?: string;
}) {
  const session = await requireSession();
  const db = await getDb();
  const limit = opts?.limit ?? 40;

  let rows = await db
    .select({
      session: trainingSessions,
      clientFirst: clients.firstName,
      clientLast: clients.lastName,
    })
    .from(trainingSessions)
    .leftJoin(clients, eq(trainingSessions.clientId, clients.id))
    .where(eq(trainingSessions.organizationId, session.organizationId))
    .orderBy(desc(trainingSessions.updatedAt))
    .limit(100);

  if (opts?.clientId) {
    rows = rows.filter((r) => r.session.clientId === opts.clientId);
  }
  if (opts?.programId) {
    rows = rows.filter((r) => r.session.programId === opts.programId);
  }
  if (opts?.status) {
    rows = rows.filter((r) => r.session.status === opts.status);
  }

  return rows.slice(0, limit).map((r) => ({
    ...r.session,
    clientName:
      r.clientFirst != null
        ? [r.clientFirst, r.clientLast].filter(Boolean).join(" ")
        : null,
  }));
}

export type SessionExerciseUpdate = {
  id: string;
  actualSets?: number | null;
  actualReps?: string | null;
  weightKg?: number | null;
  rpe?: string | null;
  completed?: boolean;
  notes?: string | null;
  setLogs?: SessionSetLog[];
};

export async function saveSessionProgressAction(
  sessionId: string,
  data: {
    durationMin?: number | null;
    overallRpe?: string | null;
    painNotes?: string | null;
    notes?: string | null;
    performedAt?: string | null;
    exercises: SessionExerciseUpdate[];
  }
) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");
  if (row.status === "cancelled") throw new Error("Session was cancelled");

  await db
    .update(trainingSessions)
    .set({
      durationMin:
        data.durationMin !== undefined ? data.durationMin : row.durationMin,
      overallRpe:
        data.overallRpe !== undefined ? data.overallRpe : row.overallRpe,
      painNotes: data.painNotes !== undefined ? data.painNotes : row.painNotes,
      notes: data.notes !== undefined ? data.notes : row.notes,
      performedAt: data.performedAt
        ? new Date(data.performedAt)
        : row.performedAt,
      updatedAt: new Date(),
    })
    .where(eq(trainingSessions.id, sessionId));

  for (const ex of data.exercises) {
    const patch: Record<string, unknown> = {};
    if (ex.setLogs) {
      // Preserve scheme fields (role, tempo, rest, note) — never strip them
      const setLogs = ex.setLogs.map((s, i) => ({
        setIndex: s.setIndex || i + 1,
        reps: s.reps || "",
        weightKg: s.weightKg ?? null,
        rpe: s.rpe ?? null,
        completed: !!s.completed,
        role: s.role ?? null,
        tempo: s.tempo ?? null,
        restSec: s.restSec ?? null,
        note: s.note ?? null,
        pain: s.pain ?? null,
      }));
      const agg = aggregateFromSetLogs(setLogs);
      patch.setLogs = setLogs;
      patch.actualSets = agg.actualSets;
      patch.actualReps = agg.actualReps;
      patch.weightKg = agg.weightKg;
      // Keep session RPE from set logs when present; don't overwrite with empty
      if (agg.rpe) patch.rpe = agg.rpe;
      else if (ex.rpe !== undefined) patch.rpe = ex.rpe;
      patch.completed =
        ex.completed !== undefined ? ex.completed : agg.completed;
    } else {
      if (ex.actualSets !== undefined) patch.actualSets = ex.actualSets;
      if (ex.actualReps !== undefined) patch.actualReps = ex.actualReps;
      if (ex.weightKg !== undefined) patch.weightKg = ex.weightKg;
      if (ex.rpe !== undefined) patch.rpe = ex.rpe;
      if (ex.completed !== undefined) patch.completed = ex.completed;
    }
    if (ex.notes !== undefined) patch.notes = ex.notes;

    if (Object.keys(patch).length) {
      await db
        .update(sessionExerciseLogs)
        .set(patch)
        .where(
          and(
            eq(sessionExerciseLogs.id, ex.id),
            eq(sessionExerciseLogs.sessionId, sessionId)
          )
        );
    }
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  return { ok: true };
}

export async function completeSessionAction(
  sessionId: string,
  data: {
    durationMin?: number | null;
    overallRpe?: string | null;
    painNotes?: string | null;
    notes?: string | null;
    exercises: SessionExerciseUpdate[];
  }
) {
  // Persist user state as-is — do NOT auto-complete every planned set
  // (planned reps alone must not count as completed)
  await saveSessionProgressAction(sessionId, data);

  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");

  // Mark exercise rows completed only when all their sets are done
  const logs = await db
    .select()
    .from(sessionExerciseLogs)
    .where(eq(sessionExerciseLogs.sessionId, sessionId));

  for (const l of logs) {
    const sets = ensureSetLogs(l);
    const allDone =
      sets.length > 0 && sets.every((s) => s.completed);
    if (allDone !== l.completed) {
      await db
        .update(sessionExerciseLogs)
        .set({ completed: allDone })
        .where(eq(sessionExerciseLogs.id, l.id));
    }
  }

  const wasInProgress = row.status === "in_progress";

  await db
    .update(trainingSessions)
    .set({ status: "completed", updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));

  // Floor complete: burn pack + promote lead → active (defensive first engagement)
  if (wasInProgress && row.clientId) {
    try {
      const {
        tryConsumePackageSessionAction,
        promoteLeadToActiveIfNeeded,
      } = await import("@/app/actions/crm");
      await tryConsumePackageSessionAction(row.clientId);
      await promoteLeadToActiveIfNeeded(row.clientId);
    } catch {
      // pack/promote optional — never block session complete
    }
  }

  // Close linked booking when the floor log completes
  if (wasInProgress && row.appointmentId) {
    try {
      await db
        .update(clientAppointments)
        .set({ status: "completed", sessionId: sessionId })
        .where(eq(clientAppointments.id, row.appointmentId));
      revalidatePath("/calendar");
      if (row.clientId) revalidatePath(`/clients/${row.clientId}`);
    } catch {
      // booking update optional
    }
  }

  // Coach-facing note only when there's something to remember (pain / free notes).
  // Full set logs live on the session — not in Notes & recommendations.
  if (row.clientId) {
    const pain = row.painNotes?.trim();
    const coachNote = row.notes?.trim();
    if (pain || coachNote) {
      await db.insert(clientNotes).values({
        id: id("note"),
        clientId: row.clientId,
        authorUserId: session.userId,
        title: `Session note · ${row.title}`,
        body: [
          pain ? `Pain / flags: ${pain}` : null,
          coachNote ? coachNote : null,
          row.overallRpe ? `Session RPE: ${row.overallRpe}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        kind: "note",
        metadata: { sessionId, source: "session_complete" },
      });
    }
  }

  // Lane B+: auto-advance mesocycle when enough sessions completed this week
  let mesoAdvance: {
    advanced: boolean;
    week?: number;
    label?: string;
  } | null = null;
  if (row.programId) {
    try {
      const { tryAutoAdvanceMesocycleOnSessionComplete } = await import(
        "@/app/actions/programs"
      );
      mesoAdvance = await tryAutoAdvanceMesocycleOnSessionComplete(
        row.programId
      );
    } catch {
      mesoAdvance = null;
    }
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  if (row.clientId) revalidatePath(`/clients/${row.clientId}`);
  if (row.programId) revalidatePath(`/programs/${row.programId}`);
  return {
    ok: true as const,
    mesoAdvance: mesoAdvance?.advanced
      ? {
          week: mesoAdvance.week,
          label: mesoAdvance.label,
        }
      : null,
  };
}

/**
 * Append a bank exercise to an in-progress session (ad-hoc floor add).
 * Not linked to program until promoteSessionExerciseToProgramAction.
 */
export async function addExerciseToSessionAction(
  sessionId: string,
  bankExerciseId: string
) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");
  if (row.status !== "in_progress") {
    throw new Error("Can only add exercises to an in-progress session");
  }

  const { listExercisesForOrg } = await import("@/lib/exercises");
  const { initSetLogsFromScheme } = await import("@/lib/set-schemes");
  const { defaultAddExerciseRx } = await import("@/lib/program-exercise-add");

  const bank = await listExercisesForOrg(session.organizationId);
  const pick = bank.find((e) => e.id === bankExerciseId);
  if (!pick) throw new Error("Exercise not found in bank");
  if (!pick.available) {
    throw new Error(
      `“${pick.name}” needs equipment not marked available: ${pick.missingEquipment.join(", ") || "unknown"}`
    );
  }

  const existing = await db
    .select({ sortOrder: sessionExerciseLogs.sortOrder })
    .from(sessionExerciseLogs)
    .where(eq(sessionExerciseLogs.sessionId, sessionId));
  const sortOrder =
    existing.length > 0
      ? Math.max(...existing.map((e) => e.sortOrder)) + 1
      : 0;

  const rx = defaultAddExerciseRx(false);
  const setLogs = initSetLogsFromScheme(
    "straight",
    null,
    rx.sets,
    rx.reps,
    null
  );
  const agg = aggregateFromSetLogs(setLogs);
  const logId = id("sel");

  await db.insert(sessionExerciseLogs).values({
    id: logId,
    sessionId,
    programExerciseId: null,
    exerciseId: pick.id,
    exerciseName: pick.name,
    movementPattern: pick.movementPattern,
    sortOrder,
    isWarmup: false,
    plannedSets: setLogs.length,
    plannedReps: rx.reps,
    actualSets: agg.actualSets,
    actualReps: agg.actualReps,
    weightKg: agg.weightKg,
    rpe: rx.rpe,
    completed: false,
    notes: pick.cues || null,
    setLogs,
    setScheme: "straight",
    setSchemeMeta: null,
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
    restAfterSec: null,
    restBetweenRoundsSec: null,
    groupRole: null,
  });

  await db
    .update(trainingSessions)
    .set({ updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");

  return {
    ok: true as const,
    log: {
      id: logId,
      exerciseId: pick.id,
      exerciseName: pick.name,
      movementPattern: pick.movementPattern,
      isWarmup: false,
      plannedSets: setLogs.length,
      plannedReps: rx.reps,
      actualSets: agg.actualSets,
      actualReps: agg.actualReps,
      weightKg: agg.weightKg,
      rpe: rx.rpe,
      completed: false,
      notes: pick.cues || null,
      setLogs,
      setScheme: "straight" as const,
      setSchemeMeta: null,
      sortOrder,
      programExerciseId: null as string | null,
      groupId: null,
      groupKind: null,
      groupLabel: null,
      groupOrder: null,
      restAfterSec: null,
      restBetweenRoundsSec: null,
      groupRole: null,
    },
  };
}

/**
 * Promote a session log exercise onto the session's program day (keep on plan).
 */
export async function promoteSessionExerciseToProgramAction(
  sessionId: string,
  logId: string
) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");
  if (!row.programDayId) {
    throw new Error("Session has no program day — open a program session first");
  }

  const [log] = await db
    .select()
    .from(sessionExerciseLogs)
    .where(
      and(
        eq(sessionExerciseLogs.id, logId),
        eq(sessionExerciseLogs.sessionId, sessionId)
      )
    )
    .limit(1);
  if (!log) throw new Error("Exercise log not found");
  if (!log.exerciseId) {
    throw new Error("Exercise is not linked to the bank — cannot add to program");
  }

  // Already on this day (by bank id)?
  const onDay = await db
    .select({ id: programExercises.id, exerciseId: programExercises.exerciseId })
    .from(programExercises)
    .where(eq(programExercises.programDayId, row.programDayId));
  if (onDay.some((pe) => pe.exerciseId === log.exerciseId)) {
    throw new Error("Already on this program day");
  }

  const { rxFromSessionSetLogs } = await import("@/lib/program-exercise-add");
  const setLogs = ensureSetLogs(log);
  const rx = rxFromSessionSetLogs(setLogs, {
    sets: log.plannedSets,
    reps: log.plannedReps || log.actualReps,
    rpe: log.rpe,
  });

  const { addProgramExerciseAction } = await import("@/app/actions/programs");
  const res = await addProgramExerciseAction({
    programDayId: row.programDayId,
    bankExerciseId: log.exerciseId,
    opts: {
      isWarmup: log.isWarmup,
      sets: rx.sets,
      reps: rx.reps,
      rpe: rx.rpe,
      notes: log.notes,
    },
  });

  await db
    .update(sessionExerciseLogs)
    .set({ programExerciseId: res.programExerciseId })
    .where(eq(sessionExerciseLogs.id, logId));

  revalidatePath(`/sessions/${sessionId}`);
  if (row.programId) revalidatePath(`/programs/${row.programId}`);
  return {
    ok: true as const,
    programExerciseId: res.programExerciseId,
    name: res.name,
    dayName: res.dayName,
  };
}

export async function cancelSessionAction(sessionId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");

  await db
    .update(trainingSessions)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(trainingSessions.id, sessionId));

  // Unlink booking so CRM doesn't show Resume on a dead log
  if (row.appointmentId) {
    try {
      await db
        .update(clientAppointments)
        .set({ sessionId: null })
        .where(eq(clientAppointments.id, row.appointmentId));
    } catch {
      // optional
    }
  }

  revalidatePath(`/sessions/${sessionId}`);
  revalidatePath("/sessions");
  revalidatePath("/calendar");
  if (row.clientId) revalidatePath(`/clients/${row.clientId}`);
  return { ok: true };
}

/**
 * Permanently remove a session and its set logs (cascade).
 * Completed sessions that burned a pack attempt to restore +1 remaining.
 */
export async function deleteSessionAction(sessionId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.id, sessionId),
        eq(trainingSessions.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Session not found");

  const clientId = row.clientId;
  const wasCompleted = row.status === "completed";

  if (row.appointmentId) {
    try {
      await db
        .update(clientAppointments)
        .set({ sessionId: null })
        .where(eq(clientAppointments.id, row.appointmentId));
    } catch {
      // optional
    }
  }

  await db.delete(trainingSessions).where(eq(trainingSessions.id, sessionId));

  let packRestored = false;
  if (wasCompleted && clientId) {
    try {
      const { tryRestorePackageSessionAction } = await import(
        "@/app/actions/crm"
      );
      const res = await tryRestorePackageSessionAction(clientId);
      packRestored = !!res.restored;
    } catch {
      // pack optional
    }
  }

  revalidatePath("/sessions");
  revalidatePath("/");
  revalidatePath("/calendar");
  if (clientId) revalidatePath(`/clients/${clientId}`);
  if (row.programId) revalidatePath(`/programs/${row.programId}`);

  return { ok: true as const, packRestored };
}
