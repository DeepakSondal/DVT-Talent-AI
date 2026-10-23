"""
DVT Talent AI — Production Storage, Disaster Recovery & Topology Tests
Verifies:
1. Shared persistent storage configuration across API and worker services.
2. Production Compose volume consistency and single-host topology boundaries.
3. Tombstone read/write failure handling and non-zero exit codes.
4. Fail-safe post-restore reconciliation gate preventing traffic cutover when violations exist.
5. Idempotent reconciliation and pending cleanup task draining.
"""
import sys
import os
import uuid
import json
import yaml
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from config import settings
from db.models import Candidate, CandidateStatus, Tenant, User, UserRole, AgentTask, AgentTaskStatus
from services.privacy_service import (
    ERASURE_TOMBSTONE_LEDGER_PATH,
    ERASURE_TOMBSTONE_LOCK_PATH,
    record_erasure_tombstone,
)
from services.resume_parser import ResumeParserService, get_upload_dir
from scripts.reconcile_post_restore import run_reconciliation
from sqlalchemy import select


def test_storage_and_upload_paths_and_config():
    """
    Verifies that storage and upload paths are defined, absolute, and match service expectations.
    """
    storage_p = Path(settings.storage_dir)
    upload_p = Path(settings.upload_dir)

    assert storage_p.is_absolute()
    assert upload_p.is_absolute()
    assert ERASURE_TOMBSTONE_LEDGER_PATH.parent == storage_p
    assert ERASURE_TOMBSTONE_LOCK_PATH.parent == storage_p

    # Ensure ensure_upload_dir works and resolves to upload_p / "resumes"
    resumes_dir = ResumeParserService.ensure_upload_dir()
    assert resumes_dir == upload_p / "resumes"
    assert resumes_dir.exists()


def test_docker_compose_prod_volume_configuration():
    """
    Verifies that docker-compose.prod.yml declares shared persistent volumes for api, worker,
    and scheduler to prevent data loss across container recreation.
    """
    compose_path = BASE_DIR.parent / "docker-compose.prod.yml"
    assert compose_path.exists(), "docker-compose.prod.yml not found"

    with open(compose_path, "r", encoding="utf-8") as f:
        compose = yaml.safe_load(f)

    services = compose.get("services", {})
    assert "api" in services
    assert "worker" in services
    assert "scheduler" in services

    # Verify api volumes
    api_vols = services["api"].get("volumes", [])
    assert "dvt_storage:/app/storage" in api_vols
    assert "dvt_uploads:/app/uploads" in api_vols

    # Verify worker volumes
    worker_vols = services["worker"].get("volumes", [])
    assert "dvt_storage:/app/storage" in worker_vols
    assert "dvt_uploads:/app/uploads" in worker_vols

    # Verify scheduler volumes
    scheduler_vols = services["scheduler"].get("volumes", [])
    assert "dvt_storage:/app/storage" in scheduler_vols

    # Verify top-level volume definitions
    top_vols = compose.get("volumes", {})
    assert "dvt_storage" in top_vols
    assert "dvt_uploads" in top_vols
    assert "postgres_data" in top_vols


@pytest.mark.asyncio
async def test_reconcile_cli_missing_ledger_fails():
    """
    Verifies that run_reconciliation fails with exit code 2 if the tombstone ledger is missing,
    unless --allow-empty-ledger is explicitly provided.
    """
    with patch("scripts.reconcile_post_restore.ERASURE_TOMBSTONE_LEDGER_PATH", Path("/tmp/non_existent_ledger_test.jsonl")):
        # Default behavior: Exit code 2 (Storage/Ledger error)
        exit_code_default = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
        assert exit_code_default == 2

        # Permitted override: Exit code 0
        exit_code_allowed = await run_reconciliation(verify_only=True, allow_empty_ledger=True)
        assert exit_code_allowed == 0


@pytest.mark.asyncio
async def test_reconcile_cli_resurrected_data_detection_and_clean_exit(db_session):
    """
    Verifies that the CLI:
    1. Detects resurrected candidate PII and files in --verify-only mode and returns exit code 1.
    2. Reconciles and sanitizes all stores in standard mode, achieving exit code 0.
    """
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    resume_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Reconcile CLI Tenant {run_id}")
    db_session.add(tenant)
    await db_session.commit()

    candidate = Candidate(
        id=candidate_id,
        tenant_id=tenant_id,
        first_name="Resurrected",
        last_name=f"Frank {run_id}",
        email=f"frank.{run_id}@resurrected.local",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )
    db_session.add(candidate)
    await db_session.commit()

    # 1. Create a physical resume file on disk
    file_url = ResumeParserService.save_resume_file(
        str(candidate_id), str(resume_id), f"cli_test_{run_id}.pdf", b"RESURRECTED CONTENT"
    )
    assert Path(file_url).exists()

    # 2. Record tombstone for this candidate
    record_erasure_tombstone(str(candidate_id), str(tenant_id))

    # 3. Test verify-only mode: Should catch the violation and return 1 (blocking traffic)
    exit_verify = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
    assert exit_verify == 1

    # 4. Run standard reconciliation: Should sanitize DB and delete file
    exit_reconcile = await run_reconciliation(verify_only=False, allow_empty_ledger=False)
    assert exit_reconcile == 0

    # 5. Verify database and file state
    await db_session.refresh(candidate)
    assert candidate.pii_erased is True
    assert candidate.first_name == "Erased"
    assert Path(file_url).exists() is False

    # 6. Re-running verification should now return exit code 0 (idempotent)
    exit_verify_again = await run_reconciliation(verify_only=True, allow_empty_ledger=False)
    assert exit_verify_again == 0


