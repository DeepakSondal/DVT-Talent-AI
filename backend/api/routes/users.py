"""
DVT Talent AI — Users API  (FIXED [H-01]: was 7-line stub)
"""
from datetime import datetime
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import User, UserRole, get_db
from api.routes.auth import get_current_user, require_admin, hash_password, verify_password

router = APIRouter()

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    preferences: Optional[dict] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str

class UserOut(BaseModel):
    id: UUID
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str]
    last_login: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

@router.get("/me", response_model=UserOut)
async def get_my_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.patch("/me", response_model=UserOut)
async def update_my_profile(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(current_user, field, value)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.post("/me/change-password")
async def change_password(
    data: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if len(data.new_password or "") < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters long")
    if not await verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = await hash_password(data.new_password)
    await db.commit()
    return {"message": "Password updated successfully"}

# Admin-only endpoints (strictly scoped to caller's tenant)
@router.get("")
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Workspace tenant context required")
    result = await db.execute(
        select(User)
        .where(User.tenant_id == current_user.tenant_id)
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()
    return {"items": [UserOut.model_validate(u) for u in users], "total": len(users)}

@router.patch("/{user_id}/role")
async def update_user_role(
    user_id: UUID,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Workspace tenant context required")
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    await db.commit()
    return {"message": f"Role updated to {role.value}", "user_id": str(user_id)}

@router.patch("/{user_id}/deactivate")
async def deactivate_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if not current_user.tenant_id:
        raise HTTPException(status_code=403, detail="Workspace tenant context required")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account")
    result = await db.execute(
        select(User).where(User.id == user_id, User.tenant_id == current_user.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    return {"message": "User deactivated"}
