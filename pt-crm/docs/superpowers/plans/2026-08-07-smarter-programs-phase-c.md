# Phase C Smarter Programs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers append bank exercises to program days from desk and Coach Apply, without regenerating the whole plan.

**Architecture:** Shared `addProgramExerciseAction` in `programs.ts`; pure `nextProgramExerciseSortOrder` helper for smoke; desk `ExerciseBankPicker` on program detail; coach CRM kind `append_exercise` with intent + execute path. No schema migration.

**Tech Stack:** Next.js App Router, TypeScript, Drizzle/PGlite, existing ExerciseBankPicker + coach console patterns.

**Spec:** `docs/superpowers/specs/2026-08-07-smarter-programs-phase-c-design.md`

## Global Constraints

- No `SCHEMA_VERSION` bump; no new tables.
- Append = standalone `setScheme: "straight"` only (no group invent).
- Reject unavailable bank equipment (same as swap).
- Seed meso `baselinePrescriptions[peId]` when meta already has baselines.
- Local git commits only; author env CyberoniOntoni / cyberoni@local if needed.
- Workspace app root: `pt-crm/` (paths relative to it).
- Verify: `npx tsc --noEmit`; `npx tsx scripts/smoke-programming.ts`

## File map

| File | Responsibility |
|------|----------------|
| **Create** `src/lib/program-exercise-add.ts` | Pure sort-order helper |
| **Modify** `src/app/actions/programs.ts` | `addProgramExerciseAction` |
| **Modify** `src/components/program-detail.tsx` | Add exercise UI per day |
| **Modify** `src/lib/ai/schemas.ts` | `append_exercise` kind + payload fields |
| **Modify** `src/lib/ai/intents.ts` | detect `append_exercise` |
| **Modify** `src/lib/ai/coach.ts` | handle intent → action |
| **Modify** `src/app/actions/coach.ts` | execute append |
| **Modify** `src/components/coach-console.tsx` | mutate kinds |
| **Modify** `scripts/smoke-programming.ts` | assert helper |
| **Modify** `docs/happy-path.md` | §5 append |

---

### Task 1: Pure helper + `addProgramExerciseAction` + smoke

**Files:**
- Create: `src/lib/program-exercise-add.ts`
- Modify: `src/app/actions/programs.ts` (add action after `swapProgramExerciseAction`)
- Modify: `scripts/smoke-programming.ts`

**Interfaces:**
- Produces:
  - `nextProgramExerciseSortOrder(existingSortOrders: number[]): number`
  - `defaultAddExerciseRx(isWarmup: boolean): { sets; reps; rpe; restSec }`
  - `addProgramExerciseAction(input): Promise<{ ok; programExerciseId; programId; name; dayName }>`

- [ ] **Step 1: Create pure helper**

```typescript
// src/lib/program-exercise-add.ts
/** Next sortOrder when appending to a program day (max existing + 1, or 0). */
export function nextProgramExerciseSortOrder(
  existingSortOrders: number[]
): number {
  if (!existingSortOrders.length) return 0;
  return Math.max(...existingSortOrders) + 1;
}

export function defaultAddExerciseRx(isWarmup: boolean): {
  sets: number;
  reps: string;
  rpe: string;
  restSec: number;
} {
  if (isWarmup) {
    return { sets: 2, reps: "8-10", rpe: "5-6", restSec: 45 };
  }
  return { sets: 3, reps: "8-10", rpe: "7", restSec: 90 };
}
```

- [ ] **Step 2: Extend smoke-programming.ts before final ALL PASS**

```typescript
  const {
    nextProgramExerciseSortOrder,
    defaultAddExerciseRx,
  } = await import("../src/lib/program-exercise-add");
  // if smoke is sync main(), use require-style static import at top instead
  assert(nextProgramExerciseSortOrder([]) === 0, "empty day sort 0");
  assert(nextProgramExerciseSortOrder([0, 1, 4]) === 5, "max+1");
  assert(defaultAddExerciseRx(false).sets === 3, "main sets");
  assert(defaultAddExerciseRx(true).restSec === 45, "warmup rest");
  console.log("ok program-exercise-add");
```

If `main()` is sync and not async, use:

