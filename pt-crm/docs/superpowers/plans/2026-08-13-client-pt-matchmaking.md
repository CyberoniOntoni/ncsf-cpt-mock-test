# Client–PT Matchmaking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**On approve:** copy this file to `pt-crm/docs/superpowers/plans/2026-08-13-client-pt-matchmaking.md` before implementing.

**Goal:** Let a person find a FloorScribe trainer near them or at their gym, request an intro, and become a CRM lead in that trainer’s org — while FloorScribe earns money from featured listings and intro-accept fees.

**Architecture:** Public `/find` is a read-only discovery surface over opt-in `marketplace_profiles` (one card per trainer user in an org). Matching is geo (haversine on stored lat/lng) or gym (`gym_facilities` the PT listed). An `intro_request` is a lead, not a booking. Accepting it inserts a `clients` row (`status: "lead"`) in the trainer’s org and reuses the existing `/portal` OTP sidecar. Money in this milestone is **platform fees only** (FloorScribe is merchant of record) via Stripe Checkout on `platform_charges`. Session packages stay on the trainer’s existing invoices/`paymentUrl`. Do **not** add Stripe Connect, in-app chat, reviews, or a global `people` table.

**Tech Stack:** Next.js 16 App Router, TypeScript, Drizzle + PGlite, existing `sendEmail` mock/SES adapter, Stripe Checkout (platform account, `STRIPE_SECRET_KEY`). Tests are `tsx` smoke scripts (same pattern as `scripts/smoke-portal.ts`), not Jest.

## Global Constraints

- Workspace app root: `pt-crm/` (all paths below are relative to it).
- Floor OS stays private until a trainer **publishes** a listing. Default is unpublished.
- Do **not** merge seekers into `users`. Email is the person key; `clients` stays per-org.
- Do **not** import trainer CRM actions from `/find` or `/portal` (extend `eslint.config.mjs` `no-restricted-imports`).
- Gym membership is **self-attested** in v1. There is no gym-operator API or membership verification.
- No private LXC IPs, live secrets, or `.env` values in docs or commits. Use `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` env names only.
- `SCHEMA_VERSION` bump is **22** (21 = partial unique clients org+email).
- Smoke: `npx tsx scripts/smoke-marketplace.ts` plus `npx tsc --noEmit`.
- Local commits only inside `pt-crm/` files; push later with `git subtree push --prefix=pt-crm floorscribe main`.
- Copy: “FloorScribe introduces you. Training and session payments are between you and the trainer.”

## Monetization (locked)

| Product | Who pays | Amount | When |
|---------|----------|--------|------|
| Intro accept fee | Trainer org | `1900` cents USD | On 4th+ accepted intro (`FREE_INTROS_PER_ORG = 3`) |
| Featured month | Trainer org | `2900` cents USD | Checkout succeeds → `featuredUntil = now + 30d` |

- First **3** accepted intros per org are `waived`.
- If the org has **2 or more** `due` intro charges, hide the listing from search (`MAX_UNPAID_INTRO_CHARGES = 2`).
- Accept is **not** blocked by checkout. Create the lead immediately; email the PT a Checkout link when the fee is not waived.
- Stripe Connect take-rate on session packs is **out of this plan**.

## File map

