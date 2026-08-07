# Phase A Floor Daily Friction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce mid-session friction so a trainer with a sticky client and program can log the first set in under 30 seconds, stay focused on the current exercise, and leave a clear close-loop after complete.

**Architecture:** Prefer pure helpers in `src/lib/` for notes-dump detection and collapse defaults (testable without Next). Wire them into `session-logger.tsx` and `startSessionFromProgramDayAction`. No schema migration. No Phase B/C features.

**Tech Stack:** Next.js App Router, TypeScript, existing SessionLogger client component, `npx tsx scripts/smoke-floor.ts` for pure assertions, `npx tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-08-07-floor-daily-phase-a-design.md`

## Global Constraints

- No `SCHEMA_VERSION` bump; no new DB tables.
- One emerald primary per surface: live logger sticky = Complete session; close-loop = Share/Copy summary; **Prep open sets** = secondary (not sticky primary).
- Do not auto-apply progression on session start without a user tap.
- Local git commits only unless user asks to push.
- Workspace root for app: `pt-crm/` (paths below relative to `pt-crm/`).

## File map

| File | Responsibility |
|------|----------------|
| **Create** `src/lib/session-notes.ts` | `isProgramMetaDump`, `seedSessionNotes` |
| **Create** `src/lib/session-focus.ts` | `defaultExerciseCollapsed` pure rules |
| **Modify** `src/app/actions/sessions.ts` | Use seed helper in `startSessionFromProgramDayAction` |
| **Modify** `src/components/session-logger.tsx` | A1 collapse, A2 Prep, A3 book duration, A4 notes UI reuse helper, A5 flash |
| **Modify** `scripts/smoke-floor.ts` | Assert pure helpers |
| **Modify** `docs/happy-path.md` | Phase A floor bullets |

---

### Task 1: Pure notes helpers + smoke (A4 foundation)

**Files:**
- Create: `src/lib/session-notes.ts`
- Modify: `scripts/smoke-floor.ts`
- Modify: `src/app/actions/sessions.ts` (seed only)

**Interfaces:**
- Produces:
  - `isProgramMetaDump(text: string | null | undefined): boolean`
  - `seedSessionNotes(opts: { programNotes: string | null | undefined; bankCue: string | null | undefined }): string | null`

- [ ] **Step 1: Create `src/lib/session-notes.ts` with failing-first expectations documented in smoke**

```typescript
/**
 * Detect program/mesocycle/scheme dumps that should not dominate floor cues or seed.
 */
export function isProgramMetaDump(text: string | null | undefined): boolean {
  const t = (text || "").trim();
  if (!t) return false;
  if (t.length > 140) return true;
  return /mesocycle:|deload week|reverse pyramid:|tempo sets:|drop sets:/i.test(
    t
  );
}

/**
 * Prefer short program notes; else bank cue; never seed meta dumps.
 */
export function seedSessionNotes(opts: {
  programNotes: string | null | undefined;
  bankCue: string | null | undefined;
}): string | null {
  const notes = opts.programNotes?.trim() || "";
  if (notes && !isProgramMetaDump(notes)) return notes;
  const bank = opts.bankCue?.trim() || "";
  if (bank) return bank;
  return null;
}
```

- [ ] **Step 2: Extend `scripts/smoke-floor.ts` after progression tests**

```typescript
  const { isProgramMetaDump, seedSessionNotes } = await import(
    "../src/lib/session-notes"
  );
  if (!isProgramMetaDump("Elbows inside knees. · Reverse pyramid: foo · Deload week")) {
    throw new Error("expected meta dump detection");
  }
  if (isProgramMetaDump("Heel stays down; drive knee toward wall.")) {
    throw new Error("short cue should not be meta dump");
  }
  const seeded = seedSessionNotes({
    programNotes: "Elbows inside knees. · Mesocycle: W4 · Deload week",
    bankCue: "Elbows inside knees; chest tall.",
  });
  if (seeded !== "Elbows inside knees; chest tall.") {
    throw new Error(`seed should prefer bank over dump, got ${seeded}`);
  }
  const short = seedSessionNotes({
    programNotes: "Keep ribs down.",
    bankCue: "Bank",
  });
  if (short !== "Keep ribs down.") {
    throw new Error("short program notes should win");
  }
  console.log("session-notes: OK");
```

- [ ] **Step 3: Run smoke**

Run: `cd pt-crm; npx tsx scripts/smoke-floor.ts`  
Expected: `session-notes: OK` and `smoke-floor: OK`

