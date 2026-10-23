"""
DVT Talent AI — Disaster Recovery Orchestration & Safety Test Suite
Verifies:
1. Valid nonempty ledger with no resurrected records.
2. Tombstone with synthetic resurrected database PII.
3. Tombstone with synthetic resume file and cache entry.
4. Missing ledger (fails closed exit 2 without override).
5. Zero-byte ledger (fails closed exit 2 without override).
6. Malformed and truncated ledger (fails closed exit 2).
7. Missing storage archive validation.
8. Corrupted storage archive validation.
9. Storage archive traversal and unexpected path rejection.
10. Storage extraction failure leaves ingress blocked.
11. Database restore failure leaves ingress blocked.
12. Reconciliation failure leaves ingress blocked.
13. Health-check failure leaves ingress blocked.
14. Confirmation that every failure path leaves ingress blocked.
15. Full recovery staging workflow orchestration.
"""
import sys
import os
import io
import gzip
import tarfile
import uuid
import json
import shutil
import subprocess
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from db.models import Candidate, CandidateStatus, Tenant, AgentTask, AgentTaskStatus
from services.privacy_service import (
    ERASURE_TOMBSTONE_LEDGER_PATH,
    record_erasure_tombstone,
)
from services.resume_parser import ResumeParserService
from scripts.reconcile_post_restore import run_reconciliation

GIT_BASH_PATHS = [
    r"C:\Program Files\Git\bin\bash.exe",
    r"C:\Program Files\Git\usr\bin\bash.exe",
    "bash",
]

def find_bash_executable():
    for p in GIT_BASH_PATHS:
        if Path(p).is_file():
            return p
        if shutil.which(p):
            return shutil.which(p)
    return None

BASH_EXE = find_bash_executable()


# =============================================================================
# PART 1: RECONCILIATION & EMPTY-LEDGER TESTS (PYTHON DIRECT EXECUTION)
# =============================================================================

@pytest.mark.asyncio
async def test_1_valid_nonempty_ledger_clean(tmp_path, db_session):
    """
    1. Valid nonempty ledger with no resurrected records returns exit code 0.
    """
    cand_id = uuid.uuid4()
    ledger_file = tmp_path / "tombstones.jsonl"
    lock_file = tmp_path / "tombstones.lock"
    
    with open(ledger_file, "w", encoding="utf-8") as f:
        f.write(json.dumps({"candidate_id": str(cand_id), "erased_at": "2026-10-22T00:00:00Z"}) + "\n")

    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", ledger_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        code = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code == 0


@pytest.mark.asyncio
async def test_2_tombstone_synthetic_resurrected_db_pii(tmp_path, db_session):
    """
    2. A tombstone with synthetic resurrected database PII fails verify-only (exit 1),
    and is sanitized during standard reconciliation (exit 0).
    """
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Resurrect Tenant {run_id}")
    db_session.add(tenant)
    await db_session.commit()

    cand = Candidate(
        id=cand_id,
        tenant_id=tenant_id,
        first_name="Synthetic",
        last_name=f"Resurrected {run_id}",
        email=f"synthetic.{run_id}@test.local",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )
    db_session.add(cand)
    await db_session.commit()

    ledger_file = tmp_path / "tombstones.jsonl"
    lock_file = tmp_path / "tombstones.lock"
    with open(ledger_file, "w", encoding="utf-8") as f:
        f.write(json.dumps({"candidate_id": str(cand_id), "erased_at": "2026-10-22T00:00:00Z"}) + "\n")

    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", ledger_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file), \
         patch("services.privacy_service.ERASURE_TOMBSTONE_LEDGER_PATH", ledger_file), \
         patch("services.privacy_service.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        
        # Verify-only mode catches the un-erased row
        verify_code = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert verify_code == 1

        # Standard reconciliation cleanses row
        clean_code = await run_reconciliation(verify_only=False, allow_empty_ledger=False)
        assert clean_code == 0

        # Confirm DB state is sanitized
        await db_session.refresh(cand)
        assert cand.pii_erased is True
        assert cand.first_name == "Erased"

        # Cleanup synthetic row in proper dependency order
        await db_session.delete(cand)
        await db_session.commit()
        await db_session.delete(tenant)
        await db_session.commit()


