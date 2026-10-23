"""
DVT Talent AI — Email Service (Per-Tenant SMTP)
Every tenant sends outreach from their own email address.
Falls back to the system SMTP only if tenant has no sender configured.
"""
import smtplib
import secrets
import uuid
from email.message import EmailMessage
from email.utils import formataddr
from typing import Optional, Dict, Any
from datetime import datetime, timezone
import structlog

from sqlalchemy import select

try:
    from db.models import AsyncSessionLocal, EmailSent, EmailStatus, Tenant
    from config import settings
    from services.security_service import encrypt_pii, decrypt_pii
except ImportError:
    from db.models import AsyncSessionLocal, EmailSent, EmailStatus, Tenant
    from config import settings
    from services.security_service import encrypt_pii, decrypt_pii

log = structlog.get_logger()


# ── SMTP Config Resolution ─────────────────────────────────────────────────────

class SMTPConfig:
    """Resolved SMTP settings for a single send operation."""
    def __init__(self, host: str, port: int, user: str, password: str,
                 sender_name: str, sender_email: str):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.sender_name = sender_name
        self.sender_email = sender_email

    @property
    def from_header(self) -> str:
        return formataddr((self.sender_name, self.sender_email))


async def _get_tenant_smtp(tenant_id: uuid.UUID) -> Optional[SMTPConfig]:
    """Load and decrypt the SMTP config for a given tenant."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Tenant).where(Tenant.id == tenant_id))
        tenant = result.scalar_one_or_none()

    if not tenant or not tenant.smtp_user or not tenant.smtp_password_encrypted:
        return None

    decrypted_password = decrypt_pii(tenant.smtp_password_encrypted)
    return SMTPConfig(
        host=tenant.smtp_host or "smtp.gmail.com",
        port=tenant.smtp_port or 587,
        user=tenant.smtp_user,
        password=decrypted_password,
        sender_name=tenant.sender_name or tenant.smtp_user,
        sender_email=tenant.sender_email or tenant.smtp_user,
    )


def _get_system_smtp() -> Optional[SMTPConfig]:
    """Fallback to system-level SMTP from environment variables."""
    user = settings.smtp_user if hasattr(settings, "smtp_user") else None
    password = settings.smtp_pass if hasattr(settings, "smtp_pass") else None
    if not user or not password:
        return None
    return SMTPConfig(
        host=getattr(settings, "smtp_host", "smtp.gmail.com"),
        port=int(getattr(settings, "smtp_port", 587)),
        user=user,
        password=password,
        sender_name="DVT Talent AI",
        sender_email=user,
    )


# ── Core Email Service ─────────────────────────────────────────────────────────

class EmailService:
    async def send_email(
        self,
        email_id: str,
        to_address: str,
        subject: str,
        body: str,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Send an outreach email.
        Uses tenant SMTP if configured and verified; falls back to system SMTP.
        """
        # 1. Resolve which SMTP to use
        smtp_cfg: Optional[SMTPConfig] = None
        if tenant_id:
            smtp_cfg = await _get_tenant_smtp(tenant_id)
            if smtp_cfg:
                log.info("using_tenant_smtp", tenant_id=str(tenant_id), sender=smtp_cfg.sender_email)

        if not smtp_cfg:
            smtp_cfg = _get_system_smtp()
            if smtp_cfg:
                log.info("using_system_smtp_fallback", email_id=email_id)

        if not smtp_cfg:
            log.warning("no_smtp_configured", email_id=email_id,
                        detail="Add SMTP credentials in Settings → Email Sender")
            return False

        # 2. Build message
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = smtp_cfg.from_header
        msg["To"] = to_address
        msg["Message-ID"] = f"<{email_id}@dvt-talent-ai.com>"
        msg["In-Reply-To"] = msg["Message-ID"]
        msg["References"] = msg["Message-ID"]
        # CAN-SPAM compliance header — unsubscribe handled at application level
        msg["List-Unsubscribe"] = f"<{settings.app_base_url}/unsubscribe?email_id={email_id}>"

        # 3. Send via SMTP
        try:
            with smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_cfg.user, smtp_cfg.password)
                server.send_message(msg)

            # 4. Update DB status
            async with AsyncSessionLocal() as session:
                result = await session.execute(
                    select(EmailSent).where(EmailSent.id == email_id)
                )
                email_obj = result.scalar_one_or_none()
                if email_obj:
                    email_obj.status = EmailStatus.SENT
                    email_obj.sent_at = datetime.now(timezone.utc)
                    email_obj.gmail_message_id = msg["Message-ID"]
                    await session.commit()

            log.info("email_sent", email_id=email_id, to=to_address,
                     from_addr=smtp_cfg.sender_email)
            return True

        except smtplib.SMTPAuthenticationError:
            log.error("smtp_auth_failed", email_id=email_id, user=smtp_cfg.user,
                      detail="Check SMTP credentials in Settings → Email Sender")
            return False
        except smtplib.SMTPRecipientsRefused:
            log.error("smtp_recipient_refused", email_id=email_id, to=to_address)
            return False
        except Exception as e:
            log.error("email_send_failed", error=str(e), email_id=email_id)
            return False

    async def send_verification_email(
        self, to_address: str, sender_name: str, token: str
    ) -> bool:
        """Send the email address verification link to the configured sender address."""
        verify_url = f"{settings.app_base_url}/api/v1/email-sender/verify?token={token}"
        body = (
            f"Hi {sender_name},\n\n"
            f"Click the link below to verify this email address as your DVT Talent AI outreach sender:\n\n"
            f"{verify_url}\n\n"
            f"This link expires in 24 hours.\n\n"
            f"— DVT Talent AI"
        )
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = "Verify your outreach email address — DVT Talent AI"
        msg["From"] = f"DVT Talent AI <{getattr(settings, 'smtp_user', 'noreply@dvttalent.com')}>"
        msg["To"] = to_address

        sys = _get_system_smtp()
        if not sys:
            log.warning("no_system_smtp_for_verification")
            return False
        try:
            with smtplib.SMTP(sys.host, sys.port, timeout=15) as server:
                server.starttls()
                server.login(sys.user, sys.password)
                server.send_message(msg)
            log.info("verification_email_sent", to=to_address)
            return True
        except Exception as e:
            log.error("verification_email_failed", error=str(e))
            return False

    async def send_team_invitation_email(
        self,
        to_address: str,
        tenant_name: str,
        inviter_name: str,
        invite_token: str,
        role: str,
        tenant_id: Optional[uuid.UUID] = None,
    ) -> bool:
        """
        Send a single-use team invitation link.
        Uses tenant SMTP if configured; falls back to system SMTP.
        Returns True if delivery succeeded, False if SMTP unconfigured or failed.
        """
        accept_url = f"{settings.app_base_url}/invite/accept?token={invite_token}"
        body = (
            f"Hello,\n\n"
            f"{inviter_name} has invited you to join {tenant_name} on DVT Talent AI as a {role}.\n\n"
            f"Click the link below to accept the invitation and set up your password:\n\n"
            f"{accept_url}\n\n"
            f"This link is single-use and will expire in 48 hours.\n\n"
            f"If you were not expecting this invitation, you can safely ignore this email.\n\n"
            f"— DVT Talent AI Team"
        )
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = f"Invitation to join {tenant_name} on DVT Talent AI"
        msg["To"] = to_address

        # 1. Resolve SMTP config
        smtp_cfg: Optional[SMTPConfig] = None
        if tenant_id:
            smtp_cfg = await _get_tenant_smtp(tenant_id)

        if not smtp_cfg:
            smtp_cfg = _get_system_smtp()

        if not smtp_cfg:
            log.warning("no_smtp_configured_for_invitation", to=to_address, tenant_id=str(tenant_id) if tenant_id else None)
            return False

        msg["From"] = smtp_cfg.from_header

        try:
            with smtplib.SMTP(smtp_cfg.host, smtp_cfg.port, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(smtp_cfg.user, smtp_cfg.password)
                server.send_message(msg)
            log.info("team_invitation_email_sent", to=to_address, tenant_id=str(tenant_id) if tenant_id else None)
            return True
        except Exception as e:
            log.error("team_invitation_email_failed", to=to_address, error=str(e))
            return False

    async def process_incoming_webhook(self, payload: Dict[str, Any]) -> bool:
        """Track email replies via webhook (SendGrid Inbound Parse / Gmail Watcher)."""
        headers = payload.get("Headers", {})
        if isinstance(headers, list):
            headers = {h.get("Name"): h.get("Value") for h in headers}

        in_reply_to = headers.get("In-Reply-To")
        if not in_reply_to:
            log.warning("unmatched_reply", msg="No In-Reply-To header found")
            return False

        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(EmailSent).where(EmailSent.gmail_message_id == in_reply_to)
            )
            email_obj = result.scalar_one_or_none()
            if email_obj and email_obj.status != EmailStatus.REPLIED:
                email_obj.status = EmailStatus.REPLIED
                email_obj.replied_at = datetime.now(timezone.utc)
                await session.commit()
                log.info("email_reply_tracked", email_id=email_obj.id)
                return True

        return False

email_service = EmailService()
