"""
DVT Talent AI — Advanced Pydantic AI Agents Test Suite
"""
import pytest
from agents.discovery_pydantic import discovery_agent
from agents.screening_pydantic import screening_agent
from agents.critic_pydantic import critic_agent

@pytest.mark.asyncio
async def test_job_description_agent_optimization():
    """Test Discovery Pydantic AI Agent instantiation"""
    assert discovery_agent is not None
    assert hasattr(discovery_agent, "run")

@pytest.mark.asyncio
async def test_screening_agent_structure():
    """Test Screening Pydantic AI Agent instantiation"""
    assert screening_agent is not None
    assert hasattr(screening_agent, "run")

@pytest.mark.asyncio
async def test_critic_agent_structure():
    """Test Critic Pydantic AI Agent instantiation"""
    assert critic_agent is not None
    assert hasattr(critic_agent, "run")
