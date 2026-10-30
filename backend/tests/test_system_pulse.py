"""
DVT Talent AI — System Pulse Regression & Truth Test Suite
Verifies the complete async agent orchestration pipeline logic:
1. Full autonomous pulse (Discovery -> Sourcing -> Critic -> Outreach -> Analytics).
2. Autonomous pulse with optional AI Screening Guide generation.
3. Fallback self-healing when sourcing yields below candidate threshold.
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from agents.orchestrator import AgentOrchestrator
from agents.discovery_pydantic import DiscoveryResult, ExtractedJD, MarketIQ, TargetCompany
from agents.sourcing_pydantic import SourcingSynthesis, CandidateNode
from agents.screening_pydantic import ScreeningPlan, ScreeningQuestion


class MockPydanticResult:
    def __init__(self, data):
        self.data = data
        self.output = data


@pytest.mark.asyncio
async def test_full_autonomous_pulse_logic():
    """Test 1: Verifies the 5-stage unified pipeline with mock agents and signals."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid4()))

    mock_disc = MockPydanticResult(
        DiscoveryResult(
            market_iq=MarketIQ(salary_range="$140,000 - $190,000", talent_density="High"),
            target_companies=[TargetCompany(name="Apex Systems", fit_score=95.0)],
            extracted_jd=ExtractedJD(
                title="Lead AI Architect",
                core_stack=["Python", "PyTorch", "Kubernetes"],
                must_haves=["Distributed Systems", "LLM Inference"],
                nice_to_haves=["Vector DBs"],
            ),
            strategic_advice="Focus on low-latency inference specialists.",
        )
    )

    mock_sourc = MockPydanticResult(
        SourcingSynthesis(
            candidates=[
                CandidateNode(full_name="Alex Rivera", skills=["Python", "PyTorch"], match_score=95),
                CandidateNode(full_name="Jordan Vance", skills=["Kubernetes", "Go"], match_score=92),
                CandidateNode(full_name="Morgan Reed", skills=["LLM Inference", "FastAPI"], match_score=91),
            ]
        )
    )

    mock_crit = MockPydanticResult({"passed": True, "audited_count": 3, "score": 96})
    mock_out = MockPydanticResult({"drafts": [{"candidate": "Alex Rivera", "subject": "AI Architect role"}]})
    mock_anal = MockPydanticResult({"kpi_summary": "High talent fit", "efficiency_score": 98.5})

    with patch("agents.orchestrator.broadcast_signal") as mock_signal, \
         patch("agents.orchestrator.guardrail_service.check_rate_limit", new_callable=AsyncMock, return_value=(True, None)), \
         patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock, return_value=mock_disc), \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock, return_value=mock_sourc), \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock, return_value=mock_crit), \
         patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock, return_value=mock_out), \
         patch("agents.analytics_pydantic.analytics_agent.run", new_callable=AsyncMock, return_value=mock_anal):

        results = await orchestrator.run_full_pipeline(
            industry="AI Infrastructure",
            location="Remote",
            enable_screening=False,
        )

        assert "stages" in results
        stages = results["stages"]
        assert "discovery" in stages
        assert "sourcing" in stages
        assert "critic" in stages
        assert "outreach" in stages
        assert "analytics" in stages

        # Discovery structure validation
        assert stages["discovery"]["extracted_jd"]["title"] == "Lead AI Architect"
        assert len(stages["discovery"]["target_companies"]) == 1

        # Sourcing structure validation
        assert len(stages["sourcing"]["candidates"]) == 3
        assert stages["sourcing"]["candidates"][0]["full_name"] == "Alex Rivera"

        # Signal telemetry dispatched
        assert mock_signal.called


