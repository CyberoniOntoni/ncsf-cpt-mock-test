import Link from "next/link";
import { notFound } from "next/navigation";
import { getClientAction } from "@/app/actions/clients";
import { getClientCrmSnapshotAction } from "@/app/actions/crm";
import { getClientProgressAction } from "@/app/actions/progress";
import {
  getProgramFirstDayAction,
  listProgramsAction,
} from "@/app/actions/programs";
import { listSessionsAction } from "@/app/actions/sessions";
import {
  CLIENT_PAGE_HEADER_ID,
  ClientDetailStickyBar,
} from "@/components/client-detail-sticky-bar";
import { ClientCrmPanel } from "@/components/client-crm-panel";
import { ClientProgressDashboard } from "@/components/client-progress-dashboard";
import { ClientStickySync } from "@/components/client-sticky-sync";
import { ClientTimeline } from "@/components/client-timeline";
import { buildClientTimeline } from "@/lib/client-timeline";
import { QuickAddMeasurement } from "@/components/quick-add-measurement";
import { ClientDeactivateControl } from "@/components/client-deactivate-control";
import { StartSessionButton } from "@/components/start-session-button";
import { SessionHistoryRow } from "@/components/session-history-row";
import { WeeklyVolumeMini } from "@/components/weekly-volume-mini";
import { PageShell } from "@/components/page-shell";
import { ListRow } from "@/components/list-row";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionLabel,
} from "@/components/ui";
import {
  clientStageLabel,
  clientStageTone,
  resolveClientNextAction,
} from "@/lib/client-next-action";
import { cn, fullName } from "@/lib/utils";
import {
  AlertTriangle,
  ChevronRight,
  FileText,
  Mail,
  NotebookPen,
  Phone,
  Target,
} from "lucide-react";

export const dynamic = "force-dynamic";

const SESSIONS_VISIBLE = 6;
const GOALS_PREVIEW_MAX = 120;

/** Shared primary CTA look for Link (avoids Link > Button nesting). */
const primaryCtaClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-950/40 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:bg-emerald-600";

const ghostCtaClass =
  "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 active:bg-zinc-800";

function Field({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | null | undefined;
  tone?: "default" | "warn";
}) {
  const empty = !value?.trim();
  return (
    <div>
      <dt
        className={cn(
          "text-[10px] font-semibold uppercase tracking-wide",
          tone === "warn" && !empty ? "text-amber-500/90" : "text-zinc-500"
        )}
      >
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 text-sm whitespace-pre-wrap break-words",
          empty
            ? "text-zinc-600"
            : tone === "warn"
              ? "text-amber-100/90"
              : "text-zinc-200"
        )}
      >
        {empty ? "—" : value}
      </dd>
    </div>
  );
}

