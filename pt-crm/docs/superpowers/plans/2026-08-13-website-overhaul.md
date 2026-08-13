# Public Website Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the public FloorScribe website (logged-out `/`, `/marketing`, `/find`, `/login`, `/register`, `/portal/login`) describe the product we actually shipped — floor OS plus programs, client portal, and Find a trainer — without turning the homepage into a marketplace.

**Architecture:** One copy/nav module is the source of truth. Marketing, Find, trainer auth, and portal login all render the same public header/footer so they read as one site. The marketing page stays a single route; new feature content is extra sections and proof cards, not a Product/Pricing microsite. No schema changes. No CRM/logger restyle.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind, existing `tsx` smoke scripts (no Jest). Verify with `npx tsx scripts/test-site-copy.ts`, `npx tsc --noEmit`, and Chrome on `http://127.0.0.1:4000`.

## Global Constraints

- Workspace app root: `pt-crm/` (all paths below are relative to it).
- Floor OS is the homepage hero. Find a trainer and the client portal are sidecars — never the primary CTA.
- Primary trainer CTAs stay `/register/solo` and `/register/studio`. Sign in is secondary (`/login`).
- Keep the 2026-08-08 brand: calm studio, warm charcoal `#141210`, cream headlines, muted sage/emerald CTAs, existing `/public/marketing/*-calm.jpg` stills. Do not generate new photographs in this plan.
- Do not add `/pricing`, `/product`, or a light-theme marketing site.
- Do not restyle the logged-in app shell (`src/app/(app)/**`).
- Do not change marketplace ranking, portal OTP, or program-builder logic.
- Copy must stay honest: FloorScribe introduces seekers; session payments stay with the trainer; no medical diagnosis claims.
- No private LXC IPs, live secrets, or `.env` values in docs or commits.
- Touch targets stay `min-h-11` (44px). Honor `prefers-reduced-motion` (existing `.mkt-*` utilities).
- Local commits only inside `pt-crm/` files. Push later with `git subtree push --prefix=pt-crm floorscribe main`.

## Why one plan

Marketing, Find, trainer login, and portal login already share one hostname and already link to each other — but they look like three products (stone marketing, zinc find, bare portal). Splitting “copy”, “find chrome”, and “auth chrome” into separate plans would ship a homepage that promises features the other public pages still hide. One plan, seven tasks, each shippable.

## Out of this plan

- Logged-in Today / Clients / Programs / Settings visual rewrite
- New marketing photography
- Stripe Connect, reviews, in-app chat
- Multi-page Product / Pricing site
- Changing intro fees, featured checkout, or schema

## File map

| File | Responsibility |
|------|----------------|
| **Create** `src/lib/site/copy.ts` | Public taglines, nav, audiences, proof pillars, disclaimers |
| **Create** `scripts/test-site-copy.ts` | Invariant tests so the site cannot forget Floor-first or new features |
| **Create** `src/components/public-site-header.tsx` | Shared public header (client) |
| **Create** `src/components/public-site-footer.tsx` | Shared public footer |
| **Modify** `src/components/marketing-header.tsx` | Compose public header + in-page section observer |
| **Modify** `src/app/marketing/page.tsx` | New sections: programs, portal, find, audience doors |
| **Modify** `src/app/marketing/layout.tsx` | Metadata that mentions the full product |
| **Modify** `src/components/find-chrome.tsx` | Use public header (seeker session still server-side) |
| **Modify** `src/app/find/layout.tsx` | Marketing canvas + footer |
| **Modify** `src/app/find/page.tsx` | Metadata + page title aligned with site copy |
| **Modify** `src/components/auth-shell.tsx` | Public header/footer; warm canvas |
| **Modify** `src/app/login/page.tsx` | Cross-links to portal + find |
| **Modify** `src/app/register/page.tsx` | Subtitle from site copy |
| **Modify** `src/app/portal/login/page.tsx` | Same chrome; trainer + find links |
| **Modify** `src/app/find/login/page.tsx` | Labels from site copy |
| **Modify** `src/app/find/register/page.tsx` | Labels from site copy |
| **Modify** `src/app/layout.tsx` | Root default description |
| **Modify** `package.json` | `smoke:site-copy` |
| **Modify** `docs/marketing-brief.md` | Site map + pillars match shipped product |
| **Modify** `docs/STATUS.md` | Website overhaul note |

---

### Task 1: Public site copy module + invariant tests

**Files:**
- Create: `src/lib/site/copy.ts`
- Create: `scripts/test-site-copy.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `SITE_COPY`, `PUBLIC_NAV`, `TRAINER_SECTION_NAV`, `FEATURE_PILLARS`, `AUDIENCE_DOORS`, `DAY_STEPS`, `START_STEPS`, `SITE_DISCLAIMERS` exported from `src/lib/site/copy.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-site-copy.ts`:

```ts
import assert from "node:assert/strict";
import {
  AUDIENCE_DOORS,
  DAY_STEPS,
  FEATURE_PILLARS,
  PUBLIC_NAV,
  SITE_COPY,
  SITE_DISCLAIMERS,
  START_STEPS,
  TRAINER_SECTION_NAV,
} from "../src/lib/site/copy";

function hrefs(items: { href: string }[]) {
  return items.map((i) => i.href);
}

assert.equal(SITE_COPY.productName, "FloorScribe");
assert.match(SITE_COPY.tagline, /run the day/i);
assert.match(SITE_COPY.heroBody, /session/i);
assert.doesNotMatch(SITE_COPY.heroBody, /find a trainer first/i);