@pytest.mark.asyncio
async def test_3_tombstone_synthetic_resume_file_and_cache(tmp_path, db_session):
    """
    3. A tombstone with synthetic resume file and cache entry is detected and cleaned.
    """
    run_id = uuid.uuid4().hex[:8]
    cand_id = uuid.uuid4()
    resume_id = uuid.uuid4()

    # Create dummy resume file
    file_path = ResumeParserService.save_resume_file(
        str(cand_id), str(resume_id), f"test_resurrect_{run_id}.pdf", b"TEST CONTENT"
    )
    assert Path(file_path).exists()

    ledger_file = tmp_path / "tombstones.jsonl"
    lock_file = tmp_path / "tombstones.lock"
    with open(ledger_file, "w", encoding="utf-8") as f:
        f.write(json.dumps({"candidate_id": str(cand_id), "erased_at": "2026-10-22T00:00:00Z"}) + "\n")

    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", ledger_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file), \
         patch("services.privacy_service.ERASURE_TOMBSTONE_LEDGER_PATH", ledger_file), \
         patch("services.privacy_service.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):

        # Verify-only catches the file
        verify_code = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert verify_code == 1

        # Standard reconciliation unlinks file
        clean_code = await run_reconciliation(verify_only=False, allow_empty_ledger=False)
        assert clean_code == 0
        assert Path(file_path).exists() is False


@pytest.mark.asyncio
async def test_4_missing_ledger_fails_closed(tmp_path):
    """
    4. Missing ledger returns Exit Code 2 without override, Exit 0 with NO_TOMBSTONES_TO_VERIFY when overridden.
    """
    non_existent = tmp_path / "does_not_exist.jsonl"
    lock_file = tmp_path / "tombstones.lock"

    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", non_existent), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        
        # Fails closed in production
        code_fail = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code_fail == 2

        # Override allows test execution
        code_override = await run_reconciliation(verify_only=True, allow_empty_ledger=True)
        assert code_override == 0


@pytest.mark.asyncio
async def test_5_zero_byte_ledger_fails_closed(tmp_path):
    """
    5. Zero-byte ledger returns Exit Code 2 without override, Exit 0 with override.
    """
    empty_file = tmp_path / "empty_tombstones.jsonl"
    empty_file.write_text("", encoding="utf-8")
    lock_file = tmp_path / "tombstones.lock"

    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", empty_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        
        # Fail closed on zero-byte ledger
        code_fail = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code_fail == 2

        # Override permits with explicit notice
        code_override = await run_reconciliation(verify_only=True, allow_empty_ledger=True)
        assert code_override == 0


@pytest.mark.asyncio
async def test_6_malformed_and_truncated_ledger_fails_closed(tmp_path):
    """
    6. Malformed JSON, missing candidate_id, or non-UUID candidate_id returns Exit Code 2.
    """
    lock_file = tmp_path / "tombstones.lock"

    # 6a. Corrupted JSON line
    bad_json_file = tmp_path / "bad_json.jsonl"
    bad_json_file.write_text('{"candidate_id": "valid"}\n{NOT VALID JSON\n', encoding="utf-8")
    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", bad_json_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        code1 = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code1 == 2

    # 6b. Missing candidate_id field
    missing_id_file = tmp_path / "missing_id.jsonl"
    missing_id_file.write_text(json.dumps({"erased_at": "2026-10-22"}) + "\n", encoding="utf-8")
    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", missing_id_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        code2 = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code2 == 2

    # 6c. Non-UUID candidate_id
    bad_uuid_file = tmp_path / "bad_uuid.jsonl"
    bad_uuid_file.write_text(json.dumps({"candidate_id": "not-a-valid-uuid-1234"}) + "\n", encoding="utf-8")
    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", bad_uuid_file), \
         patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LOCK_PATH", lock_file):
        code3 = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert code3 == 2


