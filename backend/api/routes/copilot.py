"""
DVT Talent AI — Copilot Router
API Endpoints supporting the Stateful "Human-in-the-Loop" architecture.
"""
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from db.models import AgentTask, AgentTaskStatus, UserRole, get_db
from api.routes.auth import get_current_user, User
from api.middleware.rate_limit import enforce_endpoint_rate_limit, is_load_test_bypass_allowed
from services.llm_guardrail_service import guardrail_service
from sqlalchemy.ext.asyncio import AsyncSession
from agents.orchestrator import AgentOrchestrator
from workers.tasks import copilot_discovery_task, copilot_sourcing_task, copilot_outreach_task

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/copilot", tags=["copilot"])

# ── Pydantic Schemas ─────────────────────────────────────────────────────────
class DiscoveryRequest(BaseModel):
    industry: str
    location: str
    tenant_id: Optional[str] = None

class SourcingRequest(BaseModel):
    task_id: str
    approved_jd: str
    location: str
    tenant_id: Optional[str] = None

class OutreachRequest(BaseModel):
    task_id: str
    approved_candidates: List[Dict[str, Any]]
    job_context: Dict[str, Any]
    tenant_id: Optional[str] = None
    enable_screening: bool = False


def _require_copilot_access(current_user: User) -> uuid.UUID:
    """Ensure only authenticated workspace recruiters/managers/admins can trigger Copilot workflows."""
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER) or not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Workspace recruiter or administrative permissions required.")
    return current_user.tenant_id

# ── Background Task Wrappers ─────────────────────────────────────────────────
async def execute_discovery_bg(task_id: uuid.UUID, req: DiscoveryRequest, db: AsyncSession):
    orchestrator = AgentOrchestrator()
    try:
        results = await orchestrator.run_discovery_phase(req.industry, req.location)
        
        # Update Task State to AWAITING_INPUT
        task = await db.get(AgentTask, task_id)
        if task:
            task.output_data = results
            task.status = AgentTaskStatus.AWAITING_INPUT
            task.current_checkpoint = "discovery_complete"
            await db.commit()
            log.info("copilot_discovery_complete", task_id=str(task_id))
    except Exception as e:
        task = await db.get(AgentTask, task_id)
        if task:
            task.status = AgentTaskStatus.FAILED
            task.error_message = str(e)
            await db.commit()

async def execute_sourcing_bg(task_id: uuid.UUID, req: SourcingRequest, db: AsyncSession):
    orchestrator = AgentOrchestrator()
    try:
        results = await orchestrator.run_sourcing_phase(req.approved_jd, req.location)
        
        task = await db.get(AgentTask, task_id)
        if task:
            task.output_data = results
            task.status = AgentTaskStatus.AWAITING_INPUT
            task.current_checkpoint = "sourcing_complete"
            await db.commit()
            log.info("copilot_sourcing_complete", task_id=str(task_id))
    except Exception as e:
        task = await db.get(AgentTask, task_id)
        if task:
            task.status = AgentTaskStatus.FAILED
            task.error_message = str(e)
            await db.commit()

async def execute_outreach_bg(task_id: uuid.UUID, req: OutreachRequest, db: AsyncSession):
    orchestrator = AgentOrchestrator()
    try:
        results = await orchestrator.run_outreach_phase(req.approved_candidates, req.job_context)
        
        task = await db.get(AgentTask, task_id)
        if task:
            task.output_data = {"outreach_results": results}
            task.status = AgentTaskStatus.COMPLETED
            task.current_checkpoint = "pipeline_complete"
            await db.commit()
            log.info("copilot_outreach_complete", task_id=str(task_id))
    except Exception as e:
        task = await db.get(AgentTask, task_id)
        if task:
            task.status = AgentTaskStatus.FAILED
            task.error_message = str(e)
            await db.commit()

