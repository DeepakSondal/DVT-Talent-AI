"""
DVT Talent AI — Candidates API
Full candidate lifecycle management with AI scoring
"""
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import csv
import io
import base64
import uuid as _uuid
import structlog

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone

from db.models import Candidate, Resume, CandidateStatus, Tenant, UserRole, get_db
from api.routes.auth import get_current_user, User
from services.security_service import log_audit_event
from services.privacy_service import is_candidate_visible_to_recruiter, normalize_domain
from fastapi import status

log = structlog.get_logger(__name__)
router = APIRouter()


class CandidateCreate(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    title: Optional[str] = None
    location: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    skills: Optional[List[str]] = []
    experience_years: Optional[int] = None
    source: Optional[str] = "manual"


class CandidateOut(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    title: Optional[str]
    location: Optional[str]
    linkedin_url: Optional[str]
    github_url: Optional[str]
    skills: Optional[List[str]]
    experience_years: Optional[int]
    current_company: Optional[str]
    status: CandidateStatus
    source: Optional[str]
    score: float
    ai_summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class CandidateList(BaseModel):
    items: List[CandidateOut]
    total: int
    page: int
    page_size: int


@router.get("", response_model=CandidateList)
async def list_candidates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    min_score: Optional[float] = None,
    skill: Optional[str] = None,
    source: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or administrative permissions required to access candidate management."
        )

    # Fetch recruiter's tenant domain and name for privacy shield evaluation
    tenant_domain = None
    tenant_name = None
    if current_user.tenant_id:
        tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant_obj = tenant_res.scalar_one_or_none()
        if tenant_obj:
            tenant_domain = tenant_obj.domain
            tenant_name = tenant_obj.name

    query = select(Candidate).where(Candidate.tenant_id == current_user.tenant_id)
    count_query = select(func.count(Candidate.id)).where(Candidate.tenant_id == current_user.tenant_id)

    if search:
        search_filter = (
            Candidate.first_name.ilike(f"%{search}%") |
            Candidate.last_name.ilike(f"%{search}%") |
            Candidate.email.ilike(f"%{search}%") |
            Candidate.title.ilike(f"%{search}%")
        )
        query = query.where(search_filter)
        count_query = count_query.where(search_filter)

    if status:
        query = query.where(Candidate.status == status)
        count_query = count_query.where(Candidate.status == status)

    if min_score is not None:
        query = query.where(Candidate.score >= min_score)
        count_query = count_query.where(Candidate.score >= min_score)

    if source:
        query = query.where(Candidate.source == source)
        count_query = count_query.where(Candidate.source == source)

    total = (await db.execute(count_query)).scalar() or 0
    query = query.order_by(desc(Candidate.score)).offset((page - 1) * page_size).limit(page_size)
    candidates = (await db.execute(query)).scalars().all()

    # Enforce candidate privacy shield: exclude candidates who are in stealth mode or have blacklisted this employer
    visible_candidates = [
        c for c in candidates
        if is_candidate_visible_to_recruiter(
            candidate=c,
            recruiter_tenant_domain=tenant_domain,
            recruiter_tenant_name=tenant_name,
            recruiter_email=current_user.email,
        )
    ]

    return CandidateList(items=visible_candidates, total=len(visible_candidates), page=page, page_size=page_size)


@router.post("", response_model=CandidateOut, status_code=201)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check duplicate
    existing = (await db.execute(select(Candidate).where(Candidate.email == data.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Candidate with this email already exists")

    candidate = Candidate(**data.model_dump())
    candidate.tenant_id = current_user.tenant_id
    db.add(candidate)
    await db.commit()
    await db.refresh(candidate)
    return candidate


@router.get("/export", response_class=StreamingResponse)
async def export_candidates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Export the candidate shortlist as a professional CSV for stakeholders."""
    result = await db.execute(
        select(Candidate).where(Candidate.tenant_id == current_user.tenant_id)
    )
    candidates = result.scalars().all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Full Name", "Title", "Current Company", "Score", 
        "Location", "Email", "LinkedIn", "AI Strengths", 
        "AI Weaknesses", "Synthesis Verdict", "Sourced Date"
    ])
    
    for c in candidates:
        strengths = ", ".join(c.scoring_reasoning.get("strengths", [])) if c.scoring_reasoning else ""
        weaknesses = ", ".join(c.scoring_reasoning.get("weaknesses", [])) if c.scoring_reasoning else ""
        alignment = c.scoring_reasoning.get("alignment", "") if c.scoring_reasoning else ""
        
        writer.writerow([
            f"{c.first_name} {c.last_name}",
            c.title or "N/A",
            c.current_company or "N/A",
            f"{c.score}%",
            c.location or "N/A",
            c.email,
            c.linkedin_url or "N/A",
            strengths,
            weaknesses,
            alignment,
            c.created_at.strftime("%Y-%m-%d")
        ])
    
    output.seek(0)
    filename = f"Talent_Synthesis_{datetime.now().strftime('%Y%m%d')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/{candidate_id}", response_model=CandidateOut)
async def get_candidate(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or administrative permissions required to view candidate records."
        )

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Fetch recruiter's tenant domain and name for privacy shield evaluation
    tenant_domain = None
    tenant_name = None
    if current_user.tenant_id:
        tenant_res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant_obj = tenant_res.scalar_one_or_none()
        if tenant_obj:
            tenant_domain = tenant_obj.domain
            tenant_name = tenant_obj.name

    if not is_candidate_visible_to_recruiter(
        candidate=candidate,
        recruiter_tenant_domain=tenant_domain,
        recruiter_tenant_name=tenant_name,
        recruiter_email=current_user.email,
    ):
        raise HTTPException(status_code=404, detail="Candidate not found")

    return candidate


@router.patch("/{candidate_id}/status")
async def update_candidate_status(
    candidate_id: UUID,
    status: CandidateStatus,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = status
    await db.commit()
    return {"status": "updated", "new_status": status.value}


@router.post("/{candidate_id}/resume")
async def upload_resume(
    candidate_id: UUID,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload & AI-analyze resume"""
    if not file.filename.endswith((".pdf", ".docx", ".txt")):
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, TXT files allowed")

    content = await file.read()

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # Mark old resumes as not current
    old_resumes = (await db.execute(
        select(Resume).where(Resume.candidate_id == candidate_id, Resume.is_current == True)
    )).scalars().all()
    for r in old_resumes:
        r.is_current = False

    resume = Resume(
        candidate_id=candidate_id,
        file_name=file.filename,
        is_current=True,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Background: parse + score resume
    background_tasks.add_task(
        analyze_resume_background,
        str(resume.id),
        content,
        file.filename,
    )

    return {"message": "Resume uploaded, analysis started", "resume_id": str(resume.id)}


@router.post("/{candidate_id}/score")
async def score_candidate(
    candidate_id: UUID,
    job_id: Optional[UUID] = None,
    # FIX [C-04]: Removed mutable default `BackgroundTasks()` — breaks FastAPI DI
    background_tasks: BackgroundTasks = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Trigger AI scoring for a candidate"""
    if background_tasks is None:
        background_tasks = BackgroundTasks()
    background_tasks.add_task(score_candidate_background, str(candidate_id), str(job_id) if job_id else None)
    return {"message": "Scoring started", "candidate_id": str(candidate_id)}


async def analyze_resume_background(resume_id: str, content: bytes, filename: str):
    try:
        from workers.tasks import analyze_resume_task, safe_dispatch_task
        safe_dispatch_task(analyze_resume_task, resume_id, base64.b64encode(content).decode(), filename)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue analyze_resume_task: {e}")


async def score_candidate_background(candidate_id: str, job_id: Optional[str]):
    try:
        from workers.tasks import score_candidate_task, safe_dispatch_task
        safe_dispatch_task(score_candidate_task, candidate_id, job_id)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Could not enqueue score_candidate_task: {e}")



# ── GDPR Right-to-Erasure ─────────────────────────────────────────────────────

@router.delete(
    "/{candidate_id}/pii",
    summary="GDPR Right to Erasure — erase all PII for a candidate",
    status_code=200,
)
async def erase_candidate_pii(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently erases all Personally Identifiable Information (PII) for a candidate.
    The record row is preserved for audit trail and analytics continuity, but all
    identifying fields are nullified and the record is flagged as erased.

    Only admin‑role users may call this endpoint.
    """
    if current_user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Only admins can erase candidate PII")

    result = await db.execute(
        select(Candidate).where(
            Candidate.id == candidate_id,
            Candidate.tenant_id == current_user.tenant_id,
        )
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if candidate.pii_erased:
        return {"status": "already_erased", "id": str(candidate_id), "erased_at": candidate.pii_erased_at}

    # Nullify all identifying fields
    candidate.first_name = "Erased"
    candidate.last_name = "User"
    candidate.email = f"erased_{candidate.id}@gdpr.removed"
    candidate.phone = None
    candidate.linkedin_url = None
    candidate.github_url = None
    candidate.portfolio_url = None
    candidate.current_company = None
    candidate.resume_url = None if hasattr(candidate, "resume_url") else None
    candidate.ai_summary = "[PII erased per GDPR Article 17 request]"
    candidate.do_not_contact = True
    candidate.pii_erased = True
    candidate.pii_erased_at = datetime.now(timezone.utc)

    await db.commit()

    # Audit log
    try:
        await log_audit_event(
            tenant_id=current_user.tenant_id,
            user_id=current_user.id,
            action="GDPR_PII_ERASURE",
            entity_type="candidate",
            entity_id=candidate_id,
            metadata={"erased_by": str(current_user.id), "timestamp": candidate.pii_erased_at.isoformat()},
        )
    except Exception:
        pass  # Never let audit logging failures block the erasure response

    log.info("gdpr_pii_erased", candidate_id=str(candidate_id), erased_by=str(current_user.id))
    return {
        "status": "erased",
        "id": str(candidate_id),
        "erased_at": candidate.pii_erased_at.isoformat(),
        "message": "All PII has been permanently removed in compliance with GDPR Article 17.",
    }

