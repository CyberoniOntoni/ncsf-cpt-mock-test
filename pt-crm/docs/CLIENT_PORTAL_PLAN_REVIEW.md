# FloorScribe Client Portal Implementation Plan — Comprehensive Review & Refinement Report

> **Paper/Plan**: FloorScribe Client Portal Implementation Plan (`docs/CLIENT_PORTAL_PLAN.md`)  
> **Target Codebase**: `src/db/schema.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/actions/`  
> **Category**: Full Architectural, Security, Data-Modeling, & Product Completeness Audit  
> **Date**: August 12, 2026  

---

## Executive Summary

This report presents a comprehensive synthesis and audit of the proposed **FloorScribe Client Portal Implementation Plan** (`docs/CLIENT_PORTAL_PLAN.md`). Four specialized subagent reviews—evaluating **Technical & Schema Integrity (R1)**, **Security & Session Boundaries (R2)**, **Product & UX Completeness (R3)**, and **Architectural Refinement & Guardrails (R4)**—were conducted against the existing Trainer CRM codebase (`src/db/schema.ts`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/app/actions/`).

While the original plan correctly identifies the need for a passwordless OTP login model, a mobile-first bottom-tab navigation shell, and logical gating for client onboarding and active programs, the audit uncovered **critical architectural, security, legal compliance, and operational deficiencies** that must be addressed prior to implementation:

1. **Multi-Tenant Schema Collisions & Missing Isolation (R1, R2, R3)**:
   - Defining `clients.email` as globally unique breaks FloorScribe's multi-tenant model, preventing clients from training at multiple studios with a single email address. Uniqueness must be enforced via a composite index `(organization_id, email)`.
   - Proposed tables (`client_sessions`, `client_otps`, `notifications`, `client_documents`) omit `organization_id`, creating cross-tenant data leakage risks (IDOR) and requiring complex multi-table joins during session validation.

2. **Security & Session Boundary Vulnerabilities (R2, R4)**:
   - Reusing `AUTH_SECRET` for client cookies permits cross-protocol token substitution between Trainer CRM (`floorscribe_session`) and Client Portal (`client_session`). Dedicated JWT secrets (`CLIENT_AUTH_SECRET`) and strict role-aware guards (`requireClientSession()` vs `requireSession()`) are mandatory.
   - Next.js Server Actions are public HTTP endpoints. Without ESLint import boundaries (`no-restricted-imports`) and server action directory separation (`src/app/actions/portal/` vs `src/app/actions/crm/`), portal components could invoke trainer actions, leading to unauthorized privilege escalation.
   - Plaintext OTP storage and lack of rate-limiting make the system vulnerable to brute-force code guessing and AWS SES cost/reputation abuse. OTPs must be stored as cryptographically hashed digests (`code_hash`) with CSPRNG generation, attempt caps (max 5 attempts), and single-use invalidation (`used_at`).

3. **Legal E-Signature Non-Compliance & Invoice Gaps (R1, R3)**:
   - The proposed `client_documents` table lacks legal audit trail metadata (`ip_address`, `user_agent`, `document_version`, `document_hash`, `signature_data`), rendering digital waivers unenforceable under US ESIGN Act and UETA standards.
   - `client_invoices` lacks `due_at` and `payment_url` fields, leaving no mechanism for dynamic `overdue` status calculation or Stripe payment link execution.

4. **Product UX, Offline Resilience & Test Automation (R3, R4)**:
   - Gym environments frequently experience cellular dead zones. The portal must implement client-side caching (SWR/LocalStorage) and PWA shell fallbacks to prevent crash screens when viewing workout programs offline.
   - Mid-flow session expiration during intake forms must preserve user inputs via `sessionStorage` and support a structured return path (`?redirectTo=`).
   - Shared database access (`src/db/queries/`) must use pure TypeScript functions (without `"use server"`) with explicit field projections to prevent internal trainer notes from leaking to clients.
   - CI smoke testing (`scripts/smoke-portal.ts`) must be established in Milestone 1 rather than deferred to Milestone 6.

Below is the structured Key Issues Roadmap summarizing all critical findings and required plan revisions.

---

## Key Issues & Actionable Roadmap

| # | Issue & Category | Affected Components | Risk Level | Required Revisions & Remediation Strategy | Source Reports |
|---|---|---|---|---|---|
| **1** | **Multi-Tenant `clients.email` Collision** *(Schema & Multi-Tenancy)* | `src/db/schema.ts`<br>`clients` table | **CRITICAL** | Change global email uniqueness to composite `uniqueIndex("clients_org_email_uidx").on(t.organizationId, t.email)`. Maintain `email` as nullable for CRM draft clients. | R1, R2, R3 |
| **2** | **Missing `organization_id` & Audit Fields** *(Schema & Security)* | `client_sessions`<br>`client_otps`<br>`notifications`<br>`client_documents` | **CRITICAL** | Add `organization_id` with `{ onDelete: "cascade" }` foreign keys to all 4 tables. Add timestamps (`{ withTimezone: true }`), composite indexes, IP logging, and user-agent fields. | R1, R2, R3 |
| **3** | **Cryptographic Secret Leak & Cookie Collision** *(Security & Auth)* | `src/lib/client-auth.ts`<br>`src/lib/session.ts` | **CRITICAL** | Segregate JWT signing using `process.env.CLIENT_AUTH_SECRET`. Maintain strict cookie separation (`floorscribe_session` vs `client_session`). Enforce role claim `role: 'client'`. | R2 |
| **4** | **Server Action Privilege Escalation** *(Security & Architecture)* | `src/app/actions/`<br>`src/lib/auth.ts` | **HIGH** | Update `requireSession()` in CRM to enforce staff roles (`owner`, `admin`, `trainer`, `front_desk`). Implement `requireClientSession()` for portal. Separate server actions into `actions/crm/` and `actions/portal/`. | R2, R4 |
| **5** | **ESLint Security Guardrails Deficit** *(Security & Tooling)* | `eslint.config.mjs` | **HIGH** | Add Flat Config `no-restricted-imports` rule blocking `src/app/(portal)/` and `src/app/actions/portal/` from importing CRM server actions. | R2, R4 |
| **6** | **Insecure OTP Storage & Brute-Force Risk** *(Security & Auth)* | `client_otps`<br>`sendClientOTP()` | **HIGH** | Generate 6-digit OTPs via CSPRNG (`crypto.randomInt`). Store SHA-256 code hash in `code_hash`. Add `attempts` counter (max 5), 10-min expiry, rate limits (3 requests / 15 min), and single-use `used_at` timestamp. | R1, R2, R3 |
| **7** | **Legal E-Signature Non-Compliance (ESIGN/UETA)** *(Product & Legal)* | `client_documents`<br>`/portal/onboarding` | **HIGH** | Expand `client_documents` with `ip_address`, `user_agent`, `document_version`, `document_hash`, and `signature_data` (Base64/SVG). Implement HTML5 touch canvas controls and PDF delivery. | R1, R3 |
| **8** | **Data Access Layer RPC Leakage & Field Exposure** *(Architecture)* | `src/db/queries/` | **MEDIUM** | Ensure `src/db/queries/` functions are pure TypeScript (NO `"use server"` directive). Mandate explicit Drizzle `select({ ... })` field projections to sanitize internal trainer data. | R4 |
| **9** | **Offline Mobile Gym Connectivity Drops** *(Product & UX)* | `(portal)/program`<br>`(portal)/progress` | **MEDIUM** | Implement client-side caching (SWR / React Query / LocalStorage) and PWA shell fallbacks to render cached programs offline. | R3 |
| **10** | **Billing & Overdue Invoice Workflow Gaps** *(Product & Billing)* | `client_invoices`<br>`/portal/dashboard` | **MEDIUM** | Add `due_at` and `payment_url` to `client_invoices`. Export `getEffectiveInvoiceStatus()` helper for dynamic `overdue` calculation. Support Stripe Payment Links and manual studio payment instructions. | R3 |
| **11** | **AWS SES Integration & Dev Fallback Gaps** *(Operations & Dev UX)* | `src/lib/email.ts` | **MEDIUM** | Require `@aws-sdk/client-ses` v3. Implement local development mock logger when `NODE_ENV === 'development'` or `MOCK_EMAIL === 'true'`. Add multi-tenant email templates with studio branding. | R3, R4 |
| **12** | **CI Smoke Testing & Milestone Realignment** *(CI/CD & Roadmap)* | `scripts/smoke-portal.ts`<br>Milestones 1–6 | **MEDIUM** | Initialize `scripts/smoke-portal.ts` in Milestone 1 (Scenario 1 Auth test) and expand incrementally across 5 core scenarios. Resequence milestones so security guardrails precede UI pages. | R2, R4 |

---

## 1. Technical & Schema Integrity Review (R1)

### Detailed Evaluation of Proposed Schema Modifications
The implementation plan proposes four new tables (`client_sessions`, `client_otps`, `notifications`, `client_documents`) and modifications to the existing `clients` table. Reviewing these proposals against Drizzle ORM definitions in `src/db/schema.ts` reveals critical data-modeling gaps that require immediate alignment with established patterns.

### 1.1 `clients.email` Uniqueness vs. Multi-Tenant Organization Isolation
* **Current Schema**: In `src/db/schema.ts` (lines 86–118), `clients.email` is defined as nullable (`email: text("email")`) and indexed only via non-unique organization indexes (`clients_org_idx`, `clients_name_idx`, `clients_org_status_idx`).
* **Plan Deficit**: Section 1 mandates making `email` "unique per organization" and notes multi-tenant email collisions in Section 2 (Gate 4). However, if implemented as a single-column unique constraint (`text("email").unique()`), a client will be prohibited from registering with more than one studio on the FloorScribe platform.
* **Remediation**:
  1. Retain `email` as nullable `text("email")` on `clients` so trainers can continue creating draft lead profiles in the CRM without requiring an email address.
  2. Implement a multi-tenant composite unique index:
     ```typescript
     uniqueIndex("clients_org_email_uidx").on(t.organizationId, t.email)
     ```
  3. Require that client email must be present prior to requesting an OTP login, leaving CRM draft workflows unblocked.

### 1.2 Missing Multi-Tenant Isolation & Security Audit Columns
Every domain table in `src/db/schema.ts` (`clients`, `clientInvoices`, `clientTasks`, `conversations`, `trainingSessions`, `programs`) includes `organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" })`.

The proposed schema in `CLIENT_PORTAL_PLAN.md` omits `organization_id` from `client_sessions`, `client_otps`, `notifications`, and `client_documents`. This forces complex multi-table JOINs during session verification and increases cross-tenant data leakage risks. Furthermore, audit logging columns required for security tracking and legal compliance are missing.

### 1.3 Foreign Key Cascades & Indexing Strategies
* **Foreign Key Cascades**: In `src/db/schema.ts`, all client-linked tables uniformly declare `.references(() => clients.id, { onDelete: "cascade" })`. The plan's informal table definitions omit cascade rules, which would trigger database foreign key constraint violation errors (`23503`) upon client or tenant deletion.
* **Indexing Deficiencies**:
  - `client_sessions`: High-frequency cookie verification requires `uniqueIndex("client_sessions_token_uidx").on(t.token)` and `index("client_sessions_org_client_idx").on(t.organizationId, t.clientId)`.
  - `client_otps`: Verification lookups require `index("client_otps_email_org_idx").on(t.email, t.organizationId)`.
  - `notifications`: Unread badge queries require composite index `index("notifications_client_read_idx").on(t.clientId, t.readAt)`.
  - `client_documents`: Mandatory onboarding checks (Gate 2) require `index("client_documents_client_status_idx").on(t.clientId, t.status)`.

### 1.4 Enum Alignment Strategy
`src/db/schema.ts` avoids PostgreSQL `pgEnum` types in favor of `text("status").notNull().default(...)` combined with exported TypeScript union types (e.g., `clients.status`, `clientInvoices.status`). The portal tables must follow this convention to maintain codebase consistency and avoid raw SQL migration friction when introducing new status values.

### Proposed Drizzle ORM Schema Definitions (`src/db/schema.ts`)

```typescript
import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ============================================================================
// CLIENT PORTAL TABLES & RELATIONS
// ============================================================================

export const clientSessions = pgTable(
  "client_sessions",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("client_sessions_token_uidx").on(t.token),
    index("client_sessions_org_idx").on(t.organizationId),
    index("client_sessions_client_idx").on(t.clientId),
    index("client_sessions_org_client_idx").on(t.organizationId, t.clientId),
    index("client_sessions_expires_idx").on(t.expiresAt),
  ]
);

export const clientOtps = pgTable(
  "client_otps",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(), // Cryptographic SHA-256 digest
    attempts: integer("attempts").notNull().default(0), // Max 5 attempt lockout
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }), // Single-use invalidation
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_otps_org_idx").on(t.organizationId),
    index("client_otps_client_idx").on(t.clientId),
    index("client_otps_org_client_idx").on(t.organizationId, t.clientId),
    index("client_otps_email_org_idx").on(t.email, t.organizationId),
    index("client_otps_expires_idx").on(t.expiresAt),
  ]
);

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // invoice_due | program_assigned | assessment_logged
    title: text("title").notNull(),
    body: text("body").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("notifications_org_idx").on(t.organizationId),
    index("notifications_client_idx").on(t.clientId),
    index("notifications_client_created_idx").on(t.clientId, t.createdAt),
    index("notifications_client_read_idx").on(t.clientId, t.readAt),
  ]
);

export const clientDocuments = pgTable(
  "client_documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // par_q | waiver | intake_form
    status: text("status").notNull().default("pending"), // pending | signed | revoked
    title: text("title").notNull(),
    documentVersion: text("document_version").notNull().default("1.0"),
    documentHash: text("document_hash"), // SHA-256 text hash for ESIGN compliance
    contentSnapshot: text("content_snapshot"),
    signatureData: text("signature_data"), // Base64 PNG / SVG signature capture
    typedLegalName: text("typed_legal_name"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    signedAt: timestamp("signed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("client_documents_org_idx").on(t.organizationId),
    index("client_documents_client_idx").on(t.clientId),
    index("client_documents_client_status_idx").on(t.clientId, t.status),
  ]
);

// TypeScript export types for portal status values
export type NotificationType = "invoice_due" | "program_assigned" | "assessment_logged";
export type DocumentType = "par_q" | "waiver" | "intake_form";
export type DocumentStatus = "pending" | "signed" | "revoked";
```

---

## 2. Security & Session Boundary Audit (R2)

### Detailed Security Evaluation
The security evaluation focused on five core risk vectors: cookie collision, server action privilege escalation, multi-tenant scoping (IDOR), OTP rate-limiting/brute-force defense, and cryptographic secret segregation.

### 2.1 Cookie Collision & Dual-Session Isolation
* **Current State**: `src/lib/session.ts` defines `COOKIE = "floorscribe_session"` with `path: "/"`.
* **Risk**: If the portal cookie is configured with default attributes on `path: "/"`, browsers will attach BOTH `floorscribe_session` (trainer) and `client_session` (client) headers to all HTTP requests. If auth utilities fall back sequentially between cookies, a trainer testing the portal or a user with dual roles could experience session spoofing.
* **Remediation**:
  1. Maintain explicit cookie names: `floorscribe_session` for trainers vs `client_session` for clients.
  2. Implement isolated session reading utilities: `readSession()` in `src/lib/session.ts` MUST ONLY read `floorscribe_session`, while `readClientSession()` in `src/lib/client-auth.ts` MUST ONLY read `client_session`. Never create a fallback reader.

### 2.2 Server Action Enforcement & Role Guards
* **Current State**: `requireSession()` in `src/lib/auth.ts` verifies trainer JWT tokens and resolves live database user sessions. However, existing server actions in `src/app/actions/clients.ts` call `requireSession()` without checking if `session.role` belongs to staff (`owner`, `admin`, `trainer`, `front_desk`).
* **Risk**: Next.js Server Actions are public HTTP POST endpoints. An attacker authenticated as a client could invoke trainer server actions (`listClientsAction`, `deactivateClientAction`) directly. If client and trainer JWTs shared signing keys, `requireSession()` would accept client tokens, allowing cross-role privilege escalation and client roster dumping.
* **Remediation**:
  - Enforce explicit staff role validation in `requireSession()`:
    ```typescript
    const TRAINER_ROLES = ["owner", "admin", "trainer", "front_desk"];
    if (!session || !TRAINER_ROLES.includes(session.role)) {
      throw new Error("Forbidden: Staff access required");
    }
    ```
  - Build `requireClientSession()` inside `src/lib/client-auth.ts` enforcing `session.role === "client"`.

### 2.3 Cryptographic Isolation & Token Payload
* **JWT Secret Segregation**: Sign portal cookies using a dedicated environment variable (`CLIENT_AUTH_SECRET` or `CLIENT_JWT_SECRET`). If `AUTH_SECRET` were shared, client JWT tokens could be presented to trainer endpoints.
* **Client Token Payload Specification**:
  ```typescript
  export type ClientSessionPayload = {
    clientId: string;
    organizationId: string;
    email: string;
    name: string;
    organizationName: string;
    role: "client";
    tokenType: "client_session";
  };
  ```

### 2.4 Multi-Tenant Scoping & Parameter Tampering (IDOR)
* **Risk**: If portal server actions accept `clientId` or `organizationId` as arguments from client callers, attackers could alter payloads to view another client's health records or workouts (Insecure Direct Object Reference).
* **Remediation**: Portal server actions MUST NOT accept `clientId` or `organizationId` from client arguments. Both values MUST be extracted directly from the verified `client_session` cookie. All database queries in `src/db/queries/portal.ts` MUST apply compound filtering:
  ```typescript
  where(
    and(
      eq(table.clientId, session.clientId),
      eq(table.organizationId, session.organizationId)
    )
  )
  ```

### 2.5 Cryptographic OTP Hardening & Rate Limiting
1. **CSPRNG Generation**: Generate 6-digit OTPs using Node's CSPRNG (`crypto.randomInt(100000, 1000000)`).
2. **Digest Storage**: Hash OTPs using SHA-256 before database storage in `client_otps.code_hash`. Never store raw codes in plaintext.
3. **Attempt Counter Lockout**: Increment `client_otps.attempts` on failed verification. Instantly invalidate the OTP after 5 failed attempts.
4. **Atomic Invalidation**: Perform verification and mark `used_at = now()` within a single atomic database transaction.
5. **Rate-Limiting Caps**:
   - `sendClientOTP`: Max 3 requests per 15 minutes per email address; max 10 requests per hour per IP.
   - `verifyClientOTP`: Max 5 verification attempts per 15 minutes per IP address.

### Proposed Client Auth Guard (`src/lib/client-auth.ts`)

```typescript
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { clientSessions, clients, organizations } from "@/db/schema";

const CLIENT_COOKIE_NAME = "client_session";

function getClientSecret(): Uint8Array {
  const secret = process.env.CLIENT_AUTH_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("FATAL: CLIENT_AUTH_SECRET environment variable must be at least 24 characters.");
  }
  return new TextEncoder().encode(secret);
}

export type ClientSessionPayload = {
  clientId: string;
  organizationId: string;
  email: string;
  name: string;
  organizationName: string;
  role: "client";
  tokenType: "client_session";
};

export async function requireClientSession(): Promise<ClientSessionPayload> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CLIENT_COOKIE_NAME)?.value;

  if (!token) {
    throw new Error("UNAUTHORIZED: Client session cookie missing.");
  }

  try {
    const { payload } = await jwtVerify(token, getClientSecret());
    
    if (payload.role !== "client" || payload.tokenType !== "client_session") {
      throw new Error("FORBIDDEN: Invalid client token role claims.");
    }

    const clientPayload = payload as unknown as ClientSessionPayload;

    // Database liveness check against client_sessions table
    const db = await getDb();
    const activeSession = await db
      .select({ id: clientSessions.id })
      .from(clientSessions)
      .where(
        and(
          eq(clientSessions.token, token),
          eq(clientSessions.clientId, clientPayload.clientId),
          eq(clientSessions.organizationId, clientPayload.organizationId),
          gt(clientSessions.expiresAt, new Date())
        )
      )
      .limit(1);

    if (activeSession.length === 0) {
      throw new Error("UNAUTHORIZED: Client session expired or revoked.");
    }

    return clientPayload;
  } catch (error) {
    throw new Error("UNAUTHORIZED: Invalid or expired client session.");
  }
}
```

---

## 3. Product & UX Completeness Analysis (R3)

### Detailed Product & Operational Audit
The product review evaluated the portal across mobile workflow resilience, transactional email delivery, legal e-signature compliance, session expiration UX, invoice payment execution, and toast notification architecture.

### 3.1 AWS SES Integration & Local Development Fallback
* **Dependencies & Environment**: Require `@aws-sdk/client-ses` v3. Validate environment variables at boot: `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `SES_FROM_EMAIL`.
* **Developer UX Fallback**: When `NODE_ENV === "development"` or `MOCK_EMAIL === "true"`, dispatch emails to a console mock logger rather than triggering real AWS SES API calls.
* **Multi-Tenant Branding**: Accept `organizationName` in OTP email templates so clients recognize their studio brand. Include a 6-digit monospaced code and a 1-click magic link fallback (`/portal/login/verify?email=...&token=...`).

### 3.2 Session Expiry & Mid-Flow Mobile UX
* **Form Preservation**: When filling out onboarding forms or digital waivers, session expiry must not wipe user input. Implement auto-saving of form fields to `sessionStorage`.
* **Return Path (`?redirectTo=...`)**: Portal middleware must preserve the target URL on unauthorized redirects:
  ```typescript
  // src/middleware.ts (Portal Guard)
  if (!clientSession && req.nextUrl.pathname.startsWith('/portal') && !req.nextUrl.pathname.startsWith('/portal/login')) {
    const loginUrl = new URL('/portal/login', req.url);
    loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }
  ```
  Upon successful login, validate `redirectTo` (enforcing strict open-redirect checks: must start with `/portal/` and NOT `//`) before navigating.

### 3.3 Legal E-Signature Compliance (ESIGN / UETA)
Under the US ESIGN Act and UETA, an e-signature record must capture attribution, intent, and record integrity. The `client_documents` table must record `ip_address`, `user_agent`, `document_version`, `document_hash` (SHA-256 of waiver text), and `signature_data` (Base64 PNG / SVG rendering).

The UI signature pad must use HTML5 canvas with explicit CSS `touch-action: none` to prevent window scrolling while drawing on touch screens. Upon signature, a PDF copy with an audit footer must be emailed to the client.

### 3.4 Mobile Gym Connectivity & Offline Readiness
Gym weight rooms frequently suffer from poor cellular reception. To prevent unhandled Next.js rendering exceptions:
1. Utilize SWR or TanStack Query (with `persistQueryClient` to `localStorage`) for read-heavy routes (`/portal/program`, `/portal/progress`).
2. When offline (`navigator.onLine === false`), hydrate views from local cache and display an offline banner: `"Offline Mode — Displaying cached workout program updated [Timestamp]"`.
3. Provide a Progressive Web App (PWA) manifest and lightweight Service Worker shell.

### 3.5 Billing Workflow & Invoice Payment Execution
* **Schema Enhancements**: `client_invoices` in `src/db/schema.ts` requires `dueAt: timestamp("due_at", { withTimezone: true })` and `paymentUrl: text("payment_url")`.
* **Dynamic Overdue Status**: Export `getEffectiveInvoiceStatus()` helper:
  ```typescript
  export type EffectiveInvoiceStatus = "unpaid" | "paid" | "overdue" | "void";

  export function getEffectiveInvoiceStatus(invoice: {
    status: string;
    dueAt?: Date | null;
  }): EffectiveInvoiceStatus {
    if (invoice.status === "paid") return "paid";
    if (invoice.status === "void") return "void";
    if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return "overdue";
    return "unpaid";
  }
  ```
* **Payment Execution**: If `paymentUrl` exists, render a `"Pay Online (Stripe)"` button. If null, render a modal displaying studio payment details (PayNow / Bank Transfer) and a `"Notify Trainer of Payment"` button. Stripe webhooks (`/api/webhooks/stripe`) update invoice status to `paid` upon completion.

### 3.6 UI Error Handling & Toast Architecture
* Mount `<Toaster position="top-center" richColors />` in `src/app/(portal)/layout.tsx`.
* OTP inputs: Highlight invalid cells in red, auto-clear on error, and enforce a 60-second cooldown timer on "Resend Code".
* Skeleton Loaders: Provide mobile card skeletons (`<Skeleton className="h-24 w-full rounded-xl" />`) to prevent Cumulative Layout Shift (CLS) during data fetching.

---

## 4. Refinement Roadmap & Recommended Plan Revisions (R4)

### Architectural Refinement & Operational Guardrails
The architectural evaluation established boundaries between CRM and Portal server actions, defined pure query layer abstractions, provided ESLint configuration snippets, and designed an automated CI smoke testing plan.

### 4.1 Data Access Layer Architecture (`src/db/queries/`)
* **Function Pureness**: Query functions in `src/db/queries/` MUST be pure async TypeScript functions accepting explicit parameter objects (e.g. `{ organizationId, clientId }`). They MUST NOT contain the `"use server"` directive.
* **Explicit Field Projections**: To prevent leaking internal trainer notes (`lifestyleNotes`, `medicalHistory`, internal tags) to clients, query functions MUST use explicit Drizzle `select({ ... })` field selections.

#### Query Layer Example (`src/db/queries/programs.ts`)
```typescript
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { programs } from "@/db/schema";

export async function getActiveClientProgramQuery(params: {
  organizationId: string;
  clientId: string;
}) {
  const db = await getDb();
  
  const activeProgram = await db
    .select({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      status: programs.status,
      updatedAt: programs.updatedAt,
    })
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, params.organizationId),
        eq(programs.clientId, params.clientId),
        eq(programs.status, "active")
      )
    )
    .limit(1);

  return activeProgram[0] || null;
}
```

### 4.2 Server Action Directory Structure
Restructure `src/app/actions/` into clear domain directories:
```
src/app/actions/
├── crm/                  # Trainer CRM Actions (requireSession / Trainer JWT)
│   ├── clients.ts
│   ├── programs.ts
│   └── sessions.ts
├── portal/               # Client Portal Actions (requireClientSession / Client JWT)
│   ├── auth.ts           # OTP login, verify, logout
│   ├── program.ts        # Client read-only program views
│   ├── onboarding.ts     # E-signature waiver submission
│   └── profile.ts        # Preference updates
└── shared/               # Shared non-sensitive helpers
```

### 4.3 ESLint Security Guardrails (`eslint.config.mjs`)
Add Flat Config `no-restricted-imports` rules to prevent portal code from importing CRM server actions:

```javascript
// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" },
      ],
    },
  },
  // Security Guardrail: Prevent Client Portal components from importing Trainer CRM actions
  {
    files: ["src/app/(portal)/**/*", "src/app/actions/portal/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/actions/crm*",
                "@/app/actions/clients*",
                "@/app/actions/programs*",
                "@/app/actions/sessions*",
                "@/app/actions/coach*",
                "@/app/actions/library*",
                "@/app/actions/home*",
              ],
              message:
                "SECURITY BOUNDARY VIOLATION: Portal components and actions must not import Trainer CRM server actions. Import from '@/app/actions/portal/' or '@/db/queries/' instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

### 4.4 Automated CI Smoke Testing Plan (`scripts/smoke-portal.ts`)
Initialize `scripts/smoke-portal.ts` in Milestone 1 and execute via `npx tsx scripts/smoke-portal.ts`. The script asserts 5 key scenarios:
1. **Scenario 1: Client Auth & OTP Verification**: Verify OTP generation, code hashing, attempt counters, and client session cookie creation. Assert non-active clients are rejected (Gate 1).
2. **Scenario 2: Mandatory Onboarding & Legal E-Signature**: Verify waiver submission logs IP, user-agent, and signature data, updating `onboarding_completed_at` (Gate 2).
3. **Scenario 3: Program & Assessment Read-Only Safety**: Assert portal queries return ONLY active programs (Gate 3) and strip internal trainer fields.
4. **Scenario 4: Session Boundary & Action Isolation**: Assert presenting a client cookie to `requireSession()` throws forbidden exceptions, and invalid client cookies fail `requireClientSession()`.
5. **Scenario 5: Multi-Tenant & Cross-Client Data Isolation**: Assert Client A in Org 1 cannot query Client B in Org 2 or Client C in Org 1 (IDOR protection).

Add script entry to `package.json`:
```json
"scripts": {
  "test:smoke": "tsx scripts/smoke-pilot.ts && tsx scripts/smoke-portal.ts"
}
```

### 4.5 Revised Implementation Milestones & Definition of Done (DoD)

* **Milestone 1: Security Foundation, Schema & Directory Boundaries (Re-scoped)**
  - Tasks: Create `client_sessions` and `client_otps` Drizzle tables. Build `src/app/actions/portal/` directory and configure ESLint restricted imports in `eslint.config.mjs`. Implement AWS SES integration with local development mock. Create initial `scripts/smoke-portal.ts` (Scenario 1 & 4 tests).
  - DoD: A client can enter email, receive an OTP (or view in dev console), verify within a 10-min window, receive `client_session` signed with `CLIENT_AUTH_SECRET`. Smoke test Scenario 1 passes cleanly.

* **Milestone 2: Shared Query Layer & Mobile App Shell**
  - Tasks: Implement pure functions in `src/db/queries/` with explicit field projections. Build `(portal)/layout.tsx` bottom-tab layout shell.
  - DoD: Client logs in and navigates bottom tabs. Portal components import strictly from `actions/portal/` and `queries/`. ESLint passes without boundary errors.

* **Milestone 3: Mandatory Onboarding & Legal E-Signatures**
  - Tasks: Build `client_documents` table and `/portal/onboarding` route. Implement touch-screen HTML5 canvas signature pad and audit metadata logging (IP, user-agent, document hash).
  - DoD: New client is forced to sign waiver before dashboard access (Gate 2). Signed document stores complete audit trail and emails PDF copy. Smoke test Scenario 2 passes.

* **Milestone 4: Read-Only Program & Progress Viewer (Offline Resilient)**
  - Tasks: Build `/portal/program` and `/portal/progress` using shared queries. Add SWR local caching and offline banner.
  - DoD: Client views active program parameters (Gate 3) and assessment history. Program remains viewable when cellular network drops. Smoke test Scenario 3 passes.

* **Milestone 5: Dashboard, Notifications & Billing Workflow**
  - Tasks: Build `notifications` and `client_invoices` schema updates (`due_at`, `payment_url`). Render upcoming appointments, unpaid balances, Stripe Payment links, and notification feed.
  - DoD: Client views unpaid balance with dynamic overdue calculations, launches payment links, and manages profile settings.

* **Milestone 6: CI Integration & Hardening**
  - Tasks: Finalize full assertion suite for `scripts/smoke-portal.ts`. Run automated smoke tests in CI pipeline.
  - DoD: `npm run lint` and `npm run test:smoke` pass with 100% success in CI.

---

## Detailed Segment Reports

Below are the complete, verbatim reports submitted by each of the four analyst subagents.

---

## Segment 1 Report

# Segment 1: R1 Technical & Schema Integrity Review — FloorScribe Client Portal Plan

## Summary

This report evaluates the database schema proposals and technical integrity of the **FloorScribe Client Portal Implementation Plan** (`docs/CLIENT_PORTAL_PLAN.md`) against the established Drizzle ORM conventions, multi-tenant architecture, and schema definitions in `src/db/schema.ts`.

Key findings include:
1. **Schema Conflict on `clients.email` Uniqueness**: The plan specifies ensuring `email` is "unique per organization" and notes multi-tenant email collisions in Gate 4, but fails to distinguish between a global unique constraint vs. a composite unique constraint `(organization_id, email)`. Global uniqueness would break multi-tenancy by preventing clients from enrolling in multiple studios with the same email.
2. **Missing Multi-Tenant Isolation & Audit Columns**: Newly proposed tables (`client_sessions`, `client_otps`, `notifications`, `client_documents`) omit `organization_id`, breaking tenant data isolation conventions maintained across all existing entities in `src/db/schema.ts`. Critical security and audit fields (`ip_address`, `user_agent`, lifecycle timestamps, OTP code hash, signature data) are also absent.
3. **Foreign Key Cascade Gaps**: Plain-text table definitions omit explicit `.references(() => parent.id, { onDelete: "cascade" })` constraints, posing foreign key constraint violation risks during tenant or client deletions.
4. **Indexing Deficiencies**: Missing indexes on token lookups, `(client_id, created_at)`, `(client_id, status)`, `(email, organization_id)`, and `(organization_id, client_id)` will cause performance bottlenecks in high-frequency portal routes.
5. **Enum Pattern Alignment**: The proposal should align with the codebase's explicit preference for `text(...)` columns with TypeScript union types rather than PostgreSQL `pgEnum`.

---

## Potential Mistakes and Improvements

### 1. Schema Conflict: `clients.email` Uniqueness vs. Multi-Tenant Isolation
* **Observation**:
  - In `src/db/schema.ts` (lines 86–118), `clients.email` is currently nullable (`email: text("email")`) and indexed only via non-unique organization indexes (`clients_org_idx`, `clients_name_idx`, `clients_org_status_idx`).
  - `CLIENT_PORTAL_PLAN.md` Section 1 requires making `email` "unique per organization", and Section 2 (Gate 4) addresses multi-tenant collisions where one client email exists across multiple gyms.
* **Logic Chain & Impact**:
  - If developers implement `email` uniqueness as a single-column unique index (`uniqueIndex("clients_email_uidx").on(t.email)` or `text("email").unique()`), a client will be strictly prohibited from registering with more than one organization/studio. This invalidates the multi-tenant architecture.
  - Furthermore, in the CRM, trainers can create lead or draft client profiles without an email address. Forcing `email` to be `NOT NULL` on the `clients` table would break current client creation workflows in the CRM.
* **Recommended Code Fix**:
  - Maintain `email` as nullable `text("email")` on `clients`.
  - Add a composite unique index scoped per tenant:
    ```typescript
    uniqueIndex("clients_org_email_uidx").on(t.organizationId, t.email)
    ```
  - For portal authentication, mandate that client email must be present before requesting an OTP, while leaving CRM draft creation unblocked.

### 2. Missing Multi-Tenant `organization_id` & Audit/Security Columns
* **Observation**:
  - All existing domain entities in `src/db/schema.ts` (`clients`, `clientInvoices`, `clientTasks`, `conversations`, `trainingSessions`, `programs`) include `organizationId: text("organization_id").notNull().references(() => organizations.id, { onDelete: "cascade" })`.
  - The plan defines `notifications` (`id`, `client_id`, `type`, `title`, `body`, `read_at`, `created_at`), `client_documents` (`id`, `client_id`, `type`, `status`, `signed_at`, `created_at`), `client_sessions`, and `client_otps` without `organization_id`.
* **Logic Chain & Impact**:
  - **Multi-Tenant Isolation**: Lacking `organization_id` forces queries to perform multi-table joins back to `clients` just to verify organization ownership during server action permission checks. This increases query complexity and introduces risks of cross-tenant data leakage if a join is accidentally omitted in a portal server action.
  - **Security & Audit Deficiencies**:
    - `client_sessions`: Missing `organization_id`, `token` (hashed or unique), `ip_address`, `user_agent`, `expires_at`, `updated_at`.
    - `client_otps`: Missing `organization_id`, `code_hash` (storing raw 6-digit OTPs in plaintext is a severe security vulnerability), `attempts` count (susceptible to brute-force code guessing), `expires_at`, `used_at`, `ip_address`, `user_agent`.
    - `client_documents`: Section 4 Risk 2 mentions E-Sign compliance, yet the proposed schema lacks `ip_address`, `user_agent`, `signature_data`, `document_version`, and `content_snapshot`. Without these, electronic signature validity cannot be legally sustained.
    - `notifications`: Missing `organization_id`, `metadata` (`jsonb` for deep-linking to invoices/programs/assessments), and `updated_at`.
* **Recommended Code Fix**:
  Include `organizationId`, timestamp, and security fields across all four new tables:
  ```typescript
  // client_sessions
  export const clientSessions = pgTable(
    "client_sessions",
    {
      id: text("id").primaryKey(),
      organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
      clientId: text("client_id")
        .notNull()
        .references(() => clients.id, { onDelete: "cascade" }),
      token: text("token").notNull(),
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      uniqueIndex("client_sessions_token_uidx").on(t.token),
      index("client_sessions_org_idx").on(t.organizationId),
      index("client_sessions_client_idx").on(t.clientId),
      index("client_sessions_org_client_idx").on(t.organizationId, t.clientId),
      index("client_sessions_expires_idx").on(t.expiresAt),
    ]
  );

  // client_otps
  export const clientOtps = pgTable(
    "client_otps",
    {
      id: text("id").primaryKey(),
      organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
      clientId: text("client_id")
        .notNull()
        .references(() => clients.id, { onDelete: "cascade" }),
      email: text("email").notNull(),
      codeHash: text("code_hash").notNull(),
      attempts: integer("attempts").notNull().default(0),
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      usedAt: timestamp("used_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index("client_otps_org_idx").on(t.organizationId),
      index("client_otps_client_idx").on(t.clientId),
      index("client_otps_org_client_idx").on(t.organizationId, t.clientId),
      index("client_otps_email_org_idx").on(t.email, t.organizationId),
      index("client_otps_expires_idx").on(t.expiresAt),
    ]
  );

  // notifications
  export const notifications = pgTable(
    "notifications",
    {
      id: text("id").primaryKey(),
      organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
      clientId: text("client_id")
        .notNull()
        .references(() => clients.id, { onDelete: "cascade" }),
      type: text("type").notNull(), // invoice_due | program_assigned | assessment_logged
      title: text("title").notNull(),
      body: text("body").notNull(),
      metadata: jsonb("metadata").$type<Record<string, unknown>>(),
      readAt: timestamp("read_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index("notifications_org_idx").on(t.organizationId),
      index("notifications_client_idx").on(t.clientId),
      index("notifications_client_created_idx").on(t.clientId, t.createdAt),
      index("notifications_client_read_idx").on(t.clientId, t.readAt),
    ]
  );

  // client_documents
  export const clientDocuments = pgTable(
    "client_documents",
    {
      id: text("id").primaryKey(),
      organizationId: text("organization_id")
        .notNull()
        .references(() => organizations.id, { onDelete: "cascade" }),
      clientId: text("client_id")
        .notNull()
        .references(() => clients.id, { onDelete: "cascade" }),
      type: text("type").notNull(), // par_q | waiver | intake_form
      status: text("status").notNull().default("pending"), // pending | signed | revoked
      title: text("title").notNull(),
      documentVersion: text("document_version").notNull().default("1.0"),
      contentSnapshot: text("content_snapshot"),
      signatureData: text("signature_data"),
      ipAddress: text("ip_address"),
      userAgent: text("user_agent"),
      signedAt: timestamp("signed_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [
      index("client_documents_org_idx").on(t.organizationId),
      index("client_documents_client_idx").on(t.clientId),
      index("client_documents_client_status_idx").on(t.clientId, t.status),
    ]
  );
  ```

### 3. Missing Foreign Key Cascade Specifications
* **Observation**:
  - `src/db/schema.ts` uniformly specifies `{ onDelete: "cascade" }` for all client-linked child tables (e.g. `clientMeasurements`, `clientAssessments`, `clientNotes`, `clientInvoices`).
  - The plan lists relations in informal pseudo-schema format (`client_id`, `type`, etc.) without declaring cascade rules.
* **Logic Chain & Impact**:
  - Omitting `{ onDelete: "cascade" }` on `client_id` or `organization_id` foreign keys will cause database engine failures (foreign key constraint violation error `23503`) when a coach deletes a test client or an organization is removed.
* **Recommended Code Fix**:
  Explicitly mandate `.references(() => clients.id, { onDelete: "cascade" })` and `.references(() => organizations.id, { onDelete: "cascade" })` in all proposed Drizzle table definitions.

### 4. Indexing Deficiencies for Key Portal Query Patterns
* **Observation**:
  - The plan omits index specifications for the four new tables and the modified `clients` table.
* **Logic Chain & Impact**:
  - **Session Validation**: Every portal request will validate the HTTP-only cookie token against `client_sessions`. Without `uniqueIndex("client_sessions_token_uidx").on(t.token)`, session checks will trigger full table scans.
  - **Onboarding Guard (Gate 2)**: Layout guard checks for pending documents via `where(and(eq(clientDocuments.clientId, clientId), eq(clientDocuments.status, 'pending')))`. Lacking `(client_id, status)` index requires sequential scans on `client_documents`.
  - **Notification Feed & Badges**: Dashboard queries unread notifications using `where(and(eq(notifications.clientId, clientId), isNull(notifications.readAt)))` ordered by `created_at desc`. Lacking composite indexes `(client_id, read_at)` and `(client_id, created_at)` will degrade response times as notification volume grows.
* **Recommended Code Fix**:
  Add explicit index callbacks `(t) => [...]` for all tables as shown in Recommendation #2.

### 5. Status Enums vs. Text Column Types Alignment
* **Observation**:
  - Drizzle ORM supports `pgEnum`, but `src/db/schema.ts` consistently uses `text("status").notNull().default(...)` with string literals or TypeScript type exports across all existing tables (e.g. `clients.status`, `clientInvoices.status`, `programs.status`).
* **Logic Chain & Impact**:
  - Attempting to introduce `pgEnum` for new portal tables creates architectural inconsistency and migration operational friction (requiring raw SQL migrations for enum value additions).
* **Recommended Code Fix**:
  Standardize on `text(...)` column definitions with exported TypeScript union types:
  ```typescript
  export type NotificationType = "invoice_due" | "program_assigned" | "assessment_logged";
  export type DocumentType = "par_q" | "waiver" | "intake_form";
  export type DocumentStatus = "pending" | "signed";
  ```

---

## Minor Corrections and Typos

1. **Column Duplication on `clients` Table**:
   - **Issue**: Section 1 lists adding `phone_number` to `clients`.
   - **Correction**: `src/db/schema.ts` line 97 already defines `phone: text("phone")`. Adding `phone_number` introduces duplicate columns. Use existing `phone` column.
2. **Timestamp Type Precision**:
   - **Issue**: Plan references generic `timestamp`.
   - **Correction**: `src/db/schema.ts` uniformly configures timestamps with timezone: `timestamp("...", { withTimezone: true })`. All timestamp definitions in portal tables must include `{ withTimezone: true }`.
3. **Drizzle Table Identifier & Export Conventions**:
   - **Issue**: Plan uses snake_case table names without JS variable mappings.
   - **Correction**: Ensure table variable declarations follow camelCase export naming (`export const clientSessions = pgTable("client_sessions", ...)`).
4. **Missing Drizzle Relations Declarations**:
   - **Issue**: Plan does not mention Drizzle relational mappings (`relations(...)`).
   - **Correction**: Declare `clientSessionsRelations`, `clientOtpsRelations`, `notificationsRelations`, `clientDocumentsRelations`, and update `clientsRelations` and `organizationsRelations` in `src/db/schema.ts` to support Drizzle query builder (`db.query.clientSessions.findFirst(...)`).

---

## Segment 2 Report

# Security Analysis Report — Segment 2: R2 Security & Session Boundaries

# Summary

This security analysis evaluates **Segment 2: R2 Security & Session Boundaries** of the proposed FloorScribe Client Portal plan (`docs/CLIENT_PORTAL_PLAN.md`) in relation to the existing Trainer CRM codebase (`src/lib/auth.ts`, `src/lib/session.ts`, `src/app/actions/auth.ts`, `src/app/actions/clients.ts`, etc.).

The proposed architecture introduces a passwordless One-Time Password (OTP) login flow and an HTTP-only `client_session` cookie to isolate client interactions (health assessments, workouts, intake waivers, invoices) from the Trainer CRM. While passwordless auth via HTTP-only cookies is appropriate for client access, critical security mechanisms must be established to enforce strict boundary separation between trainers and clients.

Without explicit cryptographic secret segregation, role-aware guards in `requireSession()`, rate-limited/brute-force protected OTP validation, and strict session-derived multi-tenant scoping, the application would be vulnerable to **authorization bypasses**, **privilege escalation via server action invocation**, **cross-client data leakage (IDOR)**, and **OTP abuse/enumeration**.

Below is a detailed analysis of potential vulnerabilities, architectural design risks, and concrete mitigation recommendations across all five requested security vectors.

---

# Potential Mistakes and Improvements

## 1. Cookie Collision & Dual-Session Handling

### Observations & Code Analysis
* In `src/lib/session.ts` (lines 5, 80-91), the trainer session cookie is defined as `COOKIE = "floorscribe_session"` with attributes `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`, and `path: "/"`.
* `CLIENT_PORTAL_PLAN.md` (Section 1) proposes a separate `client_session` cookie for client authentication.

### Risks & Potential Mistakes
1. **Header Coexistence & Cookie Ambiguity**: Because both cookies would use `path: "/"`, browsers will attach BOTH `floorscribe_session` and `client_session` headers to every HTTP request sent to `floorscribe.com`. If a user is both a trainer and a client (or a trainer testing client portal features in the same browser session), server-side logic receives both tokens simultaneously.
2. **Implicit Fallback Risks**: If generic auth utilities attempt to read "whichever cookie is present" or fall back from one cookie to another without explicit role checking, requests intended for trainer endpoints could be processed under client credentials or vice versa.
3. **Cookie Path Scoping Limitations**: Relying strictly on cookie `path` scoping (e.g., setting `path: "/portal"` on `client_session`) is insufficient because Next.js Server Actions POST to the URL of the invoking page or global action endpoints. Server Actions called from client portal components can still submit cookies scoped to `/` or `/portal`.

### Recommended Improvements
* **Strict Cookie Name Separation**: Maintain distinct cookie names (`floorscribe_session` for trainers vs `client_session` for portal clients).
* **Isolated Session Readers**: Ensure `readSession()` in `src/lib/session.ts` ONLY reads `floorscribe_session` and `readClientSession()` in `src/lib/client-auth.ts` ONLY reads `client_session`. Never create a combined fallback function that checks both cookies sequentially.
* **Cookie Configuration Parity**: `client_session` must match trainer cookies with `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`, and `path: "/"`.

---

## 2. Authorization Bypasses & Server Action Privilege Escalation

### Observations & Code Analysis
* In `src/lib/auth.ts` (lines 842-858), `requireSession()` reads the `floorscribe_session` cookie, verifies the JWT, and calls `resolveLiveSession()`. `resolveLiveSession()` queries `users` joined with `memberships`.
* Existing server actions in `src/app/actions/clients.ts` (e.g. `listClientsAction`, `getClientAction`, `createDraftClientAction`, `deactivateClientAction`) call `const session = await requireSession()` directly at the top of each function.
* `requireSession()` does NOT verify that `session.role` belongs to a valid staff/trainer role (`owner`, `admin`, `trainer`, `front_desk`).

### Risks & Potential Mistakes
1. **Server Action Direct Invocation**: Next.js Server Actions are public HTTP endpoints. An attacker authenticated as a client can issue HTTP POST requests directly to any server action exported in `src/app/actions/clients.ts`, `crm.ts`, `programs.ts`, or `sessions.ts`.
2. **Cross-Role Token Presentation**: If `requireSession()` is modified to accept client tokens or if client tokens use the same JWT signing secret (`AUTH_SECRET`), a client session token passed to a trainer server action could be accepted by `requireSession()`. Because actions like `listClientsAction()` query by `eq(clients.organizationId, session.organizationId)` (lines 86-90 in `clients.ts`), a client could dump the entire client roster for their gym.
3. **Privilege Escalation**: Clients could invoke trainer actions to modify client status (`reactivateClientAction`), add notes, or create draft clients.

### Recommended Improvements
* **Role-Aware Trainer Guard**: Update `requireSession()` in `src/lib/auth.ts` to explicitly enforce staff roles:
  ```ts
  const TRAINER_ROLES = ["owner", "admin", "trainer", "front_desk"];
  if (!session || !TRAINER_ROLES.includes(session.role)) {
    throw new Error("Forbidden: Staff access required");
  }
  ```
* **Dedicated Client Guard**: Create `requireClientSession()` in `src/lib/client-auth.ts` that explicitly validates `session.role === "client"`.
* **Server Action Directory Isolation**: Place all portal-facing server actions inside `src/app/actions/portal/` and trainer server actions inside `src/app/actions/crm/` (or `src/app/actions/trainer/`).
* **ESLint Import Restrictions**: Add an ESLint `no-restricted-imports` rule preventing components inside `src/app/(portal)/` from importing server actions from `src/app/actions/clients.ts` or other trainer action files.

---

## 3. Multi-Tenant Scoping & Parameter Tampering (IDOR)

### Observations & Code Analysis
* The portal processes sensitive client data, including health histories, physical measurements, workout programs, and billing details.
* `CLIENT_PORTAL_PLAN.md` Section 2 Gate 4 highlights multi-tenant email collisions where a single client email exists across multiple gym organizations.

### Risks & Potential Mistakes
1. **Insecure Direct Object Reference (IDOR)**: If portal server actions accept `clientId` or `organizationId` as arguments from the caller (e.g. `getClientProgram(clientId: string)`), a client could alter `clientId` in the request payload to view another client's workouts or assessments within the same organization.
2. **Cross-Org Data Leakage**: If queries only filter by `clientId` without binding `organizationId`, data leakage across gyms is possible if client IDs ever overlap or are misconfigured.
3. **Ambiguous Login Tenant Context**: If `jane@example.com` is registered as a client in Gym A (`org_1`) and Gym B (`org_2`), issuing an OTP without selecting the target organization allows cross-tenant context confusion.

### Recommended Improvements
* **Session-Derived Identity**: Portal server actions MUST NOT take `clientId` or `organizationId` as untrusted input parameters. Both `clientId` and `organizationId` MUST be extracted directly from the verified `client_session` payload.
* **Compound Database Filtering**: All portal query functions in `src/db/queries/portal.ts` MUST apply compound conditions on both `organizationId` AND `clientId`:
  ```ts
  where(
    and(
      eq(table.clientId, session.clientId),
      eq(table.organizationId, session.organizationId)
    )
  )
  ```
* **Sub-Resource Authorization**: For nested objects (e.g. `client_documents`, `client_assessments`, `invoices`), queries must join back to `clients` or explicitly filter by `clientId = session.clientId`.
* **Org-Aware Login Flow**: If an email matches multiple client records during login, prompt the user to select the specific gym/organization BEFORE dispatching the OTP. Bind `organizationId` directly into the `client_otps` record.

---

## 4. OTP Generation, Expiry, Rate Limiting & Brute-Force Defenses

### Observations & Code Analysis
* `CLIENT_PORTAL_PLAN.md` Milestone 1 proposes a 6-digit OTP sent via AWS SES, verified by `sendClientOTP()` and `verifyClientOTP()`.
* The plan lacks specified cryptographic requirements, rate limits, attempt caps, or storage hashing details for OTPs.

### Risks & Potential Mistakes
1. **Insecure Randomness (PRNG)**: Using standard `Math.random()` to generate 6-digit codes produces predictable sequences that an attacker can estimate.
2. **Brute-Force Enumeration**: A 6-digit numeric OTP has only 1,000,000 possibilities (000000–999999). Without strict attempt limits and rate limiting, an automated script can guess the code within minutes.
3. **Email Spam & Cost Abuse**: Unrestricted calls to `sendClientOTP()` allow malicious actors to flood AWS SES, leading to domain reputation degradation (SPF/DKIM flagging) and financial costs.
4. **Plaintext OTP Storage & Replay**: Storing plain OTP strings in `client_otps` without atomic single-use invalidation (`used_at`) permits replay attacks and exposes codes to database read leaks.

### Recommended Improvements
* **Cryptographically Secure RNG**: Generate 6-digit numeric OTPs using Node's CSPRNG (`crypto.randomInt(100000, 1000000)`) or Web Crypto (`crypto.getRandomValues()`).
* **Database Hashing**: Store HMAC-SHA256 or bcrypt hashes of the OTP in `client_otps.otp_hash` instead of plaintext.
* **Attempt Counter & Automatic Lockout**: Include `attempts_count integer DEFAULT 0` in `client_otps`. Immediately invalidate the OTP (`status = 'invalidated'`) after 5 failed verification attempts.
* **Atomic Single-Use Invalidation**: Verify and mark the OTP as used in a single atomic database transaction:
  ```sql
  UPDATE client_otps 
  SET used_at = NOW() 
  WHERE id = $1 AND used_at IS NULL AND expires_at > NOW() AND attempts_count < 5;
  ```
* **Strict Expiry & Rate Limiting**:
  * Set OTP expiration window to **10 minutes maximum**.
  * Enforce rate limits on `sendClientOTP`: max 3 requests per 15 minutes per email, max 10 requests per hour per IP.
  * Enforce rate limits on `verifyClientOTP`: max 5 failed attempts per 15 minutes per IP.

---

## 5. Cryptographic Isolation & JWT Secret Segregation

### Observations & Code Analysis
* In `src/lib/session.ts` (lines 43-58), session JWTs are signed using `secret()`, which resolves `process.env.AUTH_SECRET`.
* The plan currently proposes using `jose` to mirror trainer auth for `client_session`.

### Risks & Potential Mistakes
1. **Secret Reuse Vulnerability**: If `client_session` JWTs are signed with the same `AUTH_SECRET` as trainer sessions, any JWT signed for a client is cryptographically valid under `jwtVerify(token, secret())`.
2. **Cross-Protocol Token Substitution**: An attacker possessing a `client_session` token could manually inject it into the `floorscribe_session` cookie. If trainer authentication logic ever fails to check `role === "client"`, the signature check will succeed, creating a grave security bypass.

### Recommended Improvements
* **Dedicated Client JWT Secret**: Introduce `process.env.CLIENT_AUTH_SECRET` (or `CLIENT_JWT_SECRET`) strictly for client portal token signing and verification.
* **Fail-Closed Secret Validation**: Apply strict validation equivalent to `isWeakAuthSecret` in `src/lib/session.ts` so that production environments fail to start if `CLIENT_AUTH_SECRET` is missing or fewer than 24 characters.
* **Structured & Scoped Token Payload**: Define a distinct `ClientSessionPayload` type containing explicit role and type discriminators:
  ```ts
  export type ClientSessionPayload = {
    clientId: string;
    organizationId: string;
    email: string;
    name: string;
    organizationName: string;
    role: "client";
    tokenType: "client_session";
  };
  ```

---

# Minor Corrections and Typos

1. **`docs/CLIENT_PORTAL_PLAN.md` Section 1 (Authentication Model)**:
   * Clarify that the HTTP-only `client_session` cookie MUST use a separate environment variable (`CLIENT_AUTH_SECRET`) rather than generic `AUTH_SECRET` to ensure cryptographic token isolation.

2. **`docs/CLIENT_PORTAL_PLAN.md` Section 1 (Database Schema Changes)**:
   * Expand `client_otps` table schema definition to explicitly list required security fields: `id`, `client_id`, `organization_id`, `otp_hash`, `attempts_count`, `expires_at`, `used_at`, `ip_address`, `created_at`.

3. **`docs/CLIENT_PORTAL_PLAN.md` Section 3 Milestone 1 (Definition of Done)**:
   * Update Definition of Done to state: *"A client can enter their email, receive a secure CSPRNG 6-digit OTP via AWS SES, verify within a 10-minute rate-limited window, and receive a valid `client_session` cookie signed with `CLIENT_AUTH_SECRET`."*

4. **`docs/CLIENT_PORTAL_PLAN.md` Section 3 Milestone 6 (Security Testing)**:
   * Add specific test assertions to `scripts/smoke-portal.ts`:
     * Assert `client_session` JWT presented to `requireSession()` in `src/lib/auth.ts` throws `Forbidden`.
     * Assert tampering with `clientId` in portal queries returns 403/Forbidden.
     * Assert 6th failed OTP attempt is rejected even if correct.

---

## Segment 3 Report

# Product & UX Completeness Analysis Report (Segment 3: R3)

**Target Document:** `docs/CLIENT_PORTAL_PLAN.md`  
**Reference Codebase Files:** `src/db/schema.ts`, `src/lib/auth.ts`, `src/lib/session.ts`  
**Reviewer:** Analyst Subagent (`analyst_r3`)  
**Scope:** R3 Product, UX, and Operational Completeness Analysis  

---

# Summary

This report evaluates **Segment 3: R3 Product & UX Completeness** of the proposed FloorScribe Client Portal plan (`docs/CLIENT_PORTAL_PLAN.md`). The review assesses whether the mobile-first client workflow is operationally viable, legally compliant, robust against real-world mobile network constraints, and user-friendly.

While `CLIENT_PORTAL_PLAN.md` sets a sound mobile-first direction featuring a bottom-tab navigation shell and separate OTP-based client session cookies, it contains significant **product, UX, legal compliance, and operational gaps**. Specifically:

1. **AWS SES Transactional Email Integration**: The plan lacks crucial SDK choices (`@aws-sdk/client-ses`), required environment variable declarations (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`), local development mock/fallback mechanisms, rate-limiting, and multi-tenant email template requirements.
2. **Session Expiry & Mid-Flow UX**: Mid-flow session expiration (e.g., while filling out onboarding waivers or viewing a workout) lacks form state preservation and a structured `?redirectTo=...` return path mechanism, risking data loss and confusing user redirects.
3. **Legal E-Signature Compliance (ESIGN / UETA)**: The proposed `client_documents` schema is missing critical legal audit trail fields—including `organization_id`, `ip_address`, `user_agent`, `document_version`, `document_hash`, and `signature_data` (Base64/SVG)—rendering digital waivers legally vulnerable under US ESIGN Act and UETA standards.
4. **Offline Readiness & Gym Connectivity**: Mobile gym environments frequently experience cellular dead zones. The plan lacks client-side caching strategies (SWR / React Query / LocalStorage) and offline app shell capabilities to allow read-only program viewing when network connectivity drops.
5. **Billing & Invoice Payment States**: The plan mentions showing "unpaid invoices" on the dashboard, but does not define payment execution (Stripe Payment Links vs. manual payment instructions), lacks dynamic `overdue` status tracking, and omits the required `due_at` and `payment_url` columns from `client_invoices`.
6. **Error Handling & Toast Feedback**: Crucial UI error feedback loops—such as invalid/expired OTP handling, rate-limiting cooldown timers, empty signature canvas validation, and global toast feedback—are absent from the specification.

Below is the detailed evidence, logic chain analysis, and concrete recommendations for each identified gap.

---

# Potential Mistakes and Improvements

## 1. AWS SES Transactional Email Integration & Operational Gaps

### Observations
- `docs/CLIENT_PORTAL_PLAN.md` (Line 58, Milestone 1) states: *"Integrate AWS SES API for transactional emails. Implement `sendClientOTP()` and `verifyClientOTP()`."*
- `docs/CLIENT_PORTAL_PLAN.md` (Line 102, Risk 1) notes: *"Email Deliverability (AWS SES): The OTP flow relies entirely on fast email delivery via AWS SES. We must ensure domain identity verification and authentication (SPF/DKIM/DMARC)... and move out of sandbox."*
- The plan specifies no NPM package dependencies, no environment variable schema, no local development fallback strategy, and no email template guidelines.

### Logic Chain & Impact
- **Missing SDK & Environment Configuration**: Without explicit SDK selection (`@aws-sdk/client-ses` v3), developers may install bloated legacy libraries or attempt direct HTTP fetch without proper AWS v4 request signing. Furthermore, runtime failure will occur if environment variables (`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `SES_FROM_EMAIL`) are not validated at application boot.
- **Developer Friction & CI/CD Blockers**: Relying solely on live AWS SES during local development or automated smoke tests creates severe friction, risks hit rates/sandboxing limits, and requires live AWS credentials for every developer.
- **Multi-Tenant Context Confusion**: The portal supports clients belonging to specific gyms/studios (`organizations`). If an OTP email arrives with generic branding (e.g., *"Your FloorScribe code is 123456"*), the client may mistake it for spam because they identify with their gym (e.g., *"Iron Gym"*), not the underlying platform brand.
- **Lack of Deliverability Protection**: Without rate-limiting OTP requests per email address, malicious users or automated bots can trigger unbounded AWS SES API calls, incurring costs and causing SES account suspension due to high bounce/complaint rates.

### Recommended Improvements
1. **Dependencies & Env Vars**: Explicitly specify `@aws-sdk/client-ses` in package requirements. Define and validate required environment variables in a startup module:
   ```typescript
   // src/lib/env.ts
   export const env = {
     AWS_REGION: process.env.AWS_REGION || "ap-southeast-1",
     AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
     AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
     SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || "auth@floorscribe.com",
   };
   ```
2. **Local Development Fallback**: Implement a development mock provider when `NODE_ENV === "development"` or `MOCK_EMAIL === "true"`:
   ```typescript
   // src/lib/email.ts
   export async function sendEmail({ to, subject, html, text }: SendEmailParams) {
     if (process.env.NODE_ENV === "development" || process.env.MOCK_EMAIL === "true") {
       console.log(`\n================ [DEV EMAIL MOCK] ================`);
       console.log(`To: ${to}\nSubject: ${subject}\n\n${text}`);
       console.log(`==================================================\n`);
       return { success: true, messageId: "mock-msg-id" };
     }
     // AWS SES SendEmailCommand implementation...
   }
   ```
3. **Multi-Tenant Email Templates**: Mandate that OTP emails accept `organizationName` and generate both plain text and HTML versions:
   - **Subject Line**: `Your {{organizationName}} portal login code: {{otpCode}}`
   - **HTML Content**: Include studio logo/name, large monospaced 6-digit OTP (`123 456`), 10-minute expiry notice, security disclaimer, and a one-click Magic Link fallback URL (`/portal/login/verify?email=...&token=...`).
4. **Rate-Limiting & Cooldown**: Enforce a maximum of 3 OTP requests per email address within a 15-minute window, backed by Redis or an in-memory/DB rate-limiting table.

---

## 2. Session Expiry & Mid-Flow Mobile UX Vulnerabilities

### Observations
- `docs/CLIENT_PORTAL_PLAN.md` (Line 10) specifies an HTTP-only `client_session` cookie for client authentication.
- `docs/CLIENT_PORTAL_PLAN.md` (Line 43, Gate 2) enforces mandatory onboarding via `/portal/onboarding` when `onboarding_completed_at` is null.
- `src/lib/session.ts` sets cookie expiration to 14 days (`maxAge: 60 * 60 * 24 * 14`). However, no mid-flow session expiry recovery mechanism is defined.

### Logic Chain & Impact
- **Form Data Loss**: A client completing a multi-step onboarding intake form or digital waiver may experience session expiry mid-flow (e.g., if their session token expires or is invalidated while typing medical details). When they submit the form, the Server Action returns an unauthorized error or redirects to `/portal/login`, wiping all entered data.
- **Disorienting Navigation**: If unauthenticated requests are redirected to `/portal/login` without retaining the original destination, the client is dropped onto `/portal/dashboard` after re-authenticating instead of returning to the form they were filling out.
- **Poor Mobile Feedback**: A sudden redirect without an explanatory message leaves mobile users confused, believing the application crashed or lost their input.

### Recommended Improvements
1. **Return Path Preservation (`?redirectTo=...`)**:
   - The portal auth middleware and login page must preserve and validate return URLs:
   ```typescript
   // src/middleware.ts (Portal Guard)
   if (!clientSession && req.nextUrl.pathname.startsWith('/portal') && !req.nextUrl.pathname.startsWith('/portal/login')) {
     const loginUrl = new URL('/portal/login', req.url);
     loginUrl.searchParams.set('redirectTo', req.nextUrl.pathname + req.nextUrl.search);
     return NextResponse.redirect(loginUrl);
   }
   ```
   - Upon successful verification, the login component validates `redirectTo` (enforcing strict open-redirect checks: must start with `/portal/` and NOT `//`) before navigating:
   ```typescript
   const target = redirectTo && redirectTo.startsWith('/portal/') && !redirectTo.startsWith('//')
     ? redirectTo
     : '/portal/dashboard';
   router.push(target);
   ```
2. **Client-Side Draft Autosave**:
   - Onboarding form inputs and signature pad states should continuously auto-save to `sessionStorage` on user input.
   - When the user lands back on `/portal/onboarding` after re-authenticating, detect saved draft state and restore filled fields with a user notification: *"Restored your saved progress."*
3. **Server Action Expiry Interception**:
   - Portal components wrapping Server Actions should detect `UNAUTHORIZED` error codes and trigger a graceful modal dialog ("Your session has expired. Enter OTP to keep working") rather than unmounting the component.

---

## 3. Legal E-Signature Compliance & Audit Trail Deficiencies

### Observations
- `docs/CLIENT_PORTAL_PLAN.md` (Line 20-21) proposes `client_documents`:
  ```sql
  client_documents: id, client_id, type (par_q, waiver, intake_form), status (pending, signed), signed_at, created_at
  ```
- `docs/CLIENT_PORTAL_PLAN.md` (Line 103, Risk 2) notes: *"Legal Validity of E-Signatures: By introducing digital waivers in Milestone 3, we take on liability for capturing a legally binding signature. We must ensure we log IP addresses and timestamps upon signature submission to comply with E-Sign standards."*
- Despite acknowledging Risk 2, the proposed schema in Section 1 **omits** `ip_address`, `user_agent`, `document_version`, `signature_data`, and `organization_id`.

### Logic Chain & Impact
- **Legal Non-Compliance (ESIGN & UETA)**: The US Electronic Signatures in Global and National Commerce Act (ESIGN) and UETA require that electronic records demonstrate intent, attribution, and document integrity. A database record containing only `signed_at` without an IP address, user-agent, document text hash, or signature rendering is legally defensible proof of nothing; a client can easily claim they never saw or signed the document.
- **Tenant Isolation Risk**: Omitting `organization_id` from `client_documents` breaks multi-tenant database partitioning guidelines maintained across all other tables in `src/db/schema.ts`.
- **Poor Mobile Signature UX**: Signing with a finger on a smartphone touch screen easily causes page scrolling or accidental clearing if touch event handlers (`touch-action: none;`) are not properly configured.

### Recommended Improvements
1. **Schema Refinement for Legal Auditability**:
   Update the proposed `client_documents` table in `src/db/schema.ts` to include full compliance metadata:
   ```typescript
   export const clientDocuments = pgTable("client_documents", {
     id: text("id").primaryKey(),
     organizationId: text("organization_id")
       .notNull()
       .references(() => organizations.id, { onDelete: "cascade" }),
     clientId: text("client_id")
       .notNull()
       .references(() => clients.id, { onDelete: "cascade" }),
     type: text("type").notNull(), // par_q | waiver | intake_form
     status: text("status").notNull().default("pending"), // pending | signed | revoked
     documentTitle: text("document_title").notNull(),
     documentVersion: text("document_version").notNull().default("1.0"),
     documentHash: text("document_hash"), // SHA-256 hash of waiver text at signing
     signatureData: text("signature_data"), // Base64 PNG data URL or SVG path of drawn signature
     typedLegalName: text("typed_legal_name"), // Full legal name confirmation
     ipAddress: text("ip_address"), // Request IP (x-forwarded-for)
     userAgent: text("user_agent"), // Browser user-agent header
     signedAt: timestamp("signed_at", { withTimezone: true }),
     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
   }, (t) => [
     index("client_docs_org_idx").on(t.organizationId),
     index("client_docs_client_idx").on(t.clientId),
     index("client_docs_client_status_idx").on(t.clientId, t.status),
   ]);
   ```
2. **Touch-Screen Signature Pad Component**:
   - Implement an HTML5 canvas signature pad component with explicit CSS `touch-action: none` to prevent window scrolling while drawing.
   - Enforce stroke density validation (`canvas.toDataURL()` check) so empty or single-tap signatures cannot be submitted.
   - Include a clear/reset button and a fallback "Type Legal Name" input field.
3. **Mandatory Copy Delivery**:
   - Per ESIGN requirements, clients must be provided a copy of their signed record. Upon signing, trigger a background task to generate a PDF copy with an audit footer (containing IP, timestamp, and signature image) and send it to `client.email` while making it downloadable under `/portal/profile`.

---

## 4. Gym Connectivity, Offline Readiness & Network Resilience

### Observations
- `docs/CLIENT_PORTAL_PLAN.md` (Line 24) mandates: *"The portal will be accessed 95% on mobile devices at the gym."*
- `docs/CLIENT_PORTAL_PLAN.md` (Line 77) defines Milestone 4: *"Read-Only Program & Progress Viewer... build `(portal)/program/page.tsx` displaying days, exercises, sets, reps..."*
- The plan assumes uninterrupted network connectivity for all page transitions and server data fetching.

### Logic Chain & Impact
- **Real-World Gym Dead Zones**: Gym weight rooms, basements, and heavy concrete/steel facilities regularly lack cellular signal or suffer from spotty Wi-Fi.
- **App Crash on Navigation**: If a client attempts to view their workout program (`/portal/program`) while offline, pure Server Component fetches will fail, throwing unhandled Next.js network exceptions and rendering an ugly application error screen.
- **Frustrated User Experience**: Clients who cannot load their workout routine during a session will abandon the portal.

### Recommended Improvements
1. **Client-Side Caching Strategy**:
   - Utilize SWR or TanStack Query (with `persistQueryClient` to `localStorage` or `IndexedDB`) for read-heavy views (`/portal/program`, `/portal/progress`, `/portal/profile`).
   - When network requests fail or `navigator.onLine` is false, hydrate views immediately from local cache and display a subtle offline banner:
     `"Offline Mode — Displaying cached workout program updated [Timestamp]"`
2. **Progressive Web App (PWA) Shell**:
   - Add a `manifest.json` and a lightweight Service Worker (using `@ducanh2912/next-pwa` or custom SW) to cache app static assets, fonts, and the tab layout shell.
   - Provide a custom static `/portal/offline.html` page as a fallback for uncached routes.
3. **Resilient Mutation Handling**:
   - Disable write actions (e.g. signing a waiver or completing a profile update) while offline with a clear visual badge: `"Requires network connection"`.

---

## 5. Billing Workflow & Invoice Payment State Gaps

### Observations
- `docs/CLIENT_PORTAL_PLAN.md` (Line 87, Milestone 5) specifies displaying "unpaid invoices" on `/portal/dashboard` and `/portal/profile`.
- `src/db/schema.ts` (Line 282-313) defines `client_invoices`:
  ```typescript
  export const clientInvoices = pgTable("client_invoices", {
    id: text("id").primaryKey(),
    organizationId: text("organization_id").notNull(),
    clientId: text("client_id").notNull(),
    title: text("title").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("SGD"),
    status: text("status").notNull().default("unpaid"), // unpaid | paid | void
    notes: text("notes"),
    packageId: text("package_id"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  });
  ```
- Missing columns: `due_at` / `due_date`, `stripe_payment_link_url` (or `payment_url`). Missing status logic: `overdue`.

### Logic Chain & Impact
- **No Way to Calculate Overdue Status**: `client_invoices` in `schema.ts` lacks a `due_at` timestamp. Without a due date, the system cannot determine when an unpaid invoice becomes overdue or sort invoices by payment urgency.
- **Incomplete Payment Execution Flow**: The plan states that clients can view unpaid invoices, but omits how invoices are actually paid! Clients cannot settle bills directly unless a payment link (e.g., Stripe Checkout / Stripe Payment Link) or manual payment instructions (PayNow / Bank Transfer) are provided.
- **Status Sync Failure**: When an invoice is paid via an external provider (Stripe), there is no specified webhook handling mechanism to transition invoice status from `unpaid` to `paid` or notify the client/trainer.

### Recommended Improvements
1. **Schema Enhancements for Invoices**:
   Update `client_invoices` in `src/db/schema.ts` to include `due_at` and `payment_url`:
   ```typescript
   // Add to clientInvoices table:
   dueAt: timestamp("due_at", { withTimezone: true }),
   paymentUrl: text("payment_url"), // External Stripe Payment Link or Checkout URL
   ```
2. **Dynamic Overdue Status Resolver**:
   Export a standard status utility function:
   ```typescript
   export type EffectiveInvoiceStatus = "unpaid" | "paid" | "overdue" | "void";

   export function getEffectiveInvoiceStatus(invoice: {
     status: string;
     dueAt?: Date | null;
   }): EffectiveInvoiceStatus {
     if (invoice.status === "paid") return "paid";
     if (invoice.status === "void") return "void";
     if (invoice.dueAt && new Date(invoice.dueAt) < new Date()) return "overdue";
     return "unpaid";
   }
   ```
3. **Dual Payment Options in UX**:
   - On `/portal/dashboard` and `/portal/profile`, display unpaid and overdue invoices with formatted currency (`SGD $150.00` via `lib/money.ts`).
   - If `paymentUrl` exists, render a prominent `"Pay Online (Stripe)"` button.
   - If `paymentUrl` is null, render a `"View Payment Details"` modal displaying studio payment instructions (e.g., PayNow QR / Bank Details) and a `"Notify Trainer of Payment"` action button.
4. **Stripe Webhook Handler**:
   Implement `src/app/api/webhooks/stripe/route.ts` to process `checkout.session.completed` events, updating `client_invoices.status = 'paid'`, recording `paidAt = now()`, and inserting an automated notification record into the `notifications` table.

---

## 6. Comprehensive UI Error Handling & Toast Feedback Architecture

### Observations
- The implementation plan outlines core screens (`login`, `onboarding`, `dashboard`, `program`, `progress`, `profile`) but omits specific UI validation, loading state standards, and error notification mechanisms.

### Logic Chain & Impact
- **Silent Failures & Poor Feedback**: When OTP verification fails, form validation fails, or network requests drop, a lack of clear toast notifications or inline field validation leaves users guessing whether their click registered.
- **Mobile Layout Shift (CLS)**: Async data fetching on mobile screens without skeleton loading placeholders creates unpleasant layout shifts and mis-clicks.

### Recommended Improvements
1. **Global Toast Container**:
   - Mount `<Toaster position="top-center" richColors />` inside `src/app/(portal)/layout.tsx`.
2. **OTP Form State & Feedback**:
   - **Invalid Code**: Display red border on 6-digit input cells, auto-clear input, focus first cell, and show `toast.error("Invalid code. Please try again.")`.
   - **Expired Code**: Disable submission button when 10-minute timer expires; show prompt *"Code expired. Click Resend to get a new code."*
   - **Cooldown Timer**: Disable "Resend Code" button with a visible 60-second countdown timer to prevent rapid re-requests.
3. **Form Validation Feedback**:
   - Highlight invalid required fields (e.g. missing Emergency Contact or unchecked Waiver consent box) in red, scrolling the viewport to the first invalid field.
   - Validate signature canvas: if empty, display `toast.error("Please draw your signature before submitting.")`.
4. **Skeleton Loading Standards**:
   - Provide dedicated mobile Skeleton loaders (`<Skeleton className="h-24 w-full rounded-xl" />`) for Dashboard appointment cards and Program exercise lists to prevent Cumulative Layout Shift (CLS) on mobile devices.

---

## Minor Corrections and Typos

1. **`client_documents` Missing Tenant Column**:
   - *Location:* `docs/CLIENT_PORTAL_PLAN.md` (Line 20-21, Section 1).
   - *Correction:* Add `organization_id` to `client_documents` table definition to ensure strict multi-tenant isolation alongside `client_id`.

2. **Currency Display Formatter**:
   - *Location:* `docs/CLIENT_PORTAL_PLAN.md` (Line 87, Section 3, Milestone 5).
   - *Correction:* Explicitly mention using the existing `lib/money.ts` helper (`formatCents(invoice.amountCents, invoice.currency)`) to render monetary amounts consistently on the mobile dashboard.

3. **Client Email Field Alignment**:
   - *Location:* `src/db/schema.ts` (Line 96, `clients` table).
   - *Correction:* `clients.email` is currently `text("email")` (nullable). The plan requires `email` to be present and unique per organization for OTP login. Add a note to migrate existing NULL email records before enforcing mandatory OTP authentication.

4. **Inconsistent Component Folder Structure**:
   - *Location:* `docs/CLIENT_PORTAL_PLAN.md` (Line 23 & 105).
   - *Correction:* Section 1 lists route components under `src/app/(portal)/`, while Risk 3 mentions actions under `src/app/actions/portal/`. Standardize folder paths across all plan sections.

---

## Segment 4 Report

# Architectural Refinement & Operational Guardrails Report (Segment 4)

## Summary

This report evaluates **Segment 4: R4 Refinement & Architecture** of the FloorScribe Client Portal plan (`docs/CLIENT_PORTAL_PLAN.md`). The primary objective of Segment 4 is to establish robust architectural boundaries, eliminate code duplication through a clean data access layer, enforce compile-time security guardrails, design automated CI smoke tests, and refine the execution roadmap for seamless delivery.

Our evaluation identified several structural gaps in the proposed plan:
1. **Data Access Layer Abstraction**: The plan introduces `src/db/queries/` but does not define strict rules regarding pure function contracts vs. server actions, parameter scoping, or protection against accidental internal trainer field leakage.
2. **Server Action Directory Boundaries**: Root-level server actions in `src/app/actions/` are currently designed for Trainer CRM authorization (`requireSession()`). The plan lacks explicit directory namespace rules for `src/app/actions/portal/` vs `src/app/actions/crm/`.
3. **ESLint Restricted Imports Enforcement**: While the plan proposes `no-restricted-imports`, it provides no concrete Flat Config implementation for `eslint.config.mjs` to block portal components from importing trainer server actions.
4. **CI & Smoke Testing Strategy**: Deferring `scripts/smoke-portal.ts` to Milestone 6 leaves early milestones vulnerable to cross-tenant leakage and boundary bleed during active development.
5. **Roadmap & DoD Deficits**: Milestone sequencing needs realignment so that boundary enforcement and database query abstractions precede feature development, and AWS SES needs a local/dev mock fallback.

The sections below outline detailed analysis, concrete code/config implementations, and actionable recommendations.

---

## Potential Mistakes and Improvements

### 1. Data Access Layer & Shared Query Abstraction (`src/db/queries/`)

#### Problem & Risk Analysis
Section 1 of `CLIENT_PORTAL_PLAN.md` calls for extracting core read operations into `src/db/queries/` to prevent logic duplication between `actions/crm.ts` and `actions/portal.ts`. However, without formal abstraction rules, this introduces two major risks:
* **Function Boundary Confusion**: Conflating DB queries with Server Actions (`"use server"`). If files in `src/db/queries/` marked `"use server"` are imported directly by client components or exposed across API boundaries, internal query functions become publicly callable RPC endpoints.
* **Internal Data Exposure**: Trainer CRM queries often fetch sensitive internal metadata—such as trainer private notes (`lifestyleNotes`, `medicalHistory`, `contraindications` when not meant for client view, internal sales tags, lead status, or business pricing). If a portal action reuses a raw CRM query that executes `SELECT * FROM clients`, internal fields could inadvertently be returned to the client portal frontend.

#### Architectural Recommendations
1. **Pure Data Access Layer (No `"use server"`)**:
   * All functions in `src/db/queries/` MUST be pure async TypeScript functions taking an explicit parameters object (e.g. `{ organizationId, clientId }`).
   * They must **never** include the `"use server"` directive.
   * Authentication and authorization checks (`requireClientSession()` or `requireSession()`) must reside exclusively inside Server Actions or API routes before invoking query layer functions.

2. **Explicit Projection & Field Sanitization for Portal Queries**:
   * Create dedicated query modules or explicit selection parameters:
     * `src/db/queries/clients.ts`
     * `src/db/queries/programs.ts`
     * `src/db/queries/assessments.ts`
     * `src/db/queries/documents.ts`
   * Portal queries must use explicit Drizzle `select({ ... })` fields to return strictly client-safe properties, completely excluding sensitive trainer fields.

#### Recommended Code Structure (`src/db/queries/programs.ts`)
```typescript
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { programs, programDays, exercises } from "@/db/schema";

export async function getActiveClientProgramQuery(params: {
  organizationId: string;
  clientId: string;
}) {
  const db = await getDb();
  
  // Strictly filter by active status and target organization + client
  const activeProgram = await db
    .select({
      id: programs.id,
      name: programs.name,
      description: programs.description,
      status: programs.status,
      updatedAt: programs.updatedAt,
    })
    .from(programs)
    .where(
      and(
        eq(programs.organizationId, params.organizationId),
        eq(programs.clientId, params.clientId),
        eq(programs.status, "active")
      )
    )
    .limit(1);

  return activeProgram[0] || null;
}
```

---

### 2. Server Action Boundary Enforcement & Directory Restructuring

#### Problem & Risk Analysis
Currently, all server actions reside in flat files inside `src/app/actions/` (`clients.ts`, `crm.ts`, `programs.ts`, `sessions.ts`, `auth.ts`, etc.) and enforce trainer authentication via `requireSession()` (which verifies trainer JWT tokens).

If a client portal route (e.g., in `src/app/(portal)/program/page.tsx`) imports an action from `src/app/actions/programs.ts`, the server action will invoke `requireSession()`, expecting a trainer cookie. This results in either runtime authentication exceptions or potential security vulnerabilities if authorization logic is misconfigured.

#### Architectural Recommendations
Restructure `src/app/actions/` into clear domain directories:
```
src/app/actions/
├── crm/                  # Trainer CRM Server Actions (requireSession / Trainer JWT)
│   ├── clients.ts
│   ├── programs.ts
│   ├── sessions.ts
│   ├── coach.ts
│   └── library.ts
├── portal/               # Client Portal Server Actions (requireClientSession / Client JWT)
│   ├── auth.ts           # OTP login, verify, logout
│   ├── program.ts        # Client read-only program views
│   ├── progress.ts       # Client assessment views
│   ├── onboarding.ts     # E-signature waiver submission
│   └── profile.ts        # Preference updates
└── shared/               # Non-sensitive helper actions (if any)
```

Each server action file in `src/app/actions/portal/` must start with `"use server"` and enforce `const session = await requireClientSession();` at the very beginning of every exported function.

---

### 3. ESLint Rule Configuration (`eslint.config.mjs`)

#### Problem & Risk Analysis
Developers working across CRM and Portal routes could accidentally import a trainer server action into a portal component or page. Standard TypeScript imports will not catch this boundary breach.

#### Concrete ESLint Flat Config Implementation
In `eslint.config.mjs` (which uses ESLint Flat Config syntax), add a target rule override for `src/app/(portal)/**/*` using `no-restricted-imports`:

```javascript
// eslint.config.mjs
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { "varsIgnorePattern": "^_", "argsIgnorePattern": "^_" },
      ],
    },
  },
  // Security Guardrail: Prevent Client Portal components from importing Trainer CRM actions
  {
    files: ["src/app/(portal)/**/*", "src/app/actions/portal/**/*"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/app/actions/crm*",
                "@/app/actions/clients*",
                "@/app/actions/programs*",
                "@/app/actions/sessions*",
                "@/app/actions/coach*",
                "@/app/actions/library*",
                "@/app/actions/home*",
              ],
              message:
                "SECURITY BOUNDARY VIOLATION: Portal components and actions must not import Trainer CRM server actions. Import from '@/app/actions/portal/' or '@/db/queries/' instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
```

---

### 4. CI & Smoke Testing Strategy (`scripts/smoke-portal.ts`)

#### Problem & Risk Analysis
The existing test framework relies on tsx smoke scripts (`scripts/smoke-pilot.ts`, `scripts/smoke-floor.ts`). Placing `scripts/smoke-portal.ts` in Milestone 6 means that security gates, session cookies, and cross-tenant boundaries will not be systematically verified during Milestones 1 through 5.

#### Recommended Smoke Test Architecture (`scripts/smoke-portal.ts`)
The script should be executable via `npx tsx scripts/smoke-portal.ts` and test five explicit scenarios:

1. **Scenario 1: Client Authentication & OTP Verification**
   * Trigger `requestOTP("client@example.com")` for an `active` client -> verify OTP row generated in `client_otps`.
   * Verify `verifyOTP()` returns a valid HTTP-only `client_session` token containing correct `clientId` and `organizationId`.
   * Test Gate 1: Attempt `requestOTP()` for an `inactive` or `lead` client -> assert failure/rejection.
   * Test invalid/expired OTP attempt -> assert rejection.

2. **Scenario 2: Mandatory Onboarding & Legal E-Signature Flow**
   * Set `onboarding_completed_at = null` for a test client.
   * Invoke `submitClientWaiverAction()` with digital signature, IP (`127.0.0.1`), and User-Agent string.
   * Assert `client_documents` contains record with `status = 'signed'`, `signed_at` non-null, and `onboarding_completed_at` updated on the client record.

3. **Scenario 3: Program & Assessment Read-Only Safety (Gate 3)**
   * Seed 1 `active` program and 1 `draft` program for a client.
   * Call `getActiveClientProgramAction()` with client session.
   * Assert only the `active` program is returned and `draft` is strictly filtered out.
   * Verify returned object contains no internal trainer notes or hidden cost attributes.

4. **Scenario 4: Session Boundary & Action Isolation Protection**
   * Attempt calling trainer action `searchClientsAction()` using a client session context -> assert error thrown or empty response without elevated access.
   * Attempt calling portal action `getClientPortalDashboardAction()` with invalid/expired client cookie -> assert `Unauthorized` exception.

5. **Scenario 5: Multi-Tenant & Cross-Client Data Isolation**
   * Create Client A in Organization 1 and Client B in Organization 2.
   * Authenticate as Client A and attempt to query Client B's program or document by `clientId` -> assert query returns `null` or throws authorization violation.

#### Integration into CI Pipeline
Add to `package.json` scripts:
```json
"scripts": {
  "test:smoke": "tsx scripts/smoke-pilot.ts && tsx scripts/smoke-portal.ts"
}
```

---

### 5. Revised Plan Roadmap, Sequencing & DoD Refinements

#### Recommended Milestone Sequencing Adjustments
1. **Milestone 1: Security Foundation & Directory Structure (Re-scoped)**
   * Establish `src/app/actions/portal/` vs `src/app/actions/crm/` folder structure.
   * Implement ESLint restricted imports rule in `eslint.config.mjs`.
   * Build DB schema migrations (`client_sessions`, `client_otps`).
   * Implement AWS SES client auth with local mock fallback.
   * Create `scripts/smoke-portal.ts` skeleton (Scenario 1 Auth test).
2. **Milestone 2: Shared Query Layer & Mobile Shell**
   * Create `src/db/queries/` with strict projection methods (`clients.ts`, `programs.ts`).
   * Build `(portal)/layout.tsx` mobile bottom-tab layout.
   * Expand `smoke-portal.ts` (Scenario 4 Session boundary test).
3. **Milestone 3: Onboarding & Mandatory Intake**
   * Create `client_documents` table and legal E-signature actions (IP + timestamp capture).
   * Expand `smoke-portal.ts` (Scenario 2 E-signature test).
4. **Milestone 4: Read-Only Program & Progress Viewer**
   * Build `/portal/program` and `/portal/progress` using shared queries.
   * Expand `smoke-portal.ts` (Scenario 3 Read-only safety & Scenario 5 Cross-tenant test).
5. **Milestone 5: Dashboard, Notifications & Billing**
   * Build notifications, upcoming appointments, and invoice history views.
6. **Milestone 6: Full CI Integration & Hardening**
   * Execute full `test:smoke` suite in CI pipeline, complete load and security verification.

#### AWS SES Local/Dev Mock Fallback Strategy
To prevent developer and CI test runner blockage when AWS credentials are absent:
```typescript
export async function sendOTPEmail(email: string, code: string) {
  if (process.env.NODE_ENV === "test" || !process.env.AWS_ACCESS_KEY_ID) {
    console.log(`[DEV/TEST OTP MOCK] Sent OTP code ${code} to ${email}`);
    return { success: true, messageId: "mock-msg-id" };
  }
  // AWS SES SDK invocation here
}
```

#### Refined Definition of Done (DoD) Criteria
Each milestone DoD must mandate:
* Zero ESLint errors including boundary restriction rules (`npm run lint`).
* Successful execution of relevant `scripts/smoke-portal.ts` scenarios.
* Database schema change Drizzle migration script generated and committed.
* Multi-tenant isolation explicitly verified for all new endpoints/actions.

---

## Minor Corrections and Typos

1. **Section 1, Architecture & Component Impact**:
   * *Text*: "...they receive a secure, HTTP-only `client_session` cookie (using `jose`, mirroring the trainer auth but scoped strictly to clients)."
   * *Correction*: Clarify that the cookie name must explicitly differ from the trainer cookie (e.g., `floorscribe_client_session` vs `floorscribe_session`) to prevent cookie key collision when a user is both a trainer and a client on the same domain.

2. **Section 3, Milestone 1**:
   * *Text*: "Integrate **AWS SES** API for transactional emails."
   * *Correction*: Add explicit mention of local development fallback (`console.log` / mock mailer) so developers do not require active AWS SES sandbox access to run local tests.

3. **Section 3, Milestone 6**:
   * *Text*: "Write `scripts/smoke-portal.ts`."
   * *Correction*: Rephrase to "Finalize full assertion suite for `scripts/smoke-portal.ts`", as the initial smoke test script must be created in Milestone 1.
