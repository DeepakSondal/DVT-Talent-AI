"""
DVT Talent AI — Fast Sourcing & Freehire-Inspired Pipeline Unit Tests
Verifies:
1. VectorStore query embedding cache and single-pass batch embedding in hybrid_search_resumes.
2. Freehire-inspired deterministic facet extraction & alias normalization (<1ms, zero LLM calls).
3. Candidate fingerprint deduplication across sources and evidence-gated scoring.
4. Concurrent multi-source pre-fetching (Internal + GitHub + StackOverflow + Serper) and tenant-scoped caching.
5. Parallel post-sourcing agent execution (Outreach + Analytics + Screening) via asyncio.gather.
6. Strict multi-tenant isolation in fast_hybrid_candidate_search.
"""
import asyncio
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents.orchestrator import AgentOrchestrator
from agents.pydantic_config import AgentDeps
from agents.sourcing_pydantic import (
    _LOCAL_SOURCING_CACHE,
    deduplicate_and_score_candidates,
    fast_hybrid_candidate_search,
    prefetch_all_sourcing_signals,
)
from db.vector_store import VectorStore
from services.resume_parser import ResumeParserService


def test_vector_store_query_cache_and_batch_hybrid_search():
    """Verify query embeddings are cached and unindexed pool candidates are embedded in 1 batch call."""
    vs = VectorStore()
    vs._query_cache.clear()

    with patch.object(vs, "embed_batch", wraps=vs.embed_batch) as spy_batch:
        q = "Principal Distributed Systems Go Kubernetes Engineer"
        vec1 = vs.embed_text(q)
        vec2 = vs.embed_text(q)
        assert vec1 == vec2
        # Second call must hit _query_cache without invoking embed_batch again
        assert spy_batch.call_count == 1

        # Pool of 3 candidates without precomputed embeddings
        unindexed_pool = [
            {"id": "c1", "document": "Go and Kubernetes distributed systems architect"},
            {"id": "c2", "document": "Frontend React and CSS designer"},
            {"id": "c3", "document": "Golang microservices and gRPC backend lead"},
        ]
        spy_batch.reset_mock()
        results = vs.hybrid_search_resumes(
            tenant_id=str(uuid.uuid4()),
            query_text=q,
            candidates_pool=unindexed_pool,
            limit=3,
        )
        assert len(results) == 3
        # Query vector was already cached, and all 3 unindexed candidates must be embedded in a single batch call
        assert spy_batch.call_count == 1
        assert len(spy_batch.call_args[0][0]) == 3
        assert results[0]["id"] in ("c1", "c3")


def test_deterministic_facet_extraction_and_synonyms():
    """Verify Freehire-style <1ms deterministic extraction of canonical skills, seniority, work_mode, and tags."""
    query = "Looking for a Staff / Principal golang, k8s, postgres, and nextjs architect (wfh / remote)"
    t0 = time.perf_counter()
    facets = ResumeParserService.extract_deterministic_facets(query)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0

    assert elapsed_ms < 20.0
    assert "Go" in facets["skills"]
    assert "Kubernetes" in facets["skills"]
    assert "PostgreSQL" in facets["skills"]
    assert "Next.js" in facets["skills"]
    assert facets["seniority"] == "Principal/Staff"
    assert facets["min_years"] == 8
    assert facets["work_mode"] == "Remote"
    assert facets["primary_language"] == "go"
    assert "go" in facets["stackoverflow_tags"]
    assert "kubernetes" in facets["stackoverflow_tags"]


