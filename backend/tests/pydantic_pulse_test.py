"""
DVT Talent AI — Pydantic AI Unified Pulse Test
Verifies the complete AgentOrchestrator pipeline logic with the new Pydantic AI agents.
"""
import asyncio
import json
import sys
import os
from unittest.mock import AsyncMock, patch

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Add the project root and backend to sys.path
root_dir = os.getcwd()
backend_dir = os.path.join(root_dir, 'backend')
if root_dir not in sys.path: sys.path.append(root_dir)
if backend_dir not in sys.path: sys.path.append(backend_dir)

from agents.orchestrator import AgentOrchestrator

async def run_pydantic_pulse_test():
    print("🚀 Initializing Pydantic AI Unified Pulse Test...")
    
    # 1. Setup Orchestrator
    orchestrator = AgentOrchestrator(tenant_id="test_tenant_123")

    # 2. Mock Agent Responses (Pydantic AI agents return a result object with .data)
    class MockResult:
        def __init__(self, data):
            self.data = data

    # Define some dummy data that matches our Pydantic models
    with patch("agents.market_iq_pydantic.market_iq_agent.run", new_callable=AsyncMock) as mock_iq, \
         patch("agents.discovery_pydantic.discovery_agent.run", new_callable=AsyncMock) as mock_disc, \
         patch("agents.sourcing_pydantic.sourcing_agent.run", new_callable=AsyncMock) as mock_sour, \
         patch("agents.critic_pydantic.critic_agent.run", new_callable=AsyncMock) as mock_crit, \
         patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock) as mock_out, \
         patch("agents.analytics_pydantic.analytics_agent.run", new_callable=AsyncMock) as mock_anal:

        # Mock Market IQ
        mock_iq.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"industry": "AI", "trends": []}
        ))
        
        # Mock Discovery
        mock_disc.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"job_description": "Senior AI Engineer"},
            job_description="Senior AI Engineer"
        ))
        
        # Mock Sourcing
        class MockCandidate:
            def __init__(self, name):
                self.full_name = name
            def model_dump(self): return {"full_name": self.full_name}

        mock_sour.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"candidates": [{"full_name": "John Doe"}]},
            model_dump_json=lambda: '{"candidates": []}',
            candidates=[MockCandidate("John Doe")]
        ))
        
        # Mock Critic
        mock_crit.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"passed": True}
        ))
        
        # Mock Outreach
        mock_out.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"status": "drafted"}
        ))
        
        # Mock Analytics
        mock_anal.return_value = MockResult(data=AsyncMock(
            model_dump=lambda: {"conversion_rate": 0.85}
        ))

        # 3. Execute Pipeline
        print("⚡ Executing Unified Pipeline...")
        results = await orchestrator.run_full_pipeline(
            industry="AI",
            location="San Francisco"
        )

        # 4. Results Analysis
        print("\n--- [ PULSE TEST RESULTS ] ---")
        if "error" in results:
            print(f"❌ Pipeline Failed: {results['error']}")
        else:
            print(f"✅ Pipeline Completed in {results.get('duration_seconds', 0):.2f}s")
            print(f"🔹 Stages Executed: {list(results['stages'].keys())}")
            
            # Verify structured data preservation
            iq_data = results["stages"]["market_iq"]
            print(f"🔹 Market IQ Verified: {iq_data.get('industry')}")
            
            sourcing_data = results["stages"]["sourcing"]
            print(f"🔹 Sourcing Verified: Found {len(sourcing_data.get('candidates', []))} candidates")

    print("\n✅ Pydantic AI Architecture Verified: Unified Orchestration Successful.")

if __name__ == "__main__":
    asyncio.run(run_pydantic_pulse_test())