| File | Responsibility |
|------|----------------|
| **Create** `src/lib/marketplace/types.ts` | Unions and fee constants |
| **Create** `src/lib/marketplace/geo.ts` | Haversine + in-radius |
| **Create** `src/lib/marketplace/rank.ts` | Featured → gym → distance |
| **Create** `src/lib/marketplace/fees.ts` | Free-intro / unpaid-cap |
| **Create** `src/lib/marketplace/stripe-platform.ts` | Checkout + mock |
| **Create** `src/db/queries/marketplace.ts` | Public sanitized reads |
| **Create** `src/app/actions/marketplace.ts` | Public intro request |
| **Create** `src/app/actions/marketplace-trainer.ts` | Publish / accept / featured |
| **Create** `src/app/find/page.tsx` | Public search |
| **Create** `src/app/find/[profileId]/page.tsx` | Public profile + intro form |
| **Create** `src/app/api/stripe/platform-webhook/route.ts` | Mark charges paid |
| **Create** `src/components/marketplace-listing-form.tsx` | Settings editor |
| **Create** `src/components/find-search.tsx` | Client search form |
| **Create** `scripts/smoke-marketplace.ts` | Pure + DB smoke |
| **Modify** `src/db/schema.ts` | New tables |
| **Modify** `src/db/index.ts` | `SCHEMA_VERSION = 22` + DDL |
| **Modify** `src/db/seed.ts` | Demo gyms + Alex listing |
| **Modify** `src/middleware.ts` | `/find` and `/api/stripe/` public |
| **Modify** `src/components/marketing-header.tsx` | Find a trainer |
| **Modify** `src/app/(app)/settings/page.tsx` | Mount listing form |
| **Modify** `package.json` | `smoke:marketplace` |
| **Modify** `eslint.config.mjs` | Ban CRM imports from `/find` |
| **Modify** `docs/STATUS.md`, `CLIENT_PORTAL_PLAN.md`, `happy-path.md` | Docs |
| **Modify** `.github/workflows/ci.yml` | Hook smoke |

## Out of this plan

- Stripe Connect / split session payments
- In-app messaging or reviews
- Gym-operator accounts or membership verification
- Global `people` identity table
- Changing `/portal` (still one org + one client row)

---

### Task 1: Schema 22 + marketplace types

**Files:**
- Create: `src/lib/marketplace/types.ts`
- Modify: `src/db/schema.ts` (append tables before relations)
- Modify: `src/db/index.ts` (line 8 `SCHEMA_VERSION`; append DDL at end of `ensureSchema` ~716)
- Test: `scripts/smoke-marketplace.ts`

**Interfaces:**
- Consumes: `organizations`, `users`, `clients` FKs
- Produces: `gymFacilities`, `marketplaceProfiles`, `marketplaceProfileFacilities`, `introRequests`, `platformCharges`

```ts
// src/lib/marketplace/types.ts
export type ServiceMode = "in_home" | "at_gym" | "online" | "studio";
export type IntroStatus = "pending" | "accepted" | "declined" | "expired";
export type ChargeKind = "intro_accept" | "featured_month";
export type ChargeStatus = "due" | "paid" | "waived";

export const INTRO_FEE_CENTS = 1900;
export const FEATURED_FEE_CENTS = 2900;
export const FREE_INTROS_PER_ORG = 3;
export const MAX_UNPAID_INTRO_CHARGES = 2;
export const INTROS_PER_EMAIL_PER_DAY = 3;
export const DEFAULT_RADIUS_KM = 15;
export const FEATURED_DAYS = 30;
```

- [ ] **Step 1: Write failing smoke**

```ts
import { INTRO_FEE_CENTS, FEATURED_FEE_CENTS, FREE_INTROS_PER_ORG } from "../src/lib/marketplace/types";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("ok", msg);
}

async function main() {
  assert(INTRO_FEE_CENTS === 1900, "intro fee $19");
  assert(FEATURED_FEE_CENTS === 2900, "featured $29");
  assert(FREE_INTROS_PER_ORG === 3, "3 free intros");
  console.log("\nmarketplace smoke: ALL PASS");
}

try {
  main().then(() => process.exit(0));
} catch (e) {
  console.error(e);
  process.exit(1);
}
```

- [ ] **Step 2: Run** `cd pt-crm; npx tsx scripts/smoke-marketplace.ts`

Expected: FAIL — `Cannot find module '../src/lib/marketplace/types'`

- [ ] **Step 3: Add types + Drizzle + DDL**

Append to `src/db/schema.ts`:

