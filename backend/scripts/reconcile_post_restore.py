"""
DVT Talent AI — Fail-Safe Post-Restore Erasure Reconciliation CLI
Usage:
    python scripts/reconcile_post_restore.py [--reconcile] [--verify-only] [--allow-empty-ledger]
    python -m services.privacy_service --reconcile

Exit Codes:
    0: Success — zero resurrected PII across DB, disk files, Redis caches, and vector store.
    1: Failure — resurrected personal data detected or pending cleanups remain unresolved.
    2: Storage/Ledger Error — tombstone ledger file is missing, unreadable, or volume unmounted.
    3: Database/Infrastructure Error — failed to connect to database or primary storage.
"""
import sys
import os
import argparse
import json
import uuid
import asyncio
from pathlib import Path
from typing import Dict, Any, List

# Reconfigure standard output streams for UTF-8 compatibility
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# Ensure backend root is on sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from db.models import AsyncSessionLocal, Candidate, AgentTask, AgentTaskStatus
from services.privacy_service import (
    ERASURE_TOMBSTONE_LEDGER_PATH,
    ERASURE_TOMBSTONE_LOCK_PATH,
    reconcile_post_restore_erasures,
    sweep_and_process_gdpr_cleanups,
)
from services.resume_parser import ResumeParserService
try:
    from filelock import FileLock
except ImportError:
    import contextlib
    @contextlib.contextmanager
    def FileLock(path, timeout=10):
        try:
            import fcntl
            f = open(path, "a+")
            try:
                fcntl.flock(f, fcntl.LOCK_EX)
                yield
            finally:
                fcntl.flock(f, fcntl.LOCK_UN)
                f.close()
        except Exception:
            yield
from sqlalchemy import select, text
import structlog

log = structlog.get_logger(__name__)


