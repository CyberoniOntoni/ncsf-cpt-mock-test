"use server";

import { and, asc, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  clientAppointments,
  clientCheckIns,
  clientInvoices,
  clientPackages,
  clientTasks,
  clients,
  trainingSessions,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  CHECK_IN_CHANNELS,
  CLIENT_STAGES,
  type CheckInChannel,
  type ClientStage,
} from "@/lib/crm-constants";
import { parseMoneyToCents } from "@/lib/money";
import { assertCanManageMoney } from "@/lib/rbac";
import { assertClientInOrg } from "@/lib/tenant";
import { id } from "@/lib/utils";

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
  revalidatePath("/calendar");
}

export type CalendarAppointmentItem = {
  id: string;
  clientId: string;
  clientName: string;
  title: string;
  startsAt: Date | string;
  endsAt: Date | string | null;
  status: string;
  sessionId: string | null;
};

/**
 * Org appointments in a range for the month calendar.
 * @param rangeStartIso ISO start (inclusive)
 * @param rangeEndIso ISO end (inclusive)
 */
export async function listCalendarAppointmentsAction(
  rangeStartIso: string,
  rangeEndIso: string
): Promise<CalendarAppointmentItem[]> {
  try {
    const session = await requireSession();
    const rangeStart = new Date(rangeStartIso);
    const rangeEnd = new Date(rangeEndIso);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
      return [];
    }
    // Guard absurd ranges (e.g. > 90 days)
    if (rangeEnd.getTime() - rangeStart.getTime() > 90 * 24 * 60 * 60 * 1000) {
      return [];
    }

  const db = await getDb();
  const orgId = session.organizationId;

  const rows = await db
    .select({
      id: clientAppointments.id,
      clientId: clientAppointments.clientId,
      title: clientAppointments.title,
      startsAt: clientAppointments.startsAt,
      endsAt: clientAppointments.endsAt,
      status: clientAppointments.status,
      sessionId: clientAppointments.sessionId,
      firstName: clients.firstName,
      lastName: clients.lastName,
    })
    .from(clientAppointments)
    .innerJoin(clients, eq(clientAppointments.clientId, clients.id))
    .where(
      and(
        eq(clients.organizationId, orgId),
        gte(clientAppointments.startsAt, rangeStart),
        lte(clientAppointments.startsAt, rangeEnd)
      )
    )
    .orderBy(asc(clientAppointments.startsAt))
    .limit(500);

  return rows.map((r) => ({
    id: r.id,
    clientId: r.clientId,
    clientName: [r.firstName, r.lastName].filter(Boolean).join(" ").trim(),
    title: r.title,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    sessionId: r.sessionId ?? null,
  }));
  } catch (e) {
    console.error("[listCalendarAppointmentsAction]", e);
    return [];
  }
}

// ── Stage ──────────────────────────────────────────────────────────

/**
 * Single source of truth for clients.status updates (stage picker,
 * deactivate, reactivate). Named wrappers may call this for UX-specific APIs.
 */
export async function updateClientStageAction(
  clientId: string,
  status: string
) {
  const session = await requireSession();
  const stage = status.trim().toLowerCase();
  if (!CLIENT_STAGES.includes(stage as ClientStage)) {
    throw new Error(`Invalid stage: ${status}`);
  }
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  await db
    .update(clients)
    .set({ status: stage, updatedAt: new Date() })
    .where(
      and(
        eq(clients.id, clientId),
        eq(clients.organizationId, session.organizationId)
      )
    );
  revalidateClient(clientId);
  return { ok: true as const, status: stage as ClientStage };
}

/**
 * First real engagement (package / client-linked program / floor session):
 * lead → active. No-op for other stages. Never throws — callers must not fail.
 */
export async function promoteLeadToActiveIfNeeded(clientId: string) {
  try {
    const session = await requireSession();
    await assertClientInOrg(clientId, session.organizationId);
    const db = await getDb();
    // Conditional update: only promote leads (case handled via lower-match)
    const [row] = await db
      .select({ status: clients.status })
      .from(clients)
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (!row || row.status.trim().toLowerCase() !== "lead") return;
    await db
      .update(clients)
      .set({ status: "active", updatedAt: new Date() })
      .where(
        and(
          eq(clients.id, clientId),
          eq(clients.organizationId, session.organizationId),
          eq(clients.status, "lead")
        )
      );
    revalidateClient(clientId);
  } catch {
    // Swallow — package / program / session complete must not fail on promote
  }
}

// ── Packages ───────────────────────────────────────────────────────

