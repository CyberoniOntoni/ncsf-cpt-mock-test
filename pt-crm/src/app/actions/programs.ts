"use server";

import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  assessmentTemplates,
  clientAssessments,
  clientDeficiencies,
  clientMeasurements,
  clients,
  mesocycles,
  programCorrectivePrescriptions,
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
import { defaultAddExerciseRx } from "@/lib/program-exercise-add";
import { suggestedInsertSortOrder } from "@/lib/exercise-order";
import { ensureSetLogs } from "@/lib/session-sets";
import { resolveFacilityEquipmentIdsAction } from "@/app/actions/client-equipment";
import { getClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";
import {
  evaluateClientRules,
  isInsufficientSafeExercisesError,
  measurementsFromRow,
  type ClientEvaluationContext,
} from "@/lib/smarter-rule-engine";

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
  facilityEquipmentMode?: "org" | "client" | "combined";
  facilityEquipmentIds?: string[];
  pinnedExerciseIds?: string[];
  suppressedDeficiencySlugs?: string[];
};

type FacilityEquipmentMode = NonNullable<CreateProgramInput["facilityEquipmentMode"]>;

function asStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const out = value.filter((x): x is string => typeof x === "string" && x.length > 0);
  return out.length ? out : undefined;
}

function asFacilityEquipmentMode(value: unknown): FacilityEquipmentMode | undefined {
  return value === "org" || value === "client" || value === "combined"
    ? value
    : undefined;
}

function builderPinFields(source: {
  facilityEquipmentMode?: FacilityEquipmentMode;
  facilityEquipmentIds?: string[];
  pinnedExerciseIds?: string[];
  suppressedDeficiencySlugs?: string[];
}): Pick<
  ProgramBuilderInput,
  | "facilityEquipmentMode"
  | "facilityEquipmentIds"
  | "pinnedExerciseIds"
  | "suppressedDeficiencySlugs"
> {
  return {
    facilityEquipmentMode: source.facilityEquipmentMode,
    facilityEquipmentIds: source.facilityEquipmentIds,
    pinnedExerciseIds: source.pinnedExerciseIds,
    suppressedDeficiencySlugs: source.suppressedDeficiencySlugs,
  };
}

function builderPinFieldsFromMeta(meta: Record<string, unknown>) {
  return builderPinFields({
    facilityEquipmentMode: asFacilityEquipmentMode(meta.facilityEquipmentMode),
    facilityEquipmentIds: asStringList(meta.facilityEquipmentIds),
    pinnedExerciseIds: asStringList(meta.pinnedExerciseIds),
    suppressedDeficiencySlugs: asStringList(meta.suppressedDeficiencySlugs),
  });
}

async function withResolvedFacilityIds(
  clientId: string | null | undefined,
  fields: ReturnType<typeof builderPinFields>
): Promise<ReturnType<typeof builderPinFields>> {
  const mode = fields.facilityEquipmentMode ?? "org";
  if (!clientId || fields.facilityEquipmentIds?.length || mode === "org") {
    return fields;
  }
  const ids = await resolveFacilityEquipmentIdsAction(clientId, mode);
  return { ...fields, facilityEquipmentIds: ids.length ? ids : undefined };
}

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

async function loadEvaluationContextForClient(
  client: {
    id: string;
    sex?: string | null;
    injuries?: string | null;
    contraindications?: string | null;
    medicalHistory?: string | null;
    goals?: string | null;
    experienceLevel?: string | null;
  },
  hints: AssessmentHint[]
): Promise<ClientEvaluationContext> {
  const db = await getDb();
  const [meas] = await db
    .select()
    .from(clientMeasurements)
    .where(eq(clientMeasurements.clientId, client.id))
    .orderBy(desc(clientMeasurements.takenAt))
    .limit(1);

  return {
    client: {
      id: client.id,
      sex: client.sex,
      injuriesText: client.injuries || "",
      contraindicationsText: client.contraindications || "",
      medicalHistoryText: client.medicalHistory || "",
      goalsText: client.goals || "",
      experienceLevel: client.experienceLevel || undefined,
    },
    measurements: meas ? measurementsFromRow(meas) : null,
    assessments: hints.map((h) => ({
      templateSlug: h.templateSlug,
      results: h.results || {},
      summary: h.summary,
    })),
  };
}

