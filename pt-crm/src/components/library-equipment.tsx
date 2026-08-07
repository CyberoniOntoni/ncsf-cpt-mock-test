"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  setEquipmentAvailableAction,
  setEquipmentBulkAction,
} from "@/app/actions/library";
import {
  EQUIPMENT_PRESETS,
  presetAvailability,
  type EquipmentPreset,
} from "@/lib/equipment-presets";
import { Badge, Button, Card, EmptyState, Input } from "./ui";
import {
  Check,
  Dumbbell,
  Filter,
  Search,
  Sparkles,
  Warehouse,
} from "lucide-react";

export type EquipmentRow = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string | null;
  available: boolean;
  /** Exercises that list this gear (unlock hint) */
  exerciseCount?: number;
};

/** Lightweight exercise reqs for live unlock count */
export type ExerciseEqReq = {
  equipmentIds: string[];
  equipmentAny: boolean;
};

const CATEGORY_META: Record<
  string,
  { label: string; order: number; blurb: string }
> = {
  free_weights: {
    label: "Free weights",
    order: 1,
    blurb: "Bars, DBs, KBs, plates",
  },
  machines: {
    label: "Machines",
    order: 2,
    blurb: "Selectorized & guided paths",
  },
  accessories: {
    label: "Stations & accessories",
    order: 3,
    blurb: "Racks, bands, balls, tools",
  },
  cardio: {
    label: "Cardio",
    order: 4,
    blurb: "Ergs, tread, bike, rope",
  },
  bodyweight: {
    label: "Bodyweight",
    order: 0,
    blurb: "Always available",
  },
  other: {
    label: "Other",
    order: 9,
    blurb: "",
  },
};

type AvailFilter = "all" | "on" | "off";