assert.deepEqual(hrefs(PUBLIC_NAV), [
  "/marketing",
  "/find",
  "/portal/login",
]);
assert.equal(SITE_COPY.primaryCta.href, "/register");
assert.equal(SITE_COPY.soloCta.href, "/register/solo");
assert.equal(SITE_COPY.studioCta.href, "/register/studio");
assert.equal(SITE_COPY.signInCta.href, "/login");

const pillarTitles = FEATURE_PILLARS.map((p) => p.title);
assert.ok(pillarTitles.includes("Session log"));
assert.ok(pillarTitles.includes("Session packs"));
assert.ok(pillarTitles.includes("Bookings"));
assert.ok(pillarTitles.includes("Programs"));
assert.ok(pillarTitles.includes("Client portal"));
assert.ok(pillarTitles.includes("Find a trainer"));
assert.equal(FEATURE_PILLARS.length, 6);

const program = FEATURE_PILLARS.find((p) => p.title === "Programs");
assert.match(program!.body, /auto-design|program/i);
const portal = FEATURE_PILLARS.find((p) => p.title === "Client portal");
assert.match(portal!.body, /one-time code|assigned/i);
const find = FEATURE_PILLARS.find((p) => p.title === "Find a trainer");
assert.match(find!.body, /intro/i);
assert.doesNotMatch(find!.body, /stripe connect/i);

assert.equal(AUDIENCE_DOORS.length, 3);
assert.equal(AUDIENCE_DOORS[0].href, "/register");
assert.equal(AUDIENCE_DOORS[1].href, "/portal/login");
assert.equal(AUDIENCE_DOORS[2].href, "/find");
assert.equal(AUDIENCE_DOORS[0].audience, "trainer");

assert.equal(DAY_STEPS.length, 3);
assert.equal(START_STEPS.length, 4);
assert.ok(START_STEPS[0].toLowerCase().includes("account"));

assert.deepEqual(hrefs(TRAINER_SECTION_NAV), [
  "#how",
  "#included",
  "#doors",
  "#start",
]);

assert.match(SITE_DISCLAIMERS.medical, /does not diagnose/i);
assert.match(SITE_DISCLAIMERS.findIntro, /introduces you/i);
assert.match(SITE_DISCLAIMERS.findIntro, /session payments are between you and the trainer/i);

assert.doesNotMatch(JSON.stringify(SITE_COPY), /franchise erp/i);
assert.doesNotMatch(JSON.stringify(FEATURE_PILLARS), /card payment network/i);

console.log("site-copy ok");
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `cd pt-crm; npx tsx scripts/test-site-copy.ts`

Expected: FAIL with `Cannot find module '../src/lib/site/copy'`

- [ ] **Step 3: Write the copy module**

Create `src/lib/site/copy.ts`:

```ts
export type PublicAudience = "trainer" | "seeker" | "client";

export const SITE_COPY = {
  productName: "FloorScribe",
  tagline: "Run the day. Not the paperwork.",
  oneLiner: "Floor OS for personal trainers — sessions, packs, programs, and the follow-through.",
  heroEyebrow: "For personal trainers — solo or with a small team",
  heroBody:
    "FloorScribe keeps the floor log, packs, bookings, programs, and simple invoices together so you can stay with the client instead of juggling tabs.",
  primaryCta: { href: "/register", label: "Create account" },
  soloCta: { href: "/register/solo", label: "Start solo" },
  studioCta: { href: "/register/studio", label: "Start a studio" },
  signInCta: { href: "/login", label: "Sign in" },
  findCta: { href: "/find", label: "Find a trainer" },
  portalCta: { href: "/portal/login", label: "Client portal" },
  marketingHome: { href: "/marketing", label: "For trainers" },
} as const;

export const PUBLIC_NAV = [
  { href: "/marketing", label: "For trainers", audience: "trainer" as const },
  { href: "/find", label: "Find a trainer", audience: "seeker" as const },
  { href: "/portal/login", label: "Client portal", audience: "client" as const },
] as const;

export const TRAINER_SECTION_NAV = [
  { href: "#how", id: "how", label: "How it works" },
  { href: "#included", id: "included", label: "What's included" },
  { href: "#doors", id: "doors", label: "Who it's for" },
  { href: "#start", id: "start", label: "Get started" },
] as const;

export const FEATURE_PILLARS = [
  {
    title: "Session log",
    body: "Weight, reps, RPE, and cues between sets — without opening a spreadsheet.",
  },
  {
    title: "Session packs",
    body: "Finishing a session uses a pack credit. See what is left before they walk in.",
  },
  {
    title: "Bookings",
    body: "Schedule from the client, see the week on the calendar, start the session from the booking.",
  },
  {
    title: "Programs",
    body: "Design a week from screens and equipment. Auto-design uses NSCA/ACSM-minded rules you can still edit.",
  },
  {
    title: "Client portal",
    body: "Assigned clients sign in with a one-time code to see their plan, progress, and invoices. Not a public social app.",
  },
  {
    title: "Find a trainer",
    body: "People search by named area or gym and send an intro. You accept into the CRM. FloorScribe introduces; session pay stays with you.",
  },
] as const;

export const AUDIENCE_DOORS = [
  {
    audience: "trainer" as const,
    title: "I am a trainer",
    body: "Run Today, log sessions, design programs, and keep packs and bookings on the same board.",
    href: "/register",
    cta: "Create a trainer account",
  },
  {
    audience: "client" as const,
    title: "I already train with someone",
    body: "If your trainer uses FloorScribe, sign in with the email they have on file. We send a one-time code.",
    href: "/portal/login",
    cta: "Open client portal",
  },
  {
    audience: "seeker" as const,
    title: "I am looking for a trainer",
    body: "Search by area or gym, read credentials and rates, and request an intro. Training payments are with the trainer.",
    href: "/find",
    cta: "Find a trainer",
  },
] as const;

export const DAY_STEPS = [
  {
    t: "See the day",
    d: "Open Today and you know who you are training, what is booked, and what still needs you.",
  },
  {
    t: "Train on the floor",
    d: "Log sets, RPE, and cues. When you finish, the pack count updates with the session.",
  },
  {
    t: "Keep the week moving",
    d: "Rebook, send a check-in, or mark an invoice. Design the next block when the current one is done.",
  },
] as const;

export const START_STEPS = [
  "Create a solo or studio account",
  "Add a client and open Today",
  "Log a session — packs stay in sync",
  "Publish a trainer card or invite the client to the portal when you are ready",
] as const;

export const SITE_DISCLAIMERS = {
  medical:
    "FloorScribe provides coaching support tools for qualified personal trainers. It does not diagnose medical conditions. Refer red-flag symptoms to appropriate clinicians.",
  findIntro:
    "FloorScribe introduces you. Training and session payments are between you and the trainer.",
} as const;
```

