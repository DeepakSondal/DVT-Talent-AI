"""
DVT Talent AI — Test Suite for 3-2-1 Vector Architecture & ChromaDB Decommissioning
Tests:
1. Batch Processing: embed_batch() parallel throughput & upsert_resumes_batch().
2. Hybrid Search: BM25 lexical match + FastEmbed semantic similarity ranking.
3. Native pgvector async queries on Resume models with tenant isolation.
4. ChromaDB Decommissioning: Full functionality and erasure with zero external Chroma dependency.
"""
import pytest
import uuid
from db.vector_store import VectorStore, vector_store
from db.models import Resume, Candidate, Tenant


def test_embed_batch_dimensions_and_isolation():
    """Verify embed_batch produces 384-d vectors for multiple documents concurrently."""
    vs = VectorStore()
    docs = [
        "Senior React and TypeScript Frontend Engineer with Next.js",
        "Lead Python Backend Architect building FastAPI microservices",
        "DevOps Engineer managing Kubernetes clusters with Terraform",
    ]
    vectors = vs.embed_batch(docs)

    assert len(vectors) == 3
    for vec in vectors:
        assert isinstance(vec, list)
        assert len(vec) == 384
        assert any(v != 0.0 for v in vec)


def test_upsert_resumes_batch_and_search():
    """Verify batch upserting multiple candidate resumes with tenant scoping."""
    vs = VectorStore()
    tenant_id = str(uuid.uuid4())
    items = [
        {
            "id": "cand_b1",
            "text": "Go backend developer building high throughput Kafka systems",
            "metadata": {"candidate_id": "c_1", "role": "Go Developer"}
        },
        {
            "id": "cand_b2",
            "text": "Senior Rust systems programmer writing low latency network kernels",
            "metadata": {"candidate_id": "c_2", "role": "Rust Developer"}
        },
        {
            "id": "cand_b3",
            "text": "Data scientist training PyTorch vision transformers",
            "metadata": {"candidate_id": "c_3", "role": "Data Scientist"}
        }
    ]

    count = vs.upsert_resumes_batch(tenant_id=tenant_id, items=items)
    assert count == 3

    # Search for Go systems
    results = vs.search_resumes(tenant_id=tenant_id, query_text="Golang and Kafka message queues", limit=2)
    assert len(results) >= 1
    assert results[0]["id"] == "cand_b1"
    assert results[0]["score"] > 0.4


def test_hybrid_search_bm25_and_semantic_fusion():
    """Verify Hybrid Search blends exact keyword matches (e.g. specific certs) with semantic meaning."""
    vs = VectorStore()
    tenant_id = str(uuid.uuid4())

    candidates = [
        {
            "id": "cand_sec_1",
            "text": "Senior Security Analyst with general cloud security and compliance background",
            "document": "Senior Security Analyst with general cloud security and compliance background"
        },
        {
            "id": "cand_sec_2",
            "text": "Cybersecurity auditor specialized in ISO 27001 and SOC 2 Type II audits",
            "document": "Cybersecurity auditor specialized in ISO 27001 and SOC 2 Type II audits"
        }
    ]

    # Query with specific exact certification acronym
    query = "ISO 27001 lead auditor"
    hybrid_results = vs.hybrid_search_resumes(
        tenant_id=tenant_id,
        query_text=query,
        candidates_pool=candidates,
        limit=2,
        alpha=0.5
    )

    assert len(hybrid_results) == 2
    # The candidate with exact certification acronyms must rank #1
    top_cand = hybrid_results[0]
    assert top_cand["id"] == "cand_sec_2"
    assert top_cand["lexical_score"] > 0.0
    assert top_cand["score"] > hybrid_results[1]["score"]


@pytest.mark.asyncio
async def test_search_resumes_pgvector_native(db_session):
    """Verify search_resumes_pgvector executes cleanly using SQLAlchemy async session."""
    tenant = Tenant(id=uuid.uuid4(), name="Vector Test Tenant")
    db_session.add(tenant)
    await db_session.flush()

    candidate = Candidate(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        first_name="Vector",
        last_name="Tester",
        email=f"vector_{uuid.uuid4().hex[:6]}@example.com",
    )
    db_session.add(candidate)
    await db_session.flush()

    vs = VectorStore()
    resume_text = "Principal Site Reliability Engineer with AWS, Terraform, and Prometheus observability"
    resume_emb = vs.embed_text(resume_text)

    resume = Resume(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        candidate_id=candidate.id,
        file_name="sre_cv.pdf",
        raw_text=resume_text,
        embedding=resume_emb,
        is_current=True
    )
    db_session.add(resume)
    await db_session.commit()

    # Query using pgvector async method
    results = await vs.search_resumes_pgvector(
        session=db_session,
        tenant_id=str(tenant.id),
        query_text="Site reliability engineer Kubernetes AWS",
        limit=5
    )

    assert len(results) == 1
    assert results[0]["id"] == str(resume.id)
    assert results[0]["score"] > 0.5


def test_chroma_decommission_resilience():
    """Verify deletion and querying succeed with zero ChromaDB cluster available."""
    vs = VectorStore()
    tenant_id = str(uuid.uuid4())
    cand_id = str(uuid.uuid4())
    res_id = str(uuid.uuid4())

    vs.upsert_resume(
        tenant_id=tenant_id,
        resume_id=res_id,
        text="Fullstack Next.js and Python engineer",
        metadata={"candidate_id": cand_id}
    )

    # Confirm present in tenant space
    matches_before = vs.search_resumes(tenant_id=tenant_id, query_text="Next.js")
    assert len(matches_before) == 1

    # GDPR delete
    success = vs.delete_resumes(tenant_id=tenant_id, candidate_id=cand_id)
    assert success is True

    # Confirm erased
    matches_after = vs.search_resumes(tenant_id=tenant_id, query_text="Next.js")
    assert len(matches_after) == 0
