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
  return `pt-crm:session-draft:${sessionId}`;
}

export function saveSessionDraft(payload: SessionDraftPayload): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(storageKey(payload.sessionId), JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadSessionDraft(sessionId: string): SessionDraftPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
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

/**
 * Prefer draft when it is newer than the server timestamp.
 * If no server time is provided, treat as "newer" when the draft has any
 * completed set or a non-empty weight entry.
 */
export function isDraftNewerThan(
  draft: SessionDraftPayload,
  serverUpdatedAt?: Date | string | null,
): boolean {
  const serverMs = serverTimeMs(serverUpdatedAt);
  if (serverMs != null) {
    return draft.updatedAt > serverMs;
  }
  for (const log of draft.logs ?? []) {
    for (const set of log.setLogs ?? []) {
      if (set.completed) return true;
      if (set.weightKg != null && Number.isFinite(set.weightKg)) return true;
    }
  }
  return false;
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
