"use server";

import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { updateClientStageAction } from "@/app/actions/crm";
import { getDb } from "@/db";
import {
  assessmentTemplates,
  clientAssessments,
  clientMeasurements,
  clientNotes,
  clients,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { CLIENT_LIST_STAGES } from "@/lib/crm-constants";
import { clientSearchHaystack, fullName, id } from "@/lib/utils";

export async function searchClientsAction(query: string) {
  try {
    const session = await requireSession();
    const db = await getDb();
    const all = await db
      .select()
      .from(clients)
      .where(eq(clients.organizationId, session.organizationId))
      .orderBy(desc(clients.updatedAt))
      .limit(100);

    const q = query.trim().toLowerCase();
    if (!q) {
      // Floor picker: active roster only (not draft / inactive)
      return all
        .filter((c) => c.status !== "draft" && c.status !== "inactive")
        .slice(0, 12);
    }
    // Named search can still find inactive clients to reopen them
    return all
      .filter(
        (c) =>
          c.status !== "draft" &&
          (clientSearchHaystack(c).includes(q) ||
            fullName(c.firstName, c.lastName).toLowerCase().includes(q))
      )
      .slice(0, 20);
  } catch (e) {
    console.error("[searchClientsAction]", e);
    return [];
  }
}

/**
 * Soft-deactivate: keeps history; hides from default floor picker.
 * Named UX API — delegates to updateClientStageAction (single status writer).
 */
export async function deactivateClientAction(clientId: string) {
  try {
    await updateClientStageAction(clientId, "inactive");
    return { ok: true as const, status: "inactive" as const };
  } catch (e) {
    console.error("[deactivateClientAction]", e);
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to deactivate client" };
  }
}

/**
 * Restore a deactivated client to active roster.
 * Named UX API — delegates to updateClientStageAction (single status writer).
 */
export async function reactivateClientAction(clientId: string) {
  try {
    await updateClientStageAction(clientId, "active");
    return { ok: true as const, status: "active" as const };
  } catch (e) {
    console.error("[reactivateClientAction]", e);
    return { ok: false as const, error: e instanceof Error ? e.message : "Failed to reactivate client" };
  }
}

export async function listClientsAction() {
  try {
    const session = await requireSession();
    const db = await getDb();
    return await db
      .select()
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, session.organizationId),
          inArray(clients.status, [...CLIENT_LIST_STAGES])
        )
      )
      .orderBy(desc(clients.updatedAt));
  } catch (e) {
    console.error("[listClientsAction]", e);
    return [];
  }
}

export async function getClientAction(clientId: string) {
  try {
    const session = await requireSession();
    const db = await getDb();
    const [client] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)))
      .limit(1);
    if (!client) return null;

    const measurements = await db
      .select()
      .from(clientMeasurements)
      .where(eq(clientMeasurements.clientId, clientId))
      .orderBy(desc(clientMeasurements.takenAt));

    const assessments = await db
      .select({
        assessment: clientAssessments,
        template: assessmentTemplates,
      })
      .from(clientAssessments)
      .leftJoin(assessmentTemplates, eq(clientAssessments.templateId, assessmentTemplates.id))
      .where(eq(clientAssessments.clientId, clientId))
      .orderBy(desc(clientAssessments.takenAt));

    const notes = await db
      .select()
      .from(clientNotes)
      .where(eq(clientNotes.clientId, clientId))
      .orderBy(desc(clientNotes.createdAt));

    return { client, measurements, assessments, notes };
  } catch (e) {
    console.error("[getClientAction]", e);
    return null;
  }
}

export async function listAssessmentTemplatesAction() {
  try {
    await requireSession();
    const db = await getDb();
    return await db
      .select()
      .from(assessmentTemplates)
      .where(eq(assessmentTemplates.active, true))
      .orderBy(assessmentTemplates.sortOrder);
  } catch (e) {
    console.error("[listAssessmentTemplatesAction]", e);
    return [];
  }
}