export function LibraryEquipment({
  initial,
  exerciseReqs = [],
}: {
  initial: EquipmentRow[];
  /** Exercise equipment requirements for live unlock stats */
  exerciseReqs?: ExerciseEqReq[];
}) {
  const [rows, setRows] = useState(initial);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [availFilter, setAvailFilter] = useState<AvailFilter>("all");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastPreset, setLastPreset] = useState<string | null>(null);

  // Sync after server revalidation (e.g. another tab / full refresh path)
  useEffect(() => {
    setRows(initial);
  }, [initial]);

  const categories = useMemo(() => {
    const s = new Set(rows.map((r) => r.category));
    return Array.from(s).sort(
      (a, b) =>
        (CATEGORY_META[a]?.order ?? 50) - (CATEGORY_META[b]?.order ?? 50)
    );
  }, [rows]);

  const stats = useMemo(() => {
    const available = rows.filter((r) => r.available).length;
    const byCat: Record<string, { on: number; total: number }> = {};
    for (const r of rows) {
      const b = (byCat[r.category] ||= { on: 0, total: 0 });
      b.total++;
      if (r.available) b.on++;
    }
    const availIds = new Set(rows.filter((r) => r.available).map((r) => r.id));
    let exercisesUsable = 0;
    for (const ex of exerciseReqs) {
      const ids = ex.equipmentIds || [];
      if (!ids.length) {
        exercisesUsable++;
        continue;
      }
      if (ex.equipmentAny) {
        if (ids.some((id) => availIds.has(id))) exercisesUsable++;
      } else if (ids.every((id) => availIds.has(id))) {
        exercisesUsable++;
      }
    }
    return {
      available,
      total: rows.length,
      byCat,
      exercisesUsable,
      exercisesTotal: exerciseReqs.length,
    };
  }, [rows, exerciseReqs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const tokens = query.split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (availFilter === "on" && !r.available) return false;
      if (availFilter === "off" && r.available) return false;
      if (!tokens.length) return true;
      const hay = [r.name, r.slug, r.category, r.description || ""]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [rows, q, category, availFilter]);

  const byCategory = useMemo(() => {
    const map = new Map<string, EquipmentRow[]>();
    for (const r of filtered) {
      const list = map.get(r.category) || [];
      list.push(r);
      map.set(r.category, list);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) =>
        (CATEGORY_META[a]?.order ?? 50) - (CATEGORY_META[b]?.order ?? 50)
    );
  }, [filtered]);

  function toggle(id: string, available: boolean) {
    setError(null);
    setLastPreset(null);
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, available } : r))
    );
    startTransition(async () => {
      try {
        await setEquipmentAvailableAction(id, available);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        setRows(initial);
      }
    });
  }

  function applyBulk(
    updates: { equipmentId: string; available: boolean }[],
    presetId?: string
  ) {
    setError(null);
    const map = new Map(updates.map((u) => [u.equipmentId, u.available]));
    setRows((prev) =>
      prev.map((r) =>
        map.has(r.id) ? { ...r, available: map.get(r.id)! } : r
      )
    );
    if (presetId) setLastPreset(presetId);
    startTransition(async () => {
      try {
        await setEquipmentBulkAction(updates);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Update failed");
        setRows(initial);
        setLastPreset(null);
      }
    });
  }

  function applyPreset(preset: EquipmentPreset) {
    const updates = presetAvailability(preset, rows);
    applyBulk(updates, preset.id);
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Gear available
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            <span className="text-emerald-400">{stats.available}</span>
            <span className="text-base font-normal text-zinc-500">
              /{stats.total}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Bodyweight is always on (not listed)
          </p>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Exercises unlocked
          </div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {stats.exercisesTotal > 0 ? (
              <>
                <span className="text-emerald-400">{stats.exercisesUsable}</span>
                <span className="text-base font-normal text-zinc-500">
                  /{stats.exercisesTotal}
                </span>
              </>
            ) : (
              <span className="text-zinc-400">—</span>
            )}
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            Updates as you toggle gear
          </p>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            Why it matters
          </div>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            Program design and coach suggestions only use gear marked available
            here.
          </p>
        </Card>
      </div>

      {/* Presets */}
      <Card className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-zinc-100">
            Quick presets
          </h2>
        </div>
        <p className="text-xs text-zinc-500">
          One click to match a common floor type. You can still tweak items
          after.
        </p>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_PRESETS.map((p) => {
            const active = lastPreset === p.id;
            return (
              <button
                key={p.id}
                type="button"
                disabled={pending}
                onClick={() => applyPreset(p)}
                title={p.blurb}
                className={
                  "rounded-lg border px-3 py-2 text-left transition disabled:opacity-50 " +
                  (active
                    ? "border-emerald-600/60 bg-emerald-950/40 text-emerald-100"
                    : "border-zinc-700 bg-zinc-900/80 text-zinc-200 hover:border-zinc-600 hover:bg-zinc-800")
                }
              >
                <div className="flex items-center gap-1.5 text-sm font-medium">
                  {active && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                  {p.label}
                </div>
                <div className="mt-0.5 text-[11px] text-zinc-500">{p.blurb}</div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-9"
            placeholder="Search gear, slugs, descriptions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-zinc-500" />
          <button
            type="button"
            onClick={() => setCategory("all")}
            className={chipClass(category === "all")}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={chipClass(category === c)}
            >
              {CATEGORY_META[c]?.label || c}
              <span className="ml-1 tabular-nums text-zinc-500">
                {stats.byCat[c]?.on ?? 0}/{stats.byCat[c]?.total ?? 0}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-lg border border-zinc-800 p-0.5">
          {(
            [
              ["all", "All"],
              ["on", "On"],
              ["off", "Off"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setAvailFilter(k)}
              className={
                "rounded-md px-2.5 py-1 text-xs font-medium transition " +
                (availFilter === k
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200")
              }
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() =>
              applyBulk(
                rows.map((r) => ({ equipmentId: r.id, available: true })),
                "commercial"
              )
            }
          >
            Enable all
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              applyBulk(
                rows.map((r) => ({ equipmentId: r.id, available: false })),
                "none"
              )
            }
          >
            Disable all
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>
          {filtered.length} shown
          {pending ? " · saving…" : ""}
        </span>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Warehouse className="h-5 w-5" />}
          title="No equipment match"
          description="Try another search or clear category / On–Off filters."
          className="py-10"
        />
      ) : (
        byCategory.map(([cat, items]) => (
          <Card key={cat}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">
                  {CATEGORY_META[cat]?.label || cat}
                </h3>
                {CATEGORY_META[cat]?.blurb && (
                  <p className="text-xs text-zinc-500">
                    {CATEGORY_META[cat].blurb}
                  </p>
                )}
              </div>
              <span className="text-xs tabular-nums text-zinc-500">
                {items.filter((i) => i.available).length}/{items.length} on
              </span>
            </div>
            <ul className="divide-y divide-zinc-800/80">
              {items.map((item) => (
                <li
                  key={item.id}
                  className={
                    "flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0 " +
                    (item.available ? "" : "opacity-75")
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {item.name}
                      </span>
                      {(item.exerciseCount ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-zinc-500">
                          <Dumbbell className="h-3 w-3" />
                          {item.exerciseCount} exercise
                          {item.exerciseCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-1 text-[11px] text-zinc-600">
                      {item.slug}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => toggle(item.id, !item.available)}
                    className="flex shrink-0 items-center gap-2 pt-0.5"
                    aria-pressed={item.available}
                    aria-label={`${item.available ? "Disable" : "Enable"} ${item.name}`}
                  >
                    <Badge tone={item.available ? "green" : "default"}>
                      {item.available ? "Available" : "Off"}
                    </Badge>
                    <span
                      className={
                        "relative h-6 w-11 rounded-full transition " +
                        (item.available ? "bg-emerald-600" : "bg-zinc-700")
                      }
                    >
                      <span
                        className={
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition " +
                          (item.available ? "left-5" : "left-0.5")
                        }
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
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
