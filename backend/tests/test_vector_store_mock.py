"""
DVT Talent AI — Vector Store Unit Tests
Tests VectorStore singleton, tenant-scoped resume/job indexing, and similarity search.
"""
import uuid

from db.vector_store import VectorStore


def test_singleton_pattern():
    """Verify VectorStore behaves as a singleton."""
    vs1 = VectorStore()
    vs2 = VectorStore()
    assert vs1 is vs2


def test_vector_store_upsert_and_tenant_isolated_search():
    """Verify upsert and filtered search isolate resumes strictly by tenant_id."""
    vs = VectorStore()
    tenant_a = f"tenant_{uuid.uuid4().hex[:8]}"
    tenant_b = f"tenant_{uuid.uuid4().hex[:8]}"
    vs.upsert_resume(tenant_a, "res_123", "Senior Python FastAPI engineer", {"name": "John", "role": "backend"})
    vs.upsert_resume(tenant_b, "res_999", "Senior Python FastAPI engineer", {"name": "Jane", "role": "backend"})

    results = vs.search_resumes(tenant_a, "Looking for Python Expert", limit=5, filters={"role": "backend"})
    assert [r["id"] for r in results] == ["res_123"]
    assert results[0]["metadata"]["name"] == "John"


def test_vector_store_job_upsert_and_search():
    """Verify job upsert and UUID-scoped search_jobs work cleanly."""
    vs = VectorStore()
    tenant_id = str(uuid.uuid4())
    job_id = str(uuid.uuid4())
    vs.upsert_job(job_id, "Staff Platform Engineer Kubernetes Terraform", {"title": "Staff SRE"}, tenant_id=tenant_id)

    results = vs.search_jobs("Kubernetes Terraform SRE", limit=3, tenant_id=tenant_id)
    assert any(r["id"] == job_id for r in results)
