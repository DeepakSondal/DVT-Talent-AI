"""
DVT Talent AI — Tenants API
Manages enterprise client profiles, team members, and branding.
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import get_current_user
from db.models import Tenant, User, get_db

router = APIRouter()

class TenantUpdate(BaseModel):
    name: Optional[str] = None
    logo_url: str | None = None
    industry: str | None = None
    address: str | None = None
    onboarded: bool | None = None
    settings: Optional[Dict[str, Any]] = None

class TenantOut(BaseModel):
    id: UUID
    name: str
    domain: Optional[str] = None
    logo_url: Optional[str] = None
    industry: Optional[str] = None
    address: Optional[str] = None
    is_active: bool = True
    onboarded: Optional[bool] = False
    plan: Optional[str] = "starter"
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    sender_verified: Optional[bool] = False
    settings: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TeamMemberOut(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: Optional[bool] = False
    avatar_url: Optional[str] = None
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

@router.get("/me", response_model=TenantOut)
async def get_my_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Fetch the tenant associated with the current user """
    if not current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Tenant not found")

    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.patch("/me", response_model=TenantOut)
async def update_my_tenant(
    payload: TenantUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Update tenant branding and profile (Admin/Manager/Recruiter only) """
    role_val = getattr(current_user.role, "value", current_user.role)
    if role_val not in ["admin", "recruiter", "manager"] or not current_user.tenant_id:
         raise HTTPException(status_code=403, detail="Insufficient permissions")
         
    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == "settings" and isinstance(value, dict):
            merged = dict(tenant.settings or {})
            merged.update(value)
            tenant.settings = merged
        else:
            setattr(tenant, key, value)
    
    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.get("/team", response_model=List[TeamMemberOut])
async def get_team_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ List all users within the current tenant scope """
    role_val = getattr(current_user.role, "value", current_user.role)
    if not current_user.tenant_id or role_val == "candidate":
        raise HTTPException(status_code=403, detail="Workspace membership required to view team members")

    query = select(User).filter(User.tenant_id == current_user.tenant_id)
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/complete-onboarding")
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Mark the current tenant as onboarded (First Run Wizard complete) """
    role_val = getattr(current_user.role, "value", current_user.role)
    if role_val not in ["admin", "recruiter", "manager"] or not current_user.tenant_id:
         raise HTTPException(status_code=403, detail="Insufficient permissions")
         
    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.onboarded = True
    await db.commit()
    return {"status": "success", "message": "Onboarding complete"}