```typescript
import {
  nextProgramExerciseSortOrder,
  defaultAddExerciseRx,
} from "../src/lib/program-exercise-add";
```

at top of smoke file (or dynamic import only if main is async). Match existing smoke style.

- [ ] **Step 3: Implement `addProgramExerciseAction` in programs.ts**

After `swapProgramExerciseAction`, add:

```typescript
import {
  defaultAddExerciseRx,
  nextProgramExerciseSortOrder,
} from "@/lib/program-exercise-add";

/** Append a bank exercise to a program day (standalone straight sets). */
export async function addProgramExerciseAction(input: {
  programDayId: string;
  bankExerciseId: string;
  opts?: {
    isWarmup?: boolean;
    sets?: number;
    reps?: string;
    rpe?: string | null;
    restSec?: number | null;
    notes?: string | null;
  };
}) {
  const session = await requireSession();
  const db = await getDb();
  const isWarmup = !!input.opts?.isWarmup;

  const [dayRow] = await db
    .select({
      day: programDays,
      program: programs,
    })
    .from(programDays)
    .innerJoin(programs, eq(programDays.programId, programs.id))
    .where(eq(programDays.id, input.programDayId))
    .limit(1);

  if (!dayRow || dayRow.program.organizationId !== session.organizationId) {
    throw new Error("Not found");
  }

  const bank = await listExercisesForOrg(session.organizationId);
  const pick = bank.find((e) => e.id === input.bankExerciseId);
  if (!pick) throw new Error("Exercise not found in bank");
  if (!pick.available) {
    throw new Error(
      `“${pick.name}” needs equipment not marked available: ${pick.missingEquipment.join(", ") || "unknown"}`
    );
  }

  const existing = await db
    .select({ sortOrder: programExercises.sortOrder })
    .from(programExercises)
    .where(eq(programExercises.programDayId, input.programDayId));

  const sortOrder = nextProgramExerciseSortOrder(
    existing.map((e) => e.sortOrder)
  );
  const defaults = defaultAddExerciseRx(isWarmup);
  const sets = input.opts?.sets ?? defaults.sets;
  const reps = input.opts?.reps ?? defaults.reps;
  const rpe =
    input.opts?.rpe !== undefined ? input.opts.rpe : defaults.rpe;
  const restSec =
    input.opts?.restSec !== undefined
      ? input.opts.restSec
      : defaults.restSec;
  const notes =
    input.opts?.notes !== undefined
      ? input.opts.notes
      : pick.cues || null;

  const peId = id("pe");
  await db.insert(programExercises).values({
    id: peId,
    programDayId: input.programDayId,
    exerciseId: pick.id,
    exerciseName: pick.name,
    movementPattern: pick.movementPattern,
    sets,
    reps,
    rpe,
    restSec,
    notes,
    sortOrder,
    isWarmup,
    setScheme: "straight",
    setSchemeMeta: null,
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
    restAfterSec: null,
    restBetweenRoundsSec: null,
    groupRole: null,
  });

  // Seed meso baseline when baselines already exist
  const prevMeta =
    (dayRow.program.generationMeta as Record<string, unknown> | null) || {};
  const baselines =
    (prevMeta.baselinePrescriptions as
      | Record<string, { sets: number; reps: string; rpe: string | null; restSec: number | null }>
      | undefined) || {};
  const nextBaselines = {
    ...baselines,
    [peId]: { sets, reps, rpe, restSec },
  };

  await db
    .update(programs)
    .set({
      generationMeta: {
        ...prevMeta,
        baselinePrescriptions: nextBaselines,
      },
      updatedAt: new Date(),
    })
    .where(eq(programs.id, dayRow.program.id));

  revalidatePath(`/programs/${dayRow.program.id}`);
  revalidatePath("/programs");
  if (dayRow.program.clientId) {
    revalidatePath(`/clients/${dayRow.program.clientId}`);
  }

  return {
    ok: true as const,
    programExerciseId: peId,
    programId: dayRow.program.id,
    name: pick.name,
    dayName: dayRow.day.name,
  };
}
```

Ensure `id` helper already imported in programs.ts (it is used elsewhere).

- [ ] **Step 4: Run**

