"""
DVT Talent AI — Social Authentication (OAuth2)
Handlers for Google, GitHub, and LinkedIn
"""
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, cast
from urllib.parse import urlparse

import structlog
from authlib.integrations.starlette_client import OAuth  # pyrefly: ignore[untyped-import]
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt  # pyrefly: ignore[untyped-import]
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import (
    build_mfa_gate_if_required,
    create_access_token,
    create_refresh_token,
    resolve_post_login_redirect,
    set_session_cookies,
)
from config import settings
from db.models import (
    Candidate,
    CandidateStatus,
    CreditTransaction,
    CreditTransactionType,
    Tenant,
    User,
    UserRole,
    get_db,
)
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
    name="microsoft",
    client_id=settings.microsoft_client_id,
    client_secret=settings.microsoft_client_secret,
    server_metadata_url="https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
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

    if provider in ("google", "microsoft"):
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

_SOCIAL_PROVIDERS = {
    "google": "google",
    "github": "github",
    "microsoft": "microsoft",
}


def _resolve_frontend_origin(request: Request) -> str:
    """Return the matching configured origin from settings.cors_origins, else settings.frontend_url."""
    referer = request.headers.get("referer", "")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme in ("http", "https") and parsed.netloc:
            candidate = f"{parsed.scheme}://{parsed.netloc}".lower()
            for allowed in settings.cors_origins:
                clean_allowed = allowed.rstrip("/")
                if clean_allowed.lower() == candidate:
                    return clean_allowed
    return settings.frontend_url.rstrip("/")