export async function createClientPackageAction(input: {
  clientId: string;
  name?: string;
  totalSessions: number;
  usedSessions?: number;
  notes?: string;
  expiresAt?: string | null;
}) {
  const session = await requireSession();
  await assertClientInOrg(input.clientId, session.organizationId);
  const total = Math.max(1, Math.floor(input.totalSessions || 1));
  const used = Math.max(
    0,
    Math.min(total, Math.floor(input.usedSessions ?? 0))
  );
  const remaining = total - used;
  const status = remaining <= 0 ? "exhausted" : "active";
  const db = await getDb();
  const pkgId = id("pkg");
  await db.insert(clientPackages).values({
    id: pkgId,
    clientId: input.clientId,
    name: (input.name || "Session pack").trim() || "Session pack",
    totalSessions: total,
    usedSessions: used,
    status,
    notes: input.notes?.trim() || null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
  });
  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, input.clientId));
  revalidateClient(input.clientId);
  await promoteLeadToActiveIfNeeded(input.clientId);
  return { id: pkgId };
}

export async function adjustPackageUsedAction(
  packageId: string,
  clientId: string,
  delta: number
) {
  const session = await requireSession();
  assertCanManageMoney(session.role);
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [pkg] = await db
    .select()
    .from(clientPackages)
    .where(
      and(
        eq(clientPackages.id, packageId),
        eq(clientPackages.clientId, clientId)
      )
    )
    .limit(1);
  if (!pkg) throw new Error("Package not found");
  if (pkg.status === "cancelled") throw new Error("Package is cancelled");

  const used = Math.max(
    0,
    Math.min(pkg.totalSessions, pkg.usedSessions + Math.trunc(delta))
  );
  const remaining = pkg.totalSessions - used;
  const status = remaining <= 0 ? "exhausted" : "active";

  await db
    .update(clientPackages)
    .set({ usedSessions: used, status })
    .where(eq(clientPackages.id, packageId));
  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  revalidateClient(clientId);
  return { usedSessions: used, remaining, status };
}

function packIsBurnable(
  pkg: {
    status: string;
    usedSessions: number;
    totalSessions: number;
    expiresAt: Date | string | null;
  },
  now: Date
): boolean {
  if (pkg.status !== "active") return false;
  if (pkg.usedSessions >= pkg.totalSessions) return false;
  if (pkg.expiresAt != null && new Date(pkg.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

/**
 * Consume one session from the oldest burnable pack (active, not expired, used < total).
 * Used when a floor session is completed (not calendar “close booking”).
 * Safe no-op when no pack / already empty. Race-safe: re-read + conditional update.
 * When sessionId is provided and burn succeeds, stores packageId on the training session.
 */
export async function tryConsumePackageSessionAction(
  clientId: string,
  sessionId?: string
) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const now = new Date();

  const activeRows = await db
    .select()
    .from(clientPackages)
    .where(
      and(
        eq(clientPackages.clientId, clientId),
        eq(clientPackages.status, "active")
      )
    )
    .orderBy(asc(clientPackages.purchasedAt));

  // Heal active-but-full or expired rows so they don't block older-first selection forever
  for (const row of activeRows) {
    if (row.usedSessions >= row.totalSessions) {
      await db
        .update(clientPackages)
        .set({ status: "exhausted" })
        .where(eq(clientPackages.id, row.id));
    }
  }

  const pkg = activeRows.find((p) => packIsBurnable(p, now));
  if (!pkg) {
    // Distinguish empty-but-present vs no usable pack
    const hadActive = activeRows.some((p) => p.usedSessions >= p.totalSessions);
    if (hadActive) {
      const empty = activeRows.find((p) => p.usedSessions >= p.totalSessions);
      return {
        consumed: false as const,
        reason: "empty" as const,
        packageId: empty?.id,
        packageName: empty?.name,
        remaining: 0,
        status: "exhausted" as const,
      };
    }
    return { consumed: false as const, reason: "no_pack" as const };
  }

  // Re-read for atomic-style burn
  const [fresh] = await db
    .select()
    .from(clientPackages)
    .where(eq(clientPackages.id, pkg.id))
    .limit(1);
  if (!fresh || !packIsBurnable(fresh, now)) {
    return {
      consumed: false as const,
      reason: "race" as const,
      packageId: pkg.id,
      packageName: pkg.name,
    };
  }

  const expectedUsed = fresh.usedSessions;
  const used = expectedUsed + 1;
  const remaining = fresh.totalSessions - used;
  const status = remaining <= 0 ? "exhausted" : "active";

  // Conditional update: only if still at expected used + active
  await db
    .update(clientPackages)
    .set({ usedSessions: used, status })
    .where(
      and(
        eq(clientPackages.id, fresh.id),
        eq(clientPackages.usedSessions, expectedUsed),
        eq(clientPackages.status, "active")
      )
    );

  const [after] = await db
    .select()
    .from(clientPackages)
    .where(eq(clientPackages.id, fresh.id))
    .limit(1);
  if (!after || after.usedSessions !== used) {
    return {
      consumed: false as const,
      reason: "race" as const,
      packageId: fresh.id,
      packageName: fresh.name,
    };
  }

  if (sessionId) {
    await db
      .update(trainingSessions)
      .set({ packageId: fresh.id, updatedAt: new Date() })
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingSessions.organizationId, session.organizationId),
          eq(trainingSessions.clientId, clientId)
        )
      );
  }

  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  revalidateClient(clientId);
  return {
    consumed: true as const,
    reason: "ok" as const,
    packageId: fresh.id,
    packageName: fresh.name,
    remaining,
    status,
  };
}

