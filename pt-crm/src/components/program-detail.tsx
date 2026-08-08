"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  addProgramDayAction,
  addProgramExerciseAction,
  advanceMesocycleWeekAction,
  applyMesocycleToProgramAction,
  deleteProgramAction,
  deleteProgramDayAction,
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
  updateProgramDayAction,
  updateProgramExerciseAction,
  updateProgramMetaAction,
} from "@/app/actions/programs";
import { scratchBuildProgress } from "@/lib/program-scratch";
import {
  matchesScienceOrder,
  sessionPhase,
  sessionPhaseLabel,
} from "@/lib/exercise-order";
import { isCooldownMeta } from "@/lib/session-prep";
import { groupExercisesIntoBlocks } from "@/lib/exercise-groups";
import {
  getMesocycleWeek,
  MESOCYCLE_WEEK_OPTIONS,
  nextMesocycleWeek,
  suggestMesocycleWeekFromStartDate,
} from "@/lib/mesocycle";
import {
  analyzeProgramPlan,
  formatRestSuggestion,
  recommendedRestSec,
  suggestFillPatterns,
} from "@/lib/program-science";
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
    phase?: string;
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
  startInBuildMode = false,
}: {
  program: Program;
  client: { id: string; firstName: string; lastName: string } | null;
  days: Day[];
  clients: { id: string; firstName: string; lastName: string }[];
  /** Open first empty day picker after create-from-scratch */
  startInBuildMode?: boolean;
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
  /** When opening Add exercise from a fill chip, prefer this pattern. */
  const [addPreferPattern, setAddPreferPattern] = useState<string | null>(null);
  const [renameDayId, setRenameDayId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState({ name: "", focus: "" });
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
  const isScratch =
    program.generationMeta?.source === "scratch" ||
    program.generationMeta?.manual === true;
  const buildProgress = useMemo(
    () => scratchBuildProgress(days),
    [days]
  );
  const needsBuildHelp =
    isScratch ||
    buildProgress.totalExercises === 0 ||
    buildProgress.emptyDayIndexes.length > 0;

  // After create-from-scratch: open first empty day picker once
  useEffect(() => {
    if (!startInBuildMode) return;
    const firstEmpty = days.find((d) => d.exercises.length === 0);
    if (firstEmpty) {
      setAddDayId(firstEmpty.id);
      setMsg(
        "Shell ready — fill each day from the bank. Plan balance updates as you go."
      );
    }
    router.replace(`/programs/${program.id}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once after create
  }, [startInBuildMode]);
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
        // Keep bank open so you can stack several exercises on a day
        setAddPreferPattern(null);
        setMsg(
          `Added ${res.name} to ${res.dayName} (science order) — pick another or Cancel`
        );
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

  /** Planned weekly structure (not logged volume) — sets, push:pull, order, time. */
  const planScience = useMemo(
    () =>
      analyzeProgramPlan(
        days.map((d) => ({
          name: d.name,
          exercises: d.exercises.map((ex) => ({
            sets: ex.sets,
            reps: ex.reps,
            rpe: ex.rpe,
            restSec: ex.restSec,
            isWarmup: ex.isWarmup,
            movementPattern: ex.movementPattern,
            exerciseName: ex.exerciseName,
            setScheme: ex.setScheme,
          })),
        })),
        { goal: program.goal, sessionMinutes: program.sessionMinutes }
      ),
    [days, program.goal, program.sessionMinutes]
  );

  const dayMinuteByName = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of planScience.dayEstimates) m.set(d.name, d.minutes);
    return m;
  }, [planScience.dayEstimates]);

  const fillSuggestions = useMemo(
    () =>
      suggestFillPatterns(planScience, {
        goal: program.goal,
        limit: 4,
      }),
    [planScience, program.goal]
  );

  function addDay() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await addProgramDayAction(program.id);
        setMsg(`Added ${res.name}`);
        setAddDayId(res.dayId);
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not add day");
      }
    });
  }

  function saveDayMeta(dayId: string) {
    setMsg(null);
    startTransition(async () => {
      try {
        await updateProgramDayAction(dayId, {
          name: renameDraft.name,
          focus: renameDraft.focus || null,
        });
        setRenameDayId(null);
        setMsg("Day updated");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not update day");
      }
    });
  }

  function removeDay(dayId: string, hasExercises: boolean) {
    if (hasExercises) {
      if (
        !confirm(
          "Delete this day and all its exercises? This cannot be undone."
        )
      ) {
        return;
      }
    }
    setMsg(null);
    startTransition(async () => {
      try {
        await deleteProgramDayAction(dayId, { force: hasExercises });
        if (addDayId === dayId) setAddDayId(null);
        setMsg("Day removed");
        router.refresh();
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Could not remove day");
      }
    });
  }

  function openAddOnFirstDay(pattern?: string | null) {
    const day = days[0];
    if (!day) {
      setMsg("No training days — add a day first");
      return;
    }
    setSwapId(null);
    setEditId(null);
    setAddPreferPattern(pattern || null);
    setAddDayId(day.id);
    setMsg(
      pattern
        ? `Pick a ${pattern.replaceAll("_", " ")} exercise for ${day.name}`
        : null
    );
  }

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
              {isScratch && (
                <Badge tone="amber">From scratch</Badge>
              )}
              {status === "draft" && !client && (
                <Badge tone="amber">Saved for later</Badge>
              )}
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
                <span className="text-zinc-600">
                  {" "}
                  · Unassigned — assign a client when ready
                </span>
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

      {/* Scratch / incomplete build checklist */}
      {needsBuildHelp && (
        <Card
          padding="sm"
          className={cn(
            "space-y-2.5",
            isScratch
              ? "border-amber-900/40 bg-amber-950/15"
              : "border-zinc-800 bg-zinc-950/40"
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/90">
                Build checklist
              </p>
              <p className="mt-0.5 text-sm text-zinc-300">
                <span className="tabular-nums font-medium text-zinc-100">
                  {buildProgress.daysWithWork}/{buildProgress.totalDays || 0}
                </span>{" "}
                days filled
                {buildProgress.totalExercises > 0 && (
                  <>
                    {" · "}
                    <span className="tabular-nums">
                      {buildProgress.totalExercises}
                    </span>{" "}
                    exercises
                  </>
                )}
                {buildProgress.complete && (
                  <span className="text-zinc-500">
                    {" "}
                    · shell full — assign & activate when ready
                  </span>
                )}
              </p>
            </div>
            {!buildProgress.complete && days.length > 0 && (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                className="min-h-11"
                onClick={() => {
                  const empty = days.find((d) => d.exercises.length === 0);
                  if (empty) {
                    setAddDayId(empty.id);
                    setSwapId(null);
                    setEditId(null);
                  }
                }}
              >
                Next empty day
              </Button>
            )}
          </div>
          {days.length > 0 && (
            <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-900">
              <div
                className="rounded-full bg-emerald-500 transition-all"
                style={{
                  width: `${
                    buildProgress.totalDays
                      ? (100 * buildProgress.daysWithWork) /
                        buildProgress.totalDays
                      : 0
                  }%`,
                }}
              />
            </div>
          )}
          <ol className="grid gap-1.5 text-[11px] text-zinc-500 sm:grid-cols-3">
            <li
              className={
                buildProgress.totalDays > 0 ? "text-emerald-400/90" : ""
              }
            >
              <span className="tabular-nums font-semibold text-zinc-600">
                1.
              </span>{" "}
              Days laid out
            </li>
            <li
              className={
                buildProgress.complete
                  ? "text-emerald-400/90"
                  : buildProgress.daysWithWork > 0
                    ? "text-amber-200/80"
                    : ""
              }
            >
              <span className="tabular-nums font-semibold text-zinc-600">
                2.
              </span>{" "}
              Fill each day from bank
            </li>
            <li
              className={
                status === "active" && !!clientId ? "text-emerald-400/90" : ""
              }
            >
              <span className="tabular-nums font-semibold text-zinc-600">
                3.
              </span>{" "}
              Assign client · set Active
            </li>
          </ol>
          {status === "draft" && !client && (
            <p className="text-[11px] leading-snug text-zinc-500">
              Unassigned template — open{" "}
              <button
                type="button"
                className="font-medium text-emerald-400 hover:underline"
                onClick={() => setMetaOpen(true)}
              >
                Program details
              </button>{" "}
              to assign when ready.
            </p>
          )}
        </Card>
      )}

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
          <SectionLabel as="span">
            Program details
            {status === "draft" && !client ? (
              <span className="ml-2 text-[11px] font-normal normal-case tracking-normal text-amber-400/80">
                · assign client here
              </span>
            ) : null}
          </SectionLabel>
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

      {/* Volume — compact strip (logged) */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-zinc-400">Logged volume (7d)</span>
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

      {/* Plan science — planned weekly sets, push:pull, session length */}
      {planScience.weeklyWorkingSets > 0 && (
        <Card padding="sm" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <SectionLabel as="h2" className="mb-0.5">
                Plan balance
              </SectionLabel>
              <p className="text-[11px] text-zinc-500">
                Planned working sets across the week ·{" "}
                <span className="capitalize">
                  {program.goal.replaceAll("_", " ")}
                </span>{" "}
                landmarks (not medical protocol)
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="tabular-nums text-zinc-200">
                <span className="text-zinc-500">Working sets </span>
                {planScience.weeklyWorkingSets}
              </span>
              {planScience.pushPullNote && (
                <span
                  className={cn(
                    "rounded-md border px-2 py-0.5 tabular-nums",
                    planScience.pushPullRatio != null &&
                      planScience.pushPullRatio < 0.75
                      ? "border-amber-800/50 bg-amber-950/30 text-amber-100/90"
                      : "border-zinc-800 bg-zinc-950/50 text-zinc-400"
                  )}
                  title="Pull:push working-set ratio"
                >
                  Pull {planScience.pullSets} · Push {planScience.pushSets}
                  {planScience.pushPullRatio != null
                    ? ` (${planScience.pushPullRatio}:1)`
                    : ""}
                </span>
              )}
            </div>
          </div>

          {planScience.byPattern.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {planScience.byPattern.map((row) => (
                <span
                  key={row.pattern}
                  title={`${row.label}: ${row.sets} working sets/wk · guide ${row.guide}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px]",
                    row.band === "ok" &&
                      "border-emerald-900/40 bg-emerald-950/20 text-emerald-100/90",
                    row.band === "low" &&
                      "border-zinc-700 bg-zinc-900/80 text-zinc-400",
                    row.band === "high" &&
                      "border-amber-800/50 bg-amber-950/25 text-amber-100/90",
                    row.band === "na" &&
                      "border-zinc-800 bg-zinc-950/40 text-zinc-500"
                  )}
                >
                  <span className="font-medium">{row.label}</span>
                  <span className="tabular-nums">{row.sets}</span>
                  <span className="text-[10px] opacity-70">{row.guide}</span>
                </span>
              ))}
            </div>
          )}

          {fillSuggestions.length > 0 && days.length > 0 && (
            <div className="border-t border-zinc-800/80 pt-2">
              <p className="mb-1.5 text-[11px] font-medium text-zinc-500">
                Fill next (science)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {fillSuggestions.map((s) => (
                  <button
                    key={s.pattern}
                    type="button"
                    disabled={pending}
                    title={s.reason}
                    onClick={() => openAddOnFirstDay(s.pattern)}
                    className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-2.5 py-1.5 text-left text-[11px] text-emerald-100/90 transition hover:border-emerald-600 hover:bg-emerald-950/40 disabled:opacity-50"
                  >
                    <span className="font-medium">+ {s.label}</span>
                    <span className="ml-1.5 tabular-nums text-emerald-400/70">
                      ~{s.setsShort} sets
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {planScience.flags.length > 0 && (
            <ul className="space-y-1 border-t border-zinc-800/80 pt-2">
              {planScience.flags.slice(0, 5).map((f) => (
                <li
                  key={f.message}
                  className={cn(
                    "text-[11px] leading-snug",
                    f.severity === "warn"
                      ? "text-amber-200/90"
                      : "text-zinc-500"
                  )}
                >
                  <span className="mr-1 opacity-70">
                    {f.severity === "warn" ? "⚠" : "·"}
                  </span>
                  {f.message}
                </li>
              ))}
              {planScience.flags.length > 5 && (
                <li className="text-[11px] text-zinc-600">
                  +{planScience.flags.length - 5} more notes
                </li>
              )}
            </ul>
          )}
        </Card>
      )}

      {/* Days */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <SectionLabel as="h2" className="mb-0">
            Training days
          </SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            {days.length > 0 && (
              <p className="text-[11px] text-zinc-600">
                Start a session, add from the bank, or edit sets / reps / rest
              </p>
            )}
            {days.length < 6 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={addDay}
                className="min-h-11"
              >
                Add day
              </Button>
            )}
          </div>
        </div>
        {days.length === 0 && (
          <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-950/30 px-4 py-6 text-center text-sm text-zinc-500">
            No days yet —{" "}
            <button
              type="button"
              disabled={pending}
              onClick={addDay}
              className="font-medium text-emerald-400 hover:underline disabled:opacity-50"
            >
              Add a day
            </button>
            , then use{" "}
            <span className="font-medium text-zinc-400">Add exercise</span> on
            each day.
          </p>
        )}
        {days.map((day) => (
          <Card
            key={day.id}
            padding="sm"
            className={cn(
              "space-y-0",
              day.exercises.length === 0 &&
                "border-dashed border-zinc-700/80 bg-zinc-950/20"
            )}
          >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              {renameDayId === day.id ? (
                <div className="space-y-2">
                  <Input
                    value={renameDraft.name}
                    onChange={(e) =>
                      setRenameDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="Day name"
                    className="max-w-xs"
                    disabled={pending}
                  />
                  <Input
                    value={renameDraft.focus}
                    onChange={(e) =>
                      setRenameDraft((d) => ({ ...d, focus: e.target.value }))
                    }
                    placeholder="Focus (optional)"
                    className="max-w-xs"
                    disabled={pending}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending || !renameDraft.name.trim()}
                      onClick={() => saveDayMeta(day.id)}
                      className="min-h-11"
                    >
                      Save name
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => setRenameDayId(null)}
                      className="min-h-11"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <h3 className="text-sm font-semibold text-zinc-100">
                    {day.name}
                    {day.exercises.length === 0 && (
                      <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-amber-400/80">
                        Empty
                      </span>
                    )}
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
                    {dayMinuteByName.get(day.name) != null &&
                      day.exercises.length > 0 && (
                        <>
                          <span className="mx-1.5 text-zinc-700">·</span>
                          <span
                            className={cn(
                              "tabular-nums",
                              planScience.dayEstimates.find(
                                (d) => d.name === day.name
                              )?.overSessionCap
                                ? "text-amber-300/90"
                                : "text-zinc-400"
                            )}
                            title="Estimated session length from sets + rest"
                          >
                            ~{dayMinuteByName.get(day.name)} min
                          </span>
                        </>
                      )}
                  </p>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {day.exercises.length > 0 && (
                <StartSessionButton programDayId={day.id} />
              )}
              <Button
                type="button"
                variant={
                  addDayId === day.id
                    ? "primary"
                    : day.exercises.length === 0
                      ? "primary"
                      : "secondary"
                }
                size="sm"
                disabled={pending}
                onClick={() => {
                  setSwapId(null);
                  setEditId(null);
                  setRenameDayId(null);
                  if (addDayId === day.id) {
                    setAddDayId(null);
                    setAddPreferPattern(null);
                  } else {
                    setAddPreferPattern(null);
                    setAddDayId(day.id);
                  }
                }}
                className="min-h-11"
              >
                {addDayId === day.id
                  ? "Cancel"
                  : day.exercises.length === 0
                    ? "Add first exercise"
                    : "Add exercise"}
              </Button>
              {day.exercises.length > 0 && !isScratch && (
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
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setRenameDayId(day.id);
                  setRenameDraft({
                    name: day.name,
                    focus: day.focus || "",
                  });
                  setAddDayId(null);
                }}
                className="min-h-11"
              >
                Rename
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => removeDay(day.id, day.exercises.length > 0)}
                className="min-h-11 text-zinc-500 hover:text-red-300"
                title="Remove day"
              >
                Remove
              </Button>
            </div>
          </div>
          {addDayId === day.id && (
            <div className="mt-3 border-t border-zinc-800 pt-3">
              <ExerciseBankPicker
                title={`Add to ${day.name}`}
                disabled={pending}
                goal={program.goal}
                preferPattern={addPreferPattern}
                preferPatterns={
                  addPreferPattern
                    ? [addPreferPattern, ...fillSuggestions.map((f) => f.pattern)]
                    : fillSuggestions.map((f) => f.pattern)
                }
                onCancel={() => {
                  setAddDayId(null);
                  setAddPreferPattern(null);
                }}
                onPick={(bank) => {
                  setAddPreferPattern(null);
                  addExercise(day.id, bank);
                }}
              />
            </div>
          )}
          <div className="mt-3 space-y-2">
            {day.exercises.length === 0 && addDayId !== day.id && (
              <div className="rounded-lg border border-dashed border-emerald-900/40 bg-emerald-950/10 px-3 py-4 text-center">
                <p className="text-xs text-zinc-400">
                  Empty day — warm-up → compounds → accessories → cool-down.
                  Plan balance tracks weekly volume.
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  className="mt-2 min-h-11"
                  onClick={() => {
                    setSwapId(null);
                    setEditId(null);
                    setAddDayId(day.id);
                  }}
                >
                  Add first exercise
                </Button>
              </div>
            )}
            {day.exercises.length >= 2 &&
              !matchesScienceOrder(
                day.exercises.map((ex) => ({
                  id: ex.id,
                  exerciseName: ex.exerciseName,
                  movementPattern: ex.movementPattern,
                  isWarmup: ex.isWarmup,
                  setScheme: ex.setScheme,
                  setSchemeMeta: ex.setSchemeMeta,
                  groupId: ex.groupId,
                  groupOrder: ex.groupOrder,
                  sortOrder: ex.sortOrder,
                })),
                {
                  focus: day.focus,
                  sessionKind: day.name,
                  goal: program.goal,
                }
              ) && (
                <p className="rounded-md border border-zinc-800/80 bg-zinc-950/30 px-2.5 py-1.5 text-[11px] leading-snug text-zinc-500">
                  Order differs from usual science sequence. New adds still
                  insert by science; nothing reorders until you change the
                  day.
                </p>
              )}
            {(() => {
              const blocks = groupExercisesIntoBlocks(day.exercises);
              const phaseOfBlock = (
                block: (typeof blocks)[number]
              ): "warmup" | "work" | "cooldown" => {
                const ex =
                  block.type === "group" ? block.members[0]! : block.exercise;
                return sessionPhase(ex);
              };
              const phasesInDay = new Set(blocks.map(phaseOfBlock));
              const showPhaseHeaders =
                phasesInDay.has("warmup") || phasesInDay.has("cooldown");

              const renderEx = (ex: Ex, nested: boolean) => {
                const phase = sessionPhase(ex);
                const phaseBorder =
                  !nested && phase === "warmup"
                    ? "border-l-2 border-l-emerald-700/60 border-zinc-800 bg-emerald-950/10"
                    : !nested && phase === "cooldown"
                      ? "border-l-2 border-l-zinc-500 border-zinc-800 bg-zinc-950/50"
                      : nested
                        ? "border-zinc-800/80 bg-zinc-950/60"
                        : "border-zinc-800 bg-zinc-950/40";
                return (
                <li
                  key={ex.id}
                  className={`list-none rounded-lg border px-3 py-2.5 ${phaseBorder}`}
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
                      {(() => {
                        const restHint = recommendedRestSec({
                          goal: program.goal,
                          pattern: ex.movementPattern,
                          isWarmup: ex.isWarmup,
                          reps: editDraft.reps ?? ex.reps,
                        });
                        const current =
                          editDraft.restSec !== undefined
                            ? editDraft.restSec
                            : ex.restSec;
                        const differs =
                          current == null || current !== restHint.restSec;
                        return (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                            <span title={restHint.rationale}>
                              Science rest:{" "}
                              <span className="tabular-nums text-zinc-300">
                                {formatRestSuggestion(restHint.restSec)}
                              </span>
                              <span className="text-zinc-600">
                                {" "}
                                ({restHint.restSec}s)
                              </span>
                            </span>
                            {differs && (
                              <button
                                type="button"
                                className="font-medium text-emerald-400 underline-offset-2 hover:underline"
                                onClick={() =>
                                  setEditDraft({
                                    ...editDraft,
                                    restSec: restHint.restSec,
                                  })
                                }
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        );
                      })()}
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
                              {/* Phase chip when day has no section headers (single-phase day) */}
                              {!showPhaseHeaders && ex.isWarmup && (
                                <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                                  Warm-up
                                </span>
                              )}
                              {!showPhaseHeaders &&
                                !ex.isWarmup &&
                                isCooldownMeta(ex.setSchemeMeta) && (
                                  <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                                    Cool-down
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
              };

              return blocks.map((block, blockIndex) => {
                const phase = phaseOfBlock(block);
                const prevPhase =
                  blockIndex > 0
                    ? phaseOfBlock(blocks[blockIndex - 1]!)
                    : null;
                const showHeader =
                  showPhaseHeaders && phase !== prevPhase;
                const blockKey =
                  block.type === "group"
                    ? block.groupId
                    : block.exercise.id;

                const blockBody =
                  block.type === "group" ? (
                    <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 p-2.5">
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
                  ) : (
                    <ul className="space-y-1.5">
                      {renderEx(block.exercise, false)}
                    </ul>
                  );

                return (
                  <div key={blockKey} className="space-y-2">
                    {showHeader && (
                      <div
                        className={cn(
                          "flex items-center gap-2",
                          blockIndex > 0 && "pt-1"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wide",
                            phase === "warmup"
                              ? "text-emerald-400/90"
                              : "text-zinc-400"
                          )}
                        >
                          {sessionPhaseLabel(phase)}
                        </span>
                        <div className="h-px flex-1 bg-zinc-800/90" />
                      </div>
                    )}
                    {blockBody}
                  </div>
                );
              });
            })()}
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
