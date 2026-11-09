"""Regression unit tests covering CI, SQLite NullPool, auth OTP logging, billing URL, and VectorStore fixes."""

import importlib.metadata
import os
import time
import tomllib
import uuid
from pathlib import Path
from unittest.mock import AsyncMock, patch

import greenlet
import pytest
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.billing import _resolve_safe_return_url
from db.models import AsyncSessionLocal, Tenant
from db.vector_store import VectorStore
from services import redis_service
from services.resume_parser import ResumeParserService


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


def test_ci_requirements_and_pyproject_declare_sqlalchemy_asyncio():
    """Verify CI/Docker requirements and pyproject explicitly pull greenlet via sqlalchemy[asyncio]."""
    backend_root = Path(__file__).resolve().parent.parent
    req_lines = [
        line.strip().lower()
        for line in (backend_root / "requirements.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.strip().startswith("#")
    ]
    assert any(line.startswith("sqlalchemy[asyncio]") or line.startswith("greenlet") for line in req_lines)

    pyproject = tomllib.loads((backend_root / "pyproject.toml").read_text(encoding="utf-8"))
    deps = [dep.lower() for dep in pyproject["project"]["dependencies"]]
    assert any(dep.startswith("sqlalchemy[asyncio]") or dep.startswith("greenlet") for dep in deps)

    assert importlib.metadata.version("greenlet")
    assert hasattr(greenlet, "greenlet")
    assert AsyncSession is not None


def test_redis_circuit_breaker_respects_timeout_under_slow_dns():
    """Verify is_redis_available enforces its wall-clock deadline even when DNS lookup stalls."""
    prev_state = dict(redis_service._circuit_state)
    redis_service._circuit_state["available"] = None
    redis_service._circuit_state["last_checked"] = 0.0

    def slow_connect(*args, **kwargs):
        time.sleep(0.5)
        raise OSError("Simulated DNS timeout")

    try:
        with (
            patch.object(redis_service.settings, "redis_url", "redis://redis:6379/0"),
            patch("services.redis_service.socket.create_connection", side_effect=slow_connect),
        ):
            t0 = time.perf_counter()
            available = redis_service.is_redis_available(timeout=0.05)
            elapsed = time.perf_counter() - t0

        assert available is False
        assert elapsed < 0.1, f"Circuit breaker exceeded 100ms budget during DNS stall: {elapsed:.3f}s"
        assert redis_service._circuit_state["available"] is False
    finally:
        redis_service._circuit_state.clear()
        redis_service._circuit_state.update(prev_state)


def test_deterministic_facet_extraction_section_parity_and_speed():
    """Verify precompiled facet matchers preserve section extraction and stay well below the 20ms SLA."""
    query = "Senior Staff golang developer with k8s, tailwind css, and postgres remote"
    t0 = time.perf_counter()
    facets = ResumeParserService.extract_deterministic_facets(query)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert elapsed_ms < 20.0, f"Facet extraction too slow: {elapsed_ms:.2f}ms"
    assert {"Go", "Kubernetes", "PostgreSQL", "Tailwind CSS", "CSS"}.issubset(set(facets["skills"]))
    assert facets["seniority"] == "Principal/Staff"
    assert facets["work_mode"] == "Remote"

    section_skills = ResumeParserService._extract_skills(
        "General summary",
        {"skills": "Next.js, FastAPI, psql, ci/cd"},
    )
    assert {"Next.js", "FastAPI", "PostgreSQL", "CI/CD"}.issubset(set(section_skills))


def test_dr_mock_docker_shims_are_executable_and_invoked(tmp_path):
    """Verify DR scripts use LF endings and mock docker shims are executable with PATH precedence on POSIX."""
    from tests.test_disaster_recovery_orchestration import (
        BASH_EXE,
        create_valid_dummy_sql_gz,
        run_restore_script_with_mocks,
    )

    repo_root = Path(__file__).resolve().parent.parent.parent
    for script_name in ("restore_db.sh", "backup_db.sh"):
        raw = (repo_root / "scripts" / script_name).read_bytes()
        assert b"\r\n" not in raw, f"scripts/{script_name} must use LF line endings for Linux CI"

    if not BASH_EXE:
        pytest.skip("Bash executable not found on host.")

    db_backup = tmp_path / "dummy.sql.gz"
    create_valid_dummy_sql_gz(db_backup)
    code, _, err, calls = run_restore_script_with_mocks(tmp_path, db_backup, fail_on=None)
    assert code == 0, f"DR restore script failed with mock docker: {err}"
    assert "stop caddy" in calls

    mock_docker = tmp_path / "mock_bin" / "docker"
    assert mock_docker.is_file()
    assert b"\r\n" not in mock_docker.read_bytes()
    if os.name == "posix":
        assert os.access(mock_docker, os.X_OK)
