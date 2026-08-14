# Mail delivery and email verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every outbound FloorScribe email goes through Mailtrap with a category and a delivery check, and every account type must prove inbox ownership before it can act as that email.

**Architecture:** Keep `sendEmail` as the only transport. Add `email_challenges` (6-digit hashed codes, same HMAC as portal OTP) plus `emailVerifiedAt` on `users` and `seeker_profiles`. Portal OTP and `ensureSeekerForPerson` mark the seeker verified. Team invites actually send the existing `/invite/[token]` link. Do not add password reset.

**Tech Stack:** Next.js 16, Drizzle + PGlite SCHEMA 27, existing Mailtrap `fetch` to `https://send.api.mailtrap.io/api/send`, `tsx` smokes.

## Global Constraints

- Brand is FloorScribe only. From-address default `hello@floorscribe.com`.
- Never commit `MAILTRAP_API_TOKEN` or other secrets.
- Do not add the `mailtrap` npm package. Use existing `sendEmail` / Mailtrap HTTP.
- SCHEMA_VERSION becomes **27**. Restart `npm run dev` after the bump.
- Portal password + OTP remain. Studio attach still requires OTP proof (`studioProvenByOtp`).
- Demo seed (`pt@demo.local`) sets `emailVerifiedAt` so local/dev still works.
- Production still fail-closes when Mailtrap is unset (`isMockEmail()`).
- Do not run `smoke:portal` / `smoke:marketplace` while `npm run dev` holds PGlite.
- YAGNI: no password reset, no HTML templates, no SES, no second mail provider.
- Execution: **subagent-driven** (user requested multiagent).

## Out of scope

- Password reset / forgot-password.
- Changing Mailtrap sender domain.
- Blocking trainer CRM login until verified (would break demo and invite-accept mid-flow). Gate **publish listing** and **create invite** instead.

## Current state (do not re-implement)

- `pt-crm/src/lib/email.ts` already posts to Mailtrap when `MAILTRAP_API_TOKEN` is set.
- Portal OTP already emails a 6-digit code and fail-closes if not delivered.
- Studio attach already requires a `client_sessions` row from OTP.
- Team invites exist as copy-link tokens; **no email is sent**.
- Seeker/trainer register is password-only; no `emailVerifiedAt`.

## File map

| File | Role |
| --- | --- |
| `src/db/schema.ts` | `emailVerifiedAt` on users + seeker_profiles; `emailChallenges` table |
| `src/db/index.ts` | SCHEMA 27 + ALTER/CREATE |
| `src/db/seed.ts` | Demo owner `emailVerifiedAt = now` |
| `src/lib/email-challenge.ts` | **Create.** issue/verify 6-digit challenges |
| `src/lib/mail-copy.ts` | **Create.** subject/text/category for OTP, verify, invite, intro |
| `src/lib/email.ts` | Unchanged transport (Task 2 only if callers need html — they do not) |
| `src/lib/seeker-auth.ts` | Persist + expose `emailVerifiedAt`; OTP path marks verified |
| `src/lib/client-auth.ts` | After successful OTP, mark seeker verified; use mail-copy |
| `src/lib/auth.ts` | Persist trainer `emailVerifiedAt`; send invite mail |
| `src/app/actions/portal/auth.ts` | `requestSeekerVerifyAction` / `verifySeekerEmailAction` |
| `src/app/actions/auth.ts` | `requestTrainerVerifyAction` / `verifyTrainerEmailAction` |
| `src/app/portal/verify/page.tsx` | **Create.** Seeker 6-digit form |
| `src/app/verify-email/page.tsx` | **Create.** Trainer 6-digit form |
| `src/lib/marketplace/intro-ops.ts` | Require seeker verified; use mail-copy; check `delivered` |
| `src/lib/marketplace/trainer-ops.ts` | Require trainer verified to publish; intro accept/decline mail-copy |
| `src/components/settings-team-panel.tsx` | Show “invite emailed” |
| `scripts/test-mail-verify.ts` | **Create.** Pure + challenge tests |
| `package.json` | `smoke:mail-verify` |

---

### Task 1: SCHEMA 27 and challenge helper

**Files:**
- Modify: `pt-crm/src/db/schema.ts` (`users`, `seekerProfiles`)
- Modify: `pt-crm/src/db/index.ts` (`SCHEMA_VERSION = 27`)
- Modify: `pt-crm/src/db/seed.ts` (demo user)
- Create: `pt-crm/src/lib/email-challenge.ts`
- Create: `pt-crm/scripts/test-mail-verify.ts`
- Modify: `pt-crm/package.json`

