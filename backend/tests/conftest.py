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
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session")
async def test_engine():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()

@pytest.fixture
async def db_session(test_engine) -> AsyncGenerator[AsyncSession, None]:
    async_session = sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    # Patch the global sessionmaker used by agents/main
    original_sessionmaker = db.models.AsyncSessionLocal
    db.models.AsyncSessionLocal = async_session
    
    async with async_session() as session:
        yield session
        
    db.models.AsyncSessionLocal = original_sessionmaker

@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()

@pytest_asyncio.fixture
async def async_client(client) -> AsyncClient:
    """Explicitly yielded client for tests that strictly require an awaited object."""
    return client
