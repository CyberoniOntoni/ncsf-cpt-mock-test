/**
 * Client-safe pure helpers for offline session drafts (localStorage).
 * All window / localStorage access is guarded for SSR safety.
 */

export type SessionDraftPayload = {
  sessionId: string;
  updatedAt: number;
  durationMin: string;
  overallRpe: string;
  painNotes: string;
  notes: string;
  logs: Array<{
    id: string;
    notes: string | null;
    completed: boolean;
    setLogs: Array<{
      setIndex: number;
      reps: string;
      weightKg: number | null;
      rpe: string | null;
      completed: boolean;
      role?: string | null;
      tempo?: string | null;
      restSec?: number | null;
      note?: string | null;
      pain?: boolean | null;
    }>;
  }>;
};

export function storageKey(sessionId: string): string {
  return `floorscribe:session-draft:${sessionId}`;
}

function legacyStorageKey(sessionId: string): string {
  return `pt-crm:session-draft:${sessionId}`;
}

export function saveSessionDraft(payload: SessionDraftPayload): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(payload.sessionId), JSON.stringify(payload));
    try {
      window.localStorage.removeItem(legacyStorageKey(payload.sessionId));
    } catch {
      // ignore
    }
    return true;
  } catch {
    return false;
  }
}

export function loadSessionDraft(sessionId: string): SessionDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) {
      raw = window.localStorage.getItem(legacyStorageKey(sessionId));
      if (raw) {
        // Migrate offline draft from pre-rebrand key
        try {
          window.localStorage.setItem(storageKey(sessionId), raw);
          window.localStorage.removeItem(legacyStorageKey(sessionId));
        } catch {
          // ignore
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraftPayload;
    if (!parsed || typeof parsed !== "object" || parsed.sessionId !== sessionId) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearSessionDraft(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(sessionId));
    window.localStorage.removeItem(legacyStorageKey(sessionId));
  } catch {
    // private mode / quota — ignore
  }
}

function serverTimeMs(serverUpdatedAt?: Date | string | null): number | null {
  if (serverUpdatedAt == null) return null;
  if (serverUpdatedAt instanceof Date) {
    const t = serverUpdatedAt.getTime();
    return Number.isFinite(t) ? t : null;
  }
  const t = new Date(serverUpdatedAt).getTime();
  return Number.isFinite(t) ? t : null;
}

const DEFAULT_CLOCK_SKEW_MARGIN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Checks whether draft has non-empty entries (sets completed/weight/reps/rpe/notes, or session notes).
 */
export function hasDraftContent(draft: SessionDraftPayload): boolean {
  if (!draft) return false;
  if (
    (draft.durationMin && draft.durationMin.trim() !== "") ||
    (draft.overallRpe && draft.overallRpe.trim() !== "") ||
    (draft.painNotes && draft.painNotes.trim() !== "") ||
    (draft.notes && draft.notes.trim() !== "")
  ) {
    return true;
  }
  for (const log of draft.logs ?? []) {
    if (log.notes && log.notes.trim() !== "") return true;
    if (log.completed) return true;
    for (const set of log.setLogs ?? []) {
      if (set.completed) return true;
      if (set.weightKg != null && Number.isFinite(set.weightKg)) return true;
      if (set.reps != null && set.reps.trim() !== "") return true;
      if (set.rpe != null && set.rpe.trim() !== "") return true;
      if (set.note != null && set.note.trim() !== "") return true;
      if (set.pain) return true;
    }
  }
  return false;
}

/**
 * Prefer draft when it is newer than (or within clock-skew tolerance of) the server timestamp.
 * If no server time is provided, treat as "newer" when the draft has non-empty entries.
 */
export function isDraftNewerThan(
  draft: SessionDraftPayload,
  serverUpdatedAt?: Date | string | null,
  skewMarginMs: number = DEFAULT_CLOCK_SKEW_MARGIN_MS,
): boolean {
  const serverMs = serverTimeMs(serverUpdatedAt);
  if (serverMs != null) {
    // Prefer draft when it is newer than or within clock-skew tolerance of the server.
    // If the server is clearly newer (outside skew window), trust the server.
    return draft.updatedAt >= serverMs - skewMarginMs;
  }
  // No server timestamp (offline / unknown) — use content as signal.
  return hasDraftContent(draft);
}

type DraftLog = SessionDraftPayload["logs"][number];
type DraftSetLog = DraftLog["setLogs"][number];

/**
 * Apply draft logs onto server logs by exercise-log id.
 * Only merges setLogs, completed, and notes from the draft.
 */
export function mergeDraftIntoLogs<
  T extends {
    id: string;
    notes?: string | null;
    completed?: boolean;
    setLogs?: DraftSetLog[] | null;
  },
>(serverLogs: T[], draftLogs: DraftLog[]): T[] {
  if (!draftLogs?.length) return serverLogs;
  const byId = new Map(draftLogs.map((d) => [d.id, d]));

  return serverLogs.map((server) => {
    const draft = byId.get(server.id);
    if (!draft) return server;
    return {
      ...server,
      notes: draft.notes,
      completed: draft.completed,
      setLogs: draft.setLogs,
    };
  });
}