- [ ] **Step 4: Wire seed in `startSessionFromProgramDayAction`**

In `src/app/actions/sessions.ts`, import:

```typescript
import { seedSessionNotes } from "@/lib/session-notes";
```

Replace:

```typescript
    const seededNotes =
      ex.notes?.trim() ||
      (ex.exerciseId ? bankCueById.get(ex.exerciseId) : undefined) ||
      null;
```

with:

```typescript
    const seededNotes = seedSessionNotes({
      programNotes: ex.notes,
      bankCue: ex.exerciseId ? bankCueById.get(ex.exerciseId) : null,
    });
```

- [ ] **Step 5: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
cd pt-crm/..   # repo root Gork
git add pt-crm/src/lib/session-notes.ts pt-crm/scripts/smoke-floor.ts pt-crm/src/app/actions/sessions.ts
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): filter session note seed with program meta dump helper"
```

---

### Task 2: Pure focus/collapse helpers + smoke (A1 foundation)

**Files:**
- Create: `src/lib/session-focus.ts`
- Modify: `scripts/smoke-floor.ts`

**Interfaces:**
- Produces:
  - `defaultExerciseCollapsed(opts: { readonly: boolean; logId: string; currentExId: string | null; completed: boolean; userOverride: boolean | undefined }): boolean`
  - Semantics: if `userOverride !== undefined`, return `userOverride`. If `readonly`, return `false` (show all expanded for review — or keep completed collapsed only when logging). Spec: while logging, non-current default collapsed.

Exact rules:

```typescript
/**
 * Default collapsed state for an exercise card while logging.
 * userOverride: value from collapsed[logId] when user toggled; undefined = no override.
 */
export function defaultExerciseCollapsed(opts: {
  readonly: boolean;
  logId: string;
  currentExId: string | null;
  completed: boolean;
  userOverride: boolean | undefined;
}): boolean {
  if (opts.userOverride !== undefined) return opts.userOverride;
  if (opts.readonly) return false;
  // Live logging: only current exercise open by default
  if (opts.currentExId && opts.logId === opts.currentExId) return false;
  return true;
}

/** True if any member of a group is the current exercise */
export function groupContainsCurrent(
  memberIds: string[],
  currentExId: string | null
): boolean {
  if (!currentExId) return false;
  return memberIds.includes(currentExId);
}
```

- [ ] **Step 1: Add file `src/lib/session-focus.ts` as above**

- [ ] **Step 2: Smoke assertions in `scripts/smoke-floor.ts`**

```typescript
  const {
    defaultExerciseCollapsed,
    groupContainsCurrent,
  } = await import("../src/lib/session-focus");
  if (
    !defaultExerciseCollapsed({
      readonly: false,
      logId: "a",
      currentExId: "b",
      completed: false,
      userOverride: undefined,
    })
  ) {
    throw new Error("non-current should collapse");
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "b",
      currentExId: "b",
      completed: false,
      userOverride: undefined,
    })
  ) {
    throw new Error("current should expand");
  }
  if (
    !defaultExerciseCollapsed({
      readonly: false,
      logId: "a",
      currentExId: "b",
      completed: false,
      userOverride: true,
    })
  ) {
    // user forced collapse on current? userOverride true means collapsed
  }
  if (
    defaultExerciseCollapsed({
      readonly: false,
      logId: "b",
      currentExId: "b",
      completed: false,
      userOverride: false,
    }) !== false
  ) {
    throw new Error("user expand override");
  }
  if (!groupContainsCurrent(["x", "y"], "y")) {
    throw new Error("group current");
  }
  console.log("session-focus: OK");
```

- [ ] **Step 3: Run smoke**

Run: `cd pt-crm; npx tsx scripts/smoke-floor.ts`  
Expected: `session-focus: OK`

- [ ] **Step 4: Commit**

```bash
git add pt-crm/src/lib/session-focus.ts pt-crm/scripts/smoke-floor.ts
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): pure session focus collapse helpers"
```

---

### Task 3: Wire collapse defaults + Focus current in SessionLogger (A1)

**Files:**
- Modify: `src/components/session-logger.tsx`

**Interfaces:**
- Consumes: `defaultExerciseCollapsed`, `groupContainsCurrent` from `@/lib/session-focus`
- Produces: UI behavior only

- [ ] **Step 1: Import helpers**

```typescript
import {
  defaultExerciseCollapsed,
  groupContainsCurrent,
} from "@/lib/session-focus";
```

- [ ] **Step 2: Replace `isCollapsed`**

Find:

```typescript
  function isCollapsed(log: Log) {
    if (collapsed[log.id] !== undefined) return collapsed[log.id];
    // Default: collapse completed exercises when actively logging
    if (!readonly && log.completed && log.id !== currentExId) return true;
    return false;
  }
