import json
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field
from pydantic_ai import Agent, RunContext
from backend.agents.pydantic_config import get_pydantic_model, AgentDeps
from backend.agents.tools.mcp_tools import execute_mcp_tool

class CandidateStatusUpdate(BaseModel):
    name: str
    email: str
    ats_stage: str
    status: str
    notes: Optional[str] = None
    
class SyncResult(BaseModel):
    successful_updates: List[CandidateStatusUpdate] = Field(default_factory=list)
    failed_emails: List[str] = Field(default_factory=list)
    summary: str

ats_sync_agent = Agent(
    get_pydantic_model(),
    retries=3,
    deps_type=AgentDeps,
    output_type=SyncResult,
    system_prompt=(
        "You are the ATS Integration Agent for DVT Talent AI. "
        "Your mission is to synchronize candidate records with external ATS systems "
        "(like Greenhouse, Lever, Workday) utilizing universal MCP servers. "
        "When provided with a list of candidate emails, use the 'query_ats_via_mcp' tool "
        "to check their status, stage, or add notes."
    )
)

@ats_sync_agent.tool
async def query_ats_via_mcp(ctx: RunContext[AgentDeps], target_ats: str, tool_name: str, tool_args: Dict[str, Any]) -> str:
    """
    Query the connected ATS system using an MCP standard tool.
    Args:
        target_ats: The name of the ATS (e.g. 'greenhouse')
        tool_name: e.g., 'get_candidate', 'list_candidates', 'update_stage'.
        tool_args: A dictionary of parameters (e.g., {'email': 'john@doe.com'})
    """
    # In a real enterprise system, we would query the DB for the tenant's MCP credentials:
    # mcp_config = await get_mcp_config_for_tenant(ctx.deps.tenant_id, target_ats)
    
    # For now, we route dynamically based on 'target_ats':
    if target_ats.lower() == "greenhouse":
        server_command = "npx"
        server_args = ["-y", "@modelcontextprotocol/server-greenhouse"]
        server_env = {"GREENHOUSE_API_KEY": "demo_key"}
    else:
        return f"ERROR: Unknown or unsupported ATS target: {target_ats}"
    
    return await execute_mcp_tool(
        server_command=server_command,
        server_args=server_args,
        server_env=server_env,
        tool_name=tool_name,
        tool_args=tool_args
    )