export type IntakeBasics = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  sex?: string;
  emergencyContact?: string;
  status?: string;
};

export type IntakeHistory = {
  goals?: string;
  experienceLevel?: string;
  occupation?: string;
  lifestyleNotes?: string;
  medicalHistory?: string;
  injuries?: string;
  medications?: string;
  contraindications?: string;
};

export type IntakeMeasurement = {
  heightCm?: number;
  weightKg?: number;
  bodyFatPct?: number;
  chestCm?: number;
  waistCm?: number;
  hipsCm?: number;
  notes?: string;
  /** Extra girths (biceps, wrist, thigh, …) stored in metrics JSON */
  metrics?: Record<string, number | string>;
};

export async function createDraftClientAction(basics: IntakeBasics) {
  const session = await requireSession();
  const firstName = basics.firstName?.trim();
  if (!firstName) throw new Error("First name is required");

  const db = await getDb();
  const clientId = id("cli");
  await db.insert(clients).values({
    id: clientId,
    organizationId: session.organizationId,
    status: "draft",
    firstName,
    lastName: (basics.lastName || "").trim(),
    email: basics.email || null,
    phone: basics.phone || null,
    dateOfBirth: basics.dateOfBirth || null,
    sex: basics.sex || null,
    emergencyContact: basics.emergencyContact || null,
  });
  return { clientId, ok: true };
}

export async function updateClientBasicsAction(clientId: string, basics: IntakeBasics) {
  const session = await requireSession();
  const firstName = basics.firstName?.trim();
  if (!firstName) throw new Error("First name is required");

  const db = await getDb();
  await db
    .update(clients)
    .set({
      firstName,
      lastName: (basics.lastName || "").trim(),
      email: basics.email || null,
      phone: basics.phone || null,
      dateOfBirth: basics.dateOfBirth || null,
      sex: basics.sex || null,
      emergencyContact: basics.emergencyContact || null,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)));
  return { ok: true };
}

export async function updateClientHistoryAction(clientId: string, history: IntakeHistory) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(clients)
    .set({
      goals: history.goals || null,
      experienceLevel: history.experienceLevel || null,
      occupation: history.occupation || null,
      lifestyleNotes: history.lifestyleNotes || null,
      medicalHistory: history.medicalHistory || null,
      injuries: history.injuries || null,
      medications: history.medications || null,
      contraindications: history.contraindications || null,
      updatedAt: new Date(),
    })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)));
  return { ok: true };
}

