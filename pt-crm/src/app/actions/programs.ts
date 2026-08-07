"use server";

import { and, asc, desc, eq, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  assessmentTemplates,
  clientAssessments,
  clients,
  programDays,
  programExercises,
  programs,
  sessionExerciseLogs,
  trainingSessions,
} from "@/db/schema";
import { promoteLeadToActiveIfNeeded } from "@/app/actions/crm";
import { requireSession } from "@/lib/auth";
import {
  correctivesFromAssessmentResults,
  correctivesFromClientHistory,
  matchExercisesForCorrective,
  mergeCorrectives,
  type CorrectiveExercisePoolItem,
} from "@/lib/assessment-correctives";
import {
  rankSubstitutions,
  type ExerciseLike,
} from "@/lib/exercise-substitutions";
import { listExercisesForOrg } from "@/lib/exercises";
import {
  applyMesocycleToPrescription,
  getMesocycleWeek,
  nextMesocycleWeek,
  stripMesocycleNotes,
  suggestMesocycleWeekFromStartDate,
} from "@/lib/mesocycle";
import { buildConstraintProfile } from "@/lib/program-constraints";
import {
  buildProgramDraft,
  type AssessmentHint,
  type ProgramBuilderInput,
  type ProgramGoal,
} from "@/lib/program-builder";
import {
  accumulateVolumeByPattern,
  sessionsToAdvanceMesocycle,
  shouldAutoAdvanceMesocycle,
} from "@/lib/program-volume";
import {
  defaultAddExerciseRx,
  nextProgramExerciseSortOrder,
} from "@/lib/program-exercise-add";
import { ensureSetLogs } from "@/lib/session-sets";
import { getClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";

type BaselineRx = {
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
};

export type CreateProgramInput = {
  clientId?: string | null;
  title?: string;
  goal: ProgramGoal;
  daysPerWeek: number;
  sessionMinutes: number;
  experienceLevel?: string;
  notes?: string;
  preferMobility?: boolean;
  activate?: boolean;
  /** Mesocycle week 1–6 for volume/RPE scaling */
  mesocycleWeek?: number;
  /** Passed on Regenerate so exercise picks diversify */
  variationSeed?: number;
};

/** Latest assessment per template for a client (org-scoped via client load). */
async function loadAssessmentHintsForClient(
  clientId: string
): Promise<AssessmentHint[]> {
  const db = await getDb();
  const rows = await db
    .select({
      assessment: clientAssessments,
      templateSlug: assessmentTemplates.slug,
    })
    .from(clientAssessments)
    .leftJoin(
      assessmentTemplates,
      eq(clientAssessments.templateId, assessmentTemplates.id)
    )
    .where(eq(clientAssessments.clientId, clientId))
    .orderBy(desc(clientAssessments.takenAt));

  // Keep latest result per template slug
  const bySlug = new Map<string, AssessmentHint>();
  for (const r of rows) {
    const slug = r.templateSlug || r.assessment.templateId;
    if (!slug || bySlug.has(slug)) continue;
    bySlug.set(slug, {
      templateSlug: slug,
      results: (r.assessment.results || {}) as Record<string, unknown>,
      summary: r.assessment.summary,
    });
  }
  return Array.from(bySlug.values());
}

function toExerciseLike(
  e: Awaited<ReturnType<typeof listExercisesForOrg>>[number]
): ExerciseLike {
  return {
    id: e.id,
    name: e.name,
    movementPattern: e.movementPattern,
    tags: e.tags,
    difficulty: e.difficulty,
    available: e.available,
    equipmentNames: e.equipmentNames,
    cues: e.cues,
    primaryMuscles: e.primaryMuscles,
    missingEquipment: e.missingEquipment,
  };
}

export async function listProgramsAction(clientId?: string) {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select({
      program: programs,
      clientFirst: clients.firstName,
      clientLast: clients.lastName,
    })
    .from(programs)
    .leftJoin(clients, eq(programs.clientId, clients.id))
    .where(
      clientId
        ? and(
            eq(programs.organizationId, session.organizationId),
            eq(programs.clientId, clientId)
          )
        : eq(programs.organizationId, session.organizationId)
    )
    .orderBy(desc(programs.updatedAt));

  return rows.map((r) => ({
    ...r.program,
    clientName:
      r.clientFirst != null
        ? [r.clientFirst, r.clientLast].filter(Boolean).join(" ")
        : null,
  }));
}

export async function getProgramAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) return null;

  let client = null;
  if (program.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(eq(clients.id, program.clientId))
      .limit(1);
    client = c || null;
  }

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.dayIndex));

  const daysWithExercises = [];
  for (const day of days) {
    const exercises = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, day.id))
      .orderBy(asc(programExercises.sortOrder));
    daysWithExercises.push({ ...day, exercises });
  }

  return { program, client, days: daysWithExercises };
}

/** First day of program by dayIndex for Start session deep-link. */
export async function getProgramFirstDayAction(programId: string): Promise<{
  dayId: string;
  name: string;
  programId: string;
} | null> {
  const session = await requireSession();
  const db = await getDb();

  const [program] = await db
    .select({ id: programs.id })
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) return null;

  const [day] = await db
    .select({
      id: programDays.id,
      name: programDays.name,
    })
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.dayIndex))
    .limit(1);

  if (!day) return null;

  return {
    dayId: day.id,
    name: day.name,
    programId: program.id,
  };
}

