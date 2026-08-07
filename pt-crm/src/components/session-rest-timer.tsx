"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Timer, X } from "lucide-react";
import { Button } from "./ui";
import { cn } from "@/lib/utils";

/** Self-contained rest countdown for floor logging. */
export function FloorRestTimer({
  seconds,
  label,
  token,
  onDismiss,
  mode = "rest",
  subtitle,
}: {
  seconds: number;
  label: string;
  /** Change token to restart a new rest period (e.g. Date.now()). */
  token: number | string;
  onDismiss: () => void;
  /** EMOM uses same countdown UI with EMOM-oriented labels. */
  mode?: "rest" | "emom";
  subtitle?: string;
}) {
  const total = Math.max(5, Math.round(seconds));
  const [left, setLeft] = useState(total);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishedNotified = useRef(false);
  const isEmom = mode === "emom";

  useEffect(() => {
    setLeft(total);
    setPaused(false);
    setFinished(false);
    finishedNotified.current = false;
  }, [total, label, token, mode]);

  useEffect(() => {
    if (paused || finished) return;
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          setFinished(true);
          if (!finishedNotified.current) {
            finishedNotified.current = true;
            try {
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([40, 40, 80]);
              }
            } catch {
              /* ignore */
            }
          }
          return 0;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [paused, finished, token]);

  const pct = total > 0 ? (left / total) * 100 : 0;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");

  const statusLabel = finished
    ? isEmom
      ? "EMOM done — next minute"
      : "Rest done — next set"
    : isEmom
      ? label || "EMOM · next minute"
      : `Rest · ${label}`;

  return (
    <div
      className={cn(
        "fixed inset-x-0 z-30 px-3",
        "bottom-[calc(8.75rem+env(safe-area-inset-bottom))] md:bottom-[4.5rem]"
      )}
      role="timer"
      aria-live="polite"
      aria-label={
        finished
          ? isEmom
            ? "EMOM interval finished"
            : "Rest finished"
          : isEmom
            ? `EMOM ${mm}:${ss}`
            : `Rest ${mm}:${ss}`
      }
    >
      <div
        className={cn(
          "mx-auto flex max-w-3xl items-center gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/40 backdrop-blur transition",
          finished
            ? "border-amber-600/70 bg-amber-950/95"
            : "border-emerald-800/60 bg-emerald-950/95"
        )}
      >
        <Timer
          className={cn(
            "h-5 w-5 shrink-0",
            finished ? "text-amber-300" : "text-emerald-300"
          )}
        />
        <div className="min-w-0 flex-1">
          <div
            className={cn(
              "truncate text-xs",
              finished ? "text-amber-200/90" : "text-emerald-200/80"
            )}
          >
            {statusLabel}
          </div>
          {subtitle && !finished && (
            <div
              className={cn(
                "truncate text-[11px]",
                finished ? "text-amber-200/70" : "text-emerald-200/60"
              )}
            >
              {subtitle}
            </div>
          )}
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              finished ? "text-amber-50" : "text-emerald-50"
            )}
          >
            {finished ? "0:00" : `${mm}:${ss}`}
            {paused && !finished && (
              <span className="ml-2 text-sm font-normal text-emerald-300/80">
                paused
              </span>
            )}
          </div>
          <div
            className={cn(
              "mt-1 h-1.5 overflow-hidden rounded-full",
              finished ? "bg-amber-950" : "bg-emerald-950"
            )}
          >
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-linear",
                finished ? "bg-amber-400" : "bg-emerald-400"
              )}
              style={{ width: `${finished ? 0 : pct}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {!finished ? (
            <>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLeft((n) => Math.max(0, n - 15))}
                >
                  −15
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setLeft((n) => n + 30)}
                >
                  +30
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setPaused((p) => !p)}
                  aria-label={paused ? "Resume rest" : "Pause rest"}
                >
                  {paused ? (
                    <Play className="h-3.5 w-3.5" />
                  ) : (
                    <Pause className="h-3.5 w-3.5" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onDismiss}
                >
                  <X className="h-3.5 w-3.5" />
                  Skip
                </Button>
              </div>
            </>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDismiss}
            >
              Dismiss
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
