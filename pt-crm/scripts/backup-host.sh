#!/usr/bin/env bash
# Host-side backup of the Docker volume used by PT CRM.
# Run on the Proxmox LXC / Docker host (not inside the app for volume dumps).
#
# Usage:
#   ./scripts/backup-host.sh
#   ./scripts/backup-host.sh /var/backups/pt-crm
#
# Env:
#   COMPOSE_PROJECT  default current dir name / compose project
#   VOLUME_NAME      default ptcrm_data
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${1:-$ROOT/backups}"
VOLUME_NAME="${VOLUME_NAME:-ptcrm_data}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$DEST/ptcrm-volume-${STAMP}.tar.gz"

mkdir -p "$DEST"

if ! docker volume inspect "$VOLUME_NAME" >/dev/null 2>&1; then
  echo "ERROR: docker volume '$VOLUME_NAME' not found." >&2
  echo "List volumes: docker volume ls | grep ptcrm" >&2
  exit 1
fi

echo "Backing up volume $VOLUME_NAME → $OUT"
docker run --rm \
  -v "${VOLUME_NAME}:/data:ro" \
  -v "$DEST:/backup" \
  alpine:3.20 \
  tar -czf "/backup/$(basename "$OUT")" -C /data .

echo "OK: $OUT ($(du -h "$OUT" | cut -f1))"

# Retain last 14 host backups
ls -1t "$DEST"/ptcrm-volume-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
