# FloorScribe marketing redesign

**Date:** 2026-08-08  
**Status:** Approved for implementation (Approach A + calm brand + new imagery)

## Goals

1. **Convert** more trainers (primary success metric: register starts).
2. **Equal dual path:** solo PT and studio owner both first-class in the hero.
3. **Primary CTA:** Create account (solo / studio). Sign in secondary. Demo soft-mentioned only.
4. **Brand:** calm studio professional — not sports-tech neon emerald.

## Non-goals

- Multi-page site (Product / Pricing) in this pass.
- Public demo as hero primary.
- Light-mode marketing theme.
- Full product screenshot tour with exact UI chrome (use refined HTML mock instead).

## Brand system

| Token | Value |
|--------|--------|
| Canvas | Warm near-black charcoal |
| Surface | Slightly lifted warm panels, hairline borders |
| Text | Cream / off-white headlines; warm muted gray body |
| Accent | Soft sage (muted green-gray) for CTAs and focus rings |
| Signal | Soft amber only inside product mock badges |
| Motion | Subdued reveal; honor `prefers-reduced-motion` |
| Imagery | Calm boutique **gym** stills (racks, dumbbells, PT floor) — not empty rooms; desaturated warm grade |

### Copy voice

Quiet confidence. Short sentences. Avoid uppercase micro-label spam. Tagline direction: *For trainers who run the day.*

## Page architecture (Approach A)

Single route: `/marketing` (and `/` when logged out).

1. **Header** — mark, short tagline, nav: Day · Paths · Start; Sign in + Get started.
2. **Hero** — calm studio hero image; headline; dual cards:
   - **Solo practice** → `/register/solo`
   - **Studio / team** → `/register/studio`
   Soft line: sign in or explore the day board below.
3. **Problem** — mess (notes, sheets, money in head) vs board (today, sticky client, needs you) — one calm still-life / strip image.
4. **Day** — three steps only: Open today → Train & complete → Keep the week moving.
5. **Proof strip** — four quiet capability lines (floor log, packs, bookings, team) — not a 9-card dump. Optional accordion “More capabilities” for deep bullets (YAGNI: skip accordion if it bloats; keep 4 chips).
6. **Start CTA** — dual register again + sign in; short checklist.
7. **Footer** — brand, nav, GitHub, medical disclaimer.

## Components

| Unit | Role |
|------|------|
| `marketing/layout.tsx` | Metadata, sage selection, warm canvas |
| `marketing-header.tsx` | Sticky header, section observer, sage active state |
| `marketing/page.tsx` | New section structure, dual path cards, day steps, HTML floor mock |
| `public/marketing/*` | New generated hero / desk / studio stills (replace prior abstract art) |
| `globals.css` | Keep reveal utilities; retune `.mkt-card` hover to sage/warm |

## Imagery assets

Generate new JPGs (no private IPs/secrets; no real-person likenesses required):

| File | Use |
|------|-----|
| `hero-calm.jpg` | Hero background |
| `desk-calm.jpg` | Problem / still-life section |
| `studio-calm.jpg` | Optional band under Day or Start |
| `paths-calm.jpg` | Optional dual-path visual support |

Legacy abstract JPGs may remain on disk but stop being referenced.

## Implementation notes

- Prefer Tailwind utilities aligned with sage (`emerald` may remain for app shell; marketing can use custom sage classes or emerald-800/700 muted tones + stone/zinc warm).
- Floor mock stays HTML (no AI text in image).
- Touch targets min 44px; skip link retained.
- Do not hardcode private LAN IPs or deploy secrets.

## Success criteria

- Hero presents **both** register paths without forcing a chooser intermediate page.
- Page is **shorter** than the previous feature-dump scroll.
- Brand reads calm / studio, not neon gym tech.
- New imagery is wired and loads with `next/image`.
- `tsc` clean for touched files.
