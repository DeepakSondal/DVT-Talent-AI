"""
DVT Talent AI — Tenants API
Manages enterprise client profiles, team members, and branding.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from db.models import get_db, Tenant, User
from api.routes.auth import get_current_user, require_admin
from pydantic import BaseModel

router = APIRouter()

class TenantUpdate(BaseModel):
    name: str
    logo_url: str | None = None
    industry: str | None = None
    address: str | None = None
    onboarded: bool | None = None

@router.get("/me", response_model=None)
async def get_my_tenant(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Fetch the tenant associated with the current user """
    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant

@router.patch("/me", response_model=None)
async def update_my_tenant(
    payload: TenantUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ Update tenant branding and profile (Admin only) """
    # Check if role has admin/recruiter permission for tenant branding
    role_val = getattr(current_user.role, "value", current_user.role)
    if role_val not in ["admin", "recruiter", "manager"]:
         raise HTTPException(status_code=403, detail="Insufficient permissions")
         
    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    for key, value in payload.dict(exclude_unset=True).items():
        setattr(tenant, key, value)
    
    await db.commit()
    await db.refresh(tenant)
    return tenant

@router.get("/team", response_model=None)
async def get_team_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """ List all users within the current tenant scope """
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
    if role_val not in ["admin", "recruiter", "manager"]:
         raise HTTPException(status_code=403, detail="Insufficient permissions")
         
    query = select(Tenant).filter(Tenant.id == current_user.tenant_id)
    result = await db.execute(query)
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
        
    tenant.onboarded = True
    await db.commit()
    return {"status": "success", "message": "Onboarding complete"}

