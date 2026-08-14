import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import {
  clientAppointments,
  clientAssessments,
  clientDocuments,
  clientInvoices,
  clientMeasurements,
  clients,
  notifications,
  organizations,
  programDays,
  programExercises,
  programs,
} from "@/db/schema";
import { getEffectiveInvoiceStatus } from "@/lib/invoice-status";
import {
  toClientProgramView,
  type PortalClientProgram,
} from "@/lib/portal-program";
import { id } from "@/lib/utils";

export async function getPortalClient(organizationId: string, clientId: string) {
  const db = await getDb();
  const [row] = await db
    .select({
      id: clients.id,
      organizationId: clients.organizationId,
      firstName: clients.firstName,
      lastName: clients.lastName,
      email: clients.email,
      phone: clients.phone,
      goals: clients.goals,
      status: clients.status,
      avatarUrl: clients.avatarUrl,
      notificationPreferences: clients.notificationPreferences,
      onboardingCompletedAt: clients.onboardingCompletedAt,
      studioName: organizations.name,
    })
    .from(clients)
    .innerJoin(organizations, eq(organizations.id, clients.organizationId))
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, organizationId)))
    .limit(1);
  return row || null;
}

export async function getPortalActiveProgram(
  organizationId: string,
  clientId: string
): Promise<PortalClientProgram | null> {
  const db = await getDb();
  const [program] = await db
    .select({
      id: programs.id,
      title: programs.title,
      goal: programs.goal,
      daysPerWeek: programs.daysPerWeek,
      sessionMinutes: programs.sessionMinutes,
      splitType: programs.splitType,
      notes: programs.notes,
    })
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, organizationId),
        eq(programs.clientId, clientId),
        eq(programs.status, "active")
      )
    )
    .orderBy(desc(programs.updatedAt))
    .limit(1);
  if (!program) return null;

  const days = await db
    .select({
      id: programDays.id,
      dayIndex: programDays.dayIndex,
      name: programDays.name,
      focus: programDays.focus,
    })
    .from(programDays)
    .where(eq(programDays.programId, program.id))
    .orderBy(asc(programDays.dayIndex));

  const dayIds = days.map((d) => d.id);
  const filtered =
    dayIds.length === 0
      ? []
      : await db
          .select({
            id: programExercises.id,
            programDayId: programExercises.programDayId,
            exerciseName: programExercises.exerciseName,
            movementPattern: programExercises.movementPattern,
            sets: programExercises.sets,
            reps: programExercises.reps,
            rpe: programExercises.rpe,
            restSec: programExercises.restSec,
            notes: programExercises.notes,
            sortOrder: programExercises.sortOrder,
            isWarmup: programExercises.isWarmup,
            setScheme: programExercises.setScheme,
            setSchemeMeta: programExercises.setSchemeMeta,
            groupId: programExercises.groupId,
            groupKind: programExercises.groupKind,
            groupLabel: programExercises.groupLabel,
            groupOrder: programExercises.groupOrder,
          })
          .from(programExercises)
          .where(inArray(programExercises.programDayId, dayIds))
          .orderBy(asc(programExercises.sortOrder));

  return toClientProgramView({
    title: program.title,
    goal: program.goal,
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: filtered
        .filter((e) => e.programDayId === d.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({
          id: e.id,
          exerciseName: e.exerciseName,
          sets: e.sets,
          reps: e.reps,
          rpe: e.rpe,
          restSec: e.restSec,
          notes: e.notes,
          sortOrder: e.sortOrder,
          isWarmup: e.isWarmup,
          setScheme: e.setScheme,
          setSchemeMeta: e.setSchemeMeta,
          groupId: e.groupId,
          groupKind: e.groupKind,
          groupLabel: e.groupLabel,
          groupOrder: e.groupOrder,
        })),
    })),
  });
}

