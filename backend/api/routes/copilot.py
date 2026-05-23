"""
DVT Talent AI — Copilot Router
API Endpoints supporting the Stateful "Human-in-the-Loop" architecture.
"""
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from db.models import AgentTask, AgentTaskStatus, get_db
from sqlalchemy.ext.asyncio import AsyncSession
from agents.orchestrator import AgentOrchestrator
from workers.tasks import copilot_discovery_task, copilot_sourcing_task, copilot_outreach_task

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/copilot", tags=["copilot"])

# ── Pydantic Schemas ─────────────────────────────────────────────────────────
class DiscoveryRequest(BaseModel):
    industry: str
    location: str
    tenant_id: str

class SourcingRequest(BaseModel):
    task_id: str
    approved_jd: str
    location: str
    tenant_id: str

class OutreachRequest(BaseModel):
    task_id: str
    approved_candidates: List[Dict[str, Any]]
    job_context: Dict[str, Any]
    tenant_id: str
    enable_screening: bool = False

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

# ── API Routes ───────────────────────────────────────────────────────────────

@router.post("/discovery")
async def start_copilot_discovery(req: DiscoveryRequest, bg_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Phase 1: Generates Market IQ and draft JD, then PAUSES for human review."""
    task_id = uuid.uuid4()
    new_task = AgentTask(
        id=task_id,
        tenant_id=uuid.UUID(req.tenant_id),
        agent_name="orchestrator",
        task_type="copilot_pipeline",
        status=AgentTaskStatus.RUNNING,
        pipeline_mode="copilot",
        current_checkpoint="starting_discovery"
    )
    db.add(new_task)
    await db.commit()
    
    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    copilot_discovery_task.delay(str(task_id), req.industry, req.location, req.tenant_id)
    return {"status": "accepted", "task_id": str(task_id), "phase": "discovery"}

@router.post("/sourcing")
async def start_copilot_sourcing(req: SourcingRequest, bg_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Phase 2: Takes the MANUALLY EDITED Job Description and sources candidates."""
    try:
        task_uuid = uuid.UUID(req.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Task ID")
        
    task = await db.get(AgentTask, task_uuid)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = AgentTaskStatus.RUNNING
    task.current_checkpoint = "starting_sourcing"
    await db.commit()

    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    copilot_sourcing_task.delay(str(task_uuid), req.approved_jd, req.location, req.tenant_id)
    return {"status": "accepted", "task_id": str(task_uuid), "phase": "sourcing"}

@router.post("/outreach")
async def start_copilot_outreach(req: OutreachRequest, bg_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Phase 3: Takes the MANUALLY CURATED list of candidates and emails them."""
    try:
        task_uuid = uuid.UUID(req.task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Task ID")
        
    task = await db.get(AgentTask, task_uuid)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task.status = AgentTaskStatus.RUNNING
    task.current_checkpoint = "starting_outreach"
    await db.commit()

    # [ENTERPRISE FIX] Dispatch to Redis/Celery queue to prevent RAM explosion
    copilot_outreach_task.delay(str(task_uuid), req.approved_candidates, req.job_context, req.tenant_id, req.enable_screening)
    return {"status": "accepted", "task_id": str(task_uuid), "phase": "outreach"}