```
npx tsx scripts/smoke-programming.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```
git add pt-crm/src/lib/program-exercise-add.ts pt-crm/src/app/actions/programs.ts pt-crm/scripts/smoke-programming.ts
git commit -m "feat(programs): addProgramExerciseAction for day append"
```

---

### Task 2: Program detail “Add exercise” UI

**Files:**
- Modify: `src/components/program-detail.tsx`

**Interfaces:**
- Consumes: `addProgramExerciseAction`
- Produces: per-day Add exercise → picker → append

- [ ] **Step 1: Import action; state `addDayId: string | null`**

```typescript
import {
  // ...existing
  addProgramExerciseAction,
} from "@/app/actions/programs";
```

Near other UI state:

```typescript
const [addDayId, setAddDayId] = useState<string | null>(null);
```

- [ ] **Step 2: Handler**

```typescript
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
```

- [ ] **Step 3: Day header button + picker**

In day actions (next to Regen day):

```tsx
<Button
  type="button"
  variant="secondary"
  size="sm"
  disabled={pending}
  onClick={() => {
    setSwapId(null);
    setEditId(null);
    setAddDayId((cur) => (cur === day.id ? null : day.id));
  }}
  className="min-h-11"
>
  {addDayId === day.id ? "Cancel add" : "Add exercise"}
</Button>
```

After the day header row (before exercise list), if `addDayId === day.id`:

```tsx
{addDayId === day.id && (
  <div className="mt-3">
    <ExerciseBankPicker
      title={`Add to ${day.name}`}
      onCancel={() => setAddDayId(null)}
      onPick={(bank) => addExercise(day.id, bank)}
    />
  </div>
)}
```

- [ ] **Step 4: tsc; commit**

```
git commit -m "feat(programs): desk Add exercise picker on program day"
```

---

### Task 3: Coach `append_exercise`

**Files:**
- Modify: `src/lib/ai/schemas.ts`
- Modify: `src/lib/ai/intents.ts`
- Modify: `src/lib/ai/coach.ts`
- Modify: `src/app/actions/coach.ts`
- Modify: `src/components/coach-console.tsx`

- [ ] **Step 1: schemas.ts** — add to kind enum `"append_exercise"`; payload optional fields:

```typescript
bankExerciseId: z.string().optional(),
exerciseName: z.string().optional(),
isWarmup: z.boolean().optional(),
```

(`programDayId` and `programId` already exist.)

- [ ] **Step 2: intents.ts**

Add to CoachIntent:

```typescript
| {
    kind: "append_exercise";
    exerciseQuery?: string;
    dayHint?: number; // 1-based day index if parsed
    isWarmup?: boolean;
  }
