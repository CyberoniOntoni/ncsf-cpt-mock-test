"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClientSearchBar } from "./client-search";
import { CoachConsole } from "./coach-console";
import {
  ActiveClientPanel,
  type ActiveClientDetail,
} from "./active-client-panel";
import { getClientAction } from "@/app/actions/clients";
import {
  getHomeClientProgramsAction,
  getHomeDashboardAction,
  type HomeAgendaItem,
  type HomeClientProgram,
  type HomeInProgressSession,
  type HomeNeedsYouItem,
} from "@/app/actions/home";
import { getProgramFirstDayAction } from "@/app/actions/programs";
import {
  getStoredActiveClientId,
  setStoredActiveClient,
  subscribeActiveClient,
  syncActiveClientUrl,
} from "@/lib/active-client";
import { resolveClientNextAction } from "@/lib/client-next-action";
import { cn, fullName } from "@/lib/utils";
import { Badge, Button, Card, SectionLabel, Skeleton } from "./ui";
import { ListRow } from "./list-row";
import { StartSessionButton } from "./start-session-button";
import { HomeQuickCheckIn } from "./home-quick-checkin";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Dumbbell,
  Play,
  Sparkles,
  Timer,
  UserPlus,
} from "lucide-react";

type ClientHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  goals: string | null;
};

function fmtWhen(d: Date | string | null | undefined) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function needsYouBadge(kind: HomeNeedsYouItem["kind"]): {
  label: string;
  tone: "amber" | "green" | "default" | "sky";
} {
  if (kind === "in_progress") return { label: "Resume", tone: "amber" };
  if (kind === "no_program") return { label: "Design", tone: "default" };
  if (kind === "low_package") return { label: "Pack", tone: "amber" };
  if (kind === "upcoming_appt") return { label: "Appt", tone: "sky" };
  if (kind === "open_task") return { label: "Task", tone: "amber" };
  if (kind === "unpaid_invoice") return { label: "Unpaid", tone: "amber" };
  if (kind === "quiet_lead") return { label: "Lead", tone: "default" };
  // quiet_client fallback (actionLabel usually "Open on floor")
  return { label: "Quiet", tone: "default" };
}