**Interfaces:**
- Produces:

```ts
export type EmailChallengePurpose =
  | "seeker_verify"
  | "trainer_verify";

export async function issueEmailChallenge(opts: {
  purpose: EmailChallengePurpose;
  email: string;
}): Promise<{ ok: true; code: string } | { ok: false; error: string }>;

export async function consumeEmailChallenge(opts: {
  purpose: EmailChallengePurpose;
  email: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

- Reuse `hashOtp` from `pt-crm/src/lib/client-auth.ts` (already exported). TTL 10 minutes, max 5 attempts, rate 3 per 15 minutes — same numbers as portal OTP.

- [ ] **Step 1: Write failing tests** in `scripts/test-mail-verify.ts`:

```ts
import assert from "node:assert/strict";
import { issueEmailChallenge, consumeEmailChallenge } from "../src/lib/email-challenge";

async function main() {
  const email = `verify-${Date.now()}@example.com`;
  const issued = await issueEmailChallenge({ purpose: "seeker_verify", email });
  assert.equal(issued.ok, true);
  if (!issued.ok) return;
  assert.match(issued.code, /^\d{6}$/);
  const bad = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: "000000",
  });
  assert.equal(bad.ok, false);
  const good = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: issued.code,
  });
  assert.equal(good.ok, true);
  const reuse = await consumeEmailChallenge({
    purpose: "seeker_verify",
    email,
    code: issued.code,
  });
  assert.equal(reuse.ok, false);
  console.log("mail-verify challenge ok");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Add `"smoke:mail-verify": "tsx scripts/test-mail-verify.ts"` to `package.json`.

- [ ] **Step 2: Run to fail**

Run: `cd pt-crm; npm run smoke:mail-verify`
Expected: FAIL (module or table missing). This smoke **opens PGlite** — stop `npm run dev` first.

- [ ] **Step 3: Schema**

On `users` and `seekerProfiles` add:

```ts
emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
```

Add table:

```ts
export const emailChallenges = pgTable(
  "email_challenges",
  {
    id: text("id").primaryKey(),
    purpose: text("purpose").notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: timestamp("used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_challenges_email_idx").on(t.email, t.purpose)]
);
```

`SCHEMA_VERSION = 27`. In `ensureSchema` SQL:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE seeker_profiles ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS email_challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS email_challenges_email_idx ON email_challenges(email, purpose);
```

Seed: when inserting `pt@demo.local`, set `emailVerifiedAt: new Date()`.

- [ ] **Step 4: Implement `email-challenge.ts`**

Normalize email with `trim().toLowerCase()`. Generate code `String(randomInt(0, 1_000_000)).padStart(6, "0")`. Invalidate unused rows for same purpose+email before insert (set `usedAt`). Rate-limit by counting rows created in last 15 minutes. `consume` loads latest unused row, checks expiry/attempts/hash, increments attempts on miss, sets `usedAt` on hit.

Return the plaintext `code` from `issue` so the caller can put it in `sendEmail`. Never log the code in production.

- [ ] **Step 5: Run** `npm run smoke:mail-verify` — expect `mail-verify challenge ok`. Then `npm run typecheck`.

- [ ] **Step 6: Commit** `feat: add email verification challenges (SCHEMA 27)`

---

### Task 2: Shared mail copy and delivery checks on existing sends

**Files:**
- Create: `pt-crm/src/lib/mail-copy.ts`
- Modify: `pt-crm/src/lib/client-auth.ts` (OTP body)
- Modify: `pt-crm/src/lib/marketplace/intro-ops.ts`
- Modify: `pt-crm/src/lib/marketplace/trainer-ops.ts`
- Modify: `pt-crm/scripts/test-mail-verify.ts` (copy assertions; no PGlite)

**Interfaces:**

```ts
export function mailPortalOtp(opts: {
  firstName: string;
  organizationName: string;
  code: string;
}): { to?: never; subject: string; text: string; category: "portal-otp" };

export function mailSeekerVerify(opts: { firstName: string; code: string }): {
  subject: string;
  text: string;
  category: "seeker-verify";
};

export function mailTrainerVerify(opts: { name: string; code: string }): {
  subject: string;
  text: string;
  category: "trainer-verify";
};

export function mailOrgInvite(opts: {
  orgName: string;
  role: string;
  inviteUrl: string;
}): { subject: string; text: string; category: "org-invite" };

