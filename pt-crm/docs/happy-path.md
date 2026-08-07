# Happy path — train a client (daily use)

Demo login: **`pt@demo.local`** / **`trainer123`**

After `git pull` or schema changes: **restart** `npm run dev` so PGlite applies `SCHEMA_VERSION` and reseeds playbooks/templates.

---

## 1. Start the day (Floor)

1. Open **/** (Home).
2. Pick or search a client (sticky chip follows you).
3. **Needs you** — action labels (Resume, Renew pack, Check in, Design…) deep-link to the right place (`#crm-pack`, `#crm-checkin`, etc.).
4. Primary CTA: **Resume session** or **Start session** (one emerald action).
5. With a client selected: **Log check-in** on the launch card (clears quiet-lead when saved).

---

## 2. New or quiet client

1. **Clients** → quick-add or **Full intake**. New clients start as **lead** (pipeline).
2. Open the client profile.
3. **Lead → active** is automatic on first real engagement:
   - add a **package**, or
   - design / attach a **program**, or
   - **complete a floor session**.  
   You can still change **stage** under **Packages & schedule**.  
   **Deactivate** when they leave the roster (keeps history; **Reactivate** anytime). Inactive clients are hidden from the floor picker and Needs you.
4. **Add package** (e.g. 10-pack) if selling sessions.
5. **Book** the next appointment when you know the time.
6. **Design program** only from empty **Active plan** (not the header).
7. **Check-ins** (Home **Log check-in** or client `#crm-checkin`) clear quiet-lead Needs you for 7 days — they do **not** promote stage.

---

## 3. On the floor (session)

1. Header / sticky: **Start session** (or Resume).
2. Log sets, RPE, pain as needed.
3. **Complete session**:
   - Burns **one pack session** when a pack is active.
   - Full set log stays on the **session** (and under **Sessions**).
   - **Notes & recommendations** only gets a note if you entered **pain** or **session notes**.

---

## 4. Between sessions (CRM)

On the client page, **Packages & schedule**:

| Action | Where |
|--------|--------|
| Remaining sessions | Summary strip + package card |
| Book / complete / cancel booking | Appointments (forms collapse until you open them) |
| Touch log | **Log check-in** (message / call / in person) |
| Stage | **Change stage** |

Header whisper links (package left · next booking) jump to `#crm`.

---

## 5. Coach & knowledge

1. Home **Coach** with client selected — e.g. “older adult training”, “needs analysis”.
2. **Knowledge** — filter **NCSF**, safety / nutrition categories.
3. Save recs from Coach → they show under **Notes & recommendations** (not session dumps).

---

## 6. Progress

On the client page, **Progress**:

- KPI strip (sessions / volume / weight / screen trends).
- Compact trio: **Body metrics · Best loads · Screens**.
- Add measurement under body metrics when needed.

---

## Smoke checks (dev)

```bash
cd pt-crm
npm run smoke          # seed + coach retrieval demo
npx tsx scripts/verify-db.ts
npx tsx scripts/smoke-library.ts
npx tsc --noEmit
```

Browser checklist:

- [ ] Login works  
- [ ] Client open → Start session → log → Complete  
- [ ] Pack remaining drops by 1 after complete  
- [ ] Sessions list shows the session; Notes does **not** show full set dump  
- [ ] Book appointment appears on Home needs-you within 48h  
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
