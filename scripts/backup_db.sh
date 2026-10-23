#!/bin/bash
# ============================================================
# DVT Talent AI — Automated PostgreSQL Database & Storage Backup Script
# Usage: ./scripts/backup_db.sh
# Can be run manually or configured in crontab (e.g., daily)
#
# Consistency & Recovery Note:
# Database and application storage are captured sequentially. To minimize
# temporal skew, the database dump is taken immediately followed by the
# storage archive. In the event of disaster recovery, the post-restore
# reconciliation CLI reconciles any erasure state differences.
# ============================================================
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1

COMPOSE_FILE="${COMPOSE_FILE:-/opt/dvt-talent-ai/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/dvt-talent-ai/backups/postgres}"
STORAGE_BACKUP_DIR="${STORAGE_BACKUP_DIR:-/opt/dvt-talent-ai/backups/storage}"
DB_NAME="${DB_NAME:-dvt_talent}"
DB_USER="${DB_USER:-dvt_user}"
RETENTION_DAYS=14
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

BACKUP_FILE="${BACKUP_DIR}/dvt_talent_${TIMESTAMP}.sql.gz"
TMP_BACKUP_FILE="${BACKUP_DIR}/.dvt_talent_${TIMESTAMP}.sql.gz.tmp"

STORAGE_BACKUP_FILE="${STORAGE_BACKUP_DIR}/storage_${TIMESTAMP}.tar.gz"
TMP_STORAGE_BACKUP_FILE="${STORAGE_BACKUP_DIR}/.storage_${TIMESTAMP}.tar.gz.tmp"

mkdir -p "$BACKUP_DIR" "$STORAGE_BACKUP_DIR"

cleanup_temp() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "🚨 Backup failed! Cleaning up incomplete temporary files..."
        rm -f "$TMP_BACKUP_FILE" "$TMP_STORAGE_BACKUP_FILE" 2>/dev/null || true
        echo "🚨 Incomplete backup artifacts removed. Existing backups preserved."
    fi
    exit $exit_code
}
trap cleanup_temp EXIT

COMPOSE_CMD=(docker compose)
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    COMPOSE_CMD+=( -p "$COMPOSE_PROJECT_NAME" )
fi
COMPOSE_CMD+=( -f "$COMPOSE_FILE" )

# ------------------------------------------------------------
# Step 1: PostgreSQL Database Dump
# ------------------------------------------------------------
echo "📦 [1/2] Creating PostgreSQL database backup..."
"${COMPOSE_CMD[@]}" exec -T db \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists | gzip > "$TMP_BACKUP_FILE"

# Validate DB backup: non-empty and valid gzip
if [ ! -s "$TMP_BACKUP_FILE" ]; then
    echo "❌ Error: Database backup file is 0 bytes or was not created."
    exit 1
fi
if ! gzip -t "$TMP_BACKUP_FILE" 2>/dev/null; then
    echo "❌ Error: Database backup failed gzip integrity verification."
    exit 1
fi

# ------------------------------------------------------------
# Step 2: Application Storage Archive (Tombstones & Uploads)
# ------------------------------------------------------------
echo "📦 [2/2] Creating application storage backup (tombstone ledger & uploads)..."
# Error propagation strictly enforced: no || true suppression
"${COMPOSE_CMD[@]}" exec -T api \
    tar -czf - -C /app storage uploads > "$TMP_STORAGE_BACKUP_FILE"

# Validate storage backup: non-empty, valid gzip, and valid listable tar
if [ ! -s "$TMP_STORAGE_BACKUP_FILE" ]; then
    echo "❌ Error: Storage backup file is 0 bytes or was not created."
    exit 1
fi
if ! gzip -t "$TMP_STORAGE_BACKUP_FILE" 2>/dev/null; then
    echo "❌ Error: Storage backup failed gzip integrity verification."
    exit 1
fi
if ! (tar --force-local -tzf "$TMP_STORAGE_BACKUP_FILE" >/dev/null 2>&1 || tar -tzf "$TMP_STORAGE_BACKUP_FILE" >/dev/null 2>&1); then
    echo "❌ Error: Storage backup failed tar listing / structure verification."
    exit 1
fi

# ------------------------------------------------------------
# Step 3: Atomic Promotion of Validated Backups
# ------------------------------------------------------------
mv "$TMP_BACKUP_FILE" "$BACKUP_FILE"
mv "$TMP_STORAGE_BACKUP_FILE" "$STORAGE_BACKUP_FILE"

echo "✅ Database backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
echo "✅ Storage backup created:  $STORAGE_BACKUP_FILE ($(du -h "$STORAGE_BACKUP_FILE" | cut -f1))"

# ------------------------------------------------------------
# Step 4: Prune Backups Older Than Retention Window
# ------------------------------------------------------------
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "dvt_talent_*.sql.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true
find "$STORAGE_BACKUP_DIR" -type f -name "storage_*.tar.gz" -mtime +${RETENTION_DAYS} -delete 2>/dev/null || true

echo "✨ Backup routine finished successfully."
