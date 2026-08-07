"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  adjustPackageUsedAction,
  cancelClientPackageAction,
  createClientAppointmentAction,
  createClientCheckInAction,
  createClientPackageAction,
  updateAppointmentStatusAction,
  updateClientStageAction,
} from "@/app/actions/crm";
import { clientStageLabel } from "@/lib/client-next-action";
import {
  CHECK_IN_CHANNELS,
  type CheckInChannel,
  type ClientStage,
} from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
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
};

export type CrmCheckInRow = {
  id: string;
  channel: string;
  body: string;
  createdAt: Date | string;
  authorUserId?: string | null;
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
  nextAppointment: CrmAppointmentRow | null;
  activePackage: CrmActivePackage;
};

const PIPELINE_STAGES: ClientStage[] = [
  "lead",
  "active",
  "paused",
  "inactive",
];

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

  // Deep links from home needs-you: #crm-pack | #crm-appointments | #crm-checkin
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
        // Open add-pack when nothing active; otherwise scroll to package section
        if (!snapshot.activePackage) {
          setShowAddPack(true);
          scrollToId("crm-pack", 'input[name="pkg-name"], input, textarea');
        } else {
          scrollToId("crm-pack");
        }
      } else if (hash === "crm-appointments") {
        // View booking: open form only when nothing upcoming
        if (!snapshot.nextAppointment) {
          setShowBookForm(true);
          scrollToId(
            "crm-appointments",
            'input[type="datetime-local"], input, textarea'
          );
        } else {
          setShowBookForm(false);
          scrollToId("crm-appointments");
        }
      } else if (hash === "crm-checkin") {
        setShowCheckInForm(true);
        scrollToId("crm-checkin", "textarea");
      }
    }

    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [snapshot.activePackage, snapshot.nextAppointment, clientId]);

  const stageButtons = useMemo(() => {
    const list = [...PIPELINE_STAGES];
    if (stage === "draft" && !list.includes("draft")) {
      list.unshift("draft");
    }
    return list;
  }, [stage]);

  const appointmentList = useMemo(
    () => sortAppointments(snapshot.appointments).slice(0, 8),
    [snapshot.appointments]
  );
  const checkInList = snapshot.checkIns.slice(0, 8);

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
      ? "Renew package"
      : "No package";
  const summaryBooking = nextAppointment
    ? fmtDateShort(nextAppointment.startsAt) || fmtWhen(nextAppointment.startsAt)
    : "No booking";

  function run(fn: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  function onStageChange(next: string) {
    if (next === stage) return;
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

  function onCreatePackage(e: FormEvent) {
    e.preventDefault();
    const total = Number(pkgTotal);
    if (!Number.isFinite(total) || total < 1) {
      setError("Total sessions must be at least 1");
      return;
    }
    const used = Math.max(0, Math.floor(Number(pkgUsed) || 0));
    if (used > total) {
      setError("Used cannot exceed total sessions");
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
      setError("Start time is required");
      return;
    }
    const startDate = new Date(apptStart);
    if (Number.isNaN(startDate.getTime())) {
      setError("Invalid start time");
      return;
    }
    const duration = Math.max(15, Math.floor(Number(apptDuration) || 60));
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
    status: "completed" | "cancelled",
    title: string
  ) {
    if (status === "cancelled") {
      if (!window.confirm(`Cancel “${title}”?`)) return;
    }
    run(async () => {
      await updateAppointmentStatusAction(appointmentId, clientId, status);
    });
  }

  function onCreateCheckIn(e: FormEvent) {
    e.preventDefault();
    if (!checkInBody.trim()) {
      setError("Check-in note is required");
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
            Packs · bookings · check-ins
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
          role="alert"
          className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-200"
        >
          {error}
          <button
            type="button"
            className="ml-2 font-medium text-red-100 underline"
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
        <span
          className={cn(
            "tabular-nums",
            activePackage
              ? lowRemaining
                ? "font-medium text-amber-300/95"
                : "text-zinc-400"
              : hadExhaustedPack
                ? "font-medium text-amber-300/95"
                : "text-zinc-600"
          )}
        >
          {summaryPack}
        </span>
        <span className="text-zinc-700" aria-hidden>
          ·
        </span>
        <span
          className={cn(
            "tabular-nums",
            nextAppointment ? "text-zinc-400" : "text-zinc-600"
          )}
        >
          {summaryBooking}
        </span>
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
                    "min-h-9 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                    active
                      ? s === "inactive"
                        ? "border-zinc-600 bg-zinc-800 text-zinc-200"
                        : "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
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
                >
                  +1 used
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={onCancelPackage}
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
                No active pack — add one to track remaining sessions.
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                aria-expanded={showAddPack}
                onClick={() => setShowAddPack(true)}
                className="min-h-9"
              >
                Add package
              </Button>
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
              className="min-h-9 py-1.5 text-xs"
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
              className="min-h-9 py-1.5 text-xs tabular-nums"
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
              className="min-h-9 py-1.5 text-xs tabular-nums"
              aria-label="Already used sessions"
            />
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={pending}
                className="min-h-9"
              >
                Add pack
              </Button>
              {!activePackage && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  className="min-h-9"
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
                  onApptStatus(
                    nextAppointment.id,
                    "completed",
                    nextAppointment.title
                  )
                }
              >
                Mark complete
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
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
              className="min-h-9 py-1.5 text-xs tabular-nums"
              aria-label="Appointment start"
            />
            <Input
              value={apptTitle}
              onChange={(e) => setApptTitle(e.target.value)}
              placeholder="Title (optional)"
              disabled={pending}
              className="min-h-9 py-1.5 text-xs"
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
              className="min-h-9 py-1.5 text-xs tabular-nums"
              aria-label="Duration minutes"
            />
            <Button
              type="submit"
              size="sm"
              variant="secondary"
              disabled={pending}
              className="min-h-9"
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
                    </div>
                    <p className="mt-0.5 text-[11px] tabular-nums text-zinc-500">
                      {fmtWhen(a.startsAt)}
                    </p>
                  </div>
                  {a.status === "scheduled" && (
                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() =>
                          onApptStatus(a.id, "completed", a.title)
                        }
                      >
                        Complete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() =>
                          onApptStatus(a.id, "cancelled", a.title)
                        }
                      >
                        Cancel
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
                      "min-h-8 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
                      active
                        ? "border-sky-700/50 bg-sky-950/40 text-sky-200"
                        : "border-zinc-800 bg-zinc-950/50 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    {CHANNEL_LABEL[c] ?? c}
                  </button>
                );
              })}
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
              className="min-h-9"
            >
              Log check-in
            </Button>
          </form>
        )}
      </section>
    </Card>
  );
}
