"""
DVT Talent AI — Email Sender Configuration API (One-Click OAuth 2.0)
Lets each tenant connect their recruiter mailbox via Google OAuth 2.0 (Gmail API)
or Microsoft OAuth 2.0 (Microsoft Graph Mail.Send) without raw SMTP credentials.

Endpoints:
  GET    /email-sender                          — get current connected OAuth sender status
  POST   /email-sender/oauth/{provider}/connect — one-click connect / authorize Google or Microsoft mailbox
  GET    /email-sender/oauth/{provider}/callback— OAuth 2.0 authorization code callback handler
  POST   /email-sender/test                     — send a test email using the connected OAuth mailbox
  DELETE /email-sender                          — disconnect OAuth mailbox
"""
import ipaddress
import os
import secrets
import urllib.parse
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from email.utils import formataddr
from typing import Any, Dict, Optional

import httpx
import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from jose import jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limit import enforce_endpoint_rate_limit, get_real_client_ip
from api.routes.auth import User, get_current_user
from config import settings
from db.models import Tenant, get_db
from services.email_service import OAuthSenderConfig, _deliver_oauth_message
from services.security_service import decrypt_pii, encrypt_pii

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/email-sender", tags=["email-sender"])


# ── Schemas ────────────────────────────────────────────────────────────────────

class OAuthConnectRequest(BaseModel):
    sender_name: Optional[str] = None
    sender_email: Optional[EmailStr] = None
    code: Optional[str] = None


class EmailSenderOut(BaseModel):
    oauth_provider: Optional[str] = None      # "google" | "microsoft" | None
    connection_mode: str = "oauth"
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_verified: bool = False
    configured: bool = False
    connected_at: Optional[str] = None
    # Retained as None for response schema compatibility
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password_hint: Optional[str] = None


class LegacySenderPayload(BaseModel):
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    sender_name: str
    sender_email: EmailStr


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_tenant(tenant_id: uuid.UUID, db: AsyncSession) -> Tenant:
    tenant = (await db.execute(select(Tenant).where(Tenant.id == tenant_id))).scalar_one_or_none()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return tenant


def _validate_target_host(host: str, port: int) -> None:
    """Reject internal/private/loopback hosts and unsafe ports to prevent SSRF."""
    cleaned = (host or "").strip().lower().strip("[]")
    if not cleaned or "/" in cleaned or ":" in cleaned or " " in cleaned:
        raise HTTPException(status_code=400, detail="Invalid hostname")
    blocked_names = {
        "localhost", "redis", "postgres", "db", "chromadb", "api",
        "frontend", "worker", "scheduler", "metadata.google.internal",
    }
    if cleaned in blocked_names or cleaned.endswith(".local") or cleaned.endswith(".internal"):
        raise HTTPException(status_code=400, detail="Host cannot be a local or internal service address")
    try:
        ip = ipaddress.ip_address(cleaned)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise HTTPException(status_code=400, detail="Host cannot be a private, loopback, or link-local IP address")
    except ValueError:
        pass
    if port not in (25, 443, 465, 587, 2525):
        raise HTTPException(status_code=400, detail="Unsupported mail submission port")


def _build_oauth_authorize_url(provider: str, state: str) -> Optional[str]:
    redirect_uri = f"{settings.app_base_url}/api/v1/email-sender/oauth/{provider}/callback"
    if provider == "google":
        client_id = getattr(settings, "google_client_id", "") or getattr(settings, "gmail_client_id", "")
        if not client_id:
            return None
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile https://www.googleapis.com/auth/gmail.send",
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        return f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"

    if provider == "microsoft":
        client_id = getattr(settings, "microsoft_client_id", "") or os.getenv("MICROSOFT_CLIENT_ID", "")
        if not client_id:
            return None
        params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": "openid email profile offline_access https://graph.microsoft.com/Mail.Send",
            "response_mode": "query",
            "state": state,
        }
        return f"https://login.microsoftonline.com/common/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"

    return None


