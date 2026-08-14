# Deploy FloorScribe on Proxmox (LXC) with Docker

Self-host FloorScribe in a single container. Data lives in a Docker volume (`ptcrm_data`) using embedded PGlite — one volume to back up.

> Product name: **FloorScribe**. Repo/folder may still be `pt-crm`.

## 1. Create an LXC

Recommended:

| Setting | Value |
|--------|--------|
| OS | Debian 12 or Ubuntu 24.04 |
| CPU | 2 vCPU |
| RAM | 2–4 GB |
| Disk | 20+ GB |
| Nesting | **on** (for Docker) |
| Network | static IP or DHCP reservation |

Enable nesting (Proxmox UI → Options → Features → Nesting, or `pct set <CTID> -features nesting=1`).

## 2. Install Docker on the LXC

```bash
# As root inside the container
apt update && apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version
```

## 3. Get the app

```bash
cd /opt
git clone <your-repo-url> pt-crm   # or scp/rsync the pt-crm folder
cd /opt/pt-crm
```

## 4. Configure secrets

```bash
cp .env.example .env
nano .env
```

**Must set:**

```bash
# Long random secrets (do not use the example values)
AUTH_SECRET=$(openssl rand -base64 48)
CLIENT_AUTH_SECRET=$(openssl rand -base64 48)
# put those values into .env

APP_URL=https://floorscribe.example.com   # or http://YOUR_LXC_IP:4000
FLOORSCRIBE_PORT=4000
# PTCRM_PORT still accepted as a legacy alias
```

**Mail (Mailtrap — required for live OTP / verify / invites):**

```bash
# Sending API token from Mailtrap (env name only — never commit the value)
MAILTRAP_API_TOKEN=
MAILTRAP_FROM_EMAIL=hello@floorscribe.com
MAILTRAP_FROM_NAME=FloorScribe
# MOCK_EMAIL=true   # local only; production fails closed without a token
```

Without `MAILTRAP_API_TOKEN`, portal OTP, seeker/trainer verification codes, and studio invite emails do not deliver (mock logs in dev; production reports undelivered).

**Optional AI:**

```bash
XAI_API_KEY=xai-...
AI_MODEL=grok-4.5
```

Without `XAI_API_KEY`, the coach still works in **rule-based playbook** mode.

## 5. Build and run

```bash
cd /opt/pt-crm
docker compose up -d --build
docker compose ps
curl -s http://127.0.0.1:4000/api/health | jq .
```

Expect `"ok": true` and `"authSecretConfigured": true`.

Open `http://YOUR_LXC_IP:4000` (or your domain).

**Demo login** (change password later / create your own flow):  
`pt@demo.local` / `trainer123`

> For real use: sign in, then treat demo as disposable, or wipe volume and re-seed after first admin setup.

## 6. HTTPS reverse proxy (recommended)

Point DNS A/AAAA record at the LXC IP. Install Caddy:

```bash
apt install -y caddy
cp /opt/pt-crm/deploy/Caddyfile.example /etc/caddy/Caddyfile
# edit domain name
systemctl reload caddy
```

Set `APP_URL=https://your-domain` in `.env` and `docker compose up -d` again.

## 7. Backups

### Daily host volume backup (recommended)

```bash
chmod +x /opt/pt-crm/scripts/backup-host.sh /opt/pt-crm/scripts/restore-host.sh
/opt/pt-crm/scripts/backup-host.sh /var/backups/pt-crm
```

Cron (02:15 UTC daily):

```bash
crontab -e
# add:
15 2 * * * /opt/pt-crm/scripts/backup-host.sh /var/backups/pt-crm >> /var/log/ptcrm-backup.log 2>&1
```

Copy `/var/backups/pt-crm` off-box (Proxmox host, S3, rsync).

### Restore

```bash
cd /opt/pt-crm
docker compose down
./scripts/restore-host.sh /var/backups/pt-crm/ptcrm-volume-YYYYMMDDTHHMMSSZ.tar.gz
docker compose up -d
```

## 8. Updates

```bash
cd /opt/pt-crm
git pull                    # or rsync new code
docker compose up -d --build
curl -s http://127.0.0.1:3000/api/health
```

Schema/playbook seeds apply on startup (idempotent). **Always backup before upgrades.**

## 9. Operations checklist

| Check | Command / place |
|--------|------------------|
| Health | `curl -s localhost:3000/api/health` |
| Logs | `docker compose logs -f --tail=100` |
| Restart | `docker compose restart` |
| Stop | `docker compose down` (volume kept) |
| Wipe all data | `docker compose down -v` ⚠️ destroys clients |
| Settings UI | App → Settings (AI + secret warnings) |

## 10. Security notes

- Never commit `.env` or `MAILTRAP_API_TOKEN` values.
- Use strong unique `AUTH_SECRET` and `CLIENT_AUTH_SECRET` in production.
- Prefer HTTPS + firewall: only 80/443 public; bind app to localhost if behind Caddy (`ports: "127.0.0.1:3000:3000"`).
- Demo password is public knowledge — change workflow for production users.
- Client health data: encrypt host disks if required by your compliance needs; backups contain the full DB.

## 11. Resource notes

PGlite is single-node embedded Postgres-compatible storage. Fine for a freelance PT / small studio on one LXC. Multi-instance horizontal scale would need a move to external Postgres later — volume layout already isolates app vs data for that migration path.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `AUTH_SECRET` / `CLIENT_AUTH_SECRET` compose error | Set both secrets in `.env` (required) |
| Health 503 | `docker compose logs app` — DB path permissions |
| Port in use | Change `FLOORSCRIBE_PORT` (or legacy `PTCRM_PORT`) in `.env` |
| Lost clients after recreate | Volume removed with `-v`; restore from backup |
| Stale session after wipe | Sign out / clear cookies; re-login |
