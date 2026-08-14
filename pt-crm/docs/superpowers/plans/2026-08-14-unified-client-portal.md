# Unified Client Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish one FloorScribe client home so seekers and assigned clients share `/portal`, can follow an assigned program the way the trainer wrote it, see progress, and optionally log their own measurements.

**Architecture:** Keep the existing `client_session` + `seeker_profiles` identity (password or one-time code). Do not add a second client app. Deepen Program and Progress: map trainer program rows into a client-safe view (phases, groups, rest, scheme, cues) and put voluntary measurements on Progress. Home stays a studio board when they have a trainer, and a “next step” board when they do not.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Drizzle + PGlite, existing portal routes under `pt-crm/src/app/portal`, smoke scripts via `tsx` (`npm run smoke:portal`, `npm run smoke:marketplace`).

## Global Constraints

- Product name is FloorScribe. Do not mention other product names.
- One client environment: `/portal`. Do not revive a separate seeker account UI at `/find/account`.
- Login stays password **and** one-time code at `/portal/login`.
- Seekers without a trainer may use Home / Find / Progress / Profile. Program is empty until a trainer assigns an **active** plan.
- Assigned clients (`clients.status` is `active` or `paused`) see studio Home, Program, Progress, Profile, and Find.
- Programs in the portal are **read-only**. Clients do not log sets, RPE, or complete sessions here (that stays on the trainer floor).
- Self measurements are **optional**. Never require them to search or to view a program.
- Client-facing exercise text must not include trainer-internal phrases (`Mesocycle:`, `Smarter engine`, deficiency protocol dumps).
- Every portal DB read that uses a studio must filter `organizationId` **and** `clientId`.
- Tests in this repo are `tsx` assert scripts, not pytest. New mapper tests live in `pt-crm/scripts/test-portal-program.ts`.
- Work only under `pt-crm/`. Run smokes from `pt-crm` (`npm run smoke:portal`). Do not open PGlite from a second process while `npm run dev` is using `data/pglite`.

## Product advice (locked for this plan)

Include now (already have data or a one-file UI):

1. **Program as assigned** — warm-up / work / cool-down, supersets, rest, scheme, client cue.
2. **Progress** — self measurements (add + history) plus trainer measurements and movement checks, newest first.
3. **Home** — assigned: next session, balance, updates. Seeker: complete profile / find a trainer.
4. **Find** — stay in the same shell (already routed to `/portal/find`).
5. **Profile** — gym prefs, billing, signed docs, sign out.
6. **“Program assigned” update** — when a trainer saves an active program, write a `notifications` row the Home list already reads.

Do **not** build in this plan:

- Client set / RPE logging (duplicates the floor board; trainers own the official log).
- Chat, social feed, or a video library.
- Stripe checkout (invoices already expose `paymentUrl` when the trainer set one).
- A global `people` table (email remains the join key).
- A third “seeker portal” or new SCHEMA version.

Later (out of this plan, mention only): studio switcher when one email has two orgs.

---

## File map

| File | Role |
| --- | --- |
| Create `pt-crm/src/lib/portal-program.ts` | Pure mapper: trainer exercise rows → client-safe program view |
| Create `pt-crm/scripts/test-portal-program.ts` | Assert mapper phases, groups, cue sanitization |
| Modify `pt-crm/src/db/queries/portal.ts` | Select scheme / group / rest / warmup fields; return mapper output |
| Modify `pt-crm/src/components/portal/portal-program-view.tsx` | Render phases, groups, rest, scheme, cues |
| Modify `pt-crm/src/app/portal/(app)/program/page.tsx` | Pass mapped payload only |
| Create `pt-crm/src/components/portal/portal-measurement-form.tsx` | Voluntary weight / waist / height form (calls existing action) |
| Modify `pt-crm/src/app/portal/(app)/progress/page.tsx` | Form + unified timeline |
| Modify `pt-crm/src/app/actions/marketplace-seeker.ts` | Revalidate `/portal/progress` after a measurement |
| Modify `pt-crm/src/app/portal/(app)/dashboard/page.tsx` | Assigned home already exists; add “Open program” when a plan is active |
| Modify `pt-crm/src/app/actions/programs.ts` | Insert `program_assigned` notification on activate |
| Modify `pt-crm/scripts/smoke-portal.ts` | Assert mapped program + seeker measurement path |
| Modify `pt-crm/package.json` | Add `smoke:portal-program` script |

