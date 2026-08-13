# FloorScribe — happy path (train a client)

**Accounts:** create a studio at **`/register`**, or demo seed **`pt@demo.local`** / **`trainer123`**.  
**Profile:** **Settings** — name, email, phone, credentials, password, studio name/units/timezone.

After `git pull` or schema changes: **restart** `npm run dev` so PGlite applies `SCHEMA_VERSION` and reseeds playbooks/templates.

**Pilot go/no-go + backup:** **[pilot-readiness.md](./pilot-readiness.md)**

---

## 1. Start the day (Floor)

1. Open **/** (**Today** — floor command board).
2. Pick or search a client (sticky chip follows you).
3. **Agenda** — booked sessions in the next ~48h (deep-link `#crm-appointments`). **Full calendar →** opens `/calendar` under **People**.
4. **Needs you** — always on Home (**All clear** when empty). Includes open **tasks**, **unpaid invoices**, low/empty packs, quiet leads/clients, sessions in progress. Appointments only appear here when starting within **~4 hours**. Action labels deep-link (`#crm-pack`, `#crm-tasks`, `#crm-invoices`, `#crm-checkin`, etc.).
5. Primary CTA: **Resume session** or **Start session** (one emerald action).
6. With a client selected: **Log check-in** on the launch card (clears quiet-lead when saved).

---

## 2. New or quiet client (cold paid loop)

Cold path — no sticky client, no open session:

1. **Clients** → **Full intake** (or quick-add). New clients start as **lead**.
2. Open the client profile.
3. **Add package** (e.g. 10-pack) and/or **Design program** from empty Active plan → stage becomes **active** on first real engagement (pack, program, or completed session).
4. **Book** the next appointment when you know the time → shows on Home **Agenda** (~48h).
5. **Start session** from Home or program day → log sets → **Complete**.
6. Close-loop: **Share/Copy** → **Book next** → optionally **Keep on program** for ad-hoc floor adds.
7. Confirm pack remaining dropped by 1; Home Agenda / Needs you refresh when you return to the tab.
8. **Check-ins** clear quiet-lead Needs you for 7 days — they do **not** promote stage.

**Deactivate** when they leave the roster (keeps history; **Reactivate** anytime). Inactive clients are hidden from the floor picker and Needs you.

After schema / `git pull`: **restart** `npm run dev` so PGlite applies `SCHEMA_VERSION` (currently **21**).

---

## 3. On the floor (session)

1. Header / sticky: **Start session** (or Resume). New sessions seed **program notes / bank cues** into each exercise (not mesocycle meta dumps as primary cue).
2. Log sets, RPE, pain as needed. Expanded exercises show a quiet **Cue** line and **Last** + progression tip.
   - Non-current exercises collapse to one line; expand a prior one to peek loads — **Focus current** clears peeks.
   - **Fill last** / **Prep open sets** are undoable (keyboard **U**).
   - **Add exercise** (bank) mid-session for improvisation — not on the plan until you promote it.
3. **Apply** on a tip (or keyboard **A**) fills open sets with suggested kg / target reps.
4. Floor shortcuts (**?** for help): Space set · A apply · N/P exercise · +/− load · S save · U undo · R rest · Esc dismiss.
5. **Complete session**:
   - Burns **one pack session** when a pack is **active** (oldest pack first). **Calendar complete** also debits. Same visit does **not** double-charge when booking and floor log are **linked**, or when they are the **only** unlinked floor log + completed booking for that client on that org-local day. Prefer **Start from booking**. Two separate visits the same day still debit twice. **Reopen** a completed booking restores a stamped pack credit.
   - Flash + close-loop show pack left / empty / no pack. Empty → **Renew pack** deep-link.
   - Home (**/**) revalidates so open sessions drop off and **Needs you** can show low/empty pack.
   - Full set log stays on the **session** (and under **Sessions**).
   - **Notes & recommendations** only gets a note if you entered **pain** or **session notes**.
6. **Close the loop** (Session complete card):
   - **Copy summary** / Share (primary)
   - **Book next** appointment (collapsed form; defaults to session duration)
   - **Keep on program** — **Add to plan** for ad-hoc floor exercises (program-day sessions only)
   - **Open client** · **Today** · **Log check-in** · **Renew/Add pack** when relevant
   - After complete: **Program** / **Progress** links when available; book next uses session duration.
   - Meta: Home · Program · Progress · All sessions

---

## 4. Between sessions (CRM)

On the client page, **Timeline** (below Sessions) merges sessions, bookings, tasks, invoices, check-ins, and coach notes newest-first. Deep links jump to `#crm-appointments`, `#crm-tasks`, `#crm-invoices`, `#crm-checkin`, or the session log.

On the client page, **Packages & schedule**:

