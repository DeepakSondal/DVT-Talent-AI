"""
DVT Talent AI — Agents API
Manual triggers for each autonomous agent
"""
import uuid
import json
import redis.asyncio as redis
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentTask, AgentTaskStatus, get_db
from api.routes.auth import get_current_user, User

router = APIRouter()


class SwarmTriggerSchema(BaseModel):
    industry: str
    location: str
    sectors: Optional[List[str]] = None


class AgentTrigger(BaseModel):
    agent: str
    params: Dict[str, Any]


class PipelineTrigger(BaseModel):
    industry: str = "technology"
    location: str = "United States"
    send_emails: bool = False
    mock_mode: bool = False


VALID_AGENTS = [
    "discovery",
    "sourcing",
    "outreach",
    "analytics",
    "screening",
]


@router.post("/trigger")
async def trigger_agent(
    trigger: AgentTrigger,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger an AI agent"""
    if trigger.agent not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"Unknown agent. Valid: {VALID_AGENTS}")

    from workers.tasks import run_agent_task
    task = run_agent_task.delay(trigger.agent, trigger.params)

    # Log to DB
    agent_task = AgentTask(
        agent_name=trigger.agent,
        task_type="manual_trigger",
        status=AgentTaskStatus.PENDING,
        input_data=trigger.params,
        celery_task_id=task.id,
        user_id=current_user.id,
    )
    db.add(agent_task)
    await db.commit()

    return {
        "message": f"Agent '{trigger.agent}' triggered",
        "celery_task_id": task.id,
        "agent_task_id": str(agent_task.id),
    }


@router.get("/trigger-dag")
async def trigger_dag(
    industry: str = "AI",
    location: str = "SF",
    background_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
):
    from backend.agents.orchestrator import AgentOrchestrator
    orchestrator = AgentOrchestrator()
    if background_tasks:
        background_tasks.add_task(orchestrator.run_full_swarm, industry=industry, location=location)
    return {"status": "initiated", "industry": industry, "location": location}


@router.post("/swarm/run")
async def run_swarm_pipeline(
    config: PipelineTrigger,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    print(f"🚀 [SWARM TRACE] Received initiation request for industry: {config.industry}")
    """Trigger the unified swarm pipeline via native background tasks (No Celery required)"""
    from backend.agents.orchestrator import AgentOrchestrator
    
    orchestrator = AgentOrchestrator(tenant_id=str(current_user.tenant_id))
    
    # Fire and forget via native background task
    background_tasks.add_task(
        orchestrator.run_full_swarm,
        industry=config.industry,
        location=config.location,
        mock_mode=config.mock_mode
    )
    
    return {
        "message": "Unified swarm protocol initiated", 
        "status": "active",
        "mock": config.mock_mode
    }


@router.post("/swarm/phase")
async def run_swarm_phase(
    phase: str,
    mode: str = "copilot",
    params: Dict[str, Any] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a specific phase of the swarm (discovery, sourcing, outreach)"""
    if phase not in ["discovery", "sourcing", "outreach"]:
        raise HTTPException(status_code=400, detail="Invalid phase")

    from backend.agents.orchestrator import AgentOrchestrator
    # Pass user/tenant context to the orchestrator for notifications
    orchestrator = AgentOrchestrator(tenant_id=str(current_user.tenant_id))
    
    # Run the phase async
    # In a real production env, this would be a Celery task, 
    # but for HITL Copilot, we run it as a background task to allow immediate UI response.
    import asyncio
    task = asyncio.create_task(orchestrator.run_swarm_phase(phase, mode=mode, **(params or {})))
    
    return {
        "status": "initiated",
        "phase": phase,
        "mode": mode,
        "message": f"Swarm {phase} sequence started in {mode} mode."
    }


@router.get("/tasks")
async def list_agent_tasks(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List recent agent task executions"""
    from sqlalchemy import select, desc
    result = await db.execute(
        select(AgentTask).order_by(desc(AgentTask.created_at)).limit(limit)
    )
    tasks = result.scalars().all()
    return {
        "tasks": [
            {
                "id": str(t.id),
                "agent_name": t.agent_name,
                "task_type": t.task_type,
                "status": t.status.value,
                "started_at": t.started_at,
                "completed_at": t.completed_at,
                "error": t.error_message,
                "created_at": t.created_at,
            }
            for t in tasks
        ]
    }


@router.get("/status/{task_id}")
async def get_task_status(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get the status of a specific agent task"""
    task = await db.get(AgentTask, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "id": str(task.id),
        "agent_name": task.agent_name,
        "task_type": task.task_type,
        "status": task.status.value,
        "pipeline_mode": task.pipeline_mode,
        "current_checkpoint": task.current_checkpoint,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "error": task.error_message,
        "output_data": task.output_data,
        "created_at": task.created_at,
    }