async function persistSmarterArtifacts(opts: {
  // drizzle transaction — keep duck-typed to avoid leaking PGlite tx generics
  tx: {
    insert: (table: unknown) => { values: (v: unknown) => unknown };
    update: (table: unknown) => {
      set: (v: unknown) => { where: (c: unknown) => unknown };
    };
  };
  organizationId: string;
  clientId: string | null | undefined;
  programId: string;
  draftMeta: Record<string, unknown> | null | undefined;
}) {
  const defs = (opts.draftMeta?.detectedDeficiencies || []) as Array<{
    slug: string;
    name?: string;
    severity?: string;
    source?: string;
    triggerDescription?: string;
    affectedSide?: string;
  }>;
  const phase = String(opts.draftMeta?.mesocyclePhase || "general_prep");
  const mesoId = id("meso");
  await opts.tx.insert(mesocycles).values({
    id: mesoId,
    programId: opts.programId,
    mesocycleNumber: 1,
    phase,
    name:
      phase === "corrective_prep"
        ? "Mesocycle 1 — Corrective prep"
        : `Mesocycle 1 — ${phase.replace(/_/g, " ")}`,
    durationWeeks: 4,
    status: "active",
    targetDeficiencies: defs.map((d) => d.slug),
  });
  await opts.tx
    .update(programs)
    .set({ currentMesocycleId: mesoId })
    .where(eq(programs.id, opts.programId));

  if (!opts.clientId || !defs.length) return;

  for (const d of defs) {
    const defId = id("cdef");
    await opts.tx.insert(clientDeficiencies).values({
      id: defId,
      organizationId: opts.organizationId,
      clientId: opts.clientId,
      deficiencySlug: d.slug,
      source: d.source || "assessment",
      severity: d.severity || "moderate",
      status: "active",
      affectedSide: d.affectedSide || "bilateral",
      notes: d.triggerDescription || null,
    });
    await opts.tx.insert(programCorrectivePrescriptions).values({
      id: id("pcp"),
      programId: opts.programId,
      mesocycleId: mesoId,
      clientDeficiencyId: defId,
      deficiencySlug: d.slug,
      prescribedExerciseName: d.name || d.slug,
      placement: "warmup",
      rationale: d.triggerDescription || null,
    });
  }
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

  if (days.length === 0) {
    return { program, client, days: [] };
  }

  const dayIds = days.map((d) => d.id);
  const allExercises = await db
    .select()
    .from(programExercises)
    .where(inArray(programExercises.programDayId, dayIds))
    .orderBy(asc(programExercises.sortOrder));

  const exercisesByDay = new Map<string, typeof allExercises>();
  for (const ex of allExercises) {
    let list = exercisesByDay.get(ex.programDayId);
    if (!list) {
      list = [];
      exercisesByDay.set(ex.programDayId, list);
    }
    list.push(ex);
  }

  const daysWithExercises = days.map((day) => ({
    ...day,
    exercises: exercisesByDay.get(day.id) || [],
  }));

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
  let evaluationContext: ClientEvaluationContext | null = null;
  let experience = input.experienceLevel;

  if (input.clientId) {
    const c = await getClientInOrg(input.clientId, session.organizationId);
    if (!c) throw new Error("Client not found");
    clientInjuries = c.injuries;
    clientGoals = c.goals;
    contraindications = c.contraindications ?? null;
    experience = experience || c.experienceLevel || undefined;
    assessmentHints = await loadAssessmentHintsForClient(c.id);
    evaluationContext = await loadEvaluationContextForClient(c, assessmentHints);
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
    evaluationContext,
    ...(await withResolvedFacilityIds(input.clientId, builderPinFields(input))),
  };

  const draft = await buildProgramDraft(builderInput);
  const programId = id("prg");

  const daysToInsert = draft.days.map((day) => ({
    id: day.id,
    programId,
    dayIndex: day.dayIndex,
    name: day.name,
    focus: day.focus,
  }));

  const exercisesToInsert = draft.days.flatMap((day) =>
    day.exercises.map((ex) => ({
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
    }))
  );

  await db.transaction(async (tx) => {
    await tx.insert(programs).values({
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
      generationMeta: {
        ...draft.meta,
        // Original wizard coach field only — regen must not re-feed composed notes
        coachNotes: input.notes ?? null,
      },
      facilityEquipmentMode: asFacilityEquipmentMode(input.facilityEquipmentMode) ?? "org",
    });

    if (daysToInsert.length > 0) {
      await tx.insert(programDays).values(daysToInsert);
    }
    if (exercisesToInsert.length > 0) {
      await tx.insert(programExercises).values(exercisesToInsert);
    }
    await persistSmarterArtifacts({
      tx: tx as never,
      organizationId: session.organizationId,
      clientId: input.clientId,
      programId,
      draftMeta: draft.meta as Record<string, unknown>,
    });
  });

  revalidatePath("/programs");
  if (input.clientId) {
    revalidatePath(`/clients/${input.clientId}`);
    await promoteLeadToActiveIfNeeded(input.clientId);
  }
  return { programId };
}

