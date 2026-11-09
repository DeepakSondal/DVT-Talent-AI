"""
DVT Talent AI — Agents API
Manual triggers for each autonomous agent
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limit import enforce_endpoint_rate_limit, is_load_test_bypass_allowed
from api.routes.auth import User, get_current_user
from db.models import AgentTask, AgentTaskStatus, UserRole, get_db
from services.llm_guardrail_service import guardrail_service

router = APIRouter()
_BACKGROUND_SWARM_TASKS: set[Any] = set()


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


class FastSourcingRequest(BaseModel):
    query: str
    location: Optional[str] = "Remote"
    limit: int = 5


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
    from db.models import AsyncSessionLocal

    agent_task = AgentTask(
        tenant_id=tenant_uuid,
        agent_name="swarm",
        task_type="full_pipeline",
        status=AgentTaskStatus.RUNNING,
        input_data=config.model_dump(),
        started_at=datetime.now(timezone.utc),
        user_id=current_user.id,
    )
    db.add(agent_task)
    await db.commit()
    await db.refresh(agent_task)
    task_id = agent_task.id

    async def _run_and_persist():
        orchestrator = AgentOrchestrator(tenant_id=str(tenant_uuid))
        res = await orchestrator.run_full_swarm(
            industry=config.industry,
            location=config.location,
            mock_mode=config.mock_mode,
        )
        async with AsyncSessionLocal() as session:
            t_row = await session.get(AgentTask, task_id)
            if t_row:
                t_row.output_data = res
                t_row.completed_at = datetime.now(timezone.utc)
                if res.get("error"):
                    t_row.status = AgentTaskStatus.FAILED
                    t_row.error_message = str(res["error"])
                else:
                    t_row.status = AgentTaskStatus.COMPLETED
                await session.commit()

    from workers.tasks import (
        is_celery_broker_available,
        run_full_autonomous_pipeline,
        safe_dispatch_task,
    )

    if is_celery_broker_available():
        dispatched = safe_dispatch_task(
            run_full_autonomous_pipeline,
            industry=config.industry,
            location=config.location,
            send_emails=config.send_emails,
            mock_mode=config.mock_mode,
            tenant_id=str(tenant_uuid),
        )
        if dispatched:
            agent_task.celery_task_id = dispatched.id
            await db.commit()
            return {
                "message": "Unified swarm protocol queued via Celery",
                "status": "active",
                "task_id": str(task_id),
                "celery_task_id": dispatched.id,
                "mock": config.mock_mode,
            }

    background_tasks.add_task(_run_and_persist)

    return {
        "message": "Unified swarm protocol initiated",
        "status": "active",
        "task_id": str(task_id),
        "mock": config.mock_mode,
    }


@router.post("/sourcing/fast")
async def fast_sourcing(
    req: FastSourcingRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """Sub-second hybrid vector + multi-keyword candidate sourcing scoped strictly to caller's tenant."""
    tenant_uuid = _require_agent_access(current_user)
    from agents.sourcing_pydantic import fast_hybrid_candidate_search
    candidates = await fast_hybrid_candidate_search(
        tenant_id=str(tenant_uuid),
        keywords=f"{req.query} {req.location or ''}".strip(),
        limit=min(max(1, req.limit), 25),
    )
    return {
        "status": "completed",
        "candidates": candidates,
        "count": len(candidates),
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
    orchestrator = AgentOrchestrator(tenant_id=str(tenant_uuid))
    
    import asyncio
    task = asyncio.create_task(orchestrator.run_swarm_phase(phase, mode=mode, **(params or {})))
    _BACKGROUND_SWARM_TASKS.add(task)
    task.add_done_callback(_BACKGROUND_SWARM_TASKS.discard)

    fast_candidates: List[Dict[str, Any]] = []
    if phase == "sourcing":
        from agents.sourcing_pydantic import fast_hybrid_candidate_search
        query_str = (params or {}).get("job_description") or ""
        fast_candidates = await fast_hybrid_candidate_search(str(tenant_uuid), query_str, limit=5)
    
    return {
        "status": "initiated",
        "phase": phase,
        "mode": mode,
        "candidates": fast_candidates,
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
    from sqlalchemy import desc, select
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
    
    import httpx

    from agents.pydantic_config import AgentDeps
    from agents.screening_pydantic import generate_screening_guide
    
    async with httpx.AsyncClient() as client:
        deps = AgentDeps(http_client=client, tenant_id=str(tenant_uuid))
        plan = await generate_screening_guide(
            job_description=req.job_description,
            role_title=req.role_title,
            tenant_id=str(tenant_uuid),
            deps=deps,
        )
        return plan.model_dump()
