from typing import AsyncGenerator

import pytest
import pytest_asyncio
import structlog
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

import db.models
from db.models import Base, get_db
from main import app

log = structlog.get_logger(__name__)

# Test database URL (using SQLite in-memory for speed)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
async def ensure_db_tables():
    from api.middleware.audit_log import drain_audit_log_tasks
    from db.models import engine
    from services.redis_service import (
        _in_memory_blacklist,
        _in_memory_oauth_links,
        _in_memory_otp_attempts,
        _in_memory_otps,
        _in_memory_ratelimit,
    )

    _in_memory_ratelimit.clear()
    _in_memory_blacklist.clear()
    _in_memory_oauth_links.clear()
    _in_memory_otps.clear()
    _in_memory_otp_attempts.clear()

    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        log.warning("ensure_db_tables_failed", error=str(exc))
    yield
    await drain_audit_log_tasks()


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with db.models.AsyncSessionLocal() as session:
        yield session


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    from httpx import ASGITransport
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            yield ac
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def async_client(client) -> AsyncClient:
    """Explicitly yielded client for tests that strictly require an awaited object."""
    return client
