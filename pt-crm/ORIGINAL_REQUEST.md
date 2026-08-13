# Original User Request

## Initial Request — 2026-08-10T06:51:07Z

Conduct a pre-pilot code review of **FloorScribe** (`pt-crm/`), a Next.js 16 App Router + TypeScript + Tailwind + PGlite/Drizzle "floor OS" for personal trainers. The primary goal is a **pre-pilot sanity check**: catch and fix real bugs and correctness issues before a real trainer uses the system this week, then produce a clear report of everything found and changed.

Working directory: C:\Users\r413\Desktop\Gork\pt-crm

Integrity mode: development

---

## Context

Read these files before starting:
- `README.md` — quick start, product map, smoke commands
- `docs/STATUS.md` — living audit: what's built, gaps, recommended next steps
- `docs/happy-path.md` — day-in-the-life trainer loop
- `AGENTS.md` — codebase rules

Key stack facts:
- **Next.js 16 App Router** + TypeScript + Tailwind
- **PGlite** (embedded Postgres in a Docker volume, no separate DB server) via Drizzle ORM
- **jose** cookie sessions, multi-tenant orgs, role-based membership
- Server actions in `src/app/actions/`; DB schema in `src/db/`

---

## Requirements

### R1. Bugs & Correctness Audit

Review the codebase for logic errors and data-integrity issues, prioritising paths a real trainer will hit in a pilot week. Areas of particular concern (but not limited to):

- **Pack burn / session complete** — does `package_id` debit fire correctly in all paths (start from floor, from calendar, from client desk)? Are edge cases handled (no active pack, already completed, double-fire)?
- **Invoice state machine** — create → paid → void transitions; is voiding safe with no side effects?
- **Appointment lifecycle** — book, no-show, cancel, complete; does status update correctly? Does pack debit fire on complete vs calendar close?
- **Auth & tenant isolation** — every server action and API route must scope queries to the authenticated org; look for missing tenant guards.
- **Session draft persistence** — `saveSessionDraft` / `mergeDraftIntoLogs` round-trip correctness; loss of `pain`, `painNotes`, set logs on restore.
- **Mesocycle apply** — does `applyMesocycleToProgramAction` use baseline prescriptions rather than compounding from current values?

### R2. Code Quality & Architecture Audit

Identify the most impactful structural issues for a pre-pilot codebase:

- **Error handling** — server actions that can throw without returning a typed error; unhandled promise rejections in UI.
- **DB query efficiency** — N+1 patterns, missing indexes for common queries (client list, session list, calendar range).
- **Component coupling** — components doing too much (fetching + mutating + heavy rendering) that could cause silent failures.
- **TypeScript safety** — `any` escape hatches on hot paths (floor logger, server actions, DB results).

### R3. Fix & Report

For every finding:
1. **Classify** severity: `critical` (data loss / pilot-blocker), `high` (wrong behaviour a trainer will notice), `medium` (rough edge), `low` (polish / future).
2. **Fix** all `critical` and `high` severity bugs directly in the codebase where the fix is localised and safe (no speculative refactors).
3. **Leave** `medium` and `low` findings in the report with reproduction steps but do not change code for them.
4. After all fixes, run the existing smoke suite and typecheck to confirm no regressions:
   ```
   npx tsc --noEmit
   npm run smoke
   npm run smoke:pilot
   npm run smoke:programming
   npm run smoke:floor
   ```

---

## Acceptance Criteria

### Bug Report
- [ ] A written report (`REVIEW.md` in the project root) listing every finding with: severity, affected file(s) + line(s), description, and reproduction steps.
- [ ] All `critical` and `high` findings have a corresponding fix applied (or an explicit note on why the fix was deferred).

### Correctness
- [ ] `npx tsc --noEmit` exits 0 after fixes.
- [ ] `npm run smoke` exits 0 after fixes.
- [ ] `npm run smoke:pilot` exits 0 after fixes.
- [ ] No new TypeScript errors introduced by fixes.

### Report Quality
- [ ] Every finding cites the exact file path and line number.
- [ ] `critical` findings include the exact code path that triggers the bug.
- [ ] The report has a summary section at the top: total findings by severity, and a list of files modified.

