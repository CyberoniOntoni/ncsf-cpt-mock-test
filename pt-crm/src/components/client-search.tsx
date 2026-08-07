"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search, User, X } from "lucide-react";
import { searchClientsAction } from "@/app/actions/clients";
import { fullName } from "@/lib/utils";
import { Button, Input } from "./ui";
import { QuickAddClient } from "./quick-add-client";

type ClientHit = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  goals: string | null;
};

export function ClientSearchBar({
  selectedClientId,
  selectedClientName,
  onSelect,
  onClear,
  compactSelected = false,
}: {
  selectedClientId?: string | null;
  selectedClientName?: string | null;
  onSelect: (client: ClientHit) => void;
  onClear: () => void;
  compactSelected?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = await searchClientsAction(q);
      setHits(rows as ClientHit[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (open) void runSearch(query);
    }, 200);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 shadow-sm shadow-black/20 sm:p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
          Client on hand
        </div>
        {selectedClientId && compactSelected && (
          <div className="flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/40 py-0.5 pl-2.5 pr-1 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="max-w-[10rem] truncate font-medium text-emerald-200 sm:max-w-none">
              {selectedClientName || "Selected"}
            </span>
            <button
              type="button"
              onClick={onClear}
              className="rounded-full p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
              aria-label="Clear client"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      <div className="relative flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-9"
            placeholder={
              selectedClientId
                ? "Switch client…"
                : "Search by name, email, or phone…"
            }
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              setOpen(true);
              void runSearch(query);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
          />
          {open && (
            <div className="absolute z-30 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl shadow-black/40">
              {loading && (
                <div className="px-3 py-2.5 text-xs text-zinc-500">
                  Searching…
                </div>
              )}
              {!loading && hits.length === 0 && (
                <div className="px-3 py-3 text-sm text-zinc-500">
                  No clients found. Try quick add or full intake.
                </div>
              )}
              {hits.map((c) => {
                const active = c.id === selectedClientId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={`flex w-full items-start gap-2.5 border-b border-zinc-800 px-3 py-2.5 text-left last:border-0 ${
                      active
                        ? "bg-emerald-950/40"
                        : "hover:bg-zinc-800/80"
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onSelect(c);
                      setQuery("");
                      setOpen(false);
                    }}
                  >
                    <span
                      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        active
                          ? "bg-emerald-900/60 text-emerald-300"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-zinc-100">
                        {fullName(c.firstName, c.lastName)}
                        {active && (
                          <span className="ml-1.5 text-[10px] font-normal text-emerald-400">
                            active
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-zinc-500">
                        {[c.email, c.phone].filter(Boolean).join(" · ") ||
                          c.status}
                        {c.goals
                          ? ` · ${c.goals.slice(0, 40)}${c.goals.length > 40 ? "…" : ""}`
                          : ""}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setShowQuickAdd((v) => !v)}
        >
          {showQuickAdd ? "Cancel" : "Quick add"}
        </Button>
        <Link href="/clients/new">
          <Button type="button" size="sm">
            <Plus className="h-3.5 w-3.5" />
            Intake
          </Button>
        </Link>
      </div>

      {showQuickAdd && (
        <div className="mt-3 border-t border-zinc-800 pt-3">
          <QuickAddClient
            defaultOpen
            compact
            onCreated={(c) => {
              setShowQuickAdd(false);
              onSelect({
                id: c.clientId,
                firstName: c.firstName,
                lastName: c.lastName,
                email: c.email,
                phone: c.phone,
                status: c.status,
                goals: c.goals,
              });
            }}
          />
        </div>
      )}
    </div>
  );
}
