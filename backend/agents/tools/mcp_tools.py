import json
import structlog
import os
from typing import Any, Dict
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

log = structlog.get_logger(__name__)

async def execute_mcp_tool(
    server_command: str,
    server_args: list[str],
    server_env: Dict[str, str],
    tool_name: str,
    tool_args: Dict[str, Any]
) -> str:
    """
    Executes a tool on a local or remote MCP server via Stdio.
    This allows agents to interface with any external system that provides an MCP server
    (e.g., Slack, Greenhouse, Workday) without needing custom API wrappers.
    """
    # Merge system env with specific server env so npx/node works
    env = os.environ.copy()
    env.update(server_env)
    
    server_params = StdioServerParameters(
        command=server_command,
        args=server_args,
        env=env
    )
    
    try:
        log.info("mcp_connecting", command=server_command, args=server_args, tool=tool_name)
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                
                # Fetch available tools to verify (optional logging)
                # tools = await session.list_tools()
                # log.debug("mcp_tools_available", tools=[t.name for t in tools])
                
                result = await session.call_tool(tool_name, tool_args)
                return str(result.content)
    except Exception as e:
        log.error("mcp_tool_execution_failed", tool=tool_name, error=str(e))
        return f"MCP Tool Error: {str(e)}"