## Follow-up — 2026-08-10T21:01:36Z

Conduct a database & PGlite performance review and optimization of **FloorScribe** (`pt-crm/`), a Next.js 16 App Router + TypeScript + Tailwind + PGlite/Drizzle "floor OS" for personal trainers. The objective is to identify and resolve query performance bottlenecks, missing indexes, redundant database calls, and transaction overhead to ensure smooth operation on single-volume embedded PGlite storage.

Working directory: C:\Users\r413\Desktop\Gork\pt-crm

Integrity mode: development

---

## Context

Read these files before starting:
- `README.md` — quick start & architecture
- `docs/STATUS.md` — system audit & data model
- `REVIEW.md` — previous correctness audit & findings
- `src/db/schema.ts` — Drizzle ORM tables & relations

Key technology facts:
- Embedded **PGlite** (in-process WebAssembly/Postgres execution against Docker volume)
- Drizzle ORM for schema definitions and queries
- Server Actions in `src/app/actions/` execution model

---

## Requirements

### R1. Database Query Efficiency Audit & Optimization

Audit all Drizzle ORM queries and server action data fetching paths:
- **N+1 Query Patterns**: Identify loop-nested DB calls across client lists, program rendering, calendar views, and session logging actions. Refactor to batch queries (e.g. `inArray` or JOINs).
- **Indexing Coverage**: Audit `src/db/schema.ts` for missing indexes on frequently queried columns (`org_id`, `client_id`, `program_id`, `session_id`, date ranges, status filters). Add missing Drizzle `index()` definitions.
- **Redundant Query Elimination**: Identify repeated identical DB calls within single request execution cycles and apply deduplication or in-memory caching where appropriate.

### R2. Fix & Verification

For all identified database performance bottlenecks:
1. Apply safe, high-impact fixes directly to `src/db/schema.ts` (indexes) and `src/app/actions/` (query batching/optimization).
2. Ensure schema version upgrades/migrations are cleanly handled if schema definitions change.
3. Verify that all existing functionality and smoke tests pass without regressions:
   ```bash
   npx tsc --noEmit
   npm run lint
   npm run smoke:floor-a
   npm run smoke:programming
   npm run smoke:library
   ```

### R3. Performance Audit Report

Document all findings and optimizations in `PERF_REVIEW.md` in the project root:
- Summary table of optimized queries and added indexes
- Identified query latency improvements / batch reductions
- List of modified files

---

## Acceptance Criteria

### Audit & Fixes
- [ ] Added necessary Drizzle indexes for foreign key lookups and frequent filter columns (`org_id`, `client_id`, `status`, etc.).
- [ ] Eliminated N+1 queries in server actions and data fetch routines.
- [ ] `PERF_REVIEW.md` created in project root documenting all findings, index additions, and query refactors.

