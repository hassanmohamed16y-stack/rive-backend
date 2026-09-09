#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# RIVÉ Backend Database Backup Script
# ==============================================================================
# Usage:
#   ./scripts/backup-db.sh [OUTPUT_FILE]
#
# Environment variables:
#   DIRECT_DATABASE_URL or DATABASE_URL: PostgreSQL connection string
# ==============================================================================

DB_URL="${DIRECT_DATABASE_URL:-${DATABASE_URL:-}}"

if [ -z "${DB_URL}" ]; then
  echo "Error: Neither DIRECT_DATABASE_URL nor DATABASE_URL environment variable is set." >&2
  echo "Usage: DIRECT_DATABASE_URL='postgresql://...' ./scripts/backup-db.sh [OUTPUT_FILE]" >&2
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-./backups}"
OUTPUT_FILE="${1:-${BACKUP_DIR}/rive_backup_${TIMESTAMP}.sql.gz}"

mkdir -p "$(dirname "${OUTPUT_FILE}")"

echo "=== Starting database backup ==="
echo "Target: ${OUTPUT_FILE}"

pg_dump "${DB_URL}" --clean --if-exists --no-owner --no-privileges | gzip > "${OUTPUT_FILE}"

echo "=== Backup completed successfully ==="
echo "File size: $(du -h "${OUTPUT_FILE}" | cut -f1)"