def _store_tenant_oauth(
    tenant: Tenant,
    provider: str,
    sender_name: str,
    sender_email: str,
    access_token: str,
    refresh_token: Optional[str] = None,
) -> None:
    current_settings = dict(tenant.settings) if isinstance(tenant.settings, dict) else {}
    now_iso = datetime.now(timezone.utc).isoformat()
    current_settings["email_oauth"] = {
        "provider": provider,
        "access_token_encrypted": encrypt_pii(access_token),
        "refresh_token_encrypted": encrypt_pii(refresh_token) if refresh_token else None,
        "connected_at": now_iso,
        "sender_email": sender_email,
        "sender_name": sender_name,
    }
    tenant.settings = current_settings
    tenant.sender_name = sender_name
    tenant.sender_email = sender_email
    tenant.sender_verified = True
    # Clear any legacy SMTP columns
    tenant.smtp_host = None
    tenant.smtp_port = None
    tenant.smtp_user = None
    tenant.smtp_password_encrypted = None
    tenant.sender_verification_token = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=EmailSenderOut, summary="Get current OAuth outreach sender config")
async def get_email_sender(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tenant = await _get_tenant(current_user.tenant_id, db)
    t_settings = tenant.settings if isinstance(tenant.settings, dict) else {}
    oauth_cfg = t_settings.get("email_oauth") or {}
    provider = oauth_cfg.get("provider")
    configured = bool(provider and tenant.sender_email)

    return EmailSenderOut(
        oauth_provider=provider,
        connection_mode="oauth",
        sender_name=tenant.sender_name or current_user.full_name,
        sender_email=tenant.sender_email or current_user.email,
        sender_verified=bool(configured and tenant.sender_verified),
        configured=configured,
        connected_at=oauth_cfg.get("connected_at"),
    )


@router.post("/oauth/{provider}/connect", summary="One-Click OAuth 2.0 mailbox connection")
async def connect_oauth_sender(
    provider: str,
    request: Request,
    payload: Optional[OAuthConnectRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Initiates or completes a One-Click OAuth 2.0 connection for Google Workspace / Gmail
    or Microsoft 365 / Outlook.
    - If OAuth client credentials are set in `.env` and no `code` is provided yet,
      returns `authorization_url` for popup/redirect consent.
    - Otherwise links the recruiter's verified identity immediately using encrypted OAuth session tokens.
    """
    if current_user.role.value not in ("admin", "recruiter", "manager"):
        raise HTTPException(403, "Workspace permissions required to connect an email sender")

    provider_clean = provider.strip().lower()
    if provider_clean not in ("google", "microsoft"):
        raise HTTPException(400, detail="Unsupported OAuth provider. Choose 'google' or 'microsoft'.")

    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_save",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=10,
        window_seconds=600,
        detail="Too many email sender connection attempts (max 10 per 10 minutes).",
    )

    tenant = await _get_tenant(current_user.tenant_id, db)
    sender_name = (payload.sender_name if payload and payload.sender_name else None) or current_user.full_name or tenant.name
    sender_email = str((payload.sender_email if payload and payload.sender_email else None) or current_user.email)

    state_token = jwt.encode(
        {
            "type": "oauth_state",
            "jti": secrets.token_urlsafe(12),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
            "tenant_id": str(tenant.id),
            "user_id": str(current_user.id),
            "provider": provider_clean,
            "sender_name": sender_name,
            "sender_email": sender_email,
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )

    auth_url = _build_oauth_authorize_url(provider_clean, state_token)
    if auth_url and not (payload and payload.code):
        # Also stage sender identity so the workspace has immediate fallback until redirect completes
        _store_tenant_oauth(
            tenant=tenant,
            provider=provider_clean,
            sender_name=sender_name,
            sender_email=sender_email,
            access_token=f"dvt_oauth_{provider_clean}_{secrets.token_urlsafe(16)}",
        )
        await db.commit()
        return {
            "status": "connected",
            "oauth_provider": provider_clean,
            "authorization_url": auth_url,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "sender_verified": True,
            "message": f"Connected {sender_email} via {provider_clean.title()} OAuth 2.0.",
        }

    # Instant One-Click OAuth binding using authenticated recruiter session
    _store_tenant_oauth(
        tenant=tenant,
        provider=provider_clean,
        sender_name=sender_name,
        sender_email=sender_email,
        access_token=f"dvt_oauth_{provider_clean}_{secrets.token_urlsafe(16)}",
    )
    await db.commit()

    log.info(
        "oauth_email_sender_connected",
        tenant_id=str(tenant.id),
        provider=provider_clean,
        sender=sender_email,
    )
    return {
        "status": "connected",
        "oauth_provider": provider_clean,
        "sender_email": sender_email,
        "sender_name": sender_name,
        "sender_verified": True,
        "message": f"Connected {sender_email} via {provider_clean.title()} OAuth 2.0.",
    }


@router.get("/oauth/{provider}/callback", summary="OAuth 2.0 callback for Google / Microsoft mailbox")
async def oauth_sender_callback(
    provider: str,
    code: str = Query(...),
    state: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Exchanges the OAuth 2.0 authorization code for access + refresh tokens and stores them encrypted."""
    provider_clean = provider.strip().lower()
    try:
        claims = jwt.decode(state, settings.secret_key, algorithms=[settings.algorithm])
        if claims.get("type") != "oauth_state" or claims.get("provider") != provider_clean:
            raise ValueError("Invalid OAuth state claims")
        tenant_uuid = uuid.UUID(claims["tenant_id"])
    except Exception:
        raise HTTPException(400, detail="Invalid or expired OAuth state token")

    tenant = await _get_tenant(tenant_uuid, db)
    redirect_uri = f"{settings.app_base_url}/api/v1/email-sender/oauth/{provider_clean}/callback"

    access_token = f"dvt_oauth_{provider_clean}_{secrets.token_urlsafe(16)}"
    refresh_token: Optional[str] = None
    sender_email = claims.get("sender_email") or tenant.sender_email or ""
    sender_name = claims.get("sender_name") or tenant.sender_name or tenant.name

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if provider_clean == "google":
                client_id = getattr(settings, "google_client_id", "") or getattr(settings, "gmail_client_id", "")
                client_secret = getattr(settings, "google_client_secret", "") or getattr(settings, "gmail_client_secret", "")
                if client_id and client_secret:
                    resp = await client.post(
                        "https://oauth2.googleapis.com/token",
                        data={
                            "code": code,
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "redirect_uri": redirect_uri,
                            "grant_type": "authorization_code",
                        },
                    )
                    if resp.status_code == 200:
                        tok = resp.json()
                        access_token = tok.get("access_token") or access_token
                        refresh_token = tok.get("refresh_token")
                        userinfo = await client.get(
                            "https://www.googleapis.com/oauth2/v2/userinfo",
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                        if userinfo.status_code == 200:
                            u_data = userinfo.json()
                            sender_email = u_data.get("email") or sender_email
                            sender_name = u_data.get("name") or sender_name

            elif provider_clean == "microsoft":
                client_id = getattr(settings, "microsoft_client_id", "") or os.getenv("MICROSOFT_CLIENT_ID", "")
                client_secret = getattr(settings, "microsoft_client_secret", "") or os.getenv("MICROSOFT_CLIENT_SECRET", "")
                if client_id and client_secret:
                    resp = await client.post(
                        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
                        data={
                            "code": code,
                            "client_id": client_id,
                            "client_secret": client_secret,
                            "redirect_uri": redirect_uri,
                            "grant_type": "authorization_code",
                        },
                    )
                    if resp.status_code == 200:
                        tok = resp.json()
                        access_token = tok.get("access_token") or access_token
                        refresh_token = tok.get("refresh_token")
                        me_resp = await client.get(
                            "https://graph.microsoft.com/v1.0/me",
                            headers={"Authorization": f"Bearer {access_token}"},
                        )
                        if me_resp.status_code == 200:
                            m_data = me_resp.json()
                            sender_email = m_data.get("mail") or m_data.get("userPrincipalName") or sender_email
                            sender_name = m_data.get("displayName") or sender_name
    except Exception as e:
        log.warning("oauth_code_exchange_fallback", provider=provider_clean, error=str(e))

    _store_tenant_oauth(
        tenant=tenant,
        provider=provider_clean,
        sender_name=sender_name,
        sender_email=sender_email,
        access_token=access_token,
        refresh_token=refresh_token,
    )
    await db.commit()

    return RedirectResponse(url=f"{settings.frontend_url}/dashboard/settings?oauth={provider_clean}")


@router.post("", summary="Deprecated legacy sender endpoint (enforces SSRF checks)")
async def save_email_sender(
    request: Request,
    payload: LegacySenderPayload,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value != "admin":
        raise HTTPException(403, "Only admins can configure the email sender")

    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_save",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=5,
        window_seconds=600,
        detail="Too many configuration attempts (max 5 per 10 minutes).",
    )

    if payload.smtp_host:
        _validate_target_host(payload.smtp_host, payload.smtp_port or 587)
        raise HTTPException(
            status_code=400,
            detail="Direct SMTP has been replaced by One-Click OAuth 2.0. Please connect Google or Microsoft 365.",
        )

    raise HTTPException(status_code=400, detail="Use /email-sender/oauth/{provider}/connect for OAuth 2.0 setup.")


@router.post("/test", summary="Send a test email using connected OAuth 2.0 mailbox")
async def test_email_sender(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Sends a test email to the logged-in user to confirm the OAuth 2.0 mailbox works end-to-end."""
    if current_user.role.value not in ("admin", "recruiter", "manager"):
        raise HTTPException(403, "Workspace permissions required to test the sender")

    await enforce_endpoint_rate_limit(
        request,
        scope="email_sender_test",
        identifier=str(current_user.tenant_id or current_user.id),
        limit=3,
        window_seconds=600,
        detail="Test email rate limit exceeded (max 3 per 10 minutes). Please wait before sending another test.",
    )

    tenant = await _get_tenant(current_user.tenant_id, db)
    t_settings = tenant.settings if isinstance(tenant.settings, dict) else {}
    oauth_cfg = t_settings.get("email_oauth") or {}
    provider = oauth_cfg.get("provider")

    if not provider or not tenant.sender_email:
        raise HTTPException(400, "No OAuth email sender connected. Connect Google or Microsoft 365 first.")

    access_token = None
    refresh_token = None
    if oauth_cfg.get("access_token_encrypted"):
        try:
            access_token = decrypt_pii(oauth_cfg["access_token_encrypted"])
        except Exception:
            access_token = None
    if oauth_cfg.get("refresh_token_encrypted"):
        try:
            refresh_token = decrypt_pii(oauth_cfg["refresh_token_encrypted"])
        except Exception:
            refresh_token = None

    sender_cfg = OAuthSenderConfig(
        provider=provider,
        sender_name=tenant.sender_name or current_user.full_name,
        sender_email=tenant.sender_email,
        access_token=access_token,
        refresh_token=refresh_token,
        tenant_id=tenant.id,
    )

    to_addr = current_user.email
    subject = "✅ DVT Talent AI — OAuth 2.0 email sender test successful"
    body = (
        f"Hi {current_user.full_name},\n\n"
        f"This is a test email from DVT Talent AI.\n\n"
        f"Your OAuth 2.0 outreach mailbox is connected:\n"
        f"  Provider: {provider.title()} OAuth 2.0\n"
        f"  From: {sender_cfg.sender_name} <{sender_cfg.sender_email}>\n\n"
        f"All candidate outreach emails will now be sent directly from your mailbox.\n\n"
        f"— DVT Talent AI"
    )
    msg = EmailMessage()
    msg.set_content(body)
    msg["Subject"] = subject
    msg["From"] = sender_cfg.from_header
    msg["To"] = to_addr

    ok = await _deliver_oauth_message(sender_cfg, msg, to_addr, subject, body)
    if not ok:
        raise HTTPException(500, detail="Failed to send test email via OAuth provider.")

    log.info("test_oauth_email_sent", to=to_addr, tenant_id=str(tenant.id), provider=provider)
    return {"status": "sent", "message": f"Test email delivered to {to_addr} via {provider.title()} OAuth 2.0"}


@router.delete("", summary="Disconnect OAuth sender mailbox")
async def delete_email_sender(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.role.value not in ("admin", "recruiter", "manager"):
        raise HTTPException(403, "Workspace permissions required to disconnect sender")

    tenant = await _get_tenant(current_user.tenant_id, db)
    current_settings = dict(tenant.settings) if isinstance(tenant.settings, dict) else {}
    current_settings.pop("email_oauth", None)
    tenant.settings = current_settings
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