# =============================================================================
# PART 2: RESTORE SCRIPT SHELL ORCHESTRATION TESTS
# =============================================================================

def create_valid_dummy_sql_gz(dest_path: Path):
    with gzip.open(dest_path, "wb") as f:
        f.write(b"SELECT 1;\n")

def create_tar_gz_with_files(dest_path: Path, entries: dict):
    """
    entries: dict of relative_path -> bytes
    """
    with tarfile.open(dest_path, "w:gz") as tar:
        for rel_path, content in entries.items():
            ti = tarfile.TarInfo(name=rel_path)
            ti.size = len(content)
            tar.addfile(ti, io.BytesIO(content))


def run_restore_script_with_mocks(
    tmp_path: Path,
    db_backup: Path,
    storage_backup: Path = None,
    fail_on: str = None,  # 'docker_tar', 'docker_psql', 'reconcile', 'health'
):
    """
    Executes scripts/restore_db.sh under Bash with mock docker executable that logs calls.
    Returns (returncode, stdout, stderr, docker_call_log)
    """
    if not BASH_EXE:
        pytest.skip("Git Bash executable not found on host.")

    script_path = BASE_DIR.parent / "scripts" / "restore_db.sh"
    bin_dir = tmp_path / "mock_bin"
    bin_dir.mkdir(parents=True, exist_ok=True)
    log_file = tmp_path / "docker_calls.log"

    # Create mock docker binary
    mock_docker = bin_dir / "docker"
    # Bash script for mock docker
    docker_script = f"""#!/bin/bash
if [ ! -t 0 ]; then
    cat > /dev/null
fi
echo "$@" >> "{log_file.as_posix()}"

# Check for failure simulation
if [ "{fail_on}" = "docker_tar" ] && [[ "$*" == *"tar -xzf"* ]]; then
    echo "Simulated tar extraction failure" >&2
    exit 1
fi

if [ "{fail_on}" = "docker_psql" ] && [[ "$*" == *"psql"* ]]; then
    echo "Simulated psql restore failure" >&2
    exit 1
fi

if [ "{fail_on}" = "reconcile" ] && [[ "$*" == *"reconcile_post_restore.py"* ]]; then
    echo "Simulated reconciliation failure" >&2
    exit 1
fi

if [ "{fail_on}" = "health" ] && [[ "$*" == *"curl"* ]]; then
    echo "Simulated healthcheck failure" >&2
    exit 1
fi

exit 0
"""
    mock_docker.write_text(docker_script, encoding="utf-8")

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir.as_posix()}:{env.get('PATH', '')}"
    env["NON_INTERACTIVE"] = "1"
    env["CONFIRM"] = "RESTORE"

    args = [BASH_EXE, script_path.as_posix(), db_backup.as_posix()]
    if storage_backup:
        args.append(storage_backup.as_posix())

    proc = subprocess.run(
        args,
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    
    logged_calls = log_file.read_text(encoding="utf-8") if log_file.exists() else ""
    return proc.returncode, proc.stdout, proc.stderr, logged_calls


def test_7_restore_script_missing_storage_archive(tmp_path):
    """
    7. Missing storage archive fails validation before any destructive operations.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)
    non_existent_storage = tmp_path / "missing_storage.tar.gz"

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, non_existent_storage)
    assert code != 0
    assert "Storage backup file not found" in out or "Storage backup file not found" in err
    assert "start caddy" not in calls


def test_8_restore_script_corrupted_storage_archive(tmp_path):
    """
    8. Corrupted storage archive fails gzip check before execution.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    corrupt_storage = tmp_path / "corrupt_storage.tar.gz"
    corrupt_storage.write_bytes(b"CORRUPT NOT GZIP DATA")

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, corrupt_storage)
    assert code != 0
    assert "failed gzip integrity check" in out or "failed gzip integrity check" in err
    assert "start caddy" not in calls