export type CreateBlankProgramInput = {
  title?: string;
  goal?: ProgramGoal;
  daysPerWeek?: number;
  sessionMinutes?: number;
  experienceLevel?: string;
  notes?: string;
  /** full_body | upper_lower | ppl | custom — seeds day names/focus */
  splitLayout?: string;
  /** Optional explicit day shells (overrides layout generation) */
  days?: Array<{ name: string; focus?: string | null }>;
  /** Optional — omit to save as unassigned template for later */
  clientId?: string | null;
  /** When true, status = active; default draft for “save for later” */
  activate?: boolean;
};

const DAY_LETTER = ["A", "B", "C", "D", "E", "F"] as const;

function scratchDayName(index: number, daysPerWeek: number): string {
  if (daysPerWeek <= 3) return `Day ${DAY_LETTER[index] ?? index + 1}`;
  return `Day ${index + 1}`;
}

/**
 * Empty program shell — trainer builds days/exercises by hand.
 * Default: draft + no client (saved for later / reusable template).
 */
export async function createBlankProgramAction(input: CreateBlankProgramInput) {
  const session = await requireSession();
  const db = await getDb();

  const { getScratchSplit, defaultTitleForScratch } = await import(
    "@/lib/program-scratch"
  );

  const daysPerWeek = Math.min(6, Math.max(1, Math.round(input.daysPerWeek || 3)));
  const sessionMinutes = Math.min(
    120,
    Math.max(20, Math.round(input.sessionMinutes || 45))
  );
  const goal = (input.goal || "general") as ProgramGoal;
  const splitLayout = input.splitLayout || "custom";
  const layout = getScratchSplit(splitLayout);
  const splitType =
    splitLayout === "full_body" ||
    splitLayout === "upper_lower" ||
    splitLayout === "ppl"
      ? splitLayout
      : "custom";

  const dayShells =
    input.days && input.days.length > 0
      ? input.days.slice(0, 6).map((d) => ({
          name: (d.name || "").trim() || "Day",
          focus: d.focus?.trim() || null,
        }))
      : layout.daysFor(daysPerWeek);

  const resolvedDays = dayShells.length
    ? dayShells
    : Array.from({ length: daysPerWeek }, (_, i) => ({
        name: scratchDayName(i, daysPerWeek),
        focus: null as string | null,
      }));

  const title =
    (input.title || "").trim() ||
    defaultTitleForScratch({
      goal,
      splitId: layout.id,
      daysPerWeek: resolvedDays.length,
      forLater: !input.clientId && !input.activate,
    });

  if (input.clientId) {
    const c = await getClientInOrg(input.clientId, session.organizationId);
    if (!c) throw new Error("Client not found");
  }

  const programId = id("prg");
  await db.insert(programs).values({
    id: programId,
    organizationId: session.organizationId,
    clientId: input.clientId || null,
    createdByUserId: session.userId,
    title,
    goal,
    daysPerWeek: resolvedDays.length,
    sessionMinutes,
    splitType,
    experienceLevel: input.experienceLevel || "intermediate",
    status: input.activate ? "active" : "draft",
    notes: input.notes?.trim() || null,
    generationMeta: {
      source: "scratch",
      manual: true,
      splitLayout: layout.id,
      createdAt: new Date().toISOString(),
      mesocycleWeek: 1,
    },
  });

  for (let i = 0; i < resolvedDays.length; i++) {
    const shell = resolvedDays[i]!;
    await db.insert(programDays).values({
      id: id("pd"),
      programId,
      dayIndex: i,
      name: shell.name,
      focus: shell.focus,
    });
  }

  revalidatePath("/programs");
  if (input.clientId) {
    revalidatePath(`/clients/${input.clientId}`);
    await promoteLeadToActiveIfNeeded(input.clientId);
  }
  return { programId };
}