export async function createProgramFromWizardAction(input: CreateProgramInput) {
  const session = await requireSession();
  const db = await getDb();

  let clientInjuries: string | null = null;
  let clientGoals: string | null = null;
  let contraindications: string | null = null;
  let assessmentHints: AssessmentHint[] = [];
  let experience = input.experienceLevel;

  if (input.clientId) {
    const c = await getClientInOrg(input.clientId, session.organizationId);
    if (!c) throw new Error("Client not found");
    clientInjuries = c.injuries;
    clientGoals = c.goals;
    contraindications = c.contraindications ?? null;
    experience = experience || c.experienceLevel || undefined;
    assessmentHints = await loadAssessmentHintsForClient(c.id);
  }

  const builderInput: ProgramBuilderInput = {
    organizationId: session.organizationId,
    title: input.title,
    goal: input.goal,
    daysPerWeek: input.daysPerWeek,
    sessionMinutes: input.sessionMinutes,
    experienceLevel: experience,
    notes: input.notes,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility: input.preferMobility,
    mesocycleWeek: input.mesocycleWeek,
    assessmentHints,
    variationSeed: input.variationSeed,
  };

  const draft = await buildProgramDraft(builderInput);
  const programId = id("prg");

  await db.insert(programs).values({
    id: programId,
    organizationId: session.organizationId,
    clientId: input.clientId || null,
    createdByUserId: session.userId,
    title: draft.title,
    goal: draft.goal,
    daysPerWeek: draft.daysPerWeek,
    sessionMinutes: draft.sessionMinutes,
    splitType: draft.splitType,
    experienceLevel: draft.experienceLevel,
    status: input.activate ? "active" : "draft",
    notes: draft.notes,
    generationMeta: draft.meta,
  });

  for (const day of draft.days) {
    await db.insert(programDays).values({
      id: day.id,
      programId,
      dayIndex: day.dayIndex,
      name: day.name,
      focus: day.focus,
    });
    for (const ex of day.exercises) {
      await db.insert(programExercises).values({
        id: ex.id,
        programDayId: day.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        movementPattern: ex.movementPattern,
        sets: ex.sets,
        reps: ex.reps,
        rpe: ex.rpe,
        restSec: ex.restSec,
        notes: ex.notes,
        sortOrder: ex.sortOrder,
        isWarmup: ex.isWarmup,
        setScheme: ex.setScheme || "straight",
        setSchemeMeta: ex.setSchemeMeta || null,
        groupId: ex.groupId || null,
        groupKind: ex.groupKind || null,
        groupLabel: ex.groupLabel || null,
        groupOrder: ex.groupOrder ?? null,
        restAfterSec: ex.restAfterSec ?? null,
        restBetweenRoundsSec: ex.restBetweenRoundsSec ?? null,
        groupRole: ex.groupRole || null,
      });
    }
  }

  revalidatePath("/programs");
  if (input.clientId) {
    revalidatePath(`/clients/${input.clientId}`);
    await promoteLeadToActiveIfNeeded(input.clientId);
  }
  return { programId };
}

