/**
 * Merge client relationship events into one reverse-chrono feed.
 */

import { formatMoney } from "@/lib/money";

export type TimelineKind =
  | "session"
  | "appointment"
  | "task"
  | "checkin"
  | "note"
  | "invoice";

export type TimelineTone = "default" | "accent" | "warn" | "danger";

export type ClientTimelineItem = {
  id: string;
  kind: TimelineKind;
  /** Sort key (ms) */
  at: number;
  title: string;
  subtitle?: string;
  href?: string;
  badge?: string;
  tone: TimelineTone;
};

function ms(d: Date | string | null | undefined): number | null {
  if (d == null) return null;
  const t = new Date(d).getTime();
  return Number.isFinite(t) ? t : null;
}

function kindLabel(kind: TimelineKind): string {
  switch (kind) {
    case "session":
      return "Session";
    case "appointment":
      return "Booking";
    case "task":
      return "Task";
    case "checkin":
      return "Check-in";
    case "note":
      return "Note";
    case "invoice":
      return "Invoice";
  }
}

export type TimelineSessionInput = {
  id: string;
  title: string;
  status: string;
  performedAt?: Date | string | null;
  updatedAt?: Date | string | null;
  durationMin?: number | null;
  overallRpe?: string | null;
};

export type TimelineAppointmentInput = {
  id: string;
  title: string;
  status: string;
  startsAt: Date | string;
  sessionId?: string | null;
};

