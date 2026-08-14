import { and, asc, desc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import {
  clientAppointments,
  clientCheckIns,
  clientInvoices,
  clientPackages,
  clientTasks,
  clients,
  organizations,
  trainingSessions,
} from "@/db/schema";
import type { SessionPayload } from "@/lib/session";
import { assertClientInOrg } from "@/lib/tenant";

function revalidateClient(clientId: string) {
  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  revalidatePath("/");
  revalidatePath("/calendar");
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

function ymdInTimeZone(date: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

export type CrmSignalClient = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
  updatedAt?: Date | string | null;
};

/** Debit the oldest burnable pack. Same-day unlinked floor+calendar pair once. */
export async function tryConsumePackageSession(
  clientId: string,
  session: SessionPayload,
  sessionId?: string,
  appointmentId?: string | null
) {
  await assertClientInOrg(clientId, session.organizationId);
  const db = await getDb();
  const now = new Date();
  const apptId = appointmentId?.trim() || null;

  type ConsumeResult =
    | {
        consumed: true;
        reason: "ok";
        packageId: string;
        packageName: string;
        remaining: number;
        status: string;
      }
    | {
        consumed: false;
        reason: "already_debited";
        packageId: string;
        packageName?: string;
        remaining?: number;
        status?: string;
      }
    | {
        consumed: false;
        reason: "empty";
        packageId?: string;
        packageName?: string;
        remaining: 0;
        status: "exhausted";
      }
    | { consumed: false; reason: "no_pack" }
    | {
        consumed: false;
        reason: "race";
        packageId: string;
        packageName: string;
      };

  const MAX_ATTEMPTS = 2;
  let lastRace: Extract<ConsumeResult, { reason: "race" }> | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let existingPackageId: string | null = null;
    let linkedAppointmentId: string | null = apptId;
    let linkedSessionId: string | null = sessionId?.trim() || null;
    let anchorAt: Date | null = null;

    if (linkedSessionId) {
      const [ts] = await db
        .select({
          packageId: trainingSessions.packageId,
          appointmentId: trainingSessions.appointmentId,
          clientId: trainingSessions.clientId,
          performedAt: trainingSessions.performedAt,
        })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.id, linkedSessionId),
            eq(trainingSessions.organizationId, session.organizationId)
          )
        )
        .limit(1);
      if (ts && (!ts.clientId || ts.clientId === clientId)) {
        if (ts.packageId) existingPackageId = ts.packageId;
        if (!linkedAppointmentId && ts.appointmentId) {
          linkedAppointmentId = ts.appointmentId;
        }
        if (ts.performedAt) anchorAt = new Date(ts.performedAt);
      }
    }

    if (linkedAppointmentId) {
      const [appt] = await db
        .select({
          packageId: clientAppointments.packageId,
          sessionId: clientAppointments.sessionId,
          clientId: clientAppointments.clientId,
          startsAt: clientAppointments.startsAt,
        })
        .from(clientAppointments)
        .where(eq(clientAppointments.id, linkedAppointmentId))
        .limit(1);
      if (appt && appt.clientId === clientId) {
        if (appt.packageId) existingPackageId = existingPackageId || appt.packageId;
        if (!linkedSessionId && appt.sessionId) linkedSessionId = appt.sessionId;
        if (appt.startsAt) anchorAt = new Date(appt.startsAt);
      }
    }

    if (!existingPackageId && linkedSessionId && linkedSessionId !== sessionId) {
      const [ts2] = await db
        .select({
          packageId: trainingSessions.packageId,
          performedAt: trainingSessions.performedAt,
        })
        .from(trainingSessions)
        .where(
          and(
            eq(trainingSessions.id, linkedSessionId),
            eq(trainingSessions.organizationId, session.organizationId)
          )
        )
        .limit(1);
      if (ts2?.packageId) existingPackageId = ts2.packageId;
      if (!anchorAt && ts2?.performedAt) anchorAt = new Date(ts2.performedAt);
    }

    // Same-day unique unlinked peer (Home start + Close booking without Start from booking)
    if (!existingPackageId && anchorAt) {
      const [org] = await db
        .select({ timezone: organizations.timezone })
        .from(organizations)
        .where(eq(organizations.id, session.organizationId))
        .limit(1);
      const tz = org?.timezone || "UTC";
      const ymd = ymdInTimeZone(anchorAt, tz);
      const windowStart = new Date(anchorAt.getTime() - 36 * 60 * 60 * 1000);
      const windowEnd = new Date(anchorAt.getTime() + 36 * 60 * 60 * 1000);

      if (linkedAppointmentId && !linkedSessionId) {
        const candidates = await db
          .select({
            id: trainingSessions.id,
            packageId: trainingSessions.packageId,
            appointmentId: trainingSessions.appointmentId,
            performedAt: trainingSessions.performedAt,
          })
          .from(trainingSessions)
          .where(
            and(
              eq(trainingSessions.clientId, clientId),
              eq(trainingSessions.organizationId, session.organizationId),
              or(
                eq(trainingSessions.status, "completed"),
                eq(trainingSessions.status, "in_progress")
              ),
              gte(trainingSessions.performedAt, windowStart),
              lte(trainingSessions.performedAt, windowEnd)
            )
          );
        const peers = candidates.filter(
          (r) =>
            ymdInTimeZone(new Date(r.performedAt), tz) === ymd &&
            (!r.appointmentId || r.appointmentId === linkedAppointmentId)
        );
        if (peers.length === 1) {
          linkedSessionId = peers[0].id;
          if (peers[0].packageId) existingPackageId = peers[0].packageId;
        }
      } else if (linkedSessionId && !linkedAppointmentId) {
        const candidates = await db
          .select({
            id: clientAppointments.id,
            packageId: clientAppointments.packageId,
            sessionId: clientAppointments.sessionId,
            startsAt: clientAppointments.startsAt,
          })
          .from(clientAppointments)
          .where(
            and(
              eq(clientAppointments.clientId, clientId),
              eq(clientAppointments.status, "completed"),
              gte(clientAppointments.startsAt, windowStart),
              lte(clientAppointments.startsAt, windowEnd)
            )
          );
        const peers = candidates.filter(
          (r) =>
            ymdInTimeZone(new Date(r.startsAt), tz) === ymd &&
            (!r.sessionId || r.sessionId === linkedSessionId)
        );
        if (peers.length === 1) {
          linkedAppointmentId = peers[0].id;
          if (peers[0].packageId) existingPackageId = peers[0].packageId;
        }
      }
    }

    async function persistSoftLink() {
      if (!linkedSessionId || !linkedAppointmentId) return;
      await db
        .update(trainingSessions)
        .set({ appointmentId: linkedAppointmentId, updatedAt: new Date() })
        .where(
          and(
            eq(trainingSessions.id, linkedSessionId),
            eq(trainingSessions.organizationId, session.organizationId),
            or(
              isNull(trainingSessions.appointmentId),
              eq(trainingSessions.appointmentId, linkedAppointmentId)
            )
          )
        );
      await db
        .update(clientAppointments)
        .set({ sessionId: linkedSessionId })
        .where(
          and(
            eq(clientAppointments.id, linkedAppointmentId),
            eq(clientAppointments.clientId, clientId),
            or(
              isNull(clientAppointments.sessionId),
              eq(clientAppointments.sessionId, linkedSessionId)
            )
          )
        );
    }

    async function stampDebit(packageId: string) {
      await persistSoftLink();
      if (linkedSessionId) {
        await db
          .update(trainingSessions)
          .set({ packageId, updatedAt: new Date() })
          .where(
            and(
              eq(trainingSessions.id, linkedSessionId),
              eq(trainingSessions.organizationId, session.organizationId)
            )
          );
      }
      if (linkedAppointmentId) {
        await db
          .update(clientAppointments)
          .set({ packageId })
          .where(
            and(
              eq(clientAppointments.id, linkedAppointmentId),
              eq(clientAppointments.clientId, clientId)
            )
          );
      }
    }

    if (existingPackageId) {
      await stampDebit(existingPackageId);
      const [pkgRow] = await db
        .select()
        .from(clientPackages)
        .where(eq(clientPackages.id, existingPackageId))
        .limit(1);
      const remaining = pkgRow
        ? Math.max(0, pkgRow.totalSessions - pkgRow.usedSessions)
        : undefined;
      return {
        consumed: false as const,
        reason: "already_debited" as const,
        packageId: existingPackageId,
        packageName: pkgRow?.name,
        remaining,
        status: pkgRow?.status,
      };
    }

    // Unique same-day pair with no stamp yet — persist link so the other path shares this debit
    await persistSoftLink();

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

    const exhaustedIds = activeRows
      .filter((row) => row.usedSessions >= row.totalSessions)
      .map((row) => row.id);

    if (exhaustedIds.length > 0) {
      await db
        .update(clientPackages)
        .set({ status: "exhausted" })
        .where(inArray(clientPackages.id, exhaustedIds));
    }

    const pkg = activeRows.find((p) => packIsBurnable(p, now));
    if (!pkg) {
      const hadActive = activeRows.some((p) => p.usedSessions >= p.totalSessions);
      if (hadActive) {
        const empty = activeRows.find((p) => p.usedSessions >= p.totalSessions);
        return {
          consumed: false as const,
          reason: "empty" as const,
          packageId: empty?.id,
          packageName: empty?.name,
          remaining: 0 as const,
          status: "exhausted" as const,
        };
      }
      return { consumed: false as const, reason: "no_pack" as const };
    }

    const expectedUsed = pkg.usedSessions;
    const used = expectedUsed + 1;
    const remaining = pkg.totalSessions - used;
    const status = remaining <= 0 ? "exhausted" : "active";

    const updatedRows = await db
      .update(clientPackages)
      .set({ usedSessions: used, status })
      .where(
        and(
          eq(clientPackages.id, pkg.id),
          eq(clientPackages.usedSessions, expectedUsed),
          eq(clientPackages.status, "active")
        )
      )
      .returning();

    const after = updatedRows[0];
    if (!after || after.usedSessions !== used) {
      lastRace = {
        consumed: false as const,
        reason: "race" as const,
        packageId: pkg.id,
        packageName: pkg.name,
      };
      continue;
    }

    await stampDebit(pkg.id);

    await db
      .update(clients)
      .set({ updatedAt: new Date() })
      .where(eq(clients.id, clientId));
    revalidateClient(clientId);
    return {
      consumed: true as const,
      reason: "ok" as const,
      packageId: pkg.id,
      packageName: pkg.name,
      remaining,
      status,
    };
  }

  return lastRace ?? { consumed: false as const, reason: "no_pack" as const };
}

/** Org-wide CRM signals for home needs-you (packages low, appts due, leads). */
export async function listOrgCrmSignals(
  session: SessionPayload,
  clientList?: CrmSignalClient[]
) {
  try {
    const db = await getDb();
    const orgId = session.organizationId;

    const orgClients =
      clientList ||
      (await db
        .select({
          id: clients.id,
          firstName: clients.firstName,
          lastName: clients.lastName,
          status: clients.status,
          updatedAt: clients.updatedAt,
        })
        .from(clients)
        .where(eq(clients.organizationId, orgId)));

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
    for (const [cid, agg] of packAgg) {
      const c = clientById.get(cid);
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
        clientId: cid,
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
    console.error("[listOrgCrmSignals]", e);
    return {
      lowPackages: [],
      upcomingAppts: [],
      quietLeads: [],
      openTasks: [],
      unpaidInvoices: [],
    };
  }
}
