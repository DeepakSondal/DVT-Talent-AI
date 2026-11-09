"""
DVT Talent AI — External Webhooks
Handles inbound data from Monster, LinkedIn, and other job boards.
"""
import hashlib
import hmac
import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limit import enforce_endpoint_rate_limit, get_real_client_ip
from config import settings
from db.models import Candidate, CandidateStatus, Job, get_db
from services.email_service import EmailService

log = structlog.get_logger(__name__)
router = APIRouter()


def _verify_webhook_hmac(raw_body: bytes, signature_header: str, secret: str) -> bool:
    if not secret or not signature_header:
        return False
    sig = signature_header.strip()
    if sig.startswith("sha256="):
        sig = sig.split("=", 1)[1]
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(sig.lower(), expected.lower())


@router.post("/monster/applications")
async def monster_application_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Accepts Easy Apply applications from Monster.
    Reference: Monster Easy Apply Integration Guide.
    """
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="webhook_monster_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Webhook rate limit exceeded.",
    )

    raw_body = await request.body()
    secret = getattr(settings, "monster_webhook_secret", "") or ""
    sig_header = request.headers.get("X-Monster-Signature") or request.headers.get("X-Webhook-Signature") or ""
    if secret or settings.is_production:
        if not _verify_webhook_hmac(raw_body, sig_header, secret):
            raise HTTPException(status_code=401, detail="Invalid or missing webhook signature")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    log.info("monster_webhook_received", payload=payload)
    
    applicant = payload.get("applicant", {})
    job_id_external = payload.get("job_external_id") or payload.get("jobId")
    
    if not applicant or not job_id_external:
        raise HTTPException(status_code=400, detail="Malformed Monster payload")

    # 1. Map external Job ID back to our DB to resolve tenant_id
    from sqlalchemy import select
    job_uuid = None
    target_tenant_id = None
    try:
        job_uuid = uuid.UUID(str(job_id_external))
    except (ValueError, TypeError):
        log.info("non_uuid_job_id", job_id=job_id_external)

    if job_uuid:
        job_row = (await db.execute(select(Job).where(Job.id == job_uuid))).scalar_one_or_none()
        if job_row:
            target_tenant_id = job_row.tenant_id

    # 2. Extract Applicant Info
    email = applicant.get("email")
    first_name = applicant.get("firstName", "Monster")
    last_name = applicant.get("lastName", "Applicant")
    
    # 3. Create or Update Candidate scoped strictly to resolved tenant_id
    cand_stmt = select(Candidate).where(
        Candidate.email == email,
        Candidate.tenant_id == target_tenant_id,
    )
    result = await db.execute(cand_stmt)
    candidate = result.scalars().first()
    
    if not candidate:
        candidate = Candidate(
            id=uuid.uuid4(),
            tenant_id=target_tenant_id,
            email=email,
            first_name=first_name,
            last_name=last_name,
            status=CandidateStatus.APPLIED,
            source="monster",
            title=applicant.get("jobTitle")
        )
        db.add(candidate)
        await db.flush()
        log.info("candidate_created_from_monster", email=email, tenant_id=str(target_tenant_id) if target_tenant_id else None)

    # 4. Linkage & Commit
    await db.commit()
    
    return {"status": "success", "candidate_id": str(candidate.id)}

@router.post("/email/inbound")
async def email_inbound_webhook(request: Request):
    """
    Accepts incoming webhooks from Mail Transfer Agents (SendGrid/Mailgun)
    to automatically track candidate replies.
    """
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="webhook_email_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Webhook rate limit exceeded.",
    )

    raw_body = await request.body()
    secret = getattr(settings, "inbound_email_webhook_secret", "") or ""
    sig_header = request.headers.get("X-Inbound-Signature") or request.headers.get("X-Webhook-Signature") or ""
    if secret or settings.is_production:
        if not _verify_webhook_hmac(raw_body, sig_header, secret):
            raise HTTPException(status_code=401, detail="Invalid or missing webhook signature")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    log.info("incoming_email_webhook_received")
    
    email_service = EmailService()
    success = await email_service.process_incoming_webhook(payload)
    
    if success:
        return {"status": "tracked"}
    return {"status": "ignored", "reason": "No matching outgoing email or already tracked"}
