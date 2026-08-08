"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBlankProgramAction } from "@/app/actions/programs";
import { listClientsAction } from "@/app/actions/clients";
import type { ProgramGoal } from "@/lib/program-builder";
import {
  defaultTitleForScratch,
  getScratchSplit,
  SCRATCH_SPLITS,
  type ScratchSplitId,
} from "@/lib/program-scratch";
import { cn, fullName } from "@/lib/utils";
import { FocusShell } from "@/components/page-shell";
import {
  Alert,
  Button,
  Card,
  Input,
  Label,
  SectionLabel,
  Textarea,
} from "./ui";
import { Check } from "lucide-react";

type ClientOpt = {
  id: string;
  firstName: string;
  lastName: string;
};

const GOALS: { value: ProgramGoal; label: string; hint: string }[] = [
  { value: "general", label: "General", hint: "Balanced mix" },
  { value: "strength", label: "Strength", hint: "Heavy compounds" },
  { value: "hypertrophy", label: "Hypertrophy", hint: "Build muscle" },
  { value: "fat_loss", label: "Fat loss", hint: "Density" },
  { value: "mobility", label: "Mobility", hint: "Control & prep" },
];

const DAYS_OPTIONS = [2, 3, 4, 5, 6] as const;
const MINUTES_OPTIONS = [30, 45, 60, 75] as const;

const selectClass =
  "min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";

const chipBase =
  "min-h-11 rounded-lg border px-3.5 py-2 text-sm tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70";

function chipClass(selected: boolean) {
  return cn(
    chipBase,
    selected
      ? "border-emerald-600 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/40"
      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
  );
}

