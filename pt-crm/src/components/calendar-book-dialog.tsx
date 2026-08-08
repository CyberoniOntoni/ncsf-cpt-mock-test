"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { X } from "lucide-react";
import {
  createBookingWithBillingAction,
  getClientBookContextAction,
} from "@/app/actions/crm";
import { searchClientsAction } from "@/app/actions/clients";
import { bookAtLocalFromDateKey, parseLocalDateKey } from "@/lib/calendar-grid";
import { setStoredActiveClient } from "@/lib/active-client";
import {
  formatMoney,
  parseMoneyToCents,
  sanitizeMoneyInput,
} from "@/lib/money";
import { cn, fullName } from "@/lib/utils";
import { Button, Input, Label } from "./ui";

const SESSION_TYPES = [
  "Training session",
  "Assessment",
  "Check-in",
  "Single session",
] as const;

const DURATIONS = [30, 45, 60, 90] as const;
const AMOUNT_PRESETS = ["60", "80", "100", "120", "150", "200"] as const;

type BillingMode = "pack" | "invoice" | "none";

type ClientOption = {
  id: string;
  firstName: string;
  lastName: string;
  status: string;
};

type PackInfo = {
  id: string;
  name: string;
  remaining: number;
  total: number;
};

function timeFromBookAt(bookAt: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(bookAt);
  if (!m) return "09:00";
  return `${m[1]}:${m[2]}`;
}

