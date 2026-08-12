# Client Portal Implementation Plan (Production-Ready Refined)

## Executive Architecture Summary

This document defines the production implementation plan for the **FloorScribe Client Portal**, incorporating all architectural, security, legal compliance, and data-modeling requirements identified in the full code review (`docs/CLIENT_PORTAL_PLAN_REVIEW.md`).

---

## 1. Architecture & Component Impact

To maintain a strict security boundary between the Trainer CRM (write-heavy staff interface) and the Client Portal (read-heavy/interactive client interface), we implement a separate route group, dedicated server action namespaces, and an isolated authentication framework.

### 1.1 Authentication Model: Hashed OTP & Dedicated Cookie (Production Grade)
*   **Mechanism**: The client visits `floorscribe.com/portal/login`, enters their email, and receives a 6-digit OTP (One-Time Password) generated via CSPRNG (`crypto.randomInt`).
*   **OTP Security**: OTP codes are stored in `client_otps` as SHA-256 digests (`code_hash`), with a 10-minute expiry, a 5-attempt brute-force cap, rate-limiting (3 requests / 15 min per email+org), and single-use invalidation (`used_at`).
*   **Session Isolation**: Upon verification, the client receives a secure, HTTP-only `client_session` cookie signed using a dedicated `CLIENT_AUTH_SECRET` environment variable (never reusing trainer `JWT_SECRET`).
*   **Multi-Tenant Org Selection**: If a single email belongs to multiple client profiles across different organizations, the user is presented with an Organization Chooser screen before OTP dispatch.

### 1.2 Database Schema Changes (`src/db/schema.ts`)
*   **Table `clients`**: 
    *   Retain `email` as nullable `text("email")` for CRM draft leads.
    *   Add composite unique index `uniqueIndex("clients_org_email_uidx").on(t.organizationId, t.email)`.
    *   Add profile fields: `phone_number`, `avatar_url`, `notification_preferences` (jsonb), `onboarding_completed_at` (timestamp with timezone).
*   **New Table `client_sessions`**:
    *   `id` (PK), `organizationId` (FK cascade), `clientId` (FK cascade), `token` (unique), `userAgent`, `ipAddress`, `expiresAt`, `createdAt`.
*   **New Table `client_otps`**:
    *   `id` (PK), `organizationId` (FK cascade), `clientId` (FK cascade), `email`, `codeHash` (SHA-256 digest), `attempts` (integer default 0), `expiresAt`, `usedAt`, `createdAt`.
*   **New Table `notifications`**:
    *   `id` (PK), `organizationId` (FK cascade), `clientId` (FK cascade), `type` (`invoice_due` | `program_assigned` | `assessment_logged`), `title`, `body`, `readAt`, `createdAt`.
    *   Composite index `index("notifications_client_read_idx").on(t.clientId, t.readAt)`.
*   **New Table `client_documents` (ESIGN/UETA Compliant)**:
    *   `id` (PK), `organizationId` (FK cascade), `clientId` (FK cascade), `type` (`par_q` | `waiver` | `intake_form`), `title`, `status` (`pending` | `signed`), `documentVersion`, `documentHash`, `signatureData` (Base64/SVG), `ipAddress`, `userAgent`, `signedAt`, `createdAt`.
*   **Table `client_invoices` Updates**:
    *   Add `dueAt` (timestamp with timezone) and `paymentUrl` (text) for Stripe Payment Links / studio payment instructions.

### 1.3 New Route Group & UI Components (`src/app/(portal)`)
*   **Mobile-First Mandate**: Bottom tab navigation bar (`Dashboard`, `Program`, `Progress`, `Profile`).
*   `src/app/(portal)/layout.tsx`: Root layout with `requireClientSession()` guard and mobile navigation shell.
*   `src/app/(portal)/login/page.tsx`: Email entry & Org selector.
*   `src/app/(portal)/login/verify/page.tsx`: OTP input screen with resend timer and return path preservation (`?redirectTo=`).
*   `src/app/(portal)/onboarding/page.tsx`: Mandatory waiver & PAR-Q signature screen with HTML5 touch canvas.
*   `src/app/(portal)/dashboard/page.tsx`: Mobile dashboard (Next appointment, unpaid balance, recent notifications, pending intake documents).
*   `src/app/(portal)/program/page.tsx`: Read-only view of active mesocycle, days, exercises, sets, reps, and cues with SWR offline caching.
*   `src/app/(portal)/progress/page.tsx`: Historical assessment charts and body composition metrics.
*   `src/app/(portal)/profile/page.tsx`: Profile settings, notification preferences, signed documents list, and billing history.

### 1.4 Architectural Guardrails & Directory Separation
*   **Server Actions**: Isolated into `src/app/actions/portal/` (authenticated via `requireClientSession()`) vs `src/app/actions/crm/` (authenticated via `requireSession()`).
*   **Pure Query Layer (`src/db/queries/`)**: Shared database read functions written as pure TypeScript (NO `"use server"`) with explicit field projections (`select({ ... })`) to sanitize internal trainer notes from client view.
*   **ESLint Security Rules**: Configured via `eslint.config.mjs` using `no-restricted-imports` to prevent portal code from importing CRM server actions.

---

## 2. Technical Logic Gates & Edge Cases

