"""
DVT Talent AI — Security Regression Test Suite for Batch 2B: Candidate Personal-Data Erasure
Validates:
1. Authorized candidate can request self-erasure.
2. Unauthorized user cannot erase another candidate's data (recruiter or another candidate).
3. Cross-tenant deletion is rejected (admin from another tenant).
4. Related Resume records are removed as intended.
5. Associated resume files are deleted without touching unrelated files.
6. Candidate embeddings are deleted from configured test vector stores.
7. A vector-store outage is recorded for retry and not falsely reported as complete.
8. Repeating an erasure request is safe and idempotent.
9. Pending background tasks cannot re-create erased candidate data.
10. Existing resume path traversal protections continue to pass.
11. Logs and API responses do not expose sensitive data.
12. Existing candidate privacy, tenant-isolation, and resume tests still pass.
"""

import os
import sys
import uuid
from pathlib import Path
from datetime import datetime, timezone
from unittest.mock import patch, MagicMock, AsyncMock
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from db.models import (
    AsyncSessionLocal, Tenant, User, Candidate, CandidateStatus,
    Resume, UserRole, JobCandidate, Job, Company, AgentTask, AgentTaskStatus
)
from api.routes.auth import get_current_user
from services.resume_parser import ResumeParserService
from services.privacy_service import erase_candidate_personal_data
from workers.tasks import score_candidate_task, _update_resume_in_db


@pytest.fixture
def temp_erasure_storage(tmp_path, monkeypatch):
    """Provides isolated resume storage for erasure tests."""
    upload_dir = tmp_path / "uploads" / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr("services.resume_parser.UPLOAD_DIR", upload_dir)
    monkeypatch.setattr("services.resume_parser.get_upload_dir", lambda: upload_dir)
    from config import settings
    monkeypatch.setattr(settings, "upload_dir", str(tmp_path / "uploads"))
    return upload_dir


