"""
Unit tests for Redis Multi-Worker Caches:
1. resolve_tenant_api_keys stores AES-encrypted credentials in Redis and serves cross-worker reads.
2. invalidate_tenant_keys_cache_async deletes both local memory and Redis keys.
3. generate_interview_prep reads/writes Redis-backed tenant-scoped STAR cards across workers.
4. _get_sourcing_cache / _set_sourcing_cache use matching SHA-256 hashes for Redis hits.
"""
import hashlib
import json
import uuid
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents import pydantic_config, sourcing_pydantic
from api.routes import candidate_portal
from api.routes.candidate_portal import InterviewPrepResponse, InterviewStarCard
from services.security_service import encrypt_pii


@pytest.mark.asyncio
async def test_resolve_tenant_api_keys_uses_aes_encrypted_redis():
    """Test 1: Tenant BYOK keys are stored AES-encrypted in Redis (never plaintext) and read across workers."""
    tenant_id = str(uuid.uuid4())
    pydantic_config.invalidate_tenant_keys_cache(tenant_id)

    redis_store: dict[str, str] = {}

    async def _fake_get(key: str) -> str | None:
        return redis_store.get(key)

    async def _fake_set(key: str, val: str, ttl_seconds: int = 60) -> bool:
        redis_store[key] = val
        return True

    fake_row = SimpleNamespace(
        openai_key=encrypt_pii("sk-worker-secret"),
        serper_key=None,
        anthropic_key=None,
        monster_api_key=encrypt_pii("mnstr-worker-secret"),
        dice_api_key=None,
    )
    fake_session = AsyncMock()
    fake_session.__aenter__.return_value = fake_session
    fake_session.__aexit__.return_value = None
    exec_res = MagicMock()
    exec_res.scalar_one_or_none.return_value = fake_row
    fake_session.execute = AsyncMock(return_value=exec_res)

    with (
        patch("services.redis_service.cache_get_text", side_effect=_fake_get),
        patch("services.redis_service.cache_set_text", side_effect=_fake_set),
        patch("db.models.AsyncSessionLocal", return_value=fake_session),
    ):
        first = await pydantic_config.resolve_tenant_api_keys(tenant_id)
        assert first["openai_key"] == "sk-worker-secret"
        assert first["monster_api_key"] == "mnstr-worker-secret"

        redis_key = f"tenant:{tenant_id}:team_keys"
        assert redis_key in redis_store
        # Must NOT contain plaintext secrets in Redis
        assert "sk-worker-secret" not in redis_store[redis_key]
        assert "mnstr-worker-secret" not in redis_store[redis_key]

        # Simulate a second worker with empty in-process cache -> should hit Redis without DB
        pydantic_config._TENANT_KEYS_CACHE.clear()
        fake_session.execute.reset_mock()
        second = await pydantic_config.resolve_tenant_api_keys(tenant_id)
        assert second["openai_key"] == "sk-worker-secret"
        assert second["monster_api_key"] == "mnstr-worker-secret"
        fake_session.execute.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalidate_tenant_keys_cache_async_clears_local_and_redis():
    """Test 2: Cache invalidation removes both local memory entry and Redis key."""
    tenant_id = str(uuid.uuid4())
    pydantic_config._TENANT_KEYS_CACHE[tenant_id] = (9999999999.0, {"openai_key": "stale"})

    with patch("services.redis_service.cache_delete", new=AsyncMock(return_value=True)) as mock_del:
        await pydantic_config.invalidate_tenant_keys_cache_async(tenant_id)

    assert tenant_id not in pydantic_config._TENANT_KEYS_CACHE
    mock_del.assert_awaited_once_with(f"tenant:{tenant_id}:team_keys")


@pytest.mark.asyncio
async def test_interview_prep_serves_from_redis_across_workers():
    """Test 3: Second worker with empty local cache serves STAR cards from Redis without LLM call."""
    candidate_portal._INTERVIEW_PREP_CACHE.clear()
    tenant_id = uuid.uuid4()
    job_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    cached_resp = InterviewPrepResponse(
        job_title="Staff Python Engineer",
        company_name="ScaleCo",
        archetype="Backend Architect",
        cards=[
            InterviewStarCard(
                question="Tell me about scaling Redis across workers.",
                category="Architecture",
                situation="Multi-worker API deployment.",
                task="Eliminate stale local caches.",
                action="Moved caches to Redis with tenant namespaces.",
                result="Consistent reads across replicas.",
                interviewer_focus="Distributed systems rigor.",
                pitfalls_to_avoid="Never store plaintext secrets.",
            )
        ],
    )
    fake_cand = SimpleNamespace(id=cand_id, tenant_id=tenant_id, title="Engineer", skills=["Python"])
    fake_job = SimpleNamespace(
        id=job_id,
        tenant_id=tenant_id,
        company_id=uuid.uuid4(),
        title="Staff Python Engineer",
        is_active=True,
        is_published=True,
    )
    db = AsyncMock()
    r_job = MagicMock()
    r_job.scalar_one_or_none.return_value = fake_job
    db.execute = AsyncMock(return_value=r_job)
    fake_user: Any = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id)

    with (
        patch.object(candidate_portal, "get_or_create_candidate_for_user", new=AsyncMock(return_value=fake_cand)),
        patch("services.redis_service.cache_get_text", new=AsyncMock(return_value=cached_resp.model_dump_json())),
        patch("agents.screening_pydantic.generate_interview_prep_cards", new=AsyncMock()) as mock_ai,
    ):
        out = await candidate_portal.generate_interview_prep(
            job_id=job_id, refresh=False, current_user=fake_user, db=db
        )

    assert out.archetype == "Backend Architect"
    assert len(out.cards) == 1
    mock_ai.assert_not_awaited()


def test_sourcing_cache_uses_consistent_sha256_hash():
    """Test 4: _get_sourcing_cache passes the same SHA-256 hash that swarm_memory._set_cache stores."""
    tenant_id = str(uuid.uuid4())
    raw_key = "github:python language:python type:user"
    expected_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
    sourcing_pydantic._LOCAL_SOURCING_CACHE.clear()

    with patch.object(sourcing_pydantic, "_get_cache", return_value=json.dumps([{"login": "dev1"}])) as mock_get:
        hit = sourcing_pydantic._get_sourcing_cache(raw_key, tenant_id=tenant_id)

    mock_get.assert_called_once_with(expected_hash, tenant_id=tenant_id)
    assert hit is not None
    assert "dev1" in hit
