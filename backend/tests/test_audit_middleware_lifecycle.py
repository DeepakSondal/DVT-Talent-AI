"""
Unit Tests for Audit Middleware Lifecycle, Async Session Draining & Analytics Schema Alignment
Validates:
1. Background audit tasks are tracked and cleanly drained before event loop termination.
2. Draining empty or already-completed tasks is a safe non-blocking no-op.
3. Analytics dashboard schema returns jobs and candidate telemetry without orphaned mock fields.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient, ASGITransport

from main import app
from api.middleware.audit_log import _active_audit_tasks, drain_audit_log_tasks
from api.routes.auth import create_access_token
from db.models import Tenant, User, UserRole, Job, Candidate, get_db
import uuid


@pytest.mark.asyncio
async def test_audit_middleware_registers_and_drains_tasks():
    """Verify in-flight audit background tasks are registered and drained cleanly."""
    initial_pending = len(_active_audit_tasks)

    # Create dummy async task that sleeps briefly
    async def dummy_audit():
        await asyncio.sleep(0.05)

    task = asyncio.create_task(dummy_audit())
    _active_audit_tasks.add(task)
    task.add_done_callback(_active_audit_tasks.discard)

    assert len(_active_audit_tasks) >= 1
    # Drain must wait for completion
    await drain_audit_log_tasks(timeout=1.0)
    assert task.done() is True
    assert task not in _active_audit_tasks


@pytest.mark.asyncio
async def test_drain_audit_log_tasks_empty_noop():
    """Verify drain_audit_log_tasks handles empty sets gracefully without hanging or throwing."""
    # Ensure empty set behavior
    _active_audit_tasks.clear()
    await drain_audit_log_tasks(timeout=0.1)
    assert len(_active_audit_tasks) == 0


@pytest.mark.asyncio
async def test_analytics_dashboard_contract_aligned(db_session):
    """Verify /analytics/dashboard returns active jobs and candidate metrics without orphaned mock fields."""
    t_id = uuid.uuid4()
    u_id = uuid.uuid4()

    tenant = Tenant(id=t_id, name=f"Audit Test Tenant {uuid.uuid4().hex[:6]}", domain=f"att-{uuid.uuid4().hex[:6]}.com")
    user = User(
        id=u_id,
        tenant_id=t_id,
        email=f"auditor_{uuid.uuid4().hex[:6]}@test.local",
        full_name="Auditor One",
        role=UserRole.ADMIN,
        hashed_password="mock_password_hash",
    )
    job = Job(id=uuid.uuid4(), tenant_id=t_id, title="Lead SRE", is_active=True)
    candidate = Candidate(id=uuid.uuid4(), tenant_id=t_id, first_name="Grace", last_name="Hopper", email=f"grace_{uuid.uuid4().hex[:6]}@test.local")

    db_session.add(tenant)
    await db_session.flush()
    db_session.add_all([user, job, candidate])
    await db_session.commit()

    token = create_access_token({"sub": str(u_id), "tenant_id": str(t_id)})
    headers = {"Authorization": f"Bearer {token}"}

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            res = await ac.get("/api/v1/analytics/dashboard", headers=headers)
            assert res.status_code == 200
            data = res.json()

            # Required active sections
            assert "jobs" in data
            assert data["jobs"]["total"] >= 1
            assert data["jobs"]["active"] >= 1
            assert "candidates" in data
            assert data["candidates"]["total"] >= 1
            assert "outreach" in data
            assert "interviews" in data

            # Verify pruned legacy fields are absent
            assert "companies" not in data
            assert "leads" not in data
    finally:
        await drain_audit_log_tasks()
        app.dependency_overrides.pop(get_db, None)

