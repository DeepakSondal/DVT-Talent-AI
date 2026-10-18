"""
DVT Talent AI — External Webhooks
Handles inbound data from Monster, LinkedIn, and other job boards.
"""
import uuid
import structlog
from fastapi import APIRouter, Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import Candidate, Job, CandidateStatus, get_db
from services.email_service import EmailService

log = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/monster/applications")
async def monster_application_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Accepts Easy Apply applications from Monster.
    Reference: Monster Easy Apply Integration Guide.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    log.info("monster_webhook_received", payload=payload)
    
    applicant = payload.get("applicant", {})
    job_id_external = payload.get("job_external_id") or payload.get("jobId")
    
    if not applicant or not job_id_external:
        raise HTTPException(status_code=400, detail="Malformed Monster payload")

    # 1. Map external Job ID back to our DB
    job_uuid = None
    try:
        job_uuid = uuid.UUID(str(job_id_external))
    except (ValueError, TypeError):
        log.info("non_uuid_job_id", job_id=job_id_external)

    # 2. Extract Applicant Info
    email = applicant.get("email")
    first_name = applicant.get("firstName", "Monster")
    last_name = applicant.get("lastName", "Applicant")
    
    # 3. Create or Update Candidate
    from sqlalchemy import select
    result = await db.execute(select(Candidate).where(Candidate.email == email))
    candidate = result.scalars().first()
    
    if not candidate:
        candidate = Candidate(
            id=uuid.uuid4(),
            email=email,
            first_name=first_name,
            last_name=last_name,
            status=CandidateStatus.APPLIED,
            source="monster",
            title=applicant.get("jobTitle")
        )
        db.add(candidate)
        await db.flush()
        log.info("candidate_created_from_monster", email=email)

    # 4. Linkage & Commit
    await db.commit()
    
    return {"status": "success", "candidate_id": str(candidate.id)}

@router.post("/email/inbound")
async def email_inbound_webhook(request: Request):
    """
    Accepts incoming webhooks from Mail Transfer Agents (SendGrid/Mailgun)
    to automatically track candidate replies.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    log.info("incoming_email_webhook_received")
    
    email_service = EmailService()
    success = await email_service.process_incoming_webhook(payload)
    
    if success:
        return {"status": "tracked"}
    return {"status": "ignored", "reason": "No matching outgoing email or already tracked"}
