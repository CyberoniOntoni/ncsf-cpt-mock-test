import type { ReactNode } from "react";
import Link from "next/link";
import type { ClientProgressData } from "@/app/actions/progress";
import { getFieldDef } from "@/lib/measurements";
import { cn } from "@/lib/utils";
import { Badge, Card, EmptyState, SectionLabel } from "./ui";
import { BarChart, Sparkline } from "./sparkline";
import {
  Activity,
  ClipboardList,
  Dumbbell,
  Scale,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";

const trendTone = {
  improved: "green" as const,
  declined: "red" as const,
  mixed: "amber" as const,
  same: "default" as const,
  "n/a": "default" as const,
};

const trendLabel: Record<string, string> = {
  improved: "Improved",
  declined: "Declined",
  mixed: "Mixed",
  same: "Unchanged",
  "n/a": "Baseline only",
};

function fmtNum(n: number | null | undefined, digits = 1): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function fmtVolume(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}t`;
  return `${Math.round(kg)} kg`;
}

function Delta({
  delta,
  unit,
  invert = false,
}: {
  delta: number | null;
  unit: string;
  /** When true, decrease is “good” (e.g. body fat, waist) */
  invert?: boolean;
}) {
  if (delta == null || delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-zinc-500">
        <Minus className="h-3 w-3" aria-hidden />
        No change
      </span>
    );
  }
  const good = invert ? delta < 0 : delta > 0;
  const Icon = delta > 0 ? TrendingUp : TrendingDown;
  const color = good ? "text-emerald-400" : "text-red-400";
  const sign = delta > 0 ? "+" : "";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${color}`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {sign}
      {fmtNum(delta)}
      {unit}
    </span>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon,
  empty = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2 sm:px-3 sm:py-2.5">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        <span className="text-zinc-500" aria-hidden>
          {icon}
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={
          empty
            ? "mt-0.5 text-lg font-medium tabular-nums tracking-tight text-zinc-600 sm:text-xl"
            : "mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-zinc-50 sm:text-xl"
        }
      >
        {value}
      </div>
      {hint && (
        <div className="mt-0.5 truncate text-[11px] text-zinc-500">{hint}</div>
      )}
    </div>
  );
}

function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
      {children}
    </div>
  );
}

