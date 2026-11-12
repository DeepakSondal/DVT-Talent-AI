"""
DVT Talent AI — Authentication API
JWT-based auth with secure HttpOnly cookies
"""
import asyncio
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import structlog
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.middleware.rate_limit import (
    enforce_endpoint_rate_limit,
    get_real_client_ip,
    is_load_test_bypass_allowed,
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
from services.redis_service import (
    get_rate_limit_count,
    is_token_revoked,
    record_rate_limit,
    reset_rate_limit,
    revoke_token,
    store_email_otp,
    verify_email_otp,
)

# Pre-computed dummy bcrypt hash to prevent timing-based user enumeration on login
_DUMMY_BCRYPT_HASH = bcrypt.hashpw(b"dvt-timing-defense-placeholder", bcrypt.gensalt()).decode("utf-8")

router = APIRouter()
log = structlog.get_logger(__name__)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Pydantic Schemas ──────────────────────────────────────────────────────
class SendOtpRequest(BaseModel):
    email: EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "recruiter"
    company_name: Optional[str] = None
    otp: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"  # noqa: S105
    user_id: str
    email: str
    full_name: str
    role: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────
async def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed or not hashed.startswith(("$2a$", "$2b$", "$2y$")):
        return False
    try:
        return await asyncio.to_thread(bcrypt.checkpw, plain.encode('utf-8'), hashed.encode('utf-8'))
    except ValueError:
        return False


async def hash_password(password: str) -> str:
    def _hash():
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    return await asyncio.to_thread(_hash)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=30)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Check Authorization header first, then fallback to secure cookie
    token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        # Fallback to the secure cookie set on login
        cookie_token = request.cookies.get("dvt_token")
        if cookie_token and cookie_token.startswith("Bearer "):
            token = cookie_token.split(" ")[1]

    if not token:
        raise credentials_exception

    # Check token revocation blocklist
    if await is_token_revoked(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_obj_id: str = payload.get("sub")
        if user_obj_id is None or payload.get("type") != "access":
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    try:
        user_uuid = uuid.UUID(user_obj_id)
    except ValueError as exc:
        raise credentials_exception from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


# ── Routes ────────────────────────────────────────────────────────────────
@router.post("/register/send-otp", status_code=status.HTTP_200_OK)
async def send_registration_otp(
    request: Request,
    payload: SendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches a 6-digit email OTP for sign-up verification.
    Rate limited to 5 OTP requests per 10 minutes per IP/email.
    """
    clean_email = payload.email.strip().lower()

    # Rate limiting
    await enforce_endpoint_rate_limit(
        request,
        scope="auth_send_otp",
        identifier=clean_email,
        limit=5,
        window_seconds=600,
        detail="Too many OTP requests. Please wait a few minutes before trying again.",
    )

    # Check if user already exists
    existing = (await db.execute(select(User).where(User.email == clean_email))).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    # Generate cryptographically secure 6-digit OTP
    otp_code = f"{secrets.randbelow(900000) + 100000}"
    await store_email_otp(clean_email, otp_code, ttl_seconds=600)

    # Dispatch via email service
    subject = f"Your DVT Talent AI Verification Code: {otp_code}"
    body = (
        f"Hello,\n\n"
        f"Your 6-digit verification code for DVT Talent AI is:\n\n"
        f"   {otp_code}\n\n"
        f"This code will expire in 10 minutes. If you did not request this, please disregard this email.\n\n"
        f"— DVT Talent AI Security Team"
    )

    try:
        await email_service.send_email(
            email_id=f"otp_{uuid.uuid4().hex[:12]}",
            to_address=clean_email,
            subject=subject,
            body=body,
        )
    except Exception as exc:
        log.warning("otp_email_send_exception", error=str(exc))

    is_dev = not settings.is_production and os.getenv("APP_ENV", "").lower() != "production"
    return {
        "status": "success",
        "message": f"Verification code sent to {clean_email}",
        "expires_in": 600,
        "dev_code": otp_code if is_dev else None,
    }


@router.post("/register", status_code=201)
async def register(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="register_ip",
        identifier=client_ip,
        limit=10,
        window_seconds=3600,
        detail="Too many registration attempts from this IP. Please try again later.",
    )

    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # OTP Verification Gate:
    # If otp is provided, or in production mode, verify email ownership
    if user_data.otp or settings.is_production:
        if not user_data.otp or not await verify_email_otp(user_data.email, user_data.otp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code. Please request a new code.",
            )

    is_candidate = (user_data.role or "").strip().lower() == "candidate"
    
    tenant_id = None
    if not is_candidate:
        # Create a default workspace tenant for the recruiter/agency
        email_domain = user_data.email.split("@")[-1].lower()
        common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
        
        existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
        tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

        tenant = Tenant(
            name=(user_data.company_name or "").strip() or f"{user_data.full_name}'s Workspace",
            domain=tenant_domain,
            is_active=True,
            sender_name=user_data.full_name,
            sender_email=user_data.email,
            credits_balance=50,
            credits_last_reset_at=datetime.now(timezone.utc),
        )
        db.add(tenant)
        await db.flush()
        tenant_id = tenant.id

        # 🎁 Grant 50 Welcome Pilot Credits to kickstart autonomous sourcing
        welcome_tx = CreditTransaction(
            tenant_id=tenant.id,
            amount=50,
            type=CreditTransactionType.CREDIT,
            description="Welcome Pilot Credits (50 Free Trial Credits)",
        )
        db.add(welcome_tx)

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=await hash_password(user_data.password),
        role=UserRole.CANDIDATE if is_candidate else UserRole.ADMIN,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()

    if is_candidate:
        # Check if an existing B2C candidate record was previously created with this email
        cand_res = await db.execute(
            select(Candidate).where(
                Candidate.email == user_data.email,
                Candidate.tenant_id.is_(None),
            )
        )
        existing_cand = cand_res.scalars().first()
        name_parts = user_data.full_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        if existing_cand and existing_cand.user_id is None:
            existing_cand.user_id = user.id
            if not existing_cand.first_name:
                existing_cand.first_name = first_name
            if not existing_cand.last_name:
                existing_cand.last_name = last_name
        else:
            new_candidate = Candidate(
                user_id=user.id,
                first_name=first_name,
                last_name=last_name or "Candidate",
                email=user_data.email,
                status=CandidateStatus.SOURCED,
                is_searchable=True,
            )
            db.add(new_candidate)

    await db.commit()
    await db.refresh(user)

    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "tenant_id": str(user.tenant_id) if user.tenant_id else ""
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    content = {
        "access_token": access_token,
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
    }
    response = JSONResponse(content=content, status_code=201)
    response.set_cookie(
        key="dvt_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
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
    return response


@router.post("/login")
async def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_real_client_ip(request)
    normalized_email = (form_data.username or "").strip().lower()
    bypass = is_load_test_bypass_allowed(request)

    # 1. Per-IP login request rate limit (30 req / minute)
    await enforce_endpoint_rate_limit(
        request,
        scope="login_req_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Too many login requests. Please try again in a minute.",
    )

    # 2. Check existing brute-force lockout counters BEFORE expensive bcrypt check
    ip_fail_key = f"rl:login_fail_ip:{client_ip}"
    email_fail_key = f"rl:login_fail_email:{normalized_email}"
    if not bypass:
        ip_fails = await get_rate_limit_count(ip_fail_key, window_seconds=900)
        email_fails = await get_rate_limit_count(email_fail_key, window_seconds=900)
        if ip_fails >= 10 or email_fails >= 5:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Account is temporarily locked for 15 minutes.",
                headers={"Retry-After": "900"},
            )

    result = await db.execute(select(User).where(func.lower(User.email) == normalized_email))
    user = result.scalar_one_or_none()

    if not user:
        # Constant-time dummy bcrypt check to prevent user enumeration via timing
        await verify_password(form_data.password or "", _DUMMY_BCRYPT_HASH)
        password_ok = False
    else:
        password_ok = await verify_password(form_data.password, user.hashed_password)

    if not user or not password_ok:
        if not bypass:
            ip_allowed, _ = await record_rate_limit(ip_fail_key, limit=10, window_seconds=900)
            email_allowed, _ = await record_rate_limit(email_fail_key, limit=5, window_seconds=900)
            if not ip_allowed or not email_allowed:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many failed login attempts. Account is temporarily locked for 15 minutes.",
                    headers={"Retry-After": "900"},
                )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

    # Reset failed-attempt counter for this account upon successful authentication
    if not bypass:
        await reset_rate_limit(email_fail_key, window_seconds=900)

    user.last_login = datetime.now(timezone.utc)
    await db.commit()

    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "tenant_id": str(user.tenant_id) if user.tenant_id else ""
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    content = {
        "access_token": access_token,
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
    }
    response = JSONResponse(content=content)
    response.set_cookie(
        key="dvt_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
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
    return response


@router.post("/refresh")
async def refresh_token_route(
    request: Request,
    dvt_refresh_token: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="refresh_ip",
        identifier=client_ip,
        limit=30,
        window_seconds=60,
        detail="Too many token refresh requests. Please wait a minute.",
    )

    if not dvt_refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    # Check refresh token revocation blocklist
    if await is_token_revoked(dvt_refresh_token):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    try:
        payload = jwt.decode(dvt_refresh_token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_val: str = payload.get("sub")
        if not user_id_val or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    try:
        user_uuid = uuid.UUID(user_id_val)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token payload") from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or account disabled")

    # Rotate refresh token: blacklist the consumed refresh token
    try:
        exp = payload.get("exp")
        remaining = int(exp - datetime.now(timezone.utc).timestamp()) if exp else 86400
        if remaining > 0:
            await revoke_token(dvt_refresh_token, remaining)
    except Exception as exc:
        log.warning("refresh_token_revoke_failed", error=str(exc))

    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "tenant_id": str(user.tenant_id) if user.tenant_id else "",
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    content = {
        "access_token": access_token,
        "user_id": str(user.id),
        "tenant_id": str(user.tenant_id) if user.tenant_id else None,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value,
    }
    response = JSONResponse(content=content)
    response.set_cookie(
        key="dvt_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
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
    return response


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    """
    Log out user, clear authentication cookies, and blacklist the current access & refresh tokens in Redis.
    """
    raw_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
    else:
        cookie_token = request.cookies.get("dvt_token")
        if cookie_token and cookie_token.startswith("Bearer "):
            raw_token = cookie_token.split(" ")[1]

    refresh_cookie = request.cookies.get("dvt_refresh_token")

    for tok in (raw_token, refresh_cookie):
        if tok:
            try:
                payload = jwt.decode(tok, settings.secret_key, algorithms=[settings.algorithm])
                exp = payload.get("exp")
                remaining = int(exp - datetime.now(timezone.utc).timestamp()) if exp else 3600
                if remaining > 0:
                    await revoke_token(tok, remaining)
            except Exception as exc:
                log.warning("logout_token_revoke_failed", error=str(exc))

    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(key="dvt_token", path="/", samesite="lax")
    response.delete_cookie(key="dvt_refresh_token", path="/", samesite="lax")
    response.delete_cookie(key="dvt_refresh_token", path="/api/v1/auth/refresh", samesite="lax")
    return response


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Rate-limited password reset request that never leaks whether an email is registered."""
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="forgot_password_ip",
        identifier=client_ip,
        limit=5,
        window_seconds=600,
        detail="Too many password reset requests. Please try again later.",
    )
    clean_email = str(payload.email).strip().lower()
    user = (await db.execute(select(User).where(func.lower(User.email) == clean_email))).scalar_one_or_none()
    if user and user.is_active:
        reset_code = f"{secrets.randbelow(900000) + 100000:06d}"
        await store_email_otp(f"reset:{clean_email}", reset_code, ttl_seconds=600)
        try:
            await email_service.send_email(
                email_id=f"pwreset_{uuid.uuid4().hex[:12]}",
                to_address=clean_email,
                subject="DVT Talent AI — Password Reset Code",
                body=(
                    f"Hello,\n\n"
                    f"Your DVT Talent AI password reset code is:\n\n"
                    f"   {reset_code}\n\n"
                    f"This code expires in 10 minutes. If you did not request a reset, ignore this email."
                ),
            )
        except Exception as exc:
            log.warning("password_reset_email_failed", error=str(exc))
    return {
        "message": f"If an account exists for {payload.email}, password reset instructions have been sent."
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Completes a password reset using the single-use OTP emailed via /forgot-password."""
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="reset_password_ip",
        identifier=client_ip,
        limit=5,
        window_seconds=600,
        detail="Too many password reset attempts. Please try again later.",
    )
    if len(payload.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    clean_email = str(payload.email).strip().lower()
    otp_valid = await verify_email_otp(f"reset:{clean_email}", payload.otp)
    if not otp_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code")
    user = (await db.execute(select(User).where(func.lower(User.email) == clean_email))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset code")
    user.hashed_password = await hash_password(payload.new_password)
    await db.commit()
    return {"status": "success", "message": "Password has been reset successfully."}
