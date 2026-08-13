# FloorScribe — product & structure status

**Living record** for humans and agents: what exists, what doesn’t, and what to do next.  
Update this file when a slice ships or scope changes — don’t let it go stale.

| | |
|--|--|
| **Last audited** | 2026-08-13 |
| **Product** | FloorScribe (repo folder `pt-crm/`) |
| **GitHub** | [CyberoniOntoni/floorscribe](https://github.com/CyberoniOntoni/floorscribe) `main` |
| **Live** | https://floorscribe.com (self-host LXC + Docker; private IP not for public docs) |
| **Schema** | `SCHEMA_VERSION` **25** (18 pack debit · 19 smarter gen · 20–21 portal · 22–25 find/seeker/areas/trainer card) |
| **Stack** | Next.js 16 App Router · TypeScript · Tailwind · PGlite + Drizzle · multi-tenant org |
| **Demo** | `pt@demo.local` / `trainer123` |

**Related docs**

| Doc | Role |
|-----|------|
| [happy-path.md](./happy-path.md) | Day-in-the-life trainer loop |
| [pilot-readiness.md](./pilot-readiness.md) | Local pilot go/no-go |
| [crm-product-vision.md](./crm-product-vision.md) | Strategy & CRM phases A/B/C |
| [design-system.md](./design-system.md) | UI density / floor vs desk |
| [DEPLOY.md](../DEPLOY.md) | LXC / Docker deploy |
| [README.md](../README.md) | Quick start |

---

## 1. Product identity (north star)

**Floor OS for freelance / studio personal trainers** — floor-first, not portal-first or marketplace-first.

| Priority | Layer |
|----------|--------|
| 1 | **Floor** — start, log, complete sessions under gym noise |
| 2 | **Plans** — editable programs + progression, enough to run next session |
| 3 | **CRM spine** — stage, pack, book, task, invoice, check-in |
| Sidecar | Coach + knowledge (assist, never the home hero) |
| Sidecar | **Client portal** (`/portal`) — assigned clients, OTP |
| Sidecar | **Find a trainer** (`/find`) — seeker accounts, named areas, trainer cards, intros → CRM leads |

**North-star metric:** sessions logged per trainer per week.

---

## 2. Information architecture (nav)

Four primary areas (`src/lib/nav.ts`):

| Area | Route | What’s under it |
|------|--------|-----------------|
| **Today** | `/` | Day board: sticky client, resume, Needs you, Agenda, Coach (collapsed), pilot onboarding |
| **People** | `/clients` | Clients list + pipeline; **Calendar** `/calendar`; **Intros** `/intros` |
| **Plans** | `/programs` | Programs + design wizard; **Sessions** list `/sessions` |
| **Studio** | `/studio` | Hub → Library, Knowledge, Coach history, Settings |

**Other surfaces (not top-level peers)**

| Route | Role |
|-------|------|
| `/sessions/[id]` | Full-screen floor logger |
| `/clients/[id]` | Client desk (CRM + progress + timeline) |
| `/login`, `/register/*`, `/invite/[token]` | Auth |
| `/marketing`, `/` (logged out) | Marketing site |
| `/portal/*` | Assigned-client OTP sidecar |
| `/find`, `/find/register`, `/find/login`, `/find/account`, `/find/[id]` | Public find + seeker account |
| `/intros` | Trainer intro inbox |
| `/api/health` | Health check |
| `/api/stripe/platform-webhook` | Platform Checkout paid |

---

## 3. What’s built (done)

### 3.1 Auth & multi-tenant

| Capability | Status | Notes |
|------------|--------|--------|
| Login / session cookie | **Done** | `AUTH_SECRET` required in production; portal/seeker: `CLIENT_AUTH_SECRET` required in production |
| Solo registration | **Done** | `/register/solo` |
| Studio registration | **Done** | `/register/studio` |
| Team invites | **Done** | Settings → Team; roles; 14-day token |
| Org-scoped data | **Done** | Tenant guards on actions |
| Multi-trainer RBAC depth | **Partial** | Roles exist; not a full permission matrix product |

### 3.2 Floor OS (sessions)

| Capability | Status | Notes |
|------------|--------|--------|
| Start / resume session | **Done** | From Today, client, program day, booking |
| Set logging (reps, load, RPE, pain) | **Done** | Schemes: straight, pyramid, drop, EMOM, etc. |
| Rest timer / keyboard shortcuts | **Done** | Floor-first UX |
| Offline draft behavior | **Done** | Client-side draft patterns |
| Complete session | **Done** | Pack burn when active pack; close-loop CTAs |
| Summary share / copy | **Done** | Close loop |
| Book next from complete | **Done** | |
| Mid-session **Add exercise** | **Done** | Bank; not on plan until promote |
| **Add to plan** (promote) | **Done** | After complete / program-day sessions |
| Progression tips (last session) | **Done** | Double progression + high-RPE hold |
| Link booking ↔ session | **Done** | Start from appointment |

### 3.3 Programs / programming

| Capability | Status | Notes |
|------------|--------|--------|
| Design wizard (goal, days, constraints) | **Done** | Preview + save; RAMP warm-up + cool-down layered on days |
| Session prep science (warm-up / cool-down) | **Done** | `session-prep.ts` — raise/activate/mobilize/(potentiate) + downshift/lengthen; badges in program + floor |
| Exercise order / prioritization | **Done** | `exercise-order.ts` — warm-up→power→primary compounds (bench before OHP)→secondary→isolation→cool-down; builder + desk append re-sort |
| **Build from scratch** + save for later | **Done** | Split layouts (FB/UL/PPL/blank), day preview, save-for-later mode, build checklist on detail |
| Add / rename / remove day | **Done** | Max 6 days; empty-day primary CTAs; keep bank open while stacking |
| Program detail edit (sets/reps/RPE/rest/scheme) | **Done** | |
| Swap exercise + substitution rank | **Done** | Constraints-aware |
| **Add exercise** per day (no full regen) | **Done** | Phase C desk |
| Coach **append_exercise** | **Done** | Phase C coach Apply |
| Mesocycle W1–W6 apply / advance / auto | **Done** | Baseline prescriptions |
| Insert assessment correctives | **Done** | Client-linked |
| Regen day / full program | **Done** | |
| **Plan balance** (weekly sets, push:pull, time est.) | **Done** | `program-science.ts` |
| **Fill next** pattern chips | **Done** | MEV / antagonist gaps |
| Goal+pattern append defaults + science rest | **Done** | |
| Drag reorder exercises | **Done** | Desk day list; mid-day insert still later |
| Multi-exercise invent from desk append | **Not done** | Append = straight only |
| Progression write-back into program targets | **Not done** | Floor tips only |
| Google Calendar / external sync | **Not done** | Deferred |

### 3.4 CRM / business spine

| Capability | Status | Notes |
|------------|--------|--------|
| Client stage (lead/active/paused + deactivate) | **Done** | Vision Phase A |
| Sticky client chip | **Done** | Cross-page |
| Packages (enroll, remaining, renew, cancel) | **Done** | Vision Phase B |
| Pack debit on **floor complete** and **calendar complete** | **Done** | Shared debit when linked, or unique same-day unlinked pair; Reopen completed booking restores stamp |
| Appointments (book, no-show, cancel, complete) | **Done** | Calendar + client desk |
| Calendar month + in-calendar book + billing | **Done** | Pack / invoice / none |
| Tasks / follow-ups → Needs you | **Done** | Vision Phase A |
| Manual invoices (create, paid, void) | **Done** | No cards/tax |
| Check-ins + templates (copy for WhatsApp) | **Done** | No send |
| Client timeline merge | **Done** | Sessions, bookings, tasks, invoices, etc. |
| Desk IA polish (bookings→pack→invoices…) | **Done** | HIG density pass |
| Real WhatsApp/SMS/email send | **Not done** | Vision CRM Phase C |
| Communication log table product UI | **Not done** | Schema may have notes/check-ins only |
| Card payments / Stripe | **Partial** | Platform Checkout for intro/featured fees. Trainer pack cards not done |
| Tax / receipts | **Not done** | Deferred |
| Client portal / companion app | **Done** | `/portal` OTP sidecar (SCHEMA 20–21) |

### 3.9 Marketplace / Find a trainer

| Capability | Status | Notes |
|------------|--------|--------|
| Public `/find` search | **Done** | Named area + gym + network (SCHEMA 22–24) |
| Seeker register / login | **Done** | Password account, not trainer `users` (23) |
| Named areas | **Done** | Bedok, Tampines, Orchard, … — no client lat/lng (24) |
| Self measurements + progress | **Done** | Account + trainer-logged if email matches |
| Intro → CRM lead | **Done** | People → Intros; 3 free then USD 19 |
| Trainer card | **Done** | Credentials, area, gyms, specialties, hourly + session (25) |
| Featured listing | **Done** | USD 29 / 30 days, platform Stripe |
| Stripe Connect take-rate | **Not done** | Follow-up |
| Reviews / gym-operator claims | **Not done** | Follow-up |

### 3.5 Library, assessments, progress

| Capability | Status | Notes |
|------------|--------|--------|
| Exercise bank + equipment gate | **Done** | Org equipment inventory |
| Pattern labels + science blurbs | **Done** | Library headers, picker |
| Assessments + correctives | **Done** | Templates + client results |
| Measurements / progress strip | **Done** | Client progress |
| Progress share text | **Done** | |

### 3.6 Coach & knowledge

| Capability | Status | Notes |
|------------|--------|--------|
| Rule-based coach (no API key) | **Done** | Playbook retrieval |
| Optional xAI / LLM coach | **Done** | Env `XAI_API_KEY` — often off on LXC |
| Apply mutates (correctives, meso, append) | **Done** | Latest bubble only for re-Apply |
| Knowledge browser + NCSF-ish playbooks | **Done** | Studio → Knowledge |
| Coach history | **Done** | Studio → history |

### 3.7 Marketing & product site

| Capability | Status | Notes |
|------------|--------|--------|
| Public marketing site | **Done (overhauled 2026-08-13)** | six pillars, audience doors, shared public chrome |
| Create account CTAs | **Done** | |
| Self-host copy stripped from public footer | **Done** | No public GitHub / IP leak |

### 3.8 Ops / deploy

| Capability | Status | Notes |
|------------|--------|--------|
| Docker Compose + Dockerfile | **Done** | Port 4000→3000 |
| `scripts/deploy_lxc.py` (env-only secrets) | **Done** | Banner timeout for slow SSH |
| PGlite volume backup helpers | **Done** | Host + Windows scripts |
| CI/CD auto-deploy | **Not done** | Manual deploy/push |
| Build images off-box (CI → pull only) | **Not done** | Builds on LXC today |
| Compose memory limits | **Not done** | Optional hardening |
| Scheduled backups on LXC | **Not done** | Manual / scripts exist |

---

## 4. Data model (high level)

```
Org → Membership → User
Org → Client
  ├─ Packages, Appointments, Invoices, Tasks, Check-ins, Notes
  ├─ Measurements, Assessments
  ├─ Program → Days → Exercises
  └─ TrainingSession → ExerciseLogs (+ optional package_id, appointment link)
Org → Equipment, Exercises (bank), Playbooks
```

**No separate Postgres server** for MVP — embedded **PGlite** in a Docker volume.

---

## 5. Phase map (two “Phase C”s — don’t confuse)

| Track | Name | Status |
|-------|------|--------|
| **Floor Phase A** | Floor daily polish | **Shipped** (logger, close loop, booking link) |
| **CRM Phase A** | Stage, tasks, appointments, timeline | **Shipped** |
| **CRM Phase B** | Packages, invoices, pack burn | **Shipped** |
| **Programs Phase C** | Smarter programs (append, coach append) | **Shipped** |
| **Programs polish** | Plan balance, science rest, fill chips, DP tips | **Shipped** (2026-08-08) |
| **CRM Phase C** | Comms log, real send, consent productization | **Not started** |
| **Marketplace** | Find, seeker accounts, named areas, trainer card | **Shipped** (SCHEMA 22–25; Connect take-rate later) |
| **Vision later** | Stripe Connect session take-rate, reviews, gym-operator claims | **Deferred** |

---

## 6. Gaps & risks (honest)

| Gap | Severity | Why it matters |
|-----|----------|----------------|
| **No real pilot week logged** | High | Features exist; retention unproven |
| **LXC undersized / thrash history** | Med | 1 GiB was too tight; confirm current RAM after your fix |
| **Build on LXC** | Med | `compose up --build` spikes RAM/CPU; SSH banner lag under load |
| **LLM coach off in prod** | Low | Rule-based works; optional key not required for pilot |
| **No automated backups on host** | Med | Scripts exist; schedule not installed |
| **No card payments** | Low for pilot | Manual invoices only |
| **Comms still “copy template”** | Med | Trainers live in WhatsApp — log is thin vs vision |
| **Program drag-reorder** | Low | Power users will want it |
| **Monorepo noise** | Low | Parent `Gork` has unrelated deleted ncsf/web paths — floorscribe is subtree |

---

## 7. What to do next (recommended order)

Use this as the shared backlog. Check items off in place; add dates when done.

### P0 — Prove the pilot (this week)

- [ ] **Real trainer day on live or local** using [pilot-readiness.md](./pilot-readiness.md) go/no-go table  
- [ ] Confirm LXC **≥2 GiB RAM**, health stable, no thrash after deploys  
- [ ] One **PGlite backup** on host after real data exists (`backup-host` / volume zip)  
- [ ] Optional: set `XAI_API_KEY` on LXC if LLM coach wanted  

### P1 — Friction from pilot (only what the week surfaces)

Typical candidates (pick from pain, don’t pre-build all):

- [ ] Booking / pack / invoice edge cases  
- [ ] Floor logger speed or confusing CTAs  
- [ ] Program “Fill next” / balance noise or missing reorder  
- [ ] Onboarding empty-state clarity  

### P2 — CRM Comms (vision Phase C)

- [ ] Communication log on client (direction, channel, snippet, date)  
- [ ] Templates stay; optional “logged” after copy  
- [ ] Consent / marketing flags if needed for trust  

### P3 — Hardening & ops

- [ ] `docker builder prune` after deploys or off-box image build  
- [ ] Compose `mem_limit` + `NODE_OPTIONS` on app  
- [ ] Cron host backup → off-box copy  
- [ ] Commit hygiene: only `pt-crm` subtree to floorscribe (never secrets/IPs)  

### P4 — Product depth (after retention)

- [ ] Program drag-reorder / mid-day insert  
- [ ] Progression write-back into program targets  
- [ ] Deeper multi-trainer RBAC  
- [ ] Stripe Connect take-rate on first pack for marketplace-sourced clients  
- [ ] Reviews / gym-operator claimed facilities  

---

## 8. How we work on this codebase

| Rule | Detail |
|------|--------|
| **Push** | `git subtree push --prefix=pt-crm floorscribe main` from monorepo root (or push from floorscribe clone) |
| **Deploy** | Env-only `FLOORSCRIBE_DEPLOY_*` + `python scripts/deploy_lxc.py` |
| **Verify** | `npm run typecheck` · `smoke:programming` · `smoke:portal` · `smoke:marketplace` · `smoke:pilot` · `/api/health` |
| **Schema** | Bump `SCHEMA_VERSION` in `src/db/index.ts` when migrations change; restart app |
| **Secrets** | Never commit passwords, `AUTH_SECRET` / `CLIENT_AUTH_SECRET` (both required in production), or private LXC IPs into the public repo |
| **Scope** | Session/plan/CRM first; knowledge & analytics stay secondary |

---

## 9. Smoke / verify cheatsheet

```bash
cd pt-crm
npm run typecheck
npm run smoke
npm run smoke:pilot
npm run smoke:programming
npm run smoke:portal
npm run smoke:marketplace
npm run smoke:floor
npm run smoke:library
curl -s https://floorscribe.com/api/health
```

Browser: [happy-path.md](./happy-path.md) checklist at the bottom.

---

## 10. Changelog of this status file

| Date | Note |
|------|------|
| 2026-08-13 | Review remediation: featuredDays export gone; intro-fee Pay + mock complete; portal pre-auth no PII; hashOtp fail-closed; calendar Done does not debit packs; audience-aware public footer. `AUTH_SECRET` + `CLIENT_AUTH_SECRET` both required in production. |
| 2026-08-13 | Public website overhaul: marketing + find + auth + portal share one chrome; copy covers programs, portal, and Find. |
| 2026-08-08 | Initial audit after programs science polish + LXC deploy (`a977bbb` / local `4d4fa35`) |
| 2026-08-08 | Build from scratch + save-for-later drafts (unassigned templates) |
| 2026-08-10 | Pre-pilot review (7 high fixes), SCHEMA 17 indexes, CI, DnD reorder |
| 2026-08-13 | Portal polish: HMAC OTP, case-insensitive email, onboarding finish, program cache read, next-session window, smoke exit 0 (SCHEMA 21) |
| 2026-08-13 | Trainer card: credentials, named area, specialties, hourly + session rates (SCHEMA 25) |
| 2026-08-13 | Named areas (Bedok/Tampines/Orchard catalog); no client lat/lng (SCHEMA 24) |
| 2026-08-13 | Seeker register/login, measurements, gym/network prefs (SCHEMA 23) |
| 2026-08-13 | Find a trainer (`/find`) + intros → CRM leads + platform Checkout fees; SCHEMA 22 |
| 2026-08-13 | Client portal v1 (`/portal`) OTP login, onboarding signatures, read-only program/progress/billing; SCHEMA 20. |
| 2026-08-13 | Smarter generator (SCHEMA 19): deficiency rules from real assessment keys + measurements, Meso 1 phase, rotated safety-gated correctives |
| 2026-08-13 | Same-day unique unlinked pair shares debit; Reopen completed booking restores pack; consume race retry |
| 2026-08-11 | Shared pack debit (floor+calendar, linked no double burn); FINDING-08/09/10/13 pilot closes |
| 2026-08-08 | Programs list polish: Saved for later section, empty-state entry CTAs, happy-path order/prep note |

---

## 11. Progress log (this build arc)

What landed in-repo (not all pushed to GitHub):

1. **Pack debit (SCHEMA 18)** — floor + calendar share a debit key; same-day unlinked pair; cancel/reopen restore; React #441 start-session result.
2. **Smarter Auto-design (19)** — real assessment keys, equipment Home/Combined, primary-lift swaps, NSCA/ACSM rest, novice schemes, Schoenfeld frequency, same-day squat+hinge volume.
3. **Client portal (20–21)** — `/portal` OTP (HMAC), onboarding signatures, read-only program/progress/billing; isolated `client_session`; partial unique org+email.
4. **Find a trainer (22)** — public `/find`, gyms, intros → CRM leads, platform Checkout (3 free intros then USD 19; featured USD 29).
5. **Seeker accounts (23)** — `/find/register` + `/find/login`, persistent profile, optional measurements, gym/network prefs.
6. **Named areas (24)** — Bedok, Tampines, Orchard, and catalog; clients never type coordinates.
7. **Trainer card (25)** — Settings: credentials, area, gyms, specialties, hourly + session rates; public cards show the same.

**Not shipped:** Stripe Connect take-rate, reviews, gym-operator claims, live SES, trainer pack card payments.

---

## 12. One-line summary

**FloorScribe is pilot-ready for a single trainer** (floor + packs + programs + science Auto-design) **and** has a shipped sidecar marketplace (`/find` + seeker accounts + trainer cards + intros). **Next: a real trainer week (and one seeker→intro→lead loop), then fix what hurts. Connect take-rate stays later.**