export function ClientProgressDashboard({
  data,
  clientId: clientIdProp,
  hideRecentSessions = false,
  /** Slot under Body metrics — e.g. Add measurement */
  bodyMetricsExtra,
  /**
   * When true, keep KPI + body metrics always visible; wrap secondary blocks
   * in a mobile-only `<details>`. Desktop still shows the full stack.
   */
  collapseSecondaryOnMobile = false,
  /** Omit large weekly volume panel when shown next to client name instead. */
  hideWeeklyVolume = false,
}: {
  data: ClientProgressData;
  /** Optional override for links; falls back to `data.clientId`. */
  clientId?: string;
  /**
   * When true, omit the recent-sessions list (client profile already has a
   * Sessions section — avoid two session timelines on one page).
   */
  hideRecentSessions?: boolean;
  bodyMetricsExtra?: ReactNode;
  collapseSecondaryOnMobile?: boolean;
  hideWeeklyVolume?: boolean;
}) {
  const clientId = clientIdProp ?? data.clientId;
  const sessionsHref = clientId
    ? `/sessions?client=${encodeURIComponent(clientId)}`
    : "/sessions";
  const assessmentsHref = clientId
    ? `/clients/${clientId}/assessments`
    : undefined;

  const { stats, metrics, assessments, weeklyVolume, sessionVolumes, exerciseBests } =
    data;

  const weight = metrics.find((m) => m.key === "weightKg");
  const bodyFat = metrics.find((m) => m.key === "bodyFatPct");
  const waist = metrics.find((m) => m.key === "waistCm");

  const weekValues = weeklyVolume.map((w) => w.volumeKg);
  const weekLabels = weeklyVolume.map((w) => w.label);
  const hasAny =
    stats.sessionsTotal > 0 ||
    metrics.length > 0 ||
    assessments.length > 0;

  // Profile embeds measurement UI even when empty — never collapse to a dead-end card
  const showFull =
    hasAny || bodyMetricsExtra != null || hideRecentSessions;

  if (!showFull) {
    return (
      <div id="progress" className="scroll-mt-20">
        <Card padding="sm">
          <SectionLabel as="h2" className="mb-2">
            Progress
          </SectionLabel>
          <EmptyState
            icon={<Activity className="h-5 w-5" />}
            title="No progress data yet"
            description="Complete sessions, log measurements, and re-test screens — trends will appear here."
            className="py-6"
          />
        </Card>
      </div>
    );
  }

  const recentSessions = [...sessionVolumes].reverse().slice(0, 6);
  const hasWeight = weight?.latest != null;
  const hasScreenTrends = stats.screensWithRetest > 0;
  const hasVolume30 = stats.volumeLast30Kg > 0;

  const bodyMetricsBlock = (
    <div
      id="body-metrics"
      className="flex min-h-0 min-w-0 flex-col scroll-mt-client space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5"
    >
      <SubLabel>Body metrics</SubLabel>
      {metrics.length === 0 ? (
        <p className="text-[11px] leading-snug text-zinc-500">
          {bodyMetricsExtra
            ? "No readings yet — add weight below."
            : "No measurements yet."}
        </p>
      ) : (
        <ul className="max-h-44 space-y-1.5 overflow-y-auto pr-0.5">
          {metrics.map((m) => {
            const invert = !!getFieldDef(m.key)?.invertDelta;
            const good =
              (m.delta ?? 0) === 0
                ? null
                : invert
                  ? (m.delta ?? 0) < 0
                  : (m.delta ?? 0) > 0;
            return (
              <li
                key={m.key}
                className="flex min-w-0 items-center justify-between gap-1.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                    <span className="truncate text-xs font-medium text-zinc-200">
                      {m.label}
                    </span>
                    <span className="text-xs tabular-nums text-zinc-100">
                      {fmtNum(m.latest)}
                      <span className="text-zinc-500"> {m.unit}</span>
                    </span>
                    <Delta
                      delta={m.delta}
                      unit={` ${m.unit}`}
                      invert={invert}
                    />
                  </div>
                  <div className="text-[10px] tabular-nums text-zinc-600">
                    {m.points.length}× · first {fmtNum(m.first)}
                  </div>
                </div>
                <Sparkline
                  values={m.points.map((p) => p.value)}
                  width={56}
                  height={24}
                  className="shrink-0"
                  stroke={
                    good === true
                      ? "#34d399"
                      : good === false
                        ? "#f87171"
                        : "#a1a1aa"
                  }
                />
              </li>
            );
          })}
        </ul>
      )}
      {bodyMetricsExtra && (
        <div className="mt-auto space-y-1.5 border-t border-zinc-800/80 pt-2">
          {bodyMetricsExtra}
        </div>
      )}
    </div>
  );

  function weeklyVolumeBlock() {
    return (
      <div className="min-w-0 space-y-2.5 rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <SubLabel>Weekly training volume</SubLabel>
          <span className="shrink-0 text-[10px] text-zinc-600">
            last 8 weeks
          </span>
        </div>
        {weekValues.every((v) => v === 0) ? (
          <p className="text-sm text-zinc-500">
            Complete sessions with weights to track volume (sets × reps × kg).
          </p>
        ) : (
          <>
            <div className="w-full min-w-0 overflow-x-auto">
              <div className="min-w-[240px]">
                <BarChart
                  values={weekValues}
                  labels={weekLabels}
                  height={112}
                  width={320}
                  className="max-w-full"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
              {weeklyVolume
                .filter((w) => w.sessions > 0)
                .slice(-4)
                .map((w) => (
                  <span key={w.weekStart} className="tabular-nums">
                    W/o {w.label}:{" "}
                    <span className="text-zinc-300">
                      {fmtVolume(w.volumeKg)}
                    </span>{" "}
                    · {w.sessions} sess.
                  </span>
                ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function movementScreensBlock(opts?: { anchorId?: boolean }) {
    return (
      <div
        id={opts?.anchorId === false ? undefined : "movement-screens"}
        className="flex min-h-0 min-w-0 flex-col scroll-mt-client space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5"
      >
        <div className="flex flex-wrap items-center justify-between gap-1">
          <SubLabel>Screens</SubLabel>
          {assessmentsHref && (
            <Link
              href={assessmentsHref}
              className="shrink-0 text-[10px] font-medium text-zinc-500 transition hover:text-emerald-400 hover:underline"
            >
              {assessments.length === 0 ? "Run →" : "Re-test →"}
            </Link>
          )}
        </div>
        {assessments.length === 0 ? (
          <p className="text-[11px] leading-snug text-zinc-500">
            No screens yet.
            {assessmentsHref && (
              <>
                {" "}
                <Link
                  href={assessmentsHref}
                  className="font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
                >
                  Open
                </Link>
              </>
            )}
          </p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
            {assessments.map((a) => {
              const deltaBits = a.deltas
                .filter((d) => d.change !== "same" && d.change !== "unknown")
                .slice(0, 2);
              return (
                <li
                  key={a.templateId}
                  className="rounded-md border border-zinc-800/70 bg-zinc-950/50 px-2 py-1.5"
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-zinc-200">
                        {a.name}
                      </div>
                      <div className="text-[10px] tabular-nums text-zinc-600">
                        {a.timesTested}×
                        {a.latestAt ? ` · ${a.latestAt}` : ""}
                      </div>
                    </div>
                    <Badge
                      tone={trendTone[a.trend]}
                      className="shrink-0 whitespace-nowrap text-[10px]"
                    >
                      {trendLabel[a.trend]}
                    </Badge>
                  </div>
                  {deltaBits.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-0.5">
                      {deltaBits.map((d) => (
                        <span
                          key={d.key}
                          className={
                            d.change === "improved"
                              ? "rounded bg-emerald-950/40 px-1 py-px text-[9px] font-medium text-emerald-300"
                              : d.change === "declined"
                                ? "rounded bg-red-950/40 px-1 py-px text-[9px] font-medium text-red-300"
                                : "rounded bg-zinc-800/80 px-1 py-px text-[9px] text-zinc-400"
                          }
                        >
                          {d.label}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  function bestLoadsBlock() {
    return (
      <div className="flex min-h-0 min-w-0 flex-col space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5">
        <SubLabel>Best loads</SubLabel>
        {exerciseBests.length === 0 ? (
          <p className="text-[11px] leading-snug text-zinc-500">
            Log session weights to surface top sets.
          </p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
            {exerciseBests.slice(0, 8).map((ex) => (
              <li
                key={ex.exerciseName}
                className="flex items-center justify-between gap-1.5 rounded-md border border-zinc-800/70 bg-zinc-950/50 px-2 py-1.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-zinc-200">
                    {ex.exerciseName}
                  </div>
                  <div className="text-[10px] tabular-nums text-zinc-600">
                    {ex.timesLogged}×
                    {ex.lastSeenAt ? ` · ${ex.lastSeenAt}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-semibold tabular-nums text-zinc-100">
                    {fmtNum(ex.bestWeightKg, 1)}
                    <span className="text-[10px] font-medium text-zinc-500">
                      {" "}
                      kg
                    </span>
                  </div>
                  {ex.bestReps && (
                    <div className="text-[10px] tabular-nums text-zinc-500">
                      ×{ex.bestReps}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  function recentSessionsBlock() {
    if (hideRecentSessions) return null;
    return (
      <div className="min-w-0 space-y-1.5 rounded-lg border border-zinc-800/80 bg-zinc-950/40 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <SubLabel>Recent sessions</SubLabel>
          <Link
            href={sessionsHref}
            className="shrink-0 text-[10px] font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
          >
            All →
          </Link>
        </div>
        {recentSessions.length === 0 ? (
          <p className="text-[11px] text-zinc-500">No sessions yet.</p>
        ) : (
          <ul className="max-h-44 space-y-1 overflow-y-auto">
            {recentSessions.map((s) => (
              <li key={s.sessionId}>
                <Link
                  href={`/sessions/${s.sessionId}`}
                  className="flex items-center justify-between gap-1.5 rounded-md border border-zinc-800/70 bg-zinc-950/50 px-2 py-1.5 text-xs transition hover:border-zinc-700"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-zinc-200">
                      {s.title}
                    </div>
                    <div className="text-[10px] tabular-nums text-zinc-600">
                      {s.label}
                      {s.durationMin != null ? ` · ${s.durationMin}m` : ""}
                    </div>
                  </div>
                  {(s.status === "in_progress" ||
                    s.status === "cancelled") && (
                    <Badge
                      tone={s.status === "cancelled" ? "red" : "amber"}
                      className="shrink-0 text-[10px]"
                    >
                      {s.status.replace("_", " ")}
                    </Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /**
   * Compact horizontal trio: metrics | loads | screens.
   * Optional volume / recent sessions stack below when shown.
   */
  function progressDetailsGrid(opts?: { includeScreenAnchor?: boolean }) {
    return (
      <div className="space-y-2.5">
        <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 lg:items-stretch">
          {bodyMetricsBlock}
          {bestLoadsBlock()}
          {movementScreensBlock({
            anchorId: opts?.includeScreenAnchor !== false,
          })}
        </div>
        {!hideWeeklyVolume && weeklyVolumeBlock()}
        {recentSessionsBlock()}
      </div>
    );
  }

  return (
    <div id="progress" className="scroll-mt-20">
      <Card padding="sm" className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <SectionLabel as="h2" className="mb-0">
              Progress
            </SectionLabel>
            <p className="mt-0.5 text-xs text-zinc-500">
              Metrics · loads · screens
              {!hideWeeklyVolume ? " · volume" : ""}
            </p>
          </div>
          {stats.lastSessionAt && (
            <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
              Last session{" "}
              {new Date(stats.lastSessionAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
        </div>

        {/* Dense KPI strip — always visible */}
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 sm:gap-2">
          <StatCard
            label="Sessions (30d)"
            value={String(stats.sessionsLast30)}
            hint={`${stats.sessionsCompleted} completed total`}
            icon={<Activity className="h-3 w-3" />}
            empty={stats.sessionsLast30 === 0}
          />
          <StatCard
            label="Volume (30d)"
            value={hasVolume30 ? fmtVolume(stats.volumeLast30Kg) : "—"}
            hint={
              stats.volumeAllKg
                ? `${fmtVolume(stats.volumeAllKg)} all time`
                : "From logged sets"
            }
            icon={<Dumbbell className="h-3 w-3" />}
            empty={!hasVolume30}
          />
          <StatCard
            label="Body weight"
            value={hasWeight ? `${fmtNum(weight!.latest)} kg` : "—"}
            hint={
              weight?.delta != null
                ? `${weight.delta > 0 ? "+" : ""}${fmtNum(weight.delta)} kg vs first`
                : bodyMetricsExtra
                  ? "Log below"
                  : "Add measurements"
            }
            icon={<Scale className="h-3 w-3" />}
            empty={!hasWeight}
          />
          <StatCard
            label="Screen trends"
            value={
              hasScreenTrends
                ? `${stats.screensImproved}↑ ${stats.screensDeclined}↓`
                : "—"
            }
            hint={
              hasScreenTrends
                ? `${stats.screensWithRetest} re-tested`
                : assessmentsHref
                  ? "Re-test to compare"
                  : "No screens yet"
            }
            icon={<ClipboardList className="h-3 w-3" />}
            empty={!hasScreenTrends}
          />
        </div>

        {/* Compact trio: body metrics | best loads | screens (horizontal from sm/lg) */}
        {collapseSecondaryOnMobile ? (
          <>
            <div className="hidden md:block">
              {progressDetailsGrid({ includeScreenAnchor: true })}
            </div>
            {/* Mobile: metrics first, then loads+screens side by side */}
            <div className="space-y-2 md:hidden">
              {bodyMetricsBlock}
              <div className="grid grid-cols-2 gap-2">
                {bestLoadsBlock()}
                {movementScreensBlock({ anchorId: true })}
              </div>
              {!hideWeeklyVolume && weeklyVolumeBlock()}
              {recentSessionsBlock()}
            </div>
          </>
        ) : (
          progressDetailsGrid({ includeScreenAnchor: true })
        )}
      </Card>
    </div>
  );
}
