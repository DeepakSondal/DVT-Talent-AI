"""
DVT Talent AI — Leads API  (FIXED [H-01]: was 7-line stub)
Full CRUD + pipeline management
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Lead, LeadStatus, Activity, get_db
from api.routes.auth import get_current_user, User

router = APIRouter()


class LeadCreate(BaseModel):
    company_id: UUID
    contact_id: Optional[UUID] = None
    source: Optional[str] = "manual"
    notes: Optional[str] = None
    value_estimate: Optional[float] = None


class LeadUpdate(BaseModel):
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    next_action: Optional[str] = None
    next_action_date: Optional[datetime] = None
    value_estimate: Optional[float] = None
    score: Optional[float] = None


class LeadOut(BaseModel):
    id: UUID
    company_id: Optional[UUID]
    contact_id: Optional[UUID]
    status: LeadStatus
    source: Optional[str]
    score: float
    notes: Optional[str]
    next_action: Optional[str]
    next_action_date: Optional[datetime]
    value_estimate: Optional[float]
    created_at: datetime
    updated_at: datetime
    # Flattened company fields for frontend convenience
    company_name: Optional[str] = None
    domain: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("")
async def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    query = select(Lead).options(selectinload(Lead.company)).where(
        Lead.owner_id == current_user.id,
        Lead.tenant_id == current_user.tenant_id
    )
    count_q = select(func.count(Lead.id)).where(
        Lead.owner_id == current_user.id,
        Lead.tenant_id == current_user.tenant_id
    )
    if status:
        query = query.where(Lead.status == status)
        count_q = count_q.where(Lead.status == status)
    if search:
        search_filter = f"%{search}%"
        # Search in company name or notes
        from db.models import Company
        query = query.join(Lead.company).where(
            (Company.name.ilike(search_filter)) | (Lead.notes.ilike(search_filter))
        )
        count_q = count_q.join(Lead.company).where(
            (Company.name.ilike(search_filter)) | (Lead.notes.ilike(search_filter))
        )
    total = (await db.execute(count_q)).scalar() or 0
    query = query.order_by(desc(Lead.score)).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    
    # Manually populate flattened fields
    out_items = []
    for i in items:
        out = LeadOut.model_validate(i)
        if i.company:
            out.company_name = i.company.name
            out.domain = i.company.domain
        out_items.append(out)

    return {"items": out_items, "total": total, "page": page, "page_size": page_size}


@router.post("", status_code=201)
async def create_lead(data: LeadCreate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    lead = Lead(**data.model_dump(exclude_none=True), owner_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.get("/pipeline")
async def get_pipeline_leads(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all leads grouped by status for the Kanban board"""
    from sqlalchemy.orm import selectinload
    query = select(Lead).options(selectinload(Lead.company)).where(Lead.owner_id == current_user.id)
    result = await db.execute(query)
    leads = result.scalars().all()
    
    # Grouping logic
    pipeline = {status: [] for status in LeadStatus}
    for lead in leads:
        out = LeadOut.model_validate(lead)
        if lead.company:
            out.company_name = lead.company.name
            out.domain = lead.company.domain
        pipeline[lead.status].append(out)
        
    return pipeline


@router.get("/{lead_id}")
async def get_lead(lead_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(Lead).options(selectinload(Lead.company))
        .where(Lead.id == lead_id, Lead.owner_id == current_user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    out = LeadOut.model_validate(lead)
    if lead.company:
        out.company_name = lead.company.name
        out.domain = lead.company.domain
    return out


@router.patch("/{lead_id}")
async def update_lead(lead_id: UUID, data: LeadUpdate, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.owner_id == current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    old_status = lead.status
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(lead, field, value)
    if data.status and data.status != old_status:
        db.add(Activity(lead_id=lead_id, user_id=current_user.id, activity_type="status_change", description=f"Status: {old_status} → {data.status}"))
    await db.commit()
    await db.refresh(lead)
    return LeadOut.model_validate(lead)


@router.delete("/{lead_id}", status_code=204)
async def delete_lead(lead_id: UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    result = await db.execute(select(Lead).where(Lead.id == lead_id, Lead.owner_id == current_user.id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    await db.delete(lead)
    await db.commit()
