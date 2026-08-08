"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addProgramExerciseAction,
  advanceMesocycleWeekAction,
  applyMesocycleToProgramAction,
  deleteProgramAction,
  deleteProgramExerciseAction,
  getMesocycleProgressAction,
  getProgramVolumeReportAction,
  insertCorrectivesAction,
  regenerateProgramDayAction,
  regenerateProgramInPlaceAction,
  setMesocycleAutoAdvanceAction,
  suggestProgramMesocycleWeekAction,
  suggestSubstitutionsAction,
  swapProgramExerciseAction,
  updateProgramExerciseAction,
  updateProgramMetaAction,
} from "@/app/actions/programs";
import { groupExercisesIntoBlocks } from "@/lib/exercise-groups";
import {
  getMesocycleWeek,
  MESOCYCLE_WEEK_OPTIONS,
  nextMesocycleWeek,
  suggestMesocycleWeekFromStartDate,
} from "@/lib/mesocycle";
import { SET_SCHEMES } from "@/lib/set-schemes";
import {
  formatGroupBadge,
  formatGroupRoleTitle,
  formatGroupTitle,
  formatPrescription,
  formatRestLabel,
  formatSchemeName,
} from "@/lib/workout-labels";
import { cn, fullName } from "@/lib/utils";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  Label,
  SectionLabel,
  Textarea,
} from "./ui";
import { PageShell } from "./page-shell";
import { StartSessionButton } from "./start-session-button";
import { ExerciseBankPicker } from "./exercise-bank-picker";
import { ChevronDown, ChevronRight } from "lucide-react";

type SubSuggestion = {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  movementPattern: string;
  equipmentNames: string[];
};

type Ex = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
  notes: string | null;
  isWarmup: boolean;
  movementPattern: string | null;
  exerciseId?: string | null;
  setScheme?: string | null;
  setSchemeMeta?: {
    summary?: string;
    howTo?: string;
  } | null;
  sortOrder?: number;
  groupId?: string | null;
  groupKind?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
  restAfterSec?: number | null;
  restBetweenRoundsSec?: number | null;
  groupRole?: string | null;
};

type Day = {
  id: string;
  name: string;
  focus: string | null;
  exercises: Ex[];
};

type Program = {
  id: string;
  title: string;
  goal: string;
  status: string;
  daysPerWeek: number;
  sessionMinutes: number;
  splitType: string;
  notes: string | null;
  clientId: string | null;
  createdAt?: Date | string | null;
  generationMeta?: Record<string, unknown> | null;
};

function isSuccessFlash(msg: string) {
  return !/fail|error|could not|not found|needs equipment|unavailable|assign a client|no correctives|no new correctives|invalid/i.test(
    msg
  );
}

