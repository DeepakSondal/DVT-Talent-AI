"""
DVT Talent AI — Social Authentication (OAuth2)
Handlers for Google, GitHub, and LinkedIn
"""
import uuid

import structlog
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import create_access_token, create_refresh_token
from config import settings
from db.models import Tenant, User, get_db

log = structlog.get_logger()
router = APIRouter()

oauth = OAuth()

# ── Providers Registration ───────────────────────────────────────────────
oauth.register(
    name="google",
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)

oauth.register(
    name="github",
    client_id=settings.github_client_id,
    client_secret=settings.github_client_secret,
    access_token_url="https://github.com/login/oauth/access_token",  # noqa: S106
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)

oauth.register(
    name="linkedin",
    client_id=settings.linkedin_client_id,
    client_secret=settings.linkedin_client_secret,
    access_token_url="https://www.linkedin.com/oauth/v2/accessToken",  # noqa: S106
    authorize_url="https://www.linkedin.com/oauth/v2/authorization",
    api_base_url="https://api.linkedin.com/v2/",
    client_kwargs={"scope": "openid email profile"},
)

# ── Routes ───────────────────────────────────────────────────────────────

@router.get("/login/{provider}")
async def social_login(provider: str, request: Request):
    """Initiate social login redirect"""
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    redirect_uri = f"{settings.app_base_url}/api/v1/auth/callback/{provider}"
    return await client.authorize_redirect(request, redirect_uri)

@router.get("/callback/{provider}")
async def social_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Handle social login callback"""
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")

    try:
        token = await client.authorize_access_token(request)
    except Exception as e:
        log.error("oauth_token_error", provider=provider, error=str(e))
        raise HTTPException(status_code=401, detail="Authentication failed") from e

    # Get user details from provider
    user_info = None
    email_verified = True
    if provider == "google":
        user_info = token.get("userinfo")
        if user_info and user_info.get("email_verified") is False:
            email_verified = False
    elif provider == "github":
        resp = await client.get("user", token=token)
        user_info = resp.json()
        emails_resp = await client.get("user/emails", token=token)
        emails = emails_resp.json() if emails_resp else []
        verified_emails = [
            e for e in (emails if isinstance(emails, list) else [])
            if isinstance(e, dict) and e.get("verified") and e.get("email")
        ]
        if verified_emails:
            primary_email = next((e["email"] for e in verified_emails if e.get("primary")), verified_emails[0]["email"])
            user_info["email"] = primary_email
        elif not user_info.get("email"):
            email_verified = False
    elif provider == "linkedin":
        # New LinkedIn V2 userinfo endpoint (OpenID Connect)
        resp = await client.get("https://api.linkedin.com/v2/userinfo", token=token)
        user_info = resp.json()
        # LinkedIn uses 'sub' instead of 'id' in OIDC
        user_info["id"] = user_info.get("sub")
        if user_info.get("email_verified") is False:
            email_verified = False

    if not user_info or not user_info.get("email") or not email_verified:
        raise HTTPException(status_code=400, detail="Failed to fetch verified user email from provider")

    email = user_info["email"].strip().lower()
    provider_id = str(user_info.get("id") or user_info.get("sub"))

    # Find or Create User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        # Find or create a default workspace tenant for the new social user
        email_domain = email.split("@")[-1].lower()
        common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
        existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
        tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

        full_name = user_info.get("name") or user_info.get("login") or email.split("@")[0]
        tenant = Tenant(
            name=f"{full_name}'s Workspace",
            domain=tenant_domain,
            is_active=True
        )
        db.add(tenant)
        await db.flush()

        # Create new social user
        user = User(
            email=email,
            full_name=full_name,
            provider=provider,
            provider_id=provider_id,
            is_active=True,
            tenant_id=tenant.id,
            hashed_password="oauth_managed_no_password",  # noqa: S106
        )
        db.add(user)
        log.info("social_user_created", email=email, provider=provider)
    else:
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Account is disabled")
        if not user.provider:
            user.provider = provider
            user.provider_id = provider_id
            log.info("social_user_linked", email=email, provider=provider)

    await db.commit()
    await db.refresh(user)

    # Auto-link workspace OAuth email sender only when Gmail send scope was actually granted
    if provider == "google" and user.tenant_id:
        tenant_obj = await db.get(Tenant, user.tenant_id)
        granted_scope = str(token.get("scope", "")) if isinstance(token, dict) else ""
        raw_access = token.get("access_token") if isinstance(token, dict) else None
        if tenant_obj and not tenant_obj.sender_email and raw_access and "gmail.send" in granted_scope:
            from datetime import datetime, timezone

            from services.security_service import encrypt_pii

            raw_refresh = token.get("refresh_token") if isinstance(token, dict) else None
            t_settings = dict(tenant_obj.settings) if isinstance(tenant_obj.settings, dict) else {}
            t_settings["email_oauth"] = {
                "provider": "google",
                "access_token_encrypted": encrypt_pii(raw_access),
                "refresh_token_encrypted": encrypt_pii(raw_refresh) if raw_refresh else None,
                "connected_at": datetime.now(timezone.utc).isoformat(),
                "sender_email": email,
                "sender_name": user.full_name,
            }
            tenant_obj.settings = t_settings
            tenant_obj.sender_email = email
            tenant_obj.sender_name = user.full_name
            tenant_obj.sender_verified = True
            await db.commit()

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    token_data = {
        "sub": str(user.id),
        "role": role_str,
        "tenant_id": str(user.tenant_id) if user.tenant_id else "",
    }
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    target_dest = "/portal" if role_str == "candidate" else "/dashboard"
    redirect_url = (
        f"{settings.frontend_url}/auth/callback"
        f"?redirect={target_dest}&role={role_str}&tenant_id={token_data['tenant_id']}"
    )
    response = RedirectResponse(url=redirect_url, status_code=302)

    response.set_cookie(
        key="dvt_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        expires=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=settings.is_production,
    )
    response.set_cookie(
        key="dvt_refresh_token",
        value=refresh_token,
        httponly=True,
        path="/",
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=settings.is_production,
    )

    log.info("social_login_success", email=email, provider=provider)
    return response
