"use server";

import { and, asc, desc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  clientAppointments,
  clientCheckIns,
  clientPackages,
  clientTasks,
  clients,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  CHECK_IN_CHANNELS,
  CLIENT_STAGES,
  type CheckInChannel,
  type ClientStage,
} from "@/lib/crm-constants";
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
  const session = await requireSession();
  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    throw new Error("Invalid calendar range");
  }
  // Guard absurd ranges (e.g. > 90 days)
  if (rangeEnd.getTime() - rangeStart.getTime() > 90 * 24 * 60 * 60 * 1000) {
    throw new Error("Calendar range too large");
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

/**
 * Consume one session from the oldest active pack (if any).
 * Used when a floor session or booked appointment is completed.
 * Safe no-op when no pack / already empty.
 */
export async function tryConsumePackageSessionAction(clientId: string) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const [pkg] = await db
    .select()
    .from(clientPackages)
    .where(
      and(
        eq(clientPackages.clientId, clientId),
        eq(clientPackages.status, "active")
      )
    )
    .orderBy(asc(clientPackages.purchasedAt))
    .limit(1);
  if (!pkg || pkg.usedSessions >= pkg.totalSessions) {
    return { consumed: false as const };
  }
  const used = pkg.usedSessions + 1;
  const remaining = pkg.totalSessions - used;
  const status = remaining <= 0 ? "exhausted" : "active";
  await db
    .update(clientPackages)
    .set({ usedSessions: used, status })
    .where(eq(clientPackages.id, pkg.id));
  await db
    .update(clients)
    .set({ updatedAt: new Date() })
    .where(eq(clients.id, clientId));
  revalidateClient(clientId);
  return {
    consumed: true as const,
    packageId: pkg.id,
    remaining,
    status,
  };
}

/**
 * Restore one used session on the most recently used pack (active or exhausted).
 * Used when deleting a completed floor session that may have burned a pack credit.
 */
export async function tryRestorePackageSessionAction(clientId: string) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
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

  const pkg = candidates.find((p) => p.usedSessions > 0);
  if (!pkg) return { restored: false as const };

  const used = Math.max(0, pkg.usedSessions - 1);
  const remaining = pkg.totalSessions - used;
  const status = remaining <= 0 ? "exhausted" : "active";

  await db
    .update(clientPackages)
    .set({ usedSessions: used, status })
    .where(eq(clientPackages.id, pkg.id));
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

export async function updateAppointmentStatusAction(
  appointmentId: string,
  clientId: string,
  status: "scheduled" | "completed" | "cancelled" | "no_show"
) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  await db
    .update(clientAppointments)
    .set({ status })
    .where(
      and(
        eq(clientAppointments.id, appointmentId),
        eq(clientAppointments.clientId, clientId)
      )
    );
  // Calendar complete does not burn pack sessions — floor session complete does.
  // Avoids double-count when both appointment and floor log are closed.
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

/** CRM snapshot for client detail header + panel */
export async function getClientCrmSnapshotAction(clientId: string) {
  const session = await requireSession();
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();

  const [packages, appointments, checkIns, nextAppt, tasks] = await Promise.all([
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
    nextAppointment: nextAppt[0] ?? null,
    activePackage,
    lastPackage,
  };
}

/** Org-wide CRM signals for home needs-you (packages low, appts due, leads). */
export async function listOrgCrmSignalsAction() {
  const session = await requireSession();
  const db = await getDb();
  const orgId = session.organizationId;

  const orgClients = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      status: clients.status,
    })
    .from(clients)
    .where(eq(clients.organizationId, orgId));

  if (!orgClients.length) {
    return {
      lowPackages: [] as Array<{
        clientId: string;
        name: string;
        remaining: number;
        packageName: string;
      }>,
      upcomingAppts: [] as Array<{
        clientId: string;
        name: string;
        startsAt: Date;
        title: string;
        appointmentId: string;
      }>,
      quietLeads: [] as Array<{ clientId: string; name: string }>,
      openTasks: [] as Array<{
        taskId: string;
        clientId: string;
        name: string;
        title: string;
        dueAt: Date | null;
      }>,
    };
  }

  const clientById = new Map(orgClients.map((c) => [c.id, c]));
  const clientIdList = orgClients.map((c) => c.id);
  const leadIds = orgClients
    .filter((c) => c.status === "lead")
    .map((c) => c.id);

  const nowDate = new Date();
  const horizon = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [pkgs, allAppts, checkIns] = await Promise.all([
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
      : Promise.resolve(
          [] as Array<{ clientId: string; createdAt: Date }>
        ),
  ]);

  /**
   * Low pack = total remaining across *active* packs ≤ 2.
   * Exhausted packs alone (no active renewal) → remaining 0.
   * Never flag renew when a healthy active pack exists.
   */
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
    // Healthy active pack(s) → no renew signal
    if (agg.activeRemaining > 2) continue;
    // Has active but low, or only exhausted leftovers
    const remaining =
      agg.activeRemaining > 0 || !agg.hasExhausted
        ? agg.activeRemaining
        : 0;
    if (remaining > 2) continue;
    // Skip clients with no pack history at all (shouldn't happen in map)
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
      // Align with packs: hide inactive, draft, and paused from floor CRM
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
      };
    })
    .filter((x): x is NonNullable<typeof x> => x != null);

  // Leads with no check-in in 7 days (or never)
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

  // Open follow-ups (due within 7 days, overdue, or no due date) — cap 15
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

  return { lowPackages, upcomingAppts, quietLeads, openTasks };
}