- [ ] **Step 4: Wire the npm script and run the test**

In `package.json` scripts, add after `smoke:marketplace`:

```json
"smoke:site-copy": "tsx scripts/test-site-copy.ts",
```

Run: `cd pt-crm; npx tsx scripts/test-site-copy.ts`

Expected: `site-copy ok` and exit 0.

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/lib/site/copy.ts pt-crm/scripts/test-site-copy.ts pt-crm/package.json
git commit -m "test: lock public site copy so marketing cannot drop shipped features"
```

---

### Task 2: Shared public header and footer

**Files:**
- Create: `src/components/public-site-header.tsx`
- Create: `src/components/public-site-footer.tsx`
- Modify: `src/components/marketing-header.tsx`

**Interfaces:**
- Consumes: `PUBLIC_NAV`, `SITE_COPY`, `TRAINER_SECTION_NAV` from `src/lib/site/copy.ts`
- Produces: `PublicSiteHeader(props: PublicSiteHeaderProps)` and `PublicSiteFooter()`

- [ ] **Step 1: Extend the copy test so chrome cannot drop nav items**

Append to `scripts/test-site-copy.ts` before `console.log`:

```ts
assert.equal(PUBLIC_NAV[0].label, "For trainers");
assert.equal(PUBLIC_NAV[1].label, "Find a trainer");
assert.equal(PUBLIC_NAV[2].label, "Client portal");
assert.equal(SITE_COPY.primaryCta.label, "Create account");
assert.equal(SITE_COPY.signInCta.label, "Sign in");
```

Run: `npx tsx scripts/test-site-copy.ts`

Expected: PASS (labels already exist from Task 1).

- [ ] **Step 2: Create the header**

Create `src/components/public-site-header.tsx`. Seeker logout is a server action — do not invent `/find/logout`. Find pages pass a `trailing` slot (Task 4).

```tsx
"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PUBLIC_NAV, SITE_COPY } from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

const btnPrimarySm =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-800 px-3.5 py-2 text-sm font-semibold text-stone-50 shadow-sm shadow-black/25 transition hover:bg-emerald-700 active:bg-emerald-800";

export type PublicSiteHeaderProps = {
  variant: "marketing" | "find" | "auth" | "portal";
  scrolled?: boolean;
  sectionNav?: readonly { href: string; id: string; label: string }[];
  activeSectionId?: string;
  trailing?: ReactNode;
};