export async function addClientMeasurementAction(clientId: string, m: IntakeMeasurement) {
  const session = await requireSession();
  const db = await getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)))
    .limit(1);
  if (!client) throw new Error("Client not found");

  const metrics =
    m.metrics && Object.keys(m.metrics).length > 0 ? m.metrics : null;
  const hasAny = [
    m.heightCm,
    m.weightKg,
    m.bodyFatPct,
    m.chestCm,
    m.waistCm,
    m.hipsCm,
    m.notes,
    metrics,
  ].some((v) => v !== undefined && v !== null && v !== "");
  if (!hasAny) throw new Error("Enter at least one measurement");

  await db.transaction(async (tx) => {
    await tx.insert(clientMeasurements).values({
      id: id("msr"),
      clientId,
      heightCm: m.heightCm ?? null,
      weightKg: m.weightKg ?? null,
      bodyFatPct: m.bodyFatPct ?? null,
      chestCm: m.chestCm ?? null,
      waistCm: m.waistCm ?? null,
      hipsCm: m.hipsCm ?? null,
      notes: m.notes || null,
      metrics,
    });
    await tx
      .update(clients)
      .set({ updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/");
  return { ok: true };
}

export type MeasurementFormState = {
  ok?: boolean;
  error?: string;
  savedAt?: number;
} | null;

function formNum(formData: FormData, key: string): number | undefined {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`${key}: use a number`);
  return n;
}

/** Form-action compatible save (works with <form action={...}> / useActionState). */
export async function addClientMeasurementFormAction(
  _prev: MeasurementFormState,
  formData: FormData
): Promise<MeasurementFormState> {
  try {
    const clientId = String(formData.get("clientId") || "").trim();
    if (!clientId) return { error: "Missing client" };

    const { parseMetricsFromFormData } = await import("@/lib/measurements");
    const metrics = parseMetricsFromFormData(formData);

    await addClientMeasurementAction(clientId, {
      heightCm: formNum(formData, "heightCm"),
      weightKg: formNum(formData, "weightKg"),
      bodyFatPct: formNum(formData, "bodyFatPct"),
      chestCm: formNum(formData, "chestCm"),
      waistCm: formNum(formData, "waistCm"),
      hipsCm: formNum(formData, "hipsCm"),
      notes: String(formData.get("notes") || "").trim() || undefined,
      metrics: Object.keys(metrics).length ? metrics : undefined,
    });

    return { ok: true, savedAt: Date.now() };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : "Save failed",
    };
  }
}

export async function saveClientAssessmentAction(
  clientId: string,
  templateId: string,
  results: Record<string, unknown>,
  notes?: string,
  summary?: string
) {
  const session = await requireSession();
  const db = await getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)))
    .limit(1);
  if (!client) throw new Error("Client not found");

  const [template] = await db
    .select()
    .from(assessmentTemplates)
    .where(eq(assessmentTemplates.id, templateId))
    .limit(1);

  const autoSummary =
    summary ||
    (template
      ? Object.entries(results)
          .filter(([, v]) => v !== "" && v != null)
          .map(([k, v]) => `${k}: ${v}`)
          .join("; ")
      : null);

  const assessmentId = id("cas");
  await db.transaction(async (tx) => {
    await tx.insert(clientAssessments).values({
      id: assessmentId,
      clientId,
      templateId,
      results,
      notes: notes || null,
      summary: autoSummary || null,
    });

    await tx
      .update(clients)
      .set({ updatedAt: new Date() })
      .where(eq(clients.id, clientId));
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/assessments`);
  revalidatePath("/");
  return { assessmentId, ok: true };
}

/**
 * Finish intake draft → lead (pipeline). Promote to active on first
 * package, client-linked program, or completed floor session.
 */
export async function finalizeClientAction(clientId: string) {
  const session = await requireSession();
  const db = await getDb();
  await db
    .update(clients)
    .set({ status: "lead", updatedAt: new Date() })
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)));
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** Quick-add starts as lead so CRM pipeline + quiet-lead needs-you work. */
export async function quickAddClientAction(input: {
  firstName: string;
  lastName?: string;
  phone?: string;
  email?: string;
}) {
  const session = await requireSession();
  const firstName = input.firstName?.trim();
  if (!firstName) throw new Error("First name is required");

  const db = await getDb();
  const clientId = id("cli");
  await db.insert(clients).values({
    id: clientId,
    organizationId: session.organizationId,
    status: "lead",
    firstName,
    lastName: (input.lastName || "").trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
  });
  revalidatePath("/");
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
  return {
    clientId,
    firstName,
    lastName: (input.lastName || "").trim(),
    phone: input.phone?.trim() || null,
    email: input.email?.trim() || null,
    status: "lead" as const,
    goals: null as string | null,
    ok: true,
  };
}

export async function saveRecommendationToClientAction(
  clientId: string,
  title: string,
  body: string,
  conversationId?: string,
  metadata?: Record<string, unknown>
) {
  const session = await requireSession();
  const db = await getDb();
  const [client] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, session.organizationId)))
    .limit(1);
  if (!client) throw new Error("Client not found");

  await db.insert(clientNotes).values({
    id: id("note"),
    clientId,
    authorUserId: session.userId,
    conversationId: conversationId || null,
    title,
    body,
    kind: "ai_solution",
    metadata: metadata || null,
  });
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}
