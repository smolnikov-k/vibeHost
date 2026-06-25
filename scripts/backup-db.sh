#!/usr/bin/env bash
# ============================================================
# PostgreSQL backup script for VibeHosting
# Stores timestamped pg_dump files, retains 14 days.
# ============================================================
set -euo pipefail

BACKUP_DIR="/var/backups/vibe-hosting"
DB_NAME="vibe_hosting"
DB_USER="vibe_user"
RETENTION_DAYS=14
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Perform the dump
log "Starting backup of database '${DB_NAME}'..."
if pg_dump -U "${DB_USER}" -h localhost "${DB_NAME}" | gzip > "${BACKUP_FILE}"; then
  log "Backup succeeded: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"
else
  log "ERROR: pg_dump failed for database '${DB_NAME}'"
  exit 1
fi

# Prune backups older than retention period
DELETED=$(find "${BACKUP_DIR}" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -print -delete | wc -l)
if [ "${DELETED}" -gt 0 ]; then
  log "Pruned ${DELETED} backup(s) older than ${RETENTION_DAYS} days."
fi

log "Backup complete."