export function PublicSiteHeader(props: PublicSiteHeaderProps) {
  const isFind = props.variant === "find";
  const isPortal = props.variant === "portal";
  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b transition-[background-color,border-color,box-shadow] duration-300 motion-reduce:transition-none",
        props.scrolled
          ? "border-stone-800/80 bg-[#141210]/96 shadow-lg shadow-black/20 backdrop-blur-md"
          : "border-transparent bg-[#141210]/55 backdrop-blur-md"
      )}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <BrandMark href="/marketing" size="md" className="text-emerald-600" />
          <span className="hidden h-4 w-px bg-stone-800/90 sm:block" aria-hidden />
          <span className="hidden truncate text-[11px] font-medium text-stone-500 sm:inline">
            {SITE_COPY.oneLiner}
          </span>
        </div>
        <nav className="hidden items-center gap-0.5 md:flex" aria-label="Site">
          {PUBLIC_NAV.map((item) => {
            const current =
              (item.audience === "seeker" && isFind) ||
              (item.audience === "client" && isPortal) ||
              (item.audience === "trainer" && props.variant === "marketing");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex min-h-10 items-center rounded-lg px-3 text-sm transition",
                  linkFocus,
                  current
                    ? "bg-emerald-950/45 font-medium text-emerald-500"
                    : "text-stone-400 hover:bg-stone-900/60 hover:text-stone-100"
                )}
                aria-current={current ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {props.trailing ?? (
            <>
              <Link
                href={SITE_COPY.signInCta.href}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-medium text-stone-400 hover:text-stone-100",
                  linkFocus
                )}
              >
                {SITE_COPY.signInCta.label}
              </Link>
              <Link
                href={SITE_COPY.primaryCta.href}
                className={cn(btnPrimarySm, linkFocus)}
              >
                {SITE_COPY.primaryCta.label}
              </Link>
            </>
          )}
        </div>
      </div>
      {props.sectionNav && props.sectionNav.length > 0 ? (
        <nav
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto border-t border-stone-900/70 px-3 py-2 md:hidden"
          aria-label="On this page"
        >
          {props.sectionNav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-full border px-3.5 text-[11px] font-medium",
                linkFocus,
                props.activeSectionId === item.id
                  ? "border-emerald-800/55 bg-emerald-950/45 text-emerald-400"
                  : "border-stone-800/80 text-stone-400"
              )}
            >
              {item.label}
            </a>
          ))}
        </nav>
      ) : (
        <nav
          className="flex gap-2 overflow-x-auto border-t border-stone-900/70 px-3 py-2 md:hidden"
          aria-label="Site"
        >
          {PUBLIC_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex min-h-9 shrink-0 items-center rounded-full border border-stone-800/80 px-3.5 text-[11px] font-medium text-stone-400",
                linkFocus
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
```

- [ ] **Step 3: Create the footer**

Create `src/components/public-site-footer.tsx`:

```tsx
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { PUBLIC_NAV, SITE_COPY, SITE_DISCLAIMERS } from "@/lib/site/copy";
import { cn } from "@/lib/utils";

const linkFocus =
  "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#141210]";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-stone-800/70">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <BrandMark href="/marketing" className="text-emerald-600" />
            <p className="mt-2.5 text-xs leading-relaxed text-stone-500">
              {SITE_COPY.oneLiner}
            </p>
            <a
              href="https://floorscribe.com"
              className={cn(
                "mt-3 inline-flex min-h-9 items-center text-xs font-medium text-stone-500 hover:text-emerald-600",
                linkFocus
              )}
            >
              floorscribe.com
            </a>
          </div>
          <nav className="flex flex-wrap gap-x-1 text-xs text-stone-500" aria-label="Footer">
            {PUBLIC_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn("inline-flex min-h-10 items-center px-2.5 hover:text-stone-300", linkFocus)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={SITE_COPY.signInCta.href}
              className={cn("inline-flex min-h-10 items-center px-2.5 hover:text-stone-300", linkFocus)}
            >
              {SITE_COPY.signInCta.label}
            </Link>
            <Link
              href={SITE_COPY.primaryCta.href}
              className={cn(
                "inline-flex min-h-10 items-center px-2.5 font-medium text-emerald-600 hover:text-emerald-500",
                linkFocus
              )}
            >
              {SITE_COPY.primaryCta.label}
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-stone-900/90 pt-5">
          <p className="text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
            {SITE_DISCLAIMERS.medical}
          </p>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-stone-600 sm:text-left">
            {SITE_DISCLAIMERS.findIntro}
          </p>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 4: Point marketing header at the shared header**

Replace the header markup in `src/components/marketing-header.tsx` so it still observes `#how`, `#included`, `#start`, and now also `#doors`, then renders:

```tsx
import { PublicSiteHeader } from "@/components/public-site-header";
import { TRAINER_SECTION_NAV } from "@/lib/site/copy";

// keep the existing IntersectionObserver, but observe TRAINER_SECTION_NAV ids
return (
  <PublicSiteHeader
    variant="marketing"
    scrolled={scrolled}
    sectionNav={TRAINER_SECTION_NAV}
    activeSectionId={active}
  />
);
```

Delete the old inline `<header>` tree from this file (BrandMark, Find a trainer, Client, Sign in, Create account, mobile chips). Keep only observer state + `PublicSiteHeader`.

Change `NAV` in this file to `TRAINER_SECTION_NAV` so `#doors` is observed after Task 3 adds that section. Until Task 3 lands, missing `#doors` is fine — `getElementById` returns null and is filtered out.

- [ ] **Step 5: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add pt-crm/src/components/public-site-header.tsx pt-crm/src/components/public-site-footer.tsx pt-crm/src/components/marketing-header.tsx pt-crm/scripts/test-site-copy.ts
git commit -m "feat: share one public header and footer across the FloorScribe site"
```

---

### Task 3: Rewrite the marketing page to include shipped features

**Files:**
- Modify: `src/app/marketing/page.tsx`
- Modify: `src/app/marketing/layout.tsx`

**Interfaces:**
- Consumes: `SITE_COPY`, `FEATURE_PILLARS`, `AUDIENCE_DOORS`, `DAY_STEPS`, `START_STEPS`, `TRAINER_SECTION_NAV` from `src/lib/site/copy.ts`; `MarketingHeader`; `PublicSiteFooter`
- Produces: Single `/marketing` page with ids `how`, `included`, `doors`, `start`

- [ ] **Step 1: Add a structure assertion to the copy test**

Append to `scripts/test-site-copy.ts`:

```ts
assert.ok(FEATURE_PILLARS.every((p) => p.body.length > 40 && p.body.length < 220));
assert.ok(AUDIENCE_DOORS.every((d) => d.cta.length > 0 && d.href.startsWith("/")));
assert.equal(AUDIENCE_DOORS[0].href, SITE_COPY.primaryCta.href);
```

Run: `npx tsx scripts/test-site-copy.ts`

Expected: PASS.

- [ ] **Step 2: Update marketing metadata**

In `src/app/marketing/layout.tsx`, set:

```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://floorscribe.com"),
  title: "FloorScribe — run the day, not the paperwork",
  description:
    "Floor OS for personal trainers: session logs, packs, bookings, programs, a client portal, and Find a trainer. Solo or a small studio.",
  alternates: { canonical: "https://floorscribe.com" },
  openGraph: {
    title: "FloorScribe — run the day, not the paperwork",
    description:
      "The floor log, packs, programs, and follow-through in one place. Clients can open a portal. People looking for a PT can request an intro.",
    type: "website",
    url: "https://floorscribe.com",
    siteName: "FloorScribe",
    images: [{ url: "/marketing/hero-calm.jpg", width: 1920, height: 1080 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FloorScribe — run the day, not the paperwork",
    description:
      "Session logs, packs, programs, client portal, and Find a trainer — for personal trainers.",
    images: ["/marketing/hero-calm.jpg"],
  },
};
```

Keep the existing `viewport` export unchanged.

- [ ] **Step 3: Rewrite `src/app/marketing/page.tsx` to consume site copy**

Keep the existing hero image, `FloorMock`, `PathCard`, skip link, `MarketingScrollProgress`, and `MarketingHeader`. Replace hardcoded `NAV`, `DAY`, `PROOF`, and `START_STEPS` constants with imports from `@/lib/site/copy`.

Required page structure after the hero (do not delete the dual solo/studio path cards):

1. Hero — `SITE_COPY.tagline` as the h1 (`Run the day.` + `Not the paperwork.` can stay split). `SITE_COPY.heroBody` as the paragraph. Soft line under the path cards:

```tsx
<p className="mt-4 text-xs text-stone-500">
  Already have an account?{" "}
  <Link href={SITE_COPY.signInCta.href}>Sign in</Link>
  {" · "}
  <Link href={SITE_COPY.findCta.href}>Find a trainer</Link>
  {" · "}
  <Link href={SITE_COPY.portalCta.href}>Client portal</Link>
</p>
```

2. Problem (`id="how"`) — keep scatter vs board. Add one sentence that programs and invoices live on the same client, not in another tab.

3. Day (`id="day"`) — map `DAY_STEPS` (still three cards). Keep `studio-calm.jpg`.

4. What's included (`id="included"`) — map `FEATURE_PILLARS` in a `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (six cards). Use `Dumbbell` (or `ClipboardList`) from `lucide-react` for Programs, `KeyRound` for Client portal, `MapPin` for Find a trainer, and keep Timer / Package / CalendarDays for the first three. Do not invent a seventh card.

5. Who it's for (`id="doors"`) — three `AUDIENCE_DOORS` cards. Trainer card uses `btnPrimary` styling; the other two use border cards. Each card is a `Link` to `door.href`.

6. Get started (`id="start"`) — `START_STEPS` checklist + `SITE_COPY.soloCta` / `studioCta` / `signInCta`.

7. Replace the local `<footer>` with `<PublicSiteFooter />`.

Hero h1 must remain trainer-facing. Do **not** put “Find a trainer” in the h1.

Icon map to add at the top of the file:

```ts
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  KeyRound,
  MapPin,
  Package,
  Timer,
  User,
} from "lucide-react";
import { PublicSiteFooter } from "@/components/public-site-footer";
import {
  AUDIENCE_DOORS,
  DAY_STEPS,
  FEATURE_PILLARS,
  SITE_COPY,
  START_STEPS,
} from "@/lib/site/copy";

const PILLAR_ICONS = {
  "Session log": Timer,
  "Session packs": Package,
  Bookings: CalendarDays,
  Programs: ClipboardList,
  "Client portal": KeyRound,
  "Find a trainer": MapPin,
} as const;
```

- [ ] **Step 4: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Manual render check (dev server)**

Run: `cd pt-crm; npm run dev` if not already on `http://127.0.0.1:4000`.

Open `/marketing` logged out. Confirm:

- H1 is still “Run the day / Not the paperwork”
- Six included cards: Session log, Session packs, Bookings, Programs, Client portal, Find a trainer
- `#doors` has three links: `/register`, `/portal/login`, `/find`
- Header has For trainers, Find a trainer, Client portal, Sign in, Create account
- Footer repeats those links plus both disclaimers

- [ ] **Step 6: Commit**

```bash
git add pt-crm/src/app/marketing/page.tsx pt-crm/src/app/marketing/layout.tsx pt-crm/scripts/test-site-copy.ts
git commit -m "feat: restyle marketing to include programs, portal, and find without moving the hero"
```

---

### Task 4: Find chrome uses the public site shell

**Files:**
- Modify: `src/components/find-chrome.tsx`
- Modify: `src/app/find/layout.tsx`
- Modify: `src/app/find/page.tsx`
- Modify: `src/app/find/[profileId]/page.tsx` (disclaimer string only)

**Interfaces:**
- Consumes: `PublicSiteHeader`, `PublicSiteFooter`, `SITE_COPY`, `SITE_DISCLAIMERS`
- Produces: `/find` looks like the same website as `/marketing`

- [ ] **Step 1: Write a copy assertion Find pages must honor**

Append to `scripts/test-site-copy.ts`:

```ts
assert.equal(SITE_COPY.findCta.href, "/find");
assert.match(SITE_DISCLAIMERS.findIntro, /FloorScribe introduces you/);
```

Run: `npx tsx scripts/test-site-copy.ts`

Expected: PASS.

- [ ] **Step 2: Rebuild FindChrome around PublicSiteHeader**

Replace `src/components/find-chrome.tsx` with:

```tsx
import Link from "next/link";
import { logoutSeekerAction } from "@/app/actions/marketplace-seeker";
import { PublicSiteHeader } from "@/components/public-site-header";
import { optionalSeekerSession } from "@/lib/seeker-auth";
import { SITE_COPY } from "@/lib/site/copy";

export async function FindChrome() {
  const seeker = await optionalSeekerSession();
  return (
    <PublicSiteHeader
      variant="find"
      scrolled
      trailing={
        seeker ? (
          <div className="flex items-center gap-2">
            <Link
              href="/find/account"
              className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-200 hover:text-white"
            >
              {seeker.firstName} · Account
            </Link>
            <form action={logoutSeekerAction}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-500 hover:text-stone-300"
              >
                Log out
              </button>
            </form>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/find/login"
              className="inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm text-stone-300 hover:text-white"
            >
              Log in
            </Link>
            <Link
              href="/find/register"
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-800 px-3.5 text-sm font-semibold text-stone-50"
            >
              Create account
            </Link>
          </div>
        )
      }
    />
  );
}
```

Note: seeker “Create account” points at `/find/register`, not `/register`. Trainer “Create account” in the default header still points at `SITE_COPY.primaryCta.href` (`/register`). That split is required.

- [ ] **Step 3: Wrap Find in the marketing canvas + footer**

Replace `src/app/find/layout.tsx`:

```tsx
import { FindChrome } from "@/components/find-chrome";
import { PublicSiteFooter } from "@/components/public-site-footer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Find a trainer",
  description:
    "Search FloorScribe trainers by area or gym and request an intro. Training and session payments are with the trainer.",
};

export default async function FindLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <FindChrome />
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
      <PublicSiteFooter />
    </div>
  );
}
```

- [ ] **Step 4: Align Find page eyebrow copy**

In `src/app/find/page.tsx`, replace the eyebrow / intro paragraph with:

```tsx
<p className="text-xs uppercase tracking-wide text-zinc-500">
  {SITE_COPY.findCta.label}
</p>
<h1 className="text-2xl font-semibold">Train near you or at your gym</h1>
<p className="mt-2 text-sm text-zinc-400">{SITE_DISCLAIMERS.findIntro}</p>
```

Import `SITE_COPY` and `SITE_DISCLAIMERS` from `@/lib/site/copy`.

On `src/app/find/[profileId]/page.tsx`, if a hard-coded intro sentence exists, replace it with `{SITE_DISCLAIMERS.findIntro}` so search and profile cannot drift.

- [ ] **Step 5: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 6: Browser check**

Open `http://127.0.0.1:4000/find` and `http://127.0.0.1:4000/find/mp_demo_alex`.

Confirm:

- Header matches marketing (same mark, For trainers / Find a trainer / Client portal)
- Seeker Log in / Create account still go to `/find/login` and `/find/register`
- Footer present
- Alex card still lists NCSF-CPT, Tampines, rates (do not break search)

- [ ] **Step 7: Commit**

```bash
git add pt-crm/src/components/find-chrome.tsx pt-crm/src/app/find/layout.tsx pt-crm/src/app/find/page.tsx pt-crm/src/app/find/[profileId]/page.tsx
git commit -m "feat: put Find a trainer on the same public site chrome as marketing"
```

---

### Task 5: Trainer auth and client portal join the same site

**Files:**
- Modify: `src/components/auth-shell.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `src/app/register/page.tsx`
- Modify: `src/app/portal/login/page.tsx`
- Modify: `src/app/find/login/page.tsx`
- Modify: `src/app/find/register/page.tsx`

**Interfaces:**
- Consumes: `PublicSiteHeader`, `PublicSiteFooter`, `SITE_COPY`, `AUDIENCE_DOORS`
- Produces: `/login`, `/register`, `/portal/login`, `/find/login` share header/footer and honest cross-links

- [ ] **Step 1: Add cross-link assertions**

Append to `scripts/test-site-copy.ts`:

```ts
assert.equal(AUDIENCE_DOORS[1].href, "/portal/login");
assert.equal(SITE_COPY.signInCta.href, "/login");
assert.notEqual(SITE_COPY.primaryCta.href, "/find/register");
```

Run: `npx tsx scripts/test-site-copy.ts`

Expected: PASS.

- [ ] **Step 2: Wrap AuthShell with public chrome**

Replace `src/components/auth-shell.tsx`:

```tsx
import type { ReactNode } from "react";
import Link from "next/link";
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY } from "@/lib/site/copy";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <PublicSiteHeader variant="auth" scrolled />
      <div className="relative mx-auto flex max-w-md flex-col px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-50">
          {title}
        </h1>
        <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        {footer}
        <p className="mt-8 text-center text-xs text-stone-600">
          Looking for a trainer?{" "}
          <Link href={SITE_COPY.findCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.findCta.label}
          </Link>
          {" · "}
          Already a client?{" "}
          <Link href={SITE_COPY.portalCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.portalCta.label}
          </Link>
        </p>
      </div>
      <PublicSiteFooter />
    </div>
  );
}
```

Remove the old radial-gradient zinc backdrop and the BrandMark chip — the shared header now carries the mark. Keep `min-h-11` on inputs (unchanged on the login form).

- [ ] **Step 3: Point login and register at site copy**

In `src/app/login/page.tsx`:

- Change subtitle (when not invite) to `SITE_COPY.oneLiner`
- Keep the existing “New trainer?” link to `/register`
- Keep the demo hint (`pt@demo.local` / `trainer123`) behind `NODE_ENV !== "production"`

In `src/app/register/page.tsx`:

- Title stays “How will you use FloorScribe?”
- Subtitle: `SITE_COPY.heroEyebrow`

- [ ] **Step 4: Portal login chrome**

Replace the outer wrapper of `src/app/portal/login/page.tsx` with:

```tsx
import { PublicSiteFooter } from "@/components/public-site-footer";
import { PublicSiteHeader } from "@/components/public-site-header";
import { SITE_COPY, SITE_DISCLAIMERS } from "@/lib/site/copy";
import { PortalLoginForm } from "@/components/portal/portal-login-form";

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return (
    <div className="min-h-dvh bg-[#141210] text-stone-100">
      <PublicSiteHeader variant="portal" scrolled />
      <div className="mx-auto flex max-w-md flex-col px-4 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">
          {SITE_COPY.portalCta.label}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Sign in to your plan
        </h1>
        <p className="mt-2 text-sm text-stone-400">
          We email a one-time code. No password. If you train at more than one
          studio, you will pick which one.
        </p>
        <div className="mt-6">
          <PortalLoginForm redirectTo={redirectTo} />
        </div>
        <p className="mt-8 text-center text-xs text-stone-600">
          Trainer?{" "}
          <a href={SITE_COPY.signInCta.href} className="text-emerald-500 hover:underline">
            Staff login
          </a>
          {" · "}
          Looking for a trainer?{" "}
          <a href={SITE_COPY.findCta.href} className="text-emerald-500 hover:underline">
            {SITE_COPY.findCta.label}
          </a>
        </p>
        <p className="mt-4 text-center text-[11px] text-stone-600">
          {SITE_DISCLAIMERS.findIntro}
        </p>
      </div>
      <PublicSiteFooter />
    </div>
  );
}
```

Do not change `PortalLoginForm` or OTP actions.

- [ ] **Step 5: Find login/register headings**

In `src/app/find/login/page.tsx` replace the eyebrow “Client account” with `{SITE_COPY.findCta.label}` and add a line under the form:

```tsx
<p className="text-xs text-zinc-500">
  Trainer? <Link href="/login">Staff login</Link>
  {" · "}
  Assigned client? <Link href="/portal/login">Client portal</Link>
