"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  applyClientEquipmentPresetAction,
  listClientEquipmentAction,
  setClientEquipmentAvailableAction,
  setClientEquipmentBulkAction,
  type ClientEquipmentCatalogRow,
} from "@/app/actions/client-equipment";
import {
  FACILITY_EQUIPMENT_MODES,
  type FacilityEquipmentMode,
} from "@/lib/client-equipment";
import { EQUIPMENT_PRESETS } from "@/lib/equipment-presets";
import { Badge, Button, Input, SectionLabel } from "./ui";
import { Check, Search, Warehouse } from "lucide-react";

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

const PRESET_IDS = ["garage", "studio", "none"] as const;

type ClientEquipmentPickerProps = {
  clientId: string;
  clientName?: string;
  mode?: FacilityEquipmentMode;
  onModeChange?: (mode: FacilityEquipmentMode) => void;
  compact?: boolean;
};

export function ClientEquipmentPicker({
  clientId,
  clientName,
  mode: modeProp,
  onModeChange,
  compact = false,
}: ClientEquipmentPickerProps) {
  const [modeInner, setModeInner] = useState<FacilityEquipmentMode>(
    modeProp || "org"
  );
  const mode = modeProp ?? modeInner;
  function setMode(next: FacilityEquipmentMode) {
    setModeInner(next);
    onModeChange?.(next);
  }
  const [rows, setRows] = useState<ClientEquipmentCatalogRow[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastPreset, setLastPreset] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setLastPreset(null);
    void listClientEquipmentAction(clientId)
      .then((res) => {
        if (cancelled) return;
        setRows(res.catalog);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load equipment");
        setRows([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const orgOn = useMemo(
    () => rows.filter((r) => r.available).length,
    [rows]
  );
  const clientOn = useMemo(
    () => rows.filter((r) => r.clientAvailable).length,
    [rows]
  );

  const categories = useMemo(() => {
    const s = new Set(rows.map((r) => r.category));
    return Array.from(s).sort(
      (a, b) =>
        (CATEGORY_META[a]?.order ?? 50) - (CATEGORY_META[b]?.order ?? 50)
    );
  }, [rows]);

  const statsByCat = useMemo(() => {
    const byCat: Record<string, { on: number; total: number }> = {};
    for (const r of rows) {
      const b = (byCat[r.category] ||= { on: 0, total: 0 });
      b.total++;
      if (r.clientAvailable) b.on++;
    }
    return byCat;
  }, [rows]);

  const filtered = useMemo(() => {
    const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!tokens.length) return true;
      const hay = [r.name, r.slug, r.category, r.description || ""]
        .join(" ")
        .toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [rows, q, category]);

  const byCategory = useMemo(() => {
    const map = new Map<string, ClientEquipmentCatalogRow[]>();
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

  const presets = useMemo(
    () =>
      PRESET_IDS.map((pid) => EQUIPMENT_PRESETS.find((p) => p.id === pid)).filter(
        (p): p is (typeof EQUIPMENT_PRESETS)[number] => Boolean(p)
      ),
    []
  );

  const editable = mode === "client" || mode === "combined";
  const whose = clientName ? `${clientName}'s` : "this client's";

  function toggle(equipmentId: string, available: boolean) {
    setError(null);
    setLastPreset(null);
    setRows((prev) =>
      prev.map((r) =>
        r.id === equipmentId ? { ...r, clientAvailable: available } : r
      )
    );
    startTransition(async () => {
      const res = await setClientEquipmentAvailableAction(
        clientId,
        equipmentId,
        available
      );
      if (!res.ok) {
        setError(res.error || "Update failed");
        const fresh = await listClientEquipmentAction(clientId);
        setRows(fresh.catalog);
      }
    });
  }

  function applyPreset(presetId: string) {
    setError(null);
    setLastPreset(presetId);
    startTransition(async () => {
      const res = await applyClientEquipmentPresetAction(clientId, presetId);
      if (!res.ok) {
        setError(res.error || "Preset failed");
        setLastPreset(null);
      }
      const fresh = await listClientEquipmentAction(clientId);
      setRows(fresh.catalog);
    });
  }

  function applyBulk(available: boolean) {
    setError(null);
    setLastPreset(available ? null : "none");
    const ids = rows.map((r) => r.id);
    setRows((prev) => prev.map((r) => ({ ...r, clientAvailable: available })));
    startTransition(async () => {
      const res = await setClientEquipmentBulkAction(clientId, ids, available);
      if (!res.ok) {
        setError(res.error || "Update failed");
        const fresh = await listClientEquipmentAction(clientId);
        setRows(fresh.catalog);
        setLastPreset(null);
      }
    });
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <SectionLabel>Available gear</SectionLabel>
          {!compact && (
            <p className="mt-1 text-xs text-zinc-500">
              Home / travel kit is independent of studio floor inventory.
            </p>
          )}
        </div>
        <div
          className="flex gap-1 rounded-lg border border-zinc-800 p-0.5"
          role="group"
          aria-label="Equipment source"
        >
          {FACILITY_EQUIPMENT_MODES.map((m) => {
            const pressed = mode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                aria-pressed={pressed}
                title={m.description}
                onClick={() => setMode(m.id)}
                className={
                  "min-h-11 rounded-md px-3 text-xs font-medium transition " +
                  (pressed
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-200 disabled:hover:text-zinc-400")
                }
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {mode === "org" && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-3 py-3">
          <p className="text-sm text-zinc-300">
            Using studio floor gear from Library
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {loading
              ? "Loading floor count…"
              : `${orgOn} of ${rows.length} catalog items on`}
            {" · "}
            <Link
              href="/library/equipment"
              className="font-medium text-emerald-400 hover:underline"
            >
              Edit floor gear
            </Link>
          </p>
        </div>
      )}

      {mode === "combined" && (
        <p className="text-xs leading-relaxed text-zinc-500">
          Only exercises that work with BOTH floor gear and this home list.
        </p>
      )}

      {mode === "client" && !compact && (
        <p className="text-xs leading-relaxed text-zinc-500">
          Exercises must fit {whose} home / travel kit. Floor inventory is
          ignored.
        </p>
      )}

      {error && (
        <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {editable && (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            {presets.map((p) => {
              const active = lastPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={pending || loading}
                  onClick={() => applyPreset(p.id)}
                  title={p.blurb}
                  className={chipClass(active)}
                >
                  {active && <Check className="mr-1 inline h-3 w-3" />}
                  {p.label}
                </button>
              );
            })}
            {!compact && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || loading}
                  onClick={() => applyBulk(true)}
                >
                  Enable all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending || loading}
                  onClick={() => applyBulk(false)}
                >
                  Clear
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input
                className="pl-9"
                placeholder="Search gear…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Search client equipment"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
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
                    {statsByCat[c]?.on ?? 0}/{statsByCat[c]?.total ?? 0}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>
              {clientOn}/{rows.length} on home list
              {pending ? " · saving…" : loading ? " · loading…" : ""}
            </span>
            {mode === "combined" && (
              <span className="tabular-nums">
                Floor {orgOn} · both{" "}
                {rows.filter((r) => r.available && r.clientAvailable).length}
              </span>
            )}
          </div>

          {loading && rows.length === 0 ? (
            <p className="text-sm text-zinc-500">Loading catalog…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-8 text-center">
              <Warehouse className="mb-2 h-5 w-5 text-zinc-500" />
              <p className="text-sm text-zinc-400">No equipment match</p>
            </div>
          ) : (
            byCategory.map(([cat, items]) => (
              <div
                key={cat}
                className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100">
                      {CATEGORY_META[cat]?.label || cat}
                    </h3>
                    {!compact && CATEGORY_META[cat]?.blurb && (
                      <p className="text-xs text-zinc-500">
                        {CATEGORY_META[cat].blurb}
                      </p>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-zinc-500">
                    {items.filter((i) => i.clientAvailable).length}/
                    {items.length} on
                  </span>
                </div>
                <ul className="divide-y divide-zinc-800/80">
                  {items.map((item) => {
                    const on = item.clientAvailable;
                    return (
                      <li
                        key={item.id}
                        className={
                          "flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0 " +
                          (on ? "" : "opacity-75")
                        }
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-medium text-zinc-100">
                              {item.name}
                            </span>
                            {mode === "combined" && !item.available && (
                              <Badge>Not on floor</Badge>
                            )}
                          </div>
                          {!compact && item.description && (
                            <p className="mt-0.5 text-xs text-zinc-400">
                              {item.description}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => toggle(item.id, !on)}
                          aria-pressed={on}
                          aria-label={`${on ? "Disable" : "Enable"} ${item.name}`}
                          className="flex min-h-11 shrink-0 items-center gap-2"
                        >
                          <Badge tone={on ? "green" : "default"}>
                            {on ? "Available" : "Off"}
                          </Badge>
                          <span
                            className={
                              "relative h-6 w-11 rounded-full transition " +
                              (on ? "bg-emerald-600" : "bg-zinc-700")
                            }
                          >
                            <span
                              className={
                                "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition " +
                                (on ? "left-5" : "left-0.5")
                              }
                            />
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

function chipClass(active: boolean) {
  return (
    "rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 " +
    (active
      ? "border-emerald-600/50 bg-emerald-950/50 text-emerald-200"
      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200")
  );
}
