#!/bin/bash
# ============================================================
# DVT Talent AI — Disaster Recovery Restore Script
# Usage: ./scripts/restore_db.sh <database_backup.sql.gz> [storage_backup.tar.gz]
# ============================================================
set -Eeuo pipefail
export MSYS_NO_PATHCONV=1

COMPOSE_FILE="${COMPOSE_FILE:-/opt/dvt-talent-ai/docker-compose.prod.yml}"
DB_NAME="${DB_NAME:-dvt_talent}"
DB_USER="${DB_USER:-dvt_user}"

usage() {
    echo "Usage: $0 <path_to_db_backup.sql.gz> [path_to_storage_backup.tar.gz]"
    echo ""
    echo "Arguments:"
    echo "  database_backup.sql.gz   (Required) Gzipped PostgreSQL dump"
    echo "  storage_backup.tar.gz    (Optional) Tar-gzipped application storage (tombstones & uploads)"
    exit 1
}

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
    echo "❌ Error: Invalid number of arguments."
    usage
fi

DB_BACKUP_FILE="$1"
STORAGE_BACKUP_FILE="${2:-}"

# ------------------------------------------------------------
# Pre-Flight Validation (Before Any Destructive Operations / Service Shutdown)
# ------------------------------------------------------------

echo "🔍 Validating backup files and archive integrity..."

# 1. Validate Database Backup File
if [ ! -f "$DB_BACKUP_FILE" ]; then
    echo "❌ Error: Database backup file not found: $DB_BACKUP_FILE"
    exit 1
fi

if [ ! -r "$DB_BACKUP_FILE" ]; then
    echo "❌ Error: Database backup file is not readable: $DB_BACKUP_FILE"
    exit 1
fi

if [ ! -s "$DB_BACKUP_FILE" ]; then
    echo "❌ Error: Database backup file is 0 bytes: $DB_BACKUP_FILE"
    exit 1
fi

if ! gzip -t "$DB_BACKUP_FILE" 2>/dev/null; then
    echo "❌ Error: Database backup failed gzip integrity check (corrupt or incomplete archive): $DB_BACKUP_FILE"
    exit 1
fi