```ts
export const gymFacilities = pgTable(
  "gym_facilities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    brand: text("brand"),
    city: text("city").notNull(),
    region: text("region"),
    country: text("country").notNull().default("SG"),
    lat: real("lat").notNull(),
    lng: real("lng").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("gym_facilities_slug_uidx").on(t.slug),
    index("gym_facilities_city_idx").on(t.city),
  ]
);

export const marketplaceProfiles = pgTable(
  "marketplace_profiles",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: text("headline").notNull().default(""),
    bio: text("bio").notNull().default(""),
    specialties: text("specialties").notNull().default(""),
    hourlyRateCents: integer("hourly_rate_cents"),
    currency: text("currency").notNull().default("USD"),
    serviceModes: text("service_modes").notNull().default("studio,at_gym"),
    city: text("city").notNull().default(""),
    region: text("region"),
    country: text("country").notNull().default("SG"),
    lat: real("lat"),
    lng: real("lng"),
    radiusKm: integer("radius_km").notNull().default(15),
    published: boolean("published").notNull().default(false),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("marketplace_profiles_user_org_uidx").on(t.userId, t.organizationId),
    index("marketplace_profiles_published_idx").on(t.published),
  ]
);

export const marketplaceProfileFacilities = pgTable(
  "marketplace_profile_facilities",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => marketplaceProfiles.id, { onDelete: "cascade" }),
    facilityId: text("facility_id")
      .notNull()
      .references(() => gymFacilities.id, { onDelete: "cascade" }),
  },
  (t) => [
    uniqueIndex("mpf_profile_facility_uidx").on(t.profileId, t.facilityId),
    index("mpf_facility_idx").on(t.facilityId),
  ]
);

export const introRequests = pgTable(
  "intro_requests",
  {
    id: text("id").primaryKey(),
    profileId: text("profile_id")
      .notNull()
      .references(() => marketplaceProfiles.id, { onDelete: "cascade" }),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    seekerEmail: text("seeker_email").notNull(),
    seekerName: text("seeker_name").notNull(),
    seekerPhone: text("seeker_phone"),
    city: text("city"),
    lat: real("lat"),
    lng: real("lng"),
    facilityId: text("facility_id").references(() => gymFacilities.id, {
      onDelete: "set null",
    }),
    message: text("message"),
    status: text("status").notNull().default("pending"),
    acceptedClientId: text("accepted_client_id").references(() => clients.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("intro_requests_org_status_idx").on(t.organizationId, t.status),
    index("intro_requests_email_created_idx").on(t.seekerEmail, t.createdAt),
  ]
);

export const platformCharges = pgTable(
  "platform_charges",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    introRequestId: text("intro_request_id").references(() => introRequests.id, {
      onDelete: "set null",
    }),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("USD"),
    status: text("status").notNull().default("due"),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    paymentUrl: text("payment_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
  },
  (t) => [index("platform_charges_org_status_idx").on(t.organizationId, t.status)]
);
```

Set `SCHEMA_VERSION = 22`. Append matching `CREATE TABLE IF NOT EXISTS` SQL for all five tables inside `ensureSchema`. Add `"smoke:marketplace": "tsx scripts/smoke-marketplace.ts"` to `package.json`.

- [ ] **Step 4:** `npx tsx scripts/smoke-marketplace.ts; npx tsc --noEmit` — both PASS

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/lib/marketplace/types.ts pt-crm/src/db/schema.ts pt-crm/src/db/index.ts pt-crm/scripts/smoke-marketplace.ts pt-crm/package.json
git commit -m "feat(marketplace): SCHEMA 22 gym facilities, listings, intros, platform charges"
```

---

### Task 2: Geo, rank, and fee policy (pure)

**Files:**
- Create: `src/lib/marketplace/geo.ts`, `rank.ts`, `fees.ts`
- Modify: `scripts/smoke-marketplace.ts`

**Interfaces:**

```ts
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number;
export function inRadiusKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }, radiusKm: number): boolean;

export type RankableProfile = {
  id: string;
  featuredUntil: Date | null;
  facilityIds: string[];
  lat: number | null;
  lng: number | null;
};
export type RankQuery = {
  now: Date;
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  radiusKm?: number;
};
export function rankMarketplaceProfiles(profiles: RankableProfile[], query: RankQuery): RankableProfile[];

