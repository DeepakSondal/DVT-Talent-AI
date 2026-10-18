"""
DVT Talent AI — Swarm Memory & Communication Fabric Unit Tests
"""
import pytest
from agents.swarm_memory import add_negative_vector, query_memory_tree, get_negative_vectors

@pytest.mark.asyncio
async def test_shared_memory_persistence():
    vectors = get_negative_vectors()
    assert isinstance(vectors, list)

@pytest.mark.asyncio
async def test_swarm_memory_execution_log():
    res = await query_memory_tree("python distributed systems", tenant_id="test_tenant")
    assert res is not None
