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
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone

from db.models import Candidate, Resume, CandidateStatus, Tenant, UserRole, get_db
from api.routes.auth import get_current_user, User
from services.security_service import log_audit_event
from services.privacy_service import is_candidate_visible_to_recruiter, normalize_domain
from services.resume_parser import ResumeParserService
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


async def _resolve_recruiter_tenant_info(db: AsyncSession, current_user: User) -> tuple[Optional[str], Optional[str]]:
    """Resolve recruiter's corporate tenant domain and tenant name for privacy evaluation."""
    tenant_domain = None
    tenant_name = None
    if getattr(current_user, "tenant_id", None):
        res = await db.execute(select(Tenant).where(Tenant.id == current_user.tenant_id))
        tenant = res.scalar_one_or_none()
        if tenant:
            tenant_domain = tenant.domain
            tenant_name = tenant.name
    return tenant_domain, tenant_name


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

    tenant_domain, tenant_name = await _resolve_recruiter_tenant_info(db, current_user)

    query = select(Candidate).where(
        Candidate.tenant_id == current_user.tenant_id,
        Candidate.is_searchable != False,
        Candidate.pii_erased != True,
    )

    if search:
        search_filter = (
            Candidate.first_name.ilike(f"%{search}%") |
            Candidate.last_name.ilike(f"%{search}%") |
            Candidate.email.ilike(f"%{search}%") |
            Candidate.title.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    if status:
        query = query.where(Candidate.status == status)

    if min_score is not None:
        query = query.where(Candidate.score >= min_score)

    if source:
        query = query.where(Candidate.source == source)

    query = query.order_by(desc(Candidate.score))
    all_matching = (await db.execute(query)).scalars().all()

    # Enforce candidate privacy shield: exclude candidates who are in stealth mode or have blacklisted this employer
    visible_candidates = [
        c for c in all_matching
        if is_candidate_visible_to_recruiter(
            candidate=c,
            recruiter_tenant_domain=tenant_domain,
            recruiter_tenant_name=tenant_name,
            recruiter_email=current_user.email,
        )
    ]

    total = len(visible_candidates)
    start_idx = (page - 1) * page_size
    paged_items = visible_candidates[start_idx : start_idx + page_size]

    return CandidateList(items=paged_items, total=total, page=page, page_size=page_size)


@router.post("", response_model=CandidateOut, status_code=201)
async def create_candidate(
    data: CandidateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check duplicate within this workspace tenant
    existing = (await db.execute(
        select(Candidate).where(
            Candidate.tenant_id == current_user.tenant_id,
            Candidate.email == data.email
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Candidate with this email already exists in your workspace")

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
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or administrative permissions required to export candidate records."
        )

    tenant_domain, tenant_name = await _resolve_recruiter_tenant_info(db, current_user)

    result = await db.execute(
        select(Candidate).where(
            Candidate.tenant_id == current_user.tenant_id,
            Candidate.is_searchable != False,
            Candidate.pii_erased != True,
        ).order_by(desc(Candidate.score))
    )
    candidates = result.scalars().all()

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
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow([
        "Full Name", "Title", "Current Company", "Score", 
        "Location", "Email", "LinkedIn", "AI Strengths", 
        "AI Weaknesses", "Synthesis Verdict", "Sourced Date"
    ])
    
    for c in visible_candidates:
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
            c.created_at.strftime("%Y-%m-%d") if c.created_at else ""
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

    tenant_domain, tenant_name = await _resolve_recruiter_tenant_info(db, current_user)

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
    """
    Upload resume for an existing candidate, extract 100% full text (PDF/DOCX/TXT),
    parse structured career history (work experience, education, skills), persist the file,
    and update candidate profile fields.
    """
    filename = (file.filename or "").strip()
    allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".rtf"}
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, DOCX, TXT, RTF."
        )

    max_bytes = 10 * 1024 * 1024  # 10 MB
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum permitted limit of 10 MB."
        )

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    # 1. Multi-format text extraction (PDF / DOCX / TXT)
    raw_text = ResumeParserService.extract_text(content, filename)
    if not raw_text.strip():
        raw_text = f"Resume document: {filename}"

    # 2. Structured career history extraction
    parsed_data = ResumeParserService.parse_structured_resume(raw_text, filename)

    # 3. Secure file persistence
    resume_id = _uuid.uuid4()
    file_path = ResumeParserService.save_resume_file(
        str(candidate.id), str(resume_id), filename, content
    )

    # 4. Update candidate profile fields
    curr_skills = set(candidate.skills or [])
    curr_skills.update(parsed_data.get("skills", []))
    candidate.skills = sorted(list(curr_skills))

    if parsed_data.get("experience_years"):
        candidate.experience_years = max(candidate.experience_years or 0, parsed_data["experience_years"])
    
    if parsed_data.get("current_company") and parsed_data["current_company"] != "Parsed From Resume":
        candidate.current_company = parsed_data["current_company"]
    
    if parsed_data.get("current_title") and not candidate.title:
        candidate.title = parsed_data["current_title"]

    contact = parsed_data.get("contact", {})
    if contact.get("phone") and not candidate.phone:
        candidate.phone = contact["phone"]
    if contact.get("location") and not candidate.location:
        candidate.location = contact["location"]
    if contact.get("linkedin_url") and not candidate.linkedin_url:
        candidate.linkedin_url = contact["linkedin_url"]
    if contact.get("github_url") and not candidate.github_url:
        candidate.github_url = contact["github_url"]

    # 5. Mark older resumes as not current
    old_resumes = (await db.execute(
        select(Resume).where(Resume.candidate_id == candidate_id, Resume.is_current == True)
    )).scalars().all()
    for r in old_resumes:
        r.is_current = False

    # 6. Save Resume record
    resume = Resume(
        id=resume_id,
        candidate_id=candidate_id,
        tenant_id=current_user.tenant_id,
        file_name=filename,
        file_url=file_path,
        raw_text=raw_text,
        parsed_data=parsed_data,
        is_current=True,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(resume)

    # Background: dispatch task if broker is available
    background_tasks.add_task(
        analyze_resume_background,
        str(resume.id),
        content,
        filename,
    )

    return {
        "message": f"Resume '{filename}' uploaded and parsed successfully.",
        "resume_id": str(resume.id),
        "skills_detected": parsed_data.get("skills", []),
        "experience_detected": len(parsed_data.get("experience", [])),
        "education_detected": len(parsed_data.get("education", [])),
        "raw_text_length": len(raw_text),
    }


@router.get("/{candidate_id}/resume/download")
async def download_candidate_resume(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Download candidate's original resume document in PDF or Word format."""
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or administrative permissions required to download candidate resumes."
        )

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    tenant_domain, tenant_name = await _resolve_recruiter_tenant_info(db, current_user)
    if not is_candidate_visible_to_recruiter(
        candidate=candidate,
        recruiter_tenant_domain=tenant_domain,
        recruiter_tenant_name=tenant_name,
        recruiter_email=current_user.email,
    ):
        raise HTTPException(status_code=404, detail="Candidate not found")

    res = (await db.execute(
        select(Resume)
        .where(Resume.candidate_id == candidate.id, Resume.is_current == True)
        .order_by(desc(Resume.created_at))
    )).scalars().first()

    if not res:
        raise HTTPException(status_code=404, detail="No resume on file for this candidate.")

    file_path = ResumeParserService.get_resume_file_path(res.file_url)
    if not file_path or not file_path.exists():
        raise HTTPException(status_code=404, detail="Original resume file not found on disk.")

    ext = file_path.suffix.lower()
    media_types = {
        ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc": "application/msword",
        ".txt": "text/plain",
    }
    media_type = media_types.get(ext, "application/octet-stream")

    return FileResponse(
        path=str(file_path),
        filename=res.file_name or file_path.name,
        media_type=media_type,
    )


@router.get("/{candidate_id}/resume/details")
async def get_candidate_resume_details(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Retrieve full extracted text and structured parsed data (experience, education, skills)."""
    if current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recruiter or administrative permissions required to view candidate resume details."
        )

    result = await db.execute(
        select(Candidate).where(Candidate.id == candidate_id, Candidate.tenant_id == current_user.tenant_id)
    )
    candidate = result.scalar_one_or_none()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    tenant_domain, tenant_name = await _resolve_recruiter_tenant_info(db, current_user)
    if not is_candidate_visible_to_recruiter(
        candidate=candidate,
        recruiter_tenant_domain=tenant_domain,
        recruiter_tenant_name=tenant_name,
        recruiter_email=current_user.email,
    ):
        raise HTTPException(status_code=404, detail="Candidate not found")

    res = (await db.execute(
        select(Resume)
        .where(Resume.candidate_id == candidate.id, Resume.is_current == True)
        .order_by(desc(Resume.created_at))
    )).scalars().first()

    if not res:
        return {
            "has_resume": False,
            "message": "No active resume document found for candidate.",
            "skills": candidate.skills or [],
            "experience": [],
            "education": [],
            "raw_text": "",
        }

    return {
        "has_resume": True,
        "resume_id": str(res.id),
        "file_name": res.file_name,
        "created_at": res.created_at.isoformat() if res.created_at else None,
        "raw_text": res.raw_text or "",
        "parsed_data": res.parsed_data or {},
        "skills": res.parsed_data.get("skills", candidate.skills or []) if res.parsed_data else (candidate.skills or []),
        "experience": res.parsed_data.get("experience", []) if res.parsed_data else [],
        "education": res.parsed_data.get("education", []) if res.parsed_data else [],
        "summary": res.parsed_data.get("summary", "") if res.parsed_data else "",
    }


@router.post("/upload")
async def intake_candidate_resume(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Intake endpoint for recruiters: upload a resume directly from the talent directory.
    Extracts 100% full text, structures candidate profile, creates Candidate + Resume records,
    and returns the fully populated candidate.
    """
    filename = (file.filename or "").strip()
    allowed_exts = {".pdf", ".docx", ".doc", ".txt", ".rtf"}
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if ext not in allowed_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed formats: PDF, DOCX, TXT, RTF."
        )

    max_bytes = 10 * 1024 * 1024
    content = await file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds maximum permitted limit of 10 MB."
        )

    # 1. Multi-format text extraction
    raw_text = ResumeParserService.extract_text(content, filename)
    if not raw_text.strip():
        raw_text = f"Resume document: {filename}"

    # 2. Structured parsing
    parsed_data = ResumeParserService.parse_structured_resume(raw_text, filename)

    # 3. Derive contact & name
    contact = parsed_data.get("contact", {})
    email = contact.get("email")
    phone = contact.get("phone")
    first_name = contact.get("first_name")
    last_name = contact.get("last_name")

    if not first_name or not last_name:
        base_name = filename.rsplit(".", 1)[0].replace("-", " ").replace("_", " ")
        raw_parts = [p for p in base_name.split() if p]
        clean_parts = [p for p in raw_parts if p.lower() not in {"cv", "resume", "curriculum", "vitae", "pdf", "docx"}]
        parts = clean_parts if clean_parts else raw_parts
        first_name = first_name or (parts[0].capitalize() if parts else "Imported")
        last_name = last_name or (" ".join(parts[1:]).title() if len(parts) > 1 else "Candidate")

    candidate = None
    if email:
        res = await db.execute(
            select(Candidate).where(Candidate.email == email)
        )
        candidate = res.scalar_one_or_none()

    cand_id = candidate.id if candidate else _uuid.uuid4()
    if not candidate:
        candidate_email = email or f"{first_name.lower().replace(' ', '')}.{last_name.lower().replace(' ', '')}_{str(cand_id)[:6]}@talent-import.io"
        candidate = Candidate(
            id=cand_id,
            tenant_id=current_user.tenant_id,
            first_name=first_name,
            last_name=last_name,
            email=candidate_email,
            phone=phone,
            title=parsed_data.get("current_title") or "Software Specialist",
            current_company=parsed_data.get("current_company") if parsed_data.get("current_company") != "Parsed From Resume" else None,
            location=contact.get("location") or "Remote",
            skills=parsed_data.get("skills", []),
            experience_years=parsed_data.get("experience_years") or 3,
            status=CandidateStatus.SOURCED,
            source="Resume Upload",
            ai_summary=parsed_data.get("summary") or f"Direct resume intake from '{filename}'. Extracted {len(parsed_data.get('skills', []))} skills.",
            linkedin_url=contact.get("linkedin_url"),
            github_url=contact.get("github_url"),
            score=88,
        )
        db.add(candidate)
    else:
        # Update existing candidate
        curr_skills = set(candidate.skills or [])
        curr_skills.update(parsed_data.get("skills", []))
        candidate.skills = sorted(list(curr_skills))
        if parsed_data.get("experience_years"):
            candidate.experience_years = max(candidate.experience_years or 0, parsed_data["experience_years"])
        if parsed_data.get("current_title") and not candidate.title:
            candidate.title = parsed_data["current_title"]

    resume_id = _uuid.uuid4()
    file_path = ResumeParserService.save_resume_file(
        str(cand_id), str(resume_id), filename, content
    )

    # Deactivate existing resumes
    old_res = (await db.execute(
        select(Resume).where(Resume.candidate_id == cand_id, Resume.is_current == True)
    )).scalars().all()
    for r in old_res:
        r.is_current = False

    resume = Resume(
        id=resume_id,
        candidate_id=cand_id,
        tenant_id=current_user.tenant_id,
        file_name=filename,
        file_url=file_path,
        raw_text=raw_text,
        parsed_data=parsed_data,
        is_current=True,
    )
    db.add(resume)
    await db.commit()
    await db.refresh(candidate)

    # Background task
    background_tasks.add_task(
        analyze_resume_background,
        str(resume.id),
        content,
        filename,
    )

    return {
        "status": "success",
        "candidate": {
            "id": str(candidate.id),
            "first_name": candidate.first_name,
            "last_name": candidate.last_name,
            "email": candidate.email,
            "phone": candidate.phone,
            "title": candidate.title,
            "company": candidate.current_company,
            "location": candidate.location,
            "skills": candidate.skills or [],
            "experience_years": candidate.experience_years,
            "status": candidate.status.value if hasattr(candidate.status, "value") else str(candidate.status),
            "source": candidate.source,
            "score": candidate.score,
            "ai_summary": candidate.ai_summary,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
            "resume_file_name": filename,
        },
        "parsed_data": parsed_data,
        "message": f"Resume '{filename}' imported successfully with {len(parsed_data.get('skills', []))} skills.",
    }


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
    summary="GDPR Right to Erasure — erase all personal data for a candidate",
    status_code=200,
)
@router.delete(
    "/{candidate_id}/erasure",
    summary="GDPR Right to Erasure alias",
    status_code=200,
)
async def erase_candidate_pii(
    candidate_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently erases all Personally Identifiable Information (PII), resume database records,
    physical resume files on disk, and vector embeddings for a candidate in compliance with
    GDPR Article 17.
    """
    from services.privacy_service import erase_candidate_personal_data
    return await erase_candidate_personal_data(
        candidate_id=candidate_id,
        db=db,
        requesting_user=current_user,
    )

