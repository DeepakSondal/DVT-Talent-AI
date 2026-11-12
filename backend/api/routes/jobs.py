"""
DVT Talent AI — Jobs API  (FIXED [H-01]: was 7-line stub)
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import User, get_current_user
from db.models import Company, Job, UserRole, get_db

router = APIRouter()


def _require_jobs_access(current_user: User, write: bool = False) -> None:
    if not current_user.tenant_id or current_user.role == UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Workspace permissions required to access job requisitions.")
    if write and current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter, manager, or admin permissions required to modify jobs.")

class JobCreate(BaseModel):
    company_id: Optional[UUID] = None
    title: str
    description: Optional[str] = None
    requirements: Optional[str] = None
    location: Optional[str] = None
    remote: bool = False
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    skills_required: Optional[List[str]] = []
    experience_years: Optional[int] = None
    job_type: Optional[str] = "full-time"
    source_url: Optional[str] = None

class JobOut(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    title: str
    description: Optional[str]
    location: Optional[str]
    remote: bool
    salary_min: Optional[int]
    salary_max: Optional[int]
    skills_required: Optional[List[str]]
    experience_years: Optional[int]
    job_type: Optional[str]
    source_url: Optional[str]
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("")
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    company_id: Optional[UUID] = None,
    search: Optional[str] = None,
    remote: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_jobs_access(current_user, write=False)
    query = select(Job).where(and_(Job.tenant_id == current_user.tenant_id, Job.is_active.is_(True)))
    count_q = select(func.count(Job.id)).where(and_(Job.tenant_id == current_user.tenant_id, Job.is_active.is_(True)))
    if company_id:
        query = query.where(Job.company_id == company_id)
        count_q = count_q.where(Job.company_id == company_id)
    if search:
        query = query.where(Job.title.ilike(f"%{search}%"))
        count_q = count_q.where(Job.title.ilike(f"%{search}%"))
    if remote is not None:
        query = query.where(Job.remote == remote)
        count_q = count_q.where(Job.remote == remote)
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(desc(Job.created_at)).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return {"items": [JobOut.model_validate(i) for i in items], "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
async def create_job(
    data: JobCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_jobs_access(current_user, write=True)
    if data.company_id:
        comp_res = await db.execute(
            select(Company).where(Company.id == data.company_id, Company.tenant_id == current_user.tenant_id)
        )
        if not comp_res.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Company not found in your workspace")

    job = Job(**data.model_dump(exclude_none=True), tenant_id=current_user.tenant_id)
    db.add(job)
    await db.commit()
    await db.refresh(job)
    # Trigger candidate sourcing in background
    if data.skills_required:
        background_tasks.add_task(
            _source_candidates_bg,
            str(job.id),
            data.skills_required,
            data.location,
            str(current_user.tenant_id),
        )
    return JobOut.model_validate(job)

@router.get("/{job_id}")
async def get_job(job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_jobs_access(current_user, write=False)
    result = await db.execute(select(Job).where(Job.id == job_id, Job.tenant_id == current_user.tenant_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(job)

@router.patch("/{job_id}/deactivate", status_code=200)
async def deactivate_job(job_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    _require_jobs_access(current_user, write=True)
    result = await db.execute(select(Job).where(Job.id == job_id, Job.tenant_id == current_user.tenant_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.is_active = False
    await db.commit()
    return {"message": "Job deactivated"}

async def _source_candidates_bg(job_id: str, skills: list, location: Optional[str], tenant_id: str = "default"):
    try:
        from workers.tasks import safe_dispatch_task, source_candidates_for_job
        safe_dispatch_task(source_candidates_for_job, job_id, skills, location, tenant_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue source_candidates_for_job task: {e}")
