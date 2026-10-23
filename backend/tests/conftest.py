import pytest
from db.vector_store import CHROMA_AVAILABLE
import pytest_asyncio
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from main import app
from db.models import Base, get_db
import db.models

# Test database URL (using SQLite in-memory for speed)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(autouse=True)
async def ensure_db_tables():
    from db.models import engine, Base
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        pass
    yield


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
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.pop(get_db, None)


@pytest_asyncio.fixture
async def async_client(client) -> AsyncClient:
    """Explicitly yielded client for tests that strictly require an awaited object."""
    return client
