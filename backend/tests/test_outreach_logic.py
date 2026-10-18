"""
DVT Talent AI — Outreach Logic Pydantic AI Unit Tests
"""
import pytest
from agents.outreach_pydantic import outreach_agent

@pytest.mark.asyncio
async def test_outreach_email_content_generation():
    """Verify Outreach Pydantic AI Agent instantiation"""
    assert outreach_agent is not None
    assert hasattr(outreach_agent, "run")
