import pytest
import asyncio
import json
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock
from uuid import uuid4

from agents.orchestrator import AgentOrchestrator
from db.models import Company, Lead, Candidate, EmailSent, EmailCampaign

@pytest.mark.asyncio
async def test_full_autonomous_pulse_logic():
    """
    SDET 'Truth Test': Verifies the complete async pipeline logic without external APIs.
    Validates: Async Flow -> DB Persistence -> Relationship Linking -> Signaling.
    """
    # 1. Setup Orchestrator with Mocked Agents
    orchestrator = AgentOrchestrator()
    
    # Mocking internal agent 'run' methods to return predictable test data
    orchestrator.agents["market_intelligence"].run = MagicMock(return_value={
        "companies": [
            {"name": "Nova Tech", "domain": "novatech.io", "industry": "AI", "location": "London"}
        ]
    })
    
    orchestrator.agents["company_research"].run = MagicMock(return_value={
        "tech_stack": ["Python", "React"],
        "open_roles": ["Senior Backend Engineer"],
        "company_score": 85
    })
    
    orchestrator.agents["lead_discovery"].run = MagicMock(return_value={
        "contacts": [
            {"first_name": "Sarah", "last_name": "Chief", "email": "sarah@novatech.io", "title": "CTO"}
        ]
    })
    
    orchestrator.agents["candidate_sourcing"].run = MagicMock(return_value={
        "candidates": [
            {"first_name": "John", "last_name": "Dev", "email": "john.dev@talent.com", "score": 92}
        ]
    })
    
    # OutreachAgent.run is async!
    orchestrator.agents["outreach"].run = AsyncMock(return_value={
        "tracking_id": str(uuid4()),
        "sent": False,
        "subject": "Quick Question",
        "body": "Test Draft"
    })

    # Mock Redis signaler to capture calls instead of sending to real Redis
    orchestrator._emit_signal = AsyncMock()

    # 2. Execute the Pipeline
    print("\n🚀 Launching Autonomous Truth Cycle...")
    results = await orchestrator.run_full_pipeline(
        industry="AI",
        location="London",
        target_companies=1
    )

    # 3. Assertions: Pipeline Metrics
    assert "stages" in results
    assert results["stages"]["market_intelligence"]["companies_found"] == 1
    assert results["stages"]["lead_discovery"]["contacts_found"] == 1
    assert results["stages"]["outreach"]["drafts_created"] == 1
    
    # 4. Assertions: Redis Signaling
    # Should have emitted: start, stages, and complete signals
    assert orchestrator._emit_signal.call_count >= 5
    last_signal_msg = orchestrator._emit_signal.call_args_list[-1][0][1]
    assert "successfully finished" in last_signal_msg

    # 5. Assertions: DB Persistence Verification
    from db.models import AsyncSessionLocal
    from sqlalchemy import select
    
    async with AsyncSessionLocal() as session:
        # Check Company
        stmt = select(Company).where(Company.domain == "novatech.io")
        res = await session.execute(stmt)
        company = res.scalar_one_or_none()
        assert company is not None
        assert company.name == "Nova Tech"
        assert company.score == 85
        
        # Check Lead (Linked to Company)
        stmt = select(Lead).where(Lead.email == "sarah@novatech.io")
        res = await session.execute(stmt)
        lead = res.scalar_one_or_none()
        assert lead is not None
        assert lead.company_id == company.id
        
        # Check Candidate
        stmt = select(Candidate).where(Candidate.email == "john.dev@talent.com")
        res = await session.execute(stmt)
        candidate = res.scalar_one_or_none()
        assert candidate is not None
        assert candidate.score == 92

    print("✅ System Pulse Verification Successful: Data & Signals Synchronized.")

if __name__ == "__main__":
    asyncio.run(test_full_autonomous_pulse_logic())