---

### Task 1: Client program mapper (pure)

**Files:**
- Create: `pt-crm/src/lib/portal-program.ts`
- Create: `pt-crm/scripts/test-portal-program.ts`
- Modify: `pt-crm/package.json` (add script)

**Interfaces:**
- Consumes: `isWarmupMeta`, `isCooldownMeta` from `@/lib/session-prep`; `formatSchemeName`, `formatRestLabel`, `formatPrescription`, `formatGroupTitle` from `@/lib/workout-labels`
- Produces:
  - `export type PortalExerciseIn`
  - `export type PortalClientProgram`
  - `export function clientExerciseCue(notes: string | null, howTo: string | null): string | null`
  - `export function exercisePhase(ex: PortalExerciseIn): "warmup" | "work" | "cooldown"`
  - `export function toClientProgramView(input: { title: string; goal: string; daysPerWeek: number; sessionMinutes: number; days: Array<{ id: string; name: string; focus: string | null; exercises: PortalExerciseIn[] }> }): PortalClientProgram`

- [ ] **Step 1: Write the failing test file**

Create `pt-crm/scripts/test-portal-program.ts`:

```ts
import assert from "node:assert/strict";
import {
  clientExerciseCue,
  exercisePhase,
  toClientProgramView,
} from "../src/lib/portal-program";

assert.equal(
  clientExerciseCue(
    "Knees stacked; exhale open. · Mesocycle: W1",
    null
  ),
  "Knees stacked; exhale open."
);
assert.equal(
  clientExerciseCue(
    "Smarter engine: 1 deficiency → Mesocycle 1 corrective_prep.",
    "Count tempo. Don’t rush the pause."
  ),
  "Count tempo. Don’t rush the pause."
);
assert.equal(clientExerciseCue("Mesocycle: W1", null), null);

assert.equal(
  exercisePhase({
    id: "a",
    exerciseName: "Wall slides",
    sets: 2,
    reps: "8",
    rpe: "5",
    restSec: 30,
    notes: null,
    sortOrder: 0,
    isWarmup: true,
    setScheme: "straight",
    setSchemeMeta: { summary: "Warm-up · session ranges" },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
  }),
  "warmup"
);
assert.equal(
  exercisePhase({
    id: "b",
    exerciseName: "Sleeper stretch",
    sets: 2,
    reps: "4 breaths",
    rpe: "2",
    restSec: 20,
    notes: null,
    sortOrder: 7,
    isWarmup: false,
    setScheme: "straight",
    setSchemeMeta: { phase: "cooldown", summary: "Cool-down · breath" },
    groupId: null,
    groupKind: null,
    groupLabel: null,
    groupOrder: null,
  }),
  "cooldown"
);

const view = toClientProgramView({
  title: "Mobility · 3 days/wk",
  goal: "mobility",
  daysPerWeek: 3,
  sessionMinutes: 45,
  days: [
    {
      id: "d1",
      name: "Mobility 1",
      focus: "T-spine and shoulders",
      exercises: [
        {
          id: "e1",
          exerciseName: "Wall slides",
          sets: 2,
          reps: "8",
          rpe: "5",
          restSec: 30,
          notes: "Mesocycle: W1",
          sortOrder: 0,
          isWarmup: true,
          setScheme: "straight",
          setSchemeMeta: { howTo: "Low back on the wall. Pain-free range." },
          groupId: null,
          groupKind: null,
          groupLabel: null,
          groupOrder: null,
        },
        {
          id: "e2",
          exerciseName: "Landmine press",
          sets: 3,
          reps: "8",
          rpe: "7",
          restSec: 90,
          notes: "Finish tall.",
          sortOrder: 1,
          isWarmup: false,
          setScheme: "straight",
          setSchemeMeta: null,
          groupId: "g1",
          groupKind: "superset",
          groupLabel: "A1/A2",
          groupOrder: 0,
        },
        {
          id: "e3",
          exerciseName: "Face pull",
          sets: 3,
          reps: "12",
          rpe: "6",
          restSec: 45,
          notes: null,
          sortOrder: 2,
          isWarmup: false,
          setScheme: "straight",
          setSchemeMeta: null,
          groupId: "g1",
          groupKind: "superset",
          groupLabel: "A1/A2",
          groupOrder: 1,
        },
      ],
    },
  ],
});

assert.equal(view.title, "Mobility · 3 days/wk");
assert.equal(view.days[0].blocks[0].phase, "warmup");
assert.equal(view.days[0].blocks[0].items[0].cue, "Low back on the wall. Pain-free range.");
assert.equal(view.days[0].blocks[1].phase, "work");
assert.equal(view.days[0].blocks[1].items.length, 2);
assert.equal(view.days[0].blocks[1].groupLabel, "Superset · A1/A2");
assert.match(view.days[0].blocks[1].items[0].prescription, /3/);
assert.match(view.days[0].blocks[1].items[0].restLabel, /Rest/);
assert.doesNotMatch(JSON.stringify(view), /Mesocycle/);

console.log("portal-program mapper ok");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd pt-crm; npx tsx scripts/test-portal-program.ts`