function fmtWhen(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDay(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDayShort(d: Date | string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function metaJoin(...parts: Array<string | null | undefined | false>) {
  return parts
    .map((p) => (typeof p === "string" ? p.trim() : p))
    .filter((p): p is string => Boolean(p));
}

function truncateOneLine(text: string, max = GOALS_PREVIEW_MAX) {
  const t = text.trim().replace(/\s+/g, " ");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function programSubtitle(p: {
  daysPerWeek?: number | null;
  sessionMinutes?: number | null;
  splitType?: string | null;
  goal?: string | null;
}) {
  return metaJoin(
    p.daysPerWeek != null ? `${p.daysPerWeek}×/wk` : null,
    p.sessionMinutes != null ? `${p.sessionMinutes} min` : null,
    p.splitType?.replace(/_/g, " ") || null,
    p.goal?.replace(/_/g, " ") || null
  ).join(" · ");
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getClientAction(id);
  if (!data) notFound();
  const { client, measurements, assessments, notes } = data;

  const [clientPrograms, clientSessions, progress, crm] = await Promise.all([
    listProgramsAction(id),
    listSessionsAction({ clientId: id, limit: 12 }),
    getClientProgressAction(id),
    getClientCrmSnapshotAction(id),
  ]);

  const name = fullName(client.firstName, client.lastName);
  const activeProgram = clientPrograms.find((p) => p.status === "active");
  const anyProgram = activeProgram || clientPrograms[0] || null;
  const liveSession = clientSessions.find((s) => s.status === "in_progress");
  const otherPrograms = clientPrograms.filter((p) => p.id !== anyProgram?.id);

  const firstDay = anyProgram
    ? await getProgramFirstDayAction(anyProgram.id)
    : null;

  const next = resolveClientNextAction({
    clientId: client.id,
    liveSession: liveSession
      ? { id: liveSession.id, title: liveSession.title }
      : null,
    programId: anyProgram?.id ?? null,
    programTitle: anyProgram?.title ?? null,
    programDayId: firstDay?.dayId ?? null,
  });

  type GapKey = "goals" | "experience" | "program" | "screens";
  const gaps: { key: GapKey; label: string; href: string }[] = [];
  if (!client.goals?.trim()) {
    gaps.push({ key: "goals", label: "Goals", href: "#goals-constraints" });
  }
  if (!client.experienceLevel?.trim()) {
    gaps.push({
      key: "experience",
      label: "Experience",
      href: "#goals-constraints",
    });
  }
  if (!clientPrograms.length) {
    gaps.push({
      key: "program",
      label: "Program",
      href: `/programs/new?client=${client.id}`,
    });
  }
  if (!assessments.length) {
    gaps.push({ key: "screens", label: "Screens", href: "#movement-screens" });
  }

  const goalsPreview = client.goals?.trim()
    ? truncateOneLine(client.goals)
    : null;

  const sessionsShown = clientSessions.slice(0, SESSIONS_VISIBLE);
  const sessionsOverflow = clientSessions.length - sessionsShown.length;

  const timelineItems = buildClientTimeline({
    sessions: clientSessions.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      performedAt: s.performedAt,
      updatedAt: s.updatedAt,
      durationMin: s.durationMin,
      overallRpe: s.overallRpe,
    })),
    appointments: (crm.appointments || []).map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      startsAt: a.startsAt,
      sessionId: a.sessionId,
    })),
    tasks: (crm.tasks || []).map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      dueAt: t.dueAt,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
    })),
    checkIns: (crm.checkIns || []).map((c) => ({
      id: c.id,
      channel: c.channel,
      body: c.body,
      createdAt: c.createdAt,
    })),
    invoices: (crm.invoices || []).map((inv) => ({
      id: inv.id,
      title: inv.title,
      amountCents: inv.amountCents,
      currency: inv.currency,
      status: inv.status,
      issuedAt: inv.issuedAt,
      paidAt: inv.paidAt,
    })),
    notes: notes.map((n) => ({
      id: n.id,
      title: n.title,
      kind: n.kind,
      body: n.body,
      createdAt: n.createdAt,
    })),
    limit: 40,
  });

  const secondaryLifestyle = [
    { label: "Occupation", value: client.occupation },
    { label: "Lifestyle", value: client.lifestyleNotes },
    { label: "Medical history", value: client.medicalHistory },
    { label: "Medications", value: client.medications },
  ].filter((f) => f.value?.trim());

  const injuriesText = client.injuries?.trim() || "";
  const contraindicationsText = client.contraindications?.trim() || "";
  const hasRisk = !!(injuriesText || contraindicationsText);
  const hasGoals = !!client.goals?.trim();
  const hasExperience = !!client.experienceLevel?.trim();

  const isInactive = (client.status || "").toLowerCase() === "inactive";
  const stageLabel = clientStageLabel(client.status);
  const stageTone = clientStageTone(client.status);

  const hadExhaustedPack = crm.packages.some((p) => p.status === "exhausted");
  /** Match CRM summary strip wording (N left / Pack empty / Renew pack) */
  const packageChip = (() => {
    if (crm.activePackage) {
      const n = crm.activePackage.remaining;
      if (n === 0) return "Pack empty";
      return `${n} left`;
    }
    if (hadExhaustedPack) return "Renew pack";
    return null;
  })();
  const packageChipTone =
    crm.activePackage && crm.activePackage.remaining <= 2
      ? "amber"
      : hadExhaustedPack && !crm.activePackage
        ? "amber"
        : "muted";

  const nextApptChip = crm.nextAppointment
    ? `Next ${fmtDayShort(crm.nextAppointment.startsAt)}`
    : null;
  const unpaidInv = (crm.invoices || []).filter((i) => i.status === "unpaid");
  const unpaidChip =
    unpaidInv.length === 0
      ? null
      : unpaidInv.length === 1
        ? "Unpaid"
        : `${unpaidInv.length} unpaid`;
  /** Hide empty CRM meta so header stays about the person */
  const showCrmMeta = !!(packageChip || nextApptChip || unpaidChip);

  /** Floor ops only in header — Design lives on Active plan; Floor on nav chrome */
  const startSlot =
    next.kind === "start_session" && next.programDayId ? (
      <StartSessionButton
        programDayId={next.programDayId}
        label="Start session"
      />
    ) : null;

  const headerPrimaryLink =
    next.kind === "resume_session" || next.kind === "open_program"
      ? { label: next.label, href: next.href }
      : null;

  /** Sticky keeps full next action (incl. Design) for scroll convenience */
  const stickyPrimaryLink =
    next.kind === "start_session" && next.programDayId
      ? null
      : next.kind === "none"
        ? null
        : { label: next.label, href: next.href };

  /** Up next: only exceptional context (not a second dashboard) */
  const showUpNext = !!(liveSession || injuriesText || gaps.length > 0);

  /** Human next line — skip when live session already says it */
  const showUpNextOutcome = !liveSession;
  const upNextOutcomeNode =
    next.kind === "design_program" ? (
      <Link
        href="#active-plan"
        className="font-medium text-emerald-400 hover:underline"
      >
        Design a program
      </Link>
    ) : next.kind === "resume_session" ? (
      <Link
        href={next.href}
        className="font-medium text-amber-200/90 hover:underline"
      >
        {next.title || "Resume session"}
      </Link>
    ) : next.kind === "start_session" || next.kind === "open_program" ? (
      <span>{next.title || anyProgram?.title || "Ready to train"}</span>
    ) : (
      <span className="text-zinc-500">Ready when a plan is set</span>
    );

  const floorElevated =
    "border-zinc-700/80 bg-zinc-900/70";
  const floorActiveHairline =
    "border-emerald-900/45 bg-zinc-900/70 shadow-[inset_0_1px_0_0_rgba(16,185,129,0.12)]";

  return (
    <PageShell className="space-y-5">
      <ClientStickySync clientId={client.id} name={name} />

      <ClientDetailStickyBar
        name={name}
        stageLabel={stageLabel}
        stageTone={stageTone}
        hasRisk={hasRisk}
        packLabel={packageChip}
        packTone={packageChipTone === "amber" ? "amber" : "muted"}
        packHref="#crm-pack"
        primary={stickyPrimaryLink}
        primarySlot={startSlot}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href="/clients"
          className="inline-flex min-h-9 items-center text-xs font-medium text-emerald-400 hover:underline"
        >
          ← Clients
        </Link>
        <span className="text-zinc-700" aria-hidden>
          ·
        </span>
        <Link
          href={`/?client=${encodeURIComponent(client.id)}`}
          className="inline-flex min-h-9 items-center text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
        >
          Today
        </Link>
      </div>

      {isInactive && (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-700/80 bg-zinc-900/50 px-3 py-2.5"
        >
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">Inactive</span>
            <span className="text-zinc-500">
              {" "}
              · not on the floor picker. History and packages stay.
            </span>
          </p>
          <ClientDeactivateControl
            clientId={client.id}
            clientName={name}
            status={client.status}
          />
        </div>
      )}

      <div id={CLIENT_PAGE_HEADER_ID}>
        <PageHeader
          className="mb-0"
          eyebrow="Client"
          title={name}
          titleAside={
            progress ? (
              <WeeklyVolumeMini
                weeks={progress.weeklyVolume}
                className="shrink-0"
              />
            ) : null
          }
          description={
            <span className="flex flex-col gap-2">
              {/* Stage + optional risk only — no experience flag chips */}
              <span className="flex flex-wrap items-center gap-2">
                <Badge tone={stageTone}>{stageLabel}</Badge>
                {hasRisk && (
                  <a
                    href="#goals-constraints"
                    className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-zinc-500 transition hover:text-amber-400/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
                    title="Injuries or contraindications on file"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    Risk
                  </a>
                )}
              </span>

              {/* Contact + optional CRM whisper — one quiet meta line */}
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-zinc-500">
                {client.email && (
                  <a
                    href={`mailto:${client.email}`}
                    className="inline-flex max-w-[14rem] items-center gap-1 truncate transition hover:text-zinc-300"
                  >
                    <Mail className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                    <span className="truncate">{client.email}</span>
                  </a>
                )}
                {client.phone && (
                  <a
                    href={`tel:${client.phone}`}
                    className="inline-flex items-center gap-1 transition hover:text-zinc-300"
                  >
                    <Phone className="h-3 w-3 shrink-0 text-zinc-600" aria-hidden />
                    {client.phone}
                  </a>
                )}
                {!client.email && !client.phone && (
                  <span className="text-zinc-600">No contact</span>
                )}
                {showCrmMeta && (
                  <>
                    <span className="text-zinc-700" aria-hidden>
                      ·
                    </span>
                    {packageChip && (
                      <a
                        href="#crm-pack"
                        className={cn(
                          "transition hover:underline",
                          packageChipTone === "amber"
                            ? "font-medium text-amber-400/95"
                            : "hover:text-zinc-400"
                        )}
                      >
                        {packageChip}
                      </a>
                    )}
                    {packageChip && nextApptChip && (
                      <span className="text-zinc-700" aria-hidden>
                        ·
                      </span>
                    )}
                    {nextApptChip && (
                      <a
                        href="#crm-appointments"
                        className="tabular-nums transition hover:text-zinc-400 hover:underline"
                      >
                        {nextApptChip}
                      </a>
                    )}
                    {unpaidChip && (packageChip || nextApptChip) && (
                      <span className="text-zinc-700" aria-hidden>
                        ·
                      </span>
                    )}
                    {unpaidChip && (
                      <a
                        href="#crm-invoices"
                        className="font-medium tabular-nums text-amber-400/95 transition hover:underline"
                      >
                        {unpaidChip}
                      </a>
                    )}
                  </>
                )}
              </span>

              {goalsPreview && (
                <span className="line-clamp-1 max-w-2xl text-xs text-zinc-500">
                  <span className="text-zinc-600">Goals · </span>
                  {goalsPreview}
                </span>
              )}
            </span>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              {/* Floor ops: Resume / Start / Open — never Design here */}
              {!isInactive && startSlot
                ? startSlot
                : !isInactive && headerPrimaryLink ? (
                    <Link
                      href={headerPrimaryLink.href}
                      className={primaryCtaClass}
                      aria-label={headerPrimaryLink.label}
                    >
                      {headerPrimaryLink.label}
                    </Link>
                  ) : null}
              {!isInactive &&
                next.kind === "start_session" &&
                anyProgram && (
                  <Link
                    href={`/programs/${anyProgram.id}`}
                    className={ghostCtaClass}
                  >
                    Open program
                  </Link>
                )}
              {/* Single Deactivate for active roster — Reactivate lives in inactive banner */}
              {!isInactive && (
                <ClientDeactivateControl
                  clientId={client.id}
                  clientName={name}
                  status={client.status}
                  compact
                />
              )}
            </div>
          }
        />
      </div>

      {/* Up next — context only when there is something to surface */}
      {showUpNext && (
        <Card
          padding="sm"
          className={cn(
            liveSession
              ? "border-amber-900/40 bg-amber-950/15"
              : "border-zinc-800 bg-zinc-950/40"
          )}
        >
          <SectionLabel as="h2" className="mb-2">
            Up next
          </SectionLabel>
          <ul className="space-y-2">
            {liveSession && (
              <li>
                <ListRow
                  href={`/sessions/${liveSession.id}`}
                  tone="warn"
                  title={liveSession.title}
                  subtitle={
                    liveSession.updatedAt
                      ? `In progress · updated ${fmtWhen(liveSession.updatedAt)}`
                      : "In progress"
                  }
                  trailing={
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone="amber">Live</Badge>
                      <ChevronRight className="h-4 w-4 text-amber-500/80" />
                    </span>
                  }
                />
              </li>
            )}

            {injuriesText && (
              <li className="flex gap-2 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-100/90">
                <AlertTriangle
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400"
                  aria-hidden
                />
                <span className="min-w-0 break-words">
                  <span className="font-medium text-amber-200">Injuries · </span>
                  {client.injuries}
                </span>
              </li>
            )}

            {showUpNextOutcome && (
              <li className="px-0.5 text-xs text-zinc-400">
                <span className="text-zinc-600">Next · </span>
                {upNextOutcomeNode}
              </li>
            )}

            {gaps.length > 0 && (
              <li className="flex flex-wrap items-center gap-1.5 px-0.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
                  Still needed
                </span>
                {gaps.slice(0, 3).map((g) => (
                  <Link
                    key={g.key}
                    href={g.href}
                    className="inline-flex min-h-8 items-center rounded-full border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  >
                    {g.label}
                  </Link>
                ))}
              </li>
            )}
          </ul>
        </Card>
      )}

      {/* Floor work (P0): Active plan + Sessions — before Progress */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="active-plan" className="scroll-mt-client">
          <Card
            padding="sm"
            className={
              anyProgram?.status === "active"
                ? floorActiveHairline
                : floorElevated
            }
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <SectionLabel as="h2" className="mb-0">
                Active plan
              </SectionLabel>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/programs?client=${encodeURIComponent(client.id)}`}
                  className="text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                >
                  All
                </Link>
                {anyProgram && (
                  <Link
                    href={`/programs/new?client=${client.id}`}
                    className="text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                  >
                    + New
                  </Link>
                )}
              </div>
            </div>
            {!anyProgram ? (
              <EmptyState
                icon={<FileText className="h-5 w-5" />}
                title="No program yet"
                description="Build a plan from goals and available equipment."
                action={
                  <Link
                    href={`/programs/new?client=${client.id}`}
                    className={primaryCtaClass}
                    aria-label="Design program"
                  >
                    Design program
                  </Link>
                }
                className="py-5"
              />
            ) : (
              <div className="space-y-2">
                <ListRow
                  href={`/programs/${anyProgram.id}`}
                  tone={anyProgram.status === "active" ? "accent" : "default"}
                  leading={
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-semibold tabular-nums text-zinc-300">
                      {anyProgram.daysPerWeek ?? "—"}d
                    </span>
                  }
                  title={anyProgram.title}
                  subtitle={
                    metaJoin(
                      programSubtitle(anyProgram) || null,
                      firstDay ? `Start day · ${firstDay.name}` : null
                    ).join(" · ") || undefined
                  }
                  trailing={
                    <span className="inline-flex items-center gap-1.5">
                      <Badge
                        tone={
                          anyProgram.status === "active" ? "green" : "default"
                        }
                      >
                        {anyProgram.status}
                      </Badge>
                      <ChevronRight className="h-4 w-4 text-zinc-600" />
                    </span>
                  }
                />
                {otherPrograms.length > 0 && (
                  <Link
                    href={`/programs?client=${encodeURIComponent(client.id)}`}
                    className="block px-1 text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                  >
                    +{otherPrograms.length} other program
                    {otherPrograms.length === 1 ? "" : "s"}
                  </Link>
                )}
              </div>
            )}
          </Card>
        </div>

        <Card
          padding="sm"
          className={liveSession ? floorActiveHairline : floorElevated}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionLabel as="h2" className="mb-0">
              Sessions
            </SectionLabel>
            <Link
              href={`/sessions?client=${encodeURIComponent(client.id)}`}
              className="text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
            >
              All
            </Link>
          </div>
          {clientSessions.length === 0 ? (
            <EmptyState
              icon={<FileText className="h-5 w-5" />}
              title="No sessions yet"
              description={
                anyProgram
                  ? "Start a day from the active program."
                  : "Design a program under Active plan, then start a day."
              }
              action={
                !anyProgram ? (
                  <Link href="#active-plan" className={ghostCtaClass}>
                    Active plan
                  </Link>
                ) : undefined
              }
              className="py-5"
            />
          ) : (
            <div className="grid gap-2">
              {sessionsShown.map((s) => {
                const when =
                  s.performedAt
                    ? fmtWhen(s.performedAt)
                    : s.updatedAt
                      ? fmtWhen(s.updatedAt)
                      : null;
                const subtitle = metaJoin(
                  when,
                  s.durationMin != null ? `${s.durationMin} min` : null,
                  s.overallRpe ? `RPE ${s.overallRpe}` : null
                ).join(" · ");
                // Live sessions: open to resume (no delete on profile strip)
                if (s.status === "in_progress") {
                  return (
                    <ListRow
                      key={s.id}
                      href={`/sessions/${s.id}`}
                      tone="warn"
                      title={s.title}
                      subtitle={subtitle || undefined}
                      trailing={
                        <span className="inline-flex items-center gap-1.5">
                          <Badge tone="amber">in progress</Badge>
                          <ChevronRight className="h-4 w-4 text-zinc-600" />
                        </span>
                      }
                    />
                  );
                }
                return (
                  <SessionHistoryRow
                    key={s.id}
                    id={s.id}
                    title={s.title}
                    status={s.status}
                    subtitle={subtitle || undefined}
                    showStatusBadge={s.status === "cancelled"}
                  />
                );
              })}
              {sessionsOverflow > 0 && (
                <Link
                  href={`/sessions?client=${encodeURIComponent(client.id)}`}
                  className="px-1 text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                >
                  +{sessionsOverflow} more
                </Link>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Relationship diary — sessions + bookings + tasks + check-ins */}
      <Card padding="sm" className="border-zinc-800/80">
        <ClientTimeline items={timelineItems} clientId={client.id} />
      </Card>

      {/* CRM spine — packages, calendar, check-ins (after floor work) */}
      <div id="crm" className="scroll-mt-client">
        <ClientCrmPanel
          clientId={client.id}
          clientName={name}
          initialStatus={client.status}
          snapshot={crm}
        />
      </div>

      {/* Progress = proof (after work) */}
      {progress && (
        <ClientProgressDashboard
          data={progress}
          clientId={client.id}
          hideRecentSessions
          hideWeeklyVolume
          collapseSecondaryOnMobile
          bodyMetricsExtra={
            <QuickAddMeasurement
              clientId={client.id}
              prefill={
                measurements[0]?.heightCm != null
                  ? { heightCm: measurements[0].heightCm }
                  : null
              }
            />
          }
        />
      )}

      {/* Context paper — quieter Goals / Notes tier */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div id="goals-constraints" className="scroll-mt-client">
          <Card
            padding="sm"
            className="border-zinc-800/60 bg-zinc-950/50"
          >
            <div className="mb-3 flex items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-emerald-500/80" />
              <SectionLabel as="h2" className="mb-0">
                Goals & constraints
              </SectionLabel>
            </div>
            <dl className="space-y-3">
              {hasGoals && <Field label="Goals" value={client.goals} />}
              {hasExperience && (
                <Field label="Experience" value={client.experienceLevel} />
              )}
              {!hasGoals && !hasExperience && (
                <p className="text-xs text-zinc-600">
                  No goals on file yet.
                </p>
              )}
              {injuriesText && (
                <Field label="Injuries" value={client.injuries} tone="warn" />
              )}
              {contraindicationsText && (
                <Field
                  label="Contraindications"
                  value={client.contraindications}
                  tone="warn"
                />
              )}
              {!hasRisk && (
                <p className="text-xs text-zinc-600">
                  No injuries or contraindications on file
                </p>
              )}
              {secondaryLifestyle.map((f) => (
                <Field key={f.label} label={f.label} value={f.value} />
              ))}
            </dl>
          </Card>
        </div>

        <Card padding="sm" className="border-zinc-800/60 bg-zinc-950/50">
          <div className="mb-3 flex items-center justify-between gap-2">
            <SectionLabel as="h2" className="mb-0">
              Notes & recommendations
            </SectionLabel>
            <Link
              href={`/?client=${client.id}`}
              className="text-xs font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
            >
              Ask coach →
            </Link>
          </div>
          {/* Session auto-logs use kind "session" — live in Sessions, not here */}
          {(() => {
            const coachNotes = notes.filter((n) => {
              const k = (n.kind || "note").toLowerCase();
              return k !== "session";
            });
            const kindLabel = (k: string) => {
              if (k === "ai_solution") return "Coach";
              if (k === "recommendation") return "Rec";
              if (k === "check_in") return "Check-in";
              return k.replaceAll("_", " ");
            };
            if (coachNotes.length === 0) {
              return (
                <EmptyState
                  icon={<NotebookPen className="h-5 w-5" />}
                  title="No coach notes yet"
                  description="Save recommendations from Coach. Completed sessions stay under Sessions — not mixed in here."
                  action={
                    <Link
                      href={`/?client=${client.id}`}
                      className={ghostCtaClass}
                    >
                      Open floor workspace
                    </Link>
                  }
                  className="py-5"
                />
              );
            }
            return (
              <ul className="space-y-2">
                {coachNotes.slice(0, 5).map((n) => (
                  <li
                    key={n.id}
                    className="rounded-lg border border-zinc-800/60 bg-zinc-950/40 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {n.title || kindLabel(n.kind)}
                      </span>
                      <Badge className="capitalize">
                        {kindLabel(n.kind)}
                      </Badge>
                      {n.createdAt && (
                        <span className="text-[10px] tabular-nums text-zinc-600">
                          {fmtDay(n.createdAt)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-zinc-400">
                      {n.body}
                    </p>
                  </li>
                ))}
                {coachNotes.length > 5 && (
                  <li className="text-[11px] text-zinc-600">
                    +{coachNotes.length - 5} older notes
                  </li>
                )}
              </ul>
            );
          })()}
        </Card>
      </div>
    </PageShell>
  );
}
