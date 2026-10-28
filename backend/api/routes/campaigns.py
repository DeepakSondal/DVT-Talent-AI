"""
DVT Talent AI — Email Campaigns API  (FIXED [H-01]: was 7-line stub)
"""
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from uuid import UUID
import uuid as uuid_pkg
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from pydantic import BaseModel
from sqlalchemy import select, func, desc, or_
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import (
    EmailCampaign, EmailSent, EmailStatus, UserRole,
    Candidate, CandidateStatus, Job, JobCandidate, Tenant, get_db
)
from api.routes.auth import get_current_user, User
from api.middleware.rate_limit import get_real_client_ip, enforce_endpoint_rate_limit
from services.redis_service import record_rate_limit

router = APIRouter()


def _require_campaign_access(current_user: User, write: bool = False) -> None:
    if not current_user.tenant_id or current_user.role == UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Workspace permissions required to access campaigns.")
    if write and current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter, manager, or admin permissions required to modify campaigns.")

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


class MicrositeOut(BaseModel):
    id: str
    candidate_name: str
    headline: str
    title: str
    value_proposition: str
    why_now: str
    company_name: str
    recruiter_name: str
    recruiter_email: Optional[str] = None
    job_id: Optional[str] = None
    status: str = "sent"


class ScheduleCallRequest(BaseModel):
    preferred_time: Optional[str] = None
    notes: Optional[str] = None
    candidate_email: Optional[str] = None

