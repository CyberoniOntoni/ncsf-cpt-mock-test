# FloorScribe

**FloorScribe** — the floor OS for personal trainers: sessions, programs, and coach assist, with a light **business spine** (packages, appointments, stage, check-ins).

> Repo folder is still `pt-crm/` for now; product name is **FloorScribe**.

- **Home (Floor)** — sticky client, open sessions, needs-you, coach assistant  
- **Clients** — stage pipeline, packages, bookings, check-ins, progress  
- **Programs / Sessions** — design plan, log sets, complete (burns pack session)  
- **Knowledge** — curated playbooks (incl. NCSF-informed), optional LLM via xAI  

Self-host first via **Docker Compose** (Proxmox LXC friendly) using embedded **PGlite** — single-volume backup, no separate DB for MVP.

## Quick start (local)

```bash
cd pt-crm
cp .env.example .env
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — logged out shows the **product site**; signed in opens the floor board.

| | |
|--|--|
| **Marketing** | [/marketing](http://localhost:3000/marketing) (also `/` when logged out) |
| **Demo login** | `pt@demo.local` / `trainer123` |
| **New studio** | [/register](http://localhost:3000/register) |

Restart the dev server after pulls so schema + seed upserts apply (`SCHEMA_VERSION` in `src/db/index.ts`).

Optional LLM (SpaceXAI / xAI):

```env
XAI_API_KEY=your_key
AI_BASE_URL=https://api.x.ai/v1
AI_MODEL=grok-4.5
AUTH_SECRET=long-random-string
```

Without `XAI_API_KEY`, the coach uses **rule-based** playbook matching.

## Daily workflow

See **[docs/happy-path.md](./docs/happy-path.md)** — train a client end-to-end (floor + packages + coach).

**Pilot (local go/no-go):** **[docs/pilot-readiness.md](./docs/pilot-readiness.md)** — trainer loop, smokes, Windows PGlite backup.

## Product map

| Area | Route |
|------|--------|
| Today (floor command board) | `/` |
| People · Clients | `/clients` |
| People · Calendar | `/calendar` |
| Plans · Programs | `/programs` |
| Plans · Sessions | `/sessions` |
| Studio hub | `/studio` |
| Guided intake | `/clients/new` |
| Client profile (plan, sessions, CRM, progress, notes) | `/clients/[id]` |
| Movement screens | `/clients/[id]/assessments` |
| Programs | `/programs` |
| Session logs | `/sessions` |
| Exercise library | `/library` |
| Equipment | `/library/equipment` |
| Knowledge (playbooks) | `/knowledge` |
| Coach history | `/history` |
| Settings | `/settings` |

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
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health
```

Data volume: `ptcrm_data` (stable name). Backup: `./scripts/backup-host.sh /var/backups/floorscribe`

## Docs

| Doc | Content |
|-----|---------|
| [docs/happy-path.md](./docs/happy-path.md) | Daily train-a-client checklist |
| [docs/design-system.md](./docs/design-system.md) | Zinc / emerald DS |
| [docs/ncsf-enrichment.md](./docs/ncsf-enrichment.md) | NCSF-informed playbooks |
| [docs/crm-product-vision.md](./docs/crm-product-vision.md) | Longer product notes |

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind  
- Drizzle ORM + PGlite  
- jose cookie sessions  
- OpenAI-compatible client → xAI when configured  