/**
 * Restore one used session on a pack.
 * Prefer the pack linked on the training session (packageId); else most recently
 * purchased active/exhausted pack with used > 0.
 * Used when deleting a completed floor session that may have burned a pack credit.
 */
export async function tryRestorePackageSessionAction(
  clientId: string,
  sessionId?: string
) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();

  let pkg: typeof clientPackages.$inferSelect | undefined;

  if (sessionId) {
    const [ts] = await db
      .select({
        packageId: trainingSessions.packageId,
        organizationId: trainingSessions.organizationId,
        clientId: trainingSessions.clientId,
      })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.id, sessionId),
          eq(trainingSessions.organizationId, session.organizationId)
        )
      )
      .limit(1);
    if (ts?.packageId && (!ts.clientId || ts.clientId === clientId)) {
      const [linked] = await db
        .select()
        .from(clientPackages)
        .where(
          and(
            eq(clientPackages.id, ts.packageId),
            eq(clientPackages.clientId, clientId)
          )
        )
        .limit(1);
      if (linked && linked.usedSessions > 0 && linked.status !== "cancelled") {
        pkg = linked;
      }
    }
  }

  if (!pkg) {
    const candidates = await db
      .select()
      .from(clientPackages)
      .where(
        and(
          eq(clientPackages.clientId, clientId),
          or(
            eq(clientPackages.status, "active"),
            eq(clientPackages.status, "exhausted")
          )
        )
      )
      .orderBy(desc(clientPackages.purchasedAt));
    pkg = candidates.find((p) => p.usedSessions > 0);
  }

  if (!pkg) return { restored: false as const };

  const expectedUsed = pkg.usedSessions;
  const used = Math.max(0, expectedUsed - 1);
  const remaining = pkg.totalSessions - used;
  const status = remaining <= 0 ? "exhausted" : "active";

  await db
    .update(clientPackages)
    .set({ usedSessions: used, status })
    .where(
      and(
        eq(clientPackages.id, pkg.id),
        eq(clientPackages.usedSessions, expectedUsed)
      )
    );

  const [after] = await db
    .select()
    .from(clientPackages)
    .where(eq(clientPackages.id, pkg.id))
    .limit(1);
  if (!after || after.usedSessions !== used) {
    return { restored: false as const, reason: "race" as const };
  }

  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  revalidateClient(clientId);
  return {
    restored: true as const,
    packageId: pkg.id,
    remaining,
    status,
  };
}

export async function cancelClientPackageAction(
  packageId: string,
  clientId: string
) {
  const session = await requireSession();
  assertCanManageMoney(session.role);
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  await db
    .update(clientPackages)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(clientPackages.id, packageId),
        eq(clientPackages.clientId, clientId)
      )
    );
  revalidateClient(clientId);
  return { ok: true as const };
}

// ── Appointments ───────────────────────────────────────────────────

/** Lightweight context for calendar book dialog (pack remaining). */
export async function getClientBookContextAction(clientId: string) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [client] = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      status: clients.status,
    })
    .from(clients)
    .where(eq(clients.id, clientId))
    .limit(1);
  if (!client) throw new Error("Client not found");

  const pkgs = await db
    .select({
      id: clientPackages.id,
      name: clientPackages.name,
      status: clientPackages.status,
      totalSessions: clientPackages.totalSessions,
      usedSessions: clientPackages.usedSessions,
    })
    .from(clientPackages)
    .where(
      and(
        eq(clientPackages.clientId, clientId),
        eq(clientPackages.status, "active")
      )
    )
    .orderBy(desc(clientPackages.purchasedAt))
    .limit(5);

  const active = pkgs
    .map((p) => ({
      id: p.id,
      name: p.name,
      remaining: Math.max(0, p.totalSessions - p.usedSessions),
      total: p.totalSessions,
    }))
    .sort((a, b) => a.remaining - b.remaining);

  return {
    clientId: client.id,
    name: [client.firstName, client.lastName].filter(Boolean).join(" ").trim(),
    status: client.status,
    activePackage: active[0] ?? null,
    packages: active,
  };
}