function combineDateAndTime(dateKey: string, time: string): string {
  const t = time.trim() || "09:00";
  const [hh, mm] = t.split(":").map((x) => Number(x));
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
    return bookAtLocalFromDateKey(dateKey);
  }
  const d = parseLocalDateKey(dateKey);
  if (!d) return bookAtLocalFromDateKey(dateKey);
  d.setHours(hh, mm, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function readLastAmount(): string {
  if (typeof window === "undefined") return "100";
  try {
    return window.localStorage.getItem("floorscribe_last_session_amount") || "100";
  } catch {
    return "100";
  }
}

function writeLastAmount(amount: string) {
  try {
    window.localStorage.setItem("floorscribe_last_session_amount", amount);
  } catch {
    /* ignore */
  }
}

export function CalendarBookDialog({
  open,
  dateKey,
  initialClientId,
  initialClientName,
  onClose,
  onBooked,
}: {
  open: boolean;
  dateKey: string;
  initialClientId?: string | null;
  initialClientName?: string | null;
  onClose: () => void;
  onBooked: (summary?: string) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [clientId, setClientId] = useState(initialClientId || "");
  const [clientLabel, setClientLabel] = useState(initialClientName || "");
  const [clientQuery, setClientQuery] = useState("");
  const [clientHits, setClientHits] = useState<ClientOption[]>([]);
  const [clientOpen, setClientOpen] = useState(false);
  const [pack, setPack] = useState<PackInfo | null>(null);
  const [packLoading, setPackLoading] = useState(false);

  const [time, setTime] = useState(() =>
    timeFromBookAt(bookAtLocalFromDateKey(dateKey))
  );
  const [duration, setDuration] = useState(60);
  const [sessionType, setSessionType] = useState<string>("Training session");
  const [customTitle, setCustomTitle] = useState("");

  const [billingMode, setBillingMode] = useState<BillingMode>("invoice");
  const [amount, setAmount] = useState("100");
  const [markPaid, setMarkPaid] = useState(false);

  const dayLabel = useMemo(() => {
    const d = parseLocalDateKey(dateKey);
    if (!d) return dateKey;
    return d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [dateKey]);

  const titlePresets = useMemo(() => {
    const base = [...SESSION_TYPES];
    if (pack?.name && !base.includes(pack.name as (typeof SESSION_TYPES)[number])) {
      return [pack.name, ...base];
    }
    return base;
  }, [pack?.name]);

  const amountPreview = useMemo(() => {
    try {
      if (!amount.trim()) return null;
      return formatMoney(parseMoneyToCents(amount), "SGD", { compact: true });
    } catch {
      return null;
    }
  }, [amount]);

  const hasPackCredit = !!pack && pack.remaining > 0;

  const resetForOpen = useCallback(() => {
    setError(null);
    setClientId(initialClientId || "");
    setClientLabel(initialClientName || "");
    setClientQuery("");
    setClientHits([]);
    setClientOpen(false);
    setPack(null);
    setTime(timeFromBookAt(bookAtLocalFromDateKey(dateKey)));
    setDuration(60);
    setSessionType("Training session");
    setCustomTitle("");
    setAmount(readLastAmount());
    setMarkPaid(false);
    setBillingMode("invoice");
  }, [dateKey, initialClientId, initialClientName]);

  useEffect(() => {
    if (!open) return;
    resetForOpen();
  }, [open, resetForOpen]);

  useEffect(() => {
    if (!open || !clientId) {
      setPack(null);
      return;
    }
    let cancelled = false;
    setPackLoading(true);
    void (async () => {
      try {
        const ctx = await getClientBookContextAction(clientId);
        if (cancelled) return;
        setPack(ctx.activePackage);
        if (ctx.name) setClientLabel(ctx.name);
        // Prefer pack when they have remaining credits
        if (ctx.activePackage && ctx.activePackage.remaining > 0) {
          setBillingMode("pack");
        } else {
          setBillingMode((m) => (m === "pack" ? "invoice" : m));
        }
      } catch {
        if (!cancelled) setPack(null);
      } finally {
        if (!cancelled) setPackLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, clientId]);

  useEffect(() => {
    if (!open || !clientOpen) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const rows = await searchClientsAction(clientQuery);
          if (cancelled) return;
          setClientHits(
            rows.map((c) => ({
              id: c.id,
              firstName: c.firstName,
              lastName: c.lastName || "",
              status: c.status,
            }))
          );
        } catch {
          if (!cancelled) setClientHits([]);
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [open, clientOpen, clientQuery]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => {
      panelRef.current
        ?.querySelector<HTMLElement>("input, button, select")
        ?.focus();
    });
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function pickClient(c: ClientOption) {
    const name = fullName(c.firstName, c.lastName);
    setClientId(c.id);
    setClientLabel(name);
    setClientQuery("");
    setClientOpen(false);
    setStoredActiveClient(c.id, name);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Pick a client");
      setClientOpen(true);
      return;
    }
    const startLocal = combineDateAndTime(dateKey, time);
    const startDate = new Date(startLocal);
    if (Number.isNaN(startDate.getTime())) {
      setError("That time is not valid");
      return;
    }
    if (billingMode === "pack" && !hasPackCredit) {
      setError("No pack credit left — invoice this session or add a pack");
      return;
    }
    if (billingMode === "invoice") {
      try {
        parseMoneyToCents(amount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Enter a valid amount");
        return;
      }
    }
    const title =
      customTitle.trim() || sessionType.trim() || "Training session";
    startTransition(async () => {
      try {
        const res = await createBookingWithBillingAction({
          clientId,
          startsAt: startDate.toISOString(),
          title,
          durationMin: duration,
          billingMode,
          amount: billingMode === "invoice" ? amount : undefined,
          markPaid: billingMode === "invoice" ? markPaid : false,
          packageId: pack?.id ?? null,
        });
        if (billingMode === "invoice" && amount.trim()) {
          writeLastAmount(amount.trim());
        }
        setStoredActiveClient(clientId, clientLabel || null);
        const bill =
          res.billingMode === "pack"
            ? "Pack credit noted"
            : res.billingMode === "invoice"
              ? markPaid
                ? `Invoiced ${amountPreview || "session"} · paid`
                : `Invoiced ${amountPreview || "session"} · unpaid`
              : "No charge";
        onBooked(`Booked · ${bill}`);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not book");
      }
    });
  }

  if (!open) return null;

  const billOption = (
    mode: BillingMode,
    label: string,
    detail: string,
    disabled?: boolean
  ) => {
    const active = billingMode === mode;
    return (
      <button
        key={mode}
        type="button"
        disabled={pending || disabled}
        onClick={() => setBillingMode(mode)}
        className={cn(
          "flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition",
          active
            ? "border-emerald-700/55 bg-emerald-950/35"
            : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700",
          disabled && "opacity-45"
        )}
      >
        <span
          className={cn(
            "text-sm font-medium",
            active ? "text-emerald-200" : "text-zinc-200"
          )}
        >
          {label}
        </span>
        <span className="mt-0.5 text-[11px] leading-snug text-zinc-500">
          {detail}
        </span>
      </button>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
        aria-label="Close booking dialog"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[min(94dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/50 sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold tracking-tight text-zinc-50"
            >
              Book session
            </h2>
            <p className="mt-0.5 text-xs text-zinc-500">{dayLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form
          onSubmit={submit}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5"
        >
          <div className="space-y-4">
            {/* Client */}
            <div>
              <Label htmlFor="cal-book-client">Client</Label>
              {clientId && !clientOpen ? (
                <div className="flex flex-wrap items-center gap-2">
                  <div className="min-h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
                    {clientLabel || "Selected client"}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="min-h-11"
                    onClick={() => {
                      setClientOpen(true);
                      setClientQuery("");
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    id="cal-book-client"
                    value={clientQuery}
                    onChange={(e) => {
                      setClientQuery(e.target.value);
                      setClientOpen(true);
                    }}
                    onFocus={() => setClientOpen(true)}
                    placeholder="Search clients…"
                    autoComplete="off"
                    disabled={pending}
                  />
                  {clientOpen && (
                    <ul
                      className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl"
                      role="listbox"
                    >
                      {clientHits.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-zinc-500">
                          No clients match
                        </li>
                      ) : (
                        clientHits.map((c) => {
                          const name = fullName(c.firstName, c.lastName);
                          return (
                            <li key={c.id}>
                              <button
                                type="button"
                                role="option"
                                className="flex w-full min-h-11 items-center px-3 text-left text-sm text-zinc-100 hover:bg-zinc-800"
                                onClick={() => pickClient(c)}
                              >
                                <span className="truncate">{name}</span>
                                {c.status !== "active" && (
                                  <span className="ml-2 text-[10px] uppercase text-zinc-500">
                                    {c.status}
                                  </span>
                                )}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  )}
                </div>
              )}
              {packLoading && clientId && (
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  Checking pack…
                </p>
              )}
              {!packLoading && pack && pack.remaining > 0 && (
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Pack{" "}
                  <span className="font-medium text-zinc-300">{pack.name}</span>
                  {" · "}
                  <span className="tabular-nums text-emerald-400/90">
                    {pack.remaining} of {pack.total} left
                  </span>
                </p>
              )}
              {!packLoading && clientId && (!pack || pack.remaining === 0) && (
                <p className="mt-1.5 text-[11px] text-zinc-600">
                  No pack credit — invoice this session or book free.
                </p>
              )}
            </div>

            {/* Time + duration */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cal-book-time">Time</Label>
                <Input
                  id="cal-book-time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  required
                  disabled={pending}
                  className="tabular-nums"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                  Duration
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {DURATIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      disabled={pending}
                      onClick={() => setDuration(m)}
                      className={cn(
                        "min-h-11 rounded-full border px-3 text-xs font-medium tabular-nums transition",
                        duration === m
                          ? "border-emerald-700/60 bg-emerald-950/50 text-emerald-300"
                          : "border-zinc-800 bg-zinc-950/50 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      )}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Session type */}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Session type
              </p>
              <div className="flex flex-wrap gap-1.5">
                {titlePresets.map((t) => (
                  <button
                    key={t}
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      setSessionType(t);
                      setCustomTitle("");
                    }}
                    className={cn(
                      "min-h-11 rounded-full border px-3 text-[11px] font-medium transition",
                      sessionType === t && !customTitle
                        ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                        : "border-zinc-800 bg-zinc-950/40 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                className="mt-2"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Or custom title…"
                disabled={pending}
              />
            </div>

            {/* Billing */}
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-400">
                Pricing
              </p>
              <p className="mb-2 text-[11px] leading-snug text-zinc-600">
                Pack credit burns when you complete the floor session — not when
                you book.
              </p>
              <div className="space-y-2">
                {billOption(
                  "pack",
                  "Use pack credit",
                  hasPackCredit
                    ? `From ${pack!.name} · ${pack!.remaining} left`
                    : "No remaining sessions on an active pack",
                  !hasPackCredit
                )}
                {billOption(
                  "invoice",
                  "Invoice this session",
                  "Create a simple invoice (unpaid or mark paid now)"
                )}
                {billingMode !== "pack" &&
                  billOption(
                    "none",
                    "No charge",
                    "Book the slot only — no pack note, no invoice"
                  )}
              </div>

              {billingMode === "invoice" && (
                <div className="mt-3 space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <Label htmlFor="cal-book-amount">Amount (SGD)</Label>
                      <Input
                        id="cal-book-amount"
                        inputMode="decimal"
                        value={amount}
                        onChange={(e) =>
                          setAmount(sanitizeMoneyInput(e.target.value))
                        }
                        placeholder="100"
                        disabled={pending}
                        className="tabular-nums"
                        required={billingMode === "invoice"}
                      />
                    </div>
                    {amountPreview && (
                      <p className="pb-2 text-sm font-medium tabular-nums text-emerald-400/90">
                        {amountPreview}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AMOUNT_PRESETS.map((a) => (
                      <button
                        key={a}
                        type="button"
                        disabled={pending}
                        onClick={() => setAmount(a)}
                        className={cn(
                          "min-h-9 rounded-full border px-2.5 text-[11px] font-medium tabular-nums transition",
                          amount === a
                            ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-300"
                            : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-zinc-300">
                    <input
                      type="checkbox"
                      checked={markPaid}
                      onChange={(e) => setMarkPaid(e.target.checked)}
                      disabled={pending}
                      className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/50"
                    />
                    Mark paid now
                  </label>
                  <p className="text-[11px] leading-snug text-zinc-600">
                    Unpaid invoices show on Needs you. Pack burn still happens
                    only when you complete the floor session (if they have a
                    pack).
                  </p>
                </div>
              )}

              {billingMode === "pack" && hasPackCredit && (
                <p className="mt-2 text-[11px] leading-snug text-zinc-600">
                  No invoice created. Completing the session on the floor burns
                  one pack credit.
                </p>
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200"
              >
                {error}
              </p>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-2 border-t border-zinc-800 pt-4">
            <Button
              type="submit"
              loading={pending}
              className="min-h-11 flex-1 sm:flex-none"
            >
              {pending
                ? "Booking…"
                : billingMode === "invoice"
                  ? markPaid
                    ? "Book & mark paid"
                    : "Book & invoice"
                  : billingMode === "pack"
                    ? "Book on pack"
                    : "Book session"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              className="min-h-11"
              onClick={onClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
