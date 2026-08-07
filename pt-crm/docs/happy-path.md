# Happy path — train a client (daily use)

Demo login: **`pt@demo.local`** / **`trainer123`**

After `git pull` or schema changes: **restart** `npm run dev` so PGlite applies `SCHEMA_VERSION` and reseeds playbooks/templates.

---

## 1. Start the day (Floor)

1. Open **/** (Home).
2. Pick or search a client (sticky chip follows you).
3. **Agenda** — booked sessions in the next ~48h (deep-link `#crm-appointments`). Full list lives here so Needs you stays action-focused.
4. **Needs you** — always on Home (**All clear** when empty). Includes open **tasks**, low/empty packs, quiet leads/clients, sessions in progress. Appointments only appear here when starting within **~4 hours**. Action labels deep-link (`#crm-pack`, `#crm-tasks`, `#crm-checkin`, etc.).
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

After schema / `git pull`: **restart** `npm run dev` so PGlite applies `SCHEMA_VERSION` (currently **11** = `client_tasks`).

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
   - Burns **one pack session** when a pack is active.
   - Full set log stays on the **session** (and under **Sessions**).
   - **Notes & recommendations** only gets a note if you entered **pain** or **session notes**.
6. **Close the loop** (Session complete card):
   - **Copy summary** / Share (primary)
   - **Book next** appointment (collapsed form; defaults to session duration)
   - **Keep on program** — **Add to plan** for ad-hoc floor exercises (program-day sessions only)
   - **Open client** · **Log check-in**
   - After complete: **Program** / **Progress** links when available; book next uses session duration.
   - Meta: Home · Program · Progress · All sessions

---

## 4. Between sessions (CRM)

On the client page, **Packages & schedule**:

| Action | Where |
|--------|--------|
| Remaining sessions | Summary strip + package card |
| **Renew pack** | When no active pack (and a prior pack exists) — one-tap prefills name/total; or Needs you **Renew pack** → `#crm-pack` |
| Book / complete / **no-show** / cancel | Appointments (forms collapse until you open them) |
| **Follow-ups** | Tasks with optional due date; mark done / remove. Open tasks surface on Home Needs you (`#crm-tasks`) |
| Touch log | **Log check-in** (message / call / in person) + short **templates** (copy into WhatsApp yourself — no send) |
| Stage | **Change stage** |

Header whisper links (package left · next booking) jump to `#crm`.

---

## 5. Coach & knowledge

1. Home **Coach** with client selected — e.g. “older adult training”, “needs analysis”.
2. With an **active program**: ask “insert correctives”, “deload this program”, or “advance mesocycle” → one-tap Apply mutates the plan.
3. **Append exercise:** “add face pulls to day 1” / “add X to program” → **Apply** appends a bank match to that day (or first day). Unavailable equipment is rejected.
4. **Knowledge** — filter **NCSF**, or open `/knowledge?slug=…` / `?q=…` from coach **Sources** links.
5. Save recs from Coach → they show under **Notes & recommendations** (not session dumps).

## 5b. Program edit & mesocycle (desk)

1. Open **Programs →** a plan.
2. Per day: **Add exercise** opens the bank picker (append only — no full regen). Swap / edit / remove still work per row.
3. **Mesocycle** chips W1–W6 (deload = amber). Selecting does not write until **Apply**.
4. Progress `n / threshold` sessions + auto-advance on/off.
5. **Advance** steps week; session complete may auto-advance when on.

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
- [ ] Sessions list shows the session; Notes does **not** show full set dump  
- [ ] Program day **Add exercise** appends from bank  
- [ ] Coach “add … to program” → Apply mutates plan
- [ ] Mid-session **Add exercise** → after Complete **Add to plan** keeps it on the day  
- [ ] Book appointment appears on Home Agenda (~48h); Needs you only if ≤4h
- [ ] Floor: Focus current / Prep open sets; after Complete, close-loop Share + Book next
- [ ] Follow-up task appears on Needs you; #crm-tasks deep link works
- [ ] Home Agenda / Needs you refresh when returning to the tab  
- [ ] Knowledge NCSF filter works  

---

## Mental model

| Layer | Job |
|-------|-----|
| **Floor** | Start / resume / log sessions |
| **Plan** | Active program, design when empty |
| **Packages & schedule** | Pack, booking, stage, check-ins |
| **Progress** | Proof (metrics, loads, screens) |
| **Notes** | Coach memory only |
| **Knowledge / Coach** | Playbooks & AI assist |

One primary CTA for floor work. Everything else is quieter chrome.