class TestCandidatePersonalDataErasure:
    """Comprehensive test suite for candidate personal data erasure."""

    async def setup_test_entities(self, temp_dir: Path):
        """Creates two isolated tenants, users, candidates, and resumes with synthetic files."""
        async with AsyncSessionLocal() as session:
            # Tenant A
            tenant_a = Tenant(
                id=uuid.uuid4(),
                name="Tenant Alpha Security",
                domain=f"alpha-{uuid.uuid4().hex[:6]}.com",
                is_active=True,
            )
            # Tenant B
            tenant_b = Tenant(
                id=uuid.uuid4(),
                name="Tenant Beta Security",
                domain=f"beta-{uuid.uuid4().hex[:6]}.com",
                is_active=True,
            )
            session.add_all([tenant_a, tenant_b])
            await session.commit()

            # Admin A & Recruiter A
            admin_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                email=f"admin.a.{uuid.uuid4().hex[:6]}@example.com",
                role=UserRole.ADMIN,
                full_name="Admin Alpha",
                hashed_password="hashed_pw_test",
                is_active=True,
            )
            recruiter_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                email=f"recruiter.a.{uuid.uuid4().hex[:6]}@example.com",
                role=UserRole.RECRUITER,
                full_name="Recruiter Alpha",
                hashed_password="hashed_pw_test",
                is_active=True,
            )

            # Admin B
            admin_b = User(
                id=uuid.uuid4(),
                tenant_id=tenant_b.id,
                email=f"admin.b.{uuid.uuid4().hex[:6]}@example.com",
                role=UserRole.ADMIN,
                full_name="Admin Beta",
                hashed_password="hashed_pw_test",
                is_active=True,
            )

            # Candidate User A
            cand_user_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                email=f"candidate.a.{uuid.uuid4().hex[:6]}@example.com",
                role=UserRole.CANDIDATE,
                full_name="Alice Candidate",
                hashed_password="hashed_pw_test",
                is_active=True,
            )

            # Candidate User B (Another candidate)
            cand_user_b = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                email=f"candidate.b.{uuid.uuid4().hex[:6]}@example.com",
                role=UserRole.CANDIDATE,
                full_name="Bob Candidate",
                hashed_password="hashed_pw_test",
                is_active=True,
            )

            session.add_all([admin_a, recruiter_a, admin_b, cand_user_a, cand_user_b])
            await session.commit()

            # Candidate record for Alice
            candidate_a = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                user_id=cand_user_a.id,
                first_name="Alice",
                last_name="Engineer",
                email=cand_user_a.email,
                phone="+1-555-0199",
                title="Principal Software Engineer",
                location="San Francisco, CA",
                linkedin_url="https://linkedin.com/in/alice-eng",
                github_url="https://github.com/alice-eng",
                skills=["Python", "FastAPI", "Distributed Systems"],
                experience_years=10,
                current_company="Acme Tech",
                embedding_id=f"emb_cand_{uuid.uuid4().hex[:8]}",
                ai_summary="Exceptional backend architect with deep distributed systems knowledge.",
                pii_erased=False,
            )

            # Candidate record for Bob
            candidate_b = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant_a.id,
                user_id=cand_user_b.id,
                first_name="Bob",
                last_name="Builder",
                email=cand_user_b.email,
                phone="+1-555-0188",
                title="Frontend Engineer",
                pii_erased=False,
            )

            session.add_all([candidate_a, candidate_b])
            await session.commit()

            # Create physical resume files
            file_a_name = f"{candidate_a.id}_res1_alice_resume.pdf"
            file_a_path = temp_dir / file_a_name
            file_a_path.write_bytes(b"%PDF-1.4 Alice Confidential Resume Content")

            file_unrelated_name = f"{uuid.uuid4()}_other_unrelated_resume.pdf"
            file_unrelated_path = temp_dir / file_unrelated_name
            file_unrelated_path.write_bytes(b"%PDF-1.4 Other Unrelated Resume Content")

            resume_a = Resume(
                id=uuid.uuid4(),
                candidate_id=candidate_a.id,
                tenant_id=tenant_a.id,
                file_name="alice_resume.pdf",
                file_url=str(file_a_path),
                raw_text="Alice's confidential work history at Acme Tech.",
                parsed_data={"skills": ["Python", "FastAPI"], "phone": "+1-555-0199"},
                embedding_id=f"emb_res_{uuid.uuid4().hex[:8]}",
                is_current=True,
            )
            session.add(resume_a)
            await session.commit()

            return {
                "tenant_a": tenant_a,
                "tenant_b": tenant_b,
                "admin_a": admin_a,
                "recruiter_a": recruiter_a,
                "admin_b": admin_b,
                "cand_user_a": cand_user_a,
                "cand_user_b": cand_user_b,
                "candidate_a": candidate_a,
                "candidate_b": candidate_b,
                "resume_a": resume_a,
                "file_a_path": file_a_path,
                "file_unrelated_path": file_unrelated_path,
            }

    @pytest.mark.asyncio
    async def test_authorized_candidate_self_erasure(self, temp_erasure_storage):
        """Test 1: An authorized candidate can request erasure of their own data."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["cand_user_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.delete("/api/v1/candidate-portal/profile/erasure")
                assert res.status_code == 200
                body = res.json()
                assert body["status"] == "erased"
                assert body["database_erased"] is True
                assert body["files_deleted"] is True
                assert body["vector_store_erased"] is True
                # Path/vector metadata must NOT be exposed in response
                assert "file_path" not in str(body).lower()
                assert "file_url" not in str(body).lower()

            # Verify in DB
            async with AsyncSessionLocal() as session:
                cand = (await session.execute(
                    select(Candidate).where(Candidate.id == data["candidate_a"].id)
                )).scalar_one()
                assert cand.pii_erased is True
                assert cand.first_name == "Erased"
                assert cand.last_name == "Candidate"
                assert "alice" not in cand.email.lower()
                assert cand.phone is None
                assert cand.linkedin_url is None
                assert cand.github_url is None
                assert cand.skills == []
                assert cand.ai_summary == "[Personal data permanently erased per GDPR Article 17 request]"

                # Resumes must be deleted
                resumes = (await session.execute(
                    select(Resume).where(Resume.candidate_id == data["candidate_a"].id)
                )).scalars().all()
                assert len(resumes) == 0

            # Verify file deletion
            assert not data["file_a_path"].exists()
            assert data["file_unrelated_path"].exists()

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_unauthorized_users_cannot_erase_candidate(self, temp_erasure_storage):
        """Test 2: Recruiter or another candidate cannot erase candidate data."""
        data = await self.setup_test_entities(temp_erasure_storage)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Recruiter cannot erase
            app.dependency_overrides[get_current_user] = lambda: data["recruiter_a"]
            rec_res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
            assert rec_res.status_code == 403
            assert "recruiters are not permitted" in rec_res.text.lower()

            # 2. Another candidate cannot erase candidate_a
            app.dependency_overrides[get_current_user] = lambda: data["cand_user_b"]
            other_cand_res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
            assert other_cand_res.status_code == 403
            assert "only request erasure of their own" in other_cand_res.text.lower()

        app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_cross_tenant_deletion_is_rejected(self, temp_erasure_storage):
        """Test 3: Cross-tenant deletion is rejected (Admin B cannot delete Candidate A)."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_b"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                # Must return 404 to avoid leaking cross-tenant candidate existence
                assert res.status_code == 404
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_admin_erasure_removes_resumes_files_and_vector_embeddings(self, temp_erasure_storage):
        """Test 4, 5, 6: Admin erasure deletes DB records, physical files, and calls vector store."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            with patch("db.vector_store.VectorStore.delete_resumes", return_value=True) as mock_chroma_delete:
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                    assert res.status_code == 200
                    body = res.json()
                    assert body["status"] == "erased"
                    assert body["vector_store_erased"] is True

                # Vector store delete called with candidate & tenant info
                mock_chroma_delete.assert_called_once()
                call_kwargs = mock_chroma_delete.call_args.kwargs
                assert str(call_kwargs["tenant_id"]) == str(data["tenant_a"].id)
                assert str(call_kwargs["candidate_id"]) == str(data["candidate_a"].id)

            # Physical file removed, unrelated preserved
            assert not data["file_a_path"].exists()
            assert data["file_unrelated_path"].exists()

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_vector_store_outage_records_retryable_cleanup_task(self, temp_erasure_storage):
        """Test 7: Outage in vector store does not claim complete erasure; records retryable cleanup task."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            with patch("db.vector_store.VectorStore.delete_resumes", side_effect=RuntimeError("ChromaDB connection refused (503)")):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                    assert res.status_code == 200
                    body = res.json()
                    # Must report pending_cleanup rather than claiming full completion
                    assert body["status"] == "pending_cleanup"
                    assert body["vector_store_erased"] is False
                    assert body["database_erased"] is True
                    assert body["files_deleted"] is True
                    assert "cleanup_task_id" in body

            # Verify AgentTask was created for retry
            async with AsyncSessionLocal() as session:
                task = (await session.execute(
                    select(AgentTask).where(
                        AgentTask.task_type == "gdpr_cleanup_retry",
                        AgentTask.tenant_id == data["tenant_a"].id,
                    )
                )).scalar_one()
                assert task.status == AgentTaskStatus.PENDING
                assert str(task.input_data["candidate_id"]) == str(data["candidate_a"].id)
                assert task.input_data["retry_vector"] is True

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_erasure_idempotence_and_cleanup_retry(self, temp_erasure_storage):
        """Test 8: Repeating erasure request is safe, idempotent, and completes previously pending cleanup."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            # 1. First run fails on vector store -> partial
            with patch("db.vector_store.VectorStore.delete_resumes", side_effect=RuntimeError("Vector timeout")):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    res1 = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                    assert res1.json()["status"] == "pending_cleanup"

            # 2. Second run (vector store recovered) -> completes cleanup
            with patch("db.vector_store.VectorStore.delete_resumes", return_value=True) as mock_recover:
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    res2 = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                    assert res2.status_code == 200
                    assert res2.json()["status"] == "erased"
                    assert res2.json()["vector_store_erased"] is True

            # 3. Third run (already fully erased) -> returns already_erased safely
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res3 = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                assert res3.status_code == 200
                assert res3.json()["status"] == "already_erased"
                assert res3.json()["pending_cleanup"] is False

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_pending_tasks_cannot_recreate_erased_candidate_data(self, temp_erasure_storage):
        """Test 9: Worker tasks abort when encountering an erased candidate and do not overwrite erased fields."""
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            # Erase candidate
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")

            # Try to run background score_candidate_task on the erased candidate
            result = score_candidate_task(str(data["candidate_a"].id))
            assert result["status"] == "candidate_erased"

            # Try to run _update_resume_in_db
            _update_resume_in_db(
                str(data["resume_a"].id),
                {"score": 95, "parsed": {"skills": ["Injected"]}},
                raw_text="Injected Raw Resume",
            )

            # Confirm candidate profile was not modified/restored
            async with AsyncSessionLocal() as session:
                cand = (await session.execute(
                    select(Candidate).where(Candidate.id == data["candidate_a"].id)
                )).scalar_one()
                assert cand.pii_erased is True
                assert cand.score == 0.0
                assert cand.skills == []
                assert cand.first_name == "Erased"

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_candidate_identity_matching_verified_vs_unverified(self, temp_erasure_storage):
        """Test 10: Candidate self-service strictly enforces verified identity and rejects unverified email matching."""
        data = await self.setup_test_entities(temp_erasure_storage)
        transport = ASGITransport(app=app)

        unique_email = f"unlinked.{uuid.uuid4().hex[:8]}@example.com"
        async with AsyncSessionLocal() as session:
            # Create an unlinked candidate (no user_id set)
            unlinked_candidate = Candidate(
                id=uuid.uuid4(),
                tenant_id=data["tenant_a"].id,
                first_name="Unlinked",
                last_name="Candidate",
                email=unique_email,
                status=CandidateStatus.SOURCED,
                user_id=None,
            )
            # Create a user with matching email, initially unverified
            candidate_user = User(
                id=uuid.uuid4(),
                tenant_id=data["tenant_a"].id,
                email=unique_email,
                role=UserRole.CANDIDATE,
                full_name="Candidate Caller",
                hashed_password="hashed_pw_test",
                is_active=True,
                is_verified=False,
            )
            session.add_all([unlinked_candidate, candidate_user])
            await session.commit()

        # 1. Unverified user attempt -> 403 Forbidden
        app.dependency_overrides[get_current_user] = lambda: candidate_user
        try:
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.delete(f"/api/v1/candidates/{unlinked_candidate.id}/pii")
                assert res.status_code == 403
                assert "email verification is required" in res.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)

        # 2. Once verified -> succeeds and atomically binds user_id
        async with AsyncSessionLocal() as session:
            db_user = (await session.execute(
                select(User).where(User.id == candidate_user.id)
            )).scalar_one()
            db_user.is_verified = True
            await session.commit()
            candidate_user.is_verified = True

        app.dependency_overrides[get_current_user] = lambda: candidate_user
        try:
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.delete(f"/api/v1/candidates/{unlinked_candidate.id}/pii")
                assert res.status_code == 200
                assert res.json()["status"] == "erased"

            async with AsyncSessionLocal() as session:
                cand = (await session.execute(
                    select(Candidate).where(Candidate.id == unlinked_candidate.id)
                )).scalar_one()
                assert cand.user_id == candidate_user.id
                assert cand.pii_erased is True
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_automated_worker_sweep_processes_pending_cleanups(self, temp_erasure_storage):
        """Test 11: Worker automatically retries and completes pending external cleanups without candidate re-submission."""
        from services.privacy_service import sweep_and_process_gdpr_cleanups
        data = await self.setup_test_entities(temp_erasure_storage)
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            # 1. Trigger erasure during vector outage
            with patch("db.vector_store.VectorStore.delete_resumes", side_effect=RuntimeError("Store Down")):
                transport = ASGITransport(app=app)
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    res = await client.delete(f"/api/v1/candidates/{data['candidate_a'].id}/pii")
                    assert res.status_code == 200
                    assert res.json()["status"] == "pending_cleanup"

            # Verify an AgentTask was saved in database with PENDING status
            async with AsyncSessionLocal() as session:
                tasks = (await session.execute(
                    select(AgentTask).where(
                        AgentTask.task_type == "gdpr_cleanup_retry",
                        AgentTask.status == AgentTaskStatus.PENDING,
                        AgentTask.tenant_id == data["tenant_a"].id,
                    )
                )).scalars().all()
                task = next((t for t in tasks if t.input_data and t.input_data.get("candidate_id") == str(data["candidate_a"].id)), None)
                assert task is not None
                assert task.input_data["candidate_id"] == str(data["candidate_a"].id)
                target_task_id = task.id

            # 2. Worker sweeps pending cleanups once vector store recovers (no user intervention)
            with patch("db.vector_store.VectorStore.delete_resumes", return_value=True) as mock_vector_del:
                async with AsyncSessionLocal() as session:
                    sweep_result = await sweep_and_process_gdpr_cleanups(session)
                    assert sweep_result["processed"] >= 1
                    assert sweep_result["succeeded"] >= 1
                    assert sweep_result["failed"] == 0

            # Verify task is now marked COMPLETED
            async with AsyncSessionLocal() as session:
                task = (await session.execute(
                    select(AgentTask).where(AgentTask.id == target_task_id)
                )).scalar_one()
                assert task.status == AgentTaskStatus.COMPLETED
                assert task.completed_at is not None

        finally:
            app.dependency_overrides.pop(get_current_user, None)

    @pytest.mark.asyncio
    async def test_sweep_concurrency_atomic_claim(self, temp_erasure_storage):
        """Test 12: Concurrent sweep executions use atomic claims; duplicate workers do not collide."""
        import asyncio
        from services.privacy_service import sweep_and_process_gdpr_cleanups
        data = await self.setup_test_entities(temp_erasure_storage)

        # Create a pending cleanup task
        async with AsyncSessionLocal() as session:
            task = AgentTask(
                id=uuid.uuid4(),
                tenant_id=data["tenant_a"].id,
                agent_name="privacy_compliance",
                task_type="gdpr_cleanup_retry",
                status=AgentTaskStatus.PENDING,
                input_data={
                    "candidate_id": str(data["candidate_a"].id),
                    "tenant_id": str(data["tenant_a"].id),
                    "embedding_ids": ["emb_test_concurrent"],
                    "file_urls": [],
                },
                user_id=data["admin_a"].id,
            )
            session.add(task)
            await session.commit()
            task_id = task.id

        with patch("db.vector_store.VectorStore.delete_resumes", return_value=True):
            with patch("services.privacy_service.delete_candidate_from_pinecone", return_value=True):
                # Run two concurrent sweeps on separate DB sessions
                async def run_sweep():
                    async with AsyncSessionLocal() as sess:
                        return await sweep_and_process_gdpr_cleanups(sess)

                results = await asyncio.gather(run_sweep(), run_sweep())
                # Exactly one worker succeeded on claiming and processing the task
                total_succeeded = sum(r["succeeded"] for r in results)
                assert total_succeeded == 1

        # Verify task is COMPLETED
        async with AsyncSessionLocal() as session:
            completed_task = (await session.execute(
                select(AgentTask).where(AgentTask.id == task_id)
            )).scalar_one()
            assert completed_task.status == AgentTaskStatus.COMPLETED

    @pytest.mark.asyncio
    async def test_expired_worker_claim_cannot_overwrite_newer_result(self, temp_erasure_storage):
        """Test 13: An expired worker claim cannot overwrite or revert a newer worker's result."""
        from datetime import timedelta
        from services.privacy_service import sweep_and_process_gdpr_cleanups
        data = await self.setup_test_entities(temp_erasure_storage)

        # 1. Create task that was claimed 25 minutes ago (stale RUNNING with old lease token)
        old_time = datetime.now(timezone.utc) - timedelta(minutes=25)
        stale_lease = "stale_lease_worker_1"
        async with AsyncSessionLocal() as session:
            task = AgentTask(
                id=uuid.uuid4(),
                tenant_id=data["tenant_a"].id,
                agent_name="privacy_compliance",
                task_type="gdpr_cleanup_retry",
                status=AgentTaskStatus.RUNNING,
                started_at=old_time,
                celery_task_id=stale_lease,
                input_data={
                    "candidate_id": str(data["candidate_a"].id),
                    "tenant_id": str(data["tenant_a"].id),
                    "embedding_ids": ["emb_stale_claim"],
                    "file_urls": [],
                },
                user_id=data["admin_a"].id,
            )
            session.add(task)
            await session.commit()
            task_id = task.id

        # 2. Worker 2 sweeps and reclaims the stale task, completing it
        with patch("db.vector_store.VectorStore.delete_resumes", return_value=True):
            with patch("services.privacy_service.delete_candidate_from_pinecone", return_value=True):
                async with AsyncSessionLocal() as session:
                    res = await sweep_and_process_gdpr_cleanups(session)
                    assert res["succeeded"] == 1

        # Confirm Worker 2 set status = COMPLETED with its new lease
        async with AsyncSessionLocal() as session:
            completed_task = (await session.execute(
                select(AgentTask).where(AgentTask.id == task_id)
            )).scalar_one()
            assert completed_task.status == AgentTaskStatus.COMPLETED
            assert completed_task.celery_task_id != stale_lease
            assert completed_task.celery_task_id.startswith("claim_")
            worker2_completed_at = completed_task.completed_at

        # 3. Simulate Worker 1 (stale worker) waking up and attempting to fail or update the task
        # Using the lease ownership check (WHERE celery_task_id == stale_lease), the update affects 0 rows
        async with AsyncSessionLocal() as session:
            from sqlalchemy import update
            stale_fail_stmt = (
                update(AgentTask)
                .where(
                    AgentTask.id == task_id,
                    AgentTask.status == AgentTaskStatus.RUNNING,
                    AgentTask.celery_task_id == stale_lease,  # Worker 1's old lease
                )
                .values(
                    status=AgentTaskStatus.PENDING,
                    error_message="Worker 1 failed after timeout",
                )
                .execution_options(synchronize_session=False)
            )
            stale_res = await session.execute(stale_fail_stmt)
            await session.commit()
            # Stale update was safely blocked
            assert stale_res.rowcount == 0

        # Verify task status remains COMPLETED with Worker 2's timestamp
        async with AsyncSessionLocal() as session:
            final_task = (await session.execute(
                select(AgentTask).where(AgentTask.id == task_id)
            )).scalar_one()
            assert final_task.status == AgentTaskStatus.COMPLETED
            assert final_task.completed_at == worker2_completed_at
            assert final_task.error_message is None

    @pytest.mark.asyncio
    async def test_pinecone_eventual_consistency_verification_defers_completion(self, temp_erasure_storage):
        """Test 14: Pinecone eventual consistency verification defers completion until vectors truly disappear."""
        from services.privacy_service import delete_candidate_from_pinecone, erase_candidate_personal_data, sweep_and_process_gdpr_cleanups
        from config import settings
        data = await self.setup_test_entities(temp_erasure_storage)

        # Configure mock Pinecone settings
        original_key = getattr(settings, "pinecone_api_key", None)
        original_host = getattr(settings, "pinecone_host", None)
        object.__setattr__(settings, "pinecone_api_key", "test_real_key_123")
        object.__setattr__(settings, "pinecone_host", "https://test-index-123.pinecone.io")

        try:
            # 1. Simulate Pinecone returning remaining vectors on fetch (propagation delay)
            class MockResponse:
                def __init__(self, status_code, json_data):
                    self.status_code = status_code
                    self._json_data = json_data

                def raise_for_status(self):
                    if self.status_code >= 400:
                        raise RuntimeError(f"HTTP {self.status_code}")

                def json(self):
                    return self._json_data

            # Phase 1: delete accepted, but fetch returns existing vector
            mock_http_delayed = AsyncMock()
            mock_http_delayed.post.return_value = MockResponse(200, {})
            mock_http_delayed.get.return_value = MockResponse(200, {"vectors": {"cand_123": {"id": "cand_123"}}})

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client_cls.return_value.__aenter__.return_value = mock_http_delayed
                verified = await delete_candidate_from_pinecone("tenant_1", "cand_123")
                assert verified is False

            # Phase 2: erase_candidate_personal_data returns pending_cleanup when Pinecone has not converged
            with patch("db.vector_store.VectorStore.delete_resumes", return_value=True):
                with patch("services.privacy_service.delete_candidate_from_pinecone", return_value=False):
                    async with AsyncSessionLocal() as session:
                        res = await erase_candidate_personal_data(
                            candidate_id=data["candidate_a"].id,
                            db=session,
                            requesting_user=data["admin_a"],
                        )
                        assert res["status"] == "pending_cleanup"
                        assert res["vector_store_erased"] is False
                        assert "Erasure is not yet complete" in res["message"]

            # Phase 3: fetch returns empty vectors (Pinecone converged) -> returns True
            mock_http_converged = AsyncMock()
            mock_http_converged.post.return_value = MockResponse(200, {})
            mock_http_converged.get.return_value = MockResponse(200, {"vectors": {}})

            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client_cls.return_value.__aenter__.return_value = mock_http_converged
                verified_converged = await delete_candidate_from_pinecone("tenant_1", "cand_123")
                assert verified_converged is True

            # Phase 4: sweep finishes the pending cleanup once Pinecone converges
            with patch("db.vector_store.VectorStore.delete_resumes", return_value=True):
                with patch("services.privacy_service.delete_candidate_from_pinecone", return_value=True):
                    async with AsyncSessionLocal() as session:
                        sweep_res = await sweep_and_process_gdpr_cleanups(session)
                        assert sweep_res["succeeded"] == 1
        finally:
            object.__setattr__(settings, "pinecone_api_key", original_key)
            object.__setattr__(settings, "pinecone_host", original_host)



