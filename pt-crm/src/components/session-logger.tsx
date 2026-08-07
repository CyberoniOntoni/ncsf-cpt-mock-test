"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createClientAppointmentAction,
} from "@/app/actions/crm";
import {
  addExerciseToSessionAction,
  cancelSessionAction,
  deleteSessionAction,
  completeSessionAction,
  getExerciseCuesForSessionAction,
  getLastWeightsForExerciseAction,
  getPreviousLoadsForSessionAction,
  getSessionSummaryTextAction,
  promoteSessionExerciseToProgramAction,
  saveSessionProgressAction,
  type ExerciseCueEntry,
  type PreviousLoadEntry,
  type SessionExerciseUpdate,
} from "@/app/actions/sessions";
import { HomeQuickCheckIn } from "@/components/home-quick-checkin";
import { ExerciseBankPicker } from "@/components/exercise-bank-picker";
import type { SessionSetLog } from "@/db/schema";
import { canPromoteSessionLogToProgram } from "@/lib/program-exercise-add";
import {
  emomRestSeconds,
  formatEmomRestLabel,
  isEmomScheme,
} from "@/lib/emom-clock";
import { groupExercisesIntoBlocks } from "@/lib/exercise-groups";
import {
  clearSessionDraft,
  isDraftNewerThan,
  loadSessionDraft,
  mergeDraftIntoLogs,
  saveSessionDraft,
} from "@/lib/session-draft";
import {
  defaultExerciseCollapsed,
  groupContainsCurrent,
} from "@/lib/session-focus";
import { applyPreviousWeights, ensureSetLogs } from "@/lib/session-sets";
import {
  buildSessionSummaryText,
  formatRelativeSessionDay,
} from "@/lib/session-summary";
import { isProgramMetaDump } from "@/lib/session-notes";
import {
  applyUndoToLogs,
  SessionUndoStack,
  type SessionUndoEntry,
} from "@/lib/session-undo";
import {
  compareToPrevious,
  formatPrStrip,
} from "@/lib/set-performance";
import {
  formatGroupBadge,
  formatGroupFlow,
  formatGroupRoleTitle,
  formatGroupTitle,
  formatPattern,
  formatPrescription,
  formatRestLabel,
  formatSchemeFullName,
  formatSchemeName,
  formatSetNote,
  formatSetRole,
  formatTempo,
} from "@/lib/workout-labels";
import { cn, fullName } from "@/lib/utils";
import { FocusShell } from "@/components/page-shell";
import { FloorRestTimer } from "./session-rest-timer";
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
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Keyboard,
  Minus,
  Plus,
  Share2,
  Timer,
  TrendingUp,
  Undo2,
} from "lucide-react";

const RPE_PRESETS = ["6", "7", "7.5", "8", "8.5", "9", "10"];
const SESSION_RPE = ["5", "6", "7", "8", "9", "10"];
const DEFAULT_REST_SEC = 90;

/** Next whole hour local datetime-local value */
function defaultNextHourLocal() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const SUGGESTION_TONE: Record<string, string> = {
  load: "border-emerald-800/50 bg-emerald-950/30 text-emerald-100",
  reps: "border-sky-800/50 bg-sky-950/30 text-sky-100",
  hold: "border-amber-800/50 bg-amber-950/30 text-amber-100",
  form: "border-zinc-700 bg-zinc-900/60 text-zinc-300",
};

type Log = {
  id: string;
  exerciseId?: string | null;
  programExerciseId?: string | null;
  exerciseName: string;
  isWarmup: boolean;
  plannedSets: number | null;
  plannedReps: string | null;
  actualSets: number | null;
  actualReps: string | null;
  weightKg: number | null;
  rpe: string | null;
  completed: boolean;
  notes: string | null;
  movementPattern: string | null;
  setLogs?: SessionSetLog[] | null;
  setScheme?: string | null;
  setSchemeMeta?: {
    summary?: string;
    howTo?: string;
    tempo?: string;
    group?: {
      rounds?: number;
      restBetweenExercisesSec?: number;
      restBetweenRoundsSec?: number;
    };
  } | null;
  sortOrder?: number | null;
  groupId?: string | null;
  groupKind?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
  restAfterSec?: number | null;
  restBetweenRoundsSec?: number | null;
  groupRole?: string | null;
};

type Session = {
  id: string;
  title: string;
  status: string;
  durationMin: number | null;
  overallRpe: string | null;
  painNotes: string | null;
  notes: string | null;
  performedAt: Date | string | null;
  programId: string | null;
  programDayId?: string | null;
  clientId: string | null;
  updatedAt?: Date | string | null;
};

function snapshotSetLogs(
  setLogs: SessionSetLog[] | null | undefined
): NonNullable<SessionUndoEntry["before"]["setLogs"]> {
  return (setLogs || []).map((s) => ({
    setIndex: s.setIndex,
    reps: s.reps,
    weightKg: s.weightKg,
    rpe: s.rpe,
    completed: s.completed,
    role: s.role ?? null,
    tempo: s.tempo ?? null,
    restSec: s.restSec ?? null,
    note: s.note ?? null,
    pain: s.pain ?? null,
  }));
}

function normalizeLogs(logs: Log[]): Log[] {
  return logs.map((l) => ({
    ...l,
    setLogs: ensureSetLogs(l),
  }));
}

const cellInput =
  "h-11 w-full min-w-0 rounded-lg border border-zinc-700 bg-zinc-950 px-2 text-center text-base font-medium text-zinc-100 tabular-nums outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-50";