export async function updateProgramMetaAction(
  programId: string,
  data: { title?: string; status?: string; notes?: string; clientId?: string | null }
) {
  const session = await requireSession();
  const db = await getDb();
  const [p] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!p) throw new Error("Program not found");

  if (data.clientId) {
    const [c] = await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.id, data.clientId),
          eq(clients.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (!c) throw new Error("Client not found");
  }

  await db
    .update(programs)
    .set({
      title: data.title ?? p.title,
      status: data.status ?? p.status,
      notes: data.notes !== undefined ? data.notes : p.notes,
      clientId: data.clientId !== undefined ? data.clientId : p.clientId,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs");

  // Late client attach (desk): same promote as wizard create with clientId
  const linkedClientId =
    data.clientId !== undefined ? data.clientId : p.clientId;
  if (linkedClientId) {
    revalidatePath(`/clients/${linkedClientId}`);
    await promoteLeadToActiveIfNeeded(linkedClientId);
  }

  return { ok: true };
}

export async function updateProgramExerciseAction(
  exerciseRowId: string,
  data: {
    sets?: number;
    reps?: string;
    rpe?: string | null;
    restSec?: number | null;
    notes?: string | null;
    exerciseName?: string;
    exerciseId?: string | null;
    movementPattern?: string | null;
    setScheme?: string;
    rebuildSchemeMeta?: boolean;
  }
) {
  const session = await requireSession();
  const db = await getDb();

  const [row] = await db
    .select({
      pe: programExercises,
      day: programDays,
      program: programs,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programExercises.id, exerciseRowId))
    .limit(1);

  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const nextScheme = data.setScheme ?? row.pe.setScheme ?? "straight";
  const nextSets = data.sets ?? row.pe.sets;
  const nextReps = data.reps ?? row.pe.reps;
  const nextRpe = data.rpe !== undefined ? data.rpe : row.pe.rpe;
  const nextRest =
    data.restSec !== undefined ? data.restSec : row.pe.restSec;

  let setSchemeMeta = row.pe.setSchemeMeta;
  let finalSets = nextSets;
  let finalReps = nextReps;
  let finalRpe = nextRpe;
  let finalRest = nextRest;
  let clearGroup = false;

  const inGroup = !!row.pe.groupId;
  const schemeChanging =
    data.setScheme !== undefined && data.setScheme !== row.pe.setScheme;

  // Never rebuild multi-exercise group members into single-row scheme plans
  // (that destroys contrast/complex/superset structure).
  const { isMultiExerciseScheme, buildSchemePlan } = await import(
    "@/lib/set-schemes"
  );
  const nextIsMulti = isMultiExerciseScheme(nextScheme);

  if (inGroup && schemeChanging && !nextIsMulti) {
    // Leaving a multi-exercise group → dissolve this row from the group
    clearGroup = true;
  }

  if (
    !inGroup &&
    (data.rebuildSchemeMeta || schemeChanging) &&
    !nextIsMulti
  ) {
    const planned = buildSchemePlan(
      nextScheme as import("@/lib/set-schemes").SetSchemeId,
      {
        sets: nextSets,
        reps: nextReps,
        rpe: nextRpe,
        restSec: nextRest,
      },
      {
        pattern: row.pe.movementPattern || undefined,
        isWarmup: row.pe.isWarmup,
      }
    );
    setSchemeMeta = planned.setSchemeMeta;
    if (schemeChanging) {
      finalSets = planned.sets;
      finalReps = planned.reps;
      finalRpe = planned.rpe;
      finalRest = planned.restSec;
    }
  } else if (inGroup && !schemeChanging) {
    // Keep group meta; only update scalar fields the coach typed
    setSchemeMeta = row.pe.setSchemeMeta;
  } else if (schemeChanging && nextIsMulti) {
    // Cannot invent partners from a single-row edit — keep current scalars,
    // force straight-like single plan with a note
    throw new Error(
      "Contrast / complex / superset need multiple exercises. Design a new program (or regenerate) to create groups."
    );
  }

  await db
    .update(programExercises)
    .set({
      sets: finalSets,
      reps: finalReps,
      rpe: finalRpe,
      restSec: finalRest,
      notes: data.notes !== undefined ? data.notes : row.pe.notes,
      exerciseName: data.exerciseName ?? row.pe.exerciseName,
      exerciseId:
        data.exerciseId !== undefined ? data.exerciseId : row.pe.exerciseId,
      setScheme: clearGroup ? nextScheme : nextScheme,
      setSchemeMeta,
      movementPattern:
        data.movementPattern !== undefined
          ? data.movementPattern
          : row.pe.movementPattern,
      ...(clearGroup
        ? {
            groupId: null,
            groupKind: null,
            groupLabel: null,
            groupOrder: null,
            restAfterSec: null,
            restBetweenRoundsSec: null,
            groupRole: null,
          }
        : {}),
    })
    .where(eq(programExercises.id, exerciseRowId));

  await db
    .update(programs)
    .set({ updatedAt: new Date() })
    .where(eq(programs.id, row.program.id));

  revalidatePath(`/programs/${row.program.id}`);
  return { ok: true };
}

/** Replace a program exercise with one from the org exercise bank. */
export async function swapProgramExerciseAction(
  exerciseRowId: string,
  bankExerciseId: string,
  opts?: { keepPrescription?: boolean; applyCues?: boolean }
) {
  const session = await requireSession();
  const db = await getDb();
  const { listExercisesForOrg } = await import("@/lib/exercises");

  const [row] = await db
    .select({
      pe: programExercises,
      day: programDays,
      program: programs,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programExercises.id, exerciseRowId))
    .limit(1);

  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const bank = await listExercisesForOrg(session.organizationId);
  const pick = bank.find((e) => e.id === bankExerciseId);
  if (!pick) throw new Error("Exercise not found in bank");
  if (!pick.available) {
    throw new Error(
      `“${pick.name}” needs equipment not marked available: ${pick.missingEquipment.join(", ") || "unknown"}`
    );
  }

  const keep = opts?.keepPrescription !== false;
  // Preserve group rest cues in notes when swapping a group member
  let notes = row.pe.notes;
  if (opts?.applyCues !== false && pick.cues) {
    if (row.pe.groupId && row.pe.notes) {
      // Keep rest/flow lines; append bank cues
      notes = `${row.pe.notes} · ${pick.cues}`;
    } else {
      notes = pick.cues;
    }
  }
  await db
    .update(programExercises)
    .set({
      exerciseId: pick.id,
      exerciseName: pick.name,
      movementPattern: pick.movementPattern,
      notes,
      // keep sets/reps/rpe/rest/scheme/group unless caller wants reset
      sets: keep ? row.pe.sets : 3,
      reps: keep ? row.pe.reps : "8-10",
      rpe: keep ? row.pe.rpe : "7",
      restSec: keep ? row.pe.restSec : 90,
    })
    .where(eq(programExercises.id, exerciseRowId));

  await db
    .update(programs)
    .set({ updatedAt: new Date() })
    .where(eq(programs.id, row.program.id));

  revalidatePath(`/programs/${row.program.id}`);
  return {
    ok: true as const,
    name: pick.name,
    movementPattern: pick.movementPattern,
  };
}

/** Append a bank exercise to a program day (standalone straight sets). */
export async function addProgramExerciseAction(input: {
  programDayId: string;
  bankExerciseId: string;
  opts?: {
    isWarmup?: boolean;
    sets?: number;
    reps?: string;
    rpe?: string | null;
    restSec?: number | null;
    notes?: string | null;
  };
}) {
  const session = await requireSession();
  const db = await getDb();
  const isWarmup = !!input.opts?.isWarmup;

  const [dayRow] = await db
    .select({
      day: programDays,
      program: programs,
    })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programDays.id, input.programDayId))
    .limit(1);

  if (!dayRow || dayRow.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const bank = await listExercisesForOrg(session.organizationId);
  const pick = bank.find((e) => e.id === input.bankExerciseId);
  if (!pick) throw new Error("Exercise not found in bank");
  if (!pick.available) {
    throw new Error(
      `“${pick.name}” needs equipment not marked available: ${pick.missingEquipment.join(", ") || "unknown"}`
    );
  }

  const existing = await db
    .select({ sortOrder: programExercises.sortOrder })
    .from(programExercises)
    .where(eq(programExercises.programDayId, input.programDayId));

  const sortOrder = nextProgramExerciseSortOrder(
    existing.map((e) => e.sortOrder)
  );
  const defaults = defaultAddExerciseRx(isWarmup);
  const sets = input.opts?.sets ?? defaults.sets;
  const reps = input.opts?.reps ?? defaults.reps;
  const rpe =
    input.opts?.rpe !== undefined ? input.opts.rpe : defaults.rpe;
  const restSec =
    input.opts?.restSec !== undefined
      ? input.opts.restSec
      : defaults.restSec;
  const notes =
    input.opts?.notes !== undefined
      ? input.opts.notes
      : pick.cues || null;

  const peId = id("pe");
  await db.insert(programExercises).values({
    id: peId,
    programDayId: input.programDayId,
    exerciseId: pick.id,
    exerciseName: pick.name,
    movementPattern: pick.movementPattern,
    sets,
    reps,
    rpe,
    restSec,
    notes,
    sortOrder,
    isWarmup,
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

  // Seed meso baseline only when baselines already exist (non-empty map)
  const prevMeta =
    (dayRow.program.generationMeta as Record<string, unknown> | null) || {};
  const baselines =
    (prevMeta.baselinePrescriptions as
      | Record<string, { sets: number; reps: string; rpe: string | null; restSec: number | null }>
      | undefined) || {};
  const hasBaselines = Object.keys(baselines).length > 0;
  const nextMeta = hasBaselines
    ? {
        ...prevMeta,
        baselinePrescriptions: {
          ...baselines,
          [peId]: { sets, reps, rpe, restSec },
        },
      }
    : prevMeta;

  await db
    .update(programs)
    .set({
      generationMeta: nextMeta,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, dayRow.program.id));

  revalidatePath(`/programs/${dayRow.program.id}`);
  revalidatePath("/programs");
  if (dayRow.program.clientId) {
    revalidatePath(`/clients/${dayRow.program.clientId}`);
  }

  return {
    ok: true as const,
    programExerciseId: peId,
    programId: dayRow.program.id,
    name: pick.name,
    dayName: dayRow.day.name,
  };
}

export async function deleteProgramExerciseAction(exerciseRowId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select({
      pe: programExercises,
      day: programDays,
      program: programs,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programExercises.id, exerciseRowId))
    .limit(1);

  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  await db.delete(programExercises).where(eq(programExercises.id, exerciseRowId));
  await db
    .update(programs)
    .set({ updatedAt: new Date() })
    .where(eq(programs.id, row.program.id));
  revalidatePath(`/programs/${row.program.id}`);
  return { ok: true };
}

export async function deleteProgramAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [p] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!p) throw new Error("Not found");
  await db.delete(programs).where(eq(programs.id, programId));
  revalidatePath("/programs");
  if (p.clientId) revalidatePath(`/clients/${p.clientId}`);
  return { ok: true };
}

