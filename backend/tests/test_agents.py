"""
DVT Talent AI — Pydantic AI Agents Unit Tests
"""
import pytest
from agents.market_iq_pydantic import market_iq_agent
from agents.sourcing_pydantic import sourcing_agent
from agents.outreach_pydantic import outreach_agent

@pytest.mark.asyncio
async def test_market_intelligence_agent_structure():
    """Test Market Intelligence Pydantic AI Agent instantiation"""
    assert market_iq_agent is not None
    assert hasattr(market_iq_agent, "run")

@pytest.mark.asyncio
async def test_candidate_sourcing_agent_structure():
    """Test Sourcing Pydantic AI Agent instantiation"""
    assert sourcing_agent is not None
    assert hasattr(sourcing_agent, "run")

@pytest.mark.asyncio
async def test_outreach_agent_structure():
    """Test Outreach Pydantic AI Agent instantiation"""
    assert outreach_agent is not None
    assert hasattr(outreach_agent, "run")