</p>
```

In `src/app/find/register/page.tsx` do the same eyebrow + cross-links. Do not change `registerSeekerAction` fields.

- [ ] **Step 6: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 7: Browser check**

Open `/login`, `/register`, `/portal/login`, `/find/login`.

Confirm:

- Same header mark and public nav
- Trainer login still posts to `loginAction` and can sign in as `pt@demo.local` / `trainer123`
- Portal login still shows the OTP form (do not have to complete OTP)
- Find login still signs Riley in if a seeker session exists
- No console errors

- [ ] **Step 8: Commit**

```bash
git add pt-crm/src/components/auth-shell.tsx pt-crm/src/app/login/page.tsx pt-crm/src/app/register/page.tsx pt-crm/src/app/portal/login/page.tsx pt-crm/src/app/find/login/page.tsx pt-crm/src/app/find/register/page.tsx
git commit -m "feat: unify trainer, seeker, and portal entry pages on one public site"
```

---

### Task 6: Root metadata and document titles

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/find/account/page.tsx` (title only, if missing)
- Modify: `src/app/portal/layout.tsx` (title only, if generic)

**Interfaces:**
- Consumes: `SITE_COPY.oneLiner`
- Produces: Default `<title>` / description that match the overhaul

- [ ] **Step 1: Fail a description check if the root blurb is still floor-only**

