#!/usr/bin/env bash
# Backup PGlite data dir from inside the container (or bind-mounted host path).
# Usage (in container): floorscribe-backup (or ptcrm-backup alias)
# Env:
#   PGLITE_DATA_DIR  default /data/pglite
#   BACKUP_DIR       default /backups
set -euo pipefail

DATA_DIR="${PGLITE_DATA_DIR:-/data/pglite}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/ptcrm-pglite-${STAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "ERROR: data dir not found: $DATA_DIR" >&2
  exit 1
fi

# Prefer quiet consistent snapshot; app should ideally be stopped for cold backup
tar -czf "$OUT" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
echo "Wrote $OUT"
ls -lh "$OUT"

# Keep last 14 backups in BACKUP_DIR
ls -1t "$BACKUP_DIR"/ptcrm-pglite-*.tar.gz 2>/dev/null | tail -n +15 | xargs -r rm -f
