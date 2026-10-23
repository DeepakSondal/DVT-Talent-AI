"""
DVT Talent AI — Vector Store Integration Tests
Tests actual connectivity and indexing with a live ChromaDB server.
Enabled only via RUN_INTEGRATION_TESTS=1.
"""
import os
import pytest
from db.vector_store import VectorStore, CHROMA_AVAILABLE

# Only run if explicitly enabled to allow CI/CD to skip
@pytest.mark.skipif(
    os.environ.get("RUN_INTEGRATION_TESTS") != "1" or not CHROMA_AVAILABLE,
    reason="RUN_INTEGRATION_TESTS=1 not set or chromadb client not installed on test runner."
)
def test_vector_store_live_index():
    """Verify that we can actually connect and index in a real ChromaDB instance."""
    vs = VectorStore()
    
    test_id = "integration_test_res_001"
    test_text = "Experienced Senior Distributed Systems Engineer specializing in Rust and Go."
    test_meta = {"name": "Integration Test Candidate", "source": "test_suite"}
    
    # 1. Clear existing (optional)
    # vs.collection.delete(ids=[test_id])
    
    # 2. Upsert
    vs.upsert_resume("tenant_integration_001", test_id, test_text, test_meta)
    
    # 3. Query
    results = vs.search_resumes("tenant_integration_001", "Distributed Systems Engineer Rust", limit=1)
    
    assert len(results) >= 1
    assert results[0]["id"] == test_id
    assert results[0]["metadata"]["name"] == "Integration Test Candidate"
