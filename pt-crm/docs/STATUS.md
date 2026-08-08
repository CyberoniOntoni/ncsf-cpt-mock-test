# FloorScribe — product & structure status

**Living record** for humans and agents: what exists, what doesn’t, and what to do next.  
Update this file when a slice ships or scope changes — don’t let it go stale.

| | |
|--|--|
| **Last audited** | 2026-08-08 |
| **Product** | FloorScribe (repo folder `pt-crm/`) |
| **GitHub** | [CyberoniOntoni/floorscribe](https://github.com/CyberoniOntoni/floorscribe) `main` |
| **Live** | https://floorscribe.com (self-host LXC + Docker; private IP not for public docs) |
| **Schema** | `SCHEMA_VERSION` **16** (`training_sessions.package_id`) |
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

**Floor OS for freelance / studio personal trainers** — not a client portal, not a pure program studio, not AI-chat-first.

| Priority | Layer |
|----------|--------|
| 1 | **Floor** — start, log, complete sessions under gym noise |
| 2 | **Plans** — editable programs + progression, enough to run next session |
| 3 | **CRM spine** — stage, pack, book, task, invoice, check-in |
| Sidecar | Coach + knowledge (assist, never the home hero) |

**North-star metric:** sessions logged per trainer per week.

---

## 2. Information architecture (nav)

Four primary areas (`src/lib/nav.ts`):

| Area | Route | What’s under it |
|------|--------|-----------------|
| **Today** | `/` | Day board: sticky client, resume, Needs you, Agenda, Coach (collapsed), pilot onboarding |
| **People** | `/clients` | Clients list + pipeline; **Calendar** `/calendar` |
| **Plans** | `/programs` | Programs + design wizard; **Sessions** list `/sessions` |
| **Studio** | `/studio` | Hub → Library, Knowledge, Coach history, Settings |

**Other surfaces (not top-level peers)**

| Route | Role |
|-------|------|
| `/sessions/[id]` | Full-screen floor logger |
| `/clients/[id]` | Client desk (CRM + progress + timeline) |
| `/login`, `/register/*`, `/invite/[token]` | Auth |
| `/marketing`, `/` (logged out) | Marketing site |
| `/api/health` | Health check |

---

## 3. What’s built (done)

### 3.1 Auth & multi-tenant

| Capability | Status | Notes |
|------------|--------|--------|
| Login / session cookie | **Done** | `AUTH_SECRET` required in production |
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
| Drag reorder exercises | **Not done** | Explicit non-goal of Phase C |
| Multi-exercise invent from desk append | **Not done** | Append = straight only |
| Progression write-back into program targets | **Not done** | Floor tips only |
| Google Calendar / external sync | **Not done** | Deferred |

### 3.4 CRM / business spine

| Capability | Status | Notes |
|------------|--------|--------|
| Client stage (lead/active/paused + deactivate) | **Done** | Vision Phase A |
| Sticky client chip | **Done** | Cross-page |
| Packages (enroll, remaining, renew, cancel) | **Done** | Vision Phase B |
| Pack debit on **session complete** | **Done** | Not on calendar close |
| Appointments (book, no-show, cancel, complete) | **Done** | Calendar + client desk |
| Calendar month + in-calendar book + billing | **Done** | Pack / invoice / none |
| Tasks / follow-ups → Needs you | **Done** | Vision Phase A |
| Manual invoices (create, paid, void) | **Done** | No cards/tax |
| Check-ins + templates (copy for WhatsApp) | **Done** | No send |
| Client timeline merge | **Done** | Sessions, bookings, tasks, invoices, etc. |
| Desk IA polish (bookings→pack→invoices…) | **Done** | HIG density pass |
| Real WhatsApp/SMS/email send | **Not done** | Vision CRM Phase C |
| Communication log table product UI | **Not done** | Schema may have notes/check-ins only |
| Card payments / Stripe | **Not done** | Deferred |
| Tax / receipts | **Not done** | Deferred |
| Client portal / companion app | **Not done** | Out of scope |

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
| Public marketing site | **Done** | Dual solo/studio path, calm brand |
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
| **Vision later** | Client portal, cards, tax, multi-trainer polish | **Deferred** |

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
- [ ] Payments / client portal — **only after** floor habit sticks  

---

## 8. How we work on this codebase

| Rule | Detail |
|------|--------|
| **Push** | `git subtree push --prefix=pt-crm floorscribe main` from monorepo root (or push from floorscribe clone) |
| **Deploy** | Env-only `FLOORSCRIBE_DEPLOY_*` + `python scripts/deploy_lxc.py` |
| **Verify** | `npm run typecheck` · `npm run smoke:programming` · `smoke:pilot` · `/api/health` |
| **Schema** | Bump `SCHEMA_VERSION` in `src/db/index.ts` when migrations change; restart app |
| **Secrets** | Never commit passwords, `AUTH_SECRET`, or private LXC IPs into the public repo |
| **Scope** | Session/plan/CRM first; knowledge & analytics stay secondary |

---

## 9. Smoke / verify cheatsheet

```bash
cd pt-crm
npm run typecheck
npm run smoke
npm run smoke:pilot
npm run smoke:programming
npm run smoke:floor
npm run smoke:library
curl -s https://floorscribe.com/api/health
```

Browser: [happy-path.md](./happy-path.md) checklist at the bottom.

---

## 10. Changelog of this status file

| Date | Note |
|------|------|
| 2026-08-08 | Initial audit after programs science polish + LXC deploy (`a977bbb` / local `4d4fa35`) |
| 2026-08-08 | Build from scratch + save-for-later drafts (unassigned templates) |
| 2026-08-08 | Programs list polish: Saved for later section, empty-state entry CTAs, happy-path order/prep note |

---

## 11. One-line summary

**FloorScribe is pilot-ready for a single trainer:** floor log + packages/bookings/invoices/tasks + editable programs with exercise-science balance. **Next is not more features by default — a real pilot week, then fix what hurts, then CRM Comms.**