export type TimelineTaskInput = {
  id: string;
  title: string;
  status: string;
  dueAt?: Date | string | null;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type TimelineCheckInInput = {
  id: string;
  channel: string;
  body: string;
  createdAt: Date | string;
};

export type TimelineInvoiceInput = {
  id: string;
  title: string;
  amountCents: number;
  currency?: string;
  status: string;
  issuedAt?: Date | string | null;
  paidAt?: Date | string | null;
};

export type TimelineNoteInput = {
  id: string;
  title?: string | null;
  kind?: string | null;
  body: string;
  createdAt?: Date | string | null;
};

export function buildClientTimeline(input: {
  sessions?: TimelineSessionInput[];
  appointments?: TimelineAppointmentInput[];
  tasks?: TimelineTaskInput[];
  checkIns?: TimelineCheckInInput[];
  invoices?: TimelineInvoiceInput[];
  notes?: TimelineNoteInput[];
  /** Max items after sort (default 40) */
  limit?: number;
}): ClientTimelineItem[] {
  const items: ClientTimelineItem[] = [];
  const limit = Math.max(1, input.limit ?? 40);

  for (const s of input.sessions ?? []) {
    const at =
      ms(s.performedAt) ?? ms(s.updatedAt) ?? Date.now();
    const status = (s.status || "").toLowerCase();
    let tone: TimelineTone = "default";
    let badge = status.replaceAll("_", " ") || "session";
    if (status === "in_progress") {
      tone = "warn";
      badge = "in progress";
    } else if (status === "completed") {
      tone = "accent";
      badge = "completed";
    } else if (status === "cancelled") {
      tone = "danger";
    }
    const bits = [
      s.durationMin != null ? `${s.durationMin} min` : null,
      s.overallRpe ? `RPE ${s.overallRpe}` : null,
    ].filter(Boolean);
    items.push({
      id: `ses-${s.id}`,
      kind: "session",
      at,
      title: s.title || "Training session",
      subtitle: bits.length ? bits.join(" · ") : undefined,
      href: `/sessions/${s.id}`,
      badge,
      tone,
    });
  }

  const sessionIds = new Set((input.sessions ?? []).map((s) => s.id));

  for (const a of input.appointments ?? []) {
    // Avoid double row when booking already has a floor log in this feed
    if (a.sessionId && sessionIds.has(a.sessionId)) continue;

    const at = ms(a.startsAt) ?? Date.now();
    const status = (a.status || "").toLowerCase();
    let tone: TimelineTone = "default";
    let badge = status.replaceAll("_", " ") || "booking";
    if (status === "scheduled") {
      tone = "accent";
      badge = "scheduled";
    } else if (status === "completed") {
      tone = "default";
      badge = "done";
    } else if (status === "no_show" || status === "cancelled") {
      tone = "danger";
    }
    items.push({
      id: `apt-${a.id}`,
      kind: "appointment",
      at,
      title: a.title || "Training session",
      subtitle: a.sessionId ? "Linked to floor log" : undefined,
      href: a.sessionId
        ? `/sessions/${a.sessionId}`
        : `#crm-appointments`,
      badge,
      tone,
    });
  }

  for (const t of input.tasks ?? []) {
    const status = (t.status || "").toLowerCase();
    // Diary order: when created / completed — not future due (due stays in subtitle)
    const at =
      (status === "done" ? ms(t.completedAt) : null) ??
      ms(t.createdAt) ??
      ms(t.dueAt) ??
      Date.now();
    const open = status === "open";
    const overdue =
      open &&
      t.dueAt != null &&
      (ms(t.dueAt) ?? Infinity) < Date.now() - 60_000;
    items.push({
      id: `task-${t.id}`,
      kind: "task",
      at,
      title: t.title || "Follow-up",
      subtitle: t.dueAt
        ? `Due ${new Date(t.dueAt).toLocaleDateString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}`
        : open
          ? "No due date"
          : undefined,
      href: "#crm-tasks",
      badge: overdue ? "overdue" : open ? "open" : "done",
      tone: overdue ? "danger" : open ? "warn" : "default",
    });
  }

  for (const c of input.checkIns ?? []) {
    const at = ms(c.createdAt) ?? Date.now();
    const body = (c.body || "").trim();
    const preview =
      body.length > 80 ? `${body.slice(0, 80).trim()}…` : body || undefined;
    items.push({
      id: `ci-${c.id}`,
      kind: "checkin",
      at,
      title: `Check-in · ${(c.channel || "message").replaceAll("_", " ")}`,
      subtitle: preview,
      href: "#crm-checkin",
      badge: "touch",
      tone: "default",
    });
  }

  for (const inv of input.invoices ?? []) {
    const st = (inv.status || "unpaid").toLowerCase();
    const at =
      (st === "paid" ? ms(inv.paidAt) : null) ??
      ms(inv.issuedAt) ??
      Date.now();
    const money = formatMoney(inv.amountCents, inv.currency || "SGD");
    let tone: TimelineTone = "default";
    let badge = st;
    if (st === "unpaid") {
      tone = "warn";
      badge = "unpaid";
    } else if (st === "paid") {
      tone = "accent";
      badge = "paid";
    } else if (st === "void") {
      tone = "danger";
      badge = "void";
    }
    items.push({
      id: `inv-${inv.id}`,
      kind: "invoice",
      at,
      title: inv.title || "Invoice",
      subtitle: money,
      href: "#crm-invoices",
      badge,
      tone,
    });
  }

  for (const n of input.notes ?? []) {
    const k = (n.kind || "note").toLowerCase();
    if (k === "session") continue; // live under Sessions
    const at = ms(n.createdAt) ?? Date.now();
    const body = (n.body || "").trim();
    const preview =
      body.length > 80 ? `${body.slice(0, 80).trim()}…` : body || undefined;
    const badge =
      k === "ai_solution"
        ? "coach"
        : k === "recommendation"
          ? "rec"
          : k.replaceAll("_", " ");
    items.push({
      id: `note-${n.id}`,
      kind: "note",
      at,
      title: n.title?.trim() || kindLabel("note"),
      subtitle: preview,
      badge,
      tone: "default",
    });
  }

  items.sort((a, b) => b.at - a.at);
  return items.slice(0, limit);
}

export function timelineKindLabel(kind: TimelineKind): string {
  return kindLabel(kind);
}
