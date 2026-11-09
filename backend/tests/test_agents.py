"""
DVT Talent AI — Pydantic AI Agents Unit Tests
"""
import pytest

from agents.outreach_pydantic import outreach_agent
from agents.screening_pydantic import screening_agent
from agents.sourcing_pydantic import sourcing_agent


@pytest.mark.asyncio
async def test_screening_agent_structure():
    """Test Screening Pydantic AI Agent instantiation"""
    assert screening_agent is not None
    assert hasattr(screening_agent, "run")

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
