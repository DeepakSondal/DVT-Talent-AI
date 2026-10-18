#!/bin/bash
# ============================================================
# DVT Talent AI — PostgreSQL Database Restore Script
# Usage: ./scripts/restore_db.sh <path_to_backup_file.sql.gz>
# ============================================================
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/dvt-talent-ai/docker-compose.prod.yml}"

if [ -z "${1:-}" ]; then
    echo "❌ Error: Please specify the path to the compressed backup file."
    echo "Usage: ./scripts/restore_db.sh /opt/dvt-talent-ai/backups/postgres/dvt_talent_YYYYMMDD_HHMMSS.sql.gz"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: Restoring will overwrite existing data in the 'dvt_talent' database!"
read -r -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
    echo "Aborted."
    exit 0
fi

echo "🔄 Restoring database from: $BACKUP_FILE..."
gunzip -c "$BACKUP_FILE" | docker compose -f "$COMPOSE_FILE" exec -T db \
    psql -U dvt_user -d dvt_talent

echo "✅ Database restore successfully completed."
