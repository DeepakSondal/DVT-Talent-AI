"""
DVT Talent AI — MCP + Pydantic AI Integration Example
Shows how to use an external MCP Server to fetch ATS data (e.g., Greenhouse).
"""
from typing import List
from pydantic import BaseModel
from pydantic_ai import Agent, RunContext
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# 1. Define the Structured Result
class CandidateStatus(BaseModel):
    name: str
    ats_stage: str
    last_interview_score: int
    recommendation: str

# 2. Define the Agent with MCP Context
agent = Agent(
    'openai:gpt-4o',
    output_type=CandidateStatus,
    system_prompt="You are an ATS Intelligence Agent. Use the Greenhouse MCP server to check candidate status."
)

# 3. Define the MCP Tool Wrapper
@agent.tool
async def check_ats_status(ctx: RunContext[None], candidate_email: str) -> str:
    """
    Connects to an external Greenhouse MCP Server to fetch real-time 
    candidate status from the company's ATS.
    """
    # [CONCEPTUAL] In a real setup, this points to your MCP server executable
    server_params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-greenhouse"],
        env={"GREENHOUSE_API_KEY": "your_key_here"}
    )

    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Call the standardized MCP tool 'get_candidate'
            # The agent doesn't need to know the Greenhouse API schema!
            result = await session.call_tool("get_candidate", {"email": candidate_email})
            return str(result.content)

# 4. Usage Example
async def main():
    # The agent will:
    # 1. Realize it needs ATS data.
    # 2. Call 'check_ats_status' (the MCP Wrapper).
    # 3. The MCP Wrapper spins up the standardized Greenhouse server.
    # 4. The server returns normalized data.
    # 5. The agent converts that into your structured 'CandidateStatus' model.
    result = await agent.run("What is the status of john.doe@example.com in our Greenhouse?")
    print(result.output)
