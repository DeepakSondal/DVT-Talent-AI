"""
DVT Talent AI — Vector Store PGVector Integration Tests
Tests async pgvector similarity queries via SQLAlchemy session.
Enabled only via RUN_INTEGRATION_TESTS=1.
"""
import os
import uuid

import pytest

from db.models import AsyncSessionLocal
from db.vector_store import VectorStore


@pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1",
    reason="RUN_INTEGRATION_TESTS=1 not set on test runner.",
)
@pytest.mark.asyncio
async def test_vector_store_live_pgvector_query():
    """Verify search_resumes_pgvector executes cleanly against the configured database."""
    vs = VectorStore()
    async with AsyncSessionLocal() as session:
        results = await vs.search_resumes_pgvector(
            session=session,
            tenant_id=str(uuid.uuid4()),
            query_text="Distributed Systems Engineer Rust",
            limit=3,
        )
    assert isinstance(results, list)