export async function getPortalNextAppointment(
  organizationId: string,
  clientId: string
) {
  const db = await getDb();
  const grace = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const [row] = await db
    .select({
      id: clientAppointments.id,
      title: clientAppointments.title,
      startsAt: clientAppointments.startsAt,
      endsAt: clientAppointments.endsAt,
      status: clientAppointments.status,
      location: clientAppointments.location,
    })
    .from(clientAppointments)
    .innerJoin(clients, eq(clientAppointments.clientId, clients.id))
    .where(
      and(
        eq(clients.organizationId, organizationId),
        eq(clientAppointments.clientId, clientId),
        eq(clientAppointments.status, "scheduled"),
        gte(clientAppointments.startsAt, grace)
      )
    )
    .orderBy(asc(clientAppointments.startsAt))
    .limit(1);
  return row || null;
}

export async function getPortalInvoices(organizationId: string, clientId: string) {
  const db = await getDb();
  const rows = await db
    .select({
      id: clientInvoices.id,
      title: clientInvoices.title,
      amountCents: clientInvoices.amountCents,
      currency: clientInvoices.currency,
      status: clientInvoices.status,
      issuedAt: clientInvoices.issuedAt,
      dueAt: clientInvoices.dueAt,
      paymentUrl: clientInvoices.paymentUrl,
      paidAt: clientInvoices.paidAt,
    })
    .from(clientInvoices)
    .where(
      and(
        eq(clientInvoices.organizationId, organizationId),
        eq(clientInvoices.clientId, clientId)
      )
    )
    .orderBy(desc(clientInvoices.issuedAt));

  return rows.map((r) => ({
    ...r,
    effectiveStatus: getEffectiveInvoiceStatus(r),
  }));
}

export async function getPortalNotifications(
  organizationId: string,
  clientId: string,
  limit = 12
) {
  const db = await getDb();
  return db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, organizationId),
        eq(notifications.clientId, clientId)
      )
    )
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function notifyProgramAssigned(opts: {
  organizationId: string;
  clientId: string;
  title: string;
}) {
  const db = await getDb();
  await db.insert(notifications).values({
    id: id("ntf"),
    organizationId: opts.organizationId,
    clientId: opts.clientId,
    type: "program_assigned",
    title: "New program",
    body: opts.title,
  });
}

export async function getPortalDocuments(organizationId: string, clientId: string) {
  const db = await getDb();
  return db
    .select({
      id: clientDocuments.id,
      type: clientDocuments.type,
      title: clientDocuments.title,
      status: clientDocuments.status,
      documentVersion: clientDocuments.documentVersion,
      signedAt: clientDocuments.signedAt,
    })
    .from(clientDocuments)
    .where(
      and(
        eq(clientDocuments.organizationId, organizationId),
        eq(clientDocuments.clientId, clientId)
      )
    )
    .orderBy(asc(clientDocuments.createdAt));
}

export async function getPortalMeasurements(
  organizationId: string,
  clientId: string,
  limit = 12
) {
  const db = await getDb();
  return db
    .select({
      id: clientMeasurements.id,
      takenAt: clientMeasurements.takenAt,
      weightKg: clientMeasurements.weightKg,
      bodyFatPct: clientMeasurements.bodyFatPct,
      waistCm: clientMeasurements.waistCm,
    })
    .from(clientMeasurements)
    .innerJoin(clients, eq(clientMeasurements.clientId, clients.id))
    .where(
      and(
        eq(clients.organizationId, organizationId),
        eq(clientMeasurements.clientId, clientId)
      )
    )
    .orderBy(desc(clientMeasurements.takenAt))
    .limit(limit);
}

export async function getPortalAssessments(
  organizationId: string,
  clientId: string,
  limit = 8
) {
  const db = await getDb();
  return db
    .select({
      id: clientAssessments.id,
      takenAt: clientAssessments.takenAt,
      summary: clientAssessments.summary,
    })
    .from(clientAssessments)
    .innerJoin(clients, eq(clientAssessments.clientId, clients.id))
    .where(
      and(
        eq(clients.organizationId, organizationId),
        eq(clientAssessments.clientId, clientId)
      )
    )
    .orderBy(desc(clientAssessments.takenAt))
    .limit(limit);
}