Expected: FAIL with `Cannot find module '../src/lib/portal-program'`

- [ ] **Step 3: Implement the mapper**

Create `pt-crm/src/lib/portal-program.ts`:

```ts
import { isCooldownMeta, isWarmupMeta } from "@/lib/session-prep";
import {
  formatGroupTitle,
  formatPrescription,
  formatRestLabel,
  formatSchemeName,
} from "@/lib/workout-labels";

export type PortalExerciseIn = {
  id: string;
  exerciseName: string;
  sets: number;
  reps: string;
  rpe: string | null;
  restSec: number | null;
  notes: string | null;
  sortOrder: number;
  isWarmup: boolean;
  setScheme: string | null;
  setSchemeMeta: {
    phase?: string;
    summary?: string;
    howTo?: string;
  } | null;
  groupId: string | null;
  groupKind: string | null;
  groupLabel: string | null;
  groupOrder: number | null;
};

export type PortalClientExercise = {
  id: string;
  name: string;
  prescription: string;
  restLabel: string;
  schemeLabel: string | null;
  cue: string | null;
};

export type PortalClientBlock = {
  key: string;
  phase: "warmup" | "work" | "cooldown";
  groupLabel: string | null;
  items: PortalClientExercise[];
};

export type PortalClientDay = {
  id: string;
  name: string;
  focus: string | null;
  blocks: PortalClientBlock[];
};

export type PortalClientProgram = {
  title: string;
  goal: string;
  daysPerWeek: number;
  sessionMinutes: number;
  days: PortalClientDay[];
};

const INTERNAL = /mesocycle|smarter engine|corrective_prep|deficiency →/i;

export function clientExerciseCue(
  notes: string | null,
  howTo: string | null
): string | null {
  const how = (howTo || "").trim();
  if (how && !INTERNAL.test(how)) return how;
  const raw = (notes || "")
    .split("·")
    .map((p) => p.trim())
    .filter((p) => p && !INTERNAL.test(p));
  if (!raw.length) return how || null;
  return raw.join(" · ");
}

export function exercisePhase(
  ex: PortalExerciseIn
): "warmup" | "work" | "cooldown" {
  if (isCooldownMeta(ex.setSchemeMeta)) return "cooldown";
  if (isWarmupMeta(ex.setSchemeMeta, ex.isWarmup)) return "warmup";
  return "work";
}

function toItem(ex: PortalExerciseIn): PortalClientExercise {
  const scheme = ex.setScheme && ex.setScheme !== "straight" ? ex.setScheme : null;
  return {
    id: ex.id,
    name: ex.exerciseName,
    prescription: formatPrescription({
      sets: ex.sets,
      reps: ex.reps,
      rpe: ex.rpe,
      summary: ex.setSchemeMeta?.summary || null,
    }),
    restLabel: formatRestLabel(ex.restSec),
    schemeLabel: scheme ? formatSchemeName(scheme) : null,
    cue: clientExerciseCue(ex.notes, ex.setSchemeMeta?.howTo || null),
  };
}

export function toClientProgramView(input: {
  title: string;
  goal: string;
  daysPerWeek: number;
  sessionMinutes: number;
  days: Array<{
    id: string;
    name: string;
    focus: string | null;
    exercises: PortalExerciseIn[];
  }>;
}): PortalClientProgram {
  return {
    title: input.title,
    goal: input.goal,
    daysPerWeek: input.daysPerWeek,
    sessionMinutes: input.sessionMinutes,
    days: input.days.map((day) => {
      const sorted = day.exercises.slice().sort((a, b) => a.sortOrder - b.sortOrder);
      const blocks: PortalClientBlock[] = [];
      for (const ex of sorted) {
        const phase = exercisePhase(ex);
        const groupKey = ex.groupId || `solo-${ex.id}`;
        const last = blocks[blocks.length - 1];
        if (last && last.key === `${phase}:${groupKey}`) {
          last.items.push(toItem(ex));
          continue;
        }
        blocks.push({
          key: `${phase}:${groupKey}`,
          phase,
          groupLabel: ex.groupId
            ? formatGroupTitle(ex.groupKind, ex.groupLabel)
            : null,
          items: [toItem(ex)],
        });
      }
      return {
        id: day.id,
        name: day.name,
        focus: day.focus,
        blocks,
      };
    }),
  };
}
```