export function mailIntroRequested(opts: {
  seekerName: string;
  seekerEmail: string;
  message: string | null;
}): { subject: string; text: string; category: "intro" };

export function mailIntroRequestedSeeker(opts: {
  trainerName: string;
}): { subject: string; text: string; category: "intro" };

export function mailIntroAccepted(opts: { firstName: string }): {
  subject: string;
  text: string;
  category: "intro";
};

export function mailIntroDeclined(): {
  subject: string;
  text: string;
  category: "intro";
};
```

OTP text must include the 6-digit code and “expires in 10 minutes”. Invite text must include the full `inviteUrl`. No other product names.

- [ ] **Step 1: Failing test** in `test-mail-verify.ts` (sync, no DB):

```ts
import { mailPortalOtp, mailOrgInvite } from "../src/lib/mail-copy";
const otp = mailPortalOtp({ firstName: "Jane", organizationName: "Demo", code: "123456" });
assert.equal(otp.category, "portal-otp");
assert.match(otp.text, /123456/);
const inv = mailOrgInvite({
  orgName: "Demo Studio",
  role: "trainer",
  inviteUrl: "https://floorscribe.com/invite/tok_abc",
});
assert.match(inv.text, /https:\/\/floorscribe.com\/invite\/tok_abc/);
```

- [ ] **Step 2: Implement copy. Wire OTP + intro/accept/decline to these helpers.** If `sendEmail` returns `{ delivered: false }` in production, intro-ops still created the intro — **do not roll back the intro** (seeker already submitted). Log and continue. Trainer notify failing is not a client error.

- [ ] **Step 3:** `npx tsx scripts/test-mail-verify.ts` (will still run challenge tests) + `npm run typecheck`.

- [ ] **Step 4: Commit** `feat: centralize FloorScribe outbound mail copy`

---

### Task 3: Verify seeker emails

**Files:**
- Modify: `pt-crm/src/lib/seeker-auth.ts` (`toPublic` includes `emailVerifiedAt: Date | null`; `registerSeeker` leaves it null; `ensureSeekerForPerson` sets `emailVerifiedAt: new Date()`; add `markSeekerEmailVerified(email: string)`)
- Modify: `pt-crm/src/lib/client-auth.ts` (`verifyClientOtp` after seeker ensure → `markSeekerEmailVerified`)
- Modify: `pt-crm/src/app/actions/portal/auth.ts`
- Create: `pt-crm/src/app/portal/verify/page.tsx` (client form: email + 6-digit + resend)
- Modify: `pt-crm/src/app/portal/register/page.tsx` — after successful register, go to `/portal/verify?setup=1`
- Modify: `pt-crm/src/lib/marketplace/intro-ops.ts` / `requestIntroAction` — reject if seeker `emailVerifiedAt` is null (`error: "Verify your email first."`)
- Modify: `pt-crm/src/app/portal/(app)/layout.tsx` or find page — if logged-in seeker unverified and path is `/portal/find`, redirect to `/portal/verify`

**Interfaces:**

```ts
export async function requestSeekerVerifyAction(): Promise<
  { ok: true } | { ok: false; error: string }
