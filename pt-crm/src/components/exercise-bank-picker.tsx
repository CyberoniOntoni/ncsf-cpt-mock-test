"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { listExercisesAction } from "@/app/actions/library";
import { patternLabel } from "@/lib/exercise-meta";
import { cn } from "@/lib/utils";
import { Badge, Button, Input } from "./ui";

export type BankExercisePick = {
  id: string;
  name: string;
  movementPattern: string;
  primaryMuscles: string;
  difficulty: string;
  equipmentNames: string[];
  available: boolean;
  cues: string | null;
};

export function ExerciseBankPicker({
  onPick,
  onCancel,
  preferPattern,
  title = "Pick from exercise bank",
  disabled = false,
}: {
  onPick: (ex: BankExercisePick) => void;
  onCancel: () => void;
  preferPattern?: string | null;
  title?: string;
  /** Disable pick/close while a parent mutation is pending */
  disabled?: boolean;
}) {
  const [all, setAll] = useState<BankExercisePick[]>([]);
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState(preferPattern || "all");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void listExercisesAction().then((rows) => {
      setAll(rows as BankExercisePick[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (preferPattern) setPattern(preferPattern);
  }, [preferPattern]);

  const patterns = useMemo(() => {
    const s = new Set(all.map((e) => e.movementPattern));
    return ["all", ...Array.from(s).sort()];
  }, [all]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all
      .filter((e) => {
        if (availableOnly && !e.available) return false;
        if (pattern !== "all" && e.movementPattern !== pattern) return false;
        if (!query) return true;
        return (
          e.name.toLowerCase().includes(query) ||
          e.primaryMuscles.toLowerCase().includes(query) ||
          e.movementPattern.toLowerCase().includes(query) ||
          (e.cues || "").toLowerCase().includes(query) ||
          e.equipmentNames.some((n) => n.toLowerCase().includes(query))
        );
      })
      .sort((a, b) => {
        // Prefer matching pattern first
        if (preferPattern) {
          const ap = a.movementPattern === preferPattern ? 0 : 1;
          const bp = b.movementPattern === preferPattern ? 0 : 1;
          if (ap !== bp) return ap - bp;
        }
        return a.name.localeCompare(b.name);
      });
  }, [all, q, pattern, availableOnly, preferPattern]);

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3",
        disabled && "pointer-events-none opacity-60"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          {title}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-3 text-xs"
          disabled={disabled}
          onClick={onCancel}
        >
          Close
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 flex-1 sm:min-w-[12rem]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500"
            aria-hidden
          />
          <Input
            placeholder="Search name, muscle, gear…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            disabled={disabled}
            className="pl-9 pr-9"
            aria-label="Search exercises"
          />
          {q.trim() && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <select
          className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50 sm:w-auto sm:min-w-[10rem]"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          disabled={disabled}
          aria-label="Movement pattern"
        >
          {patterns.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All patterns" : patternLabel(p)}
            </option>
          ))}
        </select>
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 text-xs text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-600 focus:ring-emerald-500/50"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            disabled={disabled}
          />
          Floor gear only
        </label>
      </div>

      {loading && (
        <p className="text-xs text-zinc-500" role="status">
          Loading bank…
        </p>
      )}

      <ul
        className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-zinc-950/40"
        role="listbox"
        aria-label="Exercise results"
      >
        {filtered.map((ex) => (
          <li key={ex.id} role="option">
            <button
              type="button"
              disabled={disabled}
              className="flex min-h-11 w-full items-start justify-between gap-3 border-b border-zinc-800/90 px-3 py-2.5 text-left transition last:border-0 hover:bg-zinc-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50 active:bg-zinc-800 disabled:opacity-50"
              onClick={() => onPick(ex)}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-100">
                  {ex.name}
                </div>
                <div className="mt-0.5 text-xs leading-snug text-zinc-500">
                  {ex.primaryMuscles}
                  {ex.equipmentNames.length
                    ? ` · ${ex.equipmentNames.join(", ")}`
                    : " · Bodyweight"}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
                <Badge>{patternLabel(ex.movementPattern)}</Badge>
                {!ex.available && <Badge tone="amber">Missing gear</Badge>}
              </div>
            </button>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="px-4 py-8 text-center">
            <p className="text-sm font-medium text-zinc-300">No matches</p>
            <p className="mt-1 text-xs leading-snug text-zinc-500">
              Try another name or pattern
              {availableOnly ? ", or turn off “Floor gear only”" : ""}.
            </p>
            {(q.trim() || pattern !== "all" || availableOnly) && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  setQ("");
                  setPattern("all");
                  setAvailableOnly(false);
                }}
                className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Clear filters
              </button>
            )}
          </li>
        )}
      </ul>

      {!loading && filtered.length > 0 && (
        <p className="text-[11px] tabular-nums text-zinc-600">
          {filtered.length} exercise{filtered.length === 1 ? "" : "s"}
          {preferPattern && pattern === preferPattern
            ? ` · matching ${patternLabel(preferPattern)} first`
            : ""}
        </p>
      )}
    </div>
  );
}