export function ProgramScratchForm({
  initialClientId,
}: {
  initialClientId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [titleTouched, setTitleTouched] = useState(false);

  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<ProgramGoal>("general");
  const [splitId, setSplitId] = useState<ScratchSplitId>("full_body");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [clientId, setClientId] = useState(initialClientId || "");
  const [notes, setNotes] = useState("");
  /** Keep unassigned draft by default for later reuse */
  const [saveForLater, setSaveForLater] = useState(!initialClientId);

  useEffect(() => {
    void listClientsAction().then((rows) => {
      setClients(
        rows.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
        }))
      );
    });
  }, []);

  // Snap day count to a sensible default when split changes
  useEffect(() => {
    const layout = getScratchSplit(splitId);
    if (!layout.days.includes(daysPerWeek)) {
      setDaysPerWeek(layout.days[0] ?? 3);
    }
  }, [splitId]); // eslint-disable-line react-hooks/exhaustive-deps -- only snap on split change

  const dayPreview = useMemo(
    () => getScratchSplit(splitId).daysFor(daysPerWeek),
    [splitId, daysPerWeek]
  );

  const suggestedTitle = useMemo(
    () =>
      defaultTitleForScratch({
        goal,
        splitId,
        daysPerWeek,
        forLater: saveForLater,
      }),
    [goal, splitId, daysPerWeek, saveForLater]
  );

  const displayTitle = titleTouched ? title : title || suggestedTitle;

  function save(activate: boolean) {
    setError(null);
    if (!saveForLater && !clientId) {
      setError("Pick a client, or turn on Save for later");
      return;
    }
    startTransition(async () => {
      try {
        const assignClient = !saveForLater && clientId ? clientId : null;
        const res = await createBlankProgramAction({
          title: (titleTouched ? title : displayTitle).trim() || undefined,
          goal,
          daysPerWeek,
          sessionMinutes,
          splitLayout: splitId,
          days: dayPreview,
          clientId: assignClient,
          notes: notes.trim() || undefined,
          activate: activate && !!assignClient,
        });
        router.push(`/programs/${res.programId}?build=1`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not create program");
      }
    });
  }

  return (
    <FocusShell className="space-y-4 pb-24 sm:pb-8">
      <div>
        <Link
          href="/programs/new"
          className="inline-flex min-h-9 items-center text-xs font-medium text-emerald-400 hover:underline"
        >
          ← Choose how to build
        </Link>
        <p className="section-label mb-1 mt-2 text-emerald-500/90">Programs</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
          Build from scratch
        </h1>
        <p className="mt-1 max-w-xl text-sm text-zinc-500">
          Empty shell with named days. You add every exercise from the bank —
          nothing is auto-picked.
        </p>
      </div>

      {/* Mini steps */}
      <ol className="flex flex-wrap gap-2 text-[11px]">
        {[
          { n: 1, label: "Shell", on: true },
          { n: 2, label: "Fill days", on: false },
          { n: 3, label: "Assign", on: false },
        ].map((s) => (
          <li
            key={s.n}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1",
              s.on
                ? "border-emerald-800/50 bg-emerald-950/30 text-emerald-200"
                : "border-zinc-800 text-zinc-600"
            )}
          >
            <span className="tabular-nums font-semibold">{s.n}</span>
            {s.label}
          </li>
        ))}
      </ol>

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="space-y-5">
        {/* Split layout */}
        <div>
          <SectionLabel className="mb-2">Day layout</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {SCRATCH_SPLITS.map((s) => {
              const selected = splitId === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={pending}
                  onClick={() => setSplitId(s.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                    selected
                      ? "border-emerald-600 bg-emerald-950/30 ring-1 ring-emerald-500/40"
                      : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-zinc-100">
                      {s.label}
                    </span>
                    {selected && (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    )}
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                    {s.hint}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <SectionLabel className="mb-2">Goal</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {GOALS.map((g) => (
              <button
                key={g.value}
                type="button"
                disabled={pending}
                onClick={() => setGoal(g.value)}
                className={chipClass(goal === g.value)}
                title={g.hint}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SectionLabel className="mb-2">Days / week</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OPTIONS.map((d) => {
                const layout = getScratchSplit(splitId);
                const preferred = layout.days.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={pending}
                    onClick={() => setDaysPerWeek(d)}
                    className={cn(
                      chipClass(daysPerWeek === d),
                      !preferred && daysPerWeek !== d && "opacity-50"
                    )}
                    title={
                      preferred
                        ? undefined
                        : `Works, but ${layout.label} is usually ${layout.days.join(" or ")} days`
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <SectionLabel className="mb-2">Session length</SectionLabel>
            <div className="flex flex-wrap gap-1.5">
              {MINUTES_OPTIONS.map((m) => (
                <button
                  key={m}
                  type="button"
                  disabled={pending}
                  onClick={() => setSessionMinutes(m)}
                  className={chipClass(sessionMinutes === m)}
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live day preview */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 px-3 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SectionLabel className="mb-0">Your week</SectionLabel>
            <span className="text-[11px] tabular-nums text-zinc-600">
              {dayPreview.length} empty days
            </span>
          </div>
          <ol className="space-y-1.5">
            {dayPreview.map((d, i) => (
              <li
                key={`${d.name}-${i}`}
                className="flex items-start gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-2 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[11px] font-semibold tabular-nums text-zinc-400">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-zinc-100">{d.name}</div>
                  {d.focus ? (
                    <div className="text-[11px] leading-snug text-zinc-500">
                      {d.focus}
                    </div>
                  ) : (
                    <div className="text-[11px] text-zinc-600">No focus yet</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <Label htmlFor="scratch-title">Title</Label>
          <Input
            id="scratch-title"
            value={displayTitle}
            onChange={(e) => {
              setTitleTouched(true);
              setTitle(e.target.value);
            }}
            onBlur={() => {
              if (!title.trim()) setTitleTouched(false);
            }}
            placeholder={suggestedTitle}
            disabled={pending}
            className="mt-1"
          />
          <p className="mt-1 text-[11px] text-zinc-600">
            Suggested from goal + layout — edit anytime.
          </p>
        </div>

        {/* Save mode */}
        <div>
          <SectionLabel className="mb-2">Save as</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => setSaveForLater(true)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                saveForLater
                  ? "border-amber-700/50 bg-amber-950/20 ring-1 ring-amber-600/30"
                  : "border-zinc-800 hover:border-zinc-600"
              )}
            >
              <div className="text-sm font-semibold text-zinc-100">
                Template (later)
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Unassigned draft. Assign a client when you need it on the floor.
              </p>
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setSaveForLater(false)}
              className={cn(
                "rounded-xl border px-3 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                !saveForLater
                  ? "border-emerald-600 bg-emerald-950/25 ring-1 ring-emerald-500/40"
                  : "border-zinc-800 hover:border-zinc-600"
              )}
            >
              <div className="text-sm font-semibold text-zinc-100">
                Client program
              </div>
              <p className="mt-1 text-[11px] leading-snug text-zinc-500">
                Attach someone now. Stays draft until you activate.
              </p>
            </button>
          </div>
        </div>

        {!saveForLater && (
          <div>
            <Label htmlFor="scratch-client">Client</Label>
            <select
              id="scratch-client"
              className={cn(selectClass, "mt-1")}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              disabled={pending}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c.firstName, c.lastName)}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <Label htmlFor="scratch-notes">Notes (optional)</Label>
          <Textarea
            id="scratch-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Intent, equipment limits, who this template is for…"
            disabled={pending}
            className="mt-1"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-zinc-800 pt-4">
          <Button
            type="button"
            disabled={pending}
            onClick={() => save(false)}
            className="min-h-11"
          >
            {pending
              ? "Creating…"
              : saveForLater
                ? "Create template"
                : "Create draft & open"}
          </Button>
          {!saveForLater && clientId && (
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() => save(true)}
              className="min-h-11"
            >
              Create & activate
            </Button>
          )}
          <Link
            href="/programs"
            className="inline-flex min-h-11 items-center px-2 text-sm text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </Link>
        </div>
      </Card>

      {/* Mobile sticky primary CTA */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 p-3 backdrop-blur sm:hidden">
        <Button
          type="button"
          disabled={pending}
          onClick={() => save(false)}
          className="min-h-11 w-full"
        >
          {pending
            ? "Creating…"
            : saveForLater
              ? "Create template"
              : "Create draft & open"}
        </Button>
      </div>
    </FocusShell>
  );
}