Add to `pt-crm/package.json` scripts:

```json
"smoke:portal-program": "tsx scripts/test-portal-program.ts"
```

- [ ] **Step 4: Run the mapper test**

Run: `cd pt-crm; npm run smoke:portal-program`

Expected: `portal-program mapper ok`

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/lib/portal-program.ts pt-crm/scripts/test-portal-program.ts pt-crm/package.json
git commit -m "test: add client program view mapper"
```

---

### Task 2: Query returns the client program view

**Files:**
- Modify: `pt-crm/src/db/queries/portal.ts` (`getPortalActiveProgram`)
- Modify: `pt-crm/scripts/test-portal-program.ts` (optional import of return type only — do not hit PGlite here)
- Modify: `pt-crm/scripts/smoke-portal.ts` (end of `main`, after Jane exists)

**Interfaces:**
- Consumes: `toClientProgramView`, `PortalClientProgram` from `@/lib/portal-program`
- Produces: `getPortalActiveProgram(organizationId: string, clientId: string): Promise<PortalClientProgram | null>`

- [ ] **Step 1: Extend the smoke with a program fixture assertion**

At the end of `main()` in `pt-crm/scripts/smoke-portal.ts`, after Jane is loaded, add:

```ts
  const { programs, programDays, programExercises } = await import("../src/db/schema");
  const { getPortalActiveProgram } = await import("../src/db/queries/portal");
  const { id } = await import("../src/lib/utils");
  const programId = id("prg");
  const dayId = id("pday");
  await db.insert(programs).values({
    id: programId,
    organizationId: jane.organizationId,
    clientId: jane.id,
    title: "Smoke mobility",
    goal: "mobility",
    daysPerWeek: 3,
    sessionMinutes: 45,
    status: "active",
  });
  await db.insert(programDays).values({
    id: dayId,
    programId,
    dayIndex: 0,
    name: "Day 1",
    focus: "Shoulders",
  });
  await db.insert(programExercises).values({
    id: id("pex"),
    programDayId: dayId,
    exerciseName: "Wall slides",
    sets: 2,
    reps: "8",
    rpe: "5",
    restSec: 30,
    notes: "Ribs down. · Mesocycle: W1",
    sortOrder: 0,
    isWarmup: true,
    setScheme: "straight",
  });
  const portalProgram = await getPortalActiveProgram(jane.organizationId, jane.id);
  assert(portalProgram, "assigned client has an active program in portal");
  assert(portalProgram!.days[0].blocks[0].phase === "warmup", "warmup phase mapped");
  assert(
    !JSON.stringify(portalProgram).includes("Mesocycle"),
    "portal program strips trainer-internal notes"
  );