export async function previewProgramAction(input: CreateProgramInput) {
  const session = await requireSession();
  let clientInjuries: string | null = null;
  let clientGoals: string | null = null;
  let contraindications: string | null = null;
  let assessmentHints: AssessmentHint[] = [];
  let experience = input.experienceLevel;

  if (input.clientId) {
    const c = await getClientInOrg(input.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
    }
  }

  return buildProgramDraft({
    organizationId: session.organizationId,
    title: input.title,
    goal: input.goal,
    daysPerWeek: input.daysPerWeek,
    sessionMinutes: input.sessionMinutes,
    experienceLevel: experience,
    notes: input.notes,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility: input.preferMobility,
    mesocycleWeek: input.mesocycleWeek,
    assessmentHints,
    variationSeed: input.variationSeed,
  });
}

/** Rank substitute bank exercises for a program exercise row. */
export async function suggestSubstitutionsAction(
  exerciseRowId: string,
  limit = 8
) {
  const session = await requireSession();
  const db = await getDb();

  const [row] = await db
    .select({
      pe: programExercises,
      day: programDays,
      program: programs,
    })
    .from(programExercises)
    .innerJoin(programDays, eq(programExercises.programDayId, programDays.id))
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programExercises.id, exerciseRowId))
    .limit(1);

  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const bank = await listExercisesForOrg(session.organizationId);
  const pool = bank.map(toExerciseLike);

  let current: ExerciseLike;
  if (row.pe.exerciseId) {
    const fromBank = bank.find((e) => e.id === row.pe.exerciseId);
    current = fromBank
      ? toExerciseLike(fromBank)
      : {
          id: row.pe.exerciseId,
          name: row.pe.exerciseName,
          movementPattern: row.pe.movementPattern || "",
          tags: "",
          difficulty: "intermediate",
          available: true,
          equipmentNames: [],
          cues: null,
          primaryMuscles: "",
        };
  } else {
    current = {
      id: row.pe.id,
      name: row.pe.exerciseName,
      movementPattern: row.pe.movementPattern || "",
      tags: "",
      difficulty: "intermediate",
      available: true,
      equipmentNames: [],
      cues: null,
      primaryMuscles: "",
    };
  }

  // Client constraints for safer swap ranking
  let constraintProfile = null;
  if (row.program.clientId) {
    const client = await getClientInOrg(
      row.program.clientId,
      session.organizationId
    );
    if (client) {
      constraintProfile = buildConstraintProfile({
        injuries: client.injuries,
        goals: client.goals,
        contraindications: client.contraindications ?? null,
      });
    }
  }

  const ranked = rankSubstitutions({
    current,
    pool,
    limit: Math.min(Math.max(limit || 8, 1), 20),
    constraintProfile,
    difficultyBias: constraintProfile?.injuryFlags?.length
      ? "easier"
      : "neutral",
  });

  return ranked.map((r) => ({
    id: r.exercise.id,
    name: r.exercise.name,
    score: r.score,
    reasons: r.reasons,
    movementPattern: r.exercise.movementPattern,
    equipmentNames: r.exercise.equipmentNames,
    difficulty: r.exercise.difficulty,
  }));
}

