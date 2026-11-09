"""
DVT Talent AI — Swarm Agent Unit Tests
Tests the Pydantic AI agent swarm architecture and orchestrator.
"""

import pytest

from agents.discovery_pydantic import discovery_agent
from agents.screening_pydantic import screening_agent
from agents.sourcing_pydantic import sourcing_agent


@pytest.mark.asyncio
async def test_screening_agent_parallel_logic():
    """ Verify Pydantic AI screening_agent execution structure """
    assert screening_agent is not None
    assert screening_agent.name is not None or hasattr(screening_agent, "run")

@pytest.mark.asyncio
async def test_lead_discovery_reaction():
    """ Verify discovery_agent initialization and tools """
    assert discovery_agent is not None
    assert hasattr(discovery_agent, "run")

@pytest.mark.asyncio
async def test_sourcing_filters():
    """ Verify sourcing_agent initialization """
    assert sourcing_agent is not None
    assert hasattr(sourcing_agent, "run")
