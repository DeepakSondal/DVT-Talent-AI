"""
DVT Talent AI — Authentication API
JWT-based auth with secure HttpOnly cookies
"""
from datetime import datetime, timedelta, timezone
from typing import Optional
import uuid
import asyncio

from fastapi import APIRouter, Depends, HTTPException, status, Request, Cookie
from fastapi.responses import JSONResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import settings
from db.models import User, UserRole, Tenant, Candidate, CandidateStatus, get_db

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ── Pydantic Schemas ──────────────────────────────────────────────────────
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "recruiter"


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
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
    return await asyncio.to_thread(bcrypt.checkpw, plain.encode('utf-8'), hashed.encode('utf-8'))


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

    # Check token revocation blocklist in Redis
    try:
        import redis.asyncio as aioredis
        r = aioredis.from_url(settings.redis_url)
        is_revoked = await r.get(f"blacklist:{token}")
        if is_revoked:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has been revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
    except HTTPException:
        raise
    except Exception:
        pass

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_obj_id: str = payload.get("sub")
        if user_obj_id is None or payload.get("type") != "access":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    try:
        user_uuid = uuid.UUID(user_obj_id)
    except ValueError:
        raise credentials_exception

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
@router.post("/register", status_code=201)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if email exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    is_candidate = (user_data.role or "").strip().lower() == "candidate"
    
    tenant_id = None
    if not is_candidate:
        # Create a default workspace tenant for the recruiter/agency
        email_domain = user_data.email.split("@")[-1].lower()
        common_domains = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "example.com", "test.com", "proton.me", "protonmail.com"}
        
        existing_tenant = (await db.execute(select(Tenant).where(Tenant.domain == email_domain))).scalar_one_or_none()
        tenant_domain = f"{email_domain}-{uuid.uuid4().hex[:6]}" if (email_domain in common_domains or existing_tenant) else email_domain

        tenant = Tenant(
            name=f"{user_data.full_name}'s Workspace",
            domain=tenant_domain,
            is_active=True
        )
        db.add(tenant)
        await db.flush()
        tenant_id = tenant.id

    user = User(
        email=user_data.email,
        full_name=user_data.full_name,
        hashed_password=await hash_password(user_data.password),
        role=UserRole.CANDIDATE if is_candidate else UserRole.RECRUITER,
        tenant_id=tenant_id,
    )
    db.add(user)
    await db.flush()

    if is_candidate:
        # Check if an existing candidate record was previously sourced with this email
        cand_res = await db.execute(select(Candidate).where(Candidate.email == user_data.email))
        existing_cand = cand_res.scalar_one_or_none()
        name_parts = user_data.full_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        if existing_cand:
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
        path="/api/v1/auth/refresh",
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=settings.is_production,
    )
    return response


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalar_one_or_none()

    if not user or not await verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Account is disabled")

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
        path="/api/v1/auth/refresh",
        max_age=30 * 24 * 60 * 60,
        samesite="lax",
        secure=settings.is_production,
    )
    return response


@router.post("/refresh")
async def refresh_token_route(dvt_refresh_token: Optional[str] = Cookie(None), db: AsyncSession = Depends(get_db)):
    if not dvt_refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")
    try:
        payload = jwt.decode(dvt_refresh_token, settings.secret_key, algorithms=[settings.algorithm])
        user_id_val: str = payload.get("sub")
        if not user_id_val or payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    try:
        user_uuid = uuid.UUID(user_id_val)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)
    
    content = {
        "access_token": access_token,
        "user_id": str(user.id),
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
        path="/api/v1/auth/refresh",
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
    Log out user, clear authentication cookies, and blacklist the current access token in Redis.
    """
    raw_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        raw_token = auth_header.split(" ")[1]
    else:
        cookie_token = request.cookies.get("dvt_token")
        if cookie_token and cookie_token.startswith("Bearer "):
            raw_token = cookie_token.split(" ")[1]

    if raw_token:
        try:
            payload = jwt.decode(raw_token, settings.secret_key, algorithms=[settings.algorithm])
            exp = payload.get("exp")
            remaining = int(exp - datetime.now(timezone.utc).timestamp()) if exp else 3600
            if remaining > 0:
                import redis.asyncio as aioredis
                r = aioredis.from_url(settings.redis_url)
                await r.setex(f"blacklist:{raw_token}", remaining, "revoked")
        except Exception:
            pass

    response = JSONResponse(content={"message": "Logged out successfully"})
    response.delete_cookie(key="dvt_token", path="/", samesite="lax")
    response.delete_cookie(key="dvt_refresh_token", path="/api/v1/auth/refresh", samesite="lax")
    return response
