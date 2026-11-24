"""
DVT Talent AI — Authentication API
JWT-based auth with secure HttpOnly cookies
"""
import asyncio
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import structlog
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt  # pyrefly: ignore[untyped-import]
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
from services.mfa_service import (
    build_otpauth_uri,
    decrypt_mfa_secret,
    encrypt_mfa_secret,
    generate_totp_secret,
    verify_totp_code,
)
from services.redis_service import (
    consume_password_reset_token,
    get_rate_limit_count,
    is_token_revoked,
    is_user_token_revoked,
    mark_totp_step_used,
    record_rate_limit,
    reset_rate_limit,
    revoke_token,
    revoke_user_tokens,
    store_email_otp,
    store_password_reset_token,
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
    is_superadmin: bool = False
    mfa_enabled: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────
async def verify_password(plain: str, hashed: Optional[str]) -> bool:
    if not plain or not hashed or not isinstance(hashed, str):
        return False
    if not hashed.startswith(("$2a$", "$2b$", "$2y$")):
        return False
    try:
        return await asyncio.to_thread(bcrypt.checkpw, plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        log.error("password_verification_error", error=str(exc))
        return False


async def hash_password(password: str) -> str:
    def _hash():
        salt = bcrypt.gensalt()
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    return await asyncio.to_thread(_hash)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"iat": now.timestamp(), "exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    expire = now + timedelta(days=30)
    to_encode.update({"iat": now.timestamp(), "exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def resolve_post_login_redirect(user: User) -> str:
    """Computes the canonical post-authentication destination for Candidate, Recruiter, or Superadmin."""
    if getattr(user, "is_superadmin", False):
        return "/dashboard/monitoring"
    if user.role == UserRole.CANDIDATE:
        return "/portal"
    return "/dashboard"


def create_mfa_challenge_token(user_id: uuid.UUID, challenge_kind: str = "mfa_challenge") -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "jti": uuid.uuid4().hex,
        "iat": now.timestamp(),
        "exp": now + timedelta(seconds=300),
        "type": challenge_kind,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def set_session_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    """Attaches HttpOnly access/refresh session cookies and clears temporary MFA challenge state."""
    response.delete_cookie(key="dvt_mfa_challenge", path="/", samesite="lax")
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


def _build_auth_session_response(user: User, status_code: int = 200) -> JSONResponse:
    """Issues JWT access/refresh tokens with HttpOnly cookies and canonical redirect_to."""
    is_superadmin = bool(getattr(user, "is_superadmin", False))
    token_data = {
        "sub": str(user.id),
        "role": user.role.value,
        "tenant_id": str(user.tenant_id) if user.tenant_id else "",
        "is_superadmin": is_superadmin,
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
        "is_superadmin": is_superadmin,
        "mfa_enabled": bool(getattr(user, "mfa_enabled", False)),
        "redirect_to": resolve_post_login_redirect(user),
    }
    response = JSONResponse(content=content, status_code=status_code)
    set_session_cookies(response, access_token, refresh_token)
    return response


async def build_mfa_gate_if_required(user: User, db: AsyncSession) -> Optional[dict]:
    """Returns MFA challenge or mandatory Superadmin first-login enrollment payload if required."""
    is_superadmin = bool(getattr(user, "is_superadmin", False))
    mfa_enabled = bool(getattr(user, "mfa_enabled", False))
    decrypted_secret = decrypt_mfa_secret(getattr(user, "mfa_secret_encrypted", None))

    if mfa_enabled and decrypted_secret:
        return {
            "mfa_required": True,
            "mfa_setup_required": False,
            "challenge_token": create_mfa_challenge_token(user.id, "mfa_challenge"),
            "role": user.role.value,
            "is_superadmin": is_superadmin,
        }
    if is_superadmin:
        # Enforce mandatory TOTP for Superadmin whether mfa_enabled is False or secret is missing/corrupt.
        secret = generate_totp_secret()
        setattr(user, "mfa_enabled", False)
        setattr(user, "mfa_secret_encrypted", encrypt_mfa_secret(secret))
        await db.commit()
        return {
            "mfa_required": True,
            "mfa_setup_required": True,
            "challenge_token": create_mfa_challenge_token(user.id, "mfa_setup"),
            "secret": secret,
            "otpauth_uri": build_otpauth_uri(user.email, secret),
            "role": user.role.value,
            "is_superadmin": True,
        }
    if mfa_enabled and not decrypted_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="2FA configuration is invalid; please contact an administrator.",
        )
    return None


def _ensure_token_privileges_current(payload: dict, user: User) -> None:
    """Rejects stale or tampered tokens whose role/superadmin claims diverge from the live database user."""
    if bool(payload.get("is_superadmin", False)) and not bool(getattr(user, "is_superadmin", False)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session privileges revoked; please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if "role" in payload and str(payload.get("role") or "").strip().lower() != user.role.value.lower():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session role changed; please sign in again",
            headers={"WWW-Authenticate": "Bearer"},
        )


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
        user_obj_id: Optional[str] = payload.get("sub")
        if user_obj_id is None or payload.get("type") != "access":
            raise credentials_exception
    except JWTError as exc:
        raise credentials_exception from exc

    try:
        user_uuid = uuid.UUID(user_obj_id)
    except ValueError as exc:
        raise credentials_exception from exc

    if await is_user_token_revoked(str(user_uuid), payload.get("iat")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise credentials_exception
    _ensure_token_privileges_current(payload, user)
    request.state.user = user
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user


async def require_superadmin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.ADMIN or not getattr(current_user, "is_superadmin", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Platform superadmin access required")
    return current_user


# ── Routes ────────────────────────────────────────────────────────────────
@router.post("/register/send-otp", status_code=status.HTTP_200_OK)
async def send_registration_otp(
    request: Request,
    payload: SendOtpRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Dispatches a 6-digit email OTP (5-minute TTL) for sign-up verification.
    Never leaks whether an email is already registered (anti-enumeration).
    """
    clean_email = payload.email.strip().lower()

    # Rate limiting (per-email and per-IP)
    await enforce_endpoint_rate_limit(
        request,
        scope="auth_send_otp",
        identifier=clean_email,
        limit=5,
        window_seconds=600,
        detail="Too many OTP requests. Please wait a few minutes before trying again.",
    )
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="auth_send_otp_ip",
        identifier=client_ip,
        limit=20,
        window_seconds=600,
        detail="Too many OTP requests from this IP. Please try again later.",
    )

    existing = (await db.execute(select(User).where(func.lower(User.email) == clean_email))).scalar_one_or_none()
    otp_code: Optional[str] = None
    if not existing:
        # Generate cryptographically secure 6-digit OTP capped at 5 minutes
        otp_code = f"{secrets.randbelow(900000) + 100000}"
        await store_email_otp(clean_email, otp_code, ttl_seconds=300)

        subject = f"Your DVT Talent AI Verification Code: {otp_code}"
        body = (
            f"Hello,\n\n"
            f"Your 6-digit verification code for DVT Talent AI is:\n\n"
            f"   {otp_code}\n\n"
            f"This code will expire in 5 minutes. If you did not request this, please disregard this email.\n\n"
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

    return {
        "status": "success",
        "message": f"If {clean_email} is not yet registered, a verification code has been sent.",
        "expires_in": 300,
        "dev_code": otp_code if (settings.dev_mode and otp_code) else None,
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
    clean_email = user_data.email.strip().lower()
    await enforce_endpoint_rate_limit(
        request,
        scope="auth_verify_otp_email",
        identifier=clean_email,
        limit=10,
        window_seconds=600,
        detail="Too many registration verification attempts for this email. Please wait before trying again.",
    )

    # Verify email OTP BEFORE checking account existence to avoid email enumeration
    if user_data.otp or not settings.dev_mode:
        if not user_data.otp or not await verify_email_otp(clean_email, user_data.otp):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or expired verification code. Please request a new code.",
            )

    # Check if email exists (case-insensitive) without leaking details unnecessarily
    result = await db.execute(select(User).where(func.lower(User.email) == clean_email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Unable to complete registration. Please check your verification code or sign in.",
        )

    is_candidate = (user_data.role or "").strip().lower() == "candidate"
    
    tenant_id = None
    if not is_candidate:
        # Create a default workspace tenant for the recruiter/agency
        email_domain = clean_email.split("@")[-1]
        common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
        
        existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
        tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

        tenant = Tenant(
            name=(user_data.company_name or "").strip() or f"{user_data.full_name}'s Workspace",
            domain=tenant_domain,
            is_active=True,
            sender_name=user_data.full_name,
            sender_email=clean_email,
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
        email=clean_email,
        full_name=user_data.full_name,
        hashed_password=await hash_password(user_data.password),
        role=UserRole.CANDIDATE if is_candidate else UserRole.ADMIN,
        is_superadmin=False,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()

    if is_candidate:
        # Check if an existing B2C candidate record was previously created with this email
        cand_res = await db.execute(
            select(Candidate).where(
                func.lower(Candidate.email) == clean_email,
                Candidate.tenant_id.is_(None),
            )
        )
        existing_cand = cand_res.scalars().first()
        name_parts = user_data.full_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        if existing_cand is not None and getattr(existing_cand, "user_id", None) is None:
            setattr(existing_cand, "user_id", user.id)
            if not existing_cand.first_name:
                setattr(existing_cand, "first_name", first_name)
            if not existing_cand.last_name:
                setattr(existing_cand, "last_name", last_name)
        else:
            new_candidate = Candidate(
                user_id=user.id,
                first_name=first_name,
                last_name=last_name or "Candidate",
                email=clean_email,
                status=CandidateStatus.SOURCED,
                is_searchable=True,
            )
            db.add(new_candidate)

    await db.commit()
    await db.refresh(user)

    return _build_auth_session_response(user, status_code=201)


async def _extract_login_credentials(request: Request) -> tuple[str, str]:
    """Parses email/username and password cleanly from JSON or OAuth2 form-urlencoded requests."""
    content_type = (request.headers.get("content-type") or "").lower()
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}
        if not isinstance(body, dict):
            body = {}
        raw_email = body.get("email") or body.get("username") or ""
        raw_password = body.get("password") or ""
        return str(raw_email), str(raw_password)
    form = await request.form()
    raw_email = form.get("username") or form.get("email") or ""
    raw_password = form.get("password") or ""
    return str(raw_email), str(raw_password)


@router.post("/login")
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    raw_email, raw_password = await _extract_login_credentials(request)
    client_ip = get_real_client_ip(request)
    normalized_email = raw_email.strip().lower()
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

    if not user or not user.hashed_password:
        # Constant-time dummy bcrypt check to prevent user/OAuth-only enumeration via timing
        await verify_password(raw_password or "", _DUMMY_BCRYPT_HASH)
        password_ok = False
    else:
        password_ok = await verify_password(raw_password, str(user.hashed_password))

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

    # Reset failed-attempt counter for this account upon successful password verification
    if not bypass:
        await reset_rate_limit(email_fail_key, window_seconds=900)

    # 2FA Gate (enrolled TOTP or mandatory first-login Superadmin enrollment)
    mfa_gate = await build_mfa_gate_if_required(user, db)
    if mfa_gate:
        return JSONResponse(content=mfa_gate, status_code=status.HTTP_200_OK)

    setattr(user, "last_login", datetime.now(timezone.utc))
    await db.commit()

    return _build_auth_session_response(user)


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
        user_id_val: Optional[str] = payload.get("sub")
        if not user_id_val or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError as exc:
        raise HTTPException(status_code=401, detail="Invalid refresh token") from exc

    try:
        user_uuid = uuid.UUID(user_id_val)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid token payload") from exc

    if await is_user_token_revoked(str(user_uuid), payload.get("iat")):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or account disabled")
    _ensure_token_privileges_current(payload, user)

    # Rotate refresh token: blacklist the consumed refresh token
    try:
        exp = payload.get("exp")
        remaining = int(exp - datetime.now(timezone.utc).timestamp()) if exp else 86400
        if remaining > 0:
            await revoke_token(dvt_refresh_token, remaining)
    except Exception as exc:
        log.warning("refresh_token_revoke_failed", error=str(exc))

    return _build_auth_session_response(user)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/logout")
async def logout(
    request: Request,
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
    response.delete_cookie(key="dvt_mfa_challenge", path="/", samesite="lax")
    return response


class MfaCodeRequest(BaseModel):
    code: str
    challenge_token: Optional[str] = None


class MfaChallengeRequest(BaseModel):
    challenge_token: Optional[str] = None
    code: str


class MfaDisableRequest(BaseModel):
    current_password: str
    code: str


async def _decode_mfa_token(raw_token: Optional[str], expected_types: tuple[str, ...]) -> tuple[uuid.UUID, dict, str]:
    """Validates a short-lived MFA challenge or setup token and returns (user_uuid, claims, raw_token)."""
    token = (raw_token or "").strip()
    if not token or await is_token_revoked(token):
        raise HTTPException(status_code=401, detail="2FA challenge expired or already used.")
    try:
        claims = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_val = claims.get("sub")
        token_type = claims.get("type")
        if not user_id_val or token_type not in expected_types:
            raise HTTPException(status_code=401, detail="Invalid 2FA token.")
        user_uuid = uuid.UUID(str(user_id_val))
    except (JWTError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid or expired 2FA token.") from exc

    if await is_user_token_revoked(str(user_uuid), claims.get("iat")):
        raise HTTPException(status_code=401, detail="2FA challenge expired or already used.")
    return user_uuid, claims, token


async def _revoke_short_lived_token(token: str, claims: dict) -> None:
    exp = claims.get("exp")
    remaining = max(1, int(exp - datetime.now(timezone.utc).timestamp())) if exp else 300
    await revoke_token(token, remaining)


@router.get("/mfa/pending")
async def get_pending_mfa_state(
    request: Request,
    dvt_mfa_challenge: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Inspects an HttpOnly OAuth/login MFA challenge cookie without exposing JWTs in URLs."""
    raw_token = dvt_mfa_challenge or request.headers.get("X-MFA-Challenge")
    user_uuid, claims, _ = await _decode_mfa_token(raw_token, ("mfa_challenge", "mfa_setup"))
    user = (await db.execute(select(User).where(User.id == user_uuid))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Account unavailable.")
    if claims.get("type") == "mfa_setup":
        if getattr(user, "mfa_enabled", False):
            return {"mode": "challenge", "email": user.email, "is_superadmin": bool(getattr(user, "is_superadmin", False))}
        secret = decrypt_mfa_secret(getattr(user, "mfa_secret_encrypted", None))
        if not secret:
            raise HTTPException(status_code=401, detail="2FA setup expired. Please sign in again.")
        return {
            "mode": "setup",
            "email": user.email,
            "is_superadmin": bool(getattr(user, "is_superadmin", False)),
            "secret": secret,
            "otpauth_uri": build_otpauth_uri(user.email, secret),
        }
    return {
        "mode": "challenge",
        "email": user.email,
        "is_superadmin": bool(getattr(user, "is_superadmin", False)),
    }


@router.post("/mfa/setup")
async def setup_admin_mfa(
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Generates a fresh TOTP secret for an administrator (remains disabled until verified)."""
    secret = generate_totp_secret()
    setattr(current_user, "mfa_secret_encrypted", encrypt_mfa_secret(secret))
    setattr(current_user, "mfa_enabled", False)
    await db.commit()
    return {
        "secret": secret,
        "otpauth_uri": build_otpauth_uri(current_user.email, secret),
        "issuer": "DVT Talent AI",
    }


@router.post("/mfa/verify-setup")
async def verify_admin_mfa_setup(
    payload: MfaCodeRequest,
    request: Request,
    dvt_mfa_challenge: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Activates admin 2FA via authenticated session OR scoped first-login setup token and returns full session."""
    raw_setup_token = payload.challenge_token or dvt_mfa_challenge
    setup_claims: Optional[dict] = None
    used_setup_token: Optional[str] = None

    if raw_setup_token:
        user_uuid, setup_claims, used_setup_token = await _decode_mfa_token(raw_setup_token, ("mfa_setup",))
        target_user = (await db.execute(select(User).where(User.id == user_uuid))).scalar_one_or_none()
        if not target_user or not target_user.is_active or target_user.role != UserRole.ADMIN:
            raise HTTPException(status_code=403, detail="Admin access required")
    else:
        target_user = await require_admin(await get_current_user(request, db))

    await enforce_endpoint_rate_limit(
        request,
        scope="mfa_setup_verify",
        identifier=str(target_user.id),
        limit=10,
        window_seconds=300,
        detail="Too many 2FA verification attempts. Please wait a few minutes.",
    )
    secret = decrypt_mfa_secret(getattr(target_user, "mfa_secret_encrypted", None))
    if not secret:
        raise HTTPException(status_code=400, detail="2FA setup has not been initialized.")
    matched_step = verify_totp_code(secret, payload.code)
    if matched_step is None or not await mark_totp_step_used(str(target_user.id), matched_step):
        raise HTTPException(status_code=400, detail="Invalid or already-used 6-digit authenticator code.")

    setattr(target_user, "mfa_enabled", True)
    setattr(target_user, "last_login", datetime.now(timezone.utc))
    await db.commit()

    if used_setup_token and setup_claims:
        await _revoke_short_lived_token(used_setup_token, setup_claims)
        return _build_auth_session_response(target_user)

    return {"status": "success", "mfa_enabled": True, "redirect_to": resolve_post_login_redirect(target_user)}


@router.post("/mfa/challenge")
async def verify_mfa_login_challenge(
    payload: MfaChallengeRequest,
    request: Request,
    dvt_mfa_challenge: Optional[str] = Cookie(None),
    db: AsyncSession = Depends(get_db),
):
    """Completes two-factor login using a challenge token (JSON or HttpOnly cookie) and 6-digit TOTP code."""
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="mfa_challenge_ip",
        identifier=client_ip,
        limit=15,
        window_seconds=900,
        detail="Too many 2FA attempts. Please try again later.",
    )
    user_uuid, claims, raw_token = await _decode_mfa_token(
        payload.challenge_token or dvt_mfa_challenge,
        ("mfa_challenge",),
    )

    fail_key = f"rl:mfa_fail_user:{user_uuid}"
    bypass = is_load_test_bypass_allowed(request)
    if not bypass and await get_rate_limit_count(fail_key, window_seconds=900) >= 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many invalid 2FA attempts. Please wait 15 minutes.",
            headers={"Retry-After": "900"},
        )

    user = (await db.execute(select(User).where(User.id == user_uuid))).scalar_one_or_none()
    secret = decrypt_mfa_secret(getattr(user, "mfa_secret_encrypted", None)) if user else None
    if not user or not user.is_active or not getattr(user, "mfa_enabled", False) or not secret:
        raise HTTPException(status_code=401, detail="2FA is unavailable for this account.")

    matched_step = verify_totp_code(secret, payload.code)
    if matched_step is None or not await mark_totp_step_used(str(user.id), matched_step):
        if not bypass:
            await record_rate_limit(fail_key, limit=5, window_seconds=900)
        raise HTTPException(status_code=401, detail="Invalid or already-used 2FA code.")

    if not bypass:
        await reset_rate_limit(fail_key, window_seconds=900)

    await _revoke_short_lived_token(raw_token, claims)

    setattr(user, "last_login", datetime.now(timezone.utc))
    await db.commit()
    return _build_auth_session_response(user)


@router.post("/mfa/disable")
async def disable_admin_mfa(
    payload: MfaDisableRequest,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Disables admin 2FA only after re-verifying both current password and live TOTP code."""
    await enforce_endpoint_rate_limit(
        request,
        scope="mfa_disable_user",
        identifier=str(current_user.id),
        limit=5,
        window_seconds=900,
        detail="Too many 2FA disable attempts. Please wait 15 minutes.",
    )
    if not await verify_password(payload.current_password, str(current_user.hashed_password or "")):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")
    secret = decrypt_mfa_secret(getattr(current_user, "mfa_secret_encrypted", None))
    matched_step = verify_totp_code(secret, payload.code) if secret else None
    if matched_step is None or not await mark_totp_step_used(str(current_user.id), matched_step):
        raise HTTPException(status_code=400, detail="Invalid 6-digit authenticator code.")

    setattr(current_user, "mfa_enabled", False)
    setattr(current_user, "mfa_secret_encrypted", None)
    await db.commit()
    await revoke_user_tokens(str(current_user.id))
    return {"status": "success", "mfa_enabled": False}


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: Optional[str] = None
    email: Optional[EmailStr] = None
    otp: Optional[str] = None
    new_password: str


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Rate-limited password reset request issuing a single-use 256-bit URL token (5-min TTL)."""
    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(
        request,
        scope="forgot_password_ip",
        identifier=client_ip,
        limit=5,
        window_seconds=600,
        detail="Too many password reset requests. Please try again later.",
    )
    clean_email = payload.email.strip().lower()
    user = (await db.execute(select(User).where(func.lower(User.email) == clean_email))).scalar_one_or_none()
    reset_token: Optional[str] = None
    reset_code: Optional[str] = None
    if user and user.is_active:
        reset_token = secrets.token_urlsafe(32)
        await store_password_reset_token(reset_token, clean_email, ttl_seconds=300)
        reset_link = f"{settings.frontend_url}/auth/reset-password?token={reset_token}"
        if settings.dev_mode:
            reset_code = f"{secrets.randbelow(900000) + 100000:06d}"
            await store_email_otp(f"reset:{clean_email}", reset_code, ttl_seconds=300)
        try:
            await email_service.send_email(
                email_id=f"pwreset_{uuid.uuid4().hex[:12]}",
                to_address=clean_email,
                subject="DVT Talent AI — Password Reset Link",
                body=(
                    f"Hello,\n\n"
                    f"Use this single-use link to reset your DVT Talent AI password (expires in 5 minutes):\n\n"
                    f"   {reset_link}\n\n"
                    f"If you did not request a password reset, you can safely ignore this email."
                ),
            )
        except Exception as exc:
            log.warning("password_reset_email_failed", error=str(exc))
    return {
        "message": f"If an account exists for {payload.email}, password reset instructions have been sent.",
        "expires_in": 300,
        "dev_code": reset_code if settings.dev_mode else None,
        "dev_token": reset_token if settings.dev_mode else None,
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Completes a password reset using a single-use 256-bit token (or dev/test OTP) and revokes all sessions."""
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

    clean_email: Optional[str] = None
    if payload.token:
        clean_email = await consume_password_reset_token(payload.token)
        if not clean_email:
            raise HTTPException(status_code=400, detail="Invalid or expired password reset token")
    elif payload.email and payload.otp:
        candidate_email = payload.email.strip().lower()
        if not await verify_email_otp(f"reset:{candidate_email}", payload.otp):
            raise HTTPException(status_code=400, detail="Invalid or expired password reset code")
        clean_email = candidate_email
    else:
        raise HTTPException(status_code=400, detail="A valid password reset token is required")

    user = (await db.execute(select(User).where(func.lower(User.email) == clean_email))).scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token")

    setattr(user, "hashed_password", await hash_password(payload.new_password))
    await db.commit()
    await revoke_user_tokens(str(user.id))
    refresh_cookie = request.cookies.get("dvt_refresh_token")
    if refresh_cookie:
        await revoke_token(refresh_cookie, expire_seconds=30 * 86400)
    return {"status": "success", "message": "Password has been reset successfully."}