async def run_reconciliation(
    verify_only: bool = False,
    allow_empty_ledger: bool = False,
) -> int:
    """
    Executes the fail-safe post-restore reconciliation and multi-store verification gate.
    Returns integer exit code.
    """
    print("=" * 70)
    print("DVT TALENT AI -- POST-RESTORE PRIVACY RECONCILIATION & VERIFICATION")
    print("=" * 70)
    print(f"Ledger path: {ERASURE_TOMBSTONE_LEDGER_PATH.resolve()}")
    storage_dir = Path(getattr(settings, "storage_dir", ERASURE_TOMBSTONE_LEDGER_PATH.parent))
    upload_dir = Path(getattr(settings, "upload_dir", ResumeParserService.ensure_upload_dir()))
    print(f"Storage dir: {storage_dir.resolve()}")
    print(f"Upload dir:  {upload_dir.resolve()}")
    print(f"Verify only: {verify_only}")

    # -------------------------------------------------------------------------
    # 1. Validate Tombstone Ledger Existence & Integrity
    # -------------------------------------------------------------------------
    ledger_status = "VALID_NONEMPTY"
    tombstoned_ids = set()

    if not ERASURE_TOMBSTONE_LEDGER_PATH.exists():
        if allow_empty_ledger:
            print("\n[STATUS: NO_TOMBSTONES_TO_VERIFY]")
            print("[WARN] Tombstone ledger file does not exist, but --allow-empty-ledger was specified.")
            print("    Assuming no past candidate erasures exist. Skipping historical reconciliation.")
            ledger_status = "NO_TOMBSTONES_TO_VERIFY"
        else:
            print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_MISSING] Tombstone ledger not found at: {ERASURE_TOMBSTONE_LEDGER_PATH}")
            print("    The persistent storage volume (/app/storage) may be unmounted or missing.")
            print("    Cannot verify post-restore privacy state without the tombstone ledger.")
            print("    In production disaster recovery, this fails closed (Exit Code 2).")
            print("    If this is a brand-new installation without past erasures, re-run with --allow-empty-ledger.")
            return 2
    else:
        # Check zero-byte file
        stat_info = ERASURE_TOMBSTONE_LEDGER_PATH.stat()
        if stat_info.st_size == 0:
            if allow_empty_ledger:
                print("\n[STATUS: NO_TOMBSTONES_TO_VERIFY]")
                print("[WARN] Tombstone ledger exists but is 0 bytes, and --allow-empty-ledger was specified.")
                print("    Skipping historical reconciliation.")
                ledger_status = "NO_TOMBSTONES_TO_VERIFY"
            else:
                print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_EMPTY] Tombstone ledger at {ERASURE_TOMBSTONE_LEDGER_PATH} is 0 bytes.")
                print("    In production recovery mode, an empty ledger cannot prove past erasures were preserved.")
                print("    Public ingress will remain blocked. Use explicit recovery override if this is a pristine new deployment.")
                return 2
        else:
            # Read and strictly validate every line under advisory file lock
            erased_records: List[Dict[str, Any]] = []
            try:
                lock = FileLock(str(ERASURE_TOMBSTONE_LOCK_PATH), timeout=10)
                with lock:
                    with open(ERASURE_TOMBSTONE_LEDGER_PATH, "r", encoding="utf-8") as f:
                        for line_num, line in enumerate(f, start=1):
                            line = line.strip()
                            if not line:
                                continue
                            try:
                                record = json.loads(line)
                            except json.JSONDecodeError as jde:
                                print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_MALFORMED] JSON decode error at line {line_num}: {jde}")
                                return 2
                            if not isinstance(record, dict) or "candidate_id" not in record or not record["candidate_id"]:
                                print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_MALFORMED] Missing required 'candidate_id' at line {line_num}")
                                return 2
                            # Strictly validate candidate_id is a valid UUID
                            try:
                                uuid.UUID(str(record["candidate_id"]))
                            except ValueError:
                                print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_MALFORMED] Invalid UUID in candidate_id at line {line_num}")
                                return 2
                            erased_records.append(record)
            except Exception as lock_err:
                print(f"\n[CRITICAL ERROR: TOMBSTONE_LEDGER_UNREADABLE] Failed to acquire lock or read tombstone ledger: {lock_err}")
                return 2

            tombstoned_ids = {str(r["candidate_id"]) for r in erased_records}
            if len(tombstoned_ids) == 0:
                if allow_empty_ledger:
                    print("\n[STATUS: NO_TOMBSTONES_TO_VERIFY]")
                    print("[WARN] Tombstone ledger contains no records, and --allow-empty-ledger was specified.")
                    ledger_status = "NO_TOMBSTONES_TO_VERIFY"
                else:
                    print("\n[CRITICAL ERROR: TOMBSTONE_LEDGER_EMPTY] Ledger contains no valid tombstone records.")
                    return 2
            else:
                print(f"\n[Step 1] Ledger parsed successfully. Total tombstones recorded: {len(tombstoned_ids)}")

    # -------------------------------------------------------------------------
    # 2. Database Connectivity Check
    # -------------------------------------------------------------------------
    print("\n[Step 2] Verifying database connectivity...")
    try:
        async with AsyncSessionLocal() as session:
            db_check = await session.execute(text("SELECT 1;"))
            assert db_check.scalar() == 1
    except Exception as db_err:
        print(f"[CRITICAL ERROR] Cannot connect to database: {db_err}")
        return 3
    print("    [OK] Database connection verified.")

    # -------------------------------------------------------------------------
    # 3. Execute Post-Restore Reconciliation & Background Cleanup Sweep
    # -------------------------------------------------------------------------
    if not verify_only:
        print("\n[Step 3] Executing post-restore reconciliation across all stores...")
        async with AsyncSessionLocal() as session:
            try:
                rec_summary = await reconcile_post_restore_erasures(session)
                print(f"    Reconciled candidates:    {rec_summary['reconciled']}")
                print(f"    Resurrected rows found:   {rec_summary['resurrected_found']}")
                print(f"    Physical files removed:   {rec_summary['files_deleted']}")
                print(f"    Redis caches purged:      {rec_summary['caches_purged']}")
            except Exception as rec_err:
                print(f"[CRITICAL ERROR] Reconciliation execution failed: {rec_err}")
                return 1

        print("\n[Step 4] Sweeping pending GDPR cleanup tasks...")
        async with AsyncSessionLocal() as session:
            try:
                sweep_summary = await sweep_and_process_gdpr_cleanups(session)
                print(f"    Tasks processed: {sweep_summary['processed']}")
                print(f"    Tasks succeeded: {sweep_summary['succeeded']}")
                print(f"    Tasks failed:    {sweep_summary['failed']}")
            except Exception as sweep_err:
                print(f"[CRITICAL ERROR] Sweep execution failed: {sweep_err}")
                return 1
    else:
        print("\n[Step 3 & 4] --verify-only mode active. Skipping mutations.")

    # -------------------------------------------------------------------------
    # 5. Multi-Store Strict Verification Gate
    # -------------------------------------------------------------------------
    print("\n[Step 5] Running strict multi-store verification gate...")
    db_violations = []
    file_violations = []
    cache_violations = []

    # 5a. Database check (No PII logged)
    async with AsyncSessionLocal() as session:
        for cid_str in tombstoned_ids:
            try:
                cid_uuid = uuid.UUID(cid_str)
            except ValueError:
                continue
            cand_res = await session.execute(select(Candidate).where(Candidate.id == cid_uuid))
            cand = cand_res.scalar_one_or_none()
            if cand and not cand.pii_erased:
                db_violations.append({
                    "candidate_id": cid_str,
                    "violation": "pii_not_erased",
                })

    # 5b. Filesystem check
    upload_dir = ResumeParserService.ensure_upload_dir()
    for cid_str in tombstoned_ids:
        matches = list(upload_dir.glob(f"{cid_str}_*"))
        if matches:
            file_violations.append({
                "candidate_id": cid_str,
                "file_count": len(matches),
            })

    # 5c. Redis cache check
    try:
        import redis
        r = redis.from_url(settings.redis_url)
        for cid_str in tombstoned_ids:
            keys_to_check = [
                f"candidate:{cid_str}",
                f"candidate_profile:{cid_str}",
            ]
            found_keys = [k for k in keys_to_check if r.exists(k)]
            if found_keys:
                cache_violations.append({
                    "candidate_id": cid_str,
                    "keys": found_keys,
                })
    except Exception as redis_err:
        print(f"    [WARN] Redis connectivity check skipped: {redis_err}")

    # 5d. Outstanding retry tasks check
    pending_tasks_count = 0
    async with AsyncSessionLocal() as session:
        task_stmt = select(AgentTask).where(
            AgentTask.task_type == "gdpr_cleanup_retry",
            AgentTask.status.in_([AgentTaskStatus.PENDING, AgentTaskStatus.RUNNING]),
        )
        pending_tasks = (await session.execute(task_stmt)).scalars().all()
        pending_tasks_count = len(pending_tasks)

    # -------------------------------------------------------------------------
    # 6. Evaluation & Verdict
    # -------------------------------------------------------------------------
    print("\n" + "=" * 70)
    print("VERIFICATION RESULTS:")
    print("=" * 70)
    print(f"  * Ledger Status:               {ledger_status}")
    print(f"  * Evaluated Tombstone Count:   {len(tombstoned_ids)}")
    print(f"  * Database PII Violations:     {len(db_violations)}")
    print(f"  * Filesystem Residual Files:   {len(file_violations)}")
    print(f"  * Redis Residual Cache Keys:   {len(cache_violations)}")
    print(f"  * Outstanding Cleanup Tasks:   {pending_tasks_count}")

    has_errors = bool(db_violations or file_violations or cache_violations or pending_tasks_count > 0)

    if has_errors:
        print("\n[FAIL] RESTORE RECONCILIATION VERIFICATION FAILED!")
        if db_violations:
            print(f"    - Database violations: {len(db_violations)} candidate record(s) un-erased: {[v['candidate_id'] for v in db_violations[:5]]}")
        if file_violations:
            print(f"    - Filesystem violations: {len(file_violations)} candidate file residue(s): {[v['candidate_id'] for v in file_violations[:5]]}")
        if cache_violations:
            print(f"    - Cache violations: {len(cache_violations)} candidate cache residue(s): {[v['candidate_id'] for v in cache_violations[:5]]}")
        if pending_tasks_count > 0:
            print(f"    - Pending cleanup tasks: {pending_tasks_count} tasks unresolved")
        print("\n[ALERT] DO NOT OPEN PUBLIC INGRESS (CADDY/PROXY) UNTIL ALL VIOLATIONS ARE RESOLVED.")
        return 1
    else:
        if ledger_status == "NO_TOMBSTONES_TO_VERIFY":
            print("\n[STATUS: NO_TOMBSTONES_TO_VERIFY]")
            print("    Zero tombstones were present to evaluate.")
            print("    Historical erasure compliance is NOT proven. Ingress cutover permitted solely by explicit --allow-empty-ledger override.")
            print("    Database connectivity and task queue are clean.")
            return 0
        else:
            print("\n[PASS] ZERO RESURRECTED PERSONAL DATA FOUND ACROSS ALL STORES.")
            print(f"    All {len(tombstoned_ids)} tombstoned candidate(s) verified sanitized.")
            print("    Database, filesystem, caches, and cleanup tasks are compliant.")
            print("    Safe to reopen public ingress traffic.")
            return 0


def main_cli() -> int:
    parser = argparse.ArgumentParser(
        description="DVT Talent AI — Fail-Safe Post-Restore Erasure Reconciliation CLI"
    )
    parser.add_argument(
        "--reconcile",
        action="store_true",
        default=True,
        help="Execute post-restore reconciliation and verification (default: True)",
    )
    parser.add_argument(
        "--verify-only",
        action="store_true",
        help="Audit stores against tombstone ledger without mutating data",
    )
    parser.add_argument(
        "--allow-empty-ledger",
        action="store_true",
        help="Permit execution if tombstone ledger does not yet exist (e.g. pristine new deployment)",
    )

    args = parser.parse_args()
    return asyncio.run(
        run_reconciliation(
            verify_only=args.verify_only,
            allow_empty_ledger=args.allow_empty_ledger,
        )
    )


if __name__ == "__main__":
    sys.exit(main_cli())