/** Append an empty training day (for from-scratch builds). */
export async function addProgramDayAction(
  programId: string,
  opts?: { name?: string; focus?: string | null }
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

  const existing = await db
    .select({ dayIndex: programDays.dayIndex })
    .from(programDays)
    .where(eq(programDays.programId, programId));
  if (existing.length >= 6) {
    throw new Error("Maximum 6 training days per program");
  }
  const nextIndex =
    existing.length === 0
      ? 0
      : Math.max(...existing.map((d) => d.dayIndex)) + 1;
  const dayId = id("pd");
  const name =
    (opts?.name || "").trim() ||
    scratchDayName(nextIndex, Math.max(p.daysPerWeek, nextIndex + 1));

  await db.insert(programDays).values({
    id: dayId,
    programId,
    dayIndex: nextIndex,
    name,
    focus: opts?.focus?.trim() || null,
  });

  const newDaysPerWeek = Math.max(p.daysPerWeek, existing.length + 1);
  await db
    .update(programs)
    .set({
      daysPerWeek: newDaysPerWeek,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, programId));

  revalidatePath(`/programs/${programId}`);
  revalidatePath("/programs");
  return { dayId, name };
}

/** Rename / refocus a program day. */
export async function updateProgramDayAction(
  dayId: string,
  data: { name?: string; focus?: string | null }
) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select({
      day: programDays,
      program: programs,
    })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programDays.id, dayId))
    .limit(1);
  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const patch: { name?: string; focus?: string | null } = {};
  if (data.name !== undefined) {
    const n = data.name.trim();
    if (!n) throw new Error("Day name required");
    patch.name = n;
  }
  if (data.focus !== undefined) {
    patch.focus = data.focus?.trim() || null;
  }
  if (Object.keys(patch).length === 0) return { ok: true as const };

  await db.update(programDays).set(patch).where(eq(programDays.id, dayId));
  await db
    .update(programs)
    .set({ updatedAt: new Date() })
    .where(eq(programs.id, row.program.id));

  revalidatePath(`/programs/${row.program.id}`);
  return { ok: true as const };
}

/**
 * Remove a program day. Allowed when empty, or force=true (deletes exercises).
 * Reindexes remaining days and updates daysPerWeek.
 */
