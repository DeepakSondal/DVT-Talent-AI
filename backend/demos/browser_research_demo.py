"""
DVT Talent AI — Autonomous Browser Research Demo
Demonstrates the 'Elite' capability of agents browsing the live web to find hidden talent.
"""
import asyncio
import httpx
try:
    import logfire
    # Configure Logfire for beautiful console traces
    logfire.configure(send_to_logfire=False)
except (ImportError, TypeError):
    logfire = None
import sys
import os

# Add the project root and backend to sys.path
root_dir = os.getcwd()
backend_dir = os.path.join(root_dir, 'backend')
if root_dir not in sys.path: sys.path.append(root_dir)
if backend_dir not in sys.path: sys.path.append(backend_dir)

from backend.agents.sourcing_pydantic import sourcing_agent
from backend.agents.pydantic_config import AgentDeps

async def run_browser_demo():
    print("🚀 Starting Autonomous Browser Research Demo...")
    print("🎯 Goal: Research 'Andrej Karpathy' to find his latest technical focus and portfolio.")
    
    async with httpx.AsyncClient() as client:
        # 1. Setup dependencies
        deps = AgentDeps(
            http_client=client,
            tenant_id="demo_tenant",
        )
        
        # 2. Execute the Sourcing Agent with a 'Deep Research' prompt
        # The agent will recognize it needs the browser tool to find 'hidden' info.
        try:
            print("🧠 Agent is thinking and launching browser...")
            
            # We use a prompt that specifically triggers the deep_research_on_web tool
            prompt = (
                "Source a detailed profile for 'Andrej Karpathy'. "
                "Since he is a public figure, please use the 'deep_research_on_web' tool "
                "to find his latest technical blog post and his current project focus. "
                "Summarize your findings in the structured candidate format."
            )
            
            result = await sourcing_agent.run(prompt, deps=deps)
            
            # 3. Display Results
            print("\n--- [ RESEARCH RESULTS ] ---")
            for cand in result.output.candidates:
                print(f"👤 Name: {cand.full_name}")
                print(f"🏢 Current Focus: {cand.ai_reasoning.alignment}")
                print(f"📊 Match Score: {cand.match_score}/100")
                print(f"🛡️ Integrity Verdict: {cand.integrity_score.verdict}")
                print(f"🔗 Source: {cand.source_platform}")
            
            print("\n🌍 Market Context from Agent:")
            print(result.output.market_context)

        except Exception as e:
            print(f"❌ Demo Failed: {str(e)}")
            print("\n💡 Tip: Ensure you have run 'playwright install' before running this demo.")

if __name__ == "__main__":
    # Note: This requires valid LLM keys and Playwright installed to run for real.
    asyncio.run(run_browser_demo())