export function introFeeDecision(opts: {
  acceptedIntroCountForOrg: number;
  unpaidIntroCharges: number;
}): { action: "waive" | "charge" | "hide_listing"; amountCents: number };

export function listingVisibleInSearch(opts: {
  published: boolean;
  unpaidIntroCharges: number;
}): boolean;
```

- [ ] **Step 1: Failing smoke** — Tampines (1.3496, 103.9568) vs Orchard (1.3048, 103.8318) distance 10–25 km; rank order `feat,gym,far`; 8 km radius drops `far`; 1st intro `waive`; 4th `charge` 1900; 2 unpaid `hide_listing`; unpublished hidden

- [ ] **Step 2: Run** — FAIL missing modules

- [ ] **Step 3: Implement**

`geo.ts`: Earth radius 6371 km, standard haversine.

`rank.ts`: keep profiles inside `radiusKm` (default `DEFAULT_RADIUS_KM`) when origin+coords exist; sort featured (`featuredUntil > now`) first, then gym match, then distance.

`fees.ts`: if `unpaidIntroCharges >= MAX_UNPAID_INTRO_CHARGES` → `hide_listing`; else if `acceptedIntroCountForOrg < FREE_INTROS_PER_ORG` → `waive`; else `charge` `INTRO_FEE_CENTS`. Listing visible only if `published && unpaid < MAX`.

- [ ] **Step 4: smoke PASS**

- [ ] **Step 5: Commit** `feat(marketplace): haversine rank and intro fee policy`

---

### Task 3: Seed demo gyms + published listing

**Files:** Modify `src/db/seed.ts`, `scripts/smoke-marketplace.ts`

Stable IDs: `gym_demo_tampines`, `gym_demo_orchard`, `mp_demo_alex`

- [ ] **Step 1: Failing smoke** after `seedIfNeeded()` — gym slug `anytime-tampines`; profile `mp_demo_alex` published

- [ ] **Step 2: Run** — FAIL empty gyms

- [ ] **Step 3:** `seedMarketplaceIfNeeded` inserts two Anytime Fitness gyms + Alex listing at Tampines (`published: true`, facility link). No-op if any gym exists. Call from `seedIfNeeded()`.

- [ ] **Step 4: smoke PASS**

- [ ] **Step 5: Commit** `feat(marketplace): seed demo gyms and published Alex listing`

---

### Task 4: Public search + `/find` UI

**Files:**
- Create: `src/db/queries/marketplace.ts`, `src/components/find-search.tsx`, `src/app/find/page.tsx`, `src/app/find/[profileId]/page.tsx`
- Modify: `middleware.ts` (`/find` public), `marketing-header.tsx`, `eslint.config.mjs` (ban CRM imports on `src/app/find/**`), smoke

**Interfaces:**

```ts
export type PublicProfileCard = {
  id: string;
  displayName: string;
  title: string | null;
  headline: string;
  city: string;
  region: string | null;
  hourlyRateCents: number | null;
  currency: string;
  serviceModes: string[];
  facilityNames: string[];
  featured: boolean;
  lat: number | null;
  lng: number | null;
};

export async function listPublicGyms(): Promise<{ id: string; name: string; slug: string; city: string; brand: string | null }[]>;
export async function searchPublicProfiles(input: {
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  radiusKm?: number;
  now?: Date;
}): Promise<PublicProfileCard[]>;
export async function getPublicProfile(profileId: string): Promise<(PublicProfileCard & { bio: string; specialties: string[] }) | null>;
```

Never select `passwordHash` or unpublished rows.

- [ ] **Step 1: Failing smoke** — search near Tampines + `gym_demo_tampines` finds `mp_demo_alex`; JSON has no `password`; `getPublicProfile("nope") === null`

- [ ] **Step 2: FAIL** missing queries

- [ ] **Step 3:** Load published profiles; drop hidden by unpaid cap; rank; join `users.name`/`title`. `/find` reads `gym`/`lat`/`lng`/`radius`. Empty copy: “No trainers in that area yet.” Profile page disclaimer: “FloorScribe introduces you. Training and session payments are between you and the trainer.”

- [ ] **Step 4: smoke + tsc PASS**

- [ ] **Step 5: Commit** `feat(marketplace): public /find search by gym and distance`

---

### Task 5: Trainer listing editor

**Files:** `src/app/actions/marketplace-trainer.ts`, `src/components/marketplace-listing-form.tsx`, `settings/page.tsx`, smoke

**Interfaces:**

```ts
export async function upsertMarketplaceListing(opts: {
  organizationId: string;
  userId: string;
  headline: string;
  bio: string;
  specialties: string;
  hourlyRateCents: number | null;
  city: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  published: boolean;
  facilityIds: string[];
  serviceModes: string;
}): Promise<{ profileId: string }>;

export async function getMyMarketplaceListingAction(): Promise<{
  profile: {
    id: string;
    headline: string;
    bio: string;
    specialties: string;
    hourlyRateCents: number | null;
    city: string;
    lat: number | null;
    lng: number | null;
    radiusKm: number;
    published: boolean;
    featuredUntil: Date | null;
    facilityIds: string[];
    serviceModes: string;
  } | null;
  gyms: { id: string; name: string; slug: string }[];
}>;

export async function saveMarketplaceListingAction(input: {
  headline: string;
  bio: string;
  specialties: string;
  hourlyRateCents: number | null;
  city: string;
  lat: number | null;
  lng: number | null;
  radiusKm: number;
  published: boolean;
  facilityIds: string[];
  serviceModes: string;
}): Promise<{ ok: true; profileId: string } | { ok: false; error: string }>;
```

Upsert `(userId, organizationId)`. Headline required if published. Max 8 facilities. Actions use `requireSession()`.

- [ ] **Step 1: Failing smoke** — throwaway user, `published: true` + empty headline throws

- [ ] **Step 2: FAIL** missing upsert

- [ ] **Step 3: Implement form + settings mount** (owner/trainer/admin)

- [ ] **Step 4: smoke + tsc PASS**

- [ ] **Step 5: Commit** `feat(marketplace): trainer opt-in listing editor`

---

### Task 6: Intro request + rate limit

**Files:** `src/app/actions/marketplace.ts`, `src/components/find-intro-form.tsx`, profile page, smoke

**Interfaces:**

```ts
export async function createIntroRequest(opts: {
  profileId: string;
  seekerEmail: string;
  seekerName: string;
  seekerPhone?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  facilityId?: string | null;
  message?: string | null;
  now?: Date;
}): Promise<{ ok: true; introId: string } | { ok: false; error: "not_found" | "rate_limited" | "invalid" }>;

export async function requestIntroAction(form: {
  profileId: string;
  seekerEmail: string;
  seekerName: string;
  seekerPhone?: string;
  city?: string;
  facilityId?: string;
  message?: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

Lowercase email; reject missing `@`; profile must be searchable; max `INTROS_PER_EMAIL_PER_DAY` per 24h; `sendEmail` to trainer and seeker.

- [ ] **Step 1: Failing smoke** — `seeker@example.com` creates + emails; `not-an-email` → `invalid`; 4th `ratelimit@example.com` → `rate_limited`

- [ ] **Step 2: FAIL** missing module

- [ ] **Step 3: Implement + form**

- [ ] **Step 4: smoke PASS**

- [ ] **Step 5: Commit** `feat(marketplace): rate-limited intro requests`

---

### Task 7: Accept / decline → CRM lead

**Files:** `marketplace-trainer.ts`, `src/app/(app)/intros/page.tsx`, `src/lib/nav.ts`, smoke

**Interfaces:**

```ts
export async function listOrgIntros(organizationId: string): Promise<{
  id: string;
  status: string;
  seekerName: string;
  seekerEmail: string;
  message: string | null;
  createdAt: Date;
  acceptedClientId: string | null;
}[]>;

export async function acceptIntroRequest(opts: {
  introId: string;
  organizationId: string;
  actorUserId: string;
}): Promise<
  | { ok: true; clientId: string; charge: { status: "waived" } | { status: "due"; chargeId: string; amountCents: number } }
  | { ok: false; error: "not_found" | "not_pending" | "forbidden" }
>;

export async function declineIntroRequest(opts: {
  introId: string;
  organizationId: string;
}): Promise<{ ok: true } | { ok: false; error: "not_found" | "not_pending" }>;
```

Accept: org match + pending; reuse `(org, email)` client or insert `status: "lead"`; `introFeeDecision` on prior accepted count; do not set `onboardingCompletedAt`. Double-accept → `not_pending`.

- [ ] **Step 1: Failing smoke** — accept Pat Accepted / `accepted@example.com` → lead + waived; second accept `not_pending`; 4th+ due 1900

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement `/intros` inbox**

- [ ] **Step 4: smoke + tsc PASS**

- [ ] **Step 5: Commit** `feat(marketplace): accept intro creates CRM lead`

---

### Task 8: Platform Checkout (intro fee + featured)

**Files:** `src/lib/marketplace/stripe-platform.ts`, `src/app/api/stripe/platform-webhook/route.ts`, trainer actions, listing form, intros page, schema+index (`profile_id` on charges), middleware `/api/stripe/`, smoke

**Interfaces:**

```ts
export type CheckoutSession = { id: string; url: string };

export async function createPlatformCheckoutSession(opts: {
  chargeId: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSession>;

export async function markPlatformChargePaid(opts: { chargeId: string; paidAt: Date }): Promise<void>;

export async function startPlatformCheckoutAction(input: {
  kind: "intro_accept" | "featured_month";
  chargeId?: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }>;
```

Mock when `!STRIPE_SECRET_KEY` or `MOCK_STRIPE=true`: url `https://checkout.stripe.com/mock/{chargeId}`. Else `fetch` Checkout Sessions (no Stripe SDK). Webhook `checkout.session.completed` → `markPlatformChargePaid`. Featured sets `featuredUntil = paidAt + FEATURED_DAYS`.

```sql
ALTER TABLE platform_charges ADD COLUMN IF NOT EXISTS profile_id TEXT REFERENCES marketplace_profiles(id) ON DELETE SET NULL;
```

- [ ] **Step 1: Failing smoke** — mock URL; paid featured charge on `mp_demo_alex` sets `featuredUntil`

- [ ] **Step 2: FAIL**

- [ ] **Step 3: Implement helper, ALTER, webhook, Pay/Feature buttons**

- [ ] **Step 4: smoke + tsc PASS**

- [ ] **Step 5: Commit** `feat(marketplace): platform Stripe Checkout for intros and featured`

---

### Task 9: Docs + CI

**Files:** `docs/STATUS.md`, `docs/CLIENT_PORTAL_PLAN.md`, `docs/happy-path.md`, `.github/workflows/ci.yml`

- [ ] **Step 1: Read STATUS + CI smoke steps**
- [ ] **Step 2: Update copy** — Find a trainer, intros → leads, 3 free then $19, featured $29, Connect still later. No IPs/secrets.
- [ ] **Step 3:** `npx tsc --noEmit; npm run smoke:marketplace; npm run smoke:portal` — all PASS
- [ ] **Step 4: Commit** `docs(marketplace): STATUS and happy-path for Find a trainer`

---

## Self-review

| Requirement | Task |
|-------------|------|
| Find PTs by area | 2 + 4 |
| Find PTs by gym | 1 + 4 |
| PT opt-in card | 5 |
| Intro → CRM lead | 6 + 7 |
| Reuse portal email identity | 7 |
| Monetize | 2 + 8 |
| No Connect yet | Out of plan |

`platform_charges.profileId` is added in Task 8; do not skip the ALTER.

**Follow-up plan (not this one):** Stripe Connect destination charges (~10% of first pack for marketplace-sourced clients), reviews, gym-operator claimed facilities.