@pytest.mark.asyncio
async def test_reconcile_cli_unresolved_tasks_blocks_cutover(db_session):
    """
    Verifies that if a background cleanup task cannot be resolved, the reconciliation
    gate detects the outstanding task and returns exit code 1 to keep ingress blocked.
    """
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Unresolved Task Tenant {run_id}")
    db_session.add(tenant)
    await db_session.commit()

    task = AgentTask(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        agent_name="privacy_compliance",
        task_type="gdpr_cleanup_retry",
        status=AgentTaskStatus.PENDING,
        input_data={
            "candidate_id": str(candidate_id),
            "tenant_id": str(tenant_id),
            "retry_tombstone": True,
        },
        error_message="Simulated permanent network partition",
    )
    db_session.add(task)
    await db_session.commit()

    # Simulate sweep failure so the task remains pending
    with patch("scripts.reconcile_post_restore.sweep_and_process_gdpr_cleanups", return_value={"processed": 1, "succeeded": 0, "failed": 1}):
        exit_code = await run_reconciliation(verify_only=False, allow_empty_ledger=True)
        # Outstanding task must trigger failure
        assert exit_code == 1

    # Cleanup synthetic task to leave db clean
    await db_session.delete(task)
    await db_session.delete(tenant)
    await db_session.commit()


@pytest.mark.asyncio
async def test_crash_window_between_db_commit_and_tombstone_persistence(db_session):
    """
    Demonstrates that if the process terminates immediately after the primary database commit
    (before record_erasure_tombstone executes), the in-transaction committed cleanup task
    preserves the erasure intent, and the recovery sweep successfully records the tombstone.
    """
    from services.privacy_service import erase_candidate_personal_data, sweep_and_process_gdpr_cleanups

    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Crash Window Tenant {run_id}")
    db_session.add(tenant)
    await db_session.commit()

    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin.crash_{run_id}@test.local",
        full_name="Admin CrashTest",
        hashed_password="dummy_hash_for_test",
        role=UserRole.ADMIN,
    )
    candidate = Candidate(
        id=candidate_id,
        tenant_id=tenant_id,
        first_name="CrashWindow",
        last_name=f"Candidate {run_id}",
        email=f"crash.{run_id}@test.local",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )
    db_session.add_all([admin, candidate])
    await db_session.commit()

    # Simulate sudden process termination / unhandled exception right as line 458 is invoked
    with patch("services.privacy_service.record_erasure_tombstone", side_effect=RuntimeError("SIMULATED SIGKILL AT CRASH WINDOW")):
        with pytest.raises(RuntimeError, match="SIMULATED SIGKILL AT CRASH WINDOW"):
            await erase_candidate_personal_data(
                candidate_id=candidate_id,
                db=db_session,
                requesting_user=admin,
            )

    # Verify state in DB immediately following the crash:
    # 1. Candidate is sanitized in DB (commit succeeded)
    await db_session.refresh(candidate)
    assert candidate.pii_erased is True
    assert candidate.first_name == "Erased"

    # 2. In-transaction AgentTask exists with retry_tombstone = True
    task_stmt = select(AgentTask).where(
        AgentTask.task_type == "gdpr_cleanup_retry",
        AgentTask.tenant_id == tenant_id,
    )
    task = (await db_session.execute(task_stmt)).scalar_one()
    assert task.status == AgentTaskStatus.PENDING
    assert task.input_data.get("retry_tombstone") is True

    # 3. Tombstone is NOT yet on disk
    if ERASURE_TOMBSTONE_LEDGER_PATH.exists():
        tombstone_lines = ERASURE_TOMBSTONE_LEDGER_PATH.read_text(encoding="utf-8").splitlines()
        assert not any(str(candidate_id) in line for line in tombstone_lines)

    # Recovery Phase: System reboots and Celery periodic sweep runs
    sweep_summary = await sweep_and_process_gdpr_cleanups(db_session)
    assert sweep_summary["processed"] >= 1
    assert sweep_summary["succeeded"] >= 1

    # Verify task transitioned to COMPLETED
    await db_session.refresh(task)
    assert task.status == AgentTaskStatus.COMPLETED
    assert task.input_data.get("retry_tombstone") is False

    # Verify tombstone IS now durably on disk
    assert ERASURE_TOMBSTONE_LEDGER_PATH.exists()
    tombstone_lines = ERASURE_TOMBSTONE_LEDGER_PATH.read_text(encoding="utf-8").splitlines()
    assert any(str(candidate_id) in line for line in tombstone_lines)
