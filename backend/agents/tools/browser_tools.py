"""
DVT Talent AI — Autonomous Browser Tools
Uses Browser-Use + Playwright to perform deep candidate research and market analysis.
"""
try:
    from browser_use import Agent as BrowserAgent
except ImportError:
    BrowserAgent = None

from pydantic import BaseModel
from typing import Optional
from agents.pydantic_config import get_pydantic_model

class BrowserSearchQuery(BaseModel):
    goal: str
    target_url: Optional[str] = None

class DeepSearchTool:
    """
    A wrapper for Browser-Use to allow Pydantic AI agents to 
    'see' and 'interact' with the web.
    """
    
    def __init__(self):
        pass

    async def execute_goal(self, goal: str) -> str:
        """
        Executes a browsing goal (e.g. 'Find the CTO of Stripe on LinkedIn')
        and returns the summarized findings.
        """
        if BrowserAgent is None:
            return f"Autonomous browser tool unavailable (browser_use package not installed). Goal skipped: {goal}"

        try:
            model = get_pydantic_model()
            agent = BrowserAgent(
                task=goal,
                llm=model,
            )
            result = await agent.run()
            return str(result)
        except Exception as e:
            return f"Browsing failed: {str(e)}"

# Singleton instance
browser_tool = DeepSearchTool()
