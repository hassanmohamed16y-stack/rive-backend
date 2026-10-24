#!/bin/sh
# Daily dump of both databases (store + n8n). Keeps 14 days.
# Runs inside the "backup" container; files land in deploy/backups on the server.
set -eu
STAMP=$(date +%Y-%m-%d_%H%M)
DIR=/backups
mkdir -p "$DIR"
for DB in rive n8n; do
  pg_dump -h postgres -U rive -d "$DB" -Fc -f "$DIR/$DB-$STAMP.dump"
done
find "$DIR" -name '*.dump' -mtime +14 -delete
echo "$(date) backup ok: rive-$STAMP.dump n8n-$STAMP.dump"

# Copy outside the server too (if configured). A failure here must not hide the local backup.
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  if command -v rclone >/dev/null 2>&1 \
    && rclone copy "$DIR/rive-$STAMP.dump" "$BACKUP_RCLONE_REMOTE" \
    && rclone copy "$DIR/n8n-$STAMP.dump" "$BACKUP_RCLONE_REMOTE"; then
    rclone delete "$BACKUP_RCLONE_REMOTE" --min-age 14d >/dev/null 2>&1 || true
    echo "$(date) off-server copy ok: $BACKUP_RCLONE_REMOTE"
  else
    echo "$(date) OFF-SERVER COPY FAILED (the local backup is kept)" >&2
  fi
else
  echo "$(date) note: no off-server backup configured (BACKUP_RCLONE_REMOTE is empty)"
fi