export async function createClientAppointmentAction(input: {
  clientId: string;
  startsAt: string;
  title?: string;
  notes?: string;
  location?: string;
  durationMin?: number;
}) {
  const session = await requireSession();
  await assertClientInOrg(input.clientId, session.organizationId);
  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) throw new Error("Invalid start time");
  const duration = Math.max(15, Math.floor(input.durationMin ?? 60));
  const ends = new Date(starts.getTime() + duration * 60_000);
  const db = await getDb();
  const apptId = id("apt");
  await db.insert(clientAppointments).values({
    id: apptId,
    clientId: input.clientId,
    title: (input.title || "Training session").trim() || "Training session",
    startsAt: starts,
    endsAt: ends,
    status: "scheduled",
    notes: input.notes?.trim() || null,
    location: input.location?.trim() || null,
  });
  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, input.clientId));
  revalidateClient(input.clientId);
  return { id: apptId };
}

/**
 * Calendar book: appointment + optional invoice in one step.
 * billingMode:
 *  - pack: use session pack (no invoice; note on booking)
 *  - invoice: create unpaid (or paid) invoice for this session
 *  - none: no billing
 */
export async function createBookingWithBillingAction(input: {
  clientId: string;
  startsAt: string;
  title?: string;
  durationMin?: number;
  billingMode: "pack" | "invoice" | "none";
  /** Required when billingMode === "invoice" */
  amount?: string;
  currency?: string;
  /** When invoice: mark paid immediately */
  markPaid?: boolean;
  /** Link invoice to package when known */
  packageId?: string | null;
}) {
  const session = await requireSession();
  await assertClientInOrg(input.clientId, session.organizationId);

  const mode = input.billingMode;
  if (mode !== "pack" && mode !== "invoice" && mode !== "none") {
    throw new Error("Invalid billing mode");
  }
  if (mode === "invoice") {
    assertCanManageMoney(session.role);
  }

  const starts = new Date(input.startsAt);
  if (Number.isNaN(starts.getTime())) throw new Error("Invalid start time");
  const duration = Math.max(15, Math.floor(input.durationMin ?? 60));
  const ends = new Date(starts.getTime() + duration * 60_000);
  const title =
    (input.title || "Training session").trim() || "Training session";

  const db = await getDb();

  // Pack context for notes / validation
  let packNote: string | null = null;
  let packageId: string | null = input.packageId?.trim() || null;
  if (mode === "pack") {
    const pkgs = await db
      .select()
      .from(clientPackages)
      .where(
        and(
          eq(clientPackages.clientId, input.clientId),
          eq(clientPackages.status, "active")
        )
      )
      .orderBy(desc(clientPackages.purchasedAt))
      .limit(8);
    const withRemain = pkgs
      .map((p) => ({
        ...p,
        remaining: Math.max(0, p.totalSessions - p.usedSessions),
      }))
      .filter((p) => p.remaining > 0)
      .sort((a, b) => a.remaining - b.remaining);
    const pkg = packageId
      ? withRemain.find((p) => p.id === packageId) || withRemain[0]
      : withRemain[0];
    if (!pkg) {
      throw new Error(
        "No pack with remaining sessions — switch to invoice or add a pack"
      );
    }
    packageId = pkg.id;
    packNote = `Billing: pack credit · ${pkg.name} · ${pkg.remaining} left before session`;
  }

  let invoiceNote: string | null = null;
  let invoiceId: string | null = null;
  let amountCents: number | null = null;
  let currency = "SGD";

  if (mode === "invoice") {
    try {
      amountCents = parseMoneyToCents(input.amount || "");
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "Enter a valid amount (e.g. 100)"
      );
    }
    currency =
      (input.currency || "SGD").trim().toUpperCase().slice(0, 8) || "SGD";
    invoiceNote = `Billing: invoice · ${currency} ${(amountCents / 100).toFixed(2)}${input.markPaid ? " · paid" : " · unpaid"}`;
  }

  const notes = [packNote, invoiceNote].filter(Boolean).join(" · ") || null;

  const apptId = id("apt");
  await db.insert(clientAppointments).values({
    id: apptId,
    clientId: input.clientId,
    title,
    startsAt: starts,
    endsAt: ends,
    status: "scheduled",
    notes,
    location: null,
  });

  if (mode === "invoice" && amountCents != null) {
    invoiceId = id("inv");
    const whenLabel = starts.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    await db.insert(clientInvoices).values({
      id: invoiceId,
      organizationId: session.organizationId,
      clientId: input.clientId,
      title: `${title} · ${whenLabel}`.slice(0, 120),
      amountCents,
      currency,
      status: input.markPaid ? "paid" : "unpaid",
      notes: `Booked with session on ${whenLabel}`,
      packageId: packageId || null,
      issuedAt: new Date(),
      paidAt: input.markPaid ? new Date() : null,
    });
  }

  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, input.clientId));
  revalidateClient(input.clientId);
  return {
    appointmentId: apptId,
    invoiceId,
    billingMode: mode,
  };
}