export function SessionLogger({
  session,
  client,
  program,
  logs: initialLogs,
}: {
  session: Session;
  client: { id: string; firstName: string; lastName: string } | null;
  program: { id: string; title: string } | null;
  logs: Log[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [msgTone, setMsgTone] = useState<"info" | "success" | "error">("info");
  const [durationMin, setDurationMin] = useState(
    session.durationMin?.toString() || ""
  );
  const [overallRpe, setOverallRpe] = useState(session.overallRpe || "");
  const [painNotes, setPainNotes] = useState(session.painNotes || "");
  const [notes, setNotes] = useState(session.notes || "");
  const [logs, setLogs] = useState(() => normalizeLogs(initialLogs));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const dirtyRef = useRef(false);
  const [isDirty, setIsDirty] = useState(false);
  const undoStackRef = useRef(new SessionUndoStack(40));
  const draftRestoredRef = useRef(false);
  const [undoVersion, setUndoVersion] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [prevLoads, setPrevLoads] = useState<Record<string, PreviousLoadEntry>>(
    {}
  );
  const [exerciseCues, setExerciseCues] = useState<
    Record<string, ExerciseCueEntry>
  >({});
  const [showBookNext, setShowBookNext] = useState(false);
  const [bookStart, setBookStart] = useState(() => defaultNextHourLocal());
  const [bookTitle, setBookTitle] = useState("");
  const [bookDuration, setBookDuration] = useState(() =>
    String(
      session.status === "completed" &&
        session.durationMin &&
        session.durationMin > 0
        ? session.durationMin
        : 60
    )
  );
  const [bookedLine, setBookedLine] = useState<string | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [promotedLogIds, setPromotedLogIds] = useState<Record<string, true>>(
    {}
  );
  /** Prefer native Share when available (one emerald CTA on close-loop). */
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [restActive, setRestActive] = useState<{
    seconds: number;
    label: string;
    token: number;
    mode?: "rest" | "emom";
    subtitle?: string;
  } | null>(null);
  const [rpeFocus, setRpeFocus] = useState<{
    logId: string;
    setIndex: number;
  } | null>(null);
  const [summaryText, setSummaryText] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [autoRest, setAutoRest] = useState(true);
  /** Optimistic status after complete (before server refresh lands). */
  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const startedAtRef = useRef<number>(
    session.performedAt ? new Date(session.performedAt).getTime() : Date.now()
  );

  const status = statusOverride ?? session.status;
  const readonly = status === "completed" || status === "cancelled";

  // Sync override when server status catches up (or changes from outside).
  useEffect(() => {
    if (statusOverride != null && session.status === statusOverride) {
      setStatusOverride(null);
    } else if (
      statusOverride != null &&
      (session.status === "completed" || session.status === "cancelled") &&
      session.status !== statusOverride
    ) {
      setStatusOverride(null);
    }
  }, [session.status, statusOverride]);

  // void undoVersion so re-renders after push/pop re-read canUndo
  const canUndo = undoVersion >= 0 && undoStackRef.current.canUndo;

  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(text: string, tone: "info" | "success" | "error" = "info") {
    setMsg(text);
    setMsgTone(tone);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    if (tone !== "error") {
      flashTimerRef.current = setTimeout(() => setMsg(null), 3200);
    }
  }

  function markDirty() {
    dirtyRef.current = true;
    setIsDirty(true);
  }

  function markClean() {
    dirtyRef.current = false;
    setIsDirty(false);
  }

  function pushUndo(entry: SessionUndoEntry) {
    undoStackRef.current.push(entry);
    setUndoVersion((v) => v + 1);
  }

  function performUndo() {
    const entry = undoStackRef.current.pop();
    if (!entry) return;
    setUndoVersion((v) => v + 1);
    setLogs((prev) => {
      const restored = applyUndoToLogs(
        prev.map((l) => ({
          id: l.id,
          setLogs: l.setLogs ?? undefined,
          completed: l.completed,
          notes: l.notes,
        })),
        entry
      );
      const byId = new Map(restored.map((r) => [r.id, r]));
      return prev.map((l) => {
        const r = byId.get(l.id);
        if (!r) return l;
        return {
          ...l,
          setLogs: r.setLogs ?? l.setLogs,
          completed: r.completed ?? l.completed,
          notes: r.notes !== undefined ? r.notes : l.notes,
        };
      });
    });
    markDirty();
    flash(`Undid: ${entry.label}`, "info");
  }

  useEffect(() => {
    let next = normalizeLogs(initialLogs);
    if (!readonly && !draftRestoredRef.current) {
      const draft = loadSessionDraft(session.id);
      if (draft && isDraftNewerThan(draft, session.updatedAt)) {
        draftRestoredRef.current = true;
        next = mergeDraftIntoLogs(next, draft.logs);
        if (draft.durationMin != null && draft.durationMin !== "") {
          setDurationMin(draft.durationMin);
        }
        if (draft.overallRpe != null) setOverallRpe(draft.overallRpe);
        if (draft.painNotes != null) setPainNotes(draft.painNotes);
        if (draft.notes != null) setNotes(draft.notes);
        setLogs(next);
        dirtyRef.current = true;
        setIsDirty(true);
        setMsg("Restored offline draft");
        setMsgTone("success");
        return;
      }
    }
    setLogs(next);
    dirtyRef.current = false;
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLogs, session.id, readonly]);

  // Batch last-session loads + progression for floor display
  useEffect(() => {
    if (!client?.id) return;
    let cancelled = false;
    void getPreviousLoadsForSessionAction(session.id).then((map) => {
      if (!cancelled) setPrevLoads(map);
    });
    return () => {
      cancelled = true;
    };
  }, [session.id, client?.id]);

  // Floor coaching cues (bank / notes / pattern default)
  useEffect(() => {
    let cancelled = false;
    void getExerciseCuesForSessionAction(session.id).then((map) => {
      if (!cancelled) setExerciseCues(map);
    });
    return () => {
      cancelled = true;
    };
  }, [session.id]);

  useEffect(() => {
    setCanNativeShare(
      typeof navigator !== "undefined" && typeof navigator.share === "function"
    );
  }, []);

  // Prefill summary when viewing completed/cancelled
  useEffect(() => {
    if (!readonly) return;
    let cancelled = false;
    void getSessionSummaryTextAction(session.id)
      .then((text) => {
        if (!cancelled) setSummaryText(text);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [readonly, session.id]);

  // Warn before leaving with unsaved set data
  useEffect(() => {
    if (readonly) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [readonly]);

  // Debounced offline draft while dirty
  useEffect(() => {
    if (readonly) return;
    if (!dirtyRef.current) return;
    const t = window.setTimeout(() => {
      if (!dirtyRef.current) return;
      saveSessionDraft({
        sessionId: session.id,
        updatedAt: Date.now(),
        durationMin,
        overallRpe,
        painNotes,
        notes,
        logs: logs.map((l) => ({
          id: l.id,
          notes: l.notes,
          completed: l.completed,
          setLogs: snapshotSetLogs(l.setLogs),
        })),
      });
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    logs,
    durationMin,
    overallRpe,
    painNotes,
    notes,
    readonly,
    session.id,
  ]);

  const stats = useMemo(() => {
    const doneSets = logs.reduce(
      (n, l) => n + (l.setLogs || []).filter((s) => s.completed).length,
      0
    );
    const totalSets = logs.reduce((n, l) => n + (l.setLogs || []).length, 0);
    const doneEx = logs.filter((l) => l.completed).length;
    const pct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0;
    return { doneSets, totalSets, doneEx, pct };
  }, [logs]);

  // First incomplete exercise is "current"
  const currentExId = useMemo(() => {
    const open = logs.find((l) => !l.completed);
    return open?.id ?? logs[logs.length - 1]?.id ?? null;
  }, [logs]);

  // Live elapsed clock while logging
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (readonly) return;
    const t = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(t);
  }, [readonly]);

  const elapsedLabel = useMemo(() => {
    const mins = Math.max(
      0,
      Math.floor((nowTick - startedAtRef.current) / 60000)
    );
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }, [nowTick]);

  // Scroll current into view when it advances — keep manual expand overrides
  // so peeking a prior exercise is not wiped mid-session (Focus current clears).
  useEffect(() => {
    if (readonly || !currentExId) return;
    requestAnimationFrame(() => {
      document.getElementById(`ex-${currentExId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });
  }, [currentExId, readonly]);

  function updateLog(id: string, patch: Partial<Log>) {
    const log = logs.find((l) => l.id === id);
    if (log && (patch.setLogs !== undefined || patch.completed !== undefined || patch.notes !== undefined)) {
      pushUndo({
        type: "update_log",
        logId: id,
        before: {
          setLogs: snapshotSetLogs(log.setLogs),
          completed: log.completed,
          notes: log.notes,
        },
        label:
          patch.setLogs !== undefined
            ? `${log.exerciseName} · sets`
            : patch.completed !== undefined
              ? `${log.exerciseName} · mark`
              : `${log.exerciseName} · notes`,
      });
    }
    markDirty();
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function updateSet(
    logId: string,
    setIndex: number,
    patch: Partial<SessionSetLog>
  ) {
    const log = logs.find((l) => l.id === logId);
    if (log) {
      pushUndo({
        type: "update_set",
        logId,
        setIndex,
        before: {
          setLogs: snapshotSetLogs(log.setLogs),
          completed: log.completed,
          notes: log.notes,
        },
        label: `${log.exerciseName} · set ${setIndex}`,
      });
    }
    markDirty();
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        const setLogs = (l.setLogs || []).map((s) =>
          s.setIndex === setIndex ? { ...s, ...patch } : s
        );
        const allDone = setLogs.length > 0 && setLogs.every((s) => s.completed);
        return { ...l, setLogs, completed: allDone };
      })
    );
  }

  function startRestTimer(
    seconds: number,
    label: string,
    opts?: { mode?: "rest" | "emom"; subtitle?: string }
  ) {
    if (!autoRest) return;
    const mode = opts?.mode ?? "rest";
    const sec = Math.max(5, Math.round(seconds));
    const displayLabel =
      mode === "emom" ? formatEmomRestLabel(sec) : label;
    setRestActive({
      seconds: sec,
      label: displayLabel,
      token: Date.now(),
      mode,
      subtitle: opts?.subtitle,
    });
  }

  function restSecondsForSet(log: Log, set: SessionSetLog): number {
    if (isEmomScheme(log.setScheme, set.role)) {
      return emomRestSeconds({ workEndedAt: new Date() });
    }
    if (set.restSec != null && set.restSec > 0) return set.restSec;
    if (log.restAfterSec != null && log.restAfterSec > 0) return log.restAfterSec;
    if (
      log.restBetweenRoundsSec != null &&
      log.restBetweenRoundsSec > 0
    ) {
      return log.restBetweenRoundsSec;
    }
    return DEFAULT_REST_SEC;
  }

  function estimatedDurationMin(): number {
    const elapsed = Math.max(
      1,
      Math.round((Date.now() - startedAtRef.current) / 60000)
    );
    return Math.min(elapsed, 240);
  }

  /** Default minutes for Book next: prefer completed session, then live field, else 60. */
  function resolveBookDurationDefault(fromDuration?: string | number | null) {
    const sessionMins =
      session.durationMin && session.durationMin > 0
        ? session.durationMin
        : null;
    const live =
      fromDuration != null && fromDuration !== ""
        ? Number(fromDuration)
        : durationMin && Number(durationMin) > 0
          ? Number(durationMin)
          : null;
    return String(
      sessionMins && sessionMins > 0
        ? sessionMins
        : live && live > 0
          ? live
          : 60
    );
  }

  /** Mark set done; copy weight/reps into next empty set when completing */
  function toggleSetDone(logId: string, setIndex: number, done: boolean) {
    const log = logs.find((l) => l.id === logId);
    if (log) {
      pushUndo({
        type: "toggle_set",
        logId,
        setIndex,
        before: {
          setLogs: snapshotSetLogs(log.setLogs),
          completed: log.completed,
          notes: log.notes,
        },
        label: `${log.exerciseName} · set ${setIndex} ${done ? "done" : "undo"}`,
      });
    }
    markDirty();
    const curSet = log?.setLogs?.find((s) => s.setIndex === setIndex);
    // Compute open-set outcome from current log (do not rely on setState updater side effects)
    const willHaveOpenSets = (() => {
      if (!log) return false;
      const nextSets = (log.setLogs || []).map((s) =>
        s.setIndex === setIndex ? { ...s, completed: done } : s
      );
      return nextSets.some((s) => !s.completed);
    })();
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        let setLogs = (l.setLogs || []).map((s) =>
          s.setIndex === setIndex ? { ...s, completed: done } : s
        );
        if (done) {
          const cur = setLogs.find((s) => s.setIndex === setIndex);
          const next = setLogs.find(
            (s) => s.setIndex === setIndex + 1 && !s.completed
          );
          if (cur && next && next.weightKg == null && cur.weightKg != null) {
            setLogs = setLogs.map((s) =>
              s.setIndex === setIndex + 1
                ? {
                    ...s,
                    weightKg: cur.weightKg,
                    reps: s.reps || cur.reps,
                  }
                : s
            );
          }
          // Also copy RPE if next empty
          if (cur && next && !next.rpe && cur.rpe) {
            setLogs = setLogs.map((s) =>
              s.setIndex === setIndex + 1 ? { ...s, rpe: cur.rpe } : s
            );
          }
        }
        const allDone = setLogs.length > 0 && setLogs.every((s) => s.completed);
        return { ...l, setLogs, completed: allDone };
      })
    );
    // Rest only when there is another set left somewhere, or more work on this exercise
    const otherOpen = logs.some(
      (l) =>
        l.id !== logId &&
        (l.setLogs || []).some((s) => !s.completed)
    );
    if (done) {
      try {
        if (typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(24);
        }
      } catch {
        /* ignore */
      }
    }
    if (done && log && curSet && (willHaveOpenSets || otherOpen)) {
      const sec = restSecondsForSet(log, curSet);
      const emom = isEmomScheme(log.setScheme, curSet.role);
      startRestTimer(sec, `${log.exerciseName} · set ${setIndex}`, {
        mode: emom ? "emom" : "rest",
        subtitle: emom ? log.exerciseName : undefined,
      });
      if (willHaveOpenSets) {
        flash("Set done", "success");
      } else {
        // This exercise finished; more work remains elsewhere
        flash(`${log.exerciseName} complete`, "success");
      }
    } else if (done && !willHaveOpenSets && !otherOpen) {
      setRestActive(null);
      flash("All sets done — complete when ready", "success");
    }
  }

  function nudgeWeight(logId: string, setIndex: number, delta: number) {
    const log = logs.find((l) => l.id === logId);
    if (!log) return;
    pushUndo({
      type: "update_set",
      logId,
      setIndex,
      before: {
        setLogs: snapshotSetLogs(log.setLogs),
        completed: log.completed,
        notes: log.notes,
      },
      label: `Weight ${delta > 0 ? "+" : ""}${delta}`,
    });
    markDirty();
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        return {
          ...l,
          setLogs: (l.setLogs || []).map((s) => {
            if (s.setIndex !== setIndex) return s;
            const cur = s.weightKg ?? 0;
            const next = Math.round((cur + delta) * 2) / 2;
            return { ...s, weightKg: next < 0 ? 0 : next };
          }),
        };
      })
    );
  }

  /**
   * One-tap progression: apply suggested kg and/or target reps to open sets.
   * Undoable via the same stack as other set edits.
   */
  function applyProgression(
    logId: string,
    opts: { kg?: number | null; reps?: string | null; label?: string }
  ) {
    const log = logs.find((l) => l.id === logId);
    if (!log || readonly) return;
    const open = (log.setLogs || []).filter((s) => !s.completed);
    if (!open.length) {
      flash("No open sets to apply", "info");
      return;
    }
    const kg = opts.kg;
    const reps = opts.reps?.trim() || null;
    if (kg == null && !reps) {
      flash("Nothing to apply", "info");
      return;
    }

    pushUndo({
      type: "update_log",
      logId,
      before: {
        setLogs: snapshotSetLogs(log.setLogs),
        completed: log.completed,
        notes: log.notes,
      },
      label: opts.label || `${log.exerciseName} · apply progression`,
    });
    markDirty();
    // Functional update so callers that fill weights first (prepOpenSets) compose correctly
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        return {
          ...l,
          setLogs: (l.setLogs || []).map((s) => {
            if (s.completed) return s;
            return {
              ...s,
              weightKg: kg != null ? kg : s.weightKg,
              reps: reps || s.reps,
            };
          }),
        };
      })
    );
    const bits: string[] = [];
    if (kg != null) bits.push(`${kg} kg`);
    if (reps) bits.push(`${reps} reps`);
    flash(`Applied ${bits.join(" · ")} to open sets`, "success");
  }

  /**
   * Fill empty open-set weights from last session, then apply progression tip.
   * Does not auto-run on mount — user tap only. Current exercise preferred.
   */
  async function prepOpenSets() {
    if (readonly) return;
    const logId = currentExId || logs.find((l) => !l.completed)?.id;
    if (!logId) {
      flash("No open exercise", "info");
      return;
    }
    const log = logs.find((l) => l.id === logId);
    if (!log) return;

    // 1) Fill null weights from previous session if any open set lacks weight
    const needsFill = (log.setLogs || []).some(
      (s) => !s.completed && s.weightKg == null
    );
    let historyApplied = false;
    if (needsFill && client?.id) {
      try {
        const res = await getLastWeightsForExerciseAction({
          clientId: client.id,
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          excludeSessionId: session.id,
        });
        if (res.setLogs.length) {
          const next = applyPreviousWeights(log.setLogs || [], res.setLogs);
          const wroteWeight = (log.setLogs || []).some((s, i) => {
            if (s.completed || s.weightKg != null) return false;
            return next[i]?.weightKg != null;
          });
          if (wroteWeight) {
            historyApplied = true;
            pushUndo({
              type: "update_log",
              logId,
              before: {
                setLogs: snapshotSetLogs(log.setLogs),
                completed: log.completed,
                notes: log.notes,
              },
              label: `${log.exerciseName} · prep fill`,
            });
            markDirty();
            setLogs((prev) =>
              prev.map((l) => {
                if (l.id !== logId) return l;
                return {
                  ...l,
                  setLogs: applyPreviousWeights(l.setLogs || [], res.setLogs),
                };
              })
            );
          }
        }
      } catch {
        /* continue to progression */
      }
    }

    // 2) Apply progression for current exercise only (same as A).
    // applyProgression flashes on success — skip final flash when it runs.
    const sug = prevLoads[logId]?.suggestion;
    if (sug) {
      const range =
        sug.kind === "reps"
          ? (() => {
              const pr = log.plannedReps || "";
              const m = pr.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
              if (m) return m[2];
              return pr.match(/(\d+)/)?.[1] || null;
            })()
          : null;
      applyProgression(logId, {
        kg:
          sug.suggestedKg != null && sug.suggestedKg > 0
            ? sug.suggestedKg
            : null,
        reps: range,
        label: "Prep open sets",
      });
      return;
    }

    flash(
      needsFill
        ? historyApplied
          ? "Filled last loads where available"
          : "No last loads to fill"
        : "Sets already prepped",
      "info"
    );
  }

  /** Apply current exercise's progression suggestion (also keyboard A). */
  function applyCurrentProgression() {
    const logId = currentExId || logs[0]?.id;
    if (!logId) return;
    const sug = prevLoads[logId]?.suggestion;
    if (!sug) {
      flash("No progression tip for this exercise", "info");
      return;
    }
    const range =
      sug.kind === "reps"
        ? (() => {
            const log = logs.find((l) => l.id === logId);
            const pr = log?.plannedReps || "";
            const m = pr.match(/(\d+)\s*[-–—to]+\s*(\d+)/i);
            if (m) return m[2];
            const single = pr.match(/(\d+)/);
            return single?.[1] || null;
          })()
        : null;
    applyProgression(logId, {
      kg: sug.suggestedKg,
      reps: range,
      label: `Apply ${sug.kind}`,
    });
  }

  function focusExercise(logId: string) {
    setCollapsed((c) => ({ ...c, [logId]: false }));
    requestAnimationFrame(() => {
      document
        .getElementById(`ex-${logId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function goAdjacentExercise(dir: 1 | -1) {
    if (!logs.length) return;
    const ids = logs.map((l) => l.id);
    const cur = currentExId && ids.includes(currentExId) ? currentExId : ids[0];
    const idx = ids.indexOf(cur);
    const next = ids[Math.max(0, Math.min(ids.length - 1, idx + dir))];
    if (next) focusExercise(next);
  }

  function nudgeCurrentOpenWeight(delta: number) {
    const log =
      logs.find((l) => l.id === currentExId) ||
      logs.find((l) => (l.setLogs || []).some((s) => !s.completed));
    if (!log) return;
    const open = (log.setLogs || []).find((s) => !s.completed);
    if (!open) {
      flash("No open set to nudge", "info");
      return;
    }
    const cur = open.weightKg ?? 0;
    const next = Math.round((cur + delta) * 2) / 2;
    updateSet(log.id, open.setIndex, { weightKg: next < 0 ? 0 : next });
  }

  function localSummaryText() {
    return buildSessionSummaryText({
      session: {
        title: session.title,
        durationMin:
          durationMin === "" ? estimatedDurationMin() : Number(durationMin),
        overallRpe: overallRpe || null,
        painNotes: painNotes || null,
        notes: notes || null,
        performedAt: session.performedAt,
        status,
      },
      clientName: client
        ? fullName(client.firstName, client.lastName)
        : null,
      programTitle: program?.title,
      logs,
    });
  }

  async function shareSummary(opts?: { native?: boolean }) {
    setMsg(null);
    startTransition(async () => {
      try {
        let text = localSummaryText();
        try {
          text = await getSessionSummaryTextAction(session.id);
        } catch {
          /* use local if server fails (e.g. mid-edit) */
        }
        setSummaryText(text);

        if (
          opts?.native &&
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function"
        ) {
          try {
            await navigator.share({
              title: session.title,
              text,
            });
            flash("Shared", "success");
            return;
          } catch {
            /* fall through to clipboard */
          }
        }

        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
          flash("Summary copied to clipboard", "success");
        } else {
          flash("Summary ready — copy from the box below", "info");
        }
      } catch (e) {
        flash(e instanceof Error ? e.message : "Share failed", "error");
      }
    });
  }

  function completeNextSet() {
    if (readonly) return;
    for (const l of logs) {
      const open = (l.setLogs || []).find((s) => !s.completed);
      if (open) {
        toggleSetDone(l.id, open.setIndex, true);
        return;
      }
    }
    flash("All sets already done", "info");
  }

  // Keyboard shortcuts (floor): ignore when typing in fields
  useEffect(() => {
    if (readonly) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        t?.isContentEditable;
      if (typing) return;

      // Escape: dismiss rest overlay or shortcuts help
      if (e.key === "Escape") {
        e.preventDefault();
        if (restActive) setRestActive(null);
        else if (showShortcuts) setShowShortcuts(false);
        return;
      }

      // Undo: Ctrl/Cmd+Z or U
      if (
        ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) ||
        (!(e.metaKey || e.ctrlKey || e.altKey) &&
          (e.key === "u" || e.key === "U"))
      ) {
        e.preventDefault();
        performUndo();
        return;
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        completeNextSet();
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        saveDraft();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        if (restActive) setRestActive(null);
        else {
          const log = logs.find((l) => l.id === currentExId) || logs[0];
          if (log) {
            const firstOpen =
              (log.setLogs || []).find((s) => !s.completed) ||
              log.setLogs?.[0];
            const emom = isEmomScheme(log.setScheme, firstOpen?.role);
            const sec = firstOpen
              ? restSecondsForSet(log, firstOpen)
              : log.restAfterSec ||
                log.restBetweenRoundsSec ||
                DEFAULT_REST_SEC;
            startRestTimer(sec, log.exerciseName, {
              mode: emom ? "emom" : "rest",
              subtitle: emom ? log.exerciseName : undefined,
            });
          }
        }
        return;
      }
      // Apply progression suggestion for current exercise
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        applyCurrentProgression();
        return;
      }
      // Next / previous exercise (expand + scroll)
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        goAdjacentExercise(1);
        return;
      }
      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        goAdjacentExercise(-1);
        return;
      }
      // Nudge open-set weight ±1 kg (or +2.5 with Shift)
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        nudgeCurrentOpenWeight(e.shiftKey ? 2.5 : 1);
        return;
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        nudgeCurrentOpenWeight(e.shiftKey ? -2.5 : -1);
        return;
      }
      if (e.key === "?") {
        e.preventDefault();
        setShowShortcuts((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    readonly,
    logs,
    restActive,
    currentExId,
    autoRest,
    undoVersion,
    showShortcuts,
    prevLoads,
  ]);

  function addSet(logId: string) {
    markDirty();
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        const setLogs = [...(l.setLogs || [])];
        const last = setLogs[setLogs.length - 1];
        setLogs.push({
          setIndex: setLogs.length + 1,
          reps: last?.reps || l.plannedReps || "8-10",
          weightKg: last?.weightKg ?? null,
          rpe: null,
          completed: false,
          role: last?.role ?? null,
          tempo: last?.tempo ?? null,
          restSec: last?.restSec ?? null,
          note: null,
          pain: null,
        });
        return { ...l, setLogs, completed: false };
      })
    );
  }

  function removeSet(logId: string) {
    markDirty();
    setLogs((prev) =>
      prev.map((l) => {
        if (l.id !== logId) return l;
        const setLogs = [...(l.setLogs || [])];
        if (setLogs.length <= 1) return l;
        setLogs.pop();
        return {
          ...l,
          setLogs: setLogs.map((s, i) => ({ ...s, setIndex: i + 1 })),
          completed:
            setLogs.length > 0 && setLogs.every((s) => s.completed),
        };
      })
    );
  }

  function payloadExercises(): SessionExerciseUpdate[] {
    return logs.map((l) => ({
      id: l.id,
      notes: l.notes,
      completed: l.completed,
      setLogs: l.setLogs || [],
    }));
  }

  function sessionMeta() {
    return {
      durationMin: durationMin === "" ? null : Number(durationMin),
      overallRpe: overallRpe || null,
      painNotes: painNotes || null,
      notes: notes || null,
      exercises: payloadExercises(),
    };
  }

  function saveDraft() {
    setMsg(null);
    startTransition(async () => {
      try {
        await saveSessionProgressAction(session.id, sessionMeta());
        markClean();
        clearSessionDraft(session.id);
        setLastSavedAt(Date.now());
        flash("Progress saved — resume anytime", "success");
        router.refresh();
      } catch (e) {
        flash(e instanceof Error ? e.message : "Save failed", "error");
      }
    });
  }

  function complete() {
    const undone = logs.reduce(
      (n, l) => n + (l.setLogs || []).filter((s) => !s.completed).length,
      0
    );
    if (
      undone > 0 &&
      !confirm(
        `${undone} set(s) not marked done. Complete session anyway? (Unlogged sets stay incomplete.)`
      )
    ) {
      return;
    }
    setMsg(null);
    // Auto-fill duration if empty; keep book-next default in sync
    let meta = sessionMeta();
    if (meta.durationMin == null || Number.isNaN(meta.durationMin as number)) {
      const mins = estimatedDurationMin();
      setDurationMin(String(mins));
      meta = { ...meta, durationMin: mins };
    }
    if (meta.durationMin != null && Number(meta.durationMin) > 0) {
      setBookDuration(String(meta.durationMin));
    }
    setRestActive(null);
    startTransition(async () => {
      try {
        const done = await completeSessionAction(session.id, meta);
        markClean();
        clearSessionDraft(session.id);
        const text = localSummaryText();
        setSummaryText(text);
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
          }
        } catch {
          /* ignore */
        }
        const meso =
          done?.mesoAdvance?.label || done?.mesoAdvance?.week != null
            ? ` · Mesocycle → ${done.mesoAdvance.label || `W${done.mesoAdvance.week}`}`
            : "";
        flash(
          `Session completed · summary ready to share${meso}`,
          "success"
        );
        setStatusOverride("completed");
        router.refresh();
        // Scroll close-loop into view after optimistic UI mounts
        setTimeout(() => {
          document
            .getElementById("session-close-loop")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 200);
      } catch (e) {
        flash(e instanceof Error ? e.message : "Complete failed", "error");
      }
    });
  }

  function bookNext(e?: { preventDefault?: () => void }) {
    e?.preventDefault?.();
    if (!client?.id) return;
    const startsAt = bookStart.trim();
    if (!startsAt) {
      flash("Pick a date and time", "error");
      return;
    }
    const mins = Math.max(15, Math.min(240, Number(bookDuration) || 60));
    startTransition(async () => {
      try {
        await createClientAppointmentAction({
          clientId: client.id,
          startsAt: new Date(startsAt).toISOString(),
          durationMin: mins,
          title: bookTitle.trim() || "Session",
        });
        const when = new Date(startsAt).toLocaleString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        setBookedLine(`Next: ${when}`);
        setShowBookNext(false);
        setBookTitle("");
        flash(`Booked · ${when}`, "success");
      } catch (err) {
        flash(err instanceof Error ? err.message : "Could not book", "error");
      }
    });
  }

  function addBankExerciseToSession(bank: {
    id: string;
    name: string;
  }) {
    startTransition(async () => {
      try {
        const res = await addExerciseToSessionAction(session.id, bank.id);
        setLogs((prev) => [
          ...prev,
          {
            ...res.log,
            setLogs: res.log.setLogs || [],
          },
        ]);
        setShowAddExercise(false);
        setCollapsed((c) => ({ ...c, [res.log.id]: false }));
        markDirty();
        flash(`Added ${res.log.exerciseName} to session`, "success");
      } catch (e) {
        flash(e instanceof Error ? e.message : "Could not add exercise", "error");
      }
    });
  }

  function promoteLogToProgram(logId: string) {
    startTransition(async () => {
      try {
        const res = await promoteSessionExerciseToProgramAction(
          session.id,
          logId
        );
        setPromotedLogIds((m) => ({ ...m, [logId]: true }));
        setLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? { ...l, programExerciseId: res.programExerciseId }
              : l
          )
        );
        flash(`Added ${res.name} to ${res.dayName}`, "success");
      } catch (e) {
        flash(
          e instanceof Error ? e.message : "Could not add to program",
          "error"
        );
      }
    });
  }

  function cancel() {
    if (!confirm("Cancel this session? Progress will be kept as cancelled."))
      return;
    startTransition(async () => {
      await cancelSessionAction(session.id);
      router.push("/sessions");
      router.refresh();
    });
  }

  function removeSession() {
    if (
      !confirm(
        `Remove “${session.title}” permanently?\n\nSet logs are deleted. If completed, one pack credit may be restored.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await deleteSessionAction(session.id);
        clearSessionDraft(session.id);
        router.push(
          client?.id
            ? `/sessions?client=${encodeURIComponent(client.id)}`
            : "/sessions"
        );
        router.refresh();
      } catch (e) {
        flash(e instanceof Error ? e.message : "Remove failed", "error");
      }
    });
  }

  function copyLastWeights(log: Log) {
    if (!client?.id) {
      flash("Assign a client on the program to copy previous weights", "error");
      return;
    }
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await getLastWeightsForExerciseAction({
          clientId: client.id,
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          excludeSessionId: session.id,
        });
        if (!res.setLogs.length) {
          flash(`No previous weights for ${log.exerciseName}`, "info");
          return;
        }
        const before = snapshotSetLogs(log.setLogs);
        const nextSets = applyPreviousWeights(log.setLogs || [], res.setLogs);
        const changed =
          JSON.stringify(before) !== JSON.stringify(snapshotSetLogs(nextSets));
        if (!changed) {
          flash("Sets already match last loads", "info");
          return;
        }
        pushUndo({
          type: "update_log",
          logId: log.id,
          before: {
            setLogs: before,
            completed: log.completed,
            notes: log.notes,
          },
          label: `Fill last · ${log.exerciseName}`,
        });
        markDirty();
        setLogs((prev) =>
          prev.map((l) => {
            if (l.id !== log.id) return l;
            return {
              ...l,
              setLogs: nextSets,
            };
          })
        );
        flash(
          `Copied last weights${
            res.sessionTitle ? ` · ${res.sessionTitle}` : ""
          }`,
          "success"
        );
      } catch (e) {
        flash(e instanceof Error ? e.message : "Copy failed", "error");
      }
    });
  }

  function toggleCollapse(id: string) {
    setCollapsed((c) => {
      const log = logs.find((l) => l.id === id);
      const currently = log
        ? defaultExerciseCollapsed({
            readonly,
            logId: id,
            currentExId,
            completed: !!log.completed,
            userOverride: c[id],
          })
        : !!c[id];
      return { ...c, [id]: !currently };
    });
  }

  function isCollapsed(log: Log) {
    return defaultExerciseCollapsed({
      readonly,
      logId: log.id,
      currentExId,
      completed: log.completed,
      userOverride: collapsed[log.id],
    });
  }

  return (
    <FocusShell floorFooter className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link
            href="/sessions"
            className="text-xs font-medium text-emerald-400 hover:underline"
          >
            ← Sessions
          </Link>
          {!readonly && (
            <span className="text-[11px] tabular-nums text-zinc-500">
              {elapsedLabel}
              {isDirty
                ? " · unsaved"
                : lastSavedAt
                  ? ` · saved ${new Date(lastSavedAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : ""}
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="section-label mb-0.5 text-emerald-500/90">Session</p>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              {session.title}
            </h1>
            <p className="mt-0.5 text-sm text-zinc-500">
              {client && (
                <Link
                  href={`/clients/${client.id}`}
                  className="text-emerald-400 hover:underline"
                >
                  {fullName(client.firstName, client.lastName)}
                </Link>
              )}
              {program && (
                <>
                  {client ? " · " : ""}
                  <Link
                    href={`/programs/${program.id}`}
                    className="text-emerald-400 hover:underline"
                  >
                    {program.title}
                  </Link>
                </>
              )}
            </p>
          </div>
          <Badge
            tone={
              status === "completed"
                ? "green"
                : status === "cancelled"
                  ? "red"
                  : "amber"
            }
          >
            {status === "in_progress"
              ? "Live"
              : status.replace("_", " ")}
          </Badge>
        </div>

        {/* Progress */}
        <div
          className={cn(
            "mt-3 rounded-xl border p-3",
            readonly
              ? "border-zinc-800 bg-zinc-950/50"
              : "border-emerald-900/40 bg-emerald-950/15"
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-medium text-zinc-200">
              <span className="tabular-nums text-emerald-300">
                {stats.doneSets}
              </span>
              <span className="text-zinc-500">/{stats.totalSets} sets</span>
              <span className="mx-1.5 text-zinc-700">·</span>
              <span className="tabular-nums text-zinc-300">{stats.doneEx}</span>
              <span className="text-zinc-500">/{logs.length} exercises</span>
            </span>
            <span className="tabular-nums font-semibold text-zinc-300">
              {stats.pct}%
            </span>
          </div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-zinc-800/90">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                stats.pct >= 100 ? "bg-emerald-400" : "bg-emerald-500"
              )}
              style={{ width: `${stats.pct}%` }}
            />
          </div>
          {status === "in_progress" && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
              <span className="text-zinc-400">
                Space set · A apply · N/P move · +/− load
              </span>
              {lastSavedAt && !isDirty ? (
                <span>
                  · saved{" "}
                  {new Date(lastSavedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              ) : null}
              {!readonly && currentExId && (
                <button
                  type="button"
                  className="inline-flex min-h-11 items-center text-[11px] font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
                  onClick={() => {
                    // Clear sticky expands so only current is open (default rules)
                    setCollapsed({});
                    document.getElementById(`ex-${currentExId}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                    });
                  }}
                >
                  Focus current
                </button>
              )}
            </p>
          )}
        </div>
      </div>

      {!readonly && stats.totalSets > 0 && stats.pct >= 100 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/30 px-3 py-2.5">
          <div className="text-sm text-emerald-100">
            All sets logged
            <span className="text-emerald-200/70">
              {" "}
              · wrap up duration & RPE, then complete
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="min-h-11"
            loading={pending}
            onClick={complete}
          >
            Complete session
          </Button>
        </div>
      )}

      {readonly && status === "cancelled" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2.5">
          <div className="text-sm text-zinc-300">
            Session cancelled
            {durationMin ? (
              <span className="opacity-70"> · {durationMin} min</span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              loading={pending}
              onClick={removeSession}
              className="text-zinc-500 hover:text-red-300"
            >
              Remove
            </Button>
            <Link href="/">
              <Button type="button" size="sm" variant="secondary">
                Today
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Lane C: post-session close loop — one emerald CTA */}
      {readonly && status === "completed" && (
        <div id="session-close-loop" className="scroll-mt-20">
          <Card className="space-y-3 border-emerald-800/40 bg-emerald-950/20">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-emerald-100">
                  Session complete
                </h3>
                <p
                  className="mt-0.5 text-xs text-emerald-200/70"
                  aria-live="polite"
                >
                  {stats.doneSets > 0 ? `${stats.doneSets} sets` : "Logged"}
                  {durationMin ? ` · ${durationMin} min` : ""}
                  {overallRpe ? ` · RPE ${overallRpe}` : ""}
                  {bookedLine ? ` · ${bookedLine}` : ""}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  Share the summary, then rebook or log a touch.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canNativeShare ? (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      loading={pending}
                      onClick={() => void shareSummary({ native: true })}
                      className="min-h-11 px-4"
                    >
                      <Share2 className="h-3.5 w-3.5" aria-hidden />
                      Share summary
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      loading={pending}
                      onClick={() => void shareSummary()}
                      className="min-h-11 text-zinc-400"
                    >
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      Copy
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    loading={pending}
                    onClick={() => void shareSummary()}
                    className="min-h-11 px-4"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Copy summary
                  </Button>
                )}
              </div>
            </div>

            {client?.id && (
              <div className="space-y-2 border-t border-emerald-900/40 pt-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      setShowBookNext((v) => {
                        if (!v) setBookDuration(resolveBookDurationDefault());
                        return !v;
                      })
                    }
                    aria-expanded={showBookNext}
                    className="inline-flex min-h-11 items-center font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
                  >
                    {showBookNext ? "Cancel book" : "Book next"}
                  </button>
                  <Link
                    href={`/clients/${client.id}`}
                    className="inline-flex min-h-11 items-center font-medium text-zinc-400 hover:text-emerald-400 hover:underline"
                  >
                    Open client
                  </Link>
                  <HomeQuickCheckIn
                    clientId={client.id}
                    clientName={fullName(client.firstName, client.lastName)}
                    onSaved={() => flash("Check-in saved", "success")}
                  />
                </div>

                {showBookNext && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      bookNext();
                    }}
                    className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-2.5"
                  >
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="book-next-start">When</Label>
                        <Input
                          id="book-next-start"
                          type="datetime-local"
                          value={bookStart}
                          onChange={(e) => setBookStart(e.target.value)}
                          disabled={pending}
                          className="mt-1 min-h-11 text-sm"
                          autoFocus
                        />
                      </div>
                      <div>
                        <Label htmlFor="book-next-dur">Minutes</Label>
                        <Input
                          id="book-next-dur"
                          type="number"
                          min={15}
                          max={240}
                          step={15}
                          value={bookDuration}
                          onChange={(e) => setBookDuration(e.target.value)}
                          disabled={pending}
                          className="mt-1 min-h-11 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="book-next-title">Title (optional)</Label>
                      <Input
                        id="book-next-title"
                        value={bookTitle}
                        onChange={(e) => setBookTitle(e.target.value)}
                        placeholder="Session"
                        disabled={pending}
                        className="mt-1 min-h-11 text-sm"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      loading={pending}
                      className="min-h-11"
                    >
                      Book
                    </Button>
                  </form>
                )}
              </div>
            )}

            {/* Keep floor improvisations on the plan */}
            {session.programDayId &&
              logs.some((l) =>
                canPromoteSessionLogToProgram({
                  programDayId: session.programDayId,
                  exerciseId: l.exerciseId,
                  alreadyOnDay: !!(
                    l.programExerciseId || promotedLogIds[l.id]
                  ),
                })
              ) && (
                <div className="space-y-1.5 border-t border-emerald-900/40 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400/80">
                    Keep on program
                  </p>
                  <ul className="space-y-1">
                    {logs
                      .filter((l) =>
                        canPromoteSessionLogToProgram({
                          programDayId: session.programDayId,
                          exerciseId: l.exerciseId,
                          alreadyOnDay: !!(
                            l.programExerciseId || promotedLogIds[l.id]
                          ),
                        })
                      )
                      .map((l) => (
                        <li
                          key={l.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2.5 py-2"
                        >
                          <span className="text-xs font-medium text-zinc-200">
                            {l.exerciseName}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            loading={pending}
                            className="min-h-9"
                            onClick={() => promoteLogToProgram(l.id)}
                          >
                            Add to plan
                          </Button>
                        </li>
                      ))}
                  </ul>
                </div>
              )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-emerald-900/40 pt-2 text-xs text-zinc-500">
              <Link
                href="/"
                className="inline-flex min-h-9 items-center hover:text-emerald-400 hover:underline"
              >
                Today
              </Link>
              {(program?.id || session.programId) && (
                <Link
                  href={`/programs/${program?.id || session.programId}`}
                  className="inline-flex min-h-9 items-center hover:text-emerald-400 hover:underline"
                >
                  Program
                </Link>
              )}
              {client?.id && (
                <Link
                  href={`/clients/${client.id}#progress`}
                  className="inline-flex min-h-9 items-center hover:text-emerald-400 hover:underline"
                >
                  Progress
                </Link>
              )}
              <Link
                href="/sessions"
                className="inline-flex min-h-9 items-center hover:text-emerald-400 hover:underline"
              >
                All sessions
              </Link>
              <button
                type="button"
                onClick={removeSession}
                disabled={pending}
                className="inline-flex min-h-9 items-center text-zinc-600 hover:text-red-300 hover:underline"
              >
                Remove
              </button>
            </div>
          </Card>
        </div>
      )}

      {msg && (
        <Alert
          tone={
            msgTone === "error"
              ? "error"
              : msgTone === "success"
                ? "success"
                : "info"
          }
          className="text-sm"
        >
          {msg}
        </Alert>
      )}

      {/* Session meta — collapsed by default while logging */}
      <details
        className="rounded-xl border border-zinc-800 bg-zinc-900/40 open:border-zinc-700"
        open={detailsOpen || readonly}
        onToggle={(e) =>
          setDetailsOpen((e.target as HTMLDetailsElement).open)
        }
      >
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-zinc-300 marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            {detailsOpen || readonly ? (
              <ChevronDown className="h-4 w-4 text-zinc-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-zinc-500" />
            )}
            Session details
            <span className="text-xs font-normal text-zinc-500">
              duration · RPE · pain · notes
            </span>
          </span>
        </summary>
        <div className="space-y-3 border-t border-zinc-800 px-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Duration (min)</Label>
              <Input
                type="number"
                inputMode="numeric"
                disabled={readonly}
                value={durationMin}
                onChange={(e) => {
                  markDirty();
                  setDurationMin(e.target.value);
                }}
              />
            </div>
            <div>
              <Label>Session RPE</Label>
              <Input
                disabled={readonly}
                placeholder="e.g. 7"
                inputMode="decimal"
                value={overallRpe}
                onChange={(e) => {
                  markDirty();
                  setOverallRpe(e.target.value);
                }}
              />
              {!readonly && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SESSION_RPE.map((v) => (
                    <button
                      key={v}
                      type="button"
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition",
                        overallRpe === v
                          ? "border-emerald-600 bg-emerald-950/50 text-emerald-200"
                          : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                      )}
                      onClick={() => {
                        markDirty();
                        setOverallRpe(v);
                      }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Pain / red flags</Label>
              <Input
                disabled={readonly}
                placeholder="None, or describe"
                value={painNotes}
                onChange={(e) => {
                  markDirty();
                  setPainNotes(e.target.value);
                }}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Session notes</Label>
              <Textarea
                disabled={readonly}
                value={notes}
                onChange={(e) => {
                  markDirty();
                  setNotes(e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      </details>

      {/* Exercises — grouped for contrast / complex / superset */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionLabel as="h2" className="mb-0">
            Exercises
          </SectionLabel>
          {!readonly && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={pending}
              className="min-h-11"
              onClick={() => setShowAddExercise((v) => !v)}
            >
              {showAddExercise ? "Cancel add" : "Add exercise"}
            </Button>
          )}
        </div>
        {showAddExercise && !readonly && (
          <ExerciseBankPicker
            title="Add to this session"
            disabled={pending}
            onCancel={() => setShowAddExercise(false)}
            onPick={(bank) => addBankExerciseToSession(bank)}
          />
        )}
        {groupExercisesIntoBlocks(logs).map((block, blockIdx) => {
          const renderExerciseCard = (log: Log, exIdx: number, inGroup: boolean) => {
          const sets = log.setLogs || [];
          const setsDone = sets.filter((s) => s.completed).length;
          const collapsedEx = isCollapsed(log);
          const isCurrent = log.id === currentExId && !readonly;

          return (
            <div key={log.id} id={`ex-${log.id}`} className="scroll-mt-24">
            <Card
              className={cn(
                "overflow-hidden p-0",
                log.completed && "border-emerald-900/40 bg-emerald-950/10",
                isCurrent && !log.completed && "border-emerald-700/50 ring-1 ring-emerald-900/40",
                inGroup && "border-zinc-800/80"
              )}
            >
              {/* Exercise header */}
              <button
                type="button"
                className="flex w-full items-start justify-between gap-2 px-3 py-3 text-left sm:px-4"
                onClick={() => toggleCollapse(log.id)}
                aria-expanded={!collapsedEx}
                aria-controls={`ex-body-${log.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                        inGroup
                          ? "bg-amber-950/60 text-amber-200 ring-1 ring-amber-800/50"
                          : "bg-zinc-800 text-zinc-400"
                      )}
                    >
                      {inGroup
                        ? formatGroupBadge(log.groupRole, exIdx)
                        : exIdx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-zinc-50">
                          {log.exerciseName}
                        </span>
                        {log.isWarmup && (
                          <Badge tone="green">Warm-up</Badge>
                        )}
                        {log.completed && <Badge tone="green">Done</Badge>}
                        {isCurrent && !log.completed && (
                          <Badge tone="amber">Now</Badge>
                        )}
                      </div>
                      {inGroup && formatGroupRoleTitle(log.groupRole) && (
                        <div className="mt-0.5 text-[11px] text-amber-200/70">
                          {formatGroupRoleTitle(log.groupRole)}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-9 text-xs text-zinc-500">
                    {!inGroup && log.setScheme && log.setScheme !== "straight" && (
                      <Badge tone="amber">
                        {formatSchemeName(log.setScheme)}
                      </Badge>
                    )}
                    {!inGroup && log.setScheme === "straight" && (
                      <Badge>Straight</Badge>
                    )}
                    <span className="tabular-nums text-zinc-400">
                      {formatPrescription({
                        sets: log.plannedSets,
                        reps: log.plannedReps,
                        rpe: log.rpe,
                        summary: log.setSchemeMeta?.summary,
                      })}
                    </span>
                    {formatPattern(log.movementPattern) && (
                      <span className="text-zinc-600">
                        · {formatPattern(log.movementPattern)}
                      </span>
                    )}
                    <span className="text-zinc-600">
                      · {setsDone}/{sets.length} done
                    </span>
                  </div>
                  {inGroup && (
                    <div className="mt-1 pl-9 text-[11px] text-zinc-500">
                      {log.restAfterSec != null && log.restAfterSec > 0
                        ? `${formatRestLabel(log.restAfterSec)} before next`
                        : log.restBetweenRoundsSec != null
                          ? `${formatRestLabel(log.restBetweenRoundsSec)} after round`
                          : null}
                    </div>
                  )}
                </div>
                {collapsedEx ? (
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-zinc-500" />
                ) : (
                  <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-zinc-500" />
                )}
              </button>

              {!collapsedEx && (
                <div
                  id={`ex-body-${log.id}`}
                  className="space-y-3 border-t border-zinc-800 px-3 py-3 sm:px-4"
                >
                  {!inGroup &&
                    log.setScheme &&
                    log.setScheme !== "straight" &&
                    (log.setSchemeMeta?.howTo || true) && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-400">
                      <span className="font-medium text-zinc-300">
                        {formatSchemeFullName(log.setScheme)}
                      </span>
                      {(log.setSchemeMeta?.howTo) && (
                        <span className="text-zinc-500">
                          {" — "}
                          {log.setSchemeMeta.howTo}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Floor coaching cue (bank / notes / pattern) */}
                  {exerciseCues[log.id]?.cue && (
                    <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
                      <span className="font-medium text-zinc-500">Cue · </span>
                      {exerciseCues[log.id].cue}
                    </p>
                  )}

                  {/* Last time + progression */}
                  {prevLoads[log.id]?.lastLine && (
                    <div
                      className={cn(
                        "rounded-lg border px-2.5 py-2 text-[11px] leading-relaxed",
                        prevLoads[log.id].suggestion
                          ? SUGGESTION_TONE[
                              prevLoads[log.id].suggestion!.kind
                            ] || "border-zinc-800 bg-zinc-950/60"
                          : "border-zinc-800 bg-zinc-950/60 text-zinc-300"
                      )}
                    >
                      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                        <span className="font-medium text-zinc-200">
                          Last
                          {formatRelativeSessionDay(
                            prevLoads[log.id].performedAt
                          )
                            ? ` (${formatRelativeSessionDay(
                                prevLoads[log.id].performedAt
                              )})`
                            : ""}
                        </span>
                        <span className="tabular-nums text-zinc-100">
                          {prevLoads[log.id].lastLine}
                        </span>
                      </div>
                      {prevLoads[log.id].suggestion && (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <TrendingUp className="h-3.5 w-3.5 shrink-0 opacity-80" />
                          <span className="min-w-0 flex-1">
                            {prevLoads[log.id].suggestion!.message}
                          </span>
                          {!readonly &&
                            (() => {
                              const sug = prevLoads[log.id].suggestion!;
                              const canKg =
                                sug.suggestedKg != null &&
                                (sug.kind === "load" ||
                                  sug.kind === "hold" ||
                                  sug.kind === "form");
                              const canReps = sug.kind === "reps";
                              if (!canKg && !canReps) return null;
                              const targetReps = canReps
                                ? (() => {
                                    const pr = log.plannedReps || "";
                                    const m = pr.match(
                                      /(\d+)\s*[-–—to]+\s*(\d+)/i
                                    );
                                    if (m) return m[2];
                                    return pr.match(/(\d+)/)?.[1] || null;
                                  })()
                                : null;
                              const label = canKg
                                ? `Apply ${sug.suggestedKg} kg`
                                : targetReps
                                  ? `Apply ${targetReps} reps`
                                  : "Apply";
                              return (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  className="min-h-11 shrink-0 px-3"
                                  title="Apply to open sets (A)"
                                  onClick={() =>
                                    applyProgression(log.id, {
                                      kg: canKg ? sug.suggestedKg : null,
                                      reps: targetReps,
                                      label: `Apply ${sug.kind}`,
                                    })
                                  }
                                >
                                  {label}
                                </Button>
                              );
                            })()}
                        </div>
                      )}
                      {(() => {
                        const pr = compareToPrevious(
                          sets,
                          prevLoads[log.id]?.setLogs || []
                        );
                        if (pr.kind === "none") return null;
                        const strip = formatPrStrip(pr);
                        return (
                          <div
                            className={cn(
                              "mt-1.5 text-[11px] font-medium tabular-nums",
                              pr.kind === "pr" && "text-emerald-300",
                              pr.kind === "under" && "text-amber-300",
                              pr.kind === "match" && "text-zinc-400"
                            )}
                          >
                            {strip}
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {!prevLoads[log.id]?.lastLine &&
                    (() => {
                      const prev = prevLoads[log.id]?.setLogs;
                      if (!prev?.length && !sets.some((s) => s.weightKg != null))
                        return null;
                      const pr = compareToPrevious(sets, prev || []);
                      if (pr.kind === "none") return null;
                      return (
                        <div
                          className={cn(
                            "rounded-lg border px-2.5 py-1.5 text-[11px] font-medium tabular-nums",
                            pr.kind === "pr" &&
                              "border-emerald-800/50 bg-emerald-950/30 text-emerald-300",
                            pr.kind === "under" &&
                              "border-amber-800/50 bg-amber-950/30 text-amber-300",
                            pr.kind === "match" &&
                              "border-zinc-800 bg-zinc-950/60 text-zinc-400"
                          )}
                        >
                          {formatPrStrip(pr)}
                        </div>
                      );
                    })()}

                  {!readonly && (
                    <div className="flex flex-wrap gap-2">
                      {client && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="min-h-11"
                          disabled={pending}
                          onClick={() => copyLastWeights(log)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                          Fill last
                        </Button>
                      )}
                      {log.id === currentExId &&
                        ((sets.some(
                          (s) => !s.completed && s.weightKg == null
                        ) ||
                          !!prevLoads[log.id]?.suggestion) && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="min-h-11"
                            disabled={pending}
                            onClick={() => void prepOpenSets()}
                            title="Fill empty weights from last time, then apply progression tip"
                          >
                            Prep open sets
                          </Button>
                        ))}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          const sec =
                            log.restAfterSec ||
                            log.restBetweenRoundsSec ||
                            DEFAULT_REST_SEC;
                          startRestTimer(sec, log.exerciseName);
                        }}
                      >
                        <Timer className="h-3.5 w-3.5" />
                        Rest{" "}
                        {formatRestLabel(
                          log.restAfterSec ||
                            log.restBetweenRoundsSec ||
                            DEFAULT_REST_SEC
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="min-h-11"
                        onClick={() => {
                          const completed = !log.completed;
                          updateLog(log.id, {
                            completed,
                            setLogs: sets.map((s) => ({
                              ...s,
                              completed,
                            })),
                          });
                        }}
                      >
                        {log.completed ? "Clear all" : "All done"}
                      </Button>
                    </div>
                  )}

                  {/* Set rows — floor friendly */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(3.25rem,0.85fr)_minmax(5.5rem,1.35fr)_2.5rem_2rem_2.5rem] gap-1 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      <span>Set</span>
                      <span>Cue</span>
                      <span>Reps</span>
                      <span className="text-center">kg</span>
                      <span>RPE</span>
                      <span className="text-center">Pain</span>
                      <span className="text-center">✓</span>
                    </div>
                    {sets.map((s) => {
                      const roleLabel = formatSetRole(s.role);
                      const tempoLabel = formatTempo(s.tempo);
                      const noteLabel = formatSetNote(s.note);
                      const showCue = roleLabel || tempoLabel || noteLabel;
                      const prevSet =
                        prevLoads[log.id]?.setLogs?.[s.setIndex - 1] ??
                        prevLoads[log.id]?.setLogs?.[
                          (prevLoads[log.id]?.setLogs?.length || 1) - 1
                        ];
                      const rpeOpen =
                        rpeFocus?.logId === log.id &&
                        rpeFocus?.setIndex === s.setIndex;
                      return (
                      <div key={s.setIndex} className="space-y-0.5">
                        <div
                          className={cn(
                            "grid grid-cols-[2rem_minmax(0,1fr)_minmax(3.25rem,0.85fr)_minmax(5.5rem,1.35fr)_2.5rem_2rem_2.5rem] items-center gap-1 rounded-lg border p-1",
                            s.pain
                              ? "border-amber-600/60 bg-amber-950/20"
                              : s.completed
                                ? "border-transparent bg-emerald-950/25"
                                : "border-transparent bg-zinc-950/40"
                          )}
                        >
                          <span className="text-center text-sm font-semibold tabular-nums text-zinc-400">
                            {s.setIndex}
                          </span>
                          <div className="min-w-0 text-[11px] leading-snug text-zinc-500">
                            {roleLabel && (
                              <div className="truncate font-medium text-emerald-400/90">
                                {roleLabel}
                              </div>
                            )}
                            {tempoLabel && (
                              <div className="truncate text-zinc-500">
                                {tempoLabel}
                              </div>
                            )}
                            {noteLabel && (
                              <div className="truncate text-zinc-600">
                                {noteLabel}
                              </div>
                            )}
                            {!showCue && prevSet?.weightKg != null && (
                              <span className="tabular-nums text-zinc-600">
                                was {prevSet.reps}@{prevSet.weightKg}
                              </span>
                            )}
                            {!showCue && prevSet?.weightKg == null && (
                              <span className="text-zinc-700">—</span>
                            )}
                          </div>
                          <input
                            className={cellInput}
                            disabled={readonly}
                            inputMode="numeric"
                            value={s.reps}
                            onChange={(e) =>
                              updateSet(log.id, s.setIndex, {
                                reps: e.target.value,
                              })
                            }
                            aria-label={`Set ${s.setIndex} reps`}
                          />
                          <div
                            className={cn(
                              "flex h-11 min-w-0 items-stretch overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950",
                              "focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500",
                              readonly && "opacity-50"
                            )}
                          >
                            <button
                              type="button"
                              disabled={readonly}
                              tabIndex={-1}
                              onClick={() =>
                                nudgeWeight(log.id, s.setIndex, -2.5)
                              }
                              className="flex w-8 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700 disabled:pointer-events-none"
                              aria-label={`Set ${s.setIndex} weight −2.5 kg`}
                              title="−2.5 kg"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <input
                              type="number"
                              step="0.5"
                              inputMode="decimal"
                              className="min-w-0 flex-1 border-0 bg-transparent px-0.5 text-center text-base font-medium tabular-nums text-zinc-100 outline-none disabled:opacity-50"
                              disabled={readonly}
                              value={s.weightKg ?? ""}
                              placeholder={
                                prevSet?.weightKg != null
                                  ? String(prevSet.weightKg)
                                  : "—"
                              }
                              onChange={(e) =>
                                updateSet(log.id, s.setIndex, {
                                  weightKg:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                })
                              }
                              aria-label={`Set ${s.setIndex} weight`}
                            />
                            <button
                              type="button"
                              disabled={readonly}
                              tabIndex={-1}
                              onClick={() =>
                                nudgeWeight(log.id, s.setIndex, 2.5)
                              }
                              className="flex w-8 shrink-0 items-center justify-center text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100 active:bg-zinc-700 disabled:pointer-events-none"
                              aria-label={`Set ${s.setIndex} weight +2.5 kg`}
                              title="+2.5 kg"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <input
                            className={cellInput}
                            disabled={readonly}
                            inputMode="decimal"
                            value={s.rpe ?? ""}
                            onFocus={() =>
                              setRpeFocus({
                                logId: log.id,
                                setIndex: s.setIndex,
                              })
                            }
                            onChange={(e) =>
                              updateSet(log.id, s.setIndex, {
                                rpe: e.target.value || null,
                              })
                            }
                            aria-label={`Set ${s.setIndex} RPE`}
                          />
                          <button
                            type="button"
                            disabled={readonly}
                            onClick={() =>
                              updateSet(log.id, s.setIndex, {
                                pain: !s.pain,
                              })
                            }
                            className={cn(
                              "flex h-11 w-full items-center justify-center rounded-lg border transition",
                              s.pain
                                ? "border-amber-500 bg-amber-900/50 text-amber-200"
                                : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-amber-700 hover:text-amber-400",
                              readonly && "opacity-50"
                            )}
                            aria-label={
                              s.pain
                                ? `Clear pain on set ${s.setIndex}`
                                : `Flag pain on set ${s.setIndex}`
                            }
                            aria-pressed={!!s.pain}
                            title="Pain"
                          >
                            <AlertTriangle
                              className="h-4 w-4"
                              strokeWidth={2.5}
                            />
                          </button>
                          <button
                            type="button"
                            disabled={readonly}
                            onClick={() =>
                              toggleSetDone(log.id, s.setIndex, !s.completed)
                            }
                            className={cn(
                              "flex h-11 w-full items-center justify-center rounded-lg border transition",
                              s.completed
                                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm shadow-emerald-950/50"
                                : "border-zinc-700 bg-zinc-900 text-zinc-500 hover:border-emerald-700 hover:text-emerald-400",
                              readonly && "opacity-50"
                            )}
                            aria-label={
                              s.completed
                                ? `Unmark set ${s.setIndex}`
                                : `Complete set ${s.setIndex}`
                            }
                            aria-pressed={s.completed}
                          >
                            <Check className="h-5 w-5" strokeWidth={2.5} />
                          </button>
                        </div>
                        {rpeOpen && !readonly && (
                          <div className="flex flex-wrap gap-1 pl-9">
                            {RPE_PRESETS.map((v) => (
                              <button
                                key={v}
                                type="button"
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs font-medium tabular-nums transition",
                                  s.rpe === v
                                    ? "border-emerald-600 bg-emerald-950/50 text-emerald-200"
                                    : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-600"
                                )}
                                onClick={() => {
                                  updateSet(log.id, s.setIndex, { rpe: v });
                                  setRpeFocus(null);
                                }}
                              >
                                {v}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="rounded-md px-2 py-1 text-xs text-zinc-500 hover:text-zinc-300"
                              onClick={() => setRpeFocus(null)}
                            >
                              close
                            </button>
                          </div>
                        )}
                      </div>
                    );
                    })}
                  </div>

                  {!readonly && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => addSet(log.id)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add set
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeSet(log.id)}
                        disabled={sets.length <= 1}
                      >
                        <Minus className="h-3.5 w-3.5" />
                        Remove set
                      </Button>
                    </div>
                  )}

                  {/* Quiet notes: collapsed when program meta dump is prefilled */}
                  {(() => {
                    const longMeta = isProgramMetaDump(log.notes);
                    if (longMeta && !readonly) {
                      return (
                        <details className="rounded-lg border border-zinc-800/80 bg-zinc-950/30">
                          <summary className="cursor-pointer px-2.5 py-2 text-[11px] font-medium text-zinc-500 marker:content-none [&::-webkit-details-marker]:hidden">
                            Coach notes (program)
                          </summary>
                          <div className="border-t border-zinc-800 px-2.5 py-2">
                            <Textarea
                              disabled={readonly}
                              value={log.notes ?? ""}
                              onChange={(e) =>
                                updateLog(log.id, { notes: e.target.value })
                              }
                              placeholder="Cues, substitutions…"
                              rows={2}
                              className="min-h-[56px] text-xs"
                              aria-label={`Notes for ${log.exerciseName}`}
                            />
                          </div>
                        </details>
                      );
                    }
                    return (
                      <div>
                        <Label>Notes</Label>
                        <Input
                          disabled={readonly}
                          value={log.notes ?? ""}
                          onChange={(e) =>
                            updateLog(log.id, { notes: e.target.value })
                          }
                          placeholder="Cues, substitutions…"
                        />
                      </div>
                    );
                  })()}
                </div>
              )}
            </Card>
            {inGroup && log.restAfterSec != null && log.restAfterSec > 0 && (
              <div className="my-1.5 text-center text-[11px] font-medium text-zinc-500">
                ↓ {formatRestLabel(log.restAfterSec)} → next
              </div>
            )}
            </div>
          );
          };

          if (block.type === "group") {
            const memberIds = block.members.map((m) => m.id);
            const groupHasCurrent = groupContainsCurrent(
              memberIds,
              currentExId
            );
            const groupOpen =
              readonly ||
              groupHasCurrent ||
              block.members.some((m) => collapsed[m.id] === false);
            const groupDone = block.members.every((m) => m.completed);
            function expandGroup() {
              setCollapsed((c) => {
                const next = { ...c };
                for (const id of memberIds) next[id] = false;
                return next;
              });
            }
            function collapseGroup() {
              if (readonly || groupHasCurrent) return;
              setCollapsed((c) => {
                const next = { ...c };
                for (const id of memberIds) next[id] = true;
                return next;
              });
            }
            return (
              <div
                key={block.groupId}
                className="space-y-2 rounded-xl border border-amber-900/40 bg-amber-950/10 p-2.5 sm:p-3"
              >
                {!groupOpen ? (
                  <button
                    type="button"
                    onClick={expandGroup}
                    className="flex w-full flex-wrap items-center gap-2 rounded-lg text-left outline-none ring-emerald-500/40 focus-visible:ring-2"
                    aria-expanded={false}
                    aria-label={`Expand group ${formatGroupTitle(block.kind, block.label)}`}
                  >
                    <Badge tone="amber">
                      {formatSchemeName(block.kind)}
                    </Badge>
                    <span className="text-sm font-semibold text-zinc-100">
                      {formatGroupTitle(block.kind, block.label)}
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-500">
                      {block.rounds} rounds
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      · {block.members.length} exercises
                      {groupDone ? " · done" : " · collapsed"} · tap to expand
                    </span>
                  </button>
                ) : (
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-2",
                      !readonly &&
                        !groupHasCurrent &&
                        "cursor-pointer rounded-lg outline-none ring-emerald-500/40 focus-visible:ring-2"
                    )}
                    role={
                      !readonly && !groupHasCurrent ? "button" : undefined
                    }
                    tabIndex={
                      !readonly && !groupHasCurrent ? 0 : undefined
                    }
                    onClick={
                      !readonly && !groupHasCurrent
                        ? collapseGroup
                        : undefined
                    }
                    onKeyDown={
                      !readonly && !groupHasCurrent
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              collapseGroup();
                            }
                          }
                        : undefined
                    }
                    aria-expanded={true}
                  >
                    <Badge tone="amber">
                      {formatSchemeName(block.kind)}
                    </Badge>
                    <span className="text-sm font-semibold text-zinc-100">
                      {formatGroupTitle(block.kind, block.label)}
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-500">
                      {block.rounds} rounds
                    </span>
                  </div>
                )}
                {groupOpen && (
                  <>
                    <div className="rounded-lg border border-amber-900/30 bg-zinc-950/50 px-2.5 py-2 text-[11px] leading-relaxed text-zinc-400">
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Each round
                      </div>
                      <div className="mt-0.5 font-medium text-zinc-200">
                        {formatGroupFlow(block.members)}
                      </div>
                      <div className="mt-1 text-zinc-500">
                        Log set 1 on A, then set 1 on B… After the round:{" "}
                        <span className="font-medium text-zinc-300">
                          {formatRestLabel(block.restBetweenRoundsSec)}
                        </span>
                      </div>
                      {block.howTo && (
                        <p className="mt-1.5 border-t border-zinc-800 pt-1.5 text-zinc-500">
                          {block.howTo}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      {block.members.map((m, mi) =>
                        renderExerciseCard(m, mi, true)
                      )}
                    </div>
                    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1.5 text-center text-[11px] text-zinc-500">
                      End of round ·{" "}
                      <span className="font-medium text-zinc-300">
                        {formatRestLabel(block.restBetweenRoundsSec)}
                      </span>{" "}
                      · then set 2…
                    </div>
                  </>
                )}
              </div>
            );
          }

          return renderExerciseCard(block.exercise, blockIdx, false);
        })}
      </div>

      {/* Session summary text — CTAs live on close-loop when completed */}
      {(readonly || summaryText) && (
        <div id="session-summary" className="scroll-mt-20">
        <Card className="space-y-2 print:border-0 print:bg-white print:text-black">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-100 print:text-black">
              Session summary
            </h3>
            {/* Avoid double primary CTAs when close-loop already offers share */}
            {status !== "completed" && (
              <div className="flex flex-wrap gap-2 print:hidden">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={pending}
                  onClick={() => void shareSummary()}
                  className="min-h-11"
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden />
                  Copy
                </Button>
                {canNativeShare && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    loading={pending}
                    onClick={() => void shareSummary({ native: true })}
                    className="min-h-11"
                  >
                    <Share2 className="h-3.5 w-3.5" aria-hidden />
                    Share
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => window.print()}
                  className="min-h-11"
                >
                  Print
                </Button>
              </div>
            )}
            {status === "completed" && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => window.print()}
                className="min-h-11 print:hidden"
              >
                Print
              </Button>
            )}
          </div>
          {summaryText ? (
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs leading-relaxed text-zinc-400 print:max-h-none print:border-0 print:bg-white print:text-black">
              {summaryText}
            </pre>
          ) : (
            <p className="text-xs text-zinc-500">
              Copy a plain-text summary for the client (WhatsApp, email, notes).
            </p>
          )}
        </Card>
        </div>
      )}

      {restActive && (
        <FloorRestTimer
          key={restActive.token}
          seconds={restActive.seconds}
          label={restActive.label}
          token={restActive.token}
          mode={restActive.mode}
          subtitle={restActive.subtitle}
          onDismiss={() => setRestActive(null)}
        />
      )}

      {showShortcuts && !readonly && (
        <div className="fixed bottom-36 right-3 z-40 max-w-xs rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 text-xs text-zinc-300 shadow-xl print:hidden">
          <div className="mb-2 flex items-center justify-between gap-2 font-semibold text-zinc-100">
            <span className="inline-flex items-center gap-1.5">
              <Keyboard className="h-3.5 w-3.5" />
              Floor shortcuts
            </span>
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300"
              onClick={() => setShowShortcuts(false)}
            >
              Close
            </button>
          </div>
          <ul className="space-y-1 text-zinc-400">
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                Space
              </kbd>{" "}
              complete next set
            </li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                A
              </kbd>{" "}
              apply progression tip
            </li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                N
              </kbd>{" "}
              /{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                P
              </kbd>{" "}
              next / prev exercise
            </li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                +
              </kbd>{" "}
              /{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                −
              </kbd>{" "}
              nudge open weight (±1 · Shift ±2.5)
            </li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                S
              </kbd>{" "}
              save ·{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                U
              </kbd>{" "}
              undo ·{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                R
              </kbd>{" "}
              rest
            </li>
            <li>
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                Esc
              </kbd>{" "}
              dismiss ·{" "}
              <kbd className="rounded bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
                ?
              </kbd>{" "}
              this help
            </li>
          </ul>
        </div>
      )}

      {/* Sticky floor actions — sit above mobile bottom nav */}
      {!readonly && (
        <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur print:hidden md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
          {isDirty && (
            <div className="border-b border-amber-900/30 bg-amber-950/25 px-3 py-1 text-center text-[11px] font-medium text-amber-200/90">
              Unsaved changes
            </div>
          )}
          <div className="mx-auto flex max-w-3xl items-center gap-2 px-3 py-2.5">
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-none">
              <Button
                type="button"
                variant="secondary"
                onClick={saveDraft}
                loading={pending}
                className={cn(
                  "min-h-11 flex-1 sm:flex-none",
                  isDirty && "border-amber-700/50"
                )}
                aria-label={isDirty ? "Save progress (unsaved changes)" : "Save progress"}
              >
                {isDirty ? "Save*" : "Save"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={performUndo}
                disabled={!canUndo || pending}
                className="min-h-11 px-2.5 sm:px-3.5"
                title="Undo (U / Ctrl+Z)"
                aria-label="Undo last change"
              >
                <Undo2 className="h-4 w-4" />
                <span className="hidden sm:inline">Undo</span>
              </Button>
            </div>
            <Button
              type="button"
              onClick={complete}
              loading={pending}
              className={cn(
                "min-h-11 min-w-[7.5rem] flex-1 font-semibold sm:flex-none sm:min-w-[9rem]",
                stats.pct >= 100 && "shadow-md shadow-emerald-950/60"
              )}
              aria-label="Complete session"
            >
              {stats.pct >= 100 ? "Complete session ✓" : "Complete session"}
            </Button>
            <div className="hidden items-center gap-1 sm:flex">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcuts((v) => !v)}
                className="text-zinc-500"
                title="Keyboard shortcuts"
                aria-label="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
              <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-500">
                <input
                  type="checkbox"
                  checked={autoRest}
                  onChange={(e) => setAutoRest(e.target.checked)}
                  className="rounded border-zinc-600"
                />
                Auto-rest
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancel}
                disabled={pending}
                className="text-zinc-500"
              >
                Cancel
              </Button>
            </div>
            {/* Mobile: overflow menu via compact cancel + rest toggle */}
            <div className="flex items-center gap-0.5 sm:hidden">
              <label
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-zinc-500"
                title="Auto-rest"
              >
                <input
                  type="checkbox"
                  checked={autoRest}
                  onChange={(e) => setAutoRest(e.target.checked)}
                  className="sr-only"
                />
                <Timer
                  className={cn(
                    "h-4 w-4",
                    autoRest ? "text-emerald-400" : "text-zinc-600"
                  )}
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={cancel}
                disabled={pending}
                className="h-11 px-2 text-[11px] text-zinc-500"
                title="Cancel session"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </FocusShell>
  );
}