*   **Gate 1: Client Status & Access**
    *   Only clients with status `active` or `paused` can request an OTP. `inactive` or `lead` status clients are blocked.
*   **Gate 2: Mandatory Onboarding Enforcement**
    *   If `client.onboardingCompletedAt` is null or any document in `client_documents` has status `pending`, the `layout.tsx` guard forces redirection to `/portal/onboarding`.
*   **Gate 3: Program Visibility**
    *   The portal strictly queries programs where `programs.status = 'active'`. Draft programs remain hidden.
*   **Gate 4: Multi-Tenant Scoping (IDOR Prevention)**
    *   Every database query in `src/app/actions/portal/` must compound-filter: `where(and(eq(table.organizationId, orgId), eq(table.clientId, clientId)))`.

---

## 3. Step-by-Step Implementation Milestones

### Milestone 1: Data Model, Security & AWS SES Foundation
*   **Goal**: Database schema, secure OTP engine, AWS SES setup, and CI smoke harness.
*   **Tasks**:
    1. Add `client_sessions`, `client_otps`, `notifications`, `client_documents` to `src/db/schema.ts`; update `clients` and `client_invoices`; execute DDL.
    2. Implement `src/lib/email.ts` utilizing `@aws-sdk/client-ses` with a local dev mock logger (`MOCK_EMAIL=true`).
    3. Build `src/lib/client-auth.ts` (`sendClientOTP`, `verifyClientOTP`, `requireClientSession`) with SHA-256 OTP hashing and `CLIENT_AUTH_SECRET` signing.
    4. Initialize `scripts/smoke-portal.ts` in CI pipeline.
*   **DoD**: `npm run smoke:portal` passes Scenario 1 (OTP send, verify, cookie issue, and rate-limit rejection).

### Milestone 2: Shared Queries & Mobile UI Shell
*   **Goal**: Shared query layer and mobile bottom-tab navigation layout.
*   **Tasks**:
    1. Create `src/db/queries/` with sanitized field projections for programs, clients, invoices, and appointments.
    2. Build `src/app/(portal)/layout.tsx` featuring bottom tab navigation and mobile responsiveness.
    3. Configure ESLint `no-restricted-imports` rule in `eslint.config.mjs`.
*   **DoD**: Client can log in, view the mobile shell, and switch tabs smoothly. ESLint enforces action directory isolation.

### Milestone 3: ESIGN-Compliant Onboarding & Waivers
*   **Goal**: Capture legally binding waivers and PAR-Q forms.
*   **Tasks**:
    1. Build `/portal/onboarding` screen with HTML5 touch canvas signature control.
    2. Implement `signDocumentAction` in `src/app/actions/portal/documents.ts` capturing signature Base64, document SHA-256 hash, user-agent, and client IP address.
    3. Update `client.onboardingCompletedAt` upon completion of all required documents.
*   **DoD**: New client is forced through onboarding, signs waiver, and audit trail (`ipAddress`, `documentHash`, `signatureData`) is securely logged in `client_documents`.

### Milestone 4: Read-Only Program & Progress Viewer
*   **Goal**: Gym-ready workout viewer and assessment history.
*   **Tasks**:
    1. Build `(portal)/program/page.tsx` displaying days, exercises, sets, reps, and cues with SWR offline caching.
    2. Build `(portal)/progress/page.tsx` rendering historical assessment progress charts.
*   **DoD**: Workout program renders clearly on mobile screens and remains readable during offline/spotty gym WiFi conditions.

### Milestone 5: Dashboard, Notifications & Billing Transparency
*   **Goal**: Home dashboard, system notifications, and invoice payment flow.
*   **Tasks**:
    1. Build `(portal)/dashboard/page.tsx` displaying next session countdown, unpaid balance, and notification drawer.
    2. Build `(portal)/profile/page.tsx` for notification preferences, invoice history, and Stripe payment links.
*   **DoD**: Client can view upcoming session details, receive in-app alerts, and click to pay unpaid invoices.

### Milestone 6: Automated Security Audit & CI Verification
*   **Goal**: Complete security test coverage and production readiness.
*   **Tasks**:
    1. Expand `scripts/smoke-portal.ts` to cover 5 scenarios: (1) OTP Auth, (2) Cross-Tenant IDOR Guard, (3) Mandatory Onboarding Redirect, (4) Active Program Visibility, (5) Action Boundary Enforcement.
    2. Run full verification: `npx tsc --noEmit`, `npm run lint`, `npx tsx scripts/smoke-portal.ts`.
*   **DoD**: All smoke tests, typechecks, and linting pass with 0 errors.

---

## 4. Operational Risks & Mitigation Matrix

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **AWS SES Sandbox Lock** | High | Request production SES limit increase early; verify `floorscribe.com` domain identities (DKIM/SPF/DMARC) in AWS Console. Use `MOCK_EMAIL=true` for local dev. |
| **ESIGN Legal Invalidity** | High | Store complete signature audit fields (`ipAddress`, `userAgent`, `documentHash`, `signatureData`, `signedAt`) on `client_documents`. |
| **Spotty Gym Cellular Signal** | Medium | Use SWR with `keepPreviousData: true` and LocalStorage caching for `(portal)/program` pages. |
| **Server Action Privilege Escalation** | Critical | Enforce strict directory separation (`actions/portal/` vs `actions/crm/`) and ESLint `no-restricted-imports` blocking cross-imports. |