export function HomeWorkspace({
  initialClientId,
}: {
  initialClientId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialClientId || null
  );
  const [hydrated, setHydrated] = useState(!!initialClientId);
  const [detail, setDetail] = useState<ActiveClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  const [inProgress, setInProgress] = useState<HomeInProgressSession[]>([]);
  const [agenda, setAgenda] = useState<HomeAgendaItem[]>([]);
  const [needsYou, setNeedsYou] = useState<HomeNeedsYouItem[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [dashLoading, setDashLoading] = useState(true);

  const [clientPrograms, setClientPrograms] = useState<HomeClientProgram[]>(
    []
  );
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programDayId, setProgramDayId] = useState<string | null>(null);

  const [coachOpen, setCoachOpen] = useState(false);
  const [needsOpen, setNeedsOpen] = useState(true);

  useEffect(() => {
    if (initialClientId) {
      setStoredActiveClient(initialClientId);
      syncActiveClientUrl(initialClientId);
      setSelectedId(initialClientId);
      setHydrated(true);
      return;
    }
    const stored = getStoredActiveClientId();
    if (stored) {
      setSelectedId(stored);
      syncActiveClientUrl(stored);
    }
    setHydrated(true);
  }, [initialClientId]);

  // Shell chip clear / other tabs → stay in sync
  useEffect(() => {
    return subscribeActiveClient(() => {
      const id = getStoredActiveClientId();
      setSelectedId(id);
      if (!id) {
        setDetail(null);
        setClientPrograms([]);
        setProgramDayId(null);
      }
    });
  }, []);

  const loadDetail = useCallback(async (clientId: string) => {
    setLoadingDetail(true);
    try {
      const data = await getClientAction(clientId);
      if (data) {
        const d = data as ActiveClientDetail;
        setDetail(d);
        setStoredActiveClient(
          clientId,
          fullName(d.client.firstName, d.client.lastName)
        );
      } else {
        setDetail(null);
        setSelectedId(null);
        setStoredActiveClient(null);
        syncActiveClientUrl(null);
      }
    } catch {
      setDetail(null);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const loadDashboard = useCallback(
    async (opts?: { soft?: boolean }) => {
      // Soft refresh (focus/visibility) keeps prior UI — avoid Needs you “…” flicker
      if (!opts?.soft) setDashLoading(true);
      try {
        const d = await getHomeDashboardAction();
        setInProgress(d.inProgress);
        setAgenda(d.agenda || []);
        setNeedsYou(d.needsYou);
        setClientCount(d.clientCount);
        // Always show header; expand only when there is work (collapsed "All clear")
        if (!opts?.soft) {
          setNeedsOpen(d.needsYou.length > 0);
        }
        // Soft return-to-tab: also refresh launch-card programs for sticky client
        if (opts?.soft) {
          const sticky = getStoredActiveClientId();
          if (sticky) {
            try {
              // Refresh launch-card programs + client detail (flags/goals)
              void loadDetail(sticky);
              const rows = await getHomeClientProgramsAction(sticky);
              setClientPrograms(rows);
            } catch {
              // keep prior programs
            }
          }
        }
      } catch {
        // Keep prior data — don't wipe Needs you / open sessions on a transient failure
      } finally {
        if (!opts?.soft) setDashLoading(false);
      }
    },
    [loadDetail]
  );

  useEffect(() => {
    if (!hydrated) return;
    void loadDashboard();
  }, [hydrated, loadDashboard]);

  // Soft refresh when returning to the tab (debounce visibility + focus double-fire)
  useEffect(() => {
    if (!hydrated) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    function softRefresh() {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        void loadDashboard({ soft: true });
      }, 280);
    }
    function onVisible() {
      if (document.visibilityState === "visible") softRefresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", softRefresh);
    return () => {
      if (t) clearTimeout(t);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", softRefresh);
    };
  }, [hydrated, loadDashboard]);

  useEffect(() => {
    if (!hydrated) return;
    if (selectedId) {
      void loadDetail(selectedId);
    } else {
      setDetail(null);
      setClientPrograms([]);
      setProgramDayId(null);
    }
  }, [selectedId, loadDetail, hydrated]);

  useEffect(() => {
    if (!selectedId) {
      setClientPrograms([]);
      setProgramDayId(null);
      return;
    }
    let cancelled = false;
    setProgramsLoading(true);
    setProgramDayId(null);
    void getHomeClientProgramsAction(selectedId)
      .then(async (rows) => {
        if (cancelled) return;
        setClientPrograms(rows);
        const active = rows.find((p) => p.status === "active") || rows[0];
        if (active) {
          try {
            const first = await getProgramFirstDayAction(active.id);
            if (!cancelled) setProgramDayId(first?.dayId ?? null);
          } catch {
            if (!cancelled) setProgramDayId(null);
          }
        } else {
          setProgramDayId(null);
        }
        if (!cancelled) setProgramsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setClientPrograms([]);
          setProgramDayId(null);
          setProgramsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  function onSelect(client: ClientHit) {
    setSelectedId(client.id);
    setStoredActiveClient(
      client.id,
      fullName(client.firstName, client.lastName)
    );
    syncActiveClientUrl(client.id);
    setPanelOpen(false);
  }

  function onClear() {
    setSelectedId(null);
    setDetail(null);
    setStoredActiveClient(null);
    syncActiveClientUrl(null);
    setClientPrograms([]);
    setProgramDayId(null);
    setPanelOpen(false);
  }

  const clientName = detail
    ? fullName(detail.client.firstName, detail.client.lastName)
    : null;
  const hasClient = !!selectedId;
  const client = detail?.client;
  const flags: string[] = [];
  if (client?.injuries?.trim()) flags.push("Injury notes");
  if (client?.contraindications?.trim()) flags.push("Contraindications");
  if (client?.goals?.trim()) {
    const g = client.goals.trim();
    flags.push(g.length > 36 ? `${g.slice(0, 34)}…` : g);
  }

  const activeProgram = clientPrograms.find((p) => p.status === "active");
  const anyProgram = activeProgram || clientPrograms[0];
  const openSession = hasClient
    ? inProgress.find((s) => s.clientId === selectedId)
    : undefined;

  const nextAction = useMemo(() => {
    if (!selectedId) return null;
    return resolveClientNextAction({
      clientId: selectedId,
      liveSession: openSession
        ? { id: openSession.id, title: openSession.title }
        : null,
      programId: anyProgram?.id ?? null,
      programTitle: anyProgram?.title ?? null,
      programDayId,
    });
  }, [selectedId, openSession, anyProgram, programDayId]);

  const headerHint = !hasClient
    ? "Resume open sessions, clear Needs you, or pick a client."
    : openSession
      ? "Resume session, or open the program without resuming."
      : anyProgram
        ? programDayId
          ? "Start session from the program day, or open the full plan."
          : "Open the program to start a session day."
        : "Design program, then start a session from a day.";

  const openSessionsEmpty = !hasClient
    ? "Pick a client to resume or start a session."
    : anyProgram
      ? "Start session from the program below."
      : "Design program, then start a session from a day.";

  return (
    <div className="page-pad flex flex-1 flex-col gap-4 animate-in sm:gap-5">
      {/* Compact status strip */}
      <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-500/90">
            Floor ·{" "}
            {new Date().toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-50">
            {hasClient && clientName ? clientName : "Today"}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">{headerHint}</p>
        </div>
      </header>

      {/* Today agenda — booked sessions next 48h (always visible) */}
      <section aria-label="Agenda, next 48 hours">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <SectionLabel className="mb-0">
            Agenda
            <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">
              (48h
              {agenda.length > 0 ? ` · ${agenda.length}` : ""})
            </span>
          </SectionLabel>
          <Link
            href="/calendar"
            className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400/90 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
          >
            Full calendar →
          </Link>
        </div>
        {dashLoading && agenda.length === 0 ? (
          <Skeleton className="h-14 w-full rounded-xl" />
        ) : agenda.length === 0 ? (
          <div className="space-y-1">
            <p className="text-sm text-zinc-600">
              Nothing booked in the next 48h.
            </p>
            {hasClient && selectedId && (
              <Link
                href={`/clients/${selectedId}#crm-appointments`}
                className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400/90 hover:underline"
              >
                Book for {clientName || "client"} →
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {agenda.map((a) => {
              const when = new Date(a.startsAt).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={a.appointmentId}>
                  <ListRow
                    href={a.href}
                    tone="default"
                    title={a.clientName}
                    subtitle={`${a.title} · ${when}`}
                    trailing={<Badge tone="sky">Booked</Badge>}
                    onClick={() => {
                      setSelectedId(a.clientId);
                      setStoredActiveClient(a.clientId, a.clientName);
                      syncActiveClientUrl(a.clientId);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Open sessions (in progress) */}
      <section aria-label="Open sessions">
        <SectionLabel className="mb-1.5">
          Open sessions
          {inProgress.length > 0 && (
            <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">
              ({inProgress.length})
            </span>
          )}
        </SectionLabel>
        {dashLoading && inProgress.length === 0 ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : inProgress.length === 0 ? (
          <Card className="border-dashed border-zinc-800 bg-zinc-950/40 py-3">
            <p className="text-sm text-zinc-500">
              No open sessions. {openSessionsEmpty}
            </p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {!hasClient && (
                <Link
                  href="/sessions"
                  className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400 hover:underline"
                >
                  Browse sessions →
                </Link>
              )}
              {hasClient && !anyProgram && selectedId && (
                <Link
                  href={`/programs/new?client=${selectedId}`}
                  className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400 hover:underline"
                >
                  Design program →
                </Link>
              )}
            </div>
          </Card>
        ) : (
          <ul className="space-y-2">
            {inProgress.map((s) => (
              <li key={s.id}>
                <ListRow
                  href={`/sessions/${s.id}`}
                  tone="accent"
                  leading={
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-900/50 text-emerald-300">
                      <Play className="h-4 w-4 fill-current" />
                    </div>
                  }
                  title={s.title}
                  subtitle={
                    <>
                      {s.clientName || "No client"}
                      {s.updatedAt ? ` · ${fmtWhen(s.updatedAt)}` : ""}
                    </>
                  }
                  trailing={<Badge tone="amber">Resume</Badge>}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Client switcher */}
      <section aria-label="Client">
        <SectionLabel className="mb-1.5">Client</SectionLabel>
        <ClientSearchBar
          selectedClientId={selectedId}
          selectedClientName={clientName}
          onSelect={onSelect}
          onClear={onClear}
          compactSelected
        />
      </section>

      {/* Empty activation (no client) */}
      {!hasClient && hydrated && (
        <section className="grid gap-2 sm:grid-cols-3" aria-label="Get started">
          <Card className="border-dashed border-zinc-700/80 bg-zinc-950/40 p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-emerald-400">
                <UserPlus className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-200">
                  {clientCount === 0
                    ? "Add your first client"
                    : "Find a client"}
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {clientCount === 0
                    ? "Search above or run full intake."
                    : "Search above to lock a client for the floor."}
                </p>
                <Link
                  href="/clients/new"
                  className="mt-2 inline-block text-xs font-medium text-emerald-400 hover:underline"
                >
                  Full intake →
                </Link>
              </div>
            </div>
          </Card>
          <Card className="border-dashed border-zinc-700/80 bg-zinc-950/40 p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-emerald-400">
                <Dumbbell className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-200">
                  Programs
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Design or open a plan, then start a session on the floor.
                </p>
                <Link
                  href="/programs"
                  className="mt-2 inline-block text-xs font-medium text-emerald-400 hover:underline"
                >
                  Open programs →
                </Link>
              </div>
            </div>
          </Card>
          <Card className="border-dashed border-zinc-700/80 bg-zinc-950/40 p-3">
            <div className="flex items-start gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-emerald-400">
                <Timer className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-200">
                  Sessions
                </div>
                <p className="mt-0.5 text-xs text-zinc-500">
                  Resume open logs and review session history.
                </p>
                <Link
                  href="/sessions"
                  className="mt-2 inline-block text-xs font-medium text-emerald-400 hover:underline"
                >
                  Open sessions →
                </Link>
              </div>
            </div>
          </Card>
        </section>
      )}

      {/* Client launch card — floor CTAs */}
      {hasClient && (
        <section aria-label="Client floor actions">
          {loadingDetail && !detail ? (
            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-12 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-28" />
                <Skeleton className="h-10 w-28" />
              </div>
            </div>
          ) : (
            <Card className="space-y-3 border-zinc-800 bg-zinc-900/50">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-zinc-100">
                    {clientName || "Client"}
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {programsLoading
                      ? "Loading programs…"
                      : anyProgram
                        ? `${anyProgram.title} · ${anyProgram.status}${
                            anyProgram.daysPerWeek
                              ? ` · ${anyProgram.daysPerWeek}×/wk`
                              : ""
                          }`
                        : "No program assigned yet"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  className="text-zinc-500"
                  aria-label="Clear sticky client"
                >
                  Clear
                </Button>
              </div>

              {flags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {flags.slice(0, 3).map((f) => (
                    <Badge
                      key={f}
                      tone={
                        f === "Injury notes" || f === "Contraindications"
                          ? "amber"
                          : "default"
                      }
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Primary floor CTA first; one emerald action via resolveClientNextAction */}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {programsLoading && !openSession ? (
                  <Skeleton className="h-10 w-44 rounded-lg" />
                ) : nextAction?.kind === "start_session" &&
                  nextAction.programDayId ? (
                  <StartSessionButton
                    programDayId={nextAction.programDayId}
                    label={nextAction.label}
                  />
                ) : nextAction ? (
                  <Link href={nextAction.href} className="inline-flex">
                    <Button type="button" className="w-full sm:w-auto">
                      {nextAction.kind === "resume_session" ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : nextAction.kind === "open_program" ? (
                        <Timer className="h-3.5 w-3.5" />
                      ) : (
                        <Dumbbell className="h-3.5 w-3.5" />
                      )}
                      {nextAction.label}
                    </Button>
                  </Link>
                ) : null}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <Link
                    href={`/clients/${selectedId}`}
                    className="inline-flex min-h-11 items-center font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
                  >
                    Profile
                  </Link>
                  <Link
                    href={`/clients/${selectedId}/assessments`}
                    className="inline-flex min-h-11 items-center gap-1 font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
                  >
                    <ClipboardList className="h-3 w-3" aria-hidden />
                    Screens
                  </Link>
                  <Link
                    href={`/clients/${selectedId}#progress`}
                    className="inline-flex min-h-11 items-center font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                  >
                    Progress
                  </Link>
                  {selectedId && (
                    <HomeQuickCheckIn
                      clientId={selectedId}
                      clientName={clientName ?? undefined}
                      onSaved={() => {
                        void loadDashboard({ soft: true });
                      }}
                    />
                  )}
                </div>
              </div>

              {openSession && anyProgram && (
                <p className="text-xs text-zinc-600">
                  Or{" "}
                  <Link
                    href={`/programs/${anyProgram.id}`}
                    className="font-medium text-emerald-400/90 hover:underline"
                  >
                    open program
                  </Link>{" "}
                  without resuming.
                </p>
              )}
              {!openSession &&
                nextAction?.kind === "start_session" &&
                anyProgram && (
                  <p className="text-xs text-zinc-600">
                    Or{" "}
                    <Link
                      href={`/programs/${anyProgram.id}`}
                      className="font-medium text-emerald-400/90 hover:underline"
                    >
                      open program
                    </Link>{" "}
                    to pick another day.
                  </p>
                )}

              <button
                type="button"
                onClick={() => setPanelOpen((v) => !v)}
                aria-expanded={panelOpen}
                className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2.5 text-left text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-300"
              >
                <span>Client snapshot (goals, notes, screens)</span>
                {panelOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                )}
              </button>

              {panelOpen && (
                <ActiveClientPanel
                  data={detail}
                  loading={loadingDetail || !detail}
                  onClear={onClear}
                  expanded
                  embedded
                  onToggleExpand={() => setPanelOpen(false)}
                />
              )}
            </Card>
          )}
        </section>
      )}

      {/* Needs you — always mounted (zero state when clear) */}
      <section aria-label="Needs you">
        <button
          type="button"
          onClick={() => setNeedsOpen((v) => !v)}
          aria-expanded={needsOpen}
          className="mb-1.5 flex w-full min-h-11 items-center gap-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500"
        >
          <AlertTriangle
            className={cn(
              "h-3.5 w-3.5",
              needsYou.length > 0 ? "text-amber-500/90" : "text-zinc-600"
            )}
            aria-hidden
          />
          Needs you
          {dashLoading ? (
            <Badge tone="default">…</Badge>
          ) : needsYou.length > 0 ? (
            <Badge tone="amber">{needsYou.length}</Badge>
          ) : (
            <Badge tone="green">All clear</Badge>
          )}
          <span className="ml-auto font-normal normal-case tracking-normal text-zinc-600">
            {needsOpen ? "Hide" : "Show"}
          </span>
        </button>
        {needsOpen && (
          <>
            {dashLoading && needsYou.length === 0 ? (
              <Skeleton className="h-20 w-full rounded-xl" />
            ) : needsYou.length === 0 ? (
              <Card className="border-dashed border-zinc-800 bg-zinc-950/40 py-3.5">
                <p className="text-sm text-zinc-400">
                  Nothing needs you right now.
                </p>
                <p className="mt-0.5 text-xs text-zinc-600">
                  Open tasks, unpaid invoices, soon bookings, quiet leads, low
                  packs, and open sessions show up here.
                </p>
              </Card>
            ) : (
              <ul className="space-y-1.5">
                {needsYou.map((item) => {
                  const badge = needsYouBadge(item.kind);
                  const trailingLabel = item.actionLabel || badge.label;
                  return (
                    <li key={item.id}>
                      <ListRow
                        href={item.href}
                        tone={item.urgency === "high" ? "warn" : "default"}
                        title={item.title}
                        subtitle={item.subtitle}
                        trailing={
                          <Badge
                            tone={
                              item.urgency === "high" ? "amber" : badge.tone
                            }
                          >
                            {trailingLabel}
                          </Badge>
                        }
                        onClick={() => {
                          if (
                            item.clientId &&
                            item.kind !== "in_progress"
                          ) {
                            setSelectedId(item.clientId);
                            setStoredActiveClient(item.clientId, item.title);
                            syncActiveClientUrl(item.clientId);
                          }
                        }}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </section>

      {/* Coach — collapsed by default; open on demand */}
      <section aria-label="Coach">
        <button
          type="button"
          onClick={() => setCoachOpen((v) => !v)}
          aria-expanded={coachOpen}
          className="mb-2 flex w-full min-h-12 items-center gap-2.5 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2.5 text-left transition hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-950/50 text-emerald-400 ring-1 ring-emerald-900/40">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-zinc-200">Coach</div>
            <div className="truncate text-xs text-zinc-500">
              {clientName
                ? `Brief · prep · programs · ${clientName}`
                : "Playbooks anytime · pick a client for CRM actions"}
            </div>
          </div>
          {coachOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
        </button>
        {/* Keep mounted so collapse does not wipe the thread (floor: hide chrome, keep context) */}
        <div
          className={cn(
            "min-h-[280px] rounded-xl border border-zinc-800/80 bg-zinc-950/30 p-1 sm:p-2",
            !coachOpen && "hidden"
          )}
          hidden={!coachOpen}
        >
          <CoachConsole
            clientId={selectedId}
            clientName={clientName}
            onSelectClient={onSelect}
          />
        </div>
      </section>
    </div>
  );
}
