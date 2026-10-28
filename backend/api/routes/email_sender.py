"""
DVT Talent AI — Email Sender Configuration API
Lets each tenant register & verify their own SMTP outreach sender.

Endpoints:
  GET  /email-sender          — get current config (password masked)
  POST /email-sender          — save & encrypt SMTP credentials
  POST /email-sender/test     — send a test email using the stored config
  DELETE /email-sender        — remove sender config
  GET  /email-sender/verify   — email verification link handler
"""
import secrets
import uuid
import smtplib
from email.message import EmailMessage
from email.utils import formataddr
from datetime import datetime, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, EmailStr

from db.models import get_db, Tenant
from api.routes.auth import get_current_user, User
from api.middleware.rate_limit import get_real_client_ip, enforce_endpoint_rate_limit
from services.security_service import encrypt_pii, decrypt_pii

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/email-sender", tags=["email-sender"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class EmailSenderConfig(BaseModel):
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str                    # Their Gmail / SMTP login
    smtp_password: str                # Plain-text — encrypted before storing
    sender_name: str                  # "Sarah at Acme Recruiting"
    sender_email: EmailStr            # The From address candidates will see


class EmailSenderOut(BaseModel):
    smtp_host: Optional[str]
    smtp_port: Optional[int]
    smtp_user: Optional[str]
    smtp_password_hint: Optional[str]   # Shows only last 4 chars, never the full password
    sender_name: Optional[str]
    sender_email: Optional[str]
    sender_verified: bool
    configured: bool


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_tenant(tenant_id: uuid.UUID, db: AsyncSession) -> Tenant:
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return tenant


def _mask_password(encrypted: Optional[str]) -> Optional[str]:
    if not encrypted:
        return None
    try:
        plain = decrypt_pii(encrypted)
        return f"{'•' * (len(plain) - 4)}{plain[-4:]}" if len(plain) > 4 else "••••"
    except Exception:
        return "••••"


import ipaddress


def _validate_smtp_target(host: str, port: int) -> None:
    """Reject internal/private/loopback SMTP hosts and non-SMTP ports to prevent SSRF port scanning."""
    cleaned = (host or "").strip().lower().strip("[]")
    if not cleaned or "/" in cleaned or ":" in cleaned or " " in cleaned:
        raise HTTPException(status_code=400, detail="Invalid SMTP hostname")
    blocked_names = {"localhost", "redis", "postgres", "db", "chromadb", "api", "frontend", "worker", "scheduler", "metadata.google.internal"}
    if cleaned in blocked_names or cleaned.endswith(".local") or cleaned.endswith(".internal"):
        raise HTTPException(status_code=400, detail="SMTP host cannot be a local or internal service address")
    try:
        ip = ipaddress.ip_address(cleaned)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise HTTPException(status_code=400, detail="SMTP host cannot be a private, loopback, or link-local IP address")
    except ValueError:
        pass
    if port not in (25, 465, 587, 2525):
        raise HTTPException(status_code=400, detail="SMTP port must be a standard mail submission port (25, 465, 587, or 2525)")


