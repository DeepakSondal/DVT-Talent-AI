# DVT Talent AI — Disaster Recovery & Backup Restoration SOP

**Document ID:** SOP-OPS-004  
**Classification:** Operational Security & Reliability  
**Target Architecture:** Single-Host Production Stack (`docker-compose.prod.yml`)  
**Compliance Mandate:** GDPR Article 17 (Right to Erasure / Data-Resurrection Prevention)

---

## 1. Supported Deployment Topology & Boundary Constraints

### 1.1 Single-Host Production Topology (Current Supported Configuration)
The default production configuration specified in `docker-compose.prod.yml` runs on an **explicitly single-host virtual machine / bare-metal server**:
* **Shared Persistent Volumes:**
  * `dvt_storage:/app/storage` (holds `erasure_tombstones.jsonl`, `.lock` file, and Celery beat persistent schedule).
  * `dvt_uploads:/app/uploads` (holds raw resume files).
  * `postgres_data:/var/lib/postgresql/data`.
  * `chroma_data:/chroma/chroma`.
  * `caddy_data` and `caddy_config`.
* **Inter-Process Concurrency:** Single-host concurrency across `api`, `worker`, and `scheduler` containers is guaranteed by POSIX advisory file locks (`filelock.FileLock`) and kernel page sync (`os.fsync`) operating on the shared Docker named volume.

### 1.2 Multi-Host / Horizontally Scaled Deployments (Future Architecture)
If DVT Talent AI scales horizontally across multiple virtual machines or a Kubernetes cluster:
* **Why Local Named Volumes and FileLocks are Insufficient:** A local Docker named volume or standard POSIX file lock cannot span physical node boundaries. Concurrent workers on separate hosts writing to separate local files would bifurcate the tombstone ledger, causing silent data resurrection if one host restores without the other host's ledger.
* **Required Multi-Host Architecture:**
  1. **Transactional Audit Database:** An independent, append-only PostgreSQL database/table or CockroachDB cluster with insert-only permissions, row-level signing, and synchronous replication.
  2. **Immutable Cloud Object Storage:** An AWS S3 / Cloudflare R2 bucket configured with **Object Lock in Compliance Mode** (WORM — Write Once, Read Many) combined with distributed locking via Redis Redlock or AWS DynamoDB lock provider.
  *Note: A standard NFS / EFS network mount MUST NOT be assumed to provide POSIX file lock atomicity without explicit lock-manager verification.*

---

## 2. Disaster Recovery & Backup Restoration Procedure

Restoring an older PostgreSQL database backup introduces the severe compliance risk of **data resurrection**: candidates who exercised their GDPR Article 17 right to erasure *after* the backup snapshot was taken will have their erased personal data, email, resume files, and search embeddings restored into active systems.

To prevent GDPR violations, **public ingress MUST remain closed** until post-restore reconciliation has verified zero resurrected personal data.

### 2.1 Restoration Sequence (Fail-Safe Gate)

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Pre-Flight Integrity Check: Validate DB gzip & storage tar safely    │
│    (Verify gzip, archive readability, reject directory traversal/root) │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 2. Total Quiescence: Stop Caddy, Frontend, API, Worker, Scheduler      │
│    (Public ingress severed, direct port paths closed, 0 active writers)│
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 3. Storage Restoration via One-Off Container                           │
│    `docker compose run --rm -T -u 0 --no-deps api tar -xzf - -C /app`  │
│    (Enforce UID:GID 1001:1001 ownership and secure permissions)        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 4. Terminate Active Connections & Wipe Target Public Schema            │
│    `DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public...`     │
│    (Guarantees tables/objects created after backup cannot survive)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 5. Transactional PostgreSQL Restore                                    │
│    `psql -v ON_ERROR_STOP=1 --single-transaction`                      │
│    (Halts immediately on first SQL error; zero partial application)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│ 6. Run Post-Restore Erasure Reconciliation Gate via One-Off Container   │
│    `docker compose run --rm -T api python scripts/reconcile_post_...`  │
│    (Re-sanitizes resurrected PII across DB, disk, Redis, vector lake)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         ┌──────────┴──────────┐
                         │ Verification Pass?  │
                         └──────────┬──────────┘
                     NO / Failure   │   YES / Exit Code 0
               ┌────────────────────┘   └────────────────────┐
               ▼                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│ Ingress REMAINS BLOCKED.     │              │ 7. Controlled Service Start  │
│ All app services stay halted.│              │    Start api, worker, sched, │
│ Failure trap protects state. │              │    frontend; test /health    │
└──────────────────────────────┘              └──────────────┬───────────────┘
                                                             │
                                              ┌──────────────▼───────────────┐
                                              │ 8. Reopen Public Ingress     │
                                              │    Start Caddy               │
                                              └──────────────────────────────┘