def test_9_restore_script_archive_traversal_and_unexpected_paths(tmp_path):
    """
    9. Storage archive containing traversal paths (..), absolute paths, or entries outside
    storage/ and uploads/ is rejected with a security error.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    # 9a. Traversal entry
    traversal_storage = tmp_path / "traversal_storage.tar.gz"
    create_tar_gz_with_files(traversal_storage, {"storage/../etc/passwd": b"root:x:0:0"})
    code1, out1, _, calls1 = run_restore_script_with_mocks(tmp_path, db_backup, traversal_storage)
    assert code1 != 0
    assert "forbidden traversal path" in out1
    assert "start caddy" not in calls1

    # 9b. Unexpected path outside storage/ or uploads/
    outside_storage = tmp_path / "outside_storage.tar.gz"
    create_tar_gz_with_files(outside_storage, {"etc/shadow": b"secrets"})
    code2, out2, _, calls2 = run_restore_script_with_mocks(tmp_path, db_backup, outside_storage)
    assert code2 != 0
    assert "unexpected path outside storage/ or uploads/" in out2
    assert "start caddy" not in calls2


def test_10_restore_script_storage_extraction_failure_leaves_ingress_blocked(tmp_path):
    """
    10. Storage extraction failure inside container halts script and leaves Caddy stopped.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    valid_storage = tmp_path / "valid_storage.tar.gz"
    create_tar_gz_with_files(valid_storage, {"storage/tombstones.jsonl": b"{}"})

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, valid_storage, fail_on="docker_tar")
    assert code != 0
    assert "PUBLIC INGRESS REMAINS BLOCKED" in out or "PUBLIC INGRESS REMAINS BLOCKED" in err
    assert "start caddy" not in calls


def test_11_restore_script_database_restore_failure_leaves_ingress_blocked(tmp_path):
    """
    11. Database restore failure halts script and leaves Caddy stopped.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, fail_on="docker_psql")
    assert code != 0
    assert "PUBLIC INGRESS REMAINS BLOCKED" in out or "PUBLIC INGRESS REMAINS BLOCKED" in err
    assert "start caddy" not in calls


def test_12_restore_script_reconciliation_failure_leaves_ingress_blocked(tmp_path):
    """
    12. Reconciliation failure (exit 1) halts script and leaves Caddy stopped.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, fail_on="reconcile")
    assert code != 0
    assert "PUBLIC INGRESS REMAINS BLOCKED" in out or "PUBLIC INGRESS REMAINS BLOCKED" in err
    assert "start caddy" not in calls


def test_13_restore_script_health_check_failure_leaves_ingress_blocked(tmp_path):
    """
    13. Application health check failure halts script and leaves Caddy stopped.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, fail_on="health")
    assert code != 0
    assert "PUBLIC INGRESS REMAINS BLOCKED" in out or "PUBLIC INGRESS REMAINS BLOCKED" in err
    assert "start caddy" not in calls


@pytest.mark.parametrize("failure_stage", ["docker_tar", "docker_psql", "reconcile", "health"])
def test_14_confirmation_that_every_failure_path_leaves_ingress_blocked(tmp_path, failure_stage):
    """
    14. Explicit parameterized confirmation that every failure path guarantees Caddy is NEVER started.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)
    storage_backup = tmp_path / "storage.tar.gz"
    create_tar_gz_with_files(storage_backup, {"storage/tombstones.jsonl": b"{}"})

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, storage_backup, fail_on=failure_stage)
    assert code != 0
    assert "start caddy" not in calls, f"CRITICAL SECURITY DEFECT: start caddy was executed on {failure_stage} failure!"