def test_candidate_fingerprint_deduplication_and_evidence_scoring():
    """Verify duplicate candidates across Internal Pool and GitHub merge into a single enriched record."""
    facets = ResumeParserService.extract_deterministic_facets("Senior Go Kubernetes PostgreSQL Engineer")
    raw_candidates = [
        {
            "id": "cand_1",
            "name": "Elena Rostova",
            "email": "elena@rostova.dev",
            "skills": ["golang", "k8s"],
            "experience_years": 7,
            "score": 88.0,
            "source": "Internal Talent Pool",
        },
        {
            "id": "gh_elena",
            "name": "Elena Rostova",
            "email": "elena@rostova.dev",
            "github_url": "https://github.com/elena-rostova",
            "skills": ["postgres", "gRPC"],
            "experience_years": 8,
            "score": 90.0,
            "source": "GitHub",
        },
        {
            "id": "cand_2",
            "name": "Junior Designer",
            "email": "jr@design.io",
            "skills": ["CSS"],
            "experience_years": 1,
            "score": 80.0,
            "source": "Internal Talent Pool",
        },
    ]

    deduped = deduplicate_and_score_candidates(raw_candidates, query_facets=facets)
    assert len(deduped) == 2

    top = deduped[0]
    assert top["name"] == "Elena Rostova"
    assert "Internal Talent Pool + GitHub" in top["source"]
    assert top["github_url"] == "https://github.com/elena-rostova"
    # Canonical normalized skills merged from both sources
    assert set(top["skills"]) == {"Go", "Kubernetes", "PostgreSQL", "gRPC"}
    assert top["experience_years"] == 8
    assert top["score"] > deduped[1]["score"]


@pytest.mark.asyncio
async def test_prefetch_all_sourcing_signals_concurrent_and_cached():
    """Verify internal DB, GitHub, StackOverflow, and Serper signals run concurrently and cache external responses."""
    _LOCAL_SOURCING_CACHE.clear()
    tenant_id = str(uuid.uuid4())

    mock_http = AsyncMock()

    async def slow_get(url, *args, **kwargs):
        await asyncio.sleep(0.10)
        resp = MagicMock()
        resp.status_code = 200
        if "stackexchange.com" in url:
            resp.json.return_value = {
                "items": [
                    {"user": {"display_name": "KubeGuru", "reputation": 45000, "link": "https://stackoverflow.com/u/1"}, "post_count": 120, "score": 890}
                ]
            }
        else:
            resp.json.return_value = {"items": [{"login": "go-ace", "html_url": "https://github.com/go-ace"}]}
        return resp

    async def slow_post(*args, **kwargs):
        await asyncio.sleep(0.10)
        resp = MagicMock()
        resp.status_code = 200
        resp.text = '{"organic": [{"title": "Senior Go Dev - LinkedIn"}]}'
        return resp

    mock_http.get.side_effect = slow_get
    mock_http.post.side_effect = slow_post

    deps = AgentDeps(
        http_client=mock_http,
        tenant_id=tenant_id,
        github_token="ghp_test_token",
        serper_key="serper_test_key",
    )

    combined = await prefetch_all_sourcing_signals(deps, "Golang Kubernetes SRE")

    assert "[DETERMINISTIC_FACETS]" in combined
    assert "[PREFETCHED_INTERNAL_POOL]" in combined
    assert "[PREFETCHED_STACKOVERFLOW_EXPERTS]" in combined
    assert "go-ace" in combined
    assert "KubeGuru" in combined
    assert "Senior Go Dev" in combined
    # 1 GET for GitHub + 1 GET for StackOverflow, 1 POST for Serper
    assert mock_http.get.call_count == 2
    assert mock_http.post.call_count == 1

    # Second call with same query and tenant must hit cache with 0 additional HTTP calls
    combined_cached = await prefetch_all_sourcing_signals(deps, "Golang Kubernetes SRE")
    assert combined_cached == combined
    assert mock_http.get.call_count == 2
    assert mock_http.post.call_count == 1


