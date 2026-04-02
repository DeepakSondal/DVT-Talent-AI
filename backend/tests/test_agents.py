import pytest
from unittest.mock import MagicMock, patch
from uuid import uuid4
from datetime import datetime

from agents.market_intelligence_agent import MarketIntelligenceAgent
from agents.candidate_sourcing_agent import CandidateSourcingAgent
from agents.outreach_agent import OutreachAgent

@pytest.mark.asyncio
async def test_market_intelligence_agent_mock():
    """Test Market Intelligence Agent with mocked LLM response"""
    agent = MarketIntelligenceAgent()
    
    mock_response = {
        "companies": [
            {"name": "TestAI", "domain": "testai.com", "hiring_signals": ["Series B", "High growth"]}
        ]
    }
    
    with patch.object(agent, 'chat', return_value='{"companies": [{"name": "TestAI", "domain": "testai.com", "hiring_signals": ["Series B", "High growth"]}]}'):
        result = agent.run(industry="AI", location="Global")
        assert len(result["companies"]) == 1
        assert result["companies"][0]["name"] == "TestAI"

@pytest.mark.asyncio
async def test_candidate_sourcing_agent_mock():
    """Test Candidate Sourcing Agent with mocked LLM response"""
    agent = CandidateSourcingAgent()
    
    with patch.object(agent, 'chat', return_value='{"candidates": [{"first_name": "John", "last_name": "Doe", "email": "john@example.com", "score": 95}]}'):
        result = agent.run(job_title="Engineer", skills=["Python"])
        assert len(result["candidates"]) == 1
        assert result["candidates"][0]["first_name"] == "John"
        assert result["candidates"][0]["score"] == 95

@pytest.mark.asyncio
async def test_outreach_agent_db_persistence(db_session):
    """
    Test Outreach Agent specifically for the DB persistence logic added in Phase 6.
    Verify that it correctly creates campaigns and email_sent records.
    """
    agent = OutreachAgent()
    recipient = {"first_name": "Alice", "email": "alice@test.com"}
    context = {"company": {"name": "TestCorp"}}
    
    # Mock LLM and Gmail send
    with patch.object(agent, 'chat', return_value='{"subject": "Hello", "body": "Test body", "preview": "Hello..."}'):
        with patch.object(agent, '_send_via_gmail', return_value={"success": True, "message_id": "msg_123"}):
            # We must use settings.database_sync_url which points to our test memory DB for this test if possible, 
            # but since the agent imports settings internally, we'll patch settings.database_sync_url
            with patch('agents.outreach_agent.settings') as mock_settings:
                from conftest import TEST_DATABASE_URL
                mock_settings.database_sync_url = TEST_DATABASE_URL
                mock_settings.gmail_sender_email = "bot@dvttalent.com"
                
                result = agent.run(outreach_type="candidate", recipient=recipient, context=context, send_email=True)
                
                assert result["sent"] is True
                assert "tracking_id" in result
                
                # Now verify DB persistence directly
                from sqlalchemy import text
                from conftest import TEST_DATABASE_URL
                from sqlalchemy import create_engine
                
                # Check EmailSent record
                engine = create_engine(TEST_DATABASE_URL)
                with engine.connect() as conn:
                    row = conn.execute(
                        text("SELECT to_email, status FROM email_sent WHERE id = :id"),
                        {"id": result["tracking_id"]}
                    ).fetchone()
                    assert row is not None
                    assert row[0] == "alice@test.com"
                    assert row[1] == "sent"
                    
                    # Check Campaign record
                    camp = conn.execute(
                        text("SELECT name FROM email_campaigns LIMIT 1")
                    ).fetchone()
                    assert camp is not None
                    assert "General Candidate Outreach" in camp[0]
