"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  listCalendarAppointmentsAction,
  type CalendarAppointmentItem,
} from "@/app/actions/crm";
import {
  WEEKDAY_LABELS,
  bookAtLocalFromDateKey,
  buildMonthGrid,
  monthGridRange,
  monthTitle,
  parseLocalDateKey,
  shiftMonth,
  toLocalDateKey,
} from "@/lib/calendar-grid";
import {
  getStoredActiveClient,
  setStoredActiveClient,
  subscribeActiveClient,
} from "@/lib/active-client";
import { cn } from "@/lib/utils";
import { StartFromAppointmentButton } from "./start-from-appointment-button";
import { Badge, Button, Skeleton } from "./ui";

function groupByDateKey(
  items: CalendarAppointmentItem[]
): Map<string, CalendarAppointmentItem[]> {
  const map = new Map<string, CalendarAppointmentItem[]>();
  for (const item of items) {
    const starts = new Date(item.startsAt);
    if (!Number.isFinite(starts.getTime())) continue;
    const key = toLocalDateKey(starts);
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  // Prefer live bookings first within each day
  for (const [, list] of map) {
    list.sort((a, b) => {
      const rank = (s: string) =>
        s === "scheduled" ? 0 : s === "completed" ? 1 : 2;
      const dr = rank(a.status) - rank(b.status);
      if (dr !== 0) return dr;
      return (
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
      );
    });
  }
  return map;
}

function formatTime(d: Date | string) {
  try {
    return new Date(d).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function statusTone(
  status: string
): "default" | "green" | "amber" | "red" {
  if (status === "scheduled") return "green";
  if (status === "completed") return "default";
  if (status === "cancelled" || status === "no_show") return "red";
  return "amber";
}

function statusLabel(status: string) {
  if (status === "no_show") return "No-show";
  return status.replaceAll("_", " ");
}

function firstName(full: string) {
  const t = full.trim();
  if (!t) return "Client";
  return t.split(/\s+/)[0] ?? t;
}

export function CalendarMonth() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [items, setItems] = useState<CalendarAppointmentItem[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    toLocalDateKey(now)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [loaded, setLoaded] = useState(false);
  const [stickyClientId, setStickyClientId] = useState<string | null>(null);
  const [stickyClientName, setStickyClientName] = useState<string | null>(null);
  const loadGen = useRef(0);
  const dayPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const sync = () => {
      const c = getStoredActiveClient();
      setStickyClientId(c?.id ?? null);
      setStickyClientName(c?.name ?? null);
    };
    sync();
    return subscribeActiveClient(sync);
  }, []);

  const load = useCallback((y: number, m: number) => {
    const { rangeStart, rangeEnd } = monthGridRange(y, m);
    const gen = ++loadGen.current;
    startTransition(async () => {
      setError(null);
      try {
        const rows = await listCalendarAppointmentsAction(
          rangeStart.toISOString(),
          rangeEnd.toISOString()
        );
        if (gen !== loadGen.current) return; // stale month response
        setItems(rows);
        setLoaded(true);
      } catch (e) {
        if (gen !== loadGen.current) return;
        setError(e instanceof Error ? e.message : "Failed to load calendar");
        setLoaded(true);
      }
    });
  }, []);

  useEffect(() => {
    load(year, month);
  }, [year, month, load]);

  const byDay = useMemo(() => groupByDateKey(items), [items]);
  const cells = useMemo(() => buildMonthGrid(year, month), [year, month]);

  const selectedItems = selectedKey ? byDay.get(selectedKey) ?? [] : [];

  const monthScheduledCount = useMemo(() => {
    let n = 0;
    for (const a of items) {
      if (a.status !== "scheduled") continue;
      const d = new Date(a.startsAt);
      if (
        Number.isFinite(d.getTime()) &&
        d.getFullYear() === year &&
        d.getMonth() + 1 === month
      ) {
        n += 1;
      }
    }
    return n;
  }, [items, year, month]);

  const selectDay = useCallback(
    (dateKey: string, cellMonth?: number, cellYear?: number) => {
      // Outside-month cells jump the focused month for easier browsing
      if (
        cellMonth != null &&
        cellYear != null &&
        (cellMonth !== month || cellYear !== year)
      ) {
        setYear(cellYear);
        setMonth(cellMonth);
      }
      setSelectedKey(dateKey);
      // On narrow screens, bring the day list into view
      if (typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches) {
        requestAnimationFrame(() => {
          dayPanelRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
          });
        });
      }
    },
    [month, year]
  );

  const go = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  };

  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
    setSelectedKey(toLocalDateKey(t));
  };

  const bookHref =
    stickyClientId && selectedKey
      ? `/clients/${stickyClientId}?bookAt=${encodeURIComponent(bookAtLocalFromDateKey(selectedKey))}#crm-appointments`
      : stickyClientId
        ? `/clients/${stickyClientId}#crm-appointments`
        : "/clients";

  const bookLabel = stickyClientName
    ? `Book · ${firstName(stickyClientName)}`
    : "Book";

  return (
    <div className="flex flex-col gap-4">
      {/* Month chrome */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 shrink-0 px-2"
            onClick={() => go(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>
          <div className="min-w-0 text-center sm:min-w-[11rem]">
            <h2 className="truncate text-base font-semibold tracking-tight text-zinc-50 sm:text-lg">
              {monthTitle(year, month)}
            </h2>
            {loaded && (
              <p className="text-[11px] tabular-nums text-zinc-500">
                {monthScheduledCount === 0
                  ? "No scheduled sessions"
                  : `${monthScheduledCount} scheduled`}
              </p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 min-w-11 shrink-0 px-2"
            onClick={() => go(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={goToday}>
            Today
          </Button>
          {stickyClientId ? (
            <Link
              href={bookHref}
              title={
                stickyClientName
                  ? `Book for ${stickyClientName}`
                  : "Book appointment"
              }
              onClick={() =>
                setStoredActiveClient(stickyClientId, stickyClientName ?? null)
              }
              className="inline-flex min-h-11 max-w-[12rem] items-center justify-center gap-1.5 truncate rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm shadow-emerald-950/40 transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70 sm:max-w-[16rem]"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{bookLabel}</span>
            </Link>
          ) : (
            <Link
              href="/clients"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70"
            >
              Pick client to book
            </Link>
          )}
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          <p className="min-w-0">{error}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11 shrink-0"
            onClick={() => load(year, month)}
          >
            Retry
          </Button>
        </div>
      )}

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1" aria-hidden>
        {WEEKDAY_LABELS.map((d) => (
          <div
            key={d}
            className="px-0.5 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:px-1"
          >
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {!loaded ? (
        <Skeleton className="h-72 w-full rounded-xl" />
      ) : (
        <div
          className={cn(
            "grid grid-cols-7 gap-0.5 sm:gap-1",
            pending && "opacity-70 transition-opacity"
          )}
          role="grid"
          aria-label={`${monthTitle(year, month)} calendar`}
          aria-busy={pending}
        >
          {cells.map((cell) => {
            const dayItems = byDay.get(cell.dateKey) ?? [];
            const scheduledN = dayItems.filter(
              (a) => a.status === "scheduled"
            ).length;
            const count = dayItems.length;
            const selected = selectedKey === cell.dateKey;
            return (
              <button
                key={cell.dateKey}
                type="button"
                role="gridcell"
                aria-selected={selected}
                aria-current={cell.isToday ? "date" : undefined}
                aria-label={`${(parseLocalDateKey(cell.dateKey) ?? new Date()).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}${
                  count
                    ? `, ${count} appointment${count === 1 ? "" : "s"}`
                    : ", no appointments"
                }`}
                onClick={() => selectDay(cell.dateKey, cell.month, cell.year)}
                className={cn(
                  "flex min-h-11 flex-col rounded-md border p-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:min-h-[5.5rem] sm:rounded-lg sm:p-2",
                  cell.outside
                    ? "border-zinc-900/80 bg-zinc-950/40 text-zinc-600"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-100 hover:border-zinc-700",
                  cell.isToday &&
                    !selected &&
                    "border-emerald-800/60 ring-1 ring-emerald-700/40",
                  selected &&
                    "border-emerald-600/70 bg-emerald-950/25 ring-1 ring-emerald-600/50"
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-medium tabular-nums sm:text-xs",
                    cell.isToday && "text-emerald-400",
                    cell.outside && "text-zinc-600"
                  )}
                >
                  {cell.day}
                </span>

                {/* Mobile: dots only */}
                {count > 0 && (
                  <div
                    className="mt-auto flex items-center justify-center gap-0.5 pt-0.5 sm:hidden"
                    aria-hidden
                  >
                    {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          i < scheduledN
                            ? "bg-emerald-400"
                            : "bg-zinc-600"
                        )}
                      />
                    ))}
                  </div>
                )}

                {/* sm+: event chips */}
                {count > 0 && (
                  <div className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                    {dayItems.slice(0, 2).map((a) => (
                      <span
                        key={a.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                          a.status === "scheduled"
                            ? "bg-emerald-950/50 text-emerald-200/90"
                            : a.status === "cancelled" ||
                                a.status === "no_show"
                              ? "bg-red-950/40 text-red-200/80"
                              : "bg-zinc-800/80 text-zinc-300"
                        )}
                      >
                        <span className="tabular-nums opacity-80">
                          {formatTime(a.startsAt)}
                        </span>{" "}
                        {firstName(a.clientName)}
                      </span>
                    ))}
                    {count > 2 && (
                      <span className="px-1 text-[10px] text-zinc-500">
                        +{count - 2} more
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Selected day detail */}
      <section
        ref={dayPanelRef}
        id="calendar-day"
        tabIndex={-1}
        aria-label={
          selectedKey ? `Appointments on ${selectedKey}` : "Day detail"
        }
        className="scroll-mt-24 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 sm:p-4 md:scroll-mt-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">
            {selectedKey
              ? (
                  parseLocalDateKey(selectedKey) ?? new Date()
                ).toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Select a day"}
          </h3>
          {selectedKey && stickyClientId && (
            <Link
              href={bookHref}
              className="inline-flex min-h-11 items-center text-xs font-medium text-emerald-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded-sm"
              onClick={() =>
                setStoredActiveClient(stickyClientId, stickyClientName ?? null)
              }
            >
              Book this day →
            </Link>
          )}
        </div>

        {!selectedKey ? (
          <p className="mt-2 text-sm text-zinc-500">Tap a day on the grid.</p>
        ) : selectedItems.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">
            No appointments.
            {stickyClientId
              ? " Use Book to schedule for the sticky client."
              : " Set a sticky client from Today or People, then book."}
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {selectedItems.map((a) => (
              <li
                key={a.id}
                className={cn(
                  "flex flex-col gap-2 rounded-lg border bg-zinc-950/50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between",
                  a.status === "scheduled"
                    ? "border-zinc-800"
                    : "border-zinc-800/80 opacity-80"
                )}
              >
                <Link
                  href={`/clients/${a.clientId}#crm-appointments`}
                  onClick={() =>
                    setStoredActiveClient(a.clientId, a.clientName)
                  }
                  className="min-w-0 flex-1 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <p className="truncate text-sm font-medium text-zinc-100">
                    {a.clientName}
                  </p>
                  <p className="text-xs text-zinc-400">
                    <span className="tabular-nums">
                      {formatTime(a.startsAt)}
                    </span>
                    {" · "}
                    {a.title}
                  </p>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(a.status)}>
                    {statusLabel(a.status)}
                  </Badge>
                  {a.status === "scheduled" && (
                    <StartFromAppointmentButton
                      appointmentId={a.id}
                      clientId={a.clientId}
                      clientName={a.clientName}
                      hasLinkedSession={!!a.sessionId}
                      className="min-h-11"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