```

- [ ] **Step 2: Run smoke and confirm it fails on the new asserts**

Run: `cd pt-crm; npm run smoke:portal`

Expected: FAIL because `getPortalActiveProgram` still returns raw `{ days: [{ exercises }] }` without `blocks`, or still includes `Mesocycle` in `notes`.

Do **not** run this while `npm run dev` is using `pt-crm/data/pglite`.

- [ ] **Step 3: Change the query to select extra columns and map**

In `pt-crm/src/db/queries/portal.ts`:

1. Import `toClientProgramView` and `PortalClientProgram` from `@/lib/portal-program`.
2. Add to the `programExercises` select: `isWarmup`, `setScheme`, `setSchemeMeta`, `groupId`, `groupKind`, `groupLabel`, `groupOrder` (keep existing fields).
3. Change the return to:

```ts
  return toClientProgramView({
    title: program.title,
    goal: program.goal,
    daysPerWeek: program.daysPerWeek,
    sessionMinutes: program.sessionMinutes,
    days: days.map((d) => ({
      id: d.id,
      name: d.name,
      focus: d.focus,
      exercises: filtered
        .filter((e) => e.programDayId === d.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((e) => ({
          id: e.id,
          exerciseName: e.exerciseName,
          sets: e.sets,
          reps: e.reps,
          rpe: e.rpe,
          restSec: e.restSec,
          notes: e.notes,
          sortOrder: e.sortOrder,
          isWarmup: e.isWarmup,
          setScheme: e.setScheme,
          setSchemeMeta: e.setSchemeMeta,
          groupId: e.groupId,
          groupKind: e.groupKind,
          groupLabel: e.groupLabel,
          groupOrder: e.groupOrder,
        })),
    })),
  });
```

4. Change the function return type to `Promise<PortalClientProgram | null>`.

- [ ] **Step 4: Re-run smoke**

Run: `cd pt-crm; npm run smoke:portal`

Expected: `Portal smoke: ALL PASS` including the new program asserts.

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/db/queries/portal.ts pt-crm/scripts/smoke-portal.ts
git commit -m "feat: map assigned programs to a client-safe portal view"
```

---

### Task 3: Render the program the way the trainer assigned it

**Files:**
- Modify: `pt-crm/src/components/portal/portal-program-view.tsx`
- Modify: `pt-crm/src/app/portal/(app)/program/page.tsx` (types only if needed)

**Interfaces:**
- Consumes: `PortalClientProgram` from `@/lib/portal-program`
- Produces: `PortalProgramView({ data: PortalClientProgram | null })`

- [ ] **Step 1: Replace `PortalProgramPayload` with `PortalClientProgram`**

Rewrite `pt-crm/src/components/portal/portal-program-view.tsx` so it:

- Imports `PortalClientProgram` from `@/lib/portal-program`.
- Caches `data` with the existing `cachePortalProgram` / `readCachedPortalProgram` helpers in `pt-crm/src/components/portal/program-cache.tsx`.
- Renders seeker empty copy when `data` is null and no cache: “Your program appears here after a trainer assigns an active plan.”
- For each day, render each `block`:
  - Phase header only when it changes (`Warm-up`, `Work`, `Cool-down`).
  - If `block.groupLabel`, a single bordered group with that label and the items inside.
  - Each item: name, `prescription`, `schemeLabel` (if any), `restLabel` (if any), `cue` (if any).
- Do not print raw `notes`. Do not number across the whole day if items sit inside a group — number inside the group.

```tsx
"use client";

import { useEffect, useState } from "react";
import {
  cachePortalProgram,
  readCachedPortalProgram,
} from "@/components/portal/program-cache";
import type { PortalClientProgram } from "@/lib/portal-program";

const PHASE_LABEL = {
  warmup: "Warm-up",
  work: "Work",
  cooldown: "Cool-down",
} as const;

export function PortalProgramView({
  data,
}: {
  data: PortalClientProgram | null;
}) {
  const [program, setProgram] = useState<PortalClientProgram | null>(data);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (data) {
      cachePortalProgram(data);
      setProgram(data);
      setStale(false);
      return;
    }
    const cached = readCachedPortalProgram<PortalClientProgram>();
    if (cached) {
      setProgram(cached);
      setStale(true);
    }
  }, [data]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{program?.title || "Program"}</h1>
        <p className="text-sm text-zinc-500">
          {program
            ? `${program.daysPerWeek} days · ${program.sessionMinutes} min · ${program.goal.replace(/_/g, " ")}`
            : "Your program appears here after a trainer assigns an active plan."}
        </p>
        {stale ? (
          <p className="mt-1 text-[11px] text-amber-200/80">
            Showing the last plan saved on this phone.
          </p>
        ) : null}
      </div>
      {program
        ? program.days.map((day) => (
            <section
              key={day.id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-3"
            >
              <h2 className="font-medium text-zinc-100">{day.name}</h2>
              {day.focus ? (
                <p className="text-xs text-zinc-500">{day.focus}</p>
              ) : null}
              <div className="mt-3 space-y-3">
                {day.blocks.map((block, i) => {
                  const prev = day.blocks[i - 1];
                  const showPhase = !prev || prev.phase !== block.phase;
                  return (
                    <div key={block.key}>
                      {showPhase ? (
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                          {PHASE_LABEL[block.phase]}
                        </p>
                      ) : null}
                      <div
                        className={
                          block.groupLabel
                            ? "rounded-xl border border-emerald-900/60 px-2.5 py-2"
                            : ""
                        }
                      >
                        {block.groupLabel ? (
                          <p className="mb-1 text-xs font-medium text-emerald-300">
                            {block.groupLabel}
                          </p>
                        ) : null}
                        <ol className="space-y-2">
                          {block.items.map((ex, n) => (
                            <li key={ex.id} className="text-sm">
                              <span className="tabular-nums text-zinc-500">
                                {n + 1}.
                              </span>{" "}
                              <span className="font-medium text-zinc-200">
                                {ex.name}
                              </span>
                              <span className="ml-2 text-xs tabular-nums text-zinc-500">
                                {ex.prescription}
                                {ex.schemeLabel ? ` · ${ex.schemeLabel}` : ""}
                                {ex.restLabel ? ` · ${ex.restLabel}` : ""}
                              </span>
                              {ex.cue ? (
                                <p className="pl-5 text-[11px] leading-snug text-zinc-500">
                                  {ex.cue}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        : null}
    </div>
  );
}
```

- [ ] **Step 2: Keep the empty-studio branch on the program page**

`pt-crm/src/app/portal/(app)/program/page.tsx` already returns a Find link when `resolvePortalStudio` is null. Leave that. When a studio exists, pass `getPortalActiveProgram(...)` straight into `PortalProgramView`.

- [ ] **Step 3: Typecheck**

Run: `cd pt-crm; npm run typecheck`

Expected: PASS (no leftover `PortalProgramPayload` or `.exercises` on portal program).

- [ ] **Step 4: Browser check (assigned + seeker)**

1. Assigned: sign in as a client who has an active program → `/portal/program` shows Warm-up then Work, no `Mesocycle:` text, rest labels visible.
2. Seeker with no trainer: `/portal/program` still says the plan appears after a trainer assigns one, with a Find link.

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/components/portal/portal-program-view.tsx pt-crm/src/app/portal/\(app\)/program/page.tsx
git commit -m "feat: show assigned programs with phases, groups, and client cues"
```

---

### Task 4: Voluntary measurements on Progress

**Files:**
- Create: `pt-crm/src/components/portal/portal-measurement-form.tsx`
- Modify: `pt-crm/src/app/portal/(app)/progress/page.tsx`
- Modify: `pt-crm/src/app/actions/marketplace-seeker.ts`
- Modify: `pt-crm/src/app/portal/(app)/profile/page.tsx` (keep the existing form **or** swap it to the shared component — do not leave two different forms)

**Interfaces:**
- Consumes: `addSeekerMeasurementAction` from `@/app/actions/marketplace-seeker`; `requireSeekerSession` already gates the action
- Produces: `PortalMeasurementForm` client component

- [ ] **Step 1: Extract the measurement form**

Create `pt-crm/src/components/portal/portal-measurement-form.tsx` by moving the “Add a measurement” `<form>` from `SeekerAccountForms` into this file. Same fields: `weightKg`, `waistCm`, `heightCm`, optional `notes`. Same action. Copy: “Optional. You control what you log.”

On success call `router.refresh()` so Progress re-reads.

- [ ] **Step 2: Use it on Progress and Profile**

`progress/page.tsx`:

- If `session.seekerId` is set, render `<PortalMeasurementForm />` under the heading, then the history.
- If there is no seeker row, show: “Sign in with a password next time to log your own measurements.” (OTP-only first visit should be rare after `ensureSeekerForPerson`.)

`profile/page.tsx`: replace the inlined measurement form in `SeekerAccountForms` **or** render `<PortalMeasurementForm />` instead of the second form in `SeekerAccountForms`. Prefer deleting the duplicate form from `seeker-account-forms.tsx` so there is one implementation.

- [ ] **Step 3: Revalidate Progress after save**

In `addSeekerMeasurementAction` add:

```ts
revalidatePath("/portal/progress");
```

Keep existing `/portal/profile` revalidate.

- [ ] **Step 4: Smoke the action path**

In `pt-crm/scripts/smoke-marketplace.ts`, after `addSeekerMeasurement` already asserts storage, no change required if that assert still passes.

Run: `cd pt-crm; npm run smoke:marketplace`

Expected: PASS including `seeker measurement stored`.

- [ ] **Step 5: Browser**

On `/portal/progress` as a seeker: submit weight `72`, see it in “Your measurements”, no trainer section required.

- [ ] **Step 6: Commit**

```bash
git add pt-crm/src/components/portal/portal-measurement-form.tsx pt-crm/src/components/seeker-account-forms.tsx pt-crm/src/app/portal/\(app\)/progress/page.tsx pt-crm/src/app/portal/\(app\)/profile/page.tsx pt-crm/src/app/actions/marketplace-seeker.ts
git commit -m "feat: let clients log optional measurements from Progress"
```

---

### Task 5: One Progress timeline

**Files:**
- Modify: `pt-crm/src/app/portal/(app)/progress/page.tsx`

**Interfaces:**
- Consumes: `listSeekerMeasurements`, `getPortalMeasurements`, `getPortalAssessments`
- Produces: a single newest-first list of `{ id, at: Date, source: "you" | "trainer", label: string }`

- [ ] **Step 1: Merge rows in the page**

After fetching, build:

```ts
type ProgressItem = {
  id: string;
  at: Date;
  source: "you" | "trainer";
  label: string;
};

function measLabel(m: {
  weightKg: number | null;
  waistCm?: number | null;
  heightCm?: number | null;
}): string {
  const parts: string[] = [];
  if (m.weightKg != null) parts.push(`${m.weightKg} kg`);
  if (m.waistCm != null) parts.push(`waist ${m.waistCm} cm`);
  if (m.heightCm != null) parts.push(`ht ${m.heightCm} cm`);
  return parts.join(" · ") || "Logged";
}

const items: ProgressItem[] = [
  ...selfMeas.map((m) => ({
    id: m.id,
    at: new Date(m.takenAt),
    source: "you" as const,
    label: measLabel(m),
  })),
  ...meas.map((m) => ({
    id: m.id,
    at: new Date(m.takenAt),
    source: "trainer" as const,
    label: measLabel(m),
  })),
  ...assessments.map((a) => ({
    id: a.id,
    at: new Date(a.takenAt),
    source: "trainer" as const,
    label: a.summary || "Movement check",
  })),
].sort((a, b) => b.at.getTime() - a.at.getTime());
```

Render one `<ul>`. Each row: date, `You` or `Trainer` (text, not a colored badge system), then `label`.

Empty copy:

- No studio and no self rows: “Nothing logged yet. Add a measurement when you want.”
- Studio but no rows: “Nothing logged yet. Your trainer’s checks will show up here.”

Keep the measurement form **above** the list.

- [ ] **Step 2: Browser**

Assigned client with a trainer measurement and a self measurement: both appear, newest first, sources labeled.

Seeker-only: only self rows (or empty).

- [ ] **Step 3: Commit**

```bash
git add pt-crm/src/app/portal/\(app\)/progress/page.tsx
git commit -m "feat: unify self and trainer progress on one timeline"
```

---

### Task 6: Home points at the assigned program

**Files:**
- Modify: `pt-crm/src/app/portal/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getPortalActiveProgram`, `resolvePortalStudio`
- Produces: assigned Home card “Your program” linking to `/portal/program` when `getPortalActiveProgram` is non-null

- [ ] **Step 1: Load the program on the dashboard when a studio exists**

In the assigned branch of `dashboard/page.tsx`, add:

```ts
const assigned = await getPortalActiveProgram(
  studio.organizationId,
  studio.clientId
);
```

Insert a card **above** Next session:

```tsx
<section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
  <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
    Your program
  </p>
  {assigned ? (
    <>
      <p className="mt-1 text-lg font-medium text-zinc-100">{assigned.title}</p>
      <p className="text-sm text-zinc-400">
        {assigned.daysPerWeek} days · {assigned.sessionMinutes} min
      </p>
      <Link
        href="/portal/program"
        className="mt-2 inline-flex min-h-11 items-center text-sm font-medium text-emerald-400"
      >
        Open program
      </Link>
    </>
  ) : (
    <p className="mt-1 text-sm text-zinc-400">
      Your trainer has not assigned an active plan yet.
    </p>
  )}
</section>
```

Leave the seeker (no studio) Home as-is.

- [ ] **Step 2: Browser**

Jane (or any assigned demo) Home shows the program title and Open program. Priya-style seeker Home still shows Search trainers / Complete profile.

- [ ] **Step 3: Commit**

```bash
git add pt-crm/src/app/portal/\(app\)/dashboard/page.tsx
git commit -m "feat: surface the assigned program on portal Home"
```

---

### Task 7: Notify the client when a program becomes active

**Files:**
- Modify: `pt-crm/src/app/actions/programs.ts` (after successful insert/activate with `input.clientId` and `input.activate`)
- Create helper in `pt-crm/src/db/queries/portal.ts`: `notifyProgramAssigned`

**Interfaces:**
- Consumes: `notifications` table (`type`, `title`, `body`, `organizationId`, `clientId`)
- Produces: `notifyProgramAssigned(opts: { organizationId: string; clientId: string; title: string }): Promise<void>`

- [ ] **Step 1: Add the helper**

In `pt-crm/src/db/queries/portal.ts`:

```ts
export async function notifyProgramAssigned(opts: {
  organizationId: string;
  clientId: string;
  title: string;
}) {
  const db = await getDb();
  await db.insert(notifications).values({
    id: id("ntf"),
    organizationId: opts.organizationId,
    clientId: opts.clientId,
    type: "program_assigned",
    title: "New program",
    body: opts.title,
  });
}
```

Import `notifications` from `@/db/schema` and `id` from `@/lib/utils` if not already imported.

- [ ] **Step 2: Call it when a program is saved active for a client**

In `pt-crm/src/app/actions/programs.ts`, after the transaction that inserts a program, if `input.activate && input.clientId`:

```ts
await notifyProgramAssigned({
  organizationId: session.organizationId,
  clientId: input.clientId,
  title: draft.title,
});
```

Find every other activate path in the same file (blank program activate, status flip to `active`) and call the same helper with the program title. Do not notify on draft save.

- [ ] **Step 3: Extend portal smoke**

After inserting the smoke program in Task 2 (or immediately after `notifyProgramAssigned` in a second insert), call the helper and `getPortalNotifications` and assert one row has `type === "program_assigned"`.

Run: `cd pt-crm; npm run smoke:portal`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add pt-crm/src/db/queries/portal.ts pt-crm/src/app/actions/programs.ts pt-crm/scripts/smoke-portal.ts
git commit -m "feat: notify assigned clients when a program goes active"
```

---

### Task 8: Verification sweep

**Files:** none new (run only)

- [ ] **Step 1: Mapper + portal + marketplace + copy**

```bash
cd pt-crm
npm run smoke:portal-program
npm run smoke:portal
npm run smoke:marketplace
npm run smoke:site-copy
npm run typecheck
```

Expected: all PASS. Stop `npm run dev` before the PGlite smokes.

- [ ] **Step 2: Browser — seeker**

1. Register at `/portal/register`.
2. Land on Profile, save an area.
3. Progress: add a measurement; it appears as `You`.
4. Program: empty + Find link.
5. Find: search works.

- [ ] **Step 3: Browser — assigned client**

1. Trainer assigns / activates a program (existing wizard).
2. Client Home shows studio name, program card, next session, balance.
3. Program tab matches trainer structure (phases, rest, no Mesocycle dump).
4. Home Updates shows “New program” after Task 7.

- [ ] **Step 4: Commit only if verification required copy or bugfix files**

```bash
git add -A
git commit -m "fix: portal verification follow-ups"
```

Skip the commit if the working tree is clean.

---

## Self-review

**Spec coverage**

| Request | Task |
| --- | --- |
| Unified portal for clients and seekers | Already shipped; Tasks 3–6 stay on `/portal` |
| See progress | Task 5 |
| Follow assigned programs the way the PT wrote them | Tasks 1–3 |
| Voluntarily add measurements | Task 4 |
| Advice on what else belongs | Product advice section; Task 6 Home program card; Task 7 notification |

**Placeholder scan:** no TBD / “implement later” steps. Tests are concrete `tsx` asserts.

**Type consistency:** `PortalClientProgram` / `toClientProgramView` / `getPortalActiveProgram` return the same shape through Tasks 1–3. `notifyProgramAssigned` uses `organizationId` + `clientId` + `title`.