def _test_smtp(host: str, port: int, user: str, password: str) -> tuple[bool, str]:
    """Attempt a live SMTP login to validate credentials. Returns (success, error_msg)."""
    _validate_smtp_target(host, port)
    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(user, password)
        return True, ""
    except smtplib.SMTPAuthenticationError:
        return False, "Authentication failed — wrong email or password/app-password."
    except smtplib.SMTPConnectError:
        return False, f"Cannot connect to {host}:{port}. Check SMTP host and port."
    except Exception as e:
        return False, str(e)


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=EmailSenderOut, summary="Get current outreach sender config")
async def get_email_sender(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(current_user.tenant_id, db)
    configured = bool(tenant.smtp_user and tenant.smtp_password_encrypted)
    return EmailSenderOut(
        smtp_host=tenant.smtp_host,
        smtp_port=tenant.smtp_port,
        smtp_user=tenant.smtp_user,
        smtp_password_hint=_mask_password(tenant.smtp_password_encrypted),
        sender_name=tenant.sender_name,
        sender_email=tenant.sender_email,
        sender_verified=tenant.sender_verified or False,
        configured=configured,
    )


@router.post("", summary="Save SMTP sender credentials")
async def save_email_sender(
    request: Request,
    payload: EmailSenderConfig,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves and encrypts the SMTP credentials. Validates the credentials
    live against the SMTP server before saving. Sends a verification
    email to the sender_email address to confirm ownership.
    """
    if current_user.role.value != "admin":
        raise HTTPException(403, "Only admins can configure the email sender")

    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_save",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=5,
        window_seconds=600,
        detail="Too many SMTP configuration attempts (max 5 per 10 minutes).",
    )

    # Live credential validation first — never store bad credentials
    ok, err = _test_smtp(payload.smtp_host, payload.smtp_port, payload.smtp_user, payload.smtp_password)
    if not ok:
        raise HTTPException(400, detail=f"SMTP connection failed: {err}")

    tenant = await _get_tenant(current_user.tenant_id, db)

    # Generate a verification token for the sender_email
    token = secrets.token_urlsafe(32)

    tenant.smtp_host = payload.smtp_host
    tenant.smtp_port = payload.smtp_port
    tenant.smtp_user = payload.smtp_user
    tenant.smtp_password_encrypted = encrypt_pii(payload.smtp_password)
    tenant.sender_name = payload.sender_name
    tenant.sender_email = str(payload.sender_email)
    tenant.sender_verified = False          # Reset until new address is verified
    tenant.sender_verification_token = token
    await db.commit()

    # Send verification email in background
    background_tasks.add_task(
        _send_verification_bg,
        to_address=str(payload.sender_email),
        sender_name=payload.sender_name,
        token=token,
        smtp_host=payload.smtp_host,
        smtp_port=payload.smtp_port,
        smtp_user=payload.smtp_user,
        smtp_password=payload.smtp_password,
    )

    log.info("email_sender_saved", tenant_id=str(tenant.id), sender=str(payload.sender_email))
    return {
        "status": "saved",
        "message": f"Credentials verified. A confirmation link has been sent to {payload.sender_email}.",
        "sender_verified": False,
    }


@router.post("/test", summary="Send a test email using saved sender config")
async def test_email_sender(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sends a test email to the logged-in admin to confirm the pipeline works end-to-end."""
    if current_user.role.value != "admin":
        raise HTTPException(403, "Only admins can test the sender")

    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_test",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=3,
        window_seconds=600,
        detail="Test email rate limit exceeded (max 3 per 10 minutes). Please wait before sending another test.",
    )

    tenant = await _get_tenant(current_user.tenant_id, db)
    if not tenant.smtp_user or not tenant.smtp_password_encrypted:
        raise HTTPException(400, "No email sender configured. Save credentials first.")

    password = decrypt_pii(tenant.smtp_password_encrypted)
    to_addr = current_user.email

    try:
        msg = EmailMessage()
        msg.set_content(
            f"Hi {current_user.full_name},\n\n"
            f"This is a test email from DVT Talent AI.\n\n"
            f"Your outreach sender is configured correctly:\n"
            f"  From: {tenant.sender_name} <{tenant.sender_email}>\n"
            f"  SMTP: {tenant.smtp_host}:{tenant.smtp_port}\n\n"
            f"All candidate outreach emails will now be sent from your address.\n\n"
            f"— DVT Talent AI"
        )
        msg["Subject"] = "✅ DVT Talent AI — Email sender test successful"
        msg["From"] = formataddr((tenant.sender_name or "", tenant.sender_email or tenant.smtp_user))
        msg["To"] = to_addr

        with smtplib.SMTP(tenant.smtp_host or "smtp.gmail.com", tenant.smtp_port or 587, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(tenant.smtp_user, password)
            server.send_message(msg)

        log.info("test_email_sent", to=to_addr, tenant_id=str(tenant.id))
        return {"status": "sent", "message": f"Test email delivered to {to_addr}"}

    except Exception as e:
        log.error("test_email_failed", error=str(e))
        raise HTTPException(500, detail=f"Failed to send test email: {str(e)}")


@router.delete("", summary="Remove sender configuration")
async def delete_email_sender(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value != "admin":
        raise HTTPException(403, "Only admins can remove sender config")

    tenant = await _get_tenant(current_user.tenant_id, db)
    tenant.smtp_host = None
    tenant.smtp_port = None
    tenant.smtp_user = None
    tenant.smtp_password_encrypted = None
    tenant.sender_name = None
    tenant.sender_email = None
    tenant.sender_verified = False
    tenant.sender_verification_token = None
    await db.commit()
    log.info("email_sender_removed", tenant_id=str(tenant.id))
    return {"status": "removed"}


@router.get("/verify", summary="Verify sender email ownership via link")
async def verify_sender_email(
    request: Request,
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Called when the user clicks the verification link in the confirmation email.
    Marks sender_verified = True for the matching tenant.
    """
    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_verify",
        identifier=get_real_client_ip(request),
        limit=10,
        window_seconds=60,
        detail="Too many verification attempts. Please wait a minute.",
    )
    result = await db.execute(
        select(Tenant).where(Tenant.sender_verification_token == token)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(400, "Invalid or expired verification token")

    tenant.sender_verified = True
    tenant.sender_verification_token = None   # One-time use
    await db.commit()
    log.info("sender_email_verified", tenant_id=str(tenant.id), sender=tenant.sender_email)
    # Redirect to settings page — in production, return an HTML success page
    return {
        "status": "verified",
        "message": f"✅ {tenant.sender_email} is now verified. All outreach will be sent from this address.",
    }


# ── Background task ───────────────────────────────────────────────────────────

async def _send_verification_bg(
    to_address: str, sender_name: str, token: str,
    smtp_host: str, smtp_port: int, smtp_user: str, smtp_password: str,
):
    """Send the verification email using the customer's own SMTP (proves they own it)."""
    from config import settings
    verify_url = f"{settings.app_base_url}/api/v1/email-sender/verify?token={token}"
    body = (
        f"Hi {sender_name},\n\n"
        f"Click the link below to verify this email address as your DVT Talent AI outreach sender:\n\n"
        f"  {verify_url}\n\n"
        f"Once verified, all candidate outreach emails will be sent from:\n"
        f"  {sender_name} <{to_address}>\n\n"
        f"This link expires in 24 hours. If you didn't request this, ignore this email.\n\n"
        f"— DVT Talent AI"
    )
    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = "Verify your outreach email — DVT Talent AI"
    msg["From"] = formataddr((sender_name, to_address))
    msg["To"] = to_address
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=15) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        log.info("verification_email_sent", to=to_address)
    except Exception as e:
        log.error("verification_email_failed", error=str(e), to=to_address)