```

---

## 3. Step-by-Step Operator Runbook

### 3.1 Standard Automated Restoration (Recommended)
The automated restore script manages ingress blocking, pre-flight safety checks, storage archive extraction, database restoration, post-restore reconciliation, worker resumption, and health verification:

```bash
# Case A: Standard Database-Only Restore (reconciles against existing mounted storage)
./scripts/restore_db.sh /opt/dvt-talent-ai/backups/postgres/dvt_talent_YYYYMMDD_HHMMSS.sql.gz

# Case B: Full Database & Storage Restore (restores tombstones & uploaded resumes into volumes)
./scripts/restore_db.sh \
    /opt/dvt-talent-ai/backups/postgres/dvt_talent_YYYYMMDD_HHMMSS.sql.gz \
    /opt/dvt-talent-ai/backups/storage/storage_YYYYMMDD_HHMMSS.tar.gz
```

### 3.2 Total Host / Volume Loss Recovery (Bare-Metal Disaster Recovery)
If the host server or all Docker persistent named volumes (`dvt_storage`, `dvt_uploads`, `postgres_data`) are completely destroyed:

1. **Deploy Compose Stack:** Clone repository and prepare environment files on the new host machine:
   ```bash
   cd /opt/dvt-talent-ai
   # Ensure docker-compose.prod.yml and backend/.env are configured
   ```
2. **Initialize Infrastructure Containers:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d db redis chromadb api
   ```
3. **Execute Full Restore with Both Archives:**
   ```bash
   ./scripts/restore_db.sh \
       /path/to/dvt_talent_YYYYMMDD_HHMMSS.sql.gz \
       /path/to/storage_YYYYMMDD_HHMMSS.tar.gz
   ```
   * The script pre-validates archive gzip integrity and ensures entries are constrained to `storage/` and `uploads/` (rejecting absolute paths, directory traversal `..`, and device nodes).
   * It extracts the storage archive into the mounted volumes (`dvt_storage` and `dvt_uploads`), sets `chown 1001:1001`, and restores the PostgreSQL database.
   * It runs `reconcile_post_restore.py`. If past tombstoned candidates were erased, any resurrected records are purged.
   * Workers and scheduler are resumed, health is checked, and Caddy ingress is opened.

### 3.3 Empty Ledger & Missing Ledger Safety Gate
The reconciliation script distinguishes five distinct ledger states:
* `VALID_NONEMPTY`: Ledger contains 1+ valid UUID tombstone records. Multi-store sanitization is verified.
* `TOMBSTONE_LEDGER_MISSING`: File does not exist. Fails closed with **Exit Code 2**. Ingress remains blocked.
* `TOMBSTONE_LEDGER_EMPTY`: File exists but is 0 bytes. In production recovery, an empty ledger cannot prove past erasures were preserved. Fails closed with **Exit Code 2**. Ingress remains blocked.
* `TOMBSTONE_LEDGER_MALFORMED`: File contains invalid JSON, missing `candidate_id`, or non-UUID values. Fails closed with **Exit Code 2**. Ingress remains blocked.
* `TOMBSTONE_LEDGER_UNREADABLE`: File cannot be locked or read. Fails closed with **Exit Code 2**. Ingress remains blocked.

#### Pristine Deployment Override:
For brand-new environments with no historical candidate records, the operator may explicitly pass `--allow-empty-ledger` to bypass the missing/empty check:
```bash
docker compose -f docker-compose.prod.yml exec -T api \
    python scripts/reconcile_post_restore.py --allow-empty-ledger
```
When this override is used, the script emits status `NO_TOMBSTONES_TO_VERIFY` and does not claim affirmative GDPR Article 17 historical compliance.

#### Exit Code Contract:
* `0`: **SUCCESS** — All tombstoned candidates reconciled; 0 resurrected PII records found across DB, filesystem, and Redis; zero outstanding cleanup tasks. Safe to open ingress.
* `1`: **FAILURE** — Resurrected data detected or background cleanup tasks unresolved. Ingress MUST remain blocked.
* `2`: **STORAGE ERROR** — Tombstone ledger missing, empty, malformed, or unreadable. Ingress MUST remain blocked.
* `3`: **DATABASE ERROR** — Database connection failed. Ingress MUST remain blocked.

---

## 4. Operational Boundaries & Non-Atomic Guarantee Disclosure

1. **Non-Atomic Multi-Engine Restoration:** Database restoration (`psql`) and storage extraction (`tar`) operate across distinct physical storage engines (PostgreSQL relational tables vs Docker ext4 volume files). They are **sequentially coordinated**, not distributed-transaction atomic.
2. **Fail-Closed Ingress Protection:** If storage extraction succeeds but database restoration fails (or vice versa), the script halts immediately, leaving public ingress (Caddy) stopped and Celery workers halted. No user or external request can reach partial state.
3. **Strict Idempotency:** The entire restore and reconciliation sequence can safely be repeated once the underlying infrastructure issue is resolved. No records or files are corrupted by repeated execution.