# 2. Validate Storage Archive (if provided)
if [ -n "$STORAGE_BACKUP_FILE" ]; then
    if [ ! -f "$STORAGE_BACKUP_FILE" ]; then
        echo "❌ Error: Storage backup file not found: $STORAGE_BACKUP_FILE"
        exit 1
    fi

    if [ ! -r "$STORAGE_BACKUP_FILE" ]; then
        echo "❌ Error: Storage backup file is not readable: $STORAGE_BACKUP_FILE"
        exit 1
    fi

    if [ ! -s "$STORAGE_BACKUP_FILE" ]; then
        echo "❌ Error: Storage backup file is 0 bytes: $STORAGE_BACKUP_FILE"
        exit 1
    fi

    if ! gzip -t "$STORAGE_BACKUP_FILE" 2>/dev/null; then
        echo "❌ Error: Storage backup failed gzip integrity check: $STORAGE_BACKUP_FILE"
        exit 1
    fi

    echo "🛡️  Inspecting storage archive for path safety (no traversal, no absolute paths)..."
    STORAGE_TOC=$(tar --force-local -tzf "$STORAGE_BACKUP_FILE" 2>/dev/null || tar -tzf "$STORAGE_BACKUP_FILE" 2>/dev/null || true)
    if [ -z "$STORAGE_TOC" ]; then
        echo "❌ Error: Storage archive contains no files: $STORAGE_BACKUP_FILE"
        exit 1
    fi

    while IFS= read -r entry; do
        [ -z "$entry" ] && continue

        # Reject absolute paths
        case "$entry" in
            /*)
                echo "❌ Security Error: Storage archive contains forbidden absolute path: $entry"
                exit 1
                ;;
        esac

        # Reject directory traversal
        case "$entry" in
            *../*|*..|*/..|*/../*)
                echo "❌ Security Error: Storage archive contains forbidden traversal path: $entry"
                exit 1
                ;;
        esac

        # Verify allowed path prefixes only
        case "$entry" in
            storage|storage/*|uploads|uploads/*)
                ;;
            *)
                echo "❌ Security Error: Storage archive contains unexpected path outside storage/ or uploads/: $entry"
                exit 1
                ;;
        esac
    done <<< "$STORAGE_TOC"

    # Reject dangerous special files and unsafe symlink targets
    STORAGE_DETAILED=$(tar --force-local -tvzf "$STORAGE_BACKUP_FILE" 2>/dev/null || tar -tvzf "$STORAGE_BACKUP_FILE" 2>/dev/null || true)
    while IFS= read -r line; do
        [ -z "$line" ] && continue
        type_char="${line:0:1}"
        case "$type_char" in
            -|d|h)
                ;;
            l)
                link_target=$(echo "$line" | sed -n 's/.* -> //p')
                case "$link_target" in
                    /*|*../*|*..|*/..|*/../*)
                        echo "❌ Security Error: Storage archive contains forbidden symlink target: $line"
                        exit 1
                        ;;
                esac
                ;;
            *)
                echo "❌ Security Error: Storage archive contains forbidden special file type: $line"
                exit 1
                ;;
        esac
    done <<< "$STORAGE_DETAILED"

    echo "✅ Storage archive passed all path and integrity security checks."
fi

# Confirmation Prompt
echo ""
echo "⚠️  WARNING: Restoring will overwrite active data in the '$DB_NAME' database"
if [ -n "$STORAGE_BACKUP_FILE" ]; then
    echo "⚠️  and overwrite persistent application storage (/app/storage and /app/uploads)!"
else
    echo "⚠️  and reconcile against the current persistent storage volume (/app/storage)!"
fi

if [ "${NON_INTERACTIVE:-0}" != "1" ] && [ "${CONFIRM:-}" != "RESTORE" ]; then
    read -r -p "Type 'RESTORE' to confirm: " CONFIRM_INPUT
    if [ "$CONFIRM_INPUT" != "RESTORE" ]; then
        echo "Aborted."
        exit 0
    fi
fi

# Failure alert handler (guarantees Caddy is NEVER restarted on error)
on_restore_failure() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        echo "🚨 ================================================================="
        echo "🚨 CRITICAL ERROR: RESTORATION FAILED WITH EXIT CODE $exit_code"
        echo "🚨 PUBLIC INGRESS REMAINS BLOCKED (Caddy stopped)."
        echo "🚨 Application services (api, frontend, worker, scheduler) remain stopped."
        echo "🚨 System is in a protected maintenance state to prevent data resurrection."
        echo "🚨 ================================================================="
    fi
    exit $exit_code
}
trap on_restore_failure EXIT

COMPOSE_CMD=(docker compose)
if [ -n "${COMPOSE_PROJECT_NAME:-}" ]; then
    COMPOSE_CMD+=( -p "$COMPOSE_PROJECT_NAME" )
fi
COMPOSE_CMD+=( -f "$COMPOSE_FILE" )

# ------------------------------------------------------------
# Execution Sequence
# ------------------------------------------------------------

echo ""
echo "🛡️  Step 1: Quiescing all application services and severing public ingress..."
# Stop Caddy, frontend, api, worker, and scheduler to guarantee zero application writers
"${COMPOSE_CMD[@]}" stop caddy frontend api worker scheduler || true

# Step 2: Storage Archive Extraction via Ephemeral One-off Container (if provided)
if [ -n "$STORAGE_BACKUP_FILE" ]; then
    echo "📦 Step 2: Extracting application storage archive into mounted volumes via one-off container..."
    cat "$STORAGE_BACKUP_FILE" | "${COMPOSE_CMD[@]}" run --rm -T -u 0 --no-deps api tar -xzf - -C /app
    
    echo "🔒 Step 2b: Enforcing UID:GID 1001:1001 ownership and secure permissions..."
    "${COMPOSE_CMD[@]}" run --rm -T -u 0 --no-deps api chown -R 1001:1001 /app/storage /app/uploads
    "${COMPOSE_CMD[@]}" run --rm -T -u 0 --no-deps api chmod -R u+rwX,g+rX /app/storage /app/uploads
    echo "✅ Storage restoration completed successfully."
else
    echo "ℹ️  Step 2: No storage archive specified; retaining existing persistent volume data."
fi

# Step 3: Database Preparation & Transactional Restore
echo "🛡️  Step 3a: Terminating existing active connections to '$DB_NAME'..."
"${COMPOSE_CMD[@]}" exec -T db psql -U "$DB_USER" -d postgres -c \
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" 2>/dev/null || true

echo "🧹 Step 3b: Wiping target schema to eliminate stale objects not present in backup..."
"${COMPOSE_CMD[@]}" exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" -d "$DB_NAME" -c \
    "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION $DB_USER; GRANT ALL ON SCHEMA public TO $DB_USER;"

echo "🔄 Step 3c: Restoring PostgreSQL database with strict transactional error halting..."
gunzip -c "$DB_BACKUP_FILE" | "${COMPOSE_CMD[@]}" exec -T db \
    psql -v ON_ERROR_STOP=1 --single-transaction -U "$DB_USER" -d "$DB_NAME"

echo "🧹 Step 4: Executing fail-safe post-restore erasure reconciliation gate via one-off container..."
if ! "${COMPOSE_CMD[@]}" run --rm -T api python scripts/reconcile_post_restore.py; then
    echo ""
    echo "❌ CRITICAL SECURITY ERROR: Post-restore reconciliation failed!"
    echo "   Resurrected personal data was detected or cleanup tasks remain incomplete."
    echo "   PUBLIC INGRESS REMAINS BLOCKED (Caddy stopped) to prevent GDPR Article 17 violations."
    echo "   Application containers remain stopped."
    echo "   Investigate logs and re-run:"
    echo "       ${COMPOSE_CMD[*]} run --rm -T api python scripts/reconcile_post_restore.py"
    exit 1
fi

echo "🚀 Step 5: Starting application services in controlled sequence..."
"${COMPOSE_CMD[@]}" start api frontend worker scheduler

echo "🩺 Step 6: Verifying application health check..."
HEALTH_OK=0
for i in $(seq 1 15); do
    if "${COMPOSE_CMD[@]}" exec -T api curl -s -f http://localhost:8000/health > /dev/null 2>&1; then
        HEALTH_OK=1
        break
    fi
    sleep 2
done

if [ "$HEALTH_OK" -ne 1 ]; then
    echo "❌ Health check verification failed! Application did not respond with 200 OK."
    exit 1
fi
echo "✅ Application health check passed."

echo "🌐 Step 7: Reopening public ingress traffic..."
"${COMPOSE_CMD[@]}" start caddy

echo ""
echo "✅ Disaster recovery restoration, reconciliation, and ingress cutover successfully completed."