### Verification
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run smoke:floor-a` exits 0.
- [ ] `npm run smoke:programming` exits 0.
- [ ] `npm run smoke:library` exits 0.

## Follow-up — 2026-08-11T00:52:14Z

Fix exercise insertion ordering and add drag-and-drop reordering in the FloorScribe "create program from scratch" program builder. When a PT adds exercises to a day, they should stack in insertion order (first added = top, subsequent = below). Exercises within a day should be rearrangeable via drag and drop.

Working directory: C:\Users\r413\Desktop\Gork\pt-crm

Integrity mode: development

---

## Context

Read these files before starting:
- `src/lib/program-exercise-add.ts` — logic for adding exercises to a program day
- `src/lib/exercise-order.ts` — sort order utilities
- `src/app/actions/programs.ts` — `addExerciseToProgramAction`, `reorderProgramExercisesAction`
- `src/components/program-detail.tsx` — the program day/exercise UI component
- `src/db/schema.ts` — `program_exercises` table with `sort_order` column

---

## Requirements

### R1. Correct Insertion Order

When exercises are added to a program day in the "create from scratch" flow, each new exercise must be appended after the last existing exercise (i.e. receives the highest `sort_order`). The first exercise added sits at the top, each subsequent exercise appears below the previous. The current behaviour (any incorrect ordering — prepend, random, or overwrite) must be fixed.

### R2. Drag-and-Drop Reordering Within a Day

On the program detail / day editor view, exercises within a single day must be reorderable via drag and drop. Dropping an exercise to a new position must persist the new `sort_order` to the database (the `reorderProgramExercisesAction` server action already exists for this). The drag handle should be clearly visible. Behaviour across different days is out of scope — only within-day reordering is required.

### R3. Verification

After implementing:
1. Run `npx tsc --noEmit` — must exit 0.
2. Run `npm run lint` — must exit 0.
3. Run `npm run smoke:floor-a` — must exit 0.
4. Run `npm run smoke:programming` — must exit 0 (the `program-exercise-add` test in particular must pass and correctly assert append ordering).

---

## Acceptance Criteria

### Insertion Order
- [ ] Adding exercise A then exercise B to an empty day results in A at `sort_order` 0 (or 1) and B at a higher `sort_order`, and A renders above B in the UI.
- [ ] Adding a third exercise C results in C rendering below B.
- [ ] The existing `smoke:programming` `program-exercise-add` test passes (update the test assertions if the smoke test was checking wrong order).

### Drag and Drop
- [ ] Each exercise row in the day editor has a visible drag handle.
- [ ] Dragging exercise B above exercise A and releasing updates the rendered order immediately (optimistic update).
- [ ] The new order is persisted — a page reload shows the dragged order maintained.

### Verification
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `npm run lint` exits 0.
- [ ] `npm run smoke:floor-a` exits 0.
- [ ] `npm run smoke:programming` exits 0.

## Follow-up — 2026-08-12T23:16:45+08:00

Role: You are an expert Principal Software Architect and Technical Product Manager.

Context:
- Feature Idea: Smarter Exercise Program Generator
- User Goal: When generating an exercise program for a client, make the existing program generator take into account client's measurements, limitations, deficiencies, mesocycle, assessments, and available equipment. It must automatically identify and prescribe corrective exercises needed to work on client deficiencies (e.g., upper cross syndrome) during the first mesocycle.

Implementation Strategy: Rule-based Expert System (deterministic engine mapping client assessments/deficiencies and equipment filters to specific corrective and primary exercises).

Working directory: C:\Users\r413\Desktop\Gork\pt-crm

Integrity mode: development

---

## Context

Read these files before starting:
- `README.md`
- `docs/STATUS.md`
- `src/db/schema.ts` — existing schema for clients, programs, exercises, equipment
- `src/app/actions/programs.ts` — server actions for programming

---

## Requirements

### R1. Architecture & Component Impact Blueprint
List all files, database tables (`src/db/schema.ts`), API actions, and UI components that need to be created or modified to ingest client measurements/assessments/equipment and feed them into the rule-based program generator engine.

### R2. Technical Logic Gates & Rule Engine Matrix
Define the core deterministic evaluation rules and logic gates. Map common movement deficiencies (e.g., upper cross syndrome, lower cross syndrome, ankle mobility restriction) to specific corrective exercise prescriptions for Mesocycle 1, and define equipment filtering logic.

### R3. Step-by-Step Implementation Milestones & Risks
Break the build process down into sequential, atomic phases (Database/Backend -> Rule Engine Core -> UI/UX -> Verification) with explicit Definitions of Done for each milestone. Identify technical debt, performance, and safety/contraindication risks.

### R4. Plan Deliverable File
Save the complete blueprint to `docs/SMART_GENERATOR_PLAN.md`.

---

## Acceptance Criteria

### Blueprint Quality & Completeness
- [ ] Output is saved as a comprehensive markdown document at `docs/SMART_GENERATOR_PLAN.md`.
- [ ] Explicitly defines data structures for client deficiencies, assessment inputs, and equipment availability.
- [ ] Details the exact algorithm for inserting corrective warm-ups / primary exercises into Mesocycle 1 while respecting equipment constraints.
- [ ] Defines clear exit criteria (DoD) for every implementation milestone.
- [ ] Identifies safety guardrails and contraindications (e.g., avoiding exercises that exacerbate a recorded client limitation).