```

Replace with:

```typescript
  function isCollapsed(log: Log) {
    return defaultExerciseCollapsed({
      readonly,
      logId: log.id,
      currentExId,
      completed: log.completed,
      userOverride: collapsed[log.id],
    });
  }
```

Note: existing `collapsed` state stores user toggles. `toggleCollapse` already sets `collapsed[id] = !collapsed[id]` — but default was “undefined = expanded for incomplete”. After change, undefined = collapsed for non-current. When user expands, store `false`; when collapses, store `true`. Verify `toggleCollapse`:

```typescript
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
```

- [ ] **Step 3: Keep currentExId effect** that forces `collapsed[currentExId] = false` and scrolls — already present; leave it so advancing current clears override for the new current.

- [ ] **Step 4: Group UI** — where `block.type === "group"` renders, if none of `block.members` is current and not readonly, collapse the group body similarly (only show group header). If `groupContainsCurrent(memberIds, currentExId)`, expand group shell.

Implementation sketch: compute `const memberIds = block.members.map(m => m.id)`; `const groupOpen = readonly || groupContainsCurrent(memberIds, currentExId) || block.members.some(m => collapsed[m.id] === false)`; if !groupOpen show compact header only.

- [ ] **Step 5: Add “Focus current” control** near header shortcut line (live only):

```tsx
{!readonly && currentExId && (
  <button
    type="button"
    className="text-[11px] font-medium text-zinc-500 hover:text-emerald-400 hover:underline"
    onClick={() => {
      setCollapsed({});
      // effect will open currentExId
      document.getElementById(`ex-${currentExId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }}
  >
    Focus current
  </button>
)}
```

Clearing `{}` resets overrides so defaults re-apply (only current open).

- [ ] **Step 6: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`  
Expected: exit 0

- [ ] **Step 7: Manual browser** (if Chrome available): Start session → only first incomplete expanded; complete its sets → next expands; Focus current works.

- [ ] **Step 8: Commit**

```bash
git add pt-crm/src/components/session-logger.tsx
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): collapse non-current exercises by default"
```

---

### Task 4: Prep open sets (A2)

**Files:**
- Modify: `src/components/session-logger.tsx`

**Interfaces:**
- Consumes: `prevLoads`, `applyProgression`, `copyLastWeights` / `applyPreviousWeights`, `getLastWeightsForExerciseAction`
- Produces: `prepOpenSets()` function + button on current exercise

- [ ] **Step 1: Implement `prepOpenSets`**

```typescript
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
    if (needsFill && client?.id) {
      try {
        const res = await getLastWeightsForExerciseAction({
          clientId: client.id,
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          excludeSessionId: session.id,
        });
        if (res.setLogs.length) {
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
      } catch {
        /* continue to progression */
      }
    }

    // 2) Apply progression for current exercise only (same as A)
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
      needsFill ? "Filled last loads where available" : "Sets already prepped",
      "info"
    );
  }
```

Important: `applyProgression` already flashes on success. Avoid double flash when both fill + apply run — either skip final flash when apply runs, or have fill silent when apply follows.

- [ ] **Step 2: UI button** on current expanded exercise only, near Fill last / Rest row (when `!readonly && log.id === currentExId`):

```tsx
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
```

Show when: any open set has null weight OR `prevLoads[log.id]?.suggestion` exists.

- [ ] **Step 3: Typecheck + manual** — new session with history: Prep fills + applies once.

- [ ] **Step 4: Commit**

```bash
git add pt-crm/src/components/session-logger.tsx
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): Prep open sets for current exercise"
```

---

### Task 5: Close-loop book duration + link audit (A3)

**Files:**
- Modify: `src/components/session-logger.tsx`
- Optionally: `src/app/actions/sessions.ts` `getSessionAction` if easy last-duration query

**Interfaces:**
- Prefer client-only: `bookDuration` initial state from `session.durationMin` when completed, else `"60"`.

- [ ] **Step 1: Verify meta links** (Program + Progress already partially present). Ensure:

```tsx
{(program?.id || session.programId) && (
  <Link href={`/programs/${program?.id || session.programId}`}>Program</Link>
)}
{client?.id && (
  <Link href={`/clients/${client.id}#progress`}>Progress</Link>
)}
```

- [ ] **Step 2: Book next duration default**

When opening book form or on mount for completed:

```typescript
// when setShowBookNext(true) or useEffect when readonly completed:
setBookDuration(
  String(
    session.durationMin && session.durationMin > 0
      ? session.durationMin
      : durationMin && Number(durationMin) > 0
        ? Number(durationMin)
        : 60
  )
);
```

Also when `complete()` succeeds and sets summary, keep duration state (already auto-fills duration).

- [ ] **Step 3: Optional** — if under 15 min extra, in `getSessionAction` after loading session with clientId, query last completed session duration for same client excluding current:

```typescript
  let suggestedBookDurationMin: number | null = row.durationMin;
  if (row.clientId) {
    const [prev] = await db
      .select({ durationMin: trainingSessions.durationMin })
      .from(trainingSessions)
      .where(
        and(
          eq(trainingSessions.organizationId, session.organizationId),
          eq(trainingSessions.clientId, row.clientId),
          eq(trainingSessions.status, "completed")
        )
      )
      .orderBy(desc(trainingSessions.performedAt))
      .limit(2);
    // use first row that is not current id with non-null duration
  }
```

YAGNI: **skip optional server field** unless book default feels wrong in browser. Use current session duration first.

- [ ] **Step 4: Typecheck + commit**

```bash
git add pt-crm/src/components/session-logger.tsx
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): close-loop book duration defaults and link audit"
```

---

### Task 6: Cue purity UI reuse helper (A4 UI) + flash polish (A5)

**Files:**
- Modify: `src/components/session-logger.tsx`
- Uses: `isProgramMetaDump` from `@/lib/session-notes`

- [ ] **Step 1: Notes disclosure** — replace inline longMeta regex with:

```typescript
import { isProgramMetaDump } from "@/lib/session-notes";
// ...
const longMeta = isProgramMetaDump(log.notes);
```

- [ ] **Step 2: Flash on set complete** — in `toggleSetDone`, when `done` and exercise still has open sets, flash short:

```typescript
if (done && willHaveOpenSets) {
  flash("Set done", "success");
}
// existing: if (!willHaveOpenSets && otherOpen) flash(`${name} complete`)
// existing: if all session done, flash complete readiness if any
```

Ensure `flash` already replaces previous non-error timer (read `flash` — it sets timeout 3200). Do not add a second simultaneous banner.

- [ ] **Step 3: Avoid long flash strings** — shorten any multi-line flashes on set complete to one line.

- [ ] **Step 4: Typecheck + smoke-floor**

Run:
```
cd pt-crm
npx tsc --noEmit
npx tsx scripts/smoke-floor.ts
```
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/components/session-logger.tsx
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "feat(floor): unify notes dump helper and set-done flash"
```

---

### Task 7: Docs + browser happy path + final commit

**Files:**
- Modify: `docs/happy-path.md`

- [ ] **Step 1: Update section 3 On the floor**

Add bullets:

```markdown
- Non-current exercises collapse to one line; **Focus current** resets attention.
- **Prep open sets** on the current exercise fills empty weights and applies the progression tip.
- After complete: **Program** / **Progress** links when available; book next uses session duration.
```

- [ ] **Step 2: Browser checklist**

1. Login demo → sticky Marcus → Start session.  
2. Only first incomplete exercise expanded.  
3. Prep open sets works once.  
4. Space completes set; flash “Set done”; rest may open.  
5. Complete session (or open prior completed) → Program + Progress + Book duration.  
6. New session notes seed without mesocycle dump as primary cue.

- [ ] **Step 3: Final verify**

```
cd pt-crm
npx tsc --noEmit
npx tsx scripts/smoke-floor.ts
```

- [ ] **Step 4: Commit docs**

```bash
git add pt-crm/docs/happy-path.md
git -c user.name="CyberoniOntoni" -c user.email="chipzet@gmail.com" commit -m "docs: happy-path Phase A floor density and prep"
```

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| A1 current-set density | Task 2–3 |
| A2 Prep open sets | Task 4 |
| A3 close-loop links + duration | Task 5 |
| A4 seed + cue purity | Task 1, 6 |
| A5 flash consistency | Task 6 |
| No schema bump | Global constraints |
| happy-path docs | Task 7 |
| smoke + tsc | Tasks 1–2, 6–7 |

## Placeholder scan

None intentional. Optional server last-duration marked YAGNI skip in Task 5.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-07-floor-daily-phase-a.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — this session implements tasks with checkpoints  

Which approach?
