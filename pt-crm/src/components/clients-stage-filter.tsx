"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { ListRow } from "@/components/list-row";
import {
  clientStageLabel,
  clientStageTone,
} from "@/lib/client-next-action";
import { cn, fullName } from "@/lib/utils";

export type ClientsListRow = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  goals: string | null;
  status: string;
};

const STAGES = [
  { id: "all", label: "All" },
  { id: "lead", label: "Lead" },
  { id: "active", label: "Active" },
  { id: "paused", label: "Paused" },
  { id: "inactive", label: "Inactive" },
] as const;

const STAGE_SORT: Record<string, number> = {
  active: 0,
  lead: 1,
  paused: 2,
  inactive: 3,
  draft: 4,
};

type StageFilter = (typeof STAGES)[number]["id"];

function contactLine(email: string | null, phone: string | null) {
  return [email, phone].filter(Boolean).join(" · ") || "No contact on file";
}

function goalsSnippet(goals: string | null | undefined) {
  if (!goals?.trim()) return "";
  const t = goals.trim();
  return t.length > 48 ? `${t.slice(0, 46)}…` : t;
}

function rowTone(
  status: string
): "default" | "accent" | "warn" {
  const s = (status || "").toLowerCase();
  if (s === "active") return "accent";
  if (s === "paused") return "warn";
  // inactive / lead / draft — default; inactive rows also get opacity mute
  return "default";
}

function chipClass(active: boolean) {
  return cn(
    "rounded-full border px-2.5 py-1 text-xs font-medium transition",
    active
      ? "border-emerald-600/50 bg-emerald-950/50 text-emerald-200"
      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200"
  );
}

export function ClientsStageFilter({
  clients,
}: {
  clients: ClientsListRow[];
}) {
  const [stage, setStage] = useState<StageFilter>("all");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: clients.length };
    for (const row of clients) {
      c[row.status] = (c[row.status] || 0) + 1;
    }
    return c;
  }, [clients]);

  const filtered = useMemo(() => {
    const rows =
      stage === "all" ? clients : clients.filter((c) => c.status === stage);
    return [...rows].sort((a, b) => {
      if (stage !== "all") {
        return fullName(a.firstName, a.lastName).localeCompare(
          fullName(b.firstName, b.lastName)
        );
      }
      const oa = STAGE_SORT[a.status] ?? 9;
      const ob = STAGE_SORT[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return fullName(a.firstName, a.lastName).localeCompare(
        fullName(b.firstName, b.lastName)
      );
    });
  }, [clients, stage]);

  return (
    <div className="grid gap-3">
      <div
        className="flex flex-wrap items-center gap-1.5"
        role="toolbar"
        aria-label="Filter by stage"
      >
        {STAGES.map((s) => {
          const count = counts[s.id] ?? 0;
          const active = stage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={chipClass(active)}
              aria-pressed={active}
              onClick={() => setStage(s.id)}
            >
              {s.label}
              <span
                className={cn(
                  "ml-1 tabular-nums",
                  active ? "text-emerald-300/80" : "text-zinc-500"
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {stage !== "all" && (
        <p className="text-[11px] text-zinc-600">
          Showing {filtered.length}{" "}
          {clientStageLabel(stage).toLowerCase()}
          {filtered.length === 1 ? " client" : " clients"}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-3 py-6 text-center text-sm text-zinc-500">
          No {stage === "all" ? "" : clientStageLabel(stage).toLowerCase() + " "}
          clients
          {stage !== "all" ? " in this stage" : " yet"}.
          {stage !== "all" && (
            <>
              {" "}
              <button
                type="button"
                className="font-medium text-emerald-400 hover:underline"
                onClick={() => setStage("all")}
              >
                Show all
              </button>
            </>
          )}
        </p>
      ) : (
        <div className="grid gap-2">
          {filtered.map((c) => {
            const name = fullName(c.firstName, c.lastName);
            const goals = goalsSnippet(c.goals);
            const contact = contactLine(c.email, c.phone);
            const inactive = (c.status || "").toLowerCase() === "inactive";
            return (
              <ListRow
                key={c.id}
                href={`/clients/${c.id}`}
                tone={rowTone(c.status)}
                className={inactive ? "opacity-55" : undefined}
                leading={
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 text-[11px] font-semibold uppercase tracking-wide text-zinc-300",
                      inactive && "text-zinc-500"
                    )}
                  >
                    {(c.firstName?.[0] || "?").toUpperCase()}
                    {(c.lastName?.[0] || "").toUpperCase()}
                  </span>
                }
                title={name}
                subtitle={
                  <>
                    {contact}
                    {goals ? ` · ${goals}` : ""}
                  </>
                }
                trailing={
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone={clientStageTone(c.status)}>
                      {clientStageLabel(c.status)}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-zinc-600" />
                  </span>
                }
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
