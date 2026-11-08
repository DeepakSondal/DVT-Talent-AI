"""
DVT Talent AI — Analytics API
Dashboard KPIs, funnel metrics, campaign performance
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from db.models import (
    Job, Candidate, EmailSent, Interview,
    CandidateStatus, EmailStatus, UserRole, get_db
)
from api.routes.auth import get_current_user, User

router = APIRouter()


def _require_analytics_access(current_user: User):
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if not current_user.tenant_id or role_val == "candidate":
        raise HTTPException(status_code=403, detail="Workspace permissions required to access analytics.")
    return current_user.tenant_id


@router.get("/dashboard")
async def get_dashboard_kpis(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Main dashboard KPIs"""
    tenant_id = _require_analytics_access(current_user)
    since = datetime.now(timezone.utc) - timedelta(days=days)

    # Job Requisitions (single aggregate query)
    jobs_total, jobs_active = (await db.execute(
        select(
            func.count(Job.id),
            func.count(Job.id).filter(Job.is_active == True),
        ).where(Job.tenant_id == tenant_id)
    )).one()

    # Candidates (single aggregate query)
    candidates_total, candidates_new, candidates_placed = (await db.execute(
        select(
            func.count(Candidate.id),
            func.count(Candidate.id).filter(Candidate.created_at >= since),
            func.count(Candidate.id).filter(Candidate.status == CandidateStatus.PLACED),
        ).where(Candidate.tenant_id == tenant_id)
    )).one()

    # Emails (single aggregate query)
    emails_sent, emails_opened, emails_replied = (await db.execute(
        select(
            func.count(EmailSent.id).filter(EmailSent.status != EmailStatus.DRAFT),
            func.count(EmailSent.id).filter(EmailSent.status == EmailStatus.OPENED),
            func.count(EmailSent.id).filter(EmailSent.status == EmailStatus.REPLIED),
        ).where(
            and_(
                EmailSent.tenant_id == tenant_id,
                EmailSent.created_at >= since,
            )
        )
    )).one()

    # Interviews
    interviews_scheduled = (await db.execute(
        select(func.count(Interview.id))
        .join(Candidate, Interview.candidate_id == Candidate.id)
        .where(
            and_(Candidate.tenant_id == tenant_id, Interview.created_at >= since)
        )
    )).scalar() or 0

    open_rate = round((emails_opened / emails_sent * 100) if emails_sent > 0 else 0, 1)
    reply_rate = round((emails_replied / emails_sent * 100) if emails_sent > 0 else 0, 1)
    placement_rate = round((candidates_placed / candidates_total * 100) if candidates_total > 0 else 0, 1)

    return {
        "period_days": days,
        "jobs": {
            "total": jobs_total,
            "active": jobs_active,
        },
        "candidates": {
            "total": candidates_total,
            "new_this_period": candidates_new,
            "placed": candidates_placed,
            "placement_rate": placement_rate,
        },
        "outreach": {
            "emails_sent": emails_sent,
            "emails_opened": emails_opened,
            "emails_replied": emails_replied,
            "open_rate": open_rate,
            "reply_rate": reply_rate,
        },
        "interviews": {
            "scheduled": interviews_scheduled,
        },
    }


@router.get("/candidate-funnel")
async def get_candidate_funnel(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Candidate pipeline funnel breakdown"""
    tenant_id = _require_analytics_access(current_user)
    rows = (await db.execute(
        select(Candidate.status, func.count(Candidate.id))
        .where(Candidate.tenant_id == tenant_id)
        .group_by(Candidate.status)
    )).all()
    counts = {(s.value if hasattr(s, "value") else s): c for s, c in rows}
    return {"funnel": [{"stage": s.value, "count": counts.get(s.value, 0)} for s in CandidateStatus]}


@router.get("/email-performance")
async def get_email_performance(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Daily email performance over time"""
    tenant_id = _require_analytics_access(current_user)
    since = datetime.now(timezone.utc) - timedelta(days=days)
    # Group by day
    result = await db.execute(
        select(
            func.date(EmailSent.sent_at).label("date"),
            func.count(EmailSent.id).label("sent"),
            func.count(EmailSent.opened_at).label("opened"),
            func.count(EmailSent.replied_at).label("replied"),
        )
        .where(
            and_(
                EmailSent.tenant_id == tenant_id,
                EmailSent.sent_at >= since
            )
        )
        .group_by(func.date(EmailSent.sent_at))
        .order_by(func.date(EmailSent.sent_at))
    )
    rows = result.all()
    return {
        "data": [
            {
                "date": str(r.date),
                "sent": r.sent,
                "opened": r.opened,
                "replied": r.replied,
                "open_rate": round((r.opened / r.sent * 100) if r.sent > 0 else 0, 1),
            }
            for r in rows
        ]
    }