@router.get("")
async def list_campaigns(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_campaign_access(current_user, write=False)
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
    _require_campaign_access(current_user, write=True)
    campaign = EmailCampaign(**data.model_dump(exclude_none=True), owner_id=current_user.id)
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return CampaignOut.model_validate(campaign)


async def _find_email_sent(tracking_id: str, db: AsyncSession) -> Optional[EmailSent]:
    stmt = select(EmailSent).where(EmailSent.tracking_id == tracking_id)
    res = await db.execute(stmt)
    email = res.scalar_one_or_none()
    if email:
        return email

    try:
        as_uuid = uuid_pkg.UUID(tracking_id)
        stmt_uuid = select(EmailSent).where(EmailSent.id == as_uuid)
        res_uuid = await db.execute(stmt_uuid)
        return res_uuid.scalar_one_or_none()
    except (ValueError, TypeError):
        return None


@router.get("/microsite/{tracking_id}", response_model=MicrositeOut)
async def get_candidate_microsite(
    tracking_id: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for candidates to view personalized outreach microsites.
    Marks email as opened, tracks clicks, and enriches candidate pitch.
    """
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="microsite_view_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Too many microsite requests. Please wait a minute.",
    )
    email_sent = await _find_email_sent(tracking_id, db)
    if not email_sent:
        # Support demo / showcase IDs for testing and UI demonstration
        if tracking_id in ("demo", "cand_src_01", "mock_1", "showcase", "spacex") or tracking_id.startswith(("cand_src_", "mock_")):
            return MicrositeOut(
                id=tracking_id,
                candidate_name="Elena Rostova",
                headline="Why you're a standout match for the Distributed Systems Lead role",
                title="Exclusive Opportunity: Scaling Core High-Throughput Infrastructure",
                value_proposition="Your deep experience with Go, Kubernetes, and eBPF telemetry pipelines is exactly aligned with the low-latency challenges our engineering team is solving this quarter.",
                why_now="Following our recent Series B expansion, we are scaling the backend systems team and seeking foundational technical leads.",
                company_name="CloudScale Technologies",
                recruiter_name="Alex Sterling",
                recruiter_email="alex.sterling@cloudscale.tech",
                job_id=None,
                status="opened",
            )
        raise HTTPException(status_code=404, detail="Personalized opportunity microsite not found or link has expired.")

    # Record open telemetry & click tracking (debounced per tracking_id + IP to prevent write amplification)
    hit_allowed, _ = await record_rate_limit(f"rl:microsite_hit:{tracking_id}:{client_ip}", limit=1, window_seconds=60)
    if hit_allowed:
        email_sent.clicks_count = (email_sent.clicks_count or 0) + 1
        if email_sent.status in (EmailStatus.SENT, EmailStatus.SCHEDULED, EmailStatus.DRAFT):
            email_sent.status = EmailStatus.OPENED
        if not email_sent.opened_at:
            email_sent.opened_at = datetime.now(timezone.utc)

        # Increment campaign counters if linked
        if email_sent.campaign_id:
            camp_res = await db.execute(select(EmailCampaign).where(EmailCampaign.id == email_sent.campaign_id))
            camp = camp_res.scalar_one_or_none()
            if camp:
                camp.total_opened = (camp.total_opened or 0) + 1

    # Enrich metadata from Candidate and Recruiter
    cand_name = "Candidate"
    cand_skills = []
    cand_title = None
    if email_sent.candidate_id:
        c_res = await db.execute(select(Candidate).where(Candidate.id == email_sent.candidate_id))
        cand = c_res.scalar_one_or_none()
        if cand:
            cand_name = f"{cand.first_name} {cand.last_name}".strip()
            cand_skills = cand.skills or []
            cand_title = cand.title

    recruiter_name = "Talent Partner"
    recruiter_email = None
    if email_sent.recruiter_id:
        u_res = await db.execute(select(User).where(User.id == email_sent.recruiter_id))
        recruiter = u_res.scalar_one_or_none()
        if recruiter:
            recruiter_name = recruiter.full_name
            recruiter_email = recruiter.email

    company_name = "DVT Talent Partner"
    if email_sent.tenant_id:
        t_res = await db.execute(select(Tenant).where(Tenant.id == email_sent.tenant_id))
        tenant = t_res.scalar_one_or_none()
        if tenant:
            company_name = tenant.name

    meta = email_sent.meta_data or {}
    job_id = meta.get("job_id") or (str(meta.get("job_id")) if "job_id" in meta else None)
    job_title = meta.get("job_title") or cand_title or "Key Technical Role"

    skills_str = ", ".join(cand_skills[:4]) if cand_skills else "distributed systems and engineering"
    val_prop = meta.get("value_proposition") or email_sent.body or (
        f"Your verified experience in {skills_str} directly matches the architecture and scale requirements for our open {job_title} role."
    )
    why_now = meta.get("why_now") or "We're expanding the team this quarter and seeking high-impact engineers to take ownership of core services."

    await db.commit()

    return MicrositeOut(
        id=str(email_sent.tracking_id or email_sent.id),
        candidate_name=cand_name,
        headline=meta.get("headline") or f"Why you're a great fit for the {job_title} role at {company_name}",
        title=meta.get("title") or f"High-Impact Opportunity: {job_title}",
        value_proposition=val_prop,
        why_now=why_now,
        company_name=company_name,
        recruiter_name=recruiter_name,
        recruiter_email=recruiter_email,
        job_id=job_id,
        status=email_sent.status.value if hasattr(email_sent.status, "value") else str(email_sent.status),
    )


@router.post("/microsite/{tracking_id}/schedule")
async def schedule_microsite_call(
    tracking_id: str,
    request: Request,
    data: Optional[ScheduleCallRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Public endpoint for candidates to request an intro call from their microsite.
    Transitions email status to REPLIED and candidate status to INTERESTED.
    """
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="microsite_schedule_ip",
        identifier=client_ip,
        limit=5,
        window_seconds=300,
        detail="Too many call schedule requests from this IP. Please wait 5 minutes.",
    )
    await enforce_endpoint_rate_limit(
        request,
        scope="microsite_schedule_id",
        identifier=str(tracking_id),
        limit=3,
        window_seconds=3600,
        detail="A call has already been scheduled for this opportunity link.",
    )
    email_sent = await _find_email_sent(tracking_id, db)
    if not email_sent:
        if tracking_id in ("demo", "cand_src_01", "mock_1", "showcase", "spacex") or tracking_id.startswith(("cand_src_", "mock_")):
            return {
                "success": True,
                "message": "Demo mode: Call scheduled successfully! Recruiter calendar invite will be delivered."
            }
        raise HTTPException(status_code=404, detail="Microsite opportunity not found.")

    email_sent.status = EmailStatus.REPLIED
    email_sent.replied_at = datetime.now(timezone.utc)
    if data and data.notes:
        meta = email_sent.meta_data or {}
        meta["candidate_schedule_notes"] = data.notes
        if data.preferred_time:
            meta["candidate_preferred_time"] = data.preferred_time
        email_sent.meta_data = meta

    if email_sent.campaign_id:
        camp_res = await db.execute(select(EmailCampaign).where(EmailCampaign.id == email_sent.campaign_id))
        camp = camp_res.scalar_one_or_none()
        if camp:
            camp.total_replied = (camp.total_replied or 0) + 1

    if email_sent.candidate_id:
        c_res = await db.execute(select(Candidate).where(Candidate.id == email_sent.candidate_id))
        cand = c_res.scalar_one_or_none()
        if cand:
            cand.status = CandidateStatus.INTERESTED

    await db.commit()

    return {
        "success": True,
        "message": "Introductory call request confirmed! The hiring team has been notified and will send calendar details shortly."
    }

@router.get("/{campaign_id}")
async def get_campaign(
    campaign_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_campaign_access(current_user, write=False)
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
    _require_campaign_access(current_user, write=True)
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
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger sending all pending emails for this campaign"""
    _require_campaign_access(current_user, write=True)
    await enforce_endpoint_rate_limit(
        request,
        scope="campaign_send_tenant",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=10,
        window_seconds=3600,
        detail="Campaign send rate limit exceeded (max 10 per hour).",
    )
    await enforce_endpoint_rate_limit(
        request,
        scope="campaign_send_id",
        identifier=str(campaign_id),
        limit=1,
        window_seconds=300,
        detail="This campaign was just triggered. Please wait 5 minutes before triggering again.",
    )
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
    _require_campaign_access(current_user, write=False)
    camp_res = await db.execute(
        select(EmailCampaign)
        .join(User, EmailCampaign.owner_id == User.id)
        .where(
            EmailCampaign.id == campaign_id,
            User.tenant_id == current_user.tenant_id,
        )
    )
    campaign = camp_res.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    query = select(EmailSent).where(EmailSent.campaign_id == campaign_id)
    count_q = select(func.count(EmailSent.id)).where(EmailSent.campaign_id == campaign_id)
    if status:
        query = query.where(EmailSent.status == status)
        count_q = count_q.where(EmailSent.status == status)
    total = (await db.execute(count_q)).scalar() or 0
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
