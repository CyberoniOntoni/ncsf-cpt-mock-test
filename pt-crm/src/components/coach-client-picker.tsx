"use client";

import { useEffect, useState } from "react";
import { User } from "lucide-react";
import { searchClientsAction } from "@/app/actions/clients";
import { fullName } from "@/lib/utils";
import { Button, Input } from "./ui";
import { QuickAddClient } from "./quick-add-client";

export type CoachClientPick = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  status: string;
  goals: string | null;
};

export function CoachClientPicker({
  onPick,
  onCancel,
}: {
  onPick: (c: CoachClientPick) => void;
  onCancel?: () => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<CoachClientPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQuick, setShowQuick] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void searchClientsAction(q).then((rows) => {
      if (!cancelled) {
        setHits(rows as CoachClientPick[]);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/25 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400">
          Select a client
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="ghost"
            className="text-xs"
            onClick={() => setShowQuick((v) => !v)}
          >
            Quick add
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" className="text-xs" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {showQuick ? (
        <QuickAddClient
          defaultOpen
          compact
          onCreated={(c) => {
            onPick({
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
      ) : (
        <>
          <Input
            autoFocus
            placeholder="Search clients…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-2"
          />
          <ul className="max-h-48 overflow-auto rounded-lg border border-zinc-800">
            {loading && (
              <li className="px-3 py-2 text-xs text-zinc-500">Loading…</li>
            )}
            {!loading && hits.length === 0 && (
              <li className="px-3 py-3 text-sm text-zinc-500">No clients found</li>
            )}
            {hits.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="flex w-full items-start gap-2 border-b border-zinc-800 px-3 py-2.5 text-left last:border-0 hover:bg-zinc-800/80"
                  onClick={() => onPick(c)}
                >
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {fullName(c.firstName, c.lastName)}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || c.status}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
