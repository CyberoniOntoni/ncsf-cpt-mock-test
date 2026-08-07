"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  adjustPackageUsedAction,
  cancelClientPackageAction,
  createClientAppointmentAction,
  createClientCheckInAction,
  createClientInvoiceAction,
  createClientPackageAction,
  createClientTaskAction,
  deleteClientTaskAction,
  setClientInvoicePaidAction,
  setClientTaskDoneAction,
  updateAppointmentStatusAction,
  updateClientStageAction,
  voidClientInvoiceAction,
} from "@/app/actions/crm";
import { clientStageLabel } from "@/lib/client-next-action";
import {
  formatMoney,
  parseMoneyToCents,
  sanitizeMoneyInput,
} from "@/lib/money";
import {
  CHECK_IN_CHANNELS,
  type CheckInChannel,
  type ClientStage,
} from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import { CheckInTemplates } from "./check-in-templates";
import { StartFromAppointmentButton } from "./start-from-appointment-button";
import { Badge, Button, Card, Input, SectionLabel, Textarea } from "./ui";

export type CrmPackageRow = {
  id: string;
  name: string;
  totalSessions: number;
  usedSessions: number;
  status: string;
  purchasedAt?: Date | string | null;
  expiresAt?: Date | string | null;
  notes?: string | null;
};

export type CrmAppointmentRow = {
  id: string;
  title: string;
  startsAt: Date | string;
  endsAt?: Date | string | null;
  status: string;
  notes?: string | null;
  location?: string | null;
  sessionId?: string | null;
};

export type CrmCheckInRow = {
  id: string;
  channel: string;
  body: string;
  createdAt: Date | string;
  authorUserId?: string | null;
};

export type CrmTaskRow = {
  id: string;
  title: string;
  dueAt?: Date | string | null;
  status: string;
  createdAt?: Date | string | null;
  completedAt?: Date | string | null;
};

export type CrmInvoiceRow = {
  id: string;
  title: string;
  amountCents: number;
  currency: string;
  status: string;
  notes?: string | null;
  issuedAt?: Date | string | null;
  paidAt?: Date | string | null;
};

export type CrmActivePackage = {
  id: string;
  name: string;
  remaining: number;
  total: number;
  used: number;
} | null;

export type CrmSnapshot = {
  packages: CrmPackageRow[];
  appointments: CrmAppointmentRow[];
  checkIns: CrmCheckInRow[];
  tasks?: CrmTaskRow[];
  invoices?: CrmInvoiceRow[];
  nextAppointment: CrmAppointmentRow | null;
  activePackage: CrmActivePackage;
  /** Prefill for one-tap renew when no active pack */
  lastPackage?: { name: string; totalSessions: number } | null;
};

const INV_STATUS_LABEL: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  void: "Void",
};

/** Stage chips only — inactive uses header Deactivate (confirm + roster copy). */
const PIPELINE_STAGES: ClientStage[] = ["lead", "active", "paused"];

const CHANNEL_LABEL: Record<string, string> = {
  message: "Message",
  call: "Call",
  in_person: "In person",
  other: "Other",
};

const APPT_STATUS_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  completed: "Done",
  cancelled: "Cancelled",
  no_show: "No-show",
};

function fmtWhen(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function fmtDateShort(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

function fmtRelative(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    const t = new Date(d).getTime();
    if (!Number.isFinite(t)) return "";
    const mins = Math.round((Date.now() - t) / 60_000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 14) return `${days}d ago`;
    return fmtWhen(d);
  } catch {
    return "";
  }
}

/** Next whole hour, for friendlier default booking */
function defaultAppointmentLocal() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Accept calendar deep-link ?bookAt=YYYY-MM-DDTHH:mm (datetime-local shape). */
function parseBookAtParam(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  // YYYY-MM-DDTHH:mm or with seconds
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return null;
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function statusTone(
  status: string
): "default" | "green" | "amber" | "red" {
  if (status === "scheduled" || status === "active") return "green";
  if (status === "completed") return "default";
  if (status === "cancelled" || status === "no_show" || status === "exhausted")
    return "red";
  return "amber";
}

function sortAppointments(rows: CrmAppointmentRow[]) {
  const now = Date.now();
  const rank = (a: CrmAppointmentRow) => {
    const t = new Date(a.startsAt).getTime();
    if (a.status === "scheduled" && t >= now - 60_000) return 0;
    if (a.status === "scheduled") return 1;
    if (a.status === "completed") return 2;
    return 3;
  };
  return [...rows].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ta = new Date(a.startsAt).getTime();
    const tb = new Date(b.startsAt).getTime();
    // Upcoming: soonest first; past: newest first
    if (ra === 0) return ta - tb;
    return tb - ta;
  });
}