@pytest.mark.asyncio
async def test_autonomous_pulse_with_screening_enabled():
    """Test 2: Verifies that enabling screening generates and attaches the screening_guide stage."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid4()))

    mock_disc = MockPydanticResult(
        DiscoveryResult(
            extracted_jd=ExtractedJD(title="Staff SRE", core_stack=["Terraform", "Rust"])
        )
    )
    mock_sourc = MockPydanticResult(
        SourcingSynthesis(
            candidates=[
                CandidateNode(full_name="Sam Taylor", skills=["Terraform"]),
                CandidateNode(full_name="Riley Finch", skills=["Rust"]),
                CandidateNode(full_name="Casey Quinn", skills=["Kubernetes"]),
            ]
        )
    )
    mock_crit = MockPydanticResult({"passed": True})
    mock_out = MockPydanticResult({"drafts": []})
    mock_anal = MockPydanticResult({"score": 90})

    mock_screening = MockPydanticResult(
        ScreeningPlan(
            role_title="Staff SRE",
            overview="Distributed systems reliability assessment",
            questions=[
                ScreeningQuestion(
                    question="How do you architect multi-region disaster recovery?",
                    category="Architecture",
                    difficulty="Senior",
                    ideal_answer="Active-active or warm standby with automated DNS failover.",
                    key_signals=["RTO/RPO", "data replication", "split-brain prevention"],
                )
            ]
        )
    )

    with patch("agents.orchestrator.broadcast_signal"), \
         patch("agents.orchestrator.guardrail_service.check_rate_limit", new_callable=AsyncMock, return_value=(True, None)), \
         patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock, return_value=mock_disc), \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock, return_value=mock_sourc), \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock, return_value=mock_crit), \
         patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock, return_value=mock_out), \
         patch("agents.analytics_pydantic.analytics_agent.run", new_callable=AsyncMock, return_value=mock_anal), \
         patch("agents.screening_pydantic.screening_agent.run", new_callable=AsyncMock, return_value=mock_screening):

        results = await orchestrator.run_full_pipeline(
            industry="Cloud Platform",
            location="San Francisco",
            enable_screening=True,
        )

        assert "stages" in results
        assert "screening_guide" in results["stages"]
        guide = results["stages"]["screening_guide"]
        assert guide["role_title"] == "Staff SRE"
        assert len(guide["questions"]) == 1


@pytest.mark.asyncio
async def test_pulse_self_healing_sourcing_fallback():
    """Test 3: Verifies that if sourcing returns fewer than 3 candidates, fallback discovery triggers."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid4()))

    mock_disc_1 = MockPydanticResult(
        DiscoveryResult(
            extracted_jd=ExtractedJD(title="Specialized ML Scientist", must_haves=["Extremely Rare Skill X"])
        )
    )
    mock_disc_2 = MockPydanticResult(
        DiscoveryResult(
            extracted_jd=ExtractedJD(title="Specialized ML Scientist", must_haves=["Loosened ML Skill"])
        )
    )

    # First attempt: only 1 candidate (< 3 threshold)
    mock_sourc_1 = MockPydanticResult(
        SourcingSynthesis(candidates=[CandidateNode(full_name="Lone Node")])
    )
    # Second attempt after loosening: 4 candidates
    mock_sourc_2 = MockPydanticResult(
        SourcingSynthesis(
            candidates=[
                CandidateNode(full_name="Lone Node"),
                CandidateNode(full_name="Node Two"),
                CandidateNode(full_name="Node Three"),
                CandidateNode(full_name="Node Four"),
            ]
        )
    )

    mock_crit = MockPydanticResult({"passed": True})
    mock_out = MockPydanticResult({"drafts": []})
    mock_anal = MockPydanticResult({"report": "Fallback recovery succeeded"})

    with patch("agents.orchestrator.broadcast_signal") as mock_signal, \
         patch("agents.orchestrator.guardrail_service.check_rate_limit", new_callable=AsyncMock, return_value=(True, None)), \
         patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock, side_effect=[mock_disc_1, mock_disc_2]) as disc_runner, \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock, side_effect=[mock_sourc_1, mock_sourc_2]) as sourc_runner, \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock, return_value=mock_crit), \
         patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock, return_value=mock_out), \
         patch("agents.analytics_pydantic.analytics_agent.run", new_callable=AsyncMock, return_value=mock_anal):

        results = await orchestrator.run_full_pipeline(
            industry="Quantum AI",
            location="Boston",
        )

        assert "stages" in results
        # Discovery and Sourcing should each have been called twice (fallback protocol triggered)
        assert disc_runner.call_count == 2
        assert sourc_runner.call_count == 2
        assert len(results["stages"]["sourcing"]["candidates"]) == 4