>;
export async function verifySeekerEmailAction(input: {
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

Both require `requireSeekerSession()`. Issue challenge for `session.email`, `sendEmail({ to: session.email, ...mailSeekerVerify(...) })`. If not delivered and production, return `{ ok: false, error: "Email is not configured" }`. On consume success, `markSeekerEmailVerified(session.email)`.

- [ ] **Step 1:** Extend `test-mail-verify.ts` with `mailSeekerVerify` asserts (code in body, category).

- [ ] **Step 2: Implement** as above. `toPublic` and session types must include `emailVerifiedAt` if UI needs it; otherwise read from DB in the layout.

- [ ] **Step 3:** `npm run typecheck`. Do not run PGlite smokes if dev is up.

- [ ] **Step 4: Commit** `feat: require seekers to verify email before Find intros`

---

### Task 4: Verify trainer emails

**Files:**
- Modify: `pt-crm/src/lib/auth.ts` — `createUserAndSignIn` leaves `emailVerifiedAt` null; export `markUserEmailVerified(userId: string)` and `isUserEmailVerified(userId: string)`
- Modify: `pt-crm/src/app/actions/auth.ts` — after successful solo/studio register, still redirect `/` but also fire-and-forget issue+send verify (or redirect `/verify-email?setup=1`). **Redirect to `/verify-email?setup=1`** after register.
- Create: `pt-crm/src/app/verify-email/page.tsx`
- Modify: `pt-crm/src/app/actions/marketplace-trainer.ts` `saveMarketplaceListingAction` — if `published` and `!await isUserEmailVerified(session.userId)`, return `{ ok: false, error: "Verify your email before publishing your card." }`
- Modify: `pt-crm/src/lib/auth.ts` `createOrgInvite` — same check, error `"Verify your email before inviting teammates."`
- Modify: `pt-crm/src/app/(app)/settings/page.tsx` or shell — if unverified, banner with link to `/verify-email`

**Interfaces:**

```ts
export async function requestTrainerVerifyAction(): Promise<
  { ok: true } | { ok: false; error: string }
>;
export async function verifyTrainerEmailAction(input: {
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }>;
```

Use `requireSession()`, purpose `"trainer_verify"`, `mailTrainerVerify`.

Invite-accept register (`acceptInviteRegister`) **does not** require prior verification — opening the emailed invite **is** proof. Set `emailVerifiedAt` on that new user.

- [ ] **Step 1:** Copy tests for `mailTrainerVerify`.

- [ ] **Step 2: Implement.**

- [ ] **Step 3:** `npm run typecheck`.

- [ ] **Step 4: Commit** `feat: require trainers to verify email before publish and invites`

---

### Task 5: Send org invite emails

**Files:**
- Modify: `pt-crm/src/lib/auth.ts` `createOrgInvite` — after insert, `sendEmail({ to: email, ...mailOrgInvite({ orgName, role, inviteUrl }) })` where `inviteUrl = ${APP_URL.replace(/\/$/, "")}/invite/${token}`. If production and `!delivered`, still return the token (copy-link backup) plus `emailed: false`.
- Modify: `createOrgInvite` return type to `{ token: string; emailed: boolean }` (keep `token` so the settings panel still copies).
- Modify: `pt-crm/src/components/settings-team-panel.tsx` — if `res.emailed`, show “Invite sent to {email}”. Always keep the copy-link.

**Interfaces:**
- `APP_URL` already used for public links. Fallback `https://floorscribe.com` only if unset — prefer `process.env.APP_URL`.

- [ ] **Step 1:** Assert `mailOrgInvite` includes URL (already in Task 2). Add a unit assert that `emailed` is boolean if you extract a tiny helper:

```ts
export function inviteAbsoluteUrl(token: string, appUrl = process.env.APP_URL): string {
  const base = (appUrl || "https://floorscribe.com").replace(/\/$/, "");
  return `${base}/invite/${token}`;
}
```

- [ ] **Step 2: Implement send in `createOrgInvite`.**

- [ ] **Step 3:** `npm run typecheck`.

- [ ] **Step 4: Commit** `feat: email studio invites through Mailtrap`

---

### Task 6: Docs, deploy env, verification smoke

**Files:**
- Modify: `pt-crm/DEPLOY.md` — Mailtrap required for live OTP/verify/invites; env names only (no tokens).
- Modify: `pt-crm/.env.example` — already has Mailtrap keys; add a one-line note that verification emails use the same token.
- Modify: `pt-crm/scripts/test-mail-verify.ts` — keep all copy + challenge tests.
- Modify: `pt-crm/docs/STATUS.md` — one line: mail verify SCHEMA 27.

- [ ] **Step 1:** Run (dev server **stopped**):

```bash
cd pt-crm
npm run typecheck
npm run smoke:mail-verify
npm run smoke:portal-auth
npm run smoke:site-copy
```

Expected: all exit 0.

- [ ] **Step 2: Commit** `docs: record Mailtrap email verification`

---

## Verification (whole plan)

Browser after deploy:
- New seeker register → verify page → Mailtrap inbox → Find allowed.
- Unverified seeker intro rejected.
- New trainer register → verify page → cannot publish card until code.
- Settings → invite → recipient gets Mailtrap email with `/invite/...`.
- Jane OTP still attaches studio and marks seeker verified.
- `pt@demo.local` still signs in (seed verified).

## Review mapping

| Need | Task |
| --- | --- |
| SCHEMA + challenge primitive | 1 |
| One copy source; intro/OTP use it | 2 |
| Seeker inbox proof | 3 |
| Trainer inbox proof (publish/invite) | 4 |
| Invite actually emailed | 5 |
| Docs / smokes | 6 |
| Password reset | Out of scope |
