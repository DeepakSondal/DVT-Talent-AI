"""
Tests for DVT Talent AI Architectural Remediations
Verifies:
1. Multi-tenant candidate email isolation (GAP-01)
2. Swarm memory Redis caching (GAP-08)
3. Storage service fallback & security (GAP-05)
4. LLM Guardrail token-bucket & circuit breaker (GAP-06)
"""
import pytest
import uuid
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone
from sqlalchemy import select

from db.models import Candidate, Tenant, User, UserRole, CandidateStatus
from services.storage_service import LocalStorageDriver, get_storage_driver
from services.llm_guardrail_service import LLMGuardrailService, CircuitState
import agents.swarm_memory as sm


@pytest.mark.asyncio
async def test_multi_tenant_candidate_email_isolation(db_session):
    """Verify two different tenants can source a candidate with the exact same email without collision."""
    email = f"shared.talent.{uuid.uuid4().hex[:6]}@example.com"
    
    tenant_1 = Tenant(name="Tenant Alpha", domain=f"alpha-{uuid.uuid4().hex[:6]}.com")
    tenant_2 = Tenant(name="Tenant Beta", domain=f"beta-{uuid.uuid4().hex[:6]}.com")
    db_session.add_all([tenant_1, tenant_2])
    await db_session.flush()

    cand_1 = Candidate(
        tenant_id=tenant_1.id,
        email=email,
        first_name="Jane",
        last_name="Doe",
        status=CandidateStatus.SOURCED
    )
    cand_2 = Candidate(
        tenant_id=tenant_2.id,
        email=email,
        first_name="Jane",
        last_name="Doe",
        status=CandidateStatus.SOURCED
    )
    db_session.add_all([cand_1, cand_2])
    await db_session.commit()

    # Both records must exist independently
    res = await db_session.execute(select(Candidate).where(Candidate.email == email))
    candidates = res.scalars().all()
    assert len(candidates) == 2
    assert set(c.tenant_id for c in candidates) == {tenant_1.id, tenant_2.id}


def test_swarm_memory_redis_caching():
    """Verify semantic cache set and get works through Redis interface."""
    query = f"Test rule verification {uuid.uuid4()}"
    expected_result = "APPLICABLE RULES: Do not contact junior candidates for staff roles"
    
    cache_store = {}
    mock_redis = MagicMock()
    mock_redis.get.side_effect = lambda k: cache_store.get(k)
    mock_redis.setex.side_effect = lambda k, ttl, v: cache_store.update({k: v.encode("utf-8") if isinstance(v, str) else v})

    with patch.object(sm, "_get_redis", return_value=mock_redis):
        sm._set_cache(query, expected_result, ttl_seconds=60)
        import hashlib
        h = hashlib.md5(query.encode()).hexdigest()
        cached = sm._get_cache(h)
        assert cached == expected_result


def test_local_storage_driver_security(tmp_path):
    """Verify local storage driver safely saves, reads, deletes and prevents traversal."""
    driver = LocalStorageDriver(base_dir=tmp_path)
    
    key = "candidates/123/resumes/resume.pdf"
    content = b"%PDF-1.4 Mock PDF Content"
    
    saved_path = driver.save_file(key, content, content_type="application/pdf")
    assert saved_path is not None
    
    read_bytes = driver.read_file(key)
    assert read_bytes == content
    
    # Path traversal attempt must raise ValueError
    with pytest.raises(ValueError):
        driver.save_file("../../etc/passwd", b"malicious")
        
    deleted = driver.delete_file(key)
    assert deleted is True
    assert driver.read_file(key) is None


@pytest.mark.asyncio
async def test_llm_guardrail_rate_limiting_and_circuit():
    """Verify token-bucket rate limiter and circuit breaker tripping."""
    guardrail = LLMGuardrailService()
    tenant_id = f"test_tenant_{uuid.uuid4().hex[:6]}"
    
    # Simulated Redis mock for guardrail
    store = {}
    mock_redis = AsyncMock()
    
    mock_pipeline = MagicMock()
    mock_pipeline.incr = MagicMock()
    mock_pipeline.expire = MagicMock()
    mock_pipeline.incrby = MagicMock()
    mock_pipeline.execute = AsyncMock(return_value=[1, True, 500, True])
    mock_redis.pipeline.return_value = mock_pipeline
    
    async def mock_get(key):
        return store.get(key)
    async def mock_setex(key, ttl, val):
        store[key] = val
    async def mock_delete(key):
        store.pop(key, None)
    async def mock_incr(key):
        val = int(store.get(key, 0)) + 1
        store[key] = val
        return val

    mock_redis.get.side_effect = mock_get
    mock_redis.setex.side_effect = mock_setex
    mock_redis.delete.side_effect = mock_delete
    mock_redis.incr.side_effect = mock_incr

    with patch.object(guardrail, "_get_redis", return_value=mock_redis):
        # Check rate limit allows initial request
        allowed, err = await guardrail.check_rate_limit(tenant_id=tenant_id, provider="test_groq", rpm_limit=5)
        assert allowed is True
        assert err is None
        
        # Trip circuit breaker
        await guardrail.record_provider_error(provider="test_groq", error_status=429, cooldown_seconds=5)
        state = await guardrail.get_circuit_state(provider="test_groq")
        assert state == CircuitState.OPEN
        
        # Reset circuit breaker
        await guardrail.record_provider_success(provider="test_groq")
        state = await guardrail.get_circuit_state(provider="test_groq")
        assert state == CircuitState.CLOSED


@pytest.mark.asyncio
async def test_auth_logout_and_revocation(db_session):
    """Verify logging out deletes auth cookies and writes token to Redis blocklist."""
    from fastapi import Request
    from api.routes.auth import logout, create_access_token
    from config import settings

    test_user = User(
        email=f"logout.tester.{uuid.uuid4().hex[:6]}@example.com",
        full_name="Logout Tester",
        hashed_password="mock_hashed_pass",
        role=UserRole.RECRUITER,
        is_active=True
    )
    db_session.add(test_user)
    await db_session.commit()

    token = create_access_token({"sub": str(test_user.id), "role": test_user.role.value, "type": "access"})
    
    mock_request = MagicMock(spec=Request)
    mock_request.headers = {"Authorization": f"Bearer {token}"}
    mock_request.cookies = {}

    blacklisted_keys = {}
    mock_redis = AsyncMock()
    async def mock_setex(key, ttl, val):
        blacklisted_keys[key] = val
    mock_redis.setex.side_effect = mock_setex

    with patch("redis.asyncio.from_url", return_value=mock_redis):
        response = await logout(request=mock_request, current_user=test_user)
        assert response.status_code == 200
        # Verify token was blacklisted
        assert f"blacklist:{token}" in blacklisted_keys
