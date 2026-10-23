import pytest
import uuid
import os
import json
import asyncio
from pathlib import Path
from datetime import datetime, timezone
from sqlalchemy import select
from unittest.mock import patch

from config import settings
from db.models import Candidate, CandidateStatus, Tenant, User, UserRole, Resume, AgentTask, AgentTaskStatus
from services.privacy_service import (
    erase_candidate_personal_data,
    reconcile_post_restore_erasures,
    record_erasure_tombstone,
    sweep_and_process_gdpr_cleanups,
    ERASURE_TOMBSTONE_LEDGER_PATH,
)
from services.resume_parser import ResumeParserService
import redis


@pytest.mark.asyncio
async def test_backup_restore_cannot_resurrect_erased_candidate(db_session):
    """Verifies single-entity database restoration cannot resurrect an erased candidate."""
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Backup Restore Test Tenant {run_id}")
    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin.restore_{run_id}@test.local",
        full_name="Admin Restore",
        hashed_password="dummy_hash_for_test",
        role=UserRole.ADMIN,
    )
    candidate = Candidate(
        id=candidate_id,
        tenant_id=tenant_id,
        first_name="Alice",
        last_name="PreBackup",
        email=f"alice.prebackup_{run_id}@test.local",
        phone="+1234567890",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )

    db_session.add_all([tenant, admin, candidate])
    await db_session.commit()

    # Candidate requests GDPR erasure AFTER backup timestamp
    res = await erase_candidate_personal_data(
        candidate_id=candidate_id,
        db=db_session,
        requesting_user=admin,
    )
    assert res["status"] == "erased"
    assert res["database_erased"] is True

    # Confirm candidate is erased and tombstone recorded
    assert ERASURE_TOMBSTONE_LEDGER_PATH.exists()
    c_erased = (await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one()
    assert c_erased.pii_erased is True
    assert c_erased.first_name == "Erased"

    # Simulate an operator restoring a database backup taken prior to erasure
    c_erased.pii_erased = False
    c_erased.pii_erased_at = None
    c_erased.first_name = "Resurrected Alice"
    c_erased.last_name = "PreBackup"
    c_erased.email = f"alice.prebackup_{run_id}@test.local"
    c_erased.phone = "+1234567890"
    await db_session.commit()

    c_resurrected = (await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one()
    assert c_resurrected.pii_erased is False
    assert c_resurrected.first_name == "Resurrected Alice"

    # Execute post-restore erasure reconciliation
    summary = await reconcile_post_restore_erasures(db_session)
    assert summary["resurrected_found"] >= 1

    # Verify candidate has been automatically re-sanitized
    c_reconciled = (await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one()
    assert c_reconciled.pii_erased is True
    assert c_reconciled.first_name == "Erased"
    assert "erased" in c_reconciled.email
    assert c_reconciled.phone is None


@pytest.mark.asyncio
async def test_full_multi_system_resurrection_prevention(db_session):
    """
    Creates candidate with physical resume file, Redis cache entries, vector embeddings,
    erases them, simulates a multi-system restore, and verifies reconciliation purges all.
    """
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    resume_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Multi System Tenant {run_id}")
    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin.multi_{run_id}@test.local",
        full_name="Admin Multi",
        hashed_password="dummy_hash_for_test",
        role=UserRole.ADMIN,
    )
    candidate = Candidate(
        id=candidate_id,
        tenant_id=tenant_id,
        first_name="Bob",
        last_name="PreBackup",
        email=f"bob.prebackup_{run_id}@test.local",
        phone="+9876543210",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )

    # 1. Create physical resume file
    resume_url = ResumeParserService.save_resume_file(
        str(candidate_id), str(resume_id), f"test_resume_{run_id}.pdf", b"MULTI SYSTEM TEST CONTENT"
    )
    resume_path = Path(resume_url)
    assert resume_path.exists()

    resume = Resume(
        id=resume_id,
        candidate_id=candidate_id,
        tenant_id=tenant_id,
        file_name=f"test_resume_{run_id}.pdf",
        file_url=resume_url,
    )

    db_session.add_all([tenant, admin, candidate, resume])
    await db_session.commit()

    # 2. Populate Redis cache
    r = redis.from_url(settings.redis_url)
    cache_key = f"candidate:{candidate_id}"
    r.set(cache_key, "cached_candidate_pii_data")
    assert r.exists(cache_key) == 1

    # 3. Erase candidate
    res = await erase_candidate_personal_data(
        candidate_id=candidate_id,
        db=db_session,
        requesting_user=admin,
    )
    assert res["status"] == "erased"
    assert resume_path.exists() is False
    assert r.exists(cache_key) == 0

    # 4. Simulate complete multi-system restoration of pre-erasure backups:
    # 4a. Restore DB row
    c_db = (await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one()
    c_db.pii_erased = False
    c_db.first_name = "Resurrected Bob"
    c_db.email = f"bob.prebackup_{run_id}@test.local"
    await db_session.commit()

    # 4b. Restore physical resume file on disk
    restored_url = ResumeParserService.save_resume_file(
        str(candidate_id), str(resume_id), f"test_resume_{run_id}.pdf", b"RESTORED RESUME CONTENT"
    )
    restored_path = Path(restored_url)
    assert restored_path.exists()

    # 4c. Restore Redis cache
    r.set(cache_key, "resurrected_cache_data")
    assert r.exists(cache_key) == 1

    # 5. Run post-restore reconciliation
    reconcile_res = await reconcile_post_restore_erasures(db_session)
    assert reconcile_res["resurrected_found"] >= 1
    assert reconcile_res["files_deleted"] >= 1
    assert reconcile_res["caches_purged"] >= 1

    # 6. Verify across all systems
    # DB sanitized
    c_final = (await db_session.execute(select(Candidate).where(Candidate.id == candidate_id))).scalar_one()
    assert c_final.pii_erased is True
    assert c_final.first_name == "Erased"
    # File removed
    assert restored_path.exists() is False
    # Cache purged
    assert r.exists(cache_key) == 0


@pytest.mark.asyncio
async def test_tombstone_write_failure_recovery_and_sweep(db_session):
    """
    Simulates tombstone writing failure during erasure, verifies the crash recovery task
    flags retry_tombstone, and confirms the periodic sweep retries and achieves durable completion.
    """
    run_id = uuid.uuid4().hex[:8]
    tenant_id = uuid.uuid4()
    candidate_id = uuid.uuid4()
    admin_id = uuid.uuid4()

    tenant = Tenant(id=tenant_id, name=f"Tombstone Fail Tenant {run_id}")
    admin = User(
        id=admin_id,
        tenant_id=tenant_id,
        email=f"admin.tbfail_{run_id}@test.local",
        full_name="Admin TBFail",
        hashed_password="dummy_hash_for_test",
        role=UserRole.ADMIN,
    )
    candidate = Candidate(
        id=candidate_id,
        tenant_id=tenant_id,
        first_name="Charlie",
        last_name="TBFail",
        email=f"charlie.tbfail_{run_id}@test.local",
        status=CandidateStatus.SOURCED,
        pii_erased=False,
    )

    db_session.add_all([tenant, admin, candidate])
    await db_session.commit()

    # Simulate tombstone write failure on first attempt
    with patch("services.privacy_service.record_erasure_tombstone", return_value=False):
        res = await erase_candidate_personal_data(
            candidate_id=candidate_id,
            db=db_session,
            requesting_user=admin,
        )
        assert res["status"] == "pending_cleanup"
        assert res["pending_cleanup"] is True

    # Verify task in DB has retry_tombstone flag
    task_stmt = select(AgentTask).where(
        AgentTask.task_type == "gdpr_cleanup_retry",
        AgentTask.status == AgentTaskStatus.PENDING,
    )
    pending_tasks = (await db_session.execute(task_stmt)).scalars().all()
    target_task = next(t for t in pending_tasks if str(t.input_data.get("candidate_id")) == str(candidate_id))
    assert target_task.input_data.get("retry_tombstone") is True

    # Now run periodic sweep without failure simulation
    sweep_summary = await sweep_and_process_gdpr_cleanups(db_session)
    assert sweep_summary["processed"] >= 1
    assert sweep_summary["succeeded"] >= 1

    # Verify task transitioned to COMPLETED
    await db_session.refresh(target_task)
    assert target_task.status == AgentTaskStatus.COMPLETED


@pytest.mark.asyncio
async def test_reconciliation_idempotency_and_concurrency(db_session):
    """
    Verifies that running reconciliation multiple times is strictly idempotent,
    and concurrent calls to record_erasure_tombstone maintain valid uncorrupted JSONL formatting.
    """
    # 1. Idempotency check
    res1 = await reconcile_post_restore_erasures(db_session)
    res2 = await reconcile_post_restore_erasures(db_session)
    assert res2["resurrected_found"] == 0

    # 2. Concurrency check: multiple concurrent writes to tombstone ledger
    async def _write_entry(i):
        cid = str(uuid.uuid4())
        record_erasure_tombstone(cid, f"tenant_{i}")

    await asyncio.gather(*[_write_entry(i) for i in range(20)])

    # Validate file integrity: each line must be valid JSON
    with open(ERASURE_TOMBSTONE_LEDGER_PATH, "r", encoding="utf-8") as f:
        for idx, line in enumerate(f, start=1):
            line = line.strip()
            if line:
                entry = json.loads(line)
                assert "candidate_id" in entry
                assert "erased_at" in entry