Append to `scripts/test-site-copy.ts`:

```ts
assert.match(SITE_COPY.oneLiner, /programs/i);
assert.match(SITE_COPY.oneLiner, /session/i);
```

Run: `npx tsx scripts/test-site-copy.ts`

Expected: PASS (`oneLiner` already includes programs from Task 1).

- [ ] **Step 2: Update root metadata**

In `src/app/layout.tsx`:

```ts
import { SITE_COPY } from "@/lib/site/copy";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || "https://floorscribe.com"),
  title: {
    default: SITE_COPY.productName,
    template: `%s · ${SITE_COPY.productName}`,
  },
  description: SITE_COPY.oneLiner,
  applicationName: SITE_COPY.productName,
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};
```

- [ ] **Step 3: Add missing page titles**

If `src/app/find/account/page.tsx` has no `export const metadata`, add:

```ts
export const metadata = { title: "Your profile" };
```

If `src/app/portal/layout.tsx` has a vague title, set `title: { default: "Client portal" }`.

If `src/app/portal/login/page.tsx` has no metadata, add:

```ts
export const metadata = { title: "Client portal" };
```

- [ ] **Step 4: Typecheck**

Run: `cd pt-crm; npx tsc --noEmit`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pt-crm/src/app/layout.tsx pt-crm/src/app/find/account/page.tsx pt-crm/src/app/portal/layout.tsx pt-crm/src/app/portal/login/page.tsx
git commit -m "feat: align default site metadata with the shipped FloorScribe product"
```

---

### Task 7: Docs + Chrome verification

**Files:**
- Modify: `docs/marketing-brief.md`
- Modify: `docs/STATUS.md`

**Interfaces:**
- Consumes: the shipped site map from Tasks 3–6
- Produces: docs that no longer say FloorScribe is “not client-facing”

- [ ] **Step 1: Rewrite `docs/marketing-brief.md`**

Replace the file with:

```md
# FloorScribe — marketing brief

