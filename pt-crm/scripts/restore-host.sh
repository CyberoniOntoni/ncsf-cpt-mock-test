#!/usr/bin/env bash
# Restore a volume backup created by backup-host.sh
# WARNING: overwrites current volume data. Stop the app first.
#
# Usage:
#   docker compose down
#   ./scripts/restore-host.sh backups/ptcrm-volume-YYYYMMDDTHHMMSSZ.tar.gz
#   docker compose up -d
set -euo pipefail

ARCHIVE="${1:-}"
VOLUME_NAME="${VOLUME_NAME:-ptcrm_data}"

if [[ -z "$ARCHIVE" || ! -f "$ARCHIVE" ]]; then
  echo "Usage: $0 <path-to-ptcrm-volume-*.tar.gz>" >&2
  exit 1
fi

if docker ps --format '{{.Names}}' | grep -qx 'pt-crm'; then
  echo "ERROR: container pt-crm is running. Run: docker compose down" >&2
  exit 1
fi

# Ensure volume exists
docker volume create "$VOLUME_NAME" >/dev/null

ABS="$(cd "$(dirname "$ARCHIVE")" && pwd)/$(basename "$ARCHIVE")"
echo "Restoring $ABS → volume $VOLUME_NAME"
docker run --rm \
  -v "${VOLUME_NAME}:/data" \
  -v "$(dirname "$ABS"):/backup:ro" \
  alpine:3.20 \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar -xzf /backup/$(basename "$ABS") -C /data"

echo "Restore complete. Start app: docker compose up -d"
