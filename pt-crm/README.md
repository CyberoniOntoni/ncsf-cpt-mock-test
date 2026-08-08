# FloorScribe

**FloorScribe** — the floor OS for personal trainers: sessions, programs, and coach assist, with a light **business spine** (packages, appointments, stage, check-ins, invoices).

> Repo folder is still `pt-crm/` in the monorepo; product name is **FloorScribe**.  
> GitHub: [CyberoniOntoni/floorscribe](https://github.com/CyberoniOntoni/floorscribe)

- **Home (Floor)** — sticky client, open sessions, needs-you, coach assistant  
- **Clients** — stage pipeline, packages, bookings, check-ins, progress, invoices  
- **Programs / Sessions** — design plan, log sets, complete (burns pack session)  
- **Knowledge** — curated playbooks (incl. NCSF-informed), optional LLM via xAI  
- **Team** — solo PT or multi-trainer studio with invite links  

Self-host first via **Docker Compose** (Proxmox LXC friendly) using embedded **PGlite** — single-volume backup, no separate DB for MVP.

## Quick start (local)

```bash
cd pt-crm   # if you have the monorepo; skip if this is the floorscribe root
cp .env.example .env
npm install
npm run dev
```

Open [http://127.0.0.1:4000](http://127.0.0.1:4000) — logged out shows the **product site**; signed in opens the floor board.

| | |
|--|--|
| **Marketing** | [/marketing](http://127.0.0.1:4000/marketing) (also `/` when logged out) |
| **Demo login** | `pt@demo.local` / `trainer123` |
| **Create account** | [/register](http://127.0.0.1:4000/register) — solo PT or studio |

Set in `.env` for real sessions and correct invite links:

```env
AUTH_SECRET=long-random-string-at-least-24-chars
APP_URL=http://127.0.0.1:4000
FLOORSCRIBE_PORT=4000
```

Restart the dev server after pulls so schema + seed upserts apply (`SCHEMA_VERSION` in `src/db/index.ts`).

Optional LLM (SpaceXAI / xAI):

```env
XAI_API_KEY=your_key
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=grok-4.5
```

Without `XAI_API_KEY`, the coach uses **rule-based** playbook matching.

## Registration & team invites

| Path | Who | Result |
|------|-----|--------|
| `/register` | Chooser | Individual PT vs Studio / team |
| `/register/solo` | Solo PT | Own practice (`kind=solo`), owner |
| `/register/studio` | Studio owner | Multi-trainer org (`kind=studio`), owner |
| `/invite/[token]` | Invited PT | Join studio as trainer / admin / front desk |

**Studio invites**

1. Sign in as owner or admin → **Settings → Team**
2. Enter email + role → **Create invite** (link auto-copies; 14-day expiry)
3. Send the link (WhatsApp / email / SMS — no built-in email yet)
4. Invitee registers on the link, or signs in then accepts

Solo practices can invite people too; the first invite promotes the org to **studio**.

## Daily workflow

See **[docs/happy-path.md](./docs/happy-path.md)** — train a client end-to-end (floor + packages + coach).

**Pilot (local go/no-go):** **[docs/pilot-readiness.md](./docs/pilot-readiness.md)** — trainer loop, smokes, Windows PGlite backup.

**Status / roadmap (what’s done & next):** **[docs/STATUS.md](./docs/STATUS.md)** — living audit for humans and agents.

## Product map

| Area | Route |
|------|--------|
| Marketing (logged out) | `/` · `/marketing` |
| Today (floor command board) | `/` |
| People · Clients | `/clients` |
| People · Calendar | `/calendar` |
| Plans · Programs | `/programs` |
| Plans · Sessions | `/sessions` |
| Studio hub | `/studio` |
| Guided intake | `/clients/new` |
| Client profile (plan, sessions, CRM, progress, notes) | `/clients/[id]` |
| Movement screens | `/clients/[id]/assessments` |
| Exercise library | `/library` |
| Equipment | `/library/equipment` |
| Knowledge (playbooks) | `/knowledge` |
| Coach history | `/history` |
| Settings · profile, org, team invites | `/settings` |
| Register | `/register` · `/register/solo` · `/register/studio` |
| Accept invite | `/invite/[token]` |

## Smoke / verify

```bash
npm run smoke
npm run smoke:pilot
npx tsx scripts/verify-db.ts
npx tsx scripts/smoke-library.ts
npx tsx scripts/smoke-programming.ts
npx tsx scripts/smoke-floor.ts
npx tsx scripts/smoke-floor-a.ts
npx tsc --noEmit
```

Local PGlite backup (Windows; stop dev first if possible):

```bash
npm run backup:pglite
```

## Docker / Proxmox LXC

Full guide: **[DEPLOY.md](./DEPLOY.md)**.

```bash
cp .env.example .env
# set AUTH_SECRET=$(openssl rand -base64 48)
# set APP_URL=https://your-host
docker compose up -d --build
curl -s http://127.0.0.1:4000/api/health
```

Data volume: `ptcrm_data` (stable name). Backup: `./scripts/backup-host.sh /var/backups/floorscribe`

## Docs

| Doc | Content |
|-----|---------|
| [docs/happy-path.md](./docs/happy-path.md) | Daily train-a-client checklist |
| [docs/pilot-readiness.md](./docs/pilot-readiness.md) | Pilot go/no-go |
| [docs/design-system.md](./docs/design-system.md) | Zinc / emerald DS |
| [docs/ncsf-enrichment.md](./docs/ncsf-enrichment.md) | NCSF-informed playbooks |
| [docs/crm-product-vision.md](./docs/crm-product-vision.md) | Longer product notes |
| [DEPLOY.md](./DEPLOY.md) | Proxmox LXC + Docker |

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind  
- Drizzle ORM + PGlite  
- jose cookie sessions  
- OpenAI-compatible client → xAI when configured  

## Schema notes

Current `SCHEMA_VERSION` migrates in place on boot. Recent:

| Version | Adds |
|---------|------|
| 13–14 | Invoices; user phone / title |
| 15 | `organizations.kind` (`solo` \| `studio`); `org_invites` |
