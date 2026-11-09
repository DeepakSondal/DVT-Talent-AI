"""Regression unit tests covering CI, SQLite NullPool, auth OTP logging, billing URL, and VectorStore fixes."""

import uuid
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from api.routes.billing import _resolve_safe_return_url
from db.models import AsyncSessionLocal, Tenant
from db.vector_store import VectorStore


@pytest.mark.asyncio
async def test_sqlite_memory_nullpool_persists_across_sessions():
    """Verify :memory: test runs under NullPool preserve committed rows across separate sessions."""
    tenant_id = uuid.uuid4()
    unique_slug = f"nullpool-{tenant_id.hex[:8]}"

    async with AsyncSessionLocal() as writer:
        writer.add(Tenant(id=tenant_id, name=f"NullPool Tenant {unique_slug}", domain=f"{unique_slug}.local"))
        await writer.commit()

    async with AsyncSessionLocal() as reader:
        fetched = (await reader.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
        assert fetched is not None
        assert fetched.id == tenant_id


@pytest.mark.asyncio
async def test_send_registration_otp_logs_email_delivery_error_without_crashing(client):
    """Verify send_registration_otp logs email exceptions cleanly instead of raising NameError."""
    with (
        patch("api.routes.auth.enforce_endpoint_rate_limit", new_callable=AsyncMock),
        patch("api.routes.auth.store_email_otp", new_callable=AsyncMock),
        patch("api.routes.auth.email_service.send_email", new_callable=AsyncMock, side_effect=RuntimeError("smtp offline")),
    ):
        response = await client.post("/api/v1/auth/register/send-otp", json={"email": f"otp.{uuid.uuid4().hex[:8]}@example.com"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "success"
    assert payload["expires_in"] == 600


def test_vector_store_hybrid_search_and_cosine_strict_matching():
    """Verify VectorStore batch embedding alignment and cosine similarity strict length guards."""
    store = VectorStore()
    assert store.cosine_similarity([1.0, 0.0], [1.0, 0.0, 0.0]) == 0.0
    assert store.cosine_similarity([0.0, 0.0], [1.0, 0.0]) == 0.0
    assert store.cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)

    pool = [
        {"id": "cand-1", "tenant_id": "t-1", "document": "Senior Python FastAPI distributed systems engineer"},
        {"id": "cand-2", "tenant_id": "t-1", "document": "Product marketing copywriter"},
    ]
    with (
        patch.object(store, "embed_text", return_value=[1.0, 0.0]),
        patch.object(store, "embed_batch", return_value=[[1.0, 0.0], [0.0, 1.0]]),
    ):
        results = store.hybrid_search_resumes("t-1", "Python FastAPI engineer", candidates_pool=pool, limit=2)

    assert [item["id"] for item in results] == ["cand-1", "cand-2"]
    assert results[0]["score"] > results[1]["score"]


def test_billing_safe_return_url_allows_frontend_origin_and_blocks_external():
    """Verify _resolve_safe_return_url resolves relative/same-origin URLs and rejects open redirects."""
    relative = _resolve_safe_return_url("/dashboard/billing?ok=1", "/billing")
    assert relative.endswith("/dashboard/billing?ok=1")

    with pytest.raises(HTTPException) as exc_info:
        _resolve_safe_return_url("https://evil.example.com/phish", "/billing")
    assert exc_info.value.status_code == 400
