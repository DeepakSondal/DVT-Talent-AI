"""
DVT Talent AI — Companies API
CRUD + AI enrichment endpoints
"""
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel, HttpUrl
from datetime import datetime

from db.models import Company, get_db
from api.routes.auth import get_current_user, User

router = APIRouter()


class CompanyCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    website: Optional[str] = None
    linkedin_url: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    domain: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    size: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    hiring_signals: Optional[List[dict]] = None
    score: Optional[float] = None


class CompanyOut(BaseModel):
    id: UUID
    name: str
    domain: Optional[str]
    website: Optional[str]
    linkedin_url: Optional[str]
    industry: Optional[str]
    size: Optional[str]
    location: Optional[str]
    description: Optional[str]
    tech_stack: Optional[List[str]]
    hiring_signals: Optional[List]
    open_roles_count: int
    score: float
    is_client: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CompanyList(BaseModel):
    items: List[CompanyOut]
    total: int
    page: int
    page_size: int


@router.get("", response_model=CompanyList)
async def list_companies(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    industry: Optional[str] = None,
    min_score: Optional[float] = None,
    is_client: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(Company).where(Company.tenant_id == current_user.tenant_id)
    count_query = select(func.count(Company.id)).where(Company.tenant_id == current_user.tenant_id)

    if search:
        query = query.where(Company.name.ilike(f"%{search}%"))
        count_query = count_query.where(Company.name.ilike(f"%{search}%"))
    if industry:
        query = query.where(Company.industry == industry)
        count_query = count_query.where(Company.industry == industry)
    if min_score is not None:
        query = query.where(Company.score >= min_score)
        count_query = count_query.where(Company.score >= min_score)
    if is_client is not None:
        query = query.where(Company.is_client == is_client)
        count_query = count_query.where(Company.is_client == is_client)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    query = query.order_by(desc(Company.score)).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    companies = result.scalars().all()

    return CompanyList(items=companies, total=total, page=page, page_size=page_size)


@router.post("", response_model=CompanyOut, status_code=201)
async def create_company(
    data: CompanyCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    company = Company(**data.model_dump(exclude_none=True), tenant_id=current_user.tenant_id)
    db.add(company)
    await db.commit()
    await db.refresh(company)

    # Trigger AI enrichment in background
    background_tasks.add_task(enrich_company_background, str(company.id))
    return company


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.tenant_id == current_user.tenant_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    return company


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(
    company_id: UUID,
    data: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.tenant_id == current_user.tenant_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return company


@router.delete("/{company_id}", status_code=204)
async def delete_company(
    company_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.tenant_id == current_user.tenant_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    await db.delete(company)
    await db.commit()


@router.post("/{company_id}/enrich")
async def enrich_company(
    company_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger AI enrichment for a company"""
    result = await db.execute(
        select(Company).where(Company.id == company_id, Company.tenant_id == current_user.tenant_id)
    )
    company = result.scalar_one_or_none()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    background_tasks.add_task(enrich_company_background, str(company_id))
    return {"message": "Enrichment started", "company_id": str(company_id)}


async def enrich_company_background(company_id: str):
    """Background task to AI-enrich company data"""
    try:
        from workers.tasks import run_company_research, safe_dispatch_task
        safe_dispatch_task(run_company_research, company_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue run_company_research task: {e}")