export async function updateAppointmentStatusAction(
  appointmentId: string,
  clientId: string,
  status: "scheduled" | "completed" | "cancelled" | "no_show"
) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();

  const [existing] = await db
    .select({
      status: clientAppointments.status,
      sessionId: clientAppointments.sessionId,
    })
    .from(clientAppointments)
    .where(
      and(
        eq(clientAppointments.id, appointmentId),
        eq(clientAppointments.clientId, clientId)
      )
    )
    .limit(1);

  if (!existing) {
    throw new Error("Appointment not found");
  }

  const wasCompleted = existing.status === "completed";

  await db
    .update(clientAppointments)
    .set({ status })
    .where(
      and(
        eq(clientAppointments.id, appointmentId),
        eq(clientAppointments.clientId, clientId)
      )
    );

  if (status === "completed" && !wasCompleted) {
    try {
      await tryConsumePackageSessionAction(
        clientId,
        existing.sessionId || appointmentId
      );
    } catch {
      // pack consume optional — do not block appointment status update
    }
  }

  revalidateClient(clientId);
  return { ok: true as const };
}

// ── Check-ins ──────────────────────────────────────────────────────

export async function createClientCheckInAction(input: {
  clientId: string;
  body: string;
  channel?: CheckInChannel | string;
}) {
  const session = await requireSession();
  await assertClientInOrg(input.clientId, session.organizationId);
  const body = input.body.trim();
  if (!body) throw new Error("Check-in note is required");
  const channel = (input.channel || "message").trim().toLowerCase();
  const ch = CHECK_IN_CHANNELS.includes(channel as CheckInChannel)
    ? channel
    : "other";
  const db = await getDb();
  const checkInId = id("cki");
  await db.insert(clientCheckIns).values({
    id: checkInId,
    clientId: input.clientId,
    authorUserId: session.userId,
    channel: ch,
    body,
  });
  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, input.clientId));
  revalidateClient(input.clientId);
  return { id: checkInId };
}

// ── Tasks / follow-ups ─────────────────────────────────────────────