async def _enforce_copilot_rate_limit(request: Request, current_user: User) -> uuid.UUID:
    tenant_uuid = _require_copilot_access(current_user)
    await enforce_endpoint_rate_limit(
        request,
        scope="copilot_tenant",
        identifier=str(tenant_uuid),
        limit=10,
        window_seconds=60,
        detail="Copilot pipeline rate limit exceeded (max 10 runs per minute per workspace).",
    )
    if not is_load_test_bypass_allowed(request):
        allowed, reason = await guardrail_service.check_rate_limit(tenant_id=str(tenant_uuid), provider="groq")
        if not allowed:
            raise HTTPException(status_code=429, detail=reason or "LLM provider rate limit exceeded.")
    return tenant_uuid

# ── API Routes ───────────────────────────────────────────────────────────────

@router.post("/discovery")
async def start_copilot_discovery(
    req: DiscoveryRequest,
    request: Request,
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phase 1: Generates Market IQ and draft JD, then PAUSES for human review."""
    tenant_uuid = await _enforce_copilot_rate_limit(request, current_user)
    if req.tenant_id and str(req.tenant_id) != str(tenant_uuid):
        raise HTTPException(status_code=403, detail="Cross-tenant task execution is forbidden.")

    task_id = uuid.uuid4()
    new_task = AgentTask(
        id=task_id,
        tenant_id=tenant_uuid,
        user_id=current_user.id,
        agent_name="orchestrator",
        task_type="copilot_pipeline",
        status=AgentTaskStatus.RUNNING,
        pipeline_mode="copilot",
        current_checkpoint="starting_discovery"
    )
    db.add(new_task)
    await db.commit()
    
    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    try:
        copilot_discovery_task.delay(str(task_id), req.industry, req.location, str(tenant_uuid))
    except Exception as e:
        log.warning("copilot_discovery_dispatch_warning", error=str(e))
    return {"status": "accepted", "task_id": str(task_id), "phase": "discovery"}

@router.post("/sourcing")
async def start_copilot_sourcing(
    req: SourcingRequest,
    request: Request,
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phase 2: Takes the MANUALLY EDITED Job Description and sources candidates."""
    tenant_uuid = await _enforce_copilot_rate_limit(request, current_user)
    if req.tenant_id and str(req.tenant_id) != str(tenant_uuid):
        raise HTTPException(status_code=403, detail="Cross-tenant task execution is forbidden.")

    try:
        task_uuid = uuid.UUID(req.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Task ID")
        
    task = await db.get(AgentTask, task_uuid)
    if not task or task.tenant_id != tenant_uuid:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = AgentTaskStatus.RUNNING
    task.current_checkpoint = "starting_sourcing"
    await db.commit()

    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    try:
        copilot_sourcing_task.delay(str(task_uuid), req.approved_jd, req.location, str(tenant_uuid))
    except Exception as e:
        log.warning("copilot_sourcing_dispatch_warning", error=str(e))
    return {"status": "accepted", "task_id": str(task_uuid), "phase": "sourcing"}

@router.post("/outreach")
async def start_copilot_outreach(
    req: OutreachRequest,
    request: Request,
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Phase 3: Takes the MANUALLY CURATED list of candidates and emails them."""
    tenant_uuid = await _enforce_copilot_rate_limit(request, current_user)
    if req.tenant_id and str(req.tenant_id) != str(tenant_uuid):
        raise HTTPException(status_code=403, detail="Cross-tenant task execution is forbidden.")

    try:
        task_uuid = uuid.UUID(req.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Task ID")
        
    task = await db.get(AgentTask, task_uuid)
    if not task or task.tenant_id != tenant_uuid:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = AgentTaskStatus.RUNNING
    task.current_checkpoint = "starting_outreach"
    await db.commit()

    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    try:
        copilot_outreach_task.delay(str(task_uuid), req.approved_candidates, req.job_context, str(tenant_uuid), req.enable_screening)
    except Exception as e:
        log.warning("copilot_outreach_dispatch_warning", error=str(e))
    return {"status": "accepted", "task_id": str(task_uuid), "phase": "outreach"}