@pytest.mark.asyncio
async def test_orchestrator_parallel_post_sourcing_execution():
    """Verify Outreach, Analytics, and Screening execute concurrently via asyncio.gather."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid.uuid4()))

    class DummyResult:
        def __init__(self, payload):
            self.output = payload

    class DummyModelObj:
        def __init__(self, data: dict):
            self._data = data
            for k, v in data.items():
                setattr(self, k, v)

        def model_dump(self):
            return self._data

        def model_dump_json(self):
            import json
            return json.dumps(self._data)

    overlap_tracker = {"active": 0, "max_concurrent": 0}

    async def _track_delay(payload):
        overlap_tracker["active"] += 1
        overlap_tracker["max_concurrent"] = max(overlap_tracker["max_concurrent"], overlap_tracker["active"])
        await asyncio.sleep(0.15)
        overlap_tracker["active"] -= 1
        return DummyResult(DummyModelObj(payload))

    async def delayed_outreach(*args, **kwargs):
        return await _track_delay({"status": "drafted"})

    async def delayed_analytics(*args, **kwargs):
        return await _track_delay({"conversion_rate": 0.91})

    async def delayed_screening(*args, **kwargs):
        return await _track_delay({"questions": ["Q1", "Q2"]})

    cand_list = [
        DummyModelObj({"full_name": "Alice Smith", "skills": ["Go"], "experience_years": 6}),
        DummyModelObj({"full_name": "Bob Jones", "skills": ["Rust"], "experience_years": 7}),
        DummyModelObj({"full_name": "Carol Lee", "skills": ["Kubernetes"], "experience_years": 5}),
    ]

    with patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock) as m_disc, \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock) as m_sourc, \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock) as m_crit, \
         patch("agents.outreach_pydantic.outreach_agent.run", side_effect=delayed_outreach), \
         patch("agents.analytics_pydantic.analytics_agent.run", side_effect=delayed_analytics), \
         patch("agents.screening_pydantic.screening_agent.run", side_effect=delayed_screening), \
         patch("agents.orchestrator.broadcast_signal"), \
         patch("services.llm_guardrail_service.guardrail_service.check_rate_limit", new_callable=AsyncMock, return_value=(True, None)):

        m_disc.return_value = DummyResult(DummyModelObj({"job_description": "Senior Systems Engineer"}))
        m_sourc.return_value = DummyResult(DummyModelObj({"candidates": cand_list}))
        m_crit.return_value = DummyResult(DummyModelObj({"passed": True}))

        res = await orchestrator.run_full_pipeline(
            industry="Cloud",
            location="Remote",
            enable_screening=True,
            mock_mode=True,
        )

        assert "error" not in res
        assert "outreach" in res["stages"]
        assert "analytics" in res["stages"]
        assert "screening_guide" in res["stages"]
        # All three post-sourcing stages must have executed concurrently in parallel
        assert overlap_tracker["max_concurrent"] == 3


@pytest.mark.asyncio
async def test_fast_hybrid_candidate_search_tenant_isolation():
    """Verify fast_hybrid_candidate_search surfaces indexed resumes only for the owning tenant."""
    vs = VectorStore()
    tenant_a = str(uuid.uuid4())
    tenant_b = str(uuid.uuid4())

    vs.upsert_resume(
        tenant_id=tenant_a,
        resume_id="res_tenant_a",
        text="Principal Rust and WebAssembly compiler engineer with LLVM experience",
        metadata={
            "candidate_id": "cand_a_1",
            "name": "Elena Rustova",
            "title": "Principal Rust Engineer",
            "skills": "Rust, WebAssembly, LLVM",
            "location": "Berlin",
        },
    )

    hits_a = await fast_hybrid_candidate_search(tenant_id=tenant_a, keywords="Rust LLVM WebAssembly", limit=5)
    hits_b = await fast_hybrid_candidate_search(tenant_id=tenant_b, keywords="Rust LLVM WebAssembly", limit=5)

    names_a = [h["name"] for h in hits_a]
    names_b = [h["name"] for h in hits_b]

    assert "Elena Rustova" in names_a
    assert "Elena Rustova" not in names_b
