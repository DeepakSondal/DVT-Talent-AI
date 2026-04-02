"""
DVT Talent AI — Social Authentication (OAuth2)
Handlers for Google, GitHub, and LinkedIn
"""
import uuid
import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from authlib.integrations.starlette_client import OAuth
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from db.models import User, get_db
from api.routes.auth import create_access_token

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
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)

oauth.register(
    name="linkedin",
    client_id=settings.linkedin_client_id,
    client_secret=settings.linkedin_client_secret,
    access_token_url="https://www.linkedin.com/oauth/v2/accessToken",
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
        raise HTTPException(status_code=401, detail="Authentication failed")

    # Get user details from provider
    user_info = None
    if provider == "google":
        user_info = token.get("userinfo")
    elif provider == "github":
        resp = await client.get("user", token=token)
        user_info = resp.json()
        if not user_info.get("email"):
            emails_resp = await client.get("user/emails", token=token)
            emails = emails_resp.json()
            primary_email = next((e["email"] for e in emails if e["primary"]), emails[0]["email"])
            user_info["email"] = primary_email
    elif provider == "linkedin":
        # New LinkedIn V2 userinfo endpoint (OpenID Connect)
        resp = await client.get("https://api.linkedin.com/v2/userinfo", token=token)
        user_info = resp.json()
        # LinkedIn uses 'sub' instead of 'id' in OIDC
        user_info["id"] = user_info.get("sub")

    if not user_info or not user_info.get("email"):
        raise HTTPException(status_code=400, detail="Failed to fetch user email from provider")

    email = user_info["email"]
    provider_id = str(user_info.get("id") or user_info.get("sub"))

    # Find or Create User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        # Create new social user
        user = User(
            email=email,
            full_name=user_info.get("name") or user_info.get("login") or email.split("@")[0],
            provider=provider,
            provider_id=provider_id,
            is_active=True,
            hashed_password="oauth_managed_no_password",
        )
        db.add(user)
        log.info("social_user_created", email=email, provider=provider)
    else:
        # Link existing user to provider if not already linked
        if not user.provider:
            user.provider = provider
            user.provider_id = provider_id
            log.info("social_user_linked", email=email, provider=provider)

    await db.commit()
    await db.refresh(user)

    # Generate JWT
    access_token = create_access_token(data={"sub": user.email})
    
    # ── Security Hardening [H-08]: Use HttpOnly Cookies ─────────────────────
    # Instead of passing the token in the URL, we set it as a secure cookie.
    # This prevents token leakage and protects against XSS.
    
    # Get the primary frontend origin for redirect
    frontend_origin = settings.cors_origins[0]
    response = RedirectResponse(url=f"{frontend_origin}/dashboard")
    
    # Set the session cookie
    response.set_cookie(
        key="dvt_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        expires=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=settings.is_production, # Only use 'secure' over HTTPS
    )
    
    log.info("social_login_success", email=email, provider=provider)
    return response