export async function deleteProgramDayAction(
  dayId: string,
  opts?: { force?: boolean }
) {
  const session = await requireSession();
  const db = await getDb();
  const [row] = await db
    .select({
      day: programDays,
      program: programs,
    })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programDays.id, dayId))
    .limit(1);
  if (!row || row.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const exCount = await db
    .select({ id: programExercises.id })
    .from(programExercises)
    .where(eq(programExercises.programDayId, dayId));
  if (exCount.length > 0 && !opts?.force) {
    throw new Error(
      "Day has exercises — remove them first, or force-delete the day"
    );
  }

  await db.delete(programDays).where(eq(programDays.id, dayId));

  const remaining = await db
    .select()
    .from(programDays)
    .where(eq(programDays.programId, row.program.id))
    .orderBy(asc(programDays.dayIndex));

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i]!.dayIndex !== i) {
      await db
        .update(programDays)
        .set({ dayIndex: i })
        .where(eq(programDays.id, remaining[i]!.id));
    }
  }

  await db
    .update(programs)
    .set({
      daysPerWeek: Math.max(1, remaining.length),
      updatedAt: new Date(),
    })
    .where(eq(programs.id, row.program.id));

  revalidatePath(`/programs/${row.program.id}`);
  revalidatePath("/programs");
  return { ok: true as const, remaining: remaining.length };
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

  const prevMeta =
    (row.program.generationMeta as Record<string, unknown> | null) || {};
  const baselines = prevMeta.baselinePrescriptions as
    | Record<string, BaselineRx>
    | undefined;

  let nextMeta = prevMeta;
  if (baselines && typeof baselines === "object") {
    nextMeta = {
      ...prevMeta,
      baselinePrescriptions: {
        ...baselines,
        [exerciseRowId]: {
          sets: finalSets,
          reps: finalReps,
          rpe: finalRpe,
          restSec: finalRest,
        },
      },
    };
  }

  await db
    .update(programs)
    .set({
      generationMeta: nextMeta,
      updatedAt: new Date(),
    })
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
  const newSets = keep ? row.pe.sets : 3;
  const newReps = keep ? row.pe.reps : "8-10";
  const newRpe = keep ? row.pe.rpe : "7";
  const newRest = keep ? row.pe.restSec : 90;

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
      sets: newSets,
      reps: newReps,
      rpe: newRpe,
      restSec: newRest,
    })
    .where(eq(programExercises.id, exerciseRowId));

  const swapPrevMeta =
    (row.program.generationMeta as Record<string, unknown> | null) || {};
  const swapBaselines = swapPrevMeta.baselinePrescriptions as
    | Record<string, BaselineRx>
    | undefined;

  let swapNextMeta = swapPrevMeta;
  if (swapBaselines && typeof swapBaselines === "object") {
    swapNextMeta = {
      ...swapPrevMeta,
      baselinePrescriptions: {
        ...swapBaselines,
        [exerciseRowId]: {
          sets: newSets,
          reps: newReps,
          rpe: newRpe,
          restSec: newRest,
        },
      },
    };
  }

  await db
    .update(programs)
    .set({
      generationMeta: swapNextMeta,
      updatedAt: new Date(),
    })
    .where(eq(programs.id, row.program.id));

  revalidatePath(`/programs/${row.program.id}`);
  return {
    ok: true as const,
    name: pick.name,
    movementPattern: pick.movementPattern,
  };
}

