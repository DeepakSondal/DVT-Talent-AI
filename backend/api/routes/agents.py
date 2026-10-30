"""
DVT Talent AI — Agents API
Manual triggers for each autonomous agent
"""
import uuid
import json
import redis.asyncio as redis
from datetime import datetime
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentTask, AgentTaskStatus, UserRole, get_db
from api.routes.auth import get_current_user, User
from api.middleware.rate_limit import enforce_endpoint_rate_limit, is_load_test_bypass_allowed
from services.llm_guardrail_service import guardrail_service

router = APIRouter()


async def _enforce_agent_rate_limit(request: Request, current_user: User) -> uuid.UUID:
    tenant_uuid = _require_agent_access(current_user)
    await enforce_endpoint_rate_limit(
        request,
        scope="agent_trigger_tenant",
        identifier=str(tenant_uuid),
        limit=10,
        window_seconds=60,
        detail="AI agent execution rate limit exceeded (max 10 runs per minute per workspace).",
    )
    if not is_load_test_bypass_allowed(request):
        allowed, reason = await guardrail_service.check_rate_limit(tenant_id=str(tenant_uuid), provider="groq")
        if not allowed:
            raise HTTPException(status_code=429, detail=reason or "LLM provider rate limit exceeded.")
    return tenant_uuid


def _require_agent_access(current_user: User) -> uuid.UUID:
    """Enforce workspace recruiter/manager/admin role and valid tenant scope."""
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER) or not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Workspace recruiter or administrative permissions required.")
    return current_user.tenant_id


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
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Manually trigger an AI agent"""
    tenant_uuid = await _enforce_agent_rate_limit(request, current_user)
    if trigger.agent not in VALID_AGENTS:
        raise HTTPException(status_code=400, detail=f"Unknown agent. Valid: {VALID_AGENTS}")

    from workers.tasks import run_agent_task, safe_dispatch_task
    dispatched = safe_dispatch_task(run_agent_task, trigger.agent, trigger.params, tenant_id=str(tenant_uuid))
    task_id = dispatched.id if dispatched else f"local-{uuid.uuid4().hex[:12]}"

    # Log to DB
    agent_task = AgentTask(
        tenant_id=tenant_uuid,
        agent_name=trigger.agent,
        task_type="manual_trigger",
        status=AgentTaskStatus.PENDING,
        input_data=trigger.params,
        celery_task_id=task_id,
        user_id=current_user.id,
    )
    db.add(agent_task)
    await db.commit()

    return {
        "message": f"Agent '{trigger.agent}' triggered",
        "celery_task_id": task_id,
        "agent_task_id": str(agent_task.id),
    }


@router.post("/trigger-dag")
@router.get("/trigger-dag")
async def trigger_dag(
    request: Request,
    industry: str = "AI",
    location: str = "SF",
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_uuid = await _enforce_agent_rate_limit(request, current_user)
    from agents.orchestrator import AgentOrchestrator
    orchestrator = AgentOrchestrator(tenant_id=str(tenant_uuid))
    if background_tasks:
        background_tasks.add_task(orchestrator.run_full_swarm, industry=industry, location=location)
    return {"status": "initiated", "industry": industry, "location": location}


@router.post("/swarm/run")
async def run_swarm_pipeline(
    config: PipelineTrigger,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_uuid = await _enforce_agent_rate_limit(request, current_user)
    print(f"🚀 [SWARM TRACE] Received initiation request for industry: {config.industry}")
    """Trigger the unified swarm pipeline via native background tasks (No Celery required)"""
    from agents.orchestrator import AgentOrchestrator
    
    orchestrator = AgentOrchestrator(tenant_id=str(tenant_uuid))
    
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
    request: Request,
    mode: str = "copilot",
    params: Dict[str, Any] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger a specific phase of the swarm (discovery, sourcing, outreach)"""
    tenant_uuid = await _enforce_agent_rate_limit(request, current_user)
    if phase not in ["discovery", "sourcing", "outreach"]:
        raise HTTPException(status_code=400, detail="Invalid phase")

    from agents.orchestrator import AgentOrchestrator
    # Pass user/tenant context to the orchestrator for notifications
    orchestrator = AgentOrchestrator(tenant_id=str(tenant_uuid))
    
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
    """List recent agent task executions scoped strictly to the caller's tenant"""
    tenant_uuid = _require_agent_access(current_user)
    from sqlalchemy import select, desc
    result = await db.execute(
        select(AgentTask)
        .where(AgentTask.tenant_id == tenant_uuid)
        .order_by(desc(AgentTask.created_at))
        .limit(min(max(1, limit), 100))
    )
    tasks = result.scalars().all()
    return {
        "tasks": [
            {
                "id": str(t.id),
                "agent_name": t.agent_name,
                "task_type": t.task_type,
                "status": getattr(t.status, "value", str(t.status)),
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
    """Get the status of a specific agent task scoped strictly to the caller's tenant"""
    tenant_uuid = _require_agent_access(current_user)
    task = await db.get(AgentTask, task_id)
    if not task or task.tenant_id != tenant_uuid:
        raise HTTPException(status_code=404, detail="Task not found")

    return {
        "id": str(task.id),
        "agent_name": task.agent_name,
        "task_type": task.task_type,
        "status": getattr(task.status, "value", str(task.status)),
        "pipeline_mode": task.pipeline_mode,
        "current_checkpoint": task.current_checkpoint,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
        "error": task.error_message,
        "output_data": task.output_data,
        "created_at": task.created_at,
    }


class ScreeningGenerateRequest(BaseModel):
    job_description: str
    role_title: Optional[str] = None
    job_id: Optional[str] = None

@router.post("/screening/generate", summary="Generate structured interview screening guide with answers from a JD")
async def generate_screening_questions(
    req: ScreeningGenerateRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_uuid = await _enforce_agent_rate_limit(request, current_user)
    if not req.job_description or not req.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    
    from agents.screening_pydantic import generate_screening_guide
    import httpx
    from agents.pydantic_config import AgentDeps
    
    async with httpx.AsyncClient() as client:
        deps = AgentDeps(http_client=client, tenant_id=str(tenant_uuid))
        plan = await generate_screening_guide(
            job_description=req.job_description,
            role_title=req.role_title,
            tenant_id=str(tenant_uuid),
            deps=deps,
        )
        return plan.model_dump()