export function ProgramDetail({
  program,
  client,
  days,
  clients,
}: {
  program: Program;
  client: { id: string; firstName: string; lastName: string } | null;
  days: Day[];
  clients: { id: string; firstName: string; lastName: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(program.title);
  const [status, setStatus] = useState(program.status);
  const [notes, setNotes] = useState(program.notes || "");
  const [clientId, setClientId] = useState(program.clientId || "");
  const [msg, setMsg] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Ex>>({});
  const [swapId, setSwapId] = useState<string | null>(null);
  const [addDayId, setAddDayId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SubSuggestion[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [metaOpen, setMetaOpen] = useState(
    !(program.clientId || client)
  );

  const metaWeek =
    typeof program.generationMeta?.mesocycleWeek === "number"
      ? (program.generationMeta.mesocycleWeek as number)
      : typeof (program.generationMeta?.mesocycle as { week?: number } | undefined)
            ?.week === "number"
        ? ((program.generationMeta?.mesocycle as { week: number }).week)
        : 1;
  const [mesoWeek, setMesoWeek] = useState(metaWeek);
  const [appliedWeek, setAppliedWeek] = useState(metaWeek);
  const [mesoProgress, setMesoProgress] = useState<{
    completedInWindow: number;
    threshold: number;
    autoAdvance: boolean;
    appliedLabel: string;
  } | null>(null);
  const [calendarHint, setCalendarHint] = useState<{
    week: number;
    label: string;
  } | null>(null);
  const [volume, setVolume] = useState<{
    totalSets: number;
    totalReps: number;
    totalVolumeKg: number;
    rangeLabel?: string;
    sessionCount: number;
    byPattern: Array<{
      pattern: string;
      label: string;
      sets: number;
      reps: number;
      volumeKg: number;
      topSetKg: number | null;
    }>;
  } | null>(null);
  const [volumeLoading, setVolumeLoading] = useState(false);

  const hasClient = !!(clientId || program.clientId || client);
  const constraintSummary =
    typeof program.generationMeta?.constraintSummary === "string"
      ? (program.generationMeta.constraintSummary as string)
      : null;
  const correctiveCount = Array.isArray(program.generationMeta?.correctiveIds)
    ? (program.generationMeta!.correctiveIds as unknown[]).length
    : 0;
  const suggestedFromCreated = program.createdAt
    ? suggestMesocycleWeekFromStartDate(program.createdAt)
    : null;
  const mesoInfo = getMesocycleWeek(mesoWeek);

  useEffect(() => {
    let cancelled = false;
    setVolumeLoading(true);
    void getProgramVolumeReportAction(program.id, { days: 7 })
      .then((r) => {
        if (!cancelled) {
          setVolume(r);
          setVolumeLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setVolume(null);
          setVolumeLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [program.id, days.length, pending]);

  useEffect(() => {
    if (!swapId) {
      setSuggestions([]);
      setSuggestLoading(false);
      return;
    }
    let cancelled = false;
    setSuggestLoading(true);
    setSuggestions([]);
    void suggestSubstitutionsAction(swapId)
      .then((rows) => {
        if (!cancelled) {
          setSuggestions(rows as SubSuggestion[]);
          setSuggestLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
          setSuggestLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [swapId]);

  useEffect(() => {
    if (!msg || !isSuccessFlash(msg)) return;
    const t = window.setTimeout(() => setMsg(null), 3000);
    return () => window.clearTimeout(t);
  }, [msg]);

  function saveMeta() {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateProgramMetaAction(program.id, {
          title,
          status,
          notes,
          clientId: clientId || null,
        });
        setMsg("Saved");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Save failed");
      }
    });
  }

  function saveExercise() {
    if (!editId) return;
    startTransition(async () => {
      try {
        const current = days
          .flatMap((d) => d.exercises)
          .find((e) => e.id === editId);
        const schemeChanged =
          (editDraft.setScheme || "straight") !==
          (current?.setScheme || "straight");
        await updateProgramExerciseAction(editId, {
          sets: editDraft.sets,
          reps: editDraft.reps,
          rpe: editDraft.rpe,
          restSec: editDraft.restSec,
          notes: editDraft.notes,
          exerciseName: editDraft.exerciseName,
          setScheme: editDraft.setScheme || "straight",
          // Only rebuild single-exercise scheme plans when scheme changes
          // and the row is not part of a multi-exercise group
          rebuildSchemeMeta: schemeChanged && !current?.groupId,
        });
        setEditId(null);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Update failed");
      }
    });
  }

  function removeExercise(id: string) {
    if (!confirm("Remove this exercise?")) return;
    startTransition(async () => {
      try {
        await deleteProgramExerciseAction(id);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Remove failed");
      }
    });
  }

  function swapExercise(
    rowId: string,
    bank: { id: string; name: string; movementPattern: string }
  ) {
    setMsg(null);
    startTransition(async () => {
      try {
        await swapProgramExerciseAction(rowId, bank.id, {
          keepPrescription: true,
          applyCues: true,
        });
        setSwapId(null);
        setMsg(`Swapped to ${bank.name}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Swap failed");
      }
    });
  }

  function addExercise(
    dayId: string,
    bank: { id: string; name: string }
  ) {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await addProgramExerciseAction({
          programDayId: dayId,
          bankExerciseId: bank.id,
        });
        setAddDayId(null);
        setMsg(`Added ${res.name} to ${res.dayName}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Add failed");
      }
    });
  }

  function removeProgram() {
    if (!confirm("Delete this entire program?")) return;
    startTransition(async () => {
      try {
        await deleteProgramAction(program.id);
        router.push("/programs");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Delete failed");
      }
    });
  }

  // Keep local week in sync when server meta changes after refresh
  useEffect(() => {
    setMesoWeek(metaWeek);
    setAppliedWeek(metaWeek);
  }, [metaWeek]);

  useEffect(() => {
    let cancelled = false;
    void getMesocycleProgressAction(program.id)
      .then((p) => {
        if (cancelled) return;
        setMesoProgress({
          completedInWindow: p.completedInWindow,
          threshold: p.threshold,
          autoAdvance: p.autoAdvance,
          appliedLabel: p.appliedLabel,
        });
        setAppliedWeek(p.appliedWeek);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [program.id, metaWeek, program.generationMeta]);

  const mesoDirty = mesoWeek !== appliedWeek;

  function applyMesocycle() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await applyMesocycleToProgramAction(program.id, mesoWeek);
        setAppliedWeek(res.week);
        setMsg(
          `Applied ${res.label} (from baseline — safe to re-apply)`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Mesocycle apply failed");
      }
    });
  }

  function advanceWeek() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await advanceMesocycleWeekAction(program.id);
        setMesoWeek(res.week);
        setAppliedWeek(res.week);
        setMsg(`Advanced to ${res.label}`);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Advance week failed");
      }
    });
  }

  function toggleAutoAdvance() {
    if (!mesoProgress) return;
    const next = !mesoProgress.autoAdvance;
    setMsg(null);
    startTransition(async () => {
      try {
        await setMesocycleAutoAdvanceAction(program.id, next);
        setMesoProgress((p) => (p ? { ...p, autoAdvance: next } : p));
        setMsg(
          next
            ? "Auto-advance on after enough completed sessions"
            : "Auto-advance off — weeks only change when you Apply or Advance"
        );
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not update auto-advance");
      }
    });
  }

  function regenerateProgram() {
    if (
      !confirm(
        "Regenerate this program in place? Days and exercises will be rebuilt from constraints, equipment, and assessments. Session history is kept."
      )
    ) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await regenerateProgramInPlaceAction(program.id, {
          mesocycleWeek: mesoWeek,
        });
        setMsg(
          `Regenerated ${res.days} day(s) · seed ${res.variationSeed}`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Regenerate failed");
      }
    });
  }

  function regenerateDay(dayId: string, dayName: string) {
    if (
      !confirm(
        `Regenerate “${dayName}” only? Exercises on this day will be rebuilt; other days stay the same.`
      )
    ) {
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await regenerateProgramDayAction(dayId);
        setMsg(
          `Rebuilt ${res.dayName}: ${res.exerciseCount} exercises · seed ${res.variationSeed}`
        );
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Day regenerate failed");
      }
    });
  }

  function useCalendarWeek() {
    startTransition(async () => {
      try {
        const res = await suggestProgramMesocycleWeekAction(program.id);
        setCalendarHint({ week: res.week, label: res.label });
        setMesoWeek(res.week);
        setMsg(`Calendar suggests ${res.label}`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not suggest week");
      }
    });
  }

  function insertCorrectives() {
    setMsg(null);
    if (!hasClient) {
      setMsg("Assign a client first to insert assessment correctives");
      return;
    }
    startTransition(async () => {
      try {
        const res = await insertCorrectivesAction(program.id);
        if (res.inserted === 0) {
          setMsg(
            res.reason === "no_correctives"
              ? "No correctives found from assessments / injuries"
              : "No new correctives to insert (already present or no matches)"
          );
        } else {
          setMsg(`Inserted ${res.inserted} corrective exercise(s)`);
        }
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Insert correctives failed");
      }
    });
  }

  const topPatterns =
    volume && volume.totalSets > 0
      ? volume.byPattern.slice(0, 3).map((p) => p.label)
      : [];

  return (
    <PageShell className="space-y-4">
      {/* Header */}
      <div>
        <Link
          href={
            program.clientId
              ? `/programs?client=${encodeURIComponent(program.clientId)}`
              : "/programs"
          }
          className="inline-flex min-h-9 items-center gap-1 text-xs font-medium text-emerald-400 hover:underline"
        >
          ← Programs
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
                {program.title}
              </h1>
              <Badge
                tone={
                  status === "active"
                    ? "green"
                    : status === "draft"
                      ? "amber"
                      : "default"
                }
                className="capitalize"
              >
                {status.replaceAll("_", " ")}
              </Badge>
              <Badge className="capitalize">
                {program.goal.replaceAll("_", " ")}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-zinc-500">
              <span className="capitalize">
                {program.splitType.replaceAll("_", " ")}
              </span>
              {" · "}
              {program.daysPerWeek}×/wk · {program.sessionMinutes} min
              {client && (
                <>
                  {" · "}
                  <Link
                    href={`/clients/${client.id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {fullName(client.firstName, client.lastName)}
                  </Link>
                </>
              )}
              {!client && (
                <span className="text-zinc-600"> · Unassigned</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveMeta}
              disabled={pending}
              className="min-h-11"
            >
              Save details
            </Button>
          </div>
        </div>
        {msg && (
          <Alert
            tone={isSuccessFlash(msg) ? "success" : "warning"}
            className="mt-3"
          >
            {msg}
          </Alert>
        )}
      </div>

      {/* Meta — collapsible */}
      <Card padding="sm" className="space-y-0">
        <button
          type="button"
          onClick={() => setMetaOpen((o) => !o)}
          className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
          aria-expanded={metaOpen}
          aria-controls="program-details-panel"
          aria-label="Program details"
        >
          <SectionLabel as="span">Program details</SectionLabel>
          {metaOpen ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
        </button>
        {metaOpen && (
          <div
            id="program-details-panel"
            className="mt-3 space-y-3 border-t border-zinc-800 pt-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Assign client</Label>
                <select
                  className="min-h-11 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none transition focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                >
                  <option value="">— Unassigned —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {fullName(c.firstName, c.lastName)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label>Coach notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Floor notes, constraints, cues for this plan…"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={saveMeta}
              disabled={pending}
              className="min-h-11"
            >
              Save details
            </Button>
          </div>
        )}
      </Card>

      {/* Training week strip */}
      <Card padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SectionLabel as="span">Training week</SectionLabel>
            <span className="text-sm font-medium text-zinc-200">
              {mesoInfo.label}
            </span>
            {mesoInfo.isDeload && <Badge tone="amber">Deload</Badge>}
            {mesoDirty ? (
              <Badge tone="amber">Not applied</Badge>
            ) : (
              <Badge tone="green">Applied</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {correctiveCount > 0 && (
              <Badge tone="green">{correctiveCount} corrective</Badge>
            )}
            {constraintSummary && (
              <span title={constraintSummary}>
                <Badge tone="sky">Constraints</Badge>
              </span>
            )}
          </div>
        </div>
        <p className="text-[11px] leading-relaxed text-zinc-500">
          {mesoInfo.notes}
          <span className="text-zinc-600">
            {" "}
            · applied {getMesocycleWeek(appliedWeek).label}
          </span>
          {suggestedFromCreated != null &&
            suggestedFromCreated !== mesoWeek && (
              <span className="text-zinc-600">
                {" "}
                · since create ≈ W{suggestedFromCreated}
              </span>
            )}
          {calendarHint && (
            <span className="text-emerald-500/80">
              {" "}
              · calendar {calendarHint.label}
            </span>
          )}
        </p>

        <div
          className="grid grid-cols-3 gap-2 sm:grid-cols-6"
          role="group"
          aria-label="Mesocycle week"
        >
          {MESOCYCLE_WEEK_OPTIONS.map((opt) => {
            const selected = mesoWeek === opt.value;
            const plan = getMesocycleWeek(opt.value);
            const isApplied = appliedWeek === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                aria-pressed={selected}
                title={plan.notes}
                disabled={pending}
                onClick={() => setMesoWeek(opt.value)}
                className={cn(
                  "min-h-11 rounded-lg border px-2 py-2 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
                  selected
                    ? plan.isDeload
                      ? "border-amber-600 bg-amber-950/40 text-amber-100 ring-1 ring-amber-500/40"
                      : "border-emerald-600 bg-emerald-950/40 text-emerald-100 ring-1 ring-emerald-500/40"
                    : isApplied
                      ? "border-zinc-600 bg-zinc-900 text-zinc-200"
                      : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                )}
              >
                <span className="block text-xs font-medium tabular-nums">
                  {opt.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={mesoDirty ? "primary" : "secondary"}
            size="sm"
            onClick={applyMesocycle}
            disabled={pending || !mesoDirty}
            className="min-h-11"
          >
            {mesoDirty ? `Apply ${mesoInfo.label}` : "Applied"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={advanceWeek}
            disabled={pending}
            className="min-h-11"
            title={`Go to ${getMesocycleWeek(nextMesocycleWeek(appliedWeek)).label}`}
          >
            Advance
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={useCalendarWeek}
            disabled={pending}
            className="min-h-11"
          >
            Calendar
          </Button>
        </div>

        {mesoProgress && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2 text-[11px] text-zinc-400">
            <span>
              Progress:{" "}
              <span className="font-medium tabular-nums text-zinc-200">
                {mesoProgress.completedInWindow} / {mesoProgress.threshold}
              </span>{" "}
              sessions this week
              {mesoProgress.autoAdvance
                ? " · auto-advance on"
                : " · auto-advance off"}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={toggleAutoAdvance}
              className="min-h-9 font-medium text-zinc-300 underline-offset-2 hover:text-emerald-400 hover:underline"
            >
              {mesoProgress.autoAdvance ? "Turn off" : "Turn on"}
            </button>
          </div>
        )}

        {constraintSummary && (
          <pre className="max-h-20 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-500">
            {constraintSummary}
          </pre>
        )}
      </Card>

      {/* Volume — compact strip */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-zinc-400">Volume (7d)</span>
          {volumeLoading && !volume ? (
            <span className="text-zinc-600">Loading…</span>
          ) : !volume || volume.totalSets === 0 ? (
            <span className="text-zinc-600">No logged sets yet</span>
          ) : (
            <>
              <span className="tabular-nums text-zinc-200">
                <span className="text-zinc-500">Sets </span>
                {volume.totalSets}
              </span>
              <span className="tabular-nums text-zinc-200">
                <span className="text-zinc-500">Sessions </span>
                {volume.sessionCount}
              </span>
              {volume.totalVolumeKg > 0 && (
                <span className="tabular-nums text-emerald-300/90">
                  {volume.totalVolumeKg}
                  <span className="text-zinc-500"> kg</span>
                </span>
              )}
              {topPatterns.length > 0 && (
                <span className="text-zinc-500">
                  Top: {topPatterns.join(" · ")}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Days */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionLabel as="h2" className="mb-0">
            Training days
          </SectionLabel>
          {days.length > 0 && (
            <p className="text-[11px] text-zinc-600">
              Start a session, add from the bank, or edit sets / reps / load
            </p>
          )}
        </div>
        {days.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-sm text-zinc-500">
            No days yet — use{" "}
            <span className="font-medium text-zinc-400">Regenerate</span> below
            or design a new program.
          </p>
        )}
        {days.map((day) => (
          <Card key={day.id} padding="sm" className="space-y-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-zinc-100">
                {day.name}
              </h3>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                {day.focus ? (
                  <>
                    <span className="text-zinc-400">{day.focus}</span>
                    <span className="mx-1.5 text-zinc-700">·</span>
                  </>
                ) : null}
                <span className="tabular-nums">{day.exercises.length}</span>{" "}
                exercise
                {day.exercises.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StartSessionButton programDayId={day.id} />
              <Button
                type="button"
                variant={addDayId === day.id ? "primary" : "secondary"}
                size="sm"
                disabled={pending}
                onClick={() => {
                  setSwapId(null);
                  setEditId(null);
                  setAddDayId((cur) => (cur === day.id ? null : day.id));
                }}
                className="min-h-11"
              >
                {addDayId === day.id ? "Cancel" : "Add exercise"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => regenerateDay(day.id, day.name)}
                title="Rebuild this day only"
                className="min-h-11"
              >
                Rebuild day
              </Button>
            </div>
          </div>
          {addDayId === day.id && (
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <ExerciseBankPicker
                title={`Add to ${day.name}`}
                disabled={pending}
                onCancel={() => setAddDayId(null)}
                onPick={(bank) => addExercise(day.id, bank)}
              />
            </div>
          )}
          <div className="mt-3 space-y-2">
            {day.exercises.length === 0 && addDayId !== day.id && (
              <p className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-3 py-3 text-center text-xs text-zinc-500">
                Empty day — tap{" "}
                <button
                  type="button"
                  className="font-medium text-emerald-400 hover:underline"
                  onClick={() => {
                    setSwapId(null);
                    setEditId(null);
                    setAddDayId(day.id);
                  }}
                >
                  Add exercise
                </button>{" "}
                or rebuild the day.
              </p>
            )}
            {groupExercisesIntoBlocks(day.exercises).map((block) => {
              const renderEx = (ex: Ex, nested: boolean) => (
                <li
                  key={ex.id}
                  className={`list-none rounded-lg border px-3 py-2.5 ${
                    nested
                      ? "border-zinc-800/80 bg-zinc-950/60"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  {swapId === ex.id ? (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/15 p-2.5">
                        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
                          Substitutions
                        </div>
                        {suggestLoading ? (
                          <p className="mt-1.5 text-[11px] text-zinc-500">
                            Ranking alternatives…
                          </p>
                        ) : suggestions.length === 0 ? (
                          <p className="mt-1.5 text-[11px] text-zinc-500">
                            No ranked matches — use the bank picker below.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {suggestions.map((s) => (
                              <button
                                key={s.id}
                                type="button"
                                disabled={pending}
                                title={
                                  s.reasons?.length
                                    ? s.reasons.join(" · ")
                                    : s.movementPattern
                                }
                                onClick={() =>
                                  swapExercise(ex.id, {
                                    id: s.id,
                                    name: s.name,
                                    movementPattern: s.movementPattern,
                                  })
                                }
                                className="max-w-[15rem] rounded-lg border border-emerald-800/50 bg-zinc-950/60 px-2.5 py-2 text-left text-xs text-zinc-200 transition hover:border-emerald-600 hover:bg-emerald-950/30 disabled:opacity-50"
                              >
                                <span className="font-medium text-zinc-100">
                                  {s.name}
                                </span>
                                <span className="mt-0.5 block text-[10px] tabular-nums text-zinc-500">
                                  score {s.score}
                                </span>
                                {s.reasons?.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {s.reasons.slice(0, 3).map((r) => (
                                      <span
                                        key={r}
                                        className="rounded-full bg-emerald-950/50 px-1.5 py-0.5 text-[10px] text-emerald-300/90 ring-1 ring-emerald-900/40"
                                      >
                                        {r}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <ExerciseBankPicker
                        preferPattern={ex.movementPattern}
                        title={`Swap “${ex.exerciseName}”`}
                        disabled={pending}
                        onCancel={() => setSwapId(null)}
                        onPick={(bank) => swapExercise(ex.id, bank)}
                      />
                    </div>
                  ) : editId === ex.id ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end gap-2">
                        <div className="min-w-[180px] flex-1">
                          <Label>Name</Label>
                          <Input
                            value={editDraft.exerciseName ?? ex.exerciseName}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                exerciseName: e.target.value,
                              })
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-11"
                          onClick={() => {
                            setEditId(null);
                            setAddDayId(null);
                            setSwapId(ex.id);
                          }}
                        >
                          From bank
                        </Button>
                      </div>
                      <div>
                        <Label>Scheme</Label>
                        {ex.groupId ? (
                          <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 px-3 py-2 text-xs text-amber-100/90">
                            Part of{" "}
                            <span className="font-medium">
                              {formatGroupTitle(ex.setScheme, ex.groupLabel)}
                            </span>
                            {formatGroupRoleTitle(ex.groupRole)
                              ? ` · ${formatGroupRoleTitle(ex.groupRole)}`
                              : ""}
                            . Change reps/RPE here; group structure comes from
                            Design program.
                          </div>
                        ) : (
                          <>
                            <select
                              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                              value={
                                editDraft.setScheme ??
                                ex.setScheme ??
                                "straight"
                              }
                              onChange={(e) =>
                                setEditDraft({
                                  ...editDraft,
                                  setScheme: e.target.value,
                                })
                              }
                            >
                              {SET_SCHEMES.filter(
                                (s) =>
                                  ![
                                    "contrast",
                                    "complex",
                                    "superset",
                                  ].includes(s.id)
                              ).map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-zinc-500">
                              {
                                SET_SCHEMES.find(
                                  (s) =>
                                    s.id ===
                                    (editDraft.setScheme ??
                                      ex.setScheme ??
                                      "straight")
                                )?.description
                              }
                            </p>
                          </>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div>
                          <Label>Sets</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={editDraft.sets ?? ex.sets}
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                sets: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Reps</Label>
                          <Input
                            value={editDraft.reps ?? ex.reps}
                            placeholder="e.g. 8–10"
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                reps: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>RPE / load</Label>
                          <Input
                            value={editDraft.rpe ?? ex.rpe ?? ""}
                            placeholder="e.g. 7–8"
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                rpe: e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <Label>Rest (sec)</Label>
                          <Input
                            type="number"
                            inputMode="numeric"
                            value={editDraft.restSec ?? ex.restSec ?? ""}
                            placeholder="90"
                            onChange={(e) =>
                              setEditDraft({
                                ...editDraft,
                                restSec:
                                  e.target.value === ""
                                    ? null
                                    : Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      {!ex.groupId && (
                        <p className="text-[11px] text-zinc-600">
                          Changing scheme rebuilds the set plan. Contrast /
                          complex / superset come from Design program.
                        </p>
                      )}
                      <Textarea
                        value={editDraft.notes ?? ex.notes ?? ""}
                        onChange={(e) =>
                          setEditDraft({ ...editDraft, notes: e.target.value })
                        }
                        placeholder="Cues / notes"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={saveExercise}
                          disabled={pending}
                          className="min-h-11"
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditId(null)}
                          className="min-h-11"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {nested && (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-950/50 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-800/40">
                              {formatGroupBadge(
                                ex.groupRole,
                                ex.groupOrder ?? 0
                              )}
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-zinc-100">
                              {ex.isWarmup && (
                                <span className="mr-1.5 text-[10px] font-semibold uppercase text-emerald-400">
                                  Warm-up
                                </span>
                              )}
                              {ex.exerciseName}
                            </div>
                            {nested && formatGroupRoleTitle(ex.groupRole) && (
                              <div className="text-[11px] text-amber-200/70">
                                {formatGroupRoleTitle(ex.groupRole)}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Prescription chips — scan sets / reps / load */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {!nested && (
                            <Badge
                              tone={
                                ex.setScheme && ex.setScheme !== "straight"
                                  ? "amber"
                                  : "default"
                              }
                            >
                              {formatSchemeName(ex.setScheme)}
                            </Badge>
                          )}
                          {nested || !ex.setSchemeMeta?.summary ? (
                            <>
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[11px] tabular-nums ring-1 ring-zinc-800">
                                <span className="font-medium text-zinc-500">
                                  Sets
                                </span>
                                <span className="text-zinc-200">{ex.sets}</span>
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[11px] tabular-nums ring-1 ring-zinc-800">
                                <span className="font-medium text-zinc-500">
                                  Reps
                                </span>
                                <span className="text-zinc-200">{ex.reps}</span>
                              </span>
                              {ex.rpe ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[11px] tabular-nums ring-1 ring-zinc-800">
                                  <span className="font-medium text-zinc-500">
                                    RPE
                                  </span>
                                  <span className="text-zinc-200">{ex.rpe}</span>
                                </span>
                              ) : null}
                              {!nested && ex.restSec ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-900/80 px-1.5 py-0.5 text-[11px] tabular-nums ring-1 ring-zinc-800">
                                  <span className="font-medium text-zinc-500">
                                    Rest
                                  </span>
                                  <span className="text-zinc-200">
                                    {formatRestLabel(ex.restSec)}
                                  </span>
                                </span>
                              ) : null}
                            </>
                          ) : (
                            <span className="text-xs tabular-nums text-zinc-400">
                              {formatPrescription({
                                sets: ex.sets,
                                reps: ex.reps,
                                rpe: ex.rpe,
                                summary: ex.setSchemeMeta.summary,
                              })}
                              {ex.restSec
                                ? ` · ${formatRestLabel(ex.restSec)}`
                                : ""}
                            </span>
                          )}
                        </div>

                        {nested && (
                          <div className="mt-1 text-[11px] text-zinc-500">
                            {ex.restAfterSec != null && ex.restAfterSec > 0
                              ? `${formatRestLabel(ex.restAfterSec)} before next`
                              : ex.restBetweenRoundsSec != null
                                ? `${formatRestLabel(ex.restBetweenRoundsSec)} after round`
                                : null}
                          </div>
                        )}
                        {!nested && ex.setSchemeMeta?.howTo && (
                          <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-zinc-600">
                            {ex.setSchemeMeta.howTo}
                          </div>
                        )}
                        {ex.notes && (
                          <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                            {ex.notes}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 px-2.5 text-xs"
                          onClick={() => {
                            setEditId(null);
                            setAddDayId(null);
                            setSwapId(ex.id);
                          }}
                        >
                          Swap
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 px-2.5 text-xs"
                          onClick={() => {
                            setSwapId(null);
                            setAddDayId(null);
                            setEditId(ex.id);
                            setEditDraft(ex);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="min-h-11 min-w-11 px-2.5 text-xs text-red-400"
                          onClick={() => removeExercise(ex.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );

              if (block.type === "group") {
                return (
                  <div
                    key={block.groupId}
                    className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-2.5"
                  >
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <Badge tone="amber">
                        {formatSchemeName(block.kind)}
                      </Badge>
                      <span className="text-xs font-semibold text-zinc-100">
                        {formatGroupTitle(block.kind, block.label)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {block.rounds} rounds ·{" "}
                        {formatRestLabel(block.restBetweenRoundsSec)} between
                        rounds
                      </span>
                    </div>
                    {block.howTo && (
                      <p className="mb-2 text-[11px] text-zinc-500">
                        {block.howTo}
                      </p>
                    )}
                    <ul className="space-y-1.5">
                      {block.members.map((ex) => renderEx(ex, true))}
                    </ul>
                  </div>
                );
              }

              return (
                <ul key={block.exercise.id} className="space-y-1.5">
                  {renderEx(block.exercise, false)}
                </ul>
              );
            })}
          </div>
          </Card>
        ))}
      </section>

      {/* Tools row */}
      <Card padding="sm">
        <SectionLabel as="div" className="mb-2.5">
          Tools
        </SectionLabel>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={regenerateProgram}
            disabled={pending}
            className="min-h-11"
          >
            Rebuild program
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={insertCorrectives}
            disabled={pending || !hasClient}
            className="min-h-11"
            title={
              !hasClient
                ? "Assign a client to pull assessment correctives"
                : undefined
            }
          >
            Add correctives
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={removeProgram}
            disabled={pending}
            className="min-h-11"
          >
            Delete program
          </Button>
          {!hasClient && (
            <span className="text-[11px] leading-snug text-zinc-500">
              Assign a client for correctives and injury-aware rebuilds.
            </span>
          )}
        </div>
      </Card>
    </PageShell>
  );
}
