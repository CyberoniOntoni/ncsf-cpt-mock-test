# Project: FloorScribe Database & PGlite Performance Optimization

## Architecture
- **Module boundaries**:
  - `src/db/schema.ts` & `src/db/index.ts`: Database Schema definitions, indexes, and self-healing PGlite boot migrations.
  - `src/lib/auth.ts` & `src/lib/tenant.ts`: Authentication & tenant isolation utilities.
  - `src/app/actions/`: Next.js Server Actions (`library.ts`, `programs.ts`, `sessions.ts`, `crm.ts`, `coach.ts`, `home.ts`, `clients.ts`, `progress.ts`).
- **Database Engine**: Embedded PGlite (WebAssembly Postgres) running against single-volume Docker storage with Drizzle ORM.

## Feature Inventory
| # | Feature / Optimization Area | Description | Milestone | Source |
|---|-----------------------------|-------------|-----------|--------|
| 1 | Drizzle Schema Indexes | Add 30 missing indexes across 20 tables in `src/db/schema.ts`, update `src/db/index.ts` DDL, bump `SCHEMA_VERSION` to 17 | M1 | explorer_schema_1 |
| 2 | Auth Session JOIN Query | Consolidate 3 sequential SELECTs in `resolveLiveSession` (`src/lib/auth.ts`) into 1 INNER JOIN query | M2 | explorer_redundant_1 |
| 3 | Redundant Action Auth Calls | Eliminate repeated `requireSession()` calls in composite actions (`completeSessionAction`, `getHomeDashboardAction`) | M2 | explorer_redundant_1 |
| 4 | Redundant Record Fetches | Re-use in-memory fetched records in `sendCoachMessageAction`, `tryConsumePackageSessionAction`, `getHomeDashboardAction` | M2 | explorer_redundant_1 |
| 5 | Equipment Loop Batching | Refactor `setAllEquipmentAction` & `setEquipmentBulkAction` in `library.ts` from 3*N queries to single batch `INSERT ... ON CONFLICT` | M3 | explorer_n1_1 & explorer_redundant_1 |
| 6 | Program Batching & N+1 Fixes | Refactor `createProgramFromWizardAction`, `regenerateProgramAction`, `applyMesocycleToProgramAction`, `reorderExercisesAction`, `getProgramVolumeStatsAction`, `insertCorrectivesAction` in `programs.ts` to batch queries | M3 | explorer_n1_1 |
| 7 | Session Logging Batching & N+1 Fixes | Refactor `startSessionFromProgramDayAction`, `saveSessionProgressAction`, `completeSessionAction` in `sessions.ts` to batch queries | M3 | explorer_n1_1 |
| 8 | CRM Package Batching | Refactor `tryConsumePackageSessionAction` in `crm.ts` to `inArray` batch updates | M3 | explorer_n1_1 |
| 9 | Transaction Guards | Add `db.transaction()` guards to 12 multi-statement server actions in `sessions.ts`, `programs.ts`, `crm.ts`, `clients.ts` | M3 | explorer_redundant_1 |
| 10 | Typecheck & Smoke Verification | Run `npx tsc --noEmit`, `npm run lint`, `npm run smoke:floor-a`, `npm run smoke:programming`, `npm run smoke:library` | M4 | original request |
| 11 | PERF_REVIEW.md Report | Document all findings, indexes, batch reductions, and modified files in `PERF_REVIEW.md` in project root | M4 | original request |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Schema Indexes & Migrations | Add 30 missing indexes in `src/db/schema.ts`, sync `ensureSchema()` in `src/db/index.ts`, bump `SCHEMA_VERSION` to 17 | none | DONE |
| 2 | M2: Auth & Baseline Query Optimization | Refactor `resolveLiveSession` in `src/lib/auth.ts` to 1 JOIN query, eliminate duplicate `requireSession()` calls and duplicate record fetches | M1 | DONE |
| 3 | M3: Server Action Query Batching & Transactions | Refactor N+1 loops and add transaction guards in `src/app/actions/library.ts`, `programs.ts`, `sessions.ts`, `crm.ts`, `coach.ts`, `home.ts`, `clients.ts` | M2 | DONE |
| 4 | M4: Verification & Performance Report | Run typecheck, lint, and all 3 smoke test suites (`smoke:floor-a`, `smoke:programming`, `smoke:library`), produce `PERF_REVIEW.md` | M3 | IN_PROGRESS |

## Interface Contracts
### `src/db/schema.ts` ↔ `src/db/index.ts`
- Added Drizzle `index()` / `uniqueIndex()` definitions in `src/db/schema.ts` must match raw DDL `CREATE INDEX IF NOT EXISTS` in `src/db/index.ts`.
- `SCHEMA_VERSION` in `src/db/index.ts` is bumped from 16 to 17.

### `src/lib/auth.ts` ↔ `src/app/actions/`
- `resolveLiveSession(cookie)` returns `{ user, organization, membership, activeRole }` using a single `INNER JOIN` across `users`, `memberships`, `organizations`.
- Helper actions accept optional `session` parameter to avoid duplicate `requireSession()` calls.

## Code Layout
- `src/db/schema.ts`: Drizzle table schema & index definitions
- `src/db/index.ts`: PGlite DB connection & DDL initialization `ensureSchema()`
- `src/lib/auth.ts`: Authentication resolution, JWT cookie handling, session helpers
- `src/app/actions/library.ts`: Equipment catalog & library management actions
- `src/app/actions/programs.ts`: Program generation, mesocycle progression, exercise reordering
- `src/app/actions/sessions.ts`: Workout session lifecycle (start, save progress, complete)
- `src/app/actions/crm.ts`: Client packages, billing, appointments, check-ins
- `src/app/actions/coach.ts`: AI coach conversations and messaging
- `src/app/actions/home.ts`: Home dashboard data aggregations
- `src/app/actions/clients.ts`: Client profiles, assessments, measurements