export function ClientCrmPanel({
  clientId,
  clientName,
  initialStatus,
  snapshot,
}: {
  clientId: string;
  /** Accessible labels; deactivate/reactivate live on page header/banner */
  clientName?: string;
  initialStatus: string;
  snapshot: CrmSnapshot;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState(
    (initialStatus || "lead").trim().toLowerCase()
  );

  // Progressive disclosure (HIG): forms/pipelines collapsed by default
  const [showStagePipeline, setShowStagePipeline] = useState(
    () => (initialStatus || "lead").trim().toLowerCase() === "draft"
  );
  const [showAddPack, setShowAddPack] = useState(false);
  const [showBookForm, setShowBookForm] = useState(false);
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);

  // Package form
  const [pkgName, setPkgName] = useState("");
  const [pkgTotal, setPkgTotal] = useState("10");
  const [pkgUsed, setPkgUsed] = useState("0");

  // Appointment form
  const [apptStart, setApptStart] = useState(defaultAppointmentLocal);
  const [apptTitle, setApptTitle] = useState("");
  const [apptDuration, setApptDuration] = useState("60");

  // Check-in form
  const [channel, setChannel] = useState<CheckInChannel>("message");
  const [checkInBody, setCheckInBody] = useState("");

  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  // Invoice form (manual mark paid — no cards/tax)
  const [invTitle, setInvTitle] = useState("Session pack");
  const [invAmount, setInvAmount] = useState("");
  const [invNotes, setInvNotes] = useState("");

  useEffect(() => {
    const next = (initialStatus || "lead").trim().toLowerCase();
    setStage(next);
    // Draft stays open so trainer can move out of intake; other stages collapse
    if (next === "draft") {
      setShowStagePipeline(true);
    }
  }, [initialStatus]);

  const activePackage = snapshot.activePackage;
  const nextAppointment = snapshot.nextAppointment;
  const lowRemaining =
    !!activePackage && activePackage.remaining <= 2;

  // Deep links: #crm-pack | #crm-appointments | #crm-checkin | #crm-tasks | #crm-invoices
  useEffect(() => {
    function scrollToId(id: string, focusSelector?: string) {
      const run = () => {
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
        if (focusSelector) {
          const field = el?.querySelector<HTMLElement>(focusSelector);
          field?.focus({ preventScroll: true });
        }
      };
      // Double-rAF + short delay so sticky header / disclosure layout settle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          run();
          window.setTimeout(run, 120);
        });
      });
    }

    function applyHash() {
      if (typeof window === "undefined") return;
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "crm-pack") {
        // No active pack: prefill renew from last pack when available
        if (!snapshot.activePackage) {
          const last = snapshot.lastPackage;
          if (last) {
            setPkgName(last.name || "Session pack");
            setPkgTotal(String(last.totalSessions || 10));
            setPkgUsed("0");
          }
          setShowAddPack(true);
          scrollToId("crm-pack", "input, textarea");
        } else {
          scrollToId("crm-pack");
        }
      } else if (hash === "crm-appointments") {
        const bookAt = parseBookAtParam(
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("bookAt")
            : null
        );
        if (bookAt) {
          setApptStart(bookAt);
          setShowBookForm(true);
          scrollToId(
            "crm-appointments",
            'input[type="datetime-local"], input, textarea'
          );
          // Drop bookAt from URL so refresh doesn't re-open a stale prefill
          try {
            const url = new URL(window.location.href);
            if (url.searchParams.has("bookAt")) {
              url.searchParams.delete("bookAt");
              const qs = url.searchParams.toString();
              window.history.replaceState(
                {},
                "",
                `${url.pathname}${qs ? `?${qs}` : ""}${url.hash}`
              );
            }
          } catch {
            // ignore
          }
        } else if (!snapshot.nextAppointment) {
          // No open scheduled booking (including past-due) — offer book form
          setShowBookForm(true);
          scrollToId(
            "crm-appointments",
            'input[type="datetime-local"], input, textarea'
          );
        } else {
          // Has scheduled work (maybe past-due) — show list, don't force book form
          setShowBookForm(false);
          scrollToId("crm-appointments");
        }
      } else if (hash === "crm-checkin") {
        setShowCheckInForm(true);
        scrollToId("crm-checkin", "textarea");
      } else if (hash === "crm-tasks") {
        // Always scroll; open add form only when no open tasks remain
        const openCount = (snapshot.tasks || []).filter(
          (t) => t.status === "open"
        ).length;
        if (openCount === 0) {
          setShowTaskForm(true);
          scrollToId("crm-tasks", "input, textarea");
        } else {
          setShowTaskForm(false);
          scrollToId("crm-tasks");
        }
      } else if (hash === "crm-invoices") {
        const unpaid = (snapshot.invoices || []).filter(
          (i) => i.status === "unpaid"
        ).length;
        if (unpaid === 0) {
          // Prefill title from last pack when empty slate; focus amount
          const last = snapshot.lastPackage;
          if (last?.name) setInvTitle(last.name);
          setShowInvoiceForm(true);
          scrollToId("crm-invoices", "#inv-amount, input");
        } else {
          // Land on unpaid list (Mark paid is one tap)
          setShowInvoiceForm(false);
          scrollToId("crm-invoices");
        }
      }
    }

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [
    snapshot.activePackage,
    snapshot.nextAppointment,
    snapshot.lastPackage,
    snapshot.tasks,
    snapshot.invoices,
    clientId,
  ]);

  const stageButtons = useMemo(() => {
    const list = [...PIPELINE_STAGES];
    if (stage === "draft" && !list.includes("draft")) {
      list.unshift("draft");
    }
    // Show inactive chip only when already inactive (reactivate via pipeline or header)
    if (stage === "inactive" && !list.includes("inactive")) {
      list.push("inactive");
    }
    return list;
  }, [stage]);

  const appointmentList = useMemo(
    () => sortAppointments(snapshot.appointments).slice(0, 8),
    [snapshot.appointments]
  );
  const checkInList = snapshot.checkIns.slice(0, 8);
  const taskList = (snapshot.tasks || []).slice(0, 12);
  const openTasks = taskList.filter((t) => t.status === "open");
  // Unpaid first, then paid, then void; newest issued within group
  const invoiceList = useMemo(() => {
    const rank = (s: string) =>
      s === "unpaid" ? 0 : s === "paid" ? 1 : 2;
    return [...(snapshot.invoices || [])]
      .sort((a, b) => {
        const ra = rank((a.status || "").toLowerCase());
        const rb = rank((b.status || "").toLowerCase());
        if (ra !== rb) return ra - rb;
        const ta = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
        const tb = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 12);
  }, [snapshot.invoices]);
  const unpaidInvoices = invoiceList.filter((i) => i.status === "unpaid");

  const packPct = activePackage
    ? Math.min(
        100,
        Math.round((activePackage.used / Math.max(1, activePackage.total)) * 100)
      )
    : 0;

  const hadExhaustedPack = snapshot.packages.some(
    (p) => p.status === "exhausted"
  );
  // Align wording with client header package chip
  const summaryPack = activePackage
    ? activePackage.remaining === 0
      ? "Package empty"
      : `${activePackage.remaining} left`
    : hadExhaustedPack
      ? "Renew pack"
      : "No package";
  const summaryBooking = nextAppointment
    ? fmtDateShort(nextAppointment.startsAt) || fmtWhen(nextAppointment.startsAt)
    : "No booking";
  // Compact money on summary; sum when all unpaid share a currency
  const summaryUnpaid = (() => {
    if (unpaidInvoices.length === 0) return null;
    if (unpaidInvoices.length === 1) {
      return formatMoney(
        unpaidInvoices[0].amountCents,
        unpaidInvoices[0].currency,
        { compact: true }
      );
    }
    const cur = unpaidInvoices[0].currency;
    const same = unpaidInvoices.every((i) => i.currency === cur);
    if (same) {
      const total = unpaidInvoices.reduce((s, i) => s + i.amountCents, 0);
      return `${unpaidInvoices.length} unpaid · ${formatMoney(total, cur, { compact: true })}`;
    }
    return `${unpaidInvoices.length} unpaid`;
  })();

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
        requestAnimationFrame(() => {
          document
            .getElementById("crm-error")
            ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      }
    });
  }

  // Client-side validation: surface banner and scroll so forms far down still show it
  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => {
      document
        .getElementById("crm-error")
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function onStageChange(next: string) {
    if (next === stage) return;
    // Inactive is not on chips; if it appears (e.g. draft list edge), require confirm
    if (next === "inactive") {
      const who = clientName?.trim() || "this client";
      if (
        !window.confirm(
          `Deactivate ${who}?\n\nThey leave the active roster and floor picker. History, packages, and sessions stay.`
        )
      ) {
        return;
      }
    }
    const prev = stage;
    setStage(next);
    // Collapse pipeline after choosing a real pipeline stage
    if (next !== "draft") {
      setShowStagePipeline(false);
    }
    run(async () => {
      try {
        await updateClientStageAction(clientId, next);
      } catch (e) {
        setStage(prev);
        throw e;
      }
    });
  }

  function startRenewPack() {
    const last = snapshot.lastPackage;
    setPkgName(last?.name || "Session pack");
    setPkgTotal(String(last?.totalSessions || 10));
    setPkgUsed("0");
    setShowAddPack(true);
  }

  function onCreatePackage(e: FormEvent) {
    e.preventDefault();
    const total = Number(pkgTotal);
    if (!Number.isFinite(total) || total < 1) {
      fail("Total sessions must be at least 1");
      return;
    }
    const used = Math.max(0, Math.floor(Number(pkgUsed) || 0));
    if (used > total) {
      fail("Used cannot exceed total sessions");
      return;
    }
    run(async () => {
      await createClientPackageAction({
        clientId,
        name: pkgName.trim() || undefined,
        totalSessions: Math.floor(total),
        usedSessions: used,
      });
      setPkgName("");
      setPkgTotal("10");
      setPkgUsed("0");
      setShowAddPack(false);
    });
  }

  function onAdjustUsed(delta: number) {
    if (!activePackage) return;
    run(async () => {
      await adjustPackageUsedAction(activePackage.id, clientId, delta);
    });
  }

  function onCancelPackage() {
    if (!activePackage) return;
    if (
      !window.confirm(
        `Cancel “${activePackage.name}”? Remaining sessions will no longer count.`
      )
    ) {
      return;
    }
    run(async () => {
      await cancelClientPackageAction(activePackage.id, clientId);
      setShowAddPack(false);
    });
  }

  function onCreateAppointment(e: FormEvent) {
    e.preventDefault();
    if (!apptStart) {
      fail("Start time is required");
      return;
    }
    const startDate = new Date(apptStart);
    if (Number.isNaN(startDate.getTime())) {
      fail("Invalid start time");
      return;
    }
    const rawDur = Math.floor(Number(apptDuration) || 60);
    if (rawDur < 15) {
      fail("Duration must be at least 15 minutes");
      return;
    }
    const duration = Math.min(240, rawDur);
    run(async () => {
      await createClientAppointmentAction({
        clientId,
        startsAt: startDate.toISOString(),
        title: apptTitle.trim() || undefined,
        durationMin: duration,
      });
      setApptTitle("");
      setApptDuration("60");
      setApptStart(defaultAppointmentLocal());
      setShowBookForm(false);
    });
  }

  function onApptStatus(
    appointmentId: string,
    status: "completed" | "cancelled" | "no_show",
    title: string
  ) {
    if (status === "cancelled") {
      if (!window.confirm(`Cancel “${title}”?`)) return;
    }
    if (status === "no_show") {
      if (!window.confirm(`Mark “${title}” as no-show?`)) return;
    }
    run(async () => {
      await updateAppointmentStatusAction(appointmentId, clientId, status);
    });
  }

  function onCreateCheckIn(e: FormEvent) {
    e.preventDefault();
    if (!checkInBody.trim()) {
      fail("Check-in note is required");
      return;
    }
    run(async () => {
      await createClientCheckInAction({
        clientId,
        body: checkInBody,
        channel,
      });
      setCheckInBody("");
      setChannel("message");
      setShowCheckInForm(false);
    });
  }

  function onCreateInvoice(e: FormEvent) {
    e.preventDefault();
    try {
      parseMoneyToCents(invAmount);
    } catch (err) {
      fail(err instanceof Error ? err.message : "Invalid amount");
      return;
    }
    run(async () => {
      await createClientInvoiceAction({
        clientId,
        title: invTitle.trim() || "Session pack",
        amount: invAmount.trim(),
        notes: invNotes.trim() || undefined,
        packageId: activePackage?.id ?? null,
      });
      setInvTitle("Session pack");
      setInvAmount("");
      setInvNotes("");
      setShowInvoiceForm(false);
    });
  }

  function openInvoiceForm() {
    const last = snapshot.lastPackage;
    if (last?.name) setInvTitle(last.name);
    setShowInvoiceForm(true);
  }

  const now = Date.now();
  const who = clientName?.trim();
  const summaryAria = who ? `CRM summary for ${who}` : "Client CRM summary";
  const stageAria = who ? `Stage for ${who}` : "Client stage";

  return (
    <Card padding="sm" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <SectionLabel as="h2" className="mb-0">
            Packages & schedule
          </SectionLabel>
          <p className="mt-0.5 text-[11px] text-zinc-600">
            Packs · bookings · invoices · check-ins
          </p>
        </div>
        {pending && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Saving…
          </span>
        )}
      </div>

      {error && (
        <p
          id="crm-error"
          role="alert"
          aria-live="assertive"
          className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200"
        >
          {error}
          <button
            type="button"
            className="ml-2 min-h-11 font-medium text-red-100 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </p>
      )}

      {/* Summary strip — omit stage while pipeline is open (chips are source of truth) */}
      <div
        className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-zinc-800/80 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-500"
        aria-label={summaryAria}
      >
        {!showStagePipeline && (
          <>
            <span className="font-medium text-zinc-300">
              {clientStageLabel(stage)}
            </span>
            <span className="text-zinc-700" aria-hidden>
              ·
            </span>
          </>
        )}
        <a
          href="#crm-pack"
          className={cn(
            "tabular-nums transition hover:underline",
            activePackage
              ? lowRemaining
                ? "font-medium text-amber-300/95"
                : "text-zinc-400 hover:text-zinc-200"
              : hadExhaustedPack
                ? "font-medium text-amber-300/95"
                : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          {summaryPack}
        </a>
        <span className="text-zinc-700" aria-hidden>
          ·
        </span>
        <a
          href="#crm-appointments"
          className={cn(
            "tabular-nums transition hover:underline",
            nextAppointment
              ? "text-zinc-400 hover:text-zinc-200"
              : "text-zinc-600 hover:text-zinc-400"
          )}
        >
          {summaryBooking}
        </a>
        {summaryUnpaid && (
          <>
            <span className="text-zinc-700" aria-hidden>
              ·
            </span>
            <a
              href="#crm-invoices"
              className="font-medium tabular-nums text-amber-300/95 transition hover:underline"
            >
              {summaryUnpaid}
            </a>
          </>
        )}
      </div>

      {/* Stage pipeline — collapsed when set (except draft). Deactivate/reactivate live in page header. */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Stage
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline disabled:opacity-50"
            disabled={pending}
            aria-expanded={showStagePipeline}
            onClick={() => setShowStagePipeline((v) => !v)}
          >
            {showStagePipeline ? "Done" : "Change stage"}
          </button>
        </div>
        {showStagePipeline && (
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label={stageAria}
          >
            {stageButtons.map((s) => {
              const active = stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={pending}
                  onClick={() => onStageChange(s)}
                  aria-pressed={active}
                  className={cn(
                    "min-h-11 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200",
                    pending && "opacity-60"
                  )}
                >
                  {clientStageLabel(s)}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Package */}
      <section
        id="crm-pack"
        className="scroll-mt-client space-y-2 border-t border-zinc-800/80 pt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Package
          </p>
          {activePackage && (
            <button
              type="button"
              className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline"
              aria-expanded={showAddPack}
              onClick={() => setShowAddPack((v) => !v)}
            >
              {showAddPack ? "Done" : "Add package"}
            </button>
          )}
        </div>

        {activePackage ? (
          <div
            className={cn(
              "rounded-lg border px-3 py-2.5",
              lowRemaining
                ? "border-amber-900/45 bg-amber-950/20"
                : "border-zinc-800 bg-zinc-950/40"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-sm font-medium text-zinc-100">
                    {activePackage.name}
                  </p>
                  {lowRemaining && (
                    <Badge tone="amber">
                      {activePackage.remaining === 0
                        ? "Empty"
                        : "Low"}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
                  <span
                    className={cn(
                      "font-semibold",
                      lowRemaining ? "text-amber-300" : "text-zinc-200"
                    )}
                  >
                    {activePackage.remaining}
                  </span>
                  {" of "}
                  {activePackage.total} remaining
                  <span className="text-zinc-600">
                    {" "}
                    · {activePackage.used} used
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending || activePackage.used <= 0}
                  onClick={() => onAdjustUsed(-1)}
                  aria-label="Undo one used session"
                  className="min-h-11"
                >
                  −1 used
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={
                    pending || activePackage.used >= activePackage.total
                  }
                  onClick={() => onAdjustUsed(1)}
                  aria-label="Mark one session used"
                  className="min-h-11"
                >
                  +1 used
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={onCancelPackage}
                  className="min-h-11"
                >
                  Cancel pack
                </Button>
              </div>
            </div>
            <div
              className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-zinc-800"
              role="progressbar"
              aria-valuenow={activePackage.used}
              aria-valuemin={0}
              aria-valuemax={activePackage.total}
              aria-label="Package usage"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  lowRemaining ? "bg-amber-500/80" : "bg-zinc-500/90"
                )}
                style={{ width: `${packPct}%` }}
              />
            </div>
          </div>
        ) : (
          !showAddPack && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">
                {hadExhaustedPack
                  ? "No active pack — renew to keep tracking sessions."
                  : "No active pack — add one to track remaining sessions."}
              </p>
              <div className="flex flex-wrap gap-2">
                {hadExhaustedPack || snapshot.lastPackage ? (
                  <Button
                    type="button"
                    size="sm"
                    disabled={pending}
                    onClick={startRenewPack}
                    className="min-h-11"
                  >
                    Renew pack
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={pending}
                  aria-expanded={showAddPack}
                  onClick={() => setShowAddPack(true)}
                  className="min-h-11"
                >
                  Add package
                </Button>
              </div>
            </div>
          )
        )}

        {showAddPack && (
          <form
            onSubmit={onCreatePackage}
            className="grid gap-2 sm:grid-cols-[1fr_5.5rem_5rem_auto]"
          >
            <Input
              value={pkgName}
              onChange={(e) => setPkgName(e.target.value)}
              placeholder="Pack name (e.g. 10-pack)"
              disabled={pending}
              className="min-h-11 py-1.5 text-xs"
              aria-label="Package name"
            />
            <Input
              type="number"
              min={1}
              step={1}
              inputMode="numeric"
              value={pkgTotal}
              onChange={(e) => setPkgTotal(e.target.value)}
              placeholder="Total"
              disabled={pending}
              required
              className="min-h-11 py-1.5 text-xs tabular-nums"
              aria-label="Total sessions"
            />
            <Input
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={pkgUsed}
              onChange={(e) => setPkgUsed(e.target.value)}
              placeholder="Used"
              disabled={pending}
              className="min-h-11 py-1.5 text-xs tabular-nums"
              aria-label="Already used sessions"
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={pending}
                className="min-h-11"
              >
                Add pack
              </Button>
              {!activePackage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  className="min-h-11"
                  onClick={() => setShowAddPack(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Appointments */}
      <section
        id="crm-appointments"
        className="scroll-mt-client space-y-2 border-t border-zinc-800/80 pt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Appointments
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline"
            aria-expanded={showBookForm}
            onClick={() => setShowBookForm((v) => !v)}
          >
            {showBookForm ? "Done" : "Book"}
          </button>
        </div>

        {nextAppointment ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Next up
              </p>
              <Badge tone="green">
                {APPT_STATUS_LABEL[nextAppointment.status] ||
                  nextAppointment.status.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm font-medium text-zinc-100">
              {nextAppointment.title}
            </p>
            <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
              {fmtWhen(nextAppointment.startsAt)}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nextAppointment.status === "scheduled" && (
                <StartFromAppointmentButton
                  appointmentId={nextAppointment.id}
                  clientId={clientId}
                  clientName={clientName}
                  hasLinkedSession={!!nextAppointment.sessionId}
                />
              )}
              {nextAppointment.sessionId && (
                <Link
                  href={`/sessions/${nextAppointment.sessionId}`}
                  className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                >
                  Open log
                </Link>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                className="min-h-11"
                title="Closes the booking only — does not burn a pack session"
                onClick={() =>
                  onApptStatus(
                    nextAppointment.id,
                    "completed",
                    nextAppointment.title
                  )
                }
              >
                Close booking
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                className="min-h-11"
                onClick={() =>
                  onApptStatus(
                    nextAppointment.id,
                    "no_show",
                    nextAppointment.title
                  )
                }
              >
                No-show
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                className="min-h-11"
                onClick={() =>
                  onApptStatus(
                    nextAppointment.id,
                    "cancelled",
                    nextAppointment.title
                  )
                }
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">
            {showBookForm
              ? "Pick a time below."
              : "No upcoming booking."}
          </p>
        )}

        {showBookForm && (
          <form
            onSubmit={onCreateAppointment}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_5rem_auto]"
          >
            <Input
              type="datetime-local"
              value={apptStart}
              onChange={(e) => setApptStart(e.target.value)}
              disabled={pending}
              required
              className="min-h-11 py-1.5 text-xs tabular-nums"
              aria-label="Appointment start"
            />
            <Input
              value={apptTitle}
              onChange={(e) => setApptTitle(e.target.value)}
              placeholder="Title (optional)"
              disabled={pending}
              className="min-h-11 py-1.5 text-xs"
              aria-label="Appointment title"
            />
            <Input
              type="number"
              min={15}
              step={5}
              inputMode="numeric"
              value={apptDuration}
              onChange={(e) => setApptDuration(e.target.value)}
              placeholder="Min"
              disabled={pending}
              className="min-h-11 py-1.5 text-xs tabular-nums"
              aria-label="Duration minutes"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending}
              className="min-h-11"
            >
              Book
            </Button>
          </form>
        )}

        {appointmentList.length > 0 && (
          <ul className="space-y-1.5" aria-label="Appointment history">
            {appointmentList.map((a) => {
              const startMs = new Date(a.startsAt).getTime();
              const overdue =
                a.status === "scheduled" &&
                Number.isFinite(startMs) &&
                startMs < now - 60_000;
              // Next-up card already owns actions — avoid duplicate CTAs
              const isNext =
                nextAppointment != null && a.id === nextAppointment.id;
              return (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-zinc-200">
                        {a.title}
                      </span>
                      <Badge
                        tone={
                          overdue ? "amber" : statusTone(a.status)
                        }
                      >
                        {overdue
                          ? "Past due"
                          : APPT_STATUS_LABEL[a.status] ||
                            a.status.replaceAll("_", " ")}
                      </Badge>
                      {isNext && (
                        <Badge tone="sky">Next</Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                      {fmtWhen(a.startsAt)}
                    </p>
                  </div>
                  {a.status === "scheduled" && !isNext && (
                    <div className="flex flex-wrap gap-1">
                      <StartFromAppointmentButton
                        appointmentId={a.id}
                        clientId={clientId}
                        clientName={clientName}
                        hasLinkedSession={!!a.sessionId}
                        className="min-h-11"
                      />
                      {a.sessionId && (
                        <Link
                          href={`/sessions/${a.sessionId}`}
                          className="inline-flex min-h-11 items-center rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                        >
                          Open log
                        </Link>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        className="min-h-11"
                        title="Closes the booking only — does not burn a pack session"
                        onClick={() =>
                          onApptStatus(a.id, "completed", a.title)
                        }
                      >
                        Close booking
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="min-h-11"
                        onClick={() =>
                          onApptStatus(a.id, "no_show", a.title)
                        }
                      >
                        No-show
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        className="min-h-11"
                        onClick={() =>
                          onApptStatus(a.id, "cancelled", a.title)
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                  {a.status !== "scheduled" && a.sessionId && (
                    <Link
                      href={`/sessions/${a.sessionId}`}
                      className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400 hover:underline"
                    >
                      Open log →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Invoices — manual mark paid (no cards / tax) */}
      <section
        id="crm-invoices"
        className="scroll-mt-client space-y-2 border-t border-zinc-800/80 pt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Invoices
            {unpaidInvoices.length > 0 && (
              <span className="ml-1.5 font-normal normal-case tabular-nums text-amber-400/90">
                {unpaidInvoices.length === 1
                  ? formatMoney(
                      unpaidInvoices[0].amountCents,
                      unpaidInvoices[0].currency,
                      { compact: true }
                    )
                  : `${unpaidInvoices.length} unpaid`}
              </span>
            )}
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline"
            aria-expanded={showInvoiceForm}
            onClick={() => {
              if (showInvoiceForm) setShowInvoiceForm(false);
              else openInvoiceForm();
            }}
          >
            {showInvoiceForm ? "Done" : "New invoice"}
          </button>
        </div>

        {invoiceList.length === 0 && !showInvoiceForm ? (
          <div className="space-y-2">
            <p className="text-xs text-zinc-600">
              Record what they owe — mark paid when cash lands. No cards or tax.
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              className="min-h-11"
              onClick={openInvoiceForm}
            >
              New invoice
            </Button>
          </div>
        ) : (
          invoiceList.length > 0 && (
            <ul className="space-y-1.5" aria-label="Invoices">
              {invoiceList.map((inv) => {
                const st = (inv.status || "unpaid").toLowerCase();
                const unpaid = st === "unpaid";
                const paid = st === "paid";
                const voided = st === "void";
                return (
                  <li
                    key={inv.id}
                    className={cn(
                      "flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2",
                      unpaid
                        ? "border-amber-900/40 bg-amber-950/20"
                        : voided
                          ? "border-zinc-800/50 bg-zinc-950/20 opacity-60"
                          : "border-zinc-800 bg-zinc-950/40"
                    )}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            "text-xs font-medium",
                            voided
                              ? "text-zinc-500 line-through"
                              : "text-zinc-200"
                          )}
                        >
                          {inv.title}
                        </span>
                        <Badge
                          tone={
                            unpaid ? "amber" : paid ? "green" : "default"
                          }
                        >
                          {INV_STATUS_LABEL[st] || st}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
                        <span
                          className={cn(
                            "font-semibold",
                            unpaid
                              ? "text-amber-300"
                              : voided
                                ? "text-zinc-500"
                                : "text-zinc-200"
                          )}
                        >
                          {formatMoney(inv.amountCents, inv.currency, {
                            compact: true,
                          })}
                        </span>
                        {inv.issuedAt && (
                          <span className="text-zinc-600">
                            {" "}
                            · {fmtDateShort(inv.issuedAt)}
                          </span>
                        )}
                        {paid && inv.paidAt && (
                          <span className="text-zinc-600">
                            {" "}
                            · paid {fmtDateShort(inv.paidAt)}
                          </span>
                        )}
                      </p>
                      {inv.notes?.trim() && !voided && (
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-600">
                          {inv.notes.trim()}
                        </p>
                      )}
                    </div>
                    {!voided && (
                      <div className="flex flex-wrap gap-1">
                        {unpaid ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={pending}
                            className="min-h-11"
                            aria-label={`Mark ${inv.title} paid`}
                            onClick={() =>
                              run(async () => {
                                await setClientInvoicePaidAction(
                                  inv.id,
                                  clientId,
                                  true
                                );
                              })
                            }
                          >
                            Mark paid
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            className="min-h-11"
                            aria-label={`Mark ${inv.title} unpaid`}
                            onClick={() =>
                              run(async () => {
                                await setClientInvoicePaidAction(
                                  inv.id,
                                  clientId,
                                  false
                                );
                              })
                            }
                          >
                            Unpaid
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          className="min-h-11 text-zinc-500"
                          aria-label={`Void ${inv.title}`}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Void “${inv.title}” (${formatMoney(inv.amountCents, inv.currency, { compact: true })})?\n\nIt stays in history but no longer counts as owed.`
                              )
                            ) {
                              return;
                            }
                            run(async () => {
                              await voidClientInvoiceAction(inv.id, clientId);
                            });
                          }}
                        >
                          Void
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )
        )}

        {showInvoiceForm && (
          <form
            onSubmit={onCreateInvoice}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5"
          >
            <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              New invoice · SGD · mark paid when settled
            </p>
            <div className="grid gap-2 sm:grid-cols-[7.5rem_1fr]">
              <div>
                <label className="sr-only" htmlFor="inv-amount">
                  Amount
                </label>
                <Input
                  id="inv-amount"
                  value={invAmount}
                  onChange={(e) =>
                    setInvAmount(sanitizeMoneyInput(e.target.value))
                  }
                  placeholder="600"
                  disabled={pending}
                  required
                  inputMode="decimal"
                  autoComplete="off"
                  className="min-h-11 text-sm tabular-nums"
                  aria-label="Amount in SGD"
                />
              </div>
              <Input
                value={invTitle}
                onChange={(e) => setInvTitle(e.target.value)}
                placeholder="Title (e.g. 10-pack)"
                disabled={pending}
                className="min-h-11 text-sm"
                aria-label="Invoice title"
              />
            </div>
            <Input
              value={invNotes}
              onChange={(e) => setInvNotes(e.target.value)}
              placeholder="Notes (optional)"
              disabled={pending}
              className="min-h-11 text-sm"
              aria-label="Invoice notes"
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="submit"
                size="sm"
                loading={pending}
                disabled={pending || !invAmount.trim()}
                className="min-h-11"
              >
                Create invoice
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                className="min-h-11"
                onClick={() => setShowInvoiceForm(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      {/* Follow-ups / tasks */}
      <section
        id="crm-tasks"
        className="scroll-mt-client space-y-2 border-t border-zinc-800/80 pt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Follow-ups
            {openTasks.length > 0 && (
              <span className="ml-1.5 font-normal normal-case text-amber-400/90">
                {openTasks.length} open
              </span>
            )}
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline"
            aria-expanded={showTaskForm}
            onClick={() => setShowTaskForm((v) => !v)}
          >
            {showTaskForm ? "Done" : "Add task"}
          </button>
        </div>

        {taskList.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No follow-ups — add a due task for rebook, renew, or check-in.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Client tasks">
            {taskList.map((t) => {
              const done = t.status === "done";
              const due = t.dueAt ? new Date(t.dueAt) : null;
              const overdue =
                !done && due != null && due.getTime() < Date.now();
              return (
                <li
                  key={t.id}
                  className={cn(
                    "flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2",
                    done
                      ? "border-zinc-800/60 bg-zinc-950/30 opacity-70"
                      : overdue
                        ? "border-amber-900/40 bg-amber-950/20"
                        : "border-zinc-800 bg-zinc-950/40"
                  )}
                >
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        await setClientTaskDoneAction(t.id, clientId, !done);
                      })
                    }
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                      done
                        ? "border-emerald-800/50 bg-emerald-950/40 text-emerald-300"
                        : "border-zinc-700 text-zinc-500 hover:border-zinc-500"
                    )}
                    aria-label={done ? "Mark open" : "Mark done"}
                  >
                    {done ? "✓" : ""}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-xs font-medium",
                        done
                          ? "text-zinc-500 line-through"
                          : "text-zinc-200"
                      )}
                    >
                      {t.title}
                    </p>
                    {due && (
                      <p
                        className={cn(
                          "text-[10px] tabular-nums",
                          overdue ? "text-amber-300/90" : "text-zinc-600"
                        )}
                      >
                        {overdue ? "Overdue · " : "Due "}
                        {due.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    className="min-h-11 px-1 text-[11px] text-zinc-600 hover:text-red-300"
                    onClick={() => {
                      if (!window.confirm(`Remove follow-up “${t.title}”?`)) {
                        return;
                      }
                      run(async () => {
                        await deleteClientTaskAction(t.id, clientId);
                      });
                    }}
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {showTaskForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!taskTitle.trim()) {
                fail("Task title is required");
                return;
              }
              run(async () => {
                await createClientTaskAction({
                  clientId,
                  title: taskTitle.trim(),
                  dueAt: taskDue || null,
                });
                setTaskTitle("");
                setTaskDue("");
                setShowTaskForm(false);
              });
            }}
            className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5"
          >
            <Input
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="e.g. Rebook next week"
              disabled={pending}
              className="min-h-11 text-sm"
              aria-label="Task title"
              required
            />
            <div>
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Due (optional)
              </label>
              <Input
                type="date"
                value={taskDue}
                onChange={(e) => setTaskDue(e.target.value)}
                disabled={pending}
                className="mt-1 min-h-11 text-sm"
                aria-label="Due date"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              loading={pending}
              disabled={pending || !taskTitle.trim()}
              className="min-h-11"
            >
              Save task
            </Button>
          </form>
        )}
      </section>

      {/* Check-ins — history first; form behind disclosure */}
      <section
        id="crm-checkin"
        className="scroll-mt-client space-y-2 border-t border-zinc-800/80 pt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Check-ins
          </p>
          <button
            type="button"
            className="text-[11px] font-medium text-zinc-400 transition hover:text-zinc-200 hover:underline"
            aria-expanded={showCheckInForm}
            onClick={() => setShowCheckInForm((v) => !v)}
          >
            {showCheckInForm ? "Done" : "Log check-in"}
          </button>
        </div>

        {checkInList.length === 0 ? (
          <p className="text-xs text-zinc-600">
            No check-ins yet — log a call, text, or in-person note.
          </p>
        ) : (
          <ul className="space-y-1.5" aria-label="Check-in history">
            {checkInList.map((ci) => (
              <li
                key={ci.id}
                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="sky">
                    {CHANNEL_LABEL[ci.channel] ??
                      ci.channel.replaceAll("_", " ")}
                  </Badge>
                  <span
                    className="text-[10px] tabular-nums text-zinc-600"
                    title={fmtWhen(ci.createdAt)}
                  >
                    {fmtRelative(ci.createdAt)}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-300">
                  {ci.body}
                </p>
              </li>
            ))}
          </ul>
        )}

        {showCheckInForm && (
          <form onSubmit={onCreateCheckIn} className="space-y-2">
            <div
              className="flex flex-wrap gap-1.5"
              role="group"
              aria-label="Channel"
            >
              {CHECK_IN_CHANNELS.map((c) => {
                const active = channel === c;
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={pending}
                    onClick={() => setChannel(c)}
                    aria-pressed={active}
                    className={cn(
                      "min-h-11 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      active
                        ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    {CHANNEL_LABEL[c] ?? c}
                  </button>
                );
              })}
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                Templates · paste into WhatsApp yourself
              </p>
              <CheckInTemplates
                disabled={pending}
                onPick={(body) => {
                  setCheckInBody(body);
                  setChannel("message");
                }}
              />
            </div>
            <Textarea
              value={checkInBody}
              onChange={(e) => setCheckInBody(e.target.value)}
              placeholder="Quick note from a touchpoint…"
              disabled={pending}
              rows={2}
              className="min-h-[64px] text-xs"
              aria-label="Check-in note"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              loading={pending}
              disabled={pending || !checkInBody.trim()}
              className="min-h-11"
            >
              Log check-in
            </Button>
          </form>
        )}
      </section>
    </Card>
  );
}
