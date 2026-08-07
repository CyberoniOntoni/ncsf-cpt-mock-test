"use server";

import { and, desc, eq, or } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, programs, trainingSessions } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { listOrgCrmSignalsAction } from "@/app/actions/crm";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/utils";

export type HomeInProgressSession = {
  id: string;
  title: string;
  clientId: string | null;
  clientName: string | null;
  programId: string | null;
  updatedAt: Date | string | null;
  performedAt: Date | string | null;
};

export type HomeNeedsYouItem = {
  id: string;
  kind:
    | "in_progress"
    | "quiet_client"
    | "no_program"
    | "low_package"
    | "upcoming_appt"
    | "quiet_lead"
    | "open_task"
    | "unpaid_invoice";
  title: string;
  subtitle: string;
  href: string;
  /** Action-oriented trailing badge (e.g. "Renew pack", "Resume"). */
  actionLabel?: string;
  clientId?: string | null;
  urgency: "high" | "medium" | "low";
};

export type HomeAgendaItem = {
  appointmentId: string;
  clientId: string;
  clientName: string;
  title: string;
  startsAt: Date | string;
  href: string;
};

export type HomeClientProgram = {
  id: string;
  title: string;
  status: string;
  daysPerWeek: number;
  goal: string;
};

const QUIET_DAYS = 14;

/**
 * Floor home payload: in-progress sessions + needs-you heuristics + CRM signals.
 */
