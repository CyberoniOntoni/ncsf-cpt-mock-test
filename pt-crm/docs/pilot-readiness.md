# FloorScribe — pilot readiness

Goal: run your real training day on local FloorScribe without relying on GitHub publish.

**Demo login:** `pt@demo.local` / `trainer123` · or **`/register`** for a real studio  
**SCHEMA_VERSION:** 14 (user profile fields + invoices)

---

## Pre-flight (once per machine)

1. `cd pt-crm` → `npm install` → copy `.env.example` → `.env`
2. Set `AUTH_SECRET` to a long random string (required).
3. `npm run dev` → open http://localhost:3000
4. **Restart dev after every `git pull`** so PGlite migrates + reseeds.

### Verify stack

```bash
npm run typecheck
npm run smoke
npm run smoke:pilot
npm run smoke:floor
npm run smoke:floor-a
npm run smoke:programming
```

Health: http://localhost:3000/api/health → `"status":"healthy"`

---

## Trainer day loop (must work)

| Step | Where | Pass when |
|------|--------|-----------|
| 1. Sticky client | **Today** search / chip | Chip stays across pages |
| 2. Pack | Client → Package | Active pack shows remaining; empty → Renew |
| 3. Invoice | Client → Invoices | Create amount → **Unpaid** on header + Needs you |
| 4. Mark paid | Client or Needs you → `#crm-invoices` | Status **Paid**; Needs you clears for that invoice |
| 5. Book | Client → Appointments / Home **Book** | Shows on Agenda (~48h) + calendar |
| 6. Start session | Today / client header | Floor log opens, sets save |
| 7. Complete | Session complete | Pack remaining −1 (if active pack); close-loop CTAs |
| 8. Check-in | Today or client | Note saved; quiet lead cools for 7 days |
| 9. Task | Client follow-ups | Open task on Needs you when due |

Full narrative: **[happy-path.md](./happy-path.md)**

---

## Backup (local pilot)

PGlite lives in `pt-crm/data/pglite` (or `PGLITE_DATA_DIR`).

**Windows (recommended before big days):**

```powershell
# Prefer stopping npm run dev first
powershell -ExecutionPolicy Bypass -File scripts/backup-pglite.ps1
```

Zip lands in `pt-crm/backups/pglite-*.zip` (keeps last 14).

**Docker / host volume:** `scripts/backup-host.sh` (see **DEPLOY.md**).

Restore = stop app, replace `data/pglite` from unzip, restart. Keep offline copies off the laptop when you can.

---

## Pilot scope (in) vs later (out)

**In for pilot**

- Single trainer, single org (demo studio)
- Packages, bookings ↔ floor sessions, programs, CRM tasks/check-ins
- Manual invoices (mark paid / void) — no cards or tax
- Rule-based coach without API key; optional xAI key for LLM coach

**Out (defer)**

- Multi-trainer roles, client portal, card payments, tax
- Real SMS/WhatsApp send, Google Calendar sync
- Public multi-tenant deploy / trademark push

---

## Known pilot tips

- **Needs you** caps work and prefers one primary row per client (plus ≤4h bookings).
- Completing a floor session burns **one** pack credit only when an **active** pack exists.
- Closing a **booking** as done does **not** burn a pack — floor **Complete** does.
- Unpaid invoices use deep link `#crm-invoices` (Mark paid is one tap).
- After schema changes: restart dev; if UI looks stale, hard-refresh the browser.

---

## Go / no-go

| Check | Go |
|-------|-----|
| Login + health OK | ☐ |
| Sticky client + Start session | ☐ |
| Pack remaining changes on complete | ☐ |
| Invoice unpaid → Needs you → Mark paid | ☐ |
| Book appears on Agenda / calendar | ☐ |
| Backup zip created once | ☐ |

When all boxes are checked, the pilot can start. Next product step after a real week: **private deploy** or the friction the pilot hits first.
