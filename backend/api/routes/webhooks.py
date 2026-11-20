"""
DVT Talent AI — External Webhooks
Handles inbound data from Monster, LinkedIn, and other job boards.
"""
import hashlib
import hmac
import os
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


async def _ingest_job_board_application(board: str, request: Request, db: AsyncSession):
    """
    Shared intake handler for Monster.com and Dice.com Easy Apply webhooks.
    Verifies HMAC signature, resolves tenant via Job.id, creates/updates Candidate,
    and attaches any submitted resume (or generates a PDF dossier).
    """
    import base64
    import re

    from db.models import Resume
    from services.resume_parser import ResumeParserService

    board_key = board.strip().lower()
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope=f"webhook_{board_key}_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Webhook rate limit exceeded.",
    )

    raw_body = await request.body()
    secret = getattr(settings, f"{board_key}_webhook_secret", "") or ""
    sig_header = (
        request.headers.get(f"X-{board_key.title()}-Signature")
        or request.headers.get("X-Webhook-Signature")
        or ""
    )
    is_testing_bypass = os.getenv("TESTING", "").strip().lower() == "true" and not settings.is_production
    if secret or not is_testing_bypass:
        if not _verify_webhook_hmac(raw_body, sig_header, secret):
            raise HTTPException(status_code=401, detail="Invalid or missing webhook signature")

    try:
        payload = await request.json()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON payload") from exc

    log.info(f"{board_key}_webhook_received", payload=payload)

    applicant = payload.get("applicant", {})
    job_id_external = payload.get("job_external_id") or payload.get("jobId")

    if not applicant or not job_id_external:
        raise HTTPException(status_code=400, detail=f"Malformed {board_key.title()} payload")

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

    email = applicant.get("email")
    first_name = applicant.get("firstName", board_key.title())
    last_name = applicant.get("lastName", "Applicant")

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
            source=board_key,
            title=applicant.get("jobTitle"),
        )
        db.add(candidate)
        await db.flush()
        log.info(
            f"candidate_created_from_{board_key}",
            email=email,
            tenant_id=str(target_tenant_id) if target_tenant_id else None,
        )

    existing_resume = (
        await db.execute(
            select(Resume.id).where(Resume.candidate_id == candidate.id, Resume.is_current.is_(True)).limit(1)
        )
    ).scalar_one_or_none()
    if not existing_resume:
        resume_b64 = applicant.get("resumeBase64") or applicant.get("resume_base64")
        resume_text = str(applicant.get("resumeText") or applicant.get("resume_text") or "").strip()
        resume_uuid = uuid.uuid4()
        safe_slug = re.sub(r"[^a-zA-Z0-9_-]", "_", f"{first_name}_{last_name}".lower())[:40] or "applicant"
        file_name = applicant.get("resumeFileName") or f"{safe_slug}_{board_key}.pdf"
        content_bytes: bytes
        if isinstance(resume_b64, str) and resume_b64.strip():
            try:
                content_bytes = base64.b64decode(resume_b64, validate=True)
            except Exception:
                content_bytes, resume_text = ResumeParserService.generate_candidate_pdf_dossier(
                    {
                        "full_name": f"{first_name} {last_name}".strip(),
                        "email": email,
                        "title": applicant.get("jobTitle") or "Applicant",
                        "source": board_key,
                        "summary": resume_text,
                    }
                )
        else:
            content_bytes, generated_text = ResumeParserService.generate_candidate_pdf_dossier(
                {
                    "full_name": f"{first_name} {last_name}".strip(),
                    "email": email,
                    "title": applicant.get("jobTitle") or "Applicant",
                    "source": board_key,
                    "summary": resume_text,
                }
            )
            resume_text = resume_text or generated_text

        file_url = ResumeParserService.save_resume_file(
            str(candidate.id), str(resume_uuid), str(file_name), content_bytes
        )
        db.add(
            Resume(
                id=resume_uuid,
                tenant_id=target_tenant_id,
                candidate_id=candidate.id,
                file_name=str(file_name),
                file_url=file_url,
                raw_text=resume_text,
                parsed_data={"source": board_key, "name": f"{first_name} {last_name}".strip()},
                is_current=True,
            )
        )

    await db.commit()
    return {"status": "success", "candidate_id": str(candidate.id), "source": board_key}


@router.post("/monster/applications")
async def monster_application_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Accepts Easy Apply applications and resumes from Monster.com."""
    return await _ingest_job_board_application("monster", request, db)


@router.post("/dice/applications")
async def dice_application_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Accepts Easy Apply applications and resumes from Dice.com."""
    return await _ingest_job_board_application("dice", request, db)

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
    is_testing_bypass = os.getenv("TESTING", "").strip().lower() == "true" and not settings.is_production
    if secret or not is_testing_bypass:
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