/** Re-sequence a day's exercises with science order (bench before OHP, etc.). */
async function _reorderProgramDayExercises(
  programDayId: string,
  ctx: { focus?: string | null; goal?: string | null; splitType?: string | null }
) {
  const db = await getDb();
  const { sortExercisesForSession } = await import("@/lib/exercise-order");
  const rows = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, programDayId));
  if (rows.length <= 1) return;

  const ordered = sortExercisesForSession(
    rows.map((r) => ({
      id: r.id,
      exerciseName: r.exerciseName,
      movementPattern: r.movementPattern,
      isWarmup: r.isWarmup,
      setScheme: r.setScheme,
      setSchemeMeta: r.setSchemeMeta as {
        phase?: string;
        summary?: string;
      } | null,
      groupId: r.groupId,
      groupOrder: r.groupOrder,
      sortOrder: r.sortOrder,
    })),
    {
      focus: ctx.focus,
      sessionKind: ctx.splitType,
      goal: ctx.goal || undefined,
    }
  );

  const validRows = ordered.filter(
    (r): r is typeof r & { id: string; sortOrder: number } =>
      Boolean((r as { id?: string }).id) && r.sortOrder != null
  );

  if (validRows.length > 0) {
    const ids = validRows.map((r) => r.id);
    const caseCases = validRows.map(
      (r) => sql`WHEN ${programExercises.id} = ${r.id} THEN ${r.sortOrder}::integer`
    );
    await db
      .update(programExercises)
      .set({ sortOrder: sql`CASE ${sql.join(caseCases, sql` `)} END` })
      .where(inArray(programExercises.id, ids));
  }
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

  // Goal + pattern aware defaults (strength rest/reps, hypertrophy density, etc.)
  const defaults = defaultAddExerciseRx(isWarmup, {
    goal: dayRow.program.goal,
    pattern: pick.movementPattern,
  });
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

  const rows = await db
    .select()
    .from(programExercises)
    .where(eq(programExercises.programDayId, input.programDayId));
  const incoming = {
    exerciseName: pick.name,
    movementPattern: pick.movementPattern,
    isWarmup,
  };
  const insertAt = suggestedInsertSortOrder(rows, incoming, {
    goal: dayRow.program.goal,
  });

  const peId = id("pe");
  const toShift = rows.filter((r) => r.sortOrder >= insertAt);
  await db.transaction(async (tx) => {
    if (toShift.length > 0) {
      const ids = toShift.map((r) => r.id);
      const caseCases = toShift.map(
        (r) =>
          sql`WHEN ${programExercises.id} = ${r.id} THEN ${r.sortOrder + 1}::integer`
      );
      await tx
        .update(programExercises)
        .set({ sortOrder: sql`CASE ${sql.join(caseCases, sql` `)} END` })
        .where(inArray(programExercises.id, ids));
    }
    await tx.insert(programExercises).values({
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
      sortOrder: insertAt,
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

/** Reorder exercises within a program day. */
export async function reorderProgramExercisesAction(input: {
  programDayId: string;
  orderedExerciseIds: string[];
}) {
  const session = await requireSession();
  const db = await getDb();

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

  const { programDayId, orderedExerciseIds } = input;

  if (orderedExerciseIds.length > 0) {
    const caseCases = orderedExerciseIds.map(
      (exerciseId, index) =>
        sql`WHEN ${programExercises.id} = ${exerciseId} THEN ${index}::integer`
    );
    await db
      .update(programExercises)
      .set({ sortOrder: sql`CASE ${sql.join(caseCases, sql` `)} END` })
      .where(
        and(
          eq(programExercises.programDayId, programDayId),
          inArray(programExercises.id, orderedExerciseIds)
        )
      );
  }

  revalidatePath(`/programs/${dayRow.program.id}`);
  revalidatePath("/programs");
  if (dayRow.program.clientId) {
    revalidatePath(`/clients/${dayRow.program.clientId}`);
  }

  return { ok: true as const };
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

  const prevMeta =
    (row.program.generationMeta as Record<string, unknown> | null) || {};
  const baselines = prevMeta.baselinePrescriptions as
    | Record<string, BaselineRx>
    | undefined;

  let nextMeta = prevMeta;
  if (baselines && typeof baselines === "object" && exerciseRowId in baselines) {
    const { [exerciseRowId]: _, ...restBaselines } = baselines;
    nextMeta = {
      ...prevMeta,
      baselinePrescriptions: restBaselines,
    };
  }

  await db
    .update(programs)
    .set({
      generationMeta: nextMeta,
      updatedAt: new Date(),
    })
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
  let evaluationContext: ClientEvaluationContext | null = null;
  let experience = input.experienceLevel;

  if (input.clientId) {
    const c = await getClientInOrg(input.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
      evaluationContext = await loadEvaluationContextForClient(c, assessmentHints);
    }
  }

  try {
    return await buildProgramDraft({
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
      evaluationContext,
      ...(await withResolvedFacilityIds(input.clientId, builderPinFields(input))),
    });
  } catch (err) {
    if (isInsufficientSafeExercisesError(err)) {
      throw new Error(
        `INSUFFICIENT_SAFE_EXERCISES:${err.pattern}:${err.secondaryTried.join(",")}`
      );
    }
    throw err;
  }
}

export async function evaluateClientRulesAction(clientId: string, goal = "general") {
  const session = await requireSession();
  const c = await getClientInOrg(clientId, session.organizationId);
  if (!c) throw new Error("Client not found");
  const hints = await loadAssessmentHintsForClient(c.id);
  const ctx = await loadEvaluationContextForClient(c, hints);
  return evaluateClientRules(ctx, goal);
}

/** Plan alias — same create path, smarter persist already wired. */
export async function createSmarterProgramAction(input: CreateProgramInput) {
  return createProgramFromWizardAction(input);
}

export async function previewSmarterProgramAction(input: CreateProgramInput) {
  return previewProgramAction(input);
}

export async function applySmarterCorrectivesAction(programId: string) {
  return insertCorrectivesAction(programId);
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

  const dayIds = days.map((d) => d.id);
  const allExercises =
    dayIds.length > 0
      ? await db
          .select()
          .from(programExercises)
          .where(inArray(programExercises.programDayId, dayIds))
      : [];

  // Capture baselines on first apply (or for any new exercise rows)
  const needBaselineCapture = Object.keys(baselines).length === 0;
  if (needBaselineCapture) {
    baselines = {};
    for (const pe of allExercises) {
      baselines[pe.id] = {
        sets: pe.sets,
        reps: pe.reps,
        rpe: pe.rpe,
        restSec: pe.restSec,
      };
    }
  } else {
    // Add baselines for any exercises added since last capture
    for (const pe of allExercises) {
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

  if (allExercises.length > 0) {
    const ids = allExercises.map((pe) => pe.id);

    const setsCases: ReturnType<typeof sql>[] = [];
    const repsCases: ReturnType<typeof sql>[] = [];
    const rpeCases: ReturnType<typeof sql>[] = [];
    const restCases: ReturnType<typeof sql>[] = [];
    const notesCases: ReturnType<typeof sql>[] = [];

    for (const pe of allExercises) {
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

      setsCases.push(sql`WHEN ${programExercises.id} = ${pe.id} THEN ${scaled.sets}::integer`);
      repsCases.push(sql`WHEN ${programExercises.id} = ${pe.id} THEN ${scaled.reps}::text`);
      rpeCases.push(sql`WHEN ${programExercises.id} = ${pe.id} THEN ${scaled.rpe}::text`);
      restCases.push(sql`WHEN ${programExercises.id} = ${pe.id} THEN ${scaled.restSec}::integer`);
      notesCases.push(sql`WHEN ${programExercises.id} = ${pe.id} THEN ${notes}::text`);
    }

    await db
      .update(programExercises)
      .set({
        sets: sql`CASE ${sql.join(setsCases, sql` `)} END`,
        reps: sql`CASE ${sql.join(repsCases, sql` `)} END`,
        rpe: sql`CASE ${sql.join(rpeCases, sql` `)} END`,
        restSec: sql`CASE ${sql.join(restCases, sql` `)} END`,
        notes: sql`CASE ${sql.join(notesCases, sql` `)} END`,
      })
      .where(inArray(programExercises.id, ids));
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
  let evaluationContext: ClientEvaluationContext | null = null;

  if (program.clientId) {
    const c = await getClientInOrg(program.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
      evaluationContext = await loadEvaluationContextForClient(c, assessmentHints);
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

  const coachNotes =
    typeof prevMeta.coachNotes === "string"
      ? (prevMeta.coachNotes as string)
      : prevMeta.coachNotes === null
        ? null
        : undefined;

  const draft = await buildProgramDraft({
    organizationId: session.organizationId,
    title: program.title,
    goal: (program.goal as ProgramGoal) || "general",
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    experienceLevel: experience,
    notes: coachNotes ?? undefined,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility,
    mesocycleWeek: week,
    assessmentHints,
    variationSeed,
    evaluationContext,
    ...(await withResolvedFacilityIds(
      program.clientId,
      builderPinFieldsFromMeta(prevMeta)
    )),
  });

  const daysToInsert = draft.days.map((day) => ({
    id: day.id,
    programId,
    dayIndex: day.dayIndex,
    name: day.name,
    focus: day.focus,
  }));

  const exercisesToInsert = draft.days.flatMap((day) =>
    day.exercises.map((ex) => ({
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
    }))
  );

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

  await db.transaction(async (tx) => {
    const oldDays = await tx
      .select({ id: programDays.id })
      .from(programDays)
      .where(eq(programDays.programId, programId));

    if (oldDays.length > 0) {
      const oldDayIds = oldDays.map((d) => d.id);
      await tx
        .delete(programExercises)
        .where(inArray(programExercises.programDayId, oldDayIds));
      await tx
        .delete(programDays)
        .where(eq(programDays.programId, programId));
    }

    if (daysToInsert.length > 0) {
      await tx.insert(programDays).values(daysToInsert);
    }
    if (exercisesToInsert.length > 0) {
      await tx.insert(programExercises).values(exercisesToInsert);
    }

    await tx
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
          coachNotes: coachNotes ?? null,
          baselinePrescriptions: baselines,
          regeneratedAt: new Date().toISOString(),
          previousVariationSeed: prevMeta.variationSeed ?? null,
        },
        updatedAt: new Date(),
      })
      .where(eq(programs.id, programId));
  });

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
  let evaluationContext: ClientEvaluationContext | null = null;

  if (program.clientId) {
    const c = await getClientInOrg(program.clientId, session.organizationId);
    if (c) {
      clientInjuries = c.injuries;
      clientGoals = c.goals;
      contraindications = c.contraindications ?? null;
      experience = experience || c.experienceLevel || undefined;
      assessmentHints = await loadAssessmentHintsForClient(c.id);
      evaluationContext = await loadEvaluationContextForClient(c, assessmentHints);
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

  const coachNotes =
    typeof prevMeta.coachNotes === "string"
      ? (prevMeta.coachNotes as string)
      : prevMeta.coachNotes === null
        ? null
        : undefined;

  const draft = await buildProgramDraft({
    organizationId: session.organizationId,
    title: program.title,
    goal: (program.goal as ProgramGoal) || "general",
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    experienceLevel: experience,
    notes: coachNotes ?? undefined,
    clientInjuries,
    clientGoals,
    contraindications,
    preferMobility,
    mesocycleWeek: week,
    assessmentHints,
    variationSeed,
    evaluationContext,
    ...(await withResolvedFacilityIds(
      program.clientId,
      builderPinFieldsFromMeta(prevMeta)
    )),
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
        coachNotes: coachNotes ?? prevMeta.coachNotes ?? null,
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
  if (sessions.length > 0) {
    const sessionIds = sessions.map((s) => s.id);
    const logs = await db
      .select()
      .from(sessionExerciseLogs)
      .where(inArray(sessionExerciseLogs.sessionId, sessionIds));

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
  const sortOrderUpdates: { id: string; newSortOrder: number }[] = [];
  const correctivesToInsert: (typeof programExercises.$inferInsert)[] = [];

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
      sortOrderUpdates.push({ id: pe.id, newSortOrder: pe.sortOrder + shift });
    }

    for (let i = 0; i < toInsert.length; i++) {
      const ex = toInsert[i];
      correctivesToInsert.push({
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

  if (sortOrderUpdates.length > 0) {
    const ids = sortOrderUpdates.map((u) => u.id);
    const caseCases = sortOrderUpdates.map(
      (u) => sql`WHEN ${programExercises.id} = ${u.id} THEN ${u.newSortOrder}::integer`
    );
    await db
      .update(programExercises)
      .set({ sortOrder: sql`CASE ${sql.join(caseCases, sql` `)} END` })
      .where(inArray(programExercises.id, ids));
  }

  if (correctivesToInsert.length > 0) {
    await db.insert(programExercises).values(correctivesToInsert);
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