def test_15_successful_full_recovery_staging_workflow(tmp_path):
    """
    15. Successful full recovery in staging environment:
    - Valid DB backup + valid storage archive.
    - Preflight checks pass.
    - Total application quiescence (Caddy, frontend, api, worker, scheduler stopped).
    - Storage archive extracted and chowned 1001:1001 via one-off ephemeral container.
    - Stale target schema wiped and PostgreSQL restored transactionally.
    - Post-restore reconciliation executed via one-off ephemeral container.
    - Applications started in sequence, healthcheck verified, ingress reopened.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)
    storage_backup = tmp_path / "storage.tar.gz"
    create_tar_gz_with_files(storage_backup, {
        "storage/erasure_tombstones.jsonl": b'{"candidate_id": "00000000-0000-0000-0000-000000000001"}\n',
        "uploads/resumes/dummy.pdf": b"PDF CONTENT"
    })

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, storage_backup, fail_on=None)
    assert code == 0, f"Expected 0, got {code}. Out: {out}, Err: {err}"
    assert "Disaster recovery restoration, reconciliation, and ingress cutover successfully completed." in out

    # Verify strict quiescence call sequence
    assert "stop caddy frontend api worker scheduler" in calls
    assert "run --rm -T -u 0 --no-deps api tar -xzf - -C /app" in calls
    assert "run --rm -T -u 0 --no-deps api chown -R 1001:1001 /app/storage /app/uploads" in calls
    assert "DROP SCHEMA IF EXISTS public CASCADE" in calls
    assert "psql -v ON_ERROR_STOP=1 --single-transaction" in calls
    assert "run --rm -T api python scripts/reconcile_post_restore.py" in calls
    assert "start api frontend worker scheduler" in calls
    assert "curl -s -f http://localhost:8000/health" in calls
    assert "start caddy" in calls


def test_16_application_quiescence_and_safe_start_ordering(tmp_path):
    """
    16. Confirms that all application writers are stopped prior to any storage extraction or DB restore,
    and that normal API is not started until after reconciliation succeeds.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)
    storage_backup = tmp_path / "storage.tar.gz"
    create_tar_gz_with_files(storage_backup, {"storage/tombstones.jsonl": b"{}"})

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, storage_backup, fail_on=None)
    assert code == 0

    lines = [l.strip() for l in calls.splitlines() if l.strip()]
    stop_idx = next(i for i, l in enumerate(lines) if "stop caddy frontend api worker scheduler" in l)
    extract_idx = next(i for i, l in enumerate(lines) if "tar -xzf" in l)
    db_idx = next(i for i, l in enumerate(lines) if "psql" in l and "single-transaction" in l)
    reconcile_idx = next(i for i, l in enumerate(lines) if "reconcile_post_restore.py" in l)
    start_api_idx = next(i for i, l in enumerate(lines) if "start api frontend worker scheduler" in l)
    start_caddy_idx = next(i for i, l in enumerate(lines) if "start caddy" in l)

    # Assert ordering invariants
    assert stop_idx < extract_idx < db_idx < reconcile_idx < start_api_idx < start_caddy_idx


def test_17_sql_error_halts_restore_and_leaves_ingress_blocked(tmp_path):
    """
    17. Confirms that an error during PostgreSQL restore immediately halts execution
    (due to ON_ERROR_STOP=1 and --single-transaction) and leaves Caddy stopped.
    """
    db_backup = tmp_path / "backup.sql.gz"
    create_valid_dummy_sql_gz(db_backup)

    code, out, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, fail_on="docker_psql")
    assert code != 0
    assert "PUBLIC INGRESS REMAINS BLOCKED" in out or "PUBLIC INGRESS REMAINS BLOCKED" in err
    assert "start api frontend worker scheduler" not in calls
    assert "start caddy" not in calls