/**
 * Apply mesocycle week scaling from stored *baseline* prescriptions
 * so re-applying W4 then W2 does not compound deloads.
 */
export async function applyMesocycleToProgramAction(
  programId: string,
  week: number
) {
  const session = await requireSession();
  const db = await getDb();

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  const plan = getMesocycleWeek(week);
  const prevMeta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  let baselines =
    (prevMeta.baselinePrescriptions as Record<string, BaselineRx> | undefined) ||
    {};

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.dayIndex));

  // Capture baselines on first apply (or for any new exercise rows)
  const needBaselineCapture = Object.keys(baselines).length === 0;
  if (needBaselineCapture) {
    baselines = {};
    for (const day of days) {
      const rows = await db
        .select()
        .from(programExercises)
        .where(eq(programExercises.programDayId, day.id));
      for (const pe of rows) {
        baselines[pe.id] = {
          sets: pe.sets,
          reps: pe.reps,
          rpe: pe.rpe,
          restSec: pe.restSec,
        };
      }
    }
  } else {
    // Add baselines for any exercises added since last capture
    for (const day of days) {
      const rows = await db
        .select()
        .from(programExercises)
        .where(eq(programExercises.programDayId, day.id));
      for (const pe of rows) {
        if (!baselines[pe.id]) {
          baselines[pe.id] = {
            sets: pe.sets,
            reps: pe.reps,
            rpe: pe.rpe,
            restSec: pe.restSec,
          };
        }
      }
    }
  }

  for (const day of days) {
    const rows = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, day.id));

    for (const pe of rows) {
      const base = baselines[pe.id] || {
        sets: pe.sets,
        reps: pe.reps,
        rpe: pe.rpe,
        restSec: pe.restSec,
      };
      const scaled = applyMesocycleToPrescription(base, plan);

      let notes = stripMesocycleNotes(pe.notes);
      if (scaled.note) {
        notes = [notes, scaled.note].filter(Boolean).join(" · ");
      }

      await db
        .update(programExercises)
        .set({
          sets: scaled.sets,
          reps: scaled.reps,
          rpe: scaled.rpe,
          restSec: scaled.restSec,
          notes,
        })
        .where(eq(programExercises.id, pe.id));
    }
  }

  await db
    .update(programs)
    .set({
      generationMeta: {
        ...prevMeta,
        baselinePrescriptions: baselines,
        mesocycle: plan,
        mesocycleWeek: plan.week,
        mesocycleAppliedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs");
  if (program.clientId) revalidatePath(`/clients/${program.clientId}`);
  return { ok: true as const, week: plan.week, label: plan.label };
}

/** Advance to next mesocycle week (1–6 wrap) and apply. */
export async function advanceMesocycleWeekAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");
  const meta = (program.generationMeta as Record<string, unknown>) || {};
  const current =
    typeof meta.mesocycleWeek === "number"
      ? meta.mesocycleWeek
      : typeof (meta.mesocycle as { week?: number } | undefined)?.week ===
          "number"
        ? (meta.mesocycle as { week: number }).week
        : 1;
  const next = nextMesocycleWeek(current);
  return applyMesocycleToProgramAction(programId, next);
}

/**
 * Rebuild program days in place from the program builder (same goal/days/client),
 * diversifying with a new variationSeed. Preserves program id, status, client.
 */
export async function regenerateProgramInPlaceAction(
  programId: string,
  opts?: { mesocycleWeek?: number; variationSeed?: number }
) {
  const session = await requireSession();
  const db = await getDb();

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  let clientInjuries: string | null = null;
  let clientGoals: string | null = null;
  let contraindications: string | null = null;
  let experience = program.experienceLevel || undefined;
  let assessmentHints: AssessmentHint[] = [];

  if (program.clientId) {
    const c = await getClientInOrg(program.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
    }
  }

  const prevMeta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  const variationSeed =
    opts?.variationSeed ??
    (typeof prevMeta.variationSeed === "number"
      ? (prevMeta.variationSeed as number) + 1 + Math.floor(Date.now() % 97)
      : Date.now() % 10000);

  const week =
    opts?.mesocycleWeek ??
    (typeof prevMeta.mesocycleWeek === "number"
      ? (prevMeta.mesocycleWeek as number)
      : 1);

  const preferMobility =
    typeof prevMeta.preferMobility === "boolean"
      ? (prevMeta.preferMobility as boolean)
      : undefined;

  const draft = await buildProgramDraft({
    organizationId: session.organizationId,
    title: program.title,
    goal: (program.goal as ProgramGoal) || "general",
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    experienceLevel: experience,
    notes: program.notes || undefined,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility,
    mesocycleWeek: week,
    assessmentHints,
    variationSeed,
  });

  // Delete existing days (cascade exercises if FK set — delete exercises then days)
  const oldDays = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId));
  for (const d of oldDays) {
    await db
      .delete(programExercises)
      .where(eq(programExercises.programDayId, d.id));
    await db.delete(programDays).where(eq(programDays.id, d.id));
  }

  for (const day of draft.days) {
    await db.insert(programDays).values({
      id: day.id,
      programId,
      dayIndex: day.dayIndex,
      name: day.name,
      focus: day.focus,
    });
    for (const ex of day.exercises) {
      await db.insert(programExercises).values({
        id: ex.id,
        programDayId: day.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        movementPattern: ex.movementPattern,
        sets: ex.sets,
        reps: ex.reps,
        rpe: ex.rpe,
        restSec: ex.restSec,
        notes: ex.notes,
        sortOrder: ex.sortOrder,
        isWarmup: ex.isWarmup,
        setScheme: ex.setScheme || "straight",
        setSchemeMeta: ex.setSchemeMeta || null,
        groupId: ex.groupId || null,
        groupKind: ex.groupKind || null,
        groupLabel: ex.groupLabel || null,
        groupOrder: ex.groupOrder ?? null,
        restAfterSec: ex.restAfterSec ?? null,
        restBetweenRoundsSec: ex.restBetweenRoundsSec ?? null,
        groupRole: ex.groupRole || null,
      });
    }
  }

  // Fresh baselines after regen
  const baselines: Record<string, BaselineRx> = {};
  for (const day of draft.days) {
    for (const ex of day.exercises) {
      baselines[ex.id] = {
        sets: ex.sets,
        reps: ex.reps,
        rpe: ex.rpe,
        restSec: ex.restSec,
      };
    }
  }

  await db
    .update(programs)
    .set({
      title: draft.title,
      goal: draft.goal,
      daysPerWeek: draft.daysPerWeek,
      sessionMinutes: draft.sessionMinutes,
      splitType: draft.splitType,
      experienceLevel: draft.experienceLevel,
      notes: draft.notes,
      generationMeta: {
        ...draft.meta,
        baselinePrescriptions: baselines,
        regeneratedAt: new Date().toISOString(),
        previousVariationSeed: prevMeta.variationSeed ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs");
  if (program.clientId) revalidatePath(`/clients/${program.clientId}`);
  return {
    ok: true as const,
    variationSeed,
    days: draft.days.length,
    meta: draft.meta,
  };
}

/**
 * Rebuild a single program day (by program day id) from the builder.
 * Other days stay intact. New variation seed diversifies picks.
 */
export async function regenerateProgramDayAction(
  programDayId: string,
  opts?: { variationSeed?: number }
) {
  const session = await requireSession();
  const db = await getDb();

  const [dayRow] = await db
    .select({
      day: programDays,
      program: programs,
    })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programDays.id, programDayId))
    .limit(1);

  if (!dayRow || dayRow.program.organizationId !== session.organizationId) {
    throw new Error("Day not found");
  }

  const program = dayRow.program;
  const dayIndex = dayRow.day.dayIndex;

  let clientInjuries: string | null = null;
  let clientGoals: string | null = null;
  let contraindications: string | null = null;
  let experience = program.experienceLevel || undefined;
  let assessmentHints: AssessmentHint[] = [];

  if (program.clientId) {
    const c = await getClientInOrg(program.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
    }
  }

  const prevMeta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  const variationSeed =
    opts?.variationSeed ??
    (typeof prevMeta.variationSeed === "number"
      ? (prevMeta.variationSeed as number) +
        17 +
        dayIndex * 31 +
        Math.floor(Date.now() % 50)
      : Date.now() % 10000);

  const week =
    typeof prevMeta.mesocycleWeek === "number"
      ? (prevMeta.mesocycleWeek as number)
      : 1;

  const preferMobility =
    typeof prevMeta.preferMobility === "boolean"
      ? (prevMeta.preferMobility as boolean)
      : undefined;

  const draft = await buildProgramDraft({
    organizationId: session.organizationId,
    title: program.title,
    goal: (program.goal as ProgramGoal) || "general",
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    experienceLevel: experience,
    notes: program.notes || undefined,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility,
    mesocycleWeek: week,
    assessmentHints,
    variationSeed,
  });

  const builtDay =
    draft.days.find((d) => d.dayIndex === dayIndex) ||
    draft.days[dayIndex] ||
    draft.days[0];
  if (!builtDay) throw new Error("Builder produced no day for this index");

  // Remove old exercises on this day only
  const oldExercises = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId));
  const oldIds = new Set(oldExercises.map((e) => e.id));

  await db
    .delete(programExercises)
    .where(eq(programExercises.programDayId, programDayId));

  await db
    .update(programDays)
    .set({
      name: builtDay.name,
      focus: builtDay.focus,
    })
    .where(eq(programDays.id, programDayId));

  for (const ex of builtDay.exercises) {
    await db.insert(programExercises).values({
      id: ex.id,
      programDayId,
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      movementPattern: ex.movementPattern,
      sets: ex.sets,
      reps: ex.reps,
      rpe: ex.rpe,
      restSec: ex.restSec,
      notes: ex.notes,
      sortOrder: ex.sortOrder,
      isWarmup: ex.isWarmup,
      setScheme: ex.setScheme || "straight",
      setSchemeMeta: ex.setSchemeMeta || null,
      groupId: ex.groupId || null,
      groupKind: ex.groupKind || null,
      groupLabel: ex.groupLabel || null,
      groupOrder: ex.groupOrder ?? null,
      restAfterSec: ex.restAfterSec ?? null,
      restBetweenRoundsSec: ex.restBetweenRoundsSec ?? null,
      groupRole: ex.groupRole || null,
    });
  }

  // Merge baselines: drop old exercise ids, add new
  const prevBaselines =
    (prevMeta.baselinePrescriptions as Record<string, BaselineRx> | undefined) ||
    {};
  const nextBaselines: Record<string, BaselineRx> = {};
  for (const [k, v] of Object.entries(prevBaselines)) {
    if (!oldIds.has(k)) nextBaselines[k] = v;
  }
  for (const ex of builtDay.exercises) {
    nextBaselines[ex.id] = {
      sets: ex.sets,
      reps: ex.reps,
      rpe: ex.rpe,
      restSec: ex.restSec,
    };
  }

  await db
    .update(programs)
    .set({
      generationMeta: {
        ...prevMeta,
        ...draft.meta,
        baselinePrescriptions: nextBaselines,
        variationSeed,
        lastDayRegenerated: {
          dayId: programDayId,
          dayIndex,
          at: new Date().toISOString(),
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, program.id));

  revalidatePath(`/programs/${program.id}`);
  revalidatePath("/programs");
  if (program.clientId) revalidatePath(`/clients/${program.clientId}`);
  return {
    ok: true as const,
    dayId: programDayId,
    dayName: builtDay.name,
    exerciseCount: builtDay.exercises.length,
    variationSeed,
  };
}

/**
 * Volume by movement pattern for completed sessions on this program
 * (default last 7 days).
 */
export async function getProgramVolumeReportAction(
  programId: string,
  opts?: { days?: number }
) {
  const session = await requireSession();
  const db = await getDb();
  const windowDays = Math.min(28, Math.max(1, opts?.days ?? 7));

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  since.setHours(0, 0, 0, 0);

  const sessions = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.programId, programId),
        eq(trainingSessions.status, "completed"),
        gte(trainingSessions.performedAt, since)
      )
    )
    .orderBy(desc(trainingSessions.performedAt));

  const volumeInputs: Parameters<typeof accumulateVolumeByPattern>[0] = [];
  for (const s of sessions) {
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(eq(sessionExerciseLogs.sessionId, s.id));
    for (const l of logs) {
      volumeInputs.push({
        movementPattern: l.movementPattern,
        exerciseName: l.exerciseName,
        isWarmup: l.isWarmup,
        setLogs: ensureSetLogs(l),
        weightKg: l.weightKg,
        actualSets: l.actualSets,
        actualReps: l.actualReps,
        completed: l.completed,
      });
    }
  }

  const report = accumulateVolumeByPattern(volumeInputs);
  report.rangeLabel = `Last ${windowDays} day${windowDays === 1 ? "" : "s"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`;
  return {
    ...report,
    sessionCount: sessions.length,
    windowDays,
    programId,
  };
}

