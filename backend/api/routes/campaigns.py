"""
DVT Talent AI — Email Campaigns API  (FIXED [H-01]: was 7-line stub)
"""
from datetime import datetime
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import EmailCampaign, EmailSent, EmailStatus, get_db
from api.routes.auth import get_current_user, User

router = APIRouter()

class CampaignCreate(BaseModel):
    name: str
    campaign_type: str = "candidate_outreach"   # or "client_outreach"
    target_type: str = "candidate"              # or "contact"
    subject_template: Optional[str] = None
    body_template: Optional[str] = None
    send_days: Optional[List[str]] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    send_time: Optional[str] = "09:00"

class CampaignOut(BaseModel):
    id: UUID
    name: str
    campaign_type: Optional[str]
    target_type: Optional[str]
    subject_template: Optional[str]
    body_template: Optional[str]
    is_active: bool
    total_sent: int
    total_opened: int
    total_replied: int
    created_at: datetime

    class Config:
        from_attributes = True

class EmailSentOut(BaseModel):
    id: UUID
    to_email: str
    subject: str
    status: EmailStatus
    sent_at: Optional[datetime]
    opened_at: Optional[datetime]
    replied_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("")
async def list_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(EmailCampaign).where(EmailCampaign.owner_id == current_user.id)
    count_q = select(func.count(EmailCampaign.id)).where(EmailCampaign.owner_id == current_user.id)
    total = (await db.execute(count_q)).scalar()
    query = query.order_by(desc(EmailCampaign.created_at)).offset((page - 1) * page_size).limit(page_size)
    items = (await db.execute(query)).scalars().all()
    return {"items": [CampaignOut.model_validate(i) for i in items], "total": total, "page": page, "page_size": page_size}

@router.post("", status_code=201)
async def create_campaign(
    data: CampaignCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    campaign = EmailCampaign(**data.model_dump(exclude_none=True), owner_id=current_user.id)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)

@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(
        EmailCampaign.id == campaign_id, EmailCampaign.owner_id == current_user.id
    ))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return CampaignOut.model_validate(campaign)

@router.patch("/{campaign_id}/toggle")
async def toggle_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(EmailCampaign).where(
        EmailCampaign.id == campaign_id, EmailCampaign.owner_id == current_user.id
    ))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    campaign.is_active = not campaign.is_active
    await db.commit()
    return {"is_active": campaign.is_active, "campaign_id": str(campaign_id)}

@router.post("/{campaign_id}/send")
async def send_campaign(
    campaign_id: UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger sending all pending emails for this campaign"""
    result = await db.execute(select(EmailCampaign).where(
        EmailCampaign.id == campaign_id, EmailCampaign.owner_id == current_user.id
    ))
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if not campaign.is_active:
        raise HTTPException(status_code=400, detail="Campaign is paused. Activate it first.")
    background_tasks.add_task(_send_campaign_bg, str(campaign_id))
    return {"message": "Campaign send triggered", "campaign_id": str(campaign_id)}

@router.get("/{campaign_id}/emails")
async def get_campaign_emails(
    campaign_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = select(EmailSent).where(EmailSent.campaign_id == campaign_id)
    if status:
        query = query.where(EmailSent.status == status)
    total = (await db.execute(
        select(func.count(EmailSent.id)).where(EmailSent.campaign_id == campaign_id)
    )).scalar()
    query = query.order_by(desc(EmailSent.created_at)).offset((page - 1) * page_size).limit(page_size)
    emails = (await db.execute(query)).scalars().all()
    return {
        "items": [EmailSentOut.model_validate(e) for e in emails],
        "total": total, "page": page, "page_size": page_size,
    }

async def _send_campaign_bg(campaign_id: str):
    try:
        from workers.tasks import send_campaign_emails, safe_dispatch_task
        safe_dispatch_task(send_campaign_emails, campaign_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue send_campaign_emails task: {e}")
