"""
DVT Talent AI — Agents API
Manual triggers for each autonomous agent
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import AgentTask, AgentTaskStatus, get_db
from api.routes.auth import get_current_user, User

router = APIRouter()


class AgentTrigger(BaseModel):
    agent: str
    params: Optional[dict] = {}


class PipelineTrigger(BaseModel):
    industry: str = "technology"
    location: str = "United States"
    send_emails: bool = False


VALID_AGENTS = [
    "market_intelligence",
    "lead_discovery",
    "company_research",
    "candidate_sourcing",
    "resume_analysis",
    "outreach",
    "interview_scheduling",
    "crm_management",
    "analytics",
    "learning",
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


@router.post("/run-full-pipeline")
async def run_full_pipeline(
    config: PipelineTrigger,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger the full autonomous pipeline with custom settings"""
    from workers.tasks import run_full_autonomous_pipeline
    task = run_full_autonomous_pipeline.delay(
        industry=config.industry,
        location=config.location,
        send_emails=config.send_emails
    )
    return {"message": "Full pipeline started", "celery_task_id": task.id}


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
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get Celery task status"""
    from workers.celery_app import celery_app
    result = celery_app.AsyncResult(task_id)
    return {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }
