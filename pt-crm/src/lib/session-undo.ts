export type SessionUndoEntry = {
  type: "toggle_set" | "update_set" | "update_log";
  logId: string;
  setIndex?: number;
  /** Snapshot of fields before the change (enough to restore) */
  before: {
    setLogs?: Array<{
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
    completed?: boolean;
    notes?: string | null;
  };
  label: string;
};

export class SessionUndoStack {
  private stack: SessionUndoEntry[] = [];
  private readonly max: number;

  constructor(max = 40) {
    this.max = Math.max(1, max);
  }

  push(entry: SessionUndoEntry): void {
    this.stack.push(entry);
    if (this.stack.length > this.max) {
      this.stack.splice(0, this.stack.length - this.max);
    }
  }

  pop(): SessionUndoEntry | null {
    return this.stack.pop() ?? null;
  }

  peek(): SessionUndoEntry | null {
    if (this.stack.length === 0) return null;
    return this.stack[this.stack.length - 1] ?? null;
  }

  clear(): void {
    this.stack = [];
  }

  get size(): number {
    return this.stack.length;
  }

  get canUndo(): boolean {
    return this.stack.length > 0;
  }
}

export function applyUndoToLogs<
  T extends {
    id: string;
    setLogs?: SessionUndoEntry["before"]["setLogs"];
    completed?: boolean;
    notes?: string | null;
  },
>(logs: T[], entry: SessionUndoEntry): T[] {
  const { logId, before } = entry;
  return logs.map((log) => {
    if (log.id !== logId) return log;

    const next: T = { ...log };

    if (before.setLogs !== undefined) {
      next.setLogs = before.setLogs.map((s) => ({ ...s }));
    }
    if (before.completed !== undefined) {
      next.completed = before.completed;
    }
    if (before.notes !== undefined) {
      next.notes = before.notes;
    }

    return next;
  });
}
