"use client";

import { useEffect, useMemo, useState } from "react";
import { listExercisesAction } from "@/app/actions/library";
import { patternLabel } from "@/lib/exercise-meta";
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
  title = "Swap from exercise bank",
}: {
  onPick: (ex: BankExercisePick) => void;
  onCancel: () => void;
  preferPattern?: string | null;
  title?: string;
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
    <div className="space-y-2 rounded-lg border border-emerald-900/50 bg-emerald-950/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          {title}
        </div>
        <Button type="button" variant="ghost" className="text-xs" onClick={onCancel}>
          Close
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[160px] flex-1">
          <Input
            placeholder="Search exercises…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
        </div>
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-2 text-sm"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
        >
          {patterns.map((p) => (
            <option key={p} value={p}>
              {p === "all" ? "All patterns" : patternLabel(p)}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
          />
          Available only
        </label>
      </div>
      {loading && <p className="text-xs text-zinc-500">Loading bank…</p>}
      <ul className="max-h-56 overflow-auto rounded-lg border border-zinc-800">
        {filtered.map((ex) => (
          <li key={ex.id}>
            <button
              type="button"
              className="flex w-full items-start justify-between gap-2 border-b border-zinc-800 px-3 py-2 text-left last:border-0 hover:bg-zinc-800/80"
              onClick={() => onPick(ex)}
            >
              <div>
                <div className="text-sm font-medium text-zinc-100">{ex.name}</div>
                <div className="text-xs text-zinc-500">
                  {ex.primaryMuscles}
                  {ex.equipmentNames.length
                    ? ` · ${ex.equipmentNames.join(", ")}`
                    : " · Bodyweight"}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <Badge>{patternLabel(ex.movementPattern)}</Badge>
                {!ex.available && <Badge tone="amber">gear</Badge>}
              </div>
            </button>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="px-3 py-4 text-sm text-zinc-500">
            No matches. Try another pattern or turn off “Available only”.
          </li>
        )}
      </ul>
    </div>
  );
}
