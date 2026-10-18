#!/bin/bash
# ============================================================
# DVT Talent AI — Automated PostgreSQL Database Backup Script
# Usage: ./scripts/backup_db.sh
# Can be run manually or configured in crontab (daily)
# ============================================================
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-/opt/dvt-talent-ai/docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-/opt/dvt-talent-ai/backups/postgres}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dvt_talent_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

mkdir -p "$BACKUP_DIR"

echo "📦 Creating PostgreSQL backup..."
docker compose -f "$COMPOSE_FILE" exec -T db \
    pg_dump -U dvt_user -d dvt_talent --clean --if-exists | gzip > "$BACKUP_FILE"

echo "✅ Backup successfully created: $BACKUP_FILE"
echo "📏 Size: $(du -h "$BACKUP_FILE" | cut -f1)"

# Prune backups older than RETENTION_DAYS
echo "🧹 Pruning backups older than ${RETENTION_DAYS} days..."
find "$BACKUP_DIR" -type f -name "dvt_talent_*.sql.gz" -mtime +${RETENTION_DAYS} -delete
echo "✨ Backup routine finished successfully."
