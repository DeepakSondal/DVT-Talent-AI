"""
DVT Talent AI — Social Authentication (OAuth2)
Handlers for Google, GitHub, and LinkedIn
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import structlog
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import create_access_token, create_refresh_token
from config import settings
from db.models import Tenant, User, get_db
from services.email_service import email_service
from services.redis_service import consume_oauth_link_nonce, store_oauth_link_nonce

log = structlog.get_logger()
router = APIRouter()

oauth = OAuth()
_OAUTH_LINK_TTL_SECONDS = 900

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

# ── Helpers & Schemas ────────────────────────────────────────────────────

class LinkOAuthRequest(BaseModel):
    token: str


def _select_verified_primary_email(
    provider: str,
    user_info: Optional[Dict[str, Any]],
    emails: Optional[List[Any]] = None,
) -> str:
    """
    Fail-closed selection of a verified primary email address from an OAuth provider.

    - GitHub: requires an entry in /user/emails with both verified is True AND primary is True.
    - Google / LinkedIn (OIDC userinfo): requires email_verified is True AND non-empty email.
    """
    if provider == "github":
        if isinstance(emails, list):
            for entry in emails:
                if (
                    isinstance(entry, dict)
                    and entry.get("verified") is True
                    and entry.get("primary") is True
                    and isinstance(entry.get("email"), str)
                    and entry["email"].strip()
                ):
                    return entry["email"].strip().lower()
        raise HTTPException(
            status_code=400,
            detail="Failed to fetch verified primary user email from provider",
        )

    if provider in ("google", "linkedin"):
        # LinkedIn OIDC (/v2/userinfo) returns `email_verified` as a boolean when the
        # member's primary email is verified — if absent or not True, treated as
        # unverified and login is rejected with 400 (see P0-2b commit body). If product
        # decides to allow unverified-LinkedIn signups with mandatory email-link
        # confirmation, route to /auth/link-oauth instead of raising 400.
        if (
            isinstance(user_info, dict)
            and user_info.get("email_verified") is True
            and isinstance(user_info.get("email"), str)
            and user_info["email"].strip()
        ):
            return user_info["email"].strip().lower()
        raise HTTPException(
            status_code=400,
            detail="Failed to fetch verified user email from provider",
        )

    raise HTTPException(status_code=400, detail="Invalid provider")


async def _issue_oauth_link_token(
    user_id: uuid.UUID,
    provider: str,
    provider_id: str,
    email: str,
) -> str:
    """Create a short-lived signed single-use token authorizing OAuth provider linking."""
    jti = secrets.token_urlsafe(24)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=_OAUTH_LINK_TTL_SECONDS)
    payload_json = json.dumps(
        {
            "user_id": str(user_id),
            "provider": provider,
            "provider_id": provider_id,
            "email": email,
        }
    )
    await store_oauth_link_nonce(jti, payload_json, ttl_seconds=_OAUTH_LINK_TTL_SECONDS)
    claims = {
        "sub": str(user_id),
        "provider": provider,
        "provider_id": provider_id,
        "email": email,
        "jti": jti,
        "type": "oauth_link",
        "exp": expires_at,
    }
    return jwt.encode(claims, settings.secret_key, algorithm=settings.algorithm)


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

    # Validate OAuth state/nonce against session BEFORE any DB read or write
    try:
        token = await client.authorize_access_token(request)
    except Exception as e:
        log.error("oauth_token_error", provider=provider, error=str(e))
        raise HTTPException(status_code=401, detail="Authentication failed") from e

    # Get user details from provider
    user_info: Optional[Dict[str, Any]] = None
    emails: Optional[List[Any]] = None
    if provider == "google":
        user_info = token.get("userinfo")
    elif provider == "github":
        resp = await client.get("user", token=token)
        user_info = resp.json() if resp else None
        emails_resp = await client.get("user/emails", token=token)
        emails = emails_resp.json() if emails_resp else []
    elif provider == "linkedin":
        # OpenID Connect userinfo endpoint provides email_verified boolean
        resp = await client.get("https://api.linkedin.com/v2/userinfo", token=token)
        user_info = resp.json() if resp else None
        if isinstance(user_info, dict) and not user_info.get("id"):
            user_info["id"] = user_info.get("sub")

    email = _select_verified_primary_email(provider, user_info, emails=emails)
    raw_provider_id = (user_info or {}).get("id") or (user_info or {}).get("sub")
    if not raw_provider_id:
        raise HTTPException(status_code=400, detail="Failed to fetch provider user identifier")
    provider_id = str(raw_provider_id)

    # Find or Create User
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalars().first()

    if not user:
        # Find or create a default workspace tenant for the new social user
        email_domain = email.split("@")[-1].lower()
        common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
        existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
        tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

        full_name = (user_info or {}).get("name") or (user_info or {}).get("login") or email.split("@")[0]
        tenant = Tenant(
            name=f"{full_name}'s Workspace",
            domain=tenant_domain,
            is_active=True
        )
        db.add(tenant)
        await db.flush()

        # Create new OAuth-only user (NULL hashed_password, never a sentinel string)
        user = User(
            email=email,
            full_name=full_name,
            provider=provider,
            provider_id=provider_id,
            is_active=True,
            is_verified=True,
            tenant_id=tenant.id,
            hashed_password=None,
        )
        db.add(user)
        log.info("social_user_created", email=email, provider=provider)
    else:
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Account is disabled")
        if user.provider != provider:
            # Never auto-link colliding accounts (whether password-only provider=None or another OAuth provider)
            link_token = await _issue_oauth_link_token(user.id, provider, provider_id, email)
            link_url = f"{settings.frontend_url}/auth/link-oauth?token={link_token}"
            try:
                await email_service.send_email(
                    email_id=f"oauth_link_{uuid.uuid4().hex[:12]}",
                    to_address=user.email,
                    subject="DVT Talent AI — Confirm OAuth Sign-In Linking",
                    body=(
                        f"Hello {user.full_name},\n\n"
                        f"Someone attempted to sign in with {provider} using your email ({user.email}).\n"
                        f"If this was you, confirm linking {provider} to your existing account within 15 minutes:\n\n"
                        f"{link_url}\n\n"
                        f"Linking token: {link_token}\n\n"
                        f"If you did not request this, ignore this message and your existing sign-in method remains unchanged."
                    ),
                    tenant_id=user.tenant_id,
                )
            except Exception as exc:
                log.error("oauth_link_confirmation_email_failed", user_id=str(user.id), error=str(exc))
            log.warning(
                "social_email_collision_blocked",
                user_id=str(user.id),
                existing_provider=user.provider,
                attempted_provider=provider,
            )
            raise HTTPException(
                status_code=409,
                detail="An account with this email already exists. Check your email to confirm linking this provider.",
            )
        if not user.provider_id:
            user.provider_id = provider_id

    await db.commit()
    await db.refresh(user)

    # Auto-link workspace OAuth email sender only when Gmail send scope was actually granted
    if provider == "google" and user.tenant_id:
        tenant_obj = await db.get(Tenant, user.tenant_id)
        granted_scope = str(token.get("scope", "")) if isinstance(token, dict) else ""
        raw_access = token.get("access_token") if isinstance(token, dict) else None
        if tenant_obj and not tenant_obj.sender_email and raw_access and "gmail.send" in granted_scope:
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
        path="/",
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


@router.post("/link-oauth")
async def link_oauth_provider(
    payload: LinkOAuthRequest,
    db: AsyncSession = Depends(get_db),
):
    """Consume a single-use signed link confirmation token to attach an OAuth provider to an existing account."""
    try:
        claims = jwt.decode(payload.token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=400, detail="Invalid or expired account linking token") from exc

    if claims.get("type") != "oauth_link":
        raise HTTPException(status_code=400, detail="Invalid account linking token")

    jti = claims.get("jti")
    sub = claims.get("sub")
    if not jti or not sub:
        raise HTTPException(status_code=400, detail="Invalid account linking token")

    stored_raw = await consume_oauth_link_nonce(str(jti))
    if not stored_raw:
        raise HTTPException(status_code=400, detail="Invalid or expired account linking token")

    try:
        stored = json.loads(stored_raw)
        user_uuid = uuid.UUID(str(sub))
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid account linking token") from exc

    provider = stored.get("provider")
    provider_id = stored.get("provider_id")
    if (
        stored.get("user_id") != str(user_uuid)
        or provider != claims.get("provider")
        or not provider
        or not provider_id
    ):
        raise HTTPException(status_code=400, detail="Invalid account linking token")

    user = (await db.execute(select(User).where(User.id == user_uuid))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="Account not found or disabled")

    user.provider = provider
    user.provider_id = str(provider_id)
    await db.commit()
    log.info("oauth_provider_linked", user_id=str(user.id), provider=provider)
    return {"status": "linked", "provider": provider}
