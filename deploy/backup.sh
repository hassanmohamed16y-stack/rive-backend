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