def run_backup_script_with_mocks(tmp_path: Path, fail_on: str = None):
    """
    Executes scripts/backup_db.sh under Bash with mock docker executable.
    fail_on: 'pg_dump', 'tar'
    """
    if not BASH_EXE:
        pytest.skip("Git Bash executable not found on host.")

    script_path = BASE_DIR.parent / "scripts" / "backup_db.sh"
    bin_dir = tmp_path / "mock_bin_backup"
    bin_dir.mkdir(parents=True, exist_ok=True)
    backup_dir = tmp_path / "backups_pg"
    storage_dir = tmp_path / "backups_storage"
    backup_dir.mkdir(parents=True, exist_ok=True)
    storage_dir.mkdir(parents=True, exist_ok=True)

    # Pre-create a dummy tar.gz to emit from mock docker
    dummy_tar_file = tmp_path / "dummy_sample.tar.gz"
    create_tar_gz_with_files(dummy_tar_file, {"storage/tombstones.jsonl": b"{}\n"})

    mock_docker = bin_dir / "docker"
    docker_script = f"""#!/bin/bash
if [ "{fail_on}" = "pg_dump" ] && [[ "$*" == *"pg_dump"* ]]; then
    echo "Simulated pg_dump failure" >&2
    exit 1
fi
if [ "{fail_on}" = "tar" ] && [[ "$*" == *"tar -czf"* ]]; then
    echo "Simulated tar failure" >&2
    exit 1
fi

if [[ "$*" == *"pg_dump"* ]]; then
    echo "SELECT 1;"
    exit 0
fi

if [[ "$*" == *"tar -czf"* ]]; then
    cat "{dummy_tar_file.as_posix()}"
    exit 0
fi

exit 0
"""
    mock_docker.write_text(docker_script, encoding="utf-8")

    env = os.environ.copy()
    env["PATH"] = f"{bin_dir.as_posix()}:{env.get('PATH', '')}"
    env["BACKUP_DIR"] = backup_dir.as_posix()
    env["STORAGE_BACKUP_DIR"] = storage_dir.as_posix()

    proc = subprocess.run(
        [BASH_EXE, script_path.as_posix()],
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    return proc.returncode, proc.stdout, proc.stderr, backup_dir, storage_dir


def test_18_backup_script_failure_propagation_and_temp_cleanup(tmp_path):
    """
    18. Verifies that failures in either pg_dump or storage archive creation:
    - Exit with a non-zero exit code (no || true suppression).
    - Remove temporary files (.tmp).
    - Do not produce partially written final backups.
    """
    # 18a: Fail on pg_dump
    code_pg, out_pg, err_pg, bdir_pg, sdir_pg = run_backup_script_with_mocks(tmp_path / "run_pg", fail_on="pg_dump")
    assert code_pg != 0
    assert len(list(bdir_pg.glob("*.sql.gz"))) == 0
    assert len(list(bdir_pg.glob("*.tmp"))) == 0

    # 18b: Fail on storage tar
    code_tar, out_tar, err_tar, bdir_tar, sdir_tar = run_backup_script_with_mocks(tmp_path / "run_tar", fail_on="tar")
    assert code_tar != 0
    assert len(list(sdir_tar.glob("*.tar.gz"))) == 0
    assert len(list(sdir_tar.glob("*.tmp"))) == 0

    # 18c: Both succeed -> Atomic promotion
    code_ok, out_ok, _, bdir_ok, sdir_ok = run_backup_script_with_mocks(tmp_path / "run_ok", fail_on=None)
    assert code_ok == 0
    assert len(list(bdir_ok.glob("dvt_talent_*.sql.gz"))) == 1
    assert len(list(sdir_ok.glob("storage_*.tar.gz"))) == 1
    assert len(list(bdir_ok.glob("*.tmp"))) == 0
    assert len(list(sdir_ok.glob("*.tmp"))) == 0