| Action | Where |
|--------|--------|
| Remaining sessions | Summary strip + package card |
| **Renew pack** | When no active pack (and a prior pack exists) — one-tap prefills name/total; or Needs you **Renew pack** → `#crm-pack` |
| Book / complete / **no-show** / cancel | Appointments (forms collapse until you open them) |
| **Invoices** | Create amount + title; **Mark paid** / unpaid / void. Unpaid surface on Home Needs you (`#crm-invoices`). Manual only — no cards or tax. |
| **Follow-ups** | Tasks with optional due date; mark done / remove. Open tasks surface on Home Needs you (`#crm-tasks`) |
| Touch log | **Log check-in** (message / call / in person) + short **templates** (copy into WhatsApp yourself — no send) |
| Stage | **Change stage** |

Header whisper links (package left · next booking) jump to `#crm`.

---

## 5. Coach & knowledge

1. Home **Coach** (collapsed by default — stays open in memory when you hide it). With client selected: e.g. “older adult training”, “needs analysis”.
2. With an **active program**: ask “insert correctives”, “deload this program”, or “advance mesocycle” → one-tap **Apply** mutates the plan and **stays on Home** (open the program when ready).
3. **Append exercise:** “add face pulls to day 1” / “add X to program” → **Apply** appends a bank match. Only the **latest** coach reply can re-Apply (no double-tap from old bubbles).
4. **Knowledge** — filter **NCSF**, or open `/knowledge?slug=…` / `?q=…` from coach **Sources** links.
5. Save recs from Coach → they show under **Notes & recommendations** (not session dumps).

## 5b. Program edit & mesocycle (desk)

1. Open **Programs → New program** — chooser: **Auto-design** (wizard) or **Build from scratch**. From the list, **From scratch** skips the chooser. Check **Save for later** on scratch to keep an **unassigned draft** (shows under **Saved for later** on `/programs`). Then open a plan.
2. Per day: **Add exercise** opens the bank picker (append only — no full regen). New rows get **goal + pattern** defaults; picker shows pattern science + typical Rx.
3. **Plan balance** card: weekly working sets by pattern, pull:push, session estimates, science flags, and **Fill next** chips (MEV / antagonist gaps).
4. Edit rest → **Science rest** + **Apply**. Floor tips use **double progression** (reps → then load) and hold cues at high RPE.
5. **Exercise order & session prep:** Auto-design and desk **Add exercise** re-sort each day: warm-up → power → primary compounds (e.g. **bench before overhead press**, squat before lunges) → secondary → isolation → cool-down. RAMP warm-up (raise / activate / mobilize / potentiate) and cool-down (downshift / lengthen) show as badges on desk and floor — not free-form notes.
6. **Mesocycle** chips W1–W6 (deload = amber). Selecting does not write until **Apply**.
7. Progress `n / threshold` sessions + auto-advance on/off; **Advance** steps week.

---

## 6. Progress

On the client page, **Progress**:

- KPI strip (sessions / volume / weight / screen trends).
- Compact trio: **Body metrics · Best loads · Screens**.
- **Copy** — plain-text progress snapshot for WhatsApp / notes.
- Add measurement under body metrics when needed.

---

## Smoke checks (dev)

```bash
cd pt-crm
npm run smoke          # seed + coach retrieval demo
npx tsx scripts/verify-db.ts
npx tsx scripts/smoke-library.ts
npx tsx scripts/smoke-programming.ts   # constraints, meso, append helpers
npx tsx scripts/smoke-floor.ts
npx tsx scripts/smoke-floor-a.ts
npx tsc --noEmit
```

Browser checklist:

- [ ] Login works  
- [ ] Client open → Start session → log → Complete  
- [ ] Pack remaining drops by 1 after complete  
- [ ] Calendar **Close booking** drops pack by 1; linked (or unique same-day) floor complete does not drop a second credit  
- [ ] **Reopen** a completed booking restores the stamped pack credit 
- [ ] Sessions list shows the session; Notes does **not** show full set dump  
- [ ] Program day **Add exercise** appends from bank  
- [ ] Coach “add … to program” → Apply mutates plan
- [ ] Mid-session **Add exercise** → after Complete **Add to plan** keeps it on the day  
- [ ] Book appointment appears on Home Agenda (~48h); Needs you only if ≤4h
- [ ] Calendar month grid loads; book day prefill works; booking appears on grid  
- [ ] **Start session** from booking (client Next up or calendar day) opens floor log; complete marks booking done  
- [ ] Client portal: `/portal/login` as `jane@example.com` (dev: OTP is logged with `MOCK_EMAIL`) → sign waiver → see Home / Program tabs
- [ ] Floor: Focus current / Prep open sets; after Complete, close-loop Share + Book next
- [ ] Follow-up task appears on Needs you; #crm-tasks deep link works
- [ ] Home Agenda / Needs you refresh when returning to the tab  
- [ ] Knowledge NCSF filter works  

---

## Mental model

| Layer | Job |
|-------|-----|
| **Today** | Who to train, agenda, needs-you, coach |
| **People** | Clients + calendar |
| **Plans** | Programs + session logs |
| **Studio** | Library, knowledge, history, settings |
| **Floor session** | Log the hour (from Today / client / booking) |

One primary CTA for floor work. Everything else is quieter chrome.