## Positioning

**One-liner:** Floor OS for personal trainers — run the day, not the paperwork.

**Audience (primary):** Solo / micro-studio PTs who train on the floor and still need packs, programs, bookings, and money tracking.

**Audience (sidecar):** Assigned clients (`/portal`) and people looking for a PT (`/find`).

**Not:** Franchise ERP or a card-payment network for session packs (session pay stays with the trainer).

## Message pillars

1. **Floor first** — Today board, sticky client, one primary CTA.
2. **Spine not bloat** — packs, bookings, check-ins, invoices next to the log.
3. **Programs you can edit** — Auto-design is a starting week, not a black box.
4. **Sidecars stay sidecars** — portal is assigned-client OTP; Find is intros into the CRM.

## Site map

| Route | Role |
|-------|------|
| `/` (logged out) | Rewrites to marketing landing |
| `/marketing` | Canonical product site (trainers) |
| `/login` · `/register` | Trainer entry |
| `/` (logged in) | Floor command board |
| `/find` | Public trainer search |
| `/portal/login` | Assigned-client OTP |

## Landing sections

1. Hero — dual solo / studio register; Find and portal are soft links
2. Scatter vs one board
3. A normal day (three steps)
4. What's included (six pillars: log, packs, bookings, programs, portal, find)
5. Who it's for (trainer / assigned client / looking for a PT)
6. Get started CTA

