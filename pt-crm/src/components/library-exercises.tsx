"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, EmptyState, Input } from "./ui";
import {
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Search,
  Warehouse,
} from "lucide-react";
import {
  DIFFICULTY_TONE,
  PATTERN_ORDER,
  patternLabel,
} from "@/lib/exercise-meta";

export type LibraryExercise = {
  id: string;
  slug?: string;
  name: string;
  description: string | null;
  movementPattern: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  difficulty: string;
  tags: string;
  cues: string | null;
  equipmentNames: string[];
  available: boolean;
  missingEquipment: string[];
  equipmentAny: boolean;
};

type SortMode = "name" | "pattern" | "difficulty";
type DiffFilter = "all" | "beginner" | "intermediate" | "advanced";

const DIFF_RANK: Record<string, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

export function LibraryExercises({ initial }: { initial: LibraryExercise[] }) {
  const [q, setQ] = useState("");
  const [availableOnly, setAvailableOnly] = useState(true);
  const [pattern, setPattern] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<DiffFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("pattern");
  const [openId, setOpenId] = useState<string | null>(null);
  const [groupByPattern, setGroupByPattern] = useState(true);

  const patterns = useMemo(() => {
    const present = new Set(initial.map((e) => e.movementPattern));
    const ordered = PATTERN_ORDER.filter((p) => present.has(p));
    for (const p of present) {
      if (!ordered.includes(p as (typeof PATTERN_ORDER)[number])) ordered.push(p as (typeof PATTERN_ORDER)[number]);
    }
    return ordered;
  }, [initial]);

  const stats = useMemo(() => {
    const available = initial.filter((e) => e.available).length;
    const byPattern: Record<string, { on: number; total: number }> = {};
    const byDiff: Record<string, number> = {};
    for (const e of initial) {
      const b = (byPattern[e.movementPattern] ||= { on: 0, total: 0 });
      b.total++;
      if (e.available) b.on++;
      byDiff[e.difficulty] = (byDiff[e.difficulty] || 0) + 1;
    }
    return {
      total: initial.length,
      available,
      byPattern,
      byDiff,
      withCues: initial.filter((e) => e.cues).length,
    };
  }, [initial]);

  const filtered = useMemo(() => {
    const tokens = q
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    const rows = initial.filter((e) => {
      if (availableOnly && !e.available) return false;
      if (pattern !== "all" && e.movementPattern !== pattern) return false;
      if (difficulty !== "all" && e.difficulty !== difficulty) return false;
      if (!tokens.length) return true;
      const hay = [
        e.name,
        e.slug || "",
        e.tags,
        e.primaryMuscles,
        e.secondaryMuscles || "",
        e.movementPattern,
        e.description || "",
        e.cues || "",
        ...(e.equipmentNames || []),
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });

    rows.sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1;
      if (sortMode === "difficulty") {
        const d =
          (DIFF_RANK[a.difficulty] ?? 9) - (DIFF_RANK[b.difficulty] ?? 9);
        if (d !== 0) return d;
      }
      if (sortMode === "pattern" || groupByPattern) {
        const pa = PATTERN_ORDER.indexOf(
          a.movementPattern as (typeof PATTERN_ORDER)[number]
        );
        const pb = PATTERN_ORDER.indexOf(
          b.movementPattern as (typeof PATTERN_ORDER)[number]
        );
        const oa = pa === -1 ? 99 : pa;
        const ob = pb === -1 ? 99 : pb;
        if (oa !== ob) return oa - ob;
      }
      return a.name.localeCompare(b.name);
    });

    return rows;
  }, [initial, q, availableOnly, pattern, difficulty, sortMode, groupByPattern]);

  const grouped = useMemo(() => {
    if (!groupByPattern) return null;
    const map = new Map<string, LibraryExercise[]>();
    for (const e of filtered) {
      const list = map.get(e.movementPattern) || [];
      list.push(e);
      map.set(e.movementPattern, list);
    }
    return Array.from(map.entries());
  }, [filtered, groupByPattern]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Usable now
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            <span className="text-emerald-400">{stats.available}</span>
            <span className="text-base font-normal text-zinc-500">
              /{stats.total}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Matches your equipment inventory
          </p>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Patterns covered
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {
              Object.values(stats.byPattern).filter((p) => p.on > 0).length
            }
            <span className="text-base font-normal text-zinc-500">
              /{Object.keys(stats.byPattern).length}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            With at least one available exercise
          </p>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Inventory
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Unlock more of the bank by turning gear on in{" "}
            <Link
              href="/library/equipment"
              className="text-emerald-400 hover:underline"
            >
              Equipment
            </Link>
            .
          </p>
        </Card>
      </div>

      {/* Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-9"
            placeholder="Search name, muscles, tags, cues, gear…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={availableOnly}
            onChange={(e) => setAvailableOnly(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Available only
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
          <input
            type="checkbox"
            checked={groupByPattern}
            onChange={(e) => setGroupByPattern(e.target.checked)}
            className="rounded border-zinc-600"
          />
          Group by pattern
        </label>
        <select
          className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-emerald-500"
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
        >
          <option value="pattern">Sort: pattern</option>
          <option value="name">Sort: name</option>
          <option value="difficulty">Sort: difficulty</option>
        </select>
      </div>

      {/* Pattern chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setPattern("all")}
          className={chipClass(pattern === "all")}
        >
          All patterns
          <span className="ml-1 tabular-nums text-zinc-500">
            {availableOnly ? stats.available : stats.total}
          </span>
        </button>
        {patterns.map((p) => {
          const s = stats.byPattern[p];
          if (!s) return null;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPattern(p)}
              className={chipClass(pattern === p)}
            >
              {patternLabel(p)}
              <span className="ml-1 tabular-nums text-zinc-500">
                {s.on}/{s.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* Difficulty chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-500">Level</span>
        {(
          [
            ["all", "All"],
            ["beginner", "Beginner"],
            ["intermediate", "Intermediate"],
            ["advanced", "Advanced"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setDifficulty(k)}
            className={chipClass(difficulty === k)}
          >
            {label}
            {k !== "all" && stats.byDiff[k] != null && (
              <span className="ml-1 tabular-nums text-zinc-500">
                {stats.byDiff[k]}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-xs text-zinc-500">
          {filtered.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Dumbbell className="h-5 w-5" />}
          title="No exercises match"
          description={
            availableOnly
              ? "Clear “Available only” or enable more gear in Equipment inventory."
              : "Try a different search, pattern, or level filter."
          }
          className="py-10"
          action={
            availableOnly ? (
              <Link href="/library/equipment">
                <Button variant="secondary" size="sm">
                  <Warehouse className="h-3.5 w-3.5" />
                  Manage equipment
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : groupByPattern && grouped ? (
        <div className="space-y-5">
          {grouped.map(([pat, items]) => (
            <section key={pat}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {patternLabel(pat)}
                </h3>
                <span className="text-xs tabular-nums text-zinc-500">
                  {items.filter((i) => i.available).length}/{items.length}
                </span>
              </div>
              <div className="grid gap-2">
                {items.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    ex={ex}
                    open={openId === ex.id}
                    onToggle={() =>
                      setOpenId((id) => (id === ex.id ? null : ex.id))
                    }
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((ex) => (
            <ExerciseCard
              key={ex.id}
              ex={ex}
              open={openId === ex.id}
              onToggle={() =>
                setOpenId((id) => (id === ex.id ? null : ex.id))
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ExerciseCard({
  ex,
  open,
  onToggle,
}: {
  ex: LibraryExercise;
  open: boolean;
  onToggle: () => void;
}) {
  const tags = ex.tags
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

  return (
    <Card
      className={
        ex.available
          ? "border-zinc-800 transition hover:border-zinc-700"
          : "border-zinc-800/60 opacity-75"
      }
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-2 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            {open ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
            )}
            <div className="min-w-0">
              <div className="font-medium text-zinc-100">{ex.name}</div>
              <div className="mt-0.5 text-xs text-zinc-500">
                {ex.primaryMuscles}
                {ex.secondaryMuscles
                  ? ` · also ${ex.secondaryMuscles}`
                  : ""}
              </div>
              {!open && ex.cues && (
                <p className="mt-1.5 line-clamp-1 text-xs text-zinc-400">
                  {ex.cues}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1">
          <Badge tone={ex.available ? "green" : "amber"}>
            {ex.available ? "Available" : "Missing gear"}
          </Badge>
          <Badge>{patternLabel(ex.movementPattern)}</Badge>
          <Badge tone={DIFFICULTY_TONE[ex.difficulty] || "default"}>
            {ex.difficulty}
          </Badge>
        </div>
      </button>

      <div className="mt-2 flex flex-wrap gap-1 pl-5">
        {(ex.equipmentNames.length ? ex.equipmentNames : ["Bodyweight"]).map(
          (eq) => (
            <span
              key={eq}
              className="rounded-md bg-zinc-800/80 px-1.5 py-0.5 text-[10px] text-zinc-400"
            >
              {eq}
            </span>
          )
        )}
        {ex.equipmentAny && ex.equipmentNames.length > 1 && (
          <span className="rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-500">
            any of these
          </span>
        )}
        {!ex.available &&
          ex.missingEquipment.map((m) => (
            <span
              key={m}
              className="rounded-md bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-200/90"
            >
              need: {m}
            </span>
          ))}
      </div>

      {open && (
        <div className="mt-3 space-y-2 border-t border-zinc-800/80 pt-3 pl-5">
          {ex.description && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                About
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-zinc-300">
                {ex.description}
              </p>
            </div>
          )}
          {ex.cues && (
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Coaching cues
              </div>
              <p className="mt-0.5 text-sm leading-relaxed text-emerald-100/90">
                {ex.cues}
              </p>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {tags.map((t) => (
                <span key={t} className="text-[10px] text-zinc-600">
                  #{t}
                </span>
              ))}
            </div>
          )}
          {ex.slug && (
            <div className="text-[10px] text-zinc-600">{ex.slug}</div>
          )}
        </div>
      )}
    </Card>
  );
}

function chipClass(active: boolean) {
  return (
    "rounded-full border px-2.5 py-1 text-xs font-medium transition " +
    (active
      ? "border-emerald-600/50 bg-emerald-950/50 text-emerald-200"
      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200")
  );
}