export async function createClientTaskAction(input: {
  clientId: string;
  title: string;
  dueAt?: string | null;
}) {
  const session = await requireSession();
  await assertClientInOrg(input.clientId, session.organizationId);
  const title = input.title.trim();
  if (!title) throw new Error("Task title is required");
  let due: Date | null = null;
  if (input.dueAt) {
    // Date-only (YYYY-MM-DD) → local end of that calendar day (not UTC midnight)
    if (/^\d{4}-\d{2}-\d{2}$/.test(input.dueAt)) {
      const [y, m, d] = input.dueAt.split("-").map(Number);
      due = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else {
      due = new Date(input.dueAt);
    }
    if (Number.isNaN(due.getTime())) throw new Error("Invalid due date");
  }
  const db = await getDb();
  const taskId = id("tsk");
  await db.insert(clientTasks).values({
    id: taskId,
    organizationId: session.organizationId,
    clientId: input.clientId,
    title,
    dueAt: due,
    status: "open",
  });
  revalidateClient(input.clientId);
  return { id: taskId };
}

export async function setClientTaskDoneAction(
  taskId: string,
  clientId: string,
  done: boolean
) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [row] = await db
    .select()
    .from(clientTasks)
    .where(
      and(
        eq(clientTasks.id, taskId),
        eq(clientTasks.clientId, clientId),
        eq(clientTasks.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Task not found");
  await db
    .update(clientTasks)
    .set({
      status: done ? "done" : "open",
      completedAt: done ? new Date() : null,
    })
    .where(eq(clientTasks.id, taskId));
  revalidateClient(clientId);
  return { ok: true as const };
}

export async function deleteClientTaskAction(taskId: string, clientId: string) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  await db
    .delete(clientTasks)
    .where(
      and(
        eq(clientTasks.id, taskId),
        eq(clientTasks.clientId, clientId),
        eq(clientTasks.organizationId, session.organizationId)
      )
    );
  revalidateClient(clientId);
  return { ok: true as const };
}

// ── Invoices (manual mark paid) ────────────────────────────────────

export async function createClientInvoiceAction(input: {
  clientId: string;
  title: string;
  amount: string;
  currency?: string;
  notes?: string;
  packageId?: string | null;
}) {
  const session = await requireSession();
  assertCanManageMoney(session.role);
  await assertClientInOrg(input.clientId, session.organizationId);
  const title = (input.title || "").trim() || "Session pack";
  if (title.length > 120) {
    throw new Error("Title is too long (max 120 characters)");
  }
  let amountCents: number;
  try {
    amountCents = parseMoneyToCents(input.amount);
  } catch (e) {
    throw new Error(
      e instanceof Error ? e.message : "Invalid amount — use e.g. 600 or 120.50"
    );
  }
  const notes = (input.notes || "").trim() || null;
  if (notes && notes.length > 500) {
    throw new Error("Notes are too long (max 500 characters)");
  }
  const currency = (input.currency || "SGD").trim().toUpperCase().slice(0, 8) || "SGD";
  const db = await getDb();
  const invId = id("inv");
  await db.insert(clientInvoices).values({
    id: invId,
    organizationId: session.organizationId,
    clientId: input.clientId,
    title,
    amountCents,
    currency,
    status: "unpaid",
    notes,
    packageId: input.packageId?.trim() || null,
    issuedAt: new Date(),
  });
  revalidateClient(input.clientId);
  return { id: invId };
}

export async function setClientInvoicePaidAction(
  invoiceId: string,
  clientId: string,
  paid: boolean
) {
  const session = await requireSession();
  assertCanManageMoney(session.role);
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [row] = await db
    .select()
    .from(clientInvoices)
    .where(
      and(
        eq(clientInvoices.id, invoiceId),
        eq(clientInvoices.clientId, clientId),
        eq(clientInvoices.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Invoice not found");
  if (row.status === "void") throw new Error("Invoice is void");
  await db
    .update(clientInvoices)
    .set({
      status: paid ? "paid" : "unpaid",
      paidAt: paid ? new Date() : null,
    })
    .where(eq(clientInvoices.id, invoiceId));
  revalidateClient(clientId);
  return { ok: true as const };
}

export async function voidClientInvoiceAction(
  invoiceId: string,
  clientId: string
) {
  const session = await requireSession();
  assertCanManageMoney(session.role);
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [row] = await db
    .select()
    .from(clientInvoices)
    .where(
      and(
        eq(clientInvoices.id, invoiceId),
        eq(clientInvoices.clientId, clientId),
        eq(clientInvoices.organizationId, session.organizationId)
      )
    )
    .limit(1);
  if (!row) throw new Error("Invoice not found");
  if (row.status === "void") return { ok: true as const };
  await db
    .update(clientInvoices)
    .set({ status: "void", paidAt: null })
    .where(eq(clientInvoices.id, invoiceId));
  revalidateClient(clientId);
  return { ok: true as const };
}

/** CRM snapshot for client detail header + panel */
export async function getClientCrmSnapshotAction(clientId: string) {
  try {
    const session = await requireSession();
    await assertClientInOrg(clientId, session.organizationId);
    const db = await getDb();

    const [packages, appointments, checkIns, nextAppt, tasks, invoices] =
      await Promise.all([
      db
        .select()
        .from(clientPackages)
        .where(eq(clientPackages.clientId, clientId))
        .orderBy(desc(clientPackages.purchasedAt)),
      db
        .select()
        .from(clientAppointments)
        .where(eq(clientAppointments.clientId, clientId))
        .orderBy(desc(clientAppointments.startsAt))
        .limit(12),
      db
        .select()
        .from(clientCheckIns)
        .where(eq(clientCheckIns.clientId, clientId))
        .orderBy(desc(clientCheckIns.createdAt))
        .limit(12),
      // Next booking = earliest still-scheduled (includes past-due so floor can start)
      db
        .select()
        .from(clientAppointments)
        .where(
          and(
            eq(clientAppointments.clientId, clientId),
            eq(clientAppointments.status, "scheduled")
          )
        )
        .orderBy(asc(clientAppointments.startsAt))
        .limit(1),
      db
        .select()
        .from(clientTasks)
        .where(eq(clientTasks.clientId, clientId))
        .orderBy(asc(clientTasks.dueAt), desc(clientTasks.createdAt))
        .limit(20),
      db
        .select()
        .from(clientInvoices)
        .where(eq(clientInvoices.clientId, clientId))
        .orderBy(desc(clientInvoices.issuedAt))
        .limit(20),
    ]);

    const activePkgs = packages.filter((p) => p.status === "active");
    activePkgs.sort(
      (a, b) =>
        a.totalSessions - a.usedSessions - (b.totalSessions - b.usedSessions)
    );
    const activePackage = activePkgs[0]
      ? {
          id: activePkgs[0].id,
          name: activePkgs[0].name,
          remaining:
            activePkgs[0].totalSessions - activePkgs[0].usedSessions,
          total: activePkgs[0].totalSessions,
          used: activePkgs[0].usedSessions,
        }
      : null;

    // Last purchased pack (any status) for one-tap renew prefill
    const lastPackage = packages[0]
      ? {
          name: packages[0].name,
          totalSessions: packages[0].totalSessions,
        }
      : null;

    return {
      packages,
      appointments,
      checkIns,
      tasks,
      invoices,
      nextAppointment: nextAppt[0] ?? null,
      activePackage,
      lastPackage,
    };
  } catch (e) {
    console.error("[getClientCrmSnapshotAction]", e);
    return {
      packages: [],
      appointments: [],
      checkIns: [],
      tasks: [],
      invoices: [],
      nextAppointment: null,
      activePackage: null,
      lastPackage: null,
    };
  }
}

/** Org-wide CRM signals for home needs-you (packages low, appts due, leads). */
export async function listOrgCrmSignalsAction() {
  try {
    const session = await requireSession();
    const db = await getDb();
    const orgId = session.organizationId;

    const orgClients = await db
      .select({
        id: clients.id,
        firstName: clients.firstName,
        lastName: clients.lastName,
        status: clients.status,
        updatedAt: clients.updatedAt,
      })
      .from(clients)
      .where(eq(clients.organizationId, orgId));

    if (!orgClients.length) {
      return {
        lowPackages: [],
        upcomingAppts: [],
        quietLeads: [],
        openTasks: [],
        unpaidInvoices: [],
      };
    }

    const clientById = new Map(orgClients.map((c) => [c.id, c]));
    const clientIdList = orgClients.map((c) => c.id);
    const leadIds = orgClients
      .filter((c) => c.status === "lead")
      .map((c) => c.id);

    const nowDate = new Date();
    const horizon = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const [pkgs, allAppts, checkIns, unpaidInvRows] = await Promise.all([
      db
        .select({
          clientId: clientPackages.clientId,
          name: clientPackages.name,
          status: clientPackages.status,
          totalSessions: clientPackages.totalSessions,
          usedSessions: clientPackages.usedSessions,
        })
        .from(clientPackages)
        .where(
          and(
            inArray(clientPackages.clientId, clientIdList),
            or(
              eq(clientPackages.status, "active"),
              eq(clientPackages.status, "exhausted")
            )
          )
        ),
      db
        .select({
          id: clientAppointments.id,
          clientId: clientAppointments.clientId,
          startsAt: clientAppointments.startsAt,
          title: clientAppointments.title,
          sessionId: clientAppointments.sessionId,
        })
        .from(clientAppointments)
        .where(
          and(
            inArray(clientAppointments.clientId, clientIdList),
            eq(clientAppointments.status, "scheduled"),
            gte(clientAppointments.startsAt, nowDate),
            lte(clientAppointments.startsAt, horizon)
          )
        )
        .orderBy(asc(clientAppointments.startsAt))
        .limit(40),
      leadIds.length
        ? db
            .select({
              clientId: clientCheckIns.clientId,
              createdAt: clientCheckIns.createdAt,
            })
            .from(clientCheckIns)
            .where(inArray(clientCheckIns.clientId, leadIds))
        : Promise.resolve([] as Array<{ clientId: string; createdAt: Date }>),
      db
        .select({
          id: clientInvoices.id,
          clientId: clientInvoices.clientId,
          title: clientInvoices.title,
          amountCents: clientInvoices.amountCents,
          currency: clientInvoices.currency,
        })
        .from(clientInvoices)
        .where(
          and(
            inArray(clientInvoices.clientId, clientIdList),
            eq(clientInvoices.status, "unpaid")
          )
        )
        .orderBy(desc(clientInvoices.issuedAt))
        .limit(30),
    ]);

    type PackAgg = {
      activeRemaining: number;
      activeName: string | null;
      lowestActive: number;
      hasExhausted: boolean;
      exhaustedName: string | null;
    };
    const packAgg = new Map<string, PackAgg>();
    for (const p of pkgs) {
      const remaining = Math.max(0, p.totalSessions - p.usedSessions);
      let agg = packAgg.get(p.clientId);
      if (!agg) {
        agg = {
          activeRemaining: 0,
          activeName: null,
          lowestActive: Infinity,
          hasExhausted: false,
          exhaustedName: null,
        };
        packAgg.set(p.clientId, agg);
      }
      if (p.status === "active") {
        agg.activeRemaining += remaining;
        if (remaining < agg.lowestActive) {
          agg.lowestActive = remaining;
          agg.activeName = p.name;
        }
      } else if (p.status === "exhausted") {
        agg.hasExhausted = true;
        if (!agg.exhaustedName) agg.exhaustedName = p.name;
      }
    }

    const lowPackages: Array<{
      clientId: string;
      name: string;
      remaining: number;
      packageName: string;
    }> = [];
    for (const [clientId, agg] of packAgg) {
      const c = clientById.get(clientId);
      if (
        !c ||
        c.status === "inactive" ||
        c.status === "draft" ||
        c.status === "paused"
      ) {
        continue;
      }
      if (agg.activeRemaining > 2) continue;
      const remaining =
        agg.activeRemaining > 0 || !agg.hasExhausted
          ? agg.activeRemaining
          : 0;
      if (remaining > 2) continue;
      if (agg.activeRemaining === 0 && !agg.hasExhausted) continue;
      lowPackages.push({
        clientId,
        name: `${c.firstName} ${c.lastName || ""}`.trim(),
        remaining,
        packageName:
          agg.activeName || agg.exhaustedName || "Session pack",
      });
    }
    lowPackages.sort((a, b) => a.remaining - b.remaining);

    const upcomingAppts = allAppts
      .map((a) => {
        const c = clientById.get(a.clientId);
        if (
          !c ||
          c.status === "inactive" ||
          c.status === "draft" ||
          c.status === "paused"
        ) {
          return null;
        }
        return {
          clientId: a.clientId,
          name: `${c.firstName} ${c.lastName || ""}`.trim(),
          startsAt: a.startsAt as Date,
          title: a.title,
          appointmentId: a.id,
          sessionId: a.sessionId ?? null,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null);

    const lastCheckIn = new Map<string, number>();
    for (const ci of checkIns) {
      const t = new Date(ci.createdAt).getTime();
      const prev = lastCheckIn.get(ci.clientId) ?? 0;
      if (t > prev) lastCheckIn.set(ci.clientId, t);
    }
    const week = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const quietLeads: Array<{ clientId: string; name: string }> = [];
    for (const c of orgClients) {
      if (c.status !== "lead") continue;
      if (quietLeads.length >= 10) break;
      const last = lastCheckIn.get(c.id);
      if (!last || now - last >= week) {
        quietLeads.push({
          clientId: c.id,
          name: `${c.firstName} ${c.lastName || ""}`.trim(),
        });
      }
    }

    const openTaskRows = await db
      .select({
        id: clientTasks.id,
        clientId: clientTasks.clientId,
        title: clientTasks.title,
        dueAt: clientTasks.dueAt,
      })
      .from(clientTasks)
      .where(
        and(
          eq(clientTasks.organizationId, orgId),
          eq(clientTasks.status, "open")
        )
      )
      .orderBy(asc(clientTasks.dueAt))
      .limit(40);

    const weekAhead = now + week;
    const openTasks: Array<{
      taskId: string;
      clientId: string;
      name: string;
      title: string;
      dueAt: Date | null;
    }> = [];
    for (const t of openTaskRows) {
      if (openTasks.length >= 15) break;
      const c = clientById.get(t.clientId);
      if (
        !c ||
        c.status === "inactive" ||
        c.status === "draft" ||
        c.status === "paused"
      ) {
        continue;
      }
      if (t.dueAt) {
        const dueMs = new Date(t.dueAt).getTime();
        if (dueMs > weekAhead) continue;
      }
      openTasks.push({
        taskId: t.id,
        clientId: t.clientId,
        name: `${c.firstName} ${c.lastName || ""}`.trim(),
        title: t.title,
        dueAt: t.dueAt ? (t.dueAt as Date) : null,
      });
    }

    const unpaidInvoices: Array<{
      invoiceId: string;
      clientId: string;
      name: string;
      title: string;
      amountCents: number;
      currency: string;
    }> = [];
    for (const inv of unpaidInvRows) {
      if (unpaidInvoices.length >= 15) break;
      const c = clientById.get(inv.clientId);
      if (
        !c ||
        c.status === "inactive" ||
        c.status === "draft" ||
        c.status === "paused"
      ) {
        continue;
      }
      unpaidInvoices.push({
        invoiceId: inv.id,
        clientId: inv.clientId,
        name: `${c.firstName} ${c.lastName || ""}`.trim(),
        title: inv.title,
        amountCents: inv.amountCents,
        currency: inv.currency,
      });
    }

    return {
      lowPackages,
      upcomingAppts,
      quietLeads,
      openTasks,
      unpaidInvoices,
    };
  } catch (e) {
    console.error("[listOrgCrmSignalsAction]", e);
    return {
      lowPackages: [],
      upcomingAppts: [],
      quietLeads: [],
      openTasks: [],
      unpaidInvoices: [],
    };
  }
}
