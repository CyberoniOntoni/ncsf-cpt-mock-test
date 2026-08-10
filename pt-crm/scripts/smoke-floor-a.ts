/**
 * Lane A deepen smoke: pure floor libs only (no DB, no window).
 * Run: npx tsx scripts/smoke-floor-a.ts
 */
import {
  emomRestSeconds,
  isEmomScheme,
  secondsUntilNextMinuteMark,
} from "../src/lib/emom-clock";
import {
  applyUndoToLogs,
  SessionUndoStack,
  type SessionUndoEntry,
} from "../src/lib/session-undo";
import {
  compareToPrevious,
  estimateE1RM,
} from "../src/lib/set-performance";
import {
  isDraftNewerThan,
  mergeDraftIntoLogs,
  saveSessionDraft,
  type SessionDraftPayload,
} from "../src/lib/session-draft";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function approx(actual: number, expected: number, eps = 0.02): boolean {
  return Math.abs(actual - expected) <= eps;
}

function main() {
  // --- emom-clock ---
  const untilMark = secondsUntilNextMinuteMark(new Date());
  assert(
    untilMark >= 1 && untilMark <= 60,
    `secondsUntilNextMinuteMark out of range: ${untilMark}`
  );
  // Exact minute boundary → full minute remaining
  const onMark = secondsUntilNextMinuteMark(new Date(0));
  assert(onMark === 60, `expected 60 on mark, got ${onMark}`);

  assert(isEmomScheme("emom") === true, 'isEmomScheme("emom") should be true');
  assert(isEmomScheme("straight") === false, 'isEmomScheme("straight") false');
  assert(isEmomScheme(null, "emom") === true, "isEmomScheme role emom");

  const now = new Date();
  const workStartedAt = new Date(now.getTime() - 10_000);
  const emomRest = emomRestSeconds({ workStartedAt, now });
  assert(
    emomRest >= 5 && emomRest <= 60,
    `emomRestSeconds(workStartedAt 10s ago) out of 5..60: ${emomRest}`
  );
  // 60 − 10 = 50
  assert(
    emomRest === 50,
    `emomRestSeconds expected ~50 for 10s elapsed, got ${emomRest}`
  );

  // --- session-undo ---
  const stack = new SessionUndoStack(5);
  const logsBefore = [
    {
      id: "log1",
      completed: false,
      notes: null as string | null,
      setLogs: [
        {
          setIndex: 1,
          reps: "5",
          weightKg: 100,
          rpe: "7",
          completed: false,
          pain: false as boolean | null,
        },
      ],
    },
  ];

  const entry: SessionUndoEntry = {
    type: "update_set",
    logId: "log1",
    setIndex: 1,
    before: {
      setLogs: [
        {
          setIndex: 1,
          reps: "5",
          weightKg: 100,
          rpe: "7",
          completed: false,
          pain: false,
        },
      ],
      completed: false,
      notes: null,
    },
    label: "Squat · set 1",
  };

  // Simulate a change, then undo restores snapshot
  const logsAfterChange = [
    {
      id: "log1",
      completed: true,
      notes: null as string | null,
      setLogs: [
        {
          setIndex: 1,
          reps: "5",
          weightKg: 110,
          rpe: "8",
          completed: true,
          pain: true as boolean | null,
        },
      ],
    },
  ];

  stack.push(entry);
  assert(stack.size === 1 && stack.canUndo, "stack push failed");
  const popped = stack.pop();
  assert(popped?.label === "Squat · set 1", "stack pop failed");
  const restored = applyUndoToLogs(logsAfterChange, popped!);
  assert(restored[0].setLogs?.[0].weightKg === 100, "undo weight restore");
  assert(restored[0].setLogs?.[0].completed === false, "undo completed restore");
  assert(restored[0].setLogs?.[0].pain === false, "undo pain restore");
  assert(restored[0].completed === false, "undo log.completed restore");
  // baseline still shape-compatible
  assert(logsBefore[0].id === restored[0].id, "undo log id");

  // --- set-performance ---
  const e1 = estimateE1RM(100, 5);
  assert(e1 != null, "estimateE1RM null");
  // Epley: 100 * (1 + 5/30) = 100 * 7/6 ≈ 116.666...
  assert(
    approx(e1!, 116.67, 0.02),
    `estimateE1RM(100,5) ≈ 116.67, got ${e1}`
  );

  const pr = compareToPrevious(
    [{ weightKg: 110, reps: "5", completed: true }],
    [{ weightKg: 100, reps: "5", completed: true }]
  );
  assert(pr.kind === "pr", `compareToPrevious expected pr, got ${pr.kind}`);

  // --- session-draft (pure paths only in node) ---
  // saveSessionDraft requires window — in node it must return false / no-op
  const saveOk = saveSessionDraft({
    sessionId: "sess_test",
    updatedAt: Date.now(),
    durationMin: "45",
    overallRpe: "7",
    painNotes: "",
    notes: "",
    logs: [],
  });
  assert(
    saveOk === false,
    "saveSessionDraft should be false without window (node)"
  );

  const draft: SessionDraftPayload = {
    sessionId: "sess_1",
    updatedAt: Date.now(),
    durationMin: "40",
    overallRpe: "8",
    painNotes: "knee",
    notes: "draft notes",
    logs: [
      {
        id: "log_a",
        notes: "from draft",
        completed: true,
        setLogs: [
          {
            setIndex: 1,
            reps: "8",
            weightKg: 60,
            rpe: "7",
            completed: true,
            pain: true,
          },
        ],
      },
    ],
  };

  const olderServer = new Date(Date.now() - 60_000);
  assert(
    isDraftNewerThan(draft, olderServer) === true,
    "isDraftNewerThan should prefer newer draft"
  );
  // Server 1 min ahead but within 5-min skew tolerance — draft still wins
  const skewServer = new Date(Date.now() + 60_000);
  assert(
    isDraftNewerThan(draft, skewServer) === true,
    "isDraftNewerThan should prefer draft within clock-skew tolerance"
  );
  // Draft with real content beats a clearly-newer server (offline logging protection)
  const clearlyNewerServer = new Date(Date.now() + 6 * 60_000);
  assert(
    isDraftNewerThan(draft, clearlyNewerServer) === true,
    "isDraftNewerThan: content draft survives clearly-newer server (offline protection)"
  );
  // Empty draft + clearly-newer server → server wins (stale placeholder, discard)
  const emptyDraft = {
    ...draft,
    durationMin: "",
    overallRpe: "",
    painNotes: "",
    notes: "",
    logs: [],
  };
  assert(
    isDraftNewerThan(emptyDraft, clearlyNewerServer) === false,
    "isDraftNewerThan: empty draft loses to clearly-newer server"
  );

  const serverLogs = [
    {
      id: "log_a",
      notes: "server" as string | null,
      completed: false,
      setLogs: [
        {
          setIndex: 1,
          reps: "8",
          weightKg: null as number | null,
          rpe: null as string | null,
          completed: false,
          pain: null as boolean | null,
        },
      ],
    },
    {
      id: "log_b",
      notes: "untouched" as string | null,
      completed: false,
      setLogs: [] as SessionDraftPayload["logs"][number]["setLogs"],
    },
  ];

  const merged = mergeDraftIntoLogs(serverLogs, draft.logs);
  assert(merged[0].notes === "from draft", "mergeDraftIntoLogs notes");
  assert(merged[0].completed === true, "mergeDraftIntoLogs completed");
  assert(merged[0].setLogs?.[0].weightKg === 60, "mergeDraftIntoLogs weight");
  assert(merged[0].setLogs?.[0].pain === true, "mergeDraftIntoLogs pain");
  assert(merged[1].notes === "untouched", "mergeDraftIntoLogs other log intact");

  console.log("smoke-floor-a: OK");
}

main();