@router.get("/login/{provider}")
async def social_login(provider: str, request: Request, portal: Optional[str] = None):
    """Initiate social login redirect"""
    safe_provider = _SOCIAL_PROVIDERS.get(provider.strip().lower())
    if not safe_provider:
        raise HTTPException(status_code=400, detail="Invalid provider")
    client = oauth.create_client(safe_provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")

    clean_portal: Optional[str] = None
    if portal is not None:
        clean_portal = "candidate" if portal.strip().lower() == "candidate" else "recruiter"
        if "session" in request.scope:
            request.session["oauth_portal"] = clean_portal

    client_id = str(getattr(settings, f"{safe_provider}_client_id", "") or "").strip()
    client_secret = str(getattr(settings, f"{safe_provider}_client_secret", "") or "").strip()
    if not client_id or not client_secret:
        log.warning("oauth_provider_not_configured", provider=safe_provider)
        frontend_origin = _resolve_frontend_origin(request)
        portal_suffix = f"&portal={clean_portal}" if clean_portal else ""
        return RedirectResponse(
            url=f"{frontend_origin}/auth/login?error=oauth_not_configured&provider={safe_provider}{portal_suffix}",
            status_code=302,
        )

    redirect_uri = f"{settings.app_base_url}/api/v1/auth/callback/{safe_provider}"
    return await client.authorize_redirect(request, redirect_uri)


@router.get("/callback/{provider}")
async def social_callback(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Handle social login callback"""
    safe_provider = _SOCIAL_PROVIDERS.get(provider.strip().lower())
    if not safe_provider:
        raise HTTPException(status_code=400, detail="Invalid provider")
    provider = safe_provider
    client = oauth.create_client(provider)
    if not client:
        raise HTTPException(status_code=400, detail="Invalid provider")

    session_portal = request.session.pop("oauth_portal", None) if "session" in request.scope else None
    requested_portal = str(session_portal or request.query_params.get("portal") or "recruiter").strip().lower()
    is_candidate_signup = requested_portal == "candidate"

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
    elif provider == "microsoft":
        user_info = token.get("userinfo")
        if not user_info:
            resp = await client.get("https://graph.microsoft.com/oidc/userinfo", token=token)
            user_info = resp.json() if resp else None
        if isinstance(user_info, dict) and not user_info.get("id"):
            user_info["id"] = user_info.get("sub") or user_info.get("oid")

    email = _select_verified_primary_email(provider, user_info, emails=emails)
    raw_provider_id = (user_info or {}).get("id") or (user_info or {}).get("sub")
    if not raw_provider_id:
        raise HTTPException(status_code=400, detail="Failed to fetch provider user identifier")
    provider_id = str(raw_provider_id)

    # Find or Create User
    result = await db.execute(select(User).where(func.lower(User.email) == email))
    user = result.scalars().first()

    if not user:
        full_name = str((user_info or {}).get("name") or (user_info or {}).get("login") or email.split("@")[0])
        tenant_id: Optional[uuid.UUID] = None
        if not is_candidate_signup:
            # Find or create a default workspace tenant for the new social recruiter user
            email_domain = email.split("@")[-1].lower()
            common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
            existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
            tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

            tenant = Tenant(
                name=f"{full_name}'s Workspace",
                domain=tenant_domain,
                is_active=True,
                sender_name=full_name,
                sender_email=email,
                credits_balance=50,
                credits_last_reset_at=datetime.now(timezone.utc),
            )
            db.add(tenant)
            await db.flush()
            tenant_id = tenant.id
            db.add(
                CreditTransaction(
                    tenant_id=tenant.id,
                    amount=50,
                    type=CreditTransactionType.CREDIT,
                    description="Welcome Pilot Credits (50 Free Trial Credits)",
                )
            )

        # Create new OAuth-only user (NULL hashed_password, never a sentinel string)
        user = User(
            email=email,
            full_name=full_name,
            provider=provider,
            provider_id=provider_id,
            role=UserRole.CANDIDATE if is_candidate_signup else UserRole.ADMIN,
            is_superadmin=False,
            is_active=True,
            is_verified=True,
            tenant_id=tenant_id,
            hashed_password=None,
        )
        db.add(user)
        await db.flush()

        if is_candidate_signup:
            cand_res = await db.execute(
                select(Candidate).where(
                    func.lower(Candidate.email) == email,
                    Candidate.tenant_id.is_(None),
                )
            )
            existing_cand = cand_res.scalars().first()
            name_parts = full_name.strip().split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
            if existing_cand is not None and getattr(existing_cand, "user_id", None) is None:
                setattr(existing_cand, "user_id", user.id)
                if not existing_cand.first_name:
                    setattr(existing_cand, "first_name", first_name)
                if not existing_cand.last_name:
                    setattr(existing_cand, "last_name", last_name)
            else:
                db.add(
                    Candidate(
                        user_id=user.id,
                        first_name=first_name,
                        last_name=last_name or "Candidate",
                        email=email,
                        status=CandidateStatus.SOURCED,
                        is_searchable=True,
                    )
                )

        log.info("social_user_created", email=email, provider=provider, role=user.role.value)
    else:
        if not user.is_active:
            raise HTTPException(status_code=400, detail="Account is disabled")
        if user.provider != provider:
            # Never auto-link colliding accounts (whether password-only provider=None or another OAuth provider)
            link_token = await _issue_oauth_link_token(cast(uuid.UUID, user.id), provider, provider_id, email)
            link_url = f"{settings.frontend_url}/auth/link-oauth?token={link_token}"
            try:
                await email_service.send_email(
                    email_id=f"oauth_link_{uuid.uuid4().hex[:12]}",
                    to_address=str(user.email),
                    subject="DVT Talent AI — Confirm OAuth Sign-In Linking",
                    body=(
                        f"Hello {user.full_name},\n\n"
                        f"Someone attempted to sign in with {provider} using your email ({user.email}).\n"
                        f"If this was you, confirm linking {provider} to your existing account within 15 minutes:\n\n"
                        f"{link_url}\n\n"
                        f"Linking token: {link_token}\n\n"
                        f"If you did not request this, ignore this message and your existing sign-in method remains unchanged."
                    ),
                    tenant_id=cast(Optional[uuid.UUID], user.tenant_id),
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
            setattr(user, "provider_id", provider_id)

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
            setattr(tenant_obj, "settings", t_settings)
            setattr(tenant_obj, "sender_email", email)
            setattr(tenant_obj, "sender_name", user.full_name)
            setattr(tenant_obj, "sender_verified", True)
            await db.commit()

    # Enforce TOTP 2FA gate on OAuth logins whenever enabled or required for Superadmin
    mfa_gate = await build_mfa_gate_if_required(user, db)
    if mfa_gate:
        mode = "setup" if mfa_gate.get("mfa_setup_required") else "challenge"
        mfa_response = RedirectResponse(
            url=f"{settings.frontend_url}/auth/login?mfa={mode}",
            status_code=302,
        )
        mfa_response.set_cookie(
            key="dvt_mfa_challenge",
            value=mfa_gate["challenge_token"],
            httponly=True,
            path="/",
            max_age=300,
            expires=300,
            samesite="lax",
            secure=settings.is_production,
        )
        return mfa_response

    role_str = user.role.value if hasattr(user.role, "value") else str(user.role)
    is_superadmin = bool(getattr(user, "is_superadmin", False))
    token_data = {
        "sub": str(user.id),
        "role": role_str,
        "tenant_id": str(user.tenant_id) if user.tenant_id else "",
        "is_superadmin": is_superadmin,
    }
    access_token = create_access_token(data=token_data)
    refresh_token = create_refresh_token(data=token_data)

    target_dest = resolve_post_login_redirect(user)
    redirect_url = (
        f"{settings.frontend_url}/auth/callback"
        f"?redirect={target_dest}&role={role_str}&tenant_id={token_data['tenant_id']}"
        f"&is_superadmin={'true' if is_superadmin else 'false'}"
    )
    response = RedirectResponse(url=redirect_url, status_code=302)
    set_session_cookies(response, access_token, refresh_token)

    log.info("social_login_success", email=email, provider=provider, redirect_to=target_dest)
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

    setattr(user, "provider", provider)
    setattr(user, "provider_id", str(provider_id))
    await db.commit()
    log.info("oauth_provider_linked", user_id=str(user.id), provider=provider)
    return {"status": "linked", "provider": provider}
