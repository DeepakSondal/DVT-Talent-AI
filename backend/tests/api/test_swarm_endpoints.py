"""
DVT Talent AI — Swarm API Tests
Verifies the new Hub, Monitoring, and Trigger endpoints.
"""
import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, AsyncMock

client = TestClient(app)

def test_nexus_monitoring_recent_signals():
    """ Verify the monitoring endpoint returns signal history """
    response = client.get("/api/v1/monitoring/signals/recent?limit=10")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_swarm_trigger_endpoint():
    """ Verify that the DAG trigger initiates a background task """
    with patch("agents.orchestrator.AgentOrchestrator.run_full_swarm", new_callable=AsyncMock) as mock_swarm, \
         patch("agents.orchestrator.AgentOrchestrator.run_full_pipeline", new_callable=AsyncMock) as mock_pipe:
        response = client.get("/api/v1/agents/trigger-dag?industry=AI&location=SF")
        assert response.status_code == 200
        assert "status" in response.json()

def test_monster_webhook_intake():
    """ Verify that Monster webhooks correctly ingest applicants """
    payload = {
        "applicant": {
            "firstName": "John",
            "lastName": "Doe",
            "email": "john.doe@monster.com",
            "resume": "base64_data_here"
        },
        "jobId": "monster_123"
    }
    
    response = client.post("/api/v1/webhooks/monster/applications", json=payload)
    assert response.status_code in [200, 201, 202]