## CTAs

- Primary: **Create account** → `/register` (solo + studio cards in the hero)
- Secondary: **Sign in** → `/login`
- Sidecar: **Find a trainer** → `/find`
- Sidecar: **Client portal** → `/portal/login`

## Voice

Short, floor-confident, no medical claims. Calm charcoal + sage/emerald. Shared public header/footer on every logged-out surface.
```

- [ ] **Step 2: Update STATUS**

In `docs/STATUS.md`:

- Change the “Public marketing site” row (around the “What’s built” marketing line) to: **Done (overhauled 2026-08-13)** — six pillars, audience doors, shared public chrome.
- Add a dated changelog line:

```
| 2026-08-13 | Public website overhaul: marketing + find + auth + portal share one chrome; copy covers programs, portal, and Find. |
```

- [ ] **Step 3: Run automated checks**

Run:

```
cd pt-crm
npx tsx scripts/test-site-copy.ts
npx tsc --noEmit
```

Expected: both exit 0.

- [ ] **Step 4: Chrome DevTools pass (required before calling this done)**

Use Chrome against `http://127.0.0.1:4000` (not `localhost` — cookies differ). Logged-out first, then seeker, then trainer.

| URL | Must see | Must not see |
|-----|----------|--------------|
| `/marketing` | Dual register cards; 6 pillars including Programs / Client portal / Find a trainer; `#doors` three links | Find as the H1; Stripe Connect; console errors |
| `/find` | Same header; Alex card if listing is visible; footer disclaimers | Trainer CRM sidebar |
| `/find/mp_demo_alex` | Credentials, area, rates, intro form, intro disclaimer | Lat/lng fields |
| `/login` | Site header; trainer form; links to find + portal | Seeker password form as the only path |
| `/register` | Solo + studio chooser | Marketplace-only copy |
| `/portal/login` | OTP form; Staff login + Find links | Trainer pack editor |
| `/` logged-in trainer | Unchanged Today board | Marketing header |

Also check `/marketing` at a 390px-wide viewport: header chips scroll, path cards stack, all CTAs stay ≥44px tall.

If Alex is missing on `/find`, that is unpaid intro fees hiding the listing (existing product rule) — not a website-overhaul failure. Confirm on `/settings` rather than changing ranking.

- [ ] **Step 5: Commit**

```bash
git add pt-crm/docs/marketing-brief.md pt-crm/docs/STATUS.md
git commit -m "docs: update marketing brief and STATUS for the public site overhaul"
```

---

## Self-review

**1. Spec coverage**

| Requirement | Task |
|-------------|------|
| Homepage still Floor-first | Task 3 hero + Task 1 assertions |
| Programs appear on the public site | Task 1 pillars + Task 3 included grid |
| Client portal explained and linked | Task 1 doors + Tasks 3 and 5 |
| Find a trainer explained and linked | Task 1 doors + Tasks 3 and 4 |
| One visual site, not three skins | Tasks 2, 4, 5 |
| Metadata matches the product | Task 6 |
| Docs stop saying “no client apps” | Task 7 |
| No CRM restyle / no schema / no pricing page | Global constraints + out-of-plan |

**2. Placeholder scan**

No TBD, “implement later”, or “similar to Task N” steps. Header seeker-logout is a `trailing` slot, not a fake `/find/logout` route.

**3. Type consistency**

- `SITE_COPY.primaryCta.href` is `/register` everywhere.
- Seeker register stays `/find/register` (Task 4 trailing slot only).
- `TRAINER_SECTION_NAV` ids: `how`, `included`, `doors`, `start`.
- `FEATURE_PILLARS` length is 6; titles are the icon-map keys in Task 3.
- `AUDIENCE_DOORS[0].href === SITE_COPY.primaryCta.href`.
