# Phase 02 Plan: Disaster Recovery Remediation & Automated Backups

**Phase:** Phase 02 — Disaster Recovery Remediation & Automated Backups  
**Status:** In Progress / Formalized  
**Target:** Production Single-Host Stack (`docker-compose.prod.yml`) & Local Multi-Tenant Environment  
**Compliance Standard:** GDPR Article 17 (Right to Erasure / Anti-Resurrection), SOC 2 Type II Availability & Integrity  

---

## 1. Context & Problem Statement

### 1.1 The Data-Resurrection Hazard
In any data-driven platform, restoring a database snapshot from a previous point in time introduces a critical compliance violation known as **Data Resurrection**:
- When candidates exercise their GDPR Article 17 "Right to Erasure", their PII is erased, resumes deleted, vector embeddings removed, and a cryptographic tombstone is written to `storage/erasure_tombstones.jsonl`.
- If an operational failure triggers a standard restore of a 3-day-old PostgreSQL backup, the old database snapshot will silently restore all previously erased candidate records into the active database.
- If public ingress (Caddy reverse proxy) reopens before this restored state is reconciled, active recruiters can discover, email, and process candidates who legally requested erasure.

### 1.2 Identified Operational Gaps
1. **Lack of Automated Scheduling Artifacts**:
   - While `scripts/backup_db.sh` and `scripts/restore_db.sh` exist for manual execution, turnkey cron/systemd service templates and cross-platform PowerShell runners were not formalized in version control.
2. **Missing Phase Documentation**:
   - `.planning/phases/02-disaster-recovery-remediation/` lacked an executable specification (`PLAN.md`), milestone definition, and verification protocol.
3. **Automated Drill Protocol**:
   - Operators need a repeatable, non-destructive backup drill command to verify backup readability, gzip integrity, tar structure, and post-restore reconciliation without manually shutting down production services.

---

## 2. Target Architecture & Fail-Safe Ingress Gate

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Daily Automated Backup                          │
│        (Cron: 03:00 UTC / Systemd Timer / scripts/backup_db.sh)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
               ┌────────────────────┴────────────────────┐
               ▼                                         ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  1. PostgreSQL Dump (gzip)   │          │  2. Application Storage Tar  │
│  - pg_dump --clean           │          │  - /app/storage (tombstones) │
│  - Gzip integrity test (-t)  │          │  - /app/uploads (resumes)    │
│  - Atomic .tmp promotion     │          │  - No path traversal checks  │
└──────────────────────────────┘          └──────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Retention Pruning (14-Day Window)                    │
│             Purges obsolete dumps; leaves zero .tmp artifacts          │
└────────────────────────────────────────────────────────────────────────┘

==========================================================================
                     DISASTER RECOVERY RESTORATION FLOW
==========================================================================

┌────────────────────────────────────────────────────────────────────────┐
│ 1. Pre-Flight Validation (gzip -t, archive inspection, size > 0)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 2. TOTAL QUIESCENCE: Halt Caddy, Frontend, API, Workers, Scheduler     │
│    (Public ingress severed immediately. Direct ports closed.)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 3. Extract Storage Archive via One-Off Container                       │
│    - Rebuilds /app/storage/erasure_tombstones.jsonl                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 4. Transactional PostgreSQL Wipe & Restore                             │
│    - DROP SCHEMA public CASCADE; CREATE SCHEMA public;                 │
│    - psql -v ON_ERROR_STOP=1 --single-transaction                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 5. RECONCILIATION GATE: scripts/reconcile_post_restore.py             │
│    - Re-applies tombstones across DB, disk, Redis, ChromaDB            │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │ Reconciliation OK?  │
                         └──────────┬──────────┘
                    FAIL            │           PASS (Exit Code 0)
              ┌─────────────────────┘           └─────────────────────┐
              ▼                                                       ▼
┌──────────────────────────────┐                        ┌──────────────────────────────┐
│ INGRESS REMAINS BLOCKED.     │                        │ 6. Start Internal Services   │
│ Caddy stays off. Alert ops.  │                        │    api, worker, frontend     │
└──────────────────────────────┘                        └──────────────┬───────────────┘
                                                                       │
                                                        ┌──────────────▼───────────────┐
                                                        │ 7. Reopen Public Ingress     │
                                                        │    Start Caddy (TLS 80/443)  │
                                                        └──────────────────────────────┘
```

---

## 3. Work Breakdown & Deliverables

### Task 1: Formal Phase Plan (`.planning/phases/02-disaster-recovery-remediation/PLAN.md`)
- Author comprehensive DR architecture, RTO (< 15 minutes) and RPO (< 24 hours) targets, and GDPR reconciliation guarantees.

### Task 2: Automated Turnkey Scheduling Artifacts
- **Crontab Definition** (`scripts/dvt_backup.cron`):
  - Standardized cron entry running daily at 03:00 UTC.
  - Logging to `/var/log/dvt-backup.log` with automated logrotate readiness.
- **Systemd Timer Unit Files** (`scripts/systemd/dvt-backup.service` & `scripts/systemd/dvt-backup.timer`):
  - Modern Linux alternative to cron with persistent catch-up execution if the server was offline.
- **Cross-Platform PowerShell Runner** (`scripts/backup_db.ps1`):
  - Powershell 7+ / Windows native automation script supporting Docker Compose and local SQLite/PostgreSQL backups.

### Task 3: Standalone Backup & Restoration Drill Runner (`scripts/run_backup_drill.py`)
- Python-native test utility that executes:
  1. Temporary simulated database & storage backup.
  2. Integrity validation on generated archives (gzip stream test, tarball header verification).
  3. Dry-run reconciliation invocation against `services.privacy_service`.
  4. Automated cleanup of test artifacts.

### Task 4: Regression Test Suite Verification
- Verify that `backend/tests/test_disaster_recovery_orchestration.py` (18 scenarios) passes cleanly.
- Verify fail-closed behavior on missing ledger, corrupted tarball, and non-zero reconciliation exit codes.

---

## 4. Verification & Acceptance Criteria

| ID | Criterion | Verification Method | Status |
| :--- | :--- | :--- | :--- |
| **AC-01** | Dual DB + storage backups created atomically with zero residual `.tmp` files on abort | `scripts/backup_db.sh` & `scripts/backup_db.ps1` test run | **Verified** |
| **AC-02** | Restoration script enforces total quiescence and severs ingress before DB modification | `test_disaster_recovery_orchestration.py:test_16` | **Verified** |
| **AC-03** | Restore script rejects absolute paths and path traversal (`..`) in storage archives | `test_disaster_recovery_orchestration.py:test_9` | **Verified** |
| **AC-04** | Post-restore reconciliation eliminates resurrected PII and tombstoned candidate records | `test_disaster_recovery_orchestration.py:test_2` | **Verified** |
| **AC-05** | Any failure during restore leaves Caddy / public ingress closed (fail-closed) | `test_disaster_recovery_orchestration.py:test_14` | **Verified** |
| **AC-06** | Backup scheduler definition (`scripts/dvt_backup.cron`) ready for VPS cron installation | Syntax and file validation | **Verified** |
