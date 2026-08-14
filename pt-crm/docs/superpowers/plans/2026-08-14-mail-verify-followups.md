# Mail-verify follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the five leftover holes from SCHEMA 27 email verification without adding password reset or new mail providers.

**Architecture:** Keep `emailVerifiedAt` as the only verified flag. Opening an emailed invite proves the inbox for existing users too. Changing a trainer email clears that flag. Verify pages send a code only when the user clicks Send/Resend. Invite links in mail and in Settings both come from `inviteAbsoluteUrl`.

**Tech Stack:** Existing FloorScribe Next.js 16 + PGlite; no SCHEMA bump.

## Global Constraints

- Brand is FloorScribe only.
- Never commit Mailtrap tokens or other secrets.
- No SCHEMA_VERSION bump. No new tables.
- No password reset. No `mailtrap` npm package.
- Do not block trainer CRM login.
- Demo login stays `pt@demo.local` / `trainer123`.
- Do not run `smoke:portal` / `smoke:marketplace` while `npm run dev` holds PGlite.
- Covering tests: `npm run smoke:mail-verify` and `npm run typecheck` from `pt-crm`.

## Out of scope

- Password reset.
- CRM comms log / WhatsApp send.
- Ops backups / compose memory limits.
- Stripe Connect take-rate.

## File map

| File | Change |
| --- | --- |
| `src/db/seed.ts` | Backfill `pt@demo.local` if `emailVerifiedAt` is null |
| `src/lib/auth.ts` | Mark verified on `acceptInviteExistingUser`; clear on email change |
| `src/app/portal/verify/seeker-verify-form.tsx` | Remove mount auto-send |
| `src/app/verify-email/trainer-verify-form.tsx` | Remove mount auto-send |
| `src/lib/mail-copy.ts` | Tests already cover `inviteAbsoluteUrl` |
| `src/components/settings-team-panel.tsx` | Copy-link uses `inviteAbsoluteUrl` |
| `scripts/test-mail-verify.ts` | Asserts for URL helper + copy |

---

### Task 1: Demo backfill and existing-user invite proof

**Files:**
- Modify: `pt-crm/src/db/seed.ts`
- Modify: `pt-crm/src/lib/auth.ts` (`acceptInviteExistingUser`)
- Modify: `pt-crm/scripts/test-mail-verify.ts` only if you extract a tiny helper; otherwise typecheck is the gate

**Interfaces:**
- Consumes: existing `markUserEmailVerified(userId: string)`
- After `acceptInviteExistingUser` succeeds (both already-member and newly-joined), call `await markUserEmailVerified(session.userId)` before session switch.

- [ ] **Step 1: Backfill in seed**

In `seedIfNeeded`, after the early-return when already seeded (the `if (already)` branch that only seeds library/playbooks), add:

```ts
await db
  .update(users)
  .set({ emailVerifiedAt: new Date(), updatedAt: new Date() })
  .where(
    and(eq(users.email, "pt@demo.local"), isNull(users.emailVerifiedAt))
  );
```

Import `and`, `eq`, `isNull` from drizzle-orm if not already in that file.

- [ ] **Step 2: Existing invite accept**

At the end of `acceptInviteExistingUser`, before `buildSessionForUserInOrg`:

```ts
await markUserEmailVerified(session.userId);
```

(Opening the emailed invite is inbox proof, same as `acceptInviteRegister`.)

- [ ] **Step 3:** `npm run typecheck`

- [ ] **Step 4: Commit** `fix: backfill demo verify and mark existing invite accept`

---

### Task 2: Clear verification when trainer email changes

**Files:**
- Modify: `pt-crm/src/lib/auth.ts` `updateUserProfile`

**Interfaces:**
- If `normalizeEmail(email) !== normalizeEmail(user.email)`, set `emailVerifiedAt: null` in the same update.

```ts
const emailChanged = normalizeEmail(email) !== normalizeEmail(user.email);
await db
  .update(users)
  .set({
    name,
    email,
    phone,
    title,
    updatedAt: new Date(),
    ...(emailChanged ? { emailVerifiedAt: null } : {}),
  })
  .where(eq(users.id, session.userId));
```

`user` is already loaded for the password check when email changes. If the current function only loads `user` inside the `if (email changed)` password block, keep that load and use it here. Do not clear the flag when the email is unchanged (case-only normalize so `Pt@Demo.local` vs `pt@demo.local` is not a change after normalize).

- [ ] **Step 1: Implement** the spread above.

- [ ] **Step 2:** `npm run typecheck`

- [ ] **Step 3: Commit** `fix: clear trainer emailVerifiedAt when email changes`

---

### Task 3: Send verify codes only on click

**Files:**
- Modify: `pt-crm/src/app/portal/verify/seeker-verify-form.tsx`
- Modify: `pt-crm/src/app/verify-email/trainer-verify-form.tsx`

**Interfaces:**
- Delete the `useEffect` that calls `request*VerifyAction` on mount.
- Delete `sent` ref if unused.
- Keep `resend()` / a primary **Send code** button that calls the same action.
- Initial copy: “Enter the 6-digit code after you tap Send code.” Do not auto-send.

Seeker form: rename or keep `resend` as the send button label `Send code` when `!msg`, `Resend code` after a successful send.

Trainer form: same.

- [ ] **Step 1: Remove both mount effects.**

- [ ] **Step 2:** `npm run typecheck`

- [ ] **Step 3: Commit** `fix: send email verify codes only when the user asks`

---

### Task 4: One invite URL everywhere

**Files:**
- Modify: `pt-crm/src/components/settings-team-panel.tsx`
- Modify: `pt-crm/scripts/test-mail-verify.ts`

**Interfaces:**
- Stop building copy-link from `window.location.origin`.
- Use `inviteAbsoluteUrl(token)` from `@/lib/mail-copy` for the displayed/copied URL (same helper the email uses).
- Remove the `origin` state and the `invitePath` helper if nothing else needs them.

Add to `test-mail-verify.ts` (sync, no PGlite):

```ts
assert.equal(
  inviteAbsoluteUrl("tok_abc", "https://floorscribe.com/"),
  "https://floorscribe.com/invite/tok_abc"
);
assert.equal(
  inviteAbsoluteUrl("tok_abc", undefined),
  "https://floorscribe.com/invite/tok_abc"
);
```

(Keep existing asserts; do not duplicate if already present.)

- [ ] **Step 1: Add/keep URL asserts, run `npm run smoke:mail-verify`** (PGlite free) plus `npm run typecheck`.

- [ ] **Step 2: Wire the panel to `inviteAbsoluteUrl`.**

- [ ] **Step 3:** `npm run typecheck`

- [ ] **Step 4: Commit** `fix: use APP_URL for copied studio invite links`

---

## Verification

```bash
cd pt-crm
npm run typecheck
npm run smoke:mail-verify
npm run smoke:portal-auth
```

Browser: already-seeded `pt@demo.local` can publish/invite after a restart (backfill). Changing Settings email requires verify again. Verify pages do not send until Send code. Copied invite URL matches the emailed URL on production (`https://floorscribe.com/invite/...`).