export async function getHomeDashboardAction() {
  const session = await requireSession();
  const db = await getDb();
  const orgId = session.organizationId;

  const inProgressRows = await db
    .select({
      session: trainingSessions,
      clientFirst: clients.firstName,
      clientLast: clients.lastName,
      clientStatus: clients.status,
    })
    .from(trainingSessions)
    .leftJoin(clients, eq(trainingSessions.clientId, clients.id))
    .where(
      and(
        eq(trainingSessions.organizationId, orgId),
        eq(trainingSessions.status, "in_progress")
      )
    )
    .orderBy(desc(trainingSessions.updatedAt))
    .limit(10);

  const clientList = await db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.organizationId, orgId),
        or(
          eq(clients.status, "active"),
          eq(clients.status, "lead"),
          eq(clients.status, "paused")
          // inactive excluded from floor needs-you
        )
      )
    )
    .orderBy(desc(clients.updatedAt))
    .limit(80);

  // Drop deactivated / draft clients from floor in-progress needs-you
  const inProgress: HomeInProgressSession[] = inProgressRows
    .filter((r) => {
      if (!r.session.clientId) return true;
      const st = (r.clientStatus || "").trim().toLowerCase();
      return st !== "inactive" && st !== "draft";
    })
    .map((r) => ({
      id: r.session.id,
      title: r.session.title,
      clientId: r.session.clientId,
      clientName:
        r.clientFirst != null
          ? fullName(r.clientFirst, r.clientLast || "")
          : null,
      programId: r.session.programId,
      updatedAt: r.session.updatedAt,
      performedAt: r.session.performedAt,
    }));

  const needsYou: HomeNeedsYouItem[] = [];

  // High: incomplete workouts still open
  for (const s of inProgress) {
    needsYou.push({
      id: `ip-${s.id}`,
      kind: "in_progress",
      title: s.title,
      subtitle: s.clientName
        ? `${s.clientName} · resume logging`
        : "Resume logging",
      href: `/sessions/${s.id}`,
      actionLabel: "Resume",
      clientId: s.clientId,
      urgency: "high",
    });
  }

  const allPrograms = await db
    .select()
    .from(programs)
    .where(eq(programs.organizationId, orgId))
    .orderBy(desc(programs.updatedAt))
    .limit(100);

  const programsByClient = new Map<string, typeof allPrograms>();
  for (const p of allPrograms) {
    if (!p.clientId) continue;
    const list = programsByClient.get(p.clientId) || [];
    list.push(p);
    programsByClient.set(p.clientId, list);
  }

  // Latest completed session per client (from recent completed)
  const recentCompleted = await db
    .select()
    .from(trainingSessions)
    .where(
      and(
        eq(trainingSessions.organizationId, orgId),
        eq(trainingSessions.status, "completed")
      )
    )
    .orderBy(desc(trainingSessions.performedAt))
    .limit(100);

  const lastSessionByClient = new Map<string, Date>();
  for (const s of recentCompleted) {
    if (!s.clientId || !s.performedAt) continue;
    if (lastSessionByClient.has(s.clientId)) continue;
    lastSessionByClient.set(s.clientId, new Date(s.performedAt));
  }

  const now = Date.now();
  const quietCutoff = QUIET_DAYS * 24 * 60 * 60 * 1000;

  for (const c of clientList) {
    if (c.status === "lead") continue;
    const progs = programsByClient.get(c.id) || [];
    const activeProgs = progs.filter(
      (p) => p.status === "active" || p.status === "draft"
    );
    const name = fullName(c.firstName, c.lastName);

    if (activeProgs.length === 0 && c.status === "active") {
      needsYou.push({
        id: `np-${c.id}`,
        kind: "no_program",
        title: name,
        subtitle: "Active client · no program yet",
        href: `/programs/new?client=${c.id}`,
        actionLabel: "Design",
        clientId: c.id,
        urgency: "medium",
      });
      continue;
    }

    const last = lastSessionByClient.get(c.id);
    if (!last) {
      if (activeProgs.length > 0 && c.status === "active") {
        // Has program — open home with client sticky to start a session
        needsYou.push({
          id: `qs-${c.id}`,
          kind: "quiet_client",
          title: name,
          subtitle: "Has program · no completed session yet",
          href: `/?client=${c.id}`,
          actionLabel: "Open on floor",
          clientId: c.id,
          urgency: "medium",
        });
      }
      continue;
    }

    // quiet_client only for active (not paused / inactive / lead)
    if (now - last.getTime() >= quietCutoff && c.status === "active") {
      const days = Math.floor((now - last.getTime()) / (24 * 60 * 60 * 1000));
      needsYou.push({
        id: `q-${c.id}`,
        kind: "quiet_client",
        title: name,
        subtitle: `No session in ${days} days`,
        href: `/?client=${c.id}`,
        actionLabel: "Open on floor",
        clientId: c.id,
        urgency: days >= 21 ? "high" : "medium",
      });
    }
  }

  // CRM signals: low packages, upcoming appts (48h), quiet leads, open tasks
  const signals = await listOrgCrmSignalsAction();
  const fourHours = 4 * 60 * 60 * 1000;

  // Today agenda = upcoming appointments (first-class Home surface)
  const agenda: HomeAgendaItem[] = signals.upcomingAppts.map((a) => ({
    appointmentId: a.appointmentId,
    clientId: a.clientId,
    clientName: a.name,
    title: a.title || "Session",
    startsAt: a.startsAt,
    href: `/clients/${a.clientId}#crm-appointments`,
  }));

  for (const p of signals.lowPackages) {
    const left = p.remaining;
    needsYou.push({
      id: `lp-${p.clientId}`,
      kind: "low_package",
      title: p.name,
      subtitle:
        left === 0
          ? `Pack empty · renew ${p.packageName}`
          : `${left} session${left === 1 ? "" : "s"} left · ${p.packageName}`,
      href: `/clients/${p.clientId}#crm-pack`,
      actionLabel: left === 0 ? "Renew pack" : "View pack",
      clientId: p.clientId,
      urgency: left === 0 ? "high" : "medium",
    });
  }

  // Keep high-urgency appts in Needs you only when within 4h (rest live on Agenda)
  for (const a of signals.upcomingAppts) {
    const starts = new Date(a.startsAt);
    const ms = starts.getTime() - now;
    if (ms > fourHours) continue;
    const when = starts.toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    needsYou.push({
      id: `ap-${a.appointmentId}`,
      kind: "upcoming_appt",
      title: a.name,
      subtitle: `${a.title || "Session"} · ${when}`,
      href: `/clients/${a.clientId}#crm-appointments`,
      actionLabel: "View booking",
      clientId: a.clientId,
      urgency: "high",
    });
  }

  for (const t of signals.openTasks) {
    const due = t.dueAt ? new Date(t.dueAt) : null;
    const overdue = due != null && due.getTime() < now;
    const dueLabel = due
      ? due.toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        })
      : "No due date";
    needsYou.push({
      id: `tk-${t.taskId}`,
      kind: "open_task",
      title: t.name,
      subtitle: `${t.title} · ${overdue ? "Overdue · " : ""}${dueLabel}`,
      href: `/clients/${t.clientId}#crm-tasks`,
      actionLabel: overdue ? "Do now" : "Open task",
      clientId: t.clientId,
      urgency: overdue ? "high" : "medium",
    });
  }

  for (const l of signals.quietLeads) {
    needsYou.push({
      id: `ql-${l.clientId}`,
      kind: "quiet_lead",
      title: l.name,
      subtitle: "Lead · no check-in this week",
      href: `/clients/${l.clientId}#crm-checkin`,
      actionLabel: "Check in",
      clientId: l.clientId,
      urgency: "low",
    });
  }

  for (const inv of signals.unpaidInvoices || []) {
    needsYou.push({
      id: `inv-${inv.invoiceId}`,
      kind: "unpaid_invoice",
      title: inv.name,
      subtitle: `${inv.title} · ${formatMoney(inv.amountCents, inv.currency)} unpaid`,
      href: `/clients/${inv.clientId}#crm-invoices`,
      actionLabel: "Mark paid",
      clientId: inv.clientId,
      urgency: "high",
    });
  }

  // One primary row per client + always keep ≤4h bookings (time-critical)
  const KIND_RANK: Record<HomeNeedsYouItem["kind"], number> = {
    in_progress: 0,
    unpaid_invoice: 1,
    open_task: 2,
    low_package: 3,
    upcoming_appt: 4,
    no_program: 5,
    quiet_client: 6,
    quiet_lead: 7,
  };
  const urgencyRank = { high: 0, medium: 1, low: 2 } as const;

  const orphans: HomeNeedsYouItem[] = [];
  const byClient = new Map<string, HomeNeedsYouItem>();
  const apptByClient = new Map<string, HomeNeedsYouItem>();
  for (const item of needsYou) {
    if (!item.clientId) {
      orphans.push(item);
      continue;
    }
    if (item.kind === "upcoming_appt") {
      // Keep at most one appt row per client (first wins = earliest from signals)
      if (!apptByClient.has(item.clientId)) {
        apptByClient.set(item.clientId, item);
      }
      continue;
    }
    const prev = byClient.get(item.clientId);
    if (!prev) {
      byClient.set(item.clientId, item);
      continue;
    }
    const betterUrgency =
      urgencyRank[item.urgency] < urgencyRank[prev.urgency];
    const sameUrgencyBetterKind =
      item.urgency === prev.urgency &&
      KIND_RANK[item.kind] < KIND_RANK[prev.kind];
    if (betterUrgency || sameUrgencyBetterKind) {
      byClient.set(item.clientId, item);
    }
  }

  const deduped = [
    ...orphans,
    ...byClient.values(),
    ...apptByClient.values(),
  ];
  deduped.sort((a, b) => {
    const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (u !== 0) return u;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });

  // Cap at 12 but reserve up to 2 quiet-lead slots so CRM pipeline stays visible
  const CAP = 12;
  const leadItems = deduped.filter((i) => i.kind === "quiet_lead");
  const rest = deduped.filter((i) => i.kind !== "quiet_lead");
  const reservedLeads = leadItems.slice(0, 2);
  const restCap = Math.max(0, CAP - reservedLeads.length);
  const needsYouCapped = [
    ...rest.slice(0, restCap),
    ...reservedLeads,
  ].sort((a, b) => {
    const u = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (u !== 0) return u;
    return KIND_RANK[a.kind] - KIND_RANK[b.kind];
  });

  return {
    inProgress,
    agenda,
    needsYou: needsYouCapped,
    clientCount: clientList.length,
    quietDays: QUIET_DAYS,
  };
}

/** Active/draft programs for home launch card. */
export async function getHomeClientProgramsAction(clientId: string) {
  const session = await requireSession();
  const db = await getDb();
  const rows = await db
    .select()
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, session.organizationId),
        eq(programs.clientId, clientId),
        or(eq(programs.status, "active"), eq(programs.status, "draft"))
      )
    )
    .orderBy(desc(programs.updatedAt))
    .limit(8);

  return rows.map(
    (p): HomeClientProgram => ({
      id: p.id,
      title: p.title,
      status: p.status,
      daysPerWeek: p.daysPerWeek,
      goal: p.goal,
    })
  );
}