/**
 * After a completed session: if enough sessions logged in this mesocycle
 * window, auto-apply next mesocycle week (opt-out via generationMeta.autoAdvanceMesocycle = false).
 */
export async function tryAutoAdvanceMesocycleOnSessionComplete(
  programId: string
): Promise<{
  advanced: boolean;
  week?: number;
  label?: string;
  completedInWindow?: number;
  threshold?: number;
}> {
  const session = await requireSession();
  const db = await getDb();

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) return { advanced: false };

  const meta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  if (meta.autoAdvanceMesocycle === false) {
    return { advanced: false };
  }

  const threshold = sessionsToAdvanceMesocycle(
    program.daysPerWeek,
    typeof meta.autoAdvanceAfterSessions === "number"
      ? (meta.autoAdvanceAfterSessions as number)
      : null
  );

  const windowStart = meta.mesocycleAppliedAt
    ? new Date(String(meta.mesocycleAppliedAt))
    : program.createdAt
      ? new Date(program.createdAt)
      : new Date(0);

  const completed = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.programId, programId),
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.status, "completed"),
        gte(trainingSessions.performedAt, windowStart)
      )
    );

  const completedInWindow = completed.length;
  const sessionsAtLastAdvance =
    typeof meta.mesocycleSessionsAtAdvance === "number"
      ? (meta.mesocycleSessionsAtAdvance as number)
      : 0;

  if (
    !shouldAutoAdvanceMesocycle({
      completedInWindow,
      threshold,
      sessionsAtLastAdvance,
    })
  ) {
    return { advanced: false, completedInWindow, threshold };
  }

  const currentWeek =
    typeof meta.mesocycleWeek === "number" ? (meta.mesocycleWeek as number) : 1;
  const next = nextMesocycleWeek(currentWeek);
  const res = await applyMesocycleToProgramAction(programId, next);

  // Re-read and stamp advance counters (applyMesocycle overwrites meta partially)
  const [fresh] = await db
    .select()
    .from(programs)
    .where(eq(programs.id, programId))
    .limit(1);
  const freshMeta =
    (fresh?.generationMeta as Record<string, unknown> | null) || {};
  await db
    .update(programs)
    .set({
      generationMeta: {
        ...freshMeta,
        mesocycleSessionsAtAdvance: completedInWindow,
        mesocycleAutoAdvancedAt: new Date().toISOString(),
        mesocycleAutoAdvancedFrom: currentWeek,
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  return {
    advanced: true,
    week: res.week,
    label: res.label,
    completedInWindow,
    threshold,
  };
}

/**
 * Toggle auto-advance of mesocycle after enough completed sessions.
 * Stored on generationMeta.autoAdvanceMesocycle (default true when unset).
 */
export async function setMesocycleAutoAdvanceAction(
  programId: string,
  enabled: boolean
) {
  const session = await requireSession();
  const db = await getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");
  const meta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  await db
    .update(programs)
    .set({
      generationMeta: {
        ...meta,
        autoAdvanceMesocycle: enabled,
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));
  revalidatePath(`/programs/${programId}`);
  return { ok: true as const, autoAdvance: enabled };
}

/** Progress toward next auto-advance for program detail UI. */
export async function getMesocycleProgressAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  const meta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  const threshold = sessionsToAdvanceMesocycle(
    program.daysPerWeek,
    typeof meta.autoAdvanceAfterSessions === "number"
      ? (meta.autoAdvanceAfterSessions as number)
      : null
  );
  const windowStart = meta.mesocycleAppliedAt
    ? new Date(String(meta.mesocycleAppliedAt))
    : program.createdAt
      ? new Date(program.createdAt)
      : new Date(0);

  const completed = await db
    .select({ id: trainingSessions.id })
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.programId, programId),
        eq(trainingSessions.organizationId, session.organizationId),
        eq(trainingSessions.status, "completed"),
        gte(trainingSessions.performedAt, windowStart)
      )
    );

  const appliedWeek =
    typeof meta.mesocycleWeek === "number" ? (meta.mesocycleWeek as number) : 1;
  const autoAdvance = meta.autoAdvanceMesocycle !== false;

  return {
    completedInWindow: completed.length,
    threshold,
    appliedWeek,
    autoAdvance,
    appliedLabel: getMesocycleWeek(appliedWeek).label,
  };
}

