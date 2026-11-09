"""
Tests for rewritten AgentOrchestrator
Verifies:
1. Serialization, PII trimming, and fallback formatters.
2. 3-phase Command Center dispatch (run_swarm_phase: discovery, sourcing, outreach).
3. Concurrent outreach + screening and daily volume capping.
"""
import asyncio
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from agents.orchestrator import (
    _MAX_DAILY_OUTREACH_CAP,
    AgentOrchestrator,
    _serialize,
    _trim_candidates_for_critic,
)


class SimpleModelObj:
    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def model_dump(self):
        return self._data

    def model_dump_json(self):
        import json
        return json.dumps(self._data)


class SimpleRunResult:
    def __init__(self, output):
        self.output = output


@pytest.mark.asyncio
async def test_orchestrator_serialization_and_pii_trimming():
    """Test 1: Verifies defensive serialization and anti-bias PII trimming for Critic audit."""
    AgentOrchestrator(tenant_id=str(uuid.uuid4()))

    # Verify _serialize
    sample_model = SimpleModelObj({"foo": "bar", "num": 42})
    serialized = _serialize(sample_model)
    assert serialized == {"foo": "bar", "num": 42}

    nested = {"model": sample_model, "list": [sample_model]}
    assert _serialize(nested) == {
        "model": {"foo": "bar", "num": 42},
        "list": [{"foo": "bar", "num": 42}],
    }

    # Verify _trim_candidates_for_critic strips non-essential PII
    raw_candidates = [
        SimpleModelObj({
            "full_name": "Jane Smith",
            "email": "jane@example.com",
            "phone": "+1-555-0199",
            "address": "San Francisco, CA",
            "skills": ["Python", "FastAPI"],
            "experience_years": 8,
            "internal_notes": "Highly recommended",
        }),
        {
            "name": "Bob Vance",
            "salary_expectation": 180000,
            "skills": ["Kubernetes", "Go"],
            "experience": 6,
        },
    ]
    trimmed = _trim_candidates_for_critic(raw_candidates)
    assert len(trimmed) == 2
    assert trimmed[0] == {"name": "Jane Smith", "skills": ["Python", "FastAPI"], "experience": 8}
    assert trimmed[1] == {"name": "Bob Vance", "skills": ["Kubernetes", "Go"], "experience": 6}
    assert "email" not in trimmed[0]
    assert "phone" not in trimmed[0]


@pytest.mark.asyncio
async def test_orchestrator_run_swarm_phase_dispatch():
    """Test 2: Verifies run_swarm_phase correctly routes discovery, sourcing, and outreach."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid.uuid4()))

    mock_disc_res = SimpleRunResult(SimpleModelObj({"job_description": "Found 5 leads"}))
    mock_sourc_res = SimpleRunResult(SimpleModelObj({"candidates": [{"full_name": "Alice"}]}))
    mock_crit_res = SimpleRunResult(SimpleModelObj({"passed": True}))
    mock_out_res = SimpleRunResult(SimpleModelObj({"subject": "Exciting Opportunity"}))

    with patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock, return_value=mock_disc_res), \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock, return_value=mock_sourc_res), \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock, return_value=mock_crit_res), \
         patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock, return_value=mock_out_res), \
         patch("services.notification_service.notification_service.notify_recruiter_action", new_callable=AsyncMock) as mock_notify, \
         patch("agents.orchestrator.broadcast_signal"):

        # 1. Discovery Phase
        res_disc = await orchestrator.run_swarm_phase("discovery", mode="copilot", industry="Fintech", location="London", mock_mode=True)
        assert "discovery" in res_disc
        assert res_disc["discovery"]["job_description"] == "Found 5 leads"
        assert mock_notify.called

        # 2. Sourcing Phase
        res_sourc = await orchestrator.run_swarm_phase("sourcing", mode="copilot", job_description="Software Engineer", location="London", mock_mode=True)
        assert "sourcing" in res_sourc
        assert len(res_sourc["sourcing"]["candidates"]) == 1
        assert "audit" in res_sourc["sourcing"]

        # 3. Outreach Phase
        candidates = [{"full_name": "Alice", "email": "alice@test.com"}]
        res_out = await orchestrator.run_swarm_phase("outreach", mode="copilot", approved_candidates=candidates, job={"title": "Software Engineer"}, mock_mode=True)
        assert isinstance(res_out, list)
        assert len(res_out) == 1
        assert res_out[0]["candidate"] == "Alice"
        assert res_out[0]["outreach"]["subject"] == "Exciting Opportunity"


@pytest.mark.asyncio
async def test_orchestrator_outreach_phase_with_screening_and_cap():
    """Test 3: Verifies concurrent outreach + screening and daily volume capping."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid.uuid4()))

    overlap_events = {"outreach_started": False, "screening_started": False, "ran_in_parallel": False}

    async def mock_outreach_call(*args, **kwargs):
        overlap_events["outreach_started"] = True
        await asyncio.sleep(0.05)
        if overlap_events["screening_started"]:
            overlap_events["ran_in_parallel"] = True
        return SimpleRunResult(SimpleModelObj({"status": "drafted"}))

    async def mock_screening_call(*args, **kwargs):
        overlap_events["screening_started"] = True
        await asyncio.sleep(0.05)
        if overlap_events["outreach_started"]:
            overlap_events["ran_in_parallel"] = True
        return SimpleRunResult(SimpleModelObj({"questions": ["Q1", "Q2"]}))

    # Generate 40 candidates (exceeds cap of 30)
    bulk_candidates = [{"full_name": f"Candidate {i}"} for i in range(40)]

    with patch("agents.outreach_pydantic.outreach_agent.run", side_effect=mock_outreach_call), \
         patch("agents.screening_pydantic.screening_agent.run", side_effect=mock_screening_call), \
         patch("agents.orchestrator.broadcast_signal"):

        results = await orchestrator.run_swarm_phase(
            "outreach",
            mode="copilot",
            approved_candidates=bulk_candidates,
            job={"title": "Staff Platform Architect", "description": "High scale Kubernetes"},
            enable_screening=True,
            mock_mode=True,
        )

        # Capped to 30 candidates to protect email reputation
        assert len(results) == _MAX_DAILY_OUTREACH_CAP
        assert results[0]["screening_guide"] == {"questions": ["Q1", "Q2"]}
        assert overlap_events["ran_in_parallel"] is True