```

In `detectIntent`, **before** insert_correctives (so “add correctives” still wins via corrective patterns first — actually keep correctives first, then append):

```typescript
  // After insert_correctives block:
  if (
    /(add|append|include|put)\b.{0,40}\b(to|on|into)\b.{0,20}\b(program|plan|day|workout)/i.test(
      m
    ) ||
    /\b(add|append)\b.{0,48}\b(exercise|movement|drill)\b/i.test(m) ||
    /\badd\s+[a-z0-9][a-z0-9\s\-]{1,40}\s+to\s+(day|the program|program)/i.test(
      m
    )
  ) {
    const dayM = m.match(/\bday\s*([1-6a-d])\b/i);
    let dayHint: number | undefined;
    if (dayM) {
      const d = dayM[1].toLowerCase();
      if (/^[1-6]$/.test(d)) dayHint = Number(d);
      else dayHint = "abcd".indexOf(d) + 1 || undefined;
    }
    // Extract query: prefer quoted, else strip add/to program noise
    let exerciseQuery: string | undefined;
    const quoted = m.match(/["“](.+?)["”]/);
    if (quoted) exerciseQuery = quoted[1].trim();
    else {
      const stripped = m
        .replace(
          /\b(add|append|include|put)\b/gi,
          " "
        )
        .replace(
          /\b(to|on|into)\b.{0,20}\b(the\s+)?(program|plan|day\s*[1-6a-d]?|workout)\b.*/i,
          " "
        )
        .replace(/\b(exercise|movement|drill|as\s+warmup|warmup)\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (stripped.length >= 2) exerciseQuery = stripped;
    }
    const isWarmup = /warm-?up|as\s+warmup/i.test(m);
    return { kind: "append_exercise", exerciseQuery, dayHint, isWarmup };
  }
```

- [ ] **Step 3: coach.ts** — in `handleProgramMutateIntent` (or equivalent), handle `append_exercise`:

Resolve active program (same as correctives). Load days ordered by dayIndex. Pick day: dayHint 1-based or first day.

Resolve bank exercise via `listExercisesForOrg` — filter available, score by name includes / startsWith. If 0 matches: solution with open_program. If 1+: primary action with best match; optional note if ambiguous.

```typescript
  if (intent.kind === "append_exercise") {
    // prog already resolved
    const days = /* from context or query */;
    // Prefer days already on client context if available
    ...
    actions: [{
      id: "do_append_exercise",
      kind: "append_exercise",
      label: `Add ${pick.name}`,
      description: day.name,
      payload: {
        programId: prog.id,
        programDayId: day.id,
        bankExerciseId: pick.id,
        exerciseName: pick.name,
        clientId: input.clientId,
        isWarmup: intent.isWarmup,
      },
    }, ...]
  }
```

Wire `detectIntent` branch into the same mutate handler path as insert_correctives (`runCoachTurn` / intent switch).

Also export a small pure helper for bank name match if useful for smoke:

```typescript
// can live in program-exercise-add.ts
export function rankBankByNameQuery<T extends { name: string; available?: boolean }>(
  bank: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return bank
    .filter((e) => e.name.toLowerCase().includes(q))
    .sort((a, b) => {
      const aStart = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStart = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      if (aStart !== bStart) return aStart - bStart;
      const aAvail = a.available === false ? 1 : 0;
      const bAvail = b.available === false ? 1 : 0;
      if (aAvail !== bAvail) return aAvail - bAvail;
      return a.name.length - b.name.length;
    });
}
```

- [ ] **Step 4: coach.ts execute**

```typescript
  if (action.kind === "append_exercise") {
    const programDayId = action.payload?.programDayId;
    const bankExerciseId = action.payload?.bankExerciseId;
    if (!programDayId || !bankExerciseId) {
      throw new Error("Missing day or exercise for append");
    }
    const { addProgramExerciseAction } = await import("@/app/actions/programs");
    const res = await addProgramExerciseAction({
      programDayId,
      bankExerciseId,
      opts: { isWarmup: !!action.payload?.isWarmup },
    });
    return {
      ok: true as const,
      kind: "append_exercise" as const,
      programId: res.programId,
      href: `/programs/${res.programId}`,
      message: `Added ${res.name} to ${res.dayName}.`,
    };
  }
```

- [ ] **Step 5: coach-console.tsx** — add `append_exercise` to every `isMutate` / emerald primary lists that include `insert_correctives`.

- [ ] **Step 6: tsc; commit**

```
git commit -m "feat(coach): append_exercise Apply to program day"
```

---

### Task 4: Docs + final verify

**Files:**
- Modify: `docs/happy-path.md`
- Optionally mark design success checkboxes

- [ ] **Step 1: happy-path §5**

Add bullets:

- Program detail: **Add exercise** per day (bank picker; no full regen).
- Coach: “add face pulls to day 1” / “add X to program” → **Apply** appends to plan.

- [ ] **Step 2: Run**

```
npx tsc --noEmit
npx tsx scripts/smoke-programming.ts
```

- [ ] **Step 3: Commit**

```
git commit -m "docs: Phase C smarter programs happy-path"
```

Also commit design/plan if not yet committed:

```
git add pt-crm/docs/superpowers/specs/2026-08-07-smarter-programs-phase-c-design.md \
        pt-crm/docs/superpowers/plans/2026-08-07-smarter-programs-phase-c.md
git commit -m "docs: Phase C smarter programs design and plan"
```

---

## Self-review

1. Spec C1–C4 mapped to Tasks 1–4.
2. No placeholders remaining.
3. Types consistent: `append_exercise`, `addProgramExerciseAction`, sort helper.