/** Suggest week from program createdAt (for UI hint). */
export async function suggestProgramMesocycleWeekAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();
  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");
  const week = suggestMesocycleWeekFromStartDate(program.createdAt);
  const plan = getMesocycleWeek(week);
  return { week: plan.week, label: plan.label, notes: plan.notes };
}

/**
 * Insert up to 2 warmup correctives per program day from client history + assessments.
 * Skips exercises already present by exerciseId or name.
 */
export async function insertCorrectivesAction(programId: string) {
  const session = await requireSession();
  const db = await getDb();

  const [program] = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.id, programId),
        eq(programs.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!program) throw new Error("Program not found");

  let injuries: string | null = null;
  let assessmentHints: AssessmentHint[] = [];
  if (program.clientId) {
    const client = await getClientInOrg(
      program.clientId,
      session.organizationId
    );
    if (client) {
      injuries = client.injuries;
      assessmentHints = await loadAssessmentHintsForClient(client.id);
    }
  }

  const correctives = mergeCorrectives([
    correctivesFromClientHistory(injuries),
    ...assessmentHints.map((h) =>
      correctivesFromAssessmentResults({
        templateSlug: h.templateSlug,
        results: h.results || {},
        summary: h.summary,
      })
    ),
  ]);

  if (!correctives.length) {
    revalidatePath(`/programs/${programId}`);
    return { ok: true as const, inserted: 0, reason: "no_correctives" as const };
  }

  const bank = await listExercisesForOrg(session.organizationId);
  const poolItems: CorrectiveExercisePoolItem[] = bank.map((e) => ({
    id: e.id,
    name: e.name,
    tags: e.tags,
    movementPattern: e.movementPattern,
    available: e.available,
    cues: e.cues,
  }));

  const days = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, programId))
    .orderBy(asc(programDays.dayIndex));

  let inserted = 0;

  for (const day of days) {
    const existing = await db
      .select()
      .from(programExercises)
      .where(eq(programExercises.programDayId, day.id))
      .orderBy(asc(programExercises.sortOrder));

    const presentIds = new Set(
      existing.map((e) => e.exerciseId).filter(Boolean) as string[]
    );
    const presentNames = new Set(
      existing.map((e) => e.exerciseName.trim().toLowerCase())
    );

    const toInsert: Array<{
      exerciseId: string;
      exerciseName: string;
      movementPattern: string;
      notes: string;
      cues: string | null;
    }> = [];

    for (const corrective of correctives) {
      if (toInsert.length >= 2) break;
      const matches = matchExercisesForCorrective(corrective, poolItems, 8);
      const pick = matches.find((m) => {
        if (!m.available) return false;
        if (presentIds.has(m.id)) return false;
        if (presentNames.has(m.name.trim().toLowerCase())) return false;
        if (toInsert.some((t) => t.exerciseId === m.id)) return false;
        return true;
      });
      if (!pick) continue;
      const bankEx = bank.find((e) => e.id === pick.id);
      toInsert.push({
        exerciseId: pick.id,
        exerciseName: pick.name,
        movementPattern: pick.movementPattern || "mobility",
        notes: corrective.reason,
        cues: bankEx?.cues ?? null,
      });
    }

    if (!toInsert.length) continue;

    // Shift existing sort orders so warmups sit at the front
    const shift = toInsert.length;
    for (const pe of existing) {
      await db
        .update(programExercises)
        .set({ sortOrder: pe.sortOrder + shift })
        .where(eq(programExercises.id, pe.id));
    }

    for (let i = 0; i < toInsert.length; i++) {
      const ex = toInsert[i];
      await db.insert(programExercises).values({
        id: id("pe"),
        programDayId: day.id,
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        movementPattern: ex.movementPattern,
        sets: 2,
        reps: "8-10/side",
        rpe: "5-6",
        restSec: 45,
        notes: ex.notes,
        sortOrder: i,
        isWarmup: true,
        setScheme: "straight",
        setSchemeMeta: {
          summary: `Warm-up · ${ex.notes}`,
          howTo: ex.cues || ex.notes,
        },
        groupId: null,
        groupKind: null,
        groupLabel: null,
        groupOrder: null,
        restAfterSec: null,
        restBetweenRoundsSec: null,
        groupRole: null,
      });
      inserted += 1;
      presentIds.add(ex.exerciseId);
      presentNames.add(ex.exerciseName.trim().toLowerCase());
    }
  }

  const prevMeta =
    (program.generationMeta as Record<string, unknown> | null) || {};
  await db
    .update(programs)
    .set({
      generationMeta: {
        ...prevMeta,
        correctiveIds: correctives.map((c) => c.id),
        correctivesInsertedAt: new Date().toISOString(),
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs");
  if (program.clientId) revalidatePath(`/clients/${program.clientId}`);
  return { ok: true as const, inserted };
}
