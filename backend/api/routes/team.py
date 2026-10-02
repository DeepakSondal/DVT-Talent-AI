from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional, Dict, Any
import uuid
from pydantic import BaseModel

from backend.db.models import get_db, User, UserRole, Team, Candidate, EmailSent, TeamApiKeys
from backend.api.routes.auth import get_current_user # Assuming a dependency exists
from services.security_service import encrypt_pii, decrypt_pii

router = APIRouter(prefix="/api/v1/team", tags=["team"])

async def require_manager(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manager oversight required.")
    return current_user

@router.post("/invite")
async def invite_recruiter(email: str, team_id: str, db: AsyncSession = Depends(get_db), manager: User = Depends(require_manager)):
    """Invites a recruiter to the manager's team."""
    stmt = select(Team).where(Team.id == team_id, Team.manager_id == manager.id)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found or unauthorized")
        
    # Mocking invite logic - normally would send an email & create a pending user
    new_user = User(
        tenant_id=manager.tenant_id,
        manager_id=manager.id,
        team_id=team.id,
        email=email,
        full_name="Invited Recruiter",
        role=UserRole.RECRUITER,
        hashed_password="mock_password" # Need auth flow
    )
    db.add(new_user)
    await db.commit()
    return {"message": "Recruiter invited successfully", "user_id": new_user.id}

@router.get("/members")
async def list_team_members(db: AsyncSession = Depends(get_db), manager: User = Depends(require_manager)):
    """Lists team members under the manager."""
    stmt = select(User).where(User.manager_id == manager.id)
    result = await db.execute(stmt)
    members = result.scalars().all()
    return {"members": [{"id": m.id, "email": m.email, "role": m.role} for m in members]}

@router.get("/analytics")
async def get_team_analytics(db: AsyncSession = Depends(get_db), manager: User = Depends(require_manager)):
    """Aggregate KPIs across the team."""
    # Count total candidates sourced by recruiters under this manager
    stmt = select(func.count(Candidate.id)).where(Candidate.recruiter_id.in_(
        select(User.id).where(User.manager_id == manager.id)
    ))
    res = await db.execute(stmt)
    total_sourced = res.scalar() or 0

    return {
        "total_sourced_candidates": total_sourced,
        "active_recruiters": 5, # Mock value, ideally calculated dynamically
        "credit_usage_total": 12500
    }

@router.patch("/members/{user_id}/quota")
async def set_user_quota(user_id: str, limit: int, db: AsyncSession = Depends(get_db), manager: User = Depends(require_manager)):
    """Set monthly credit limit for a recruiter."""
    # Simplified mock for quota enforcement
    return {"message": f"Quota for {user_id} set to {limit} credits."}

@router.get("/candidates")
async def get_team_candidates(recruiter_id: Optional[str] = None, db: AsyncSession = Depends(get_db), manager: User = Depends(require_manager)):
    """Gets all candidates across the team."""
    subq = select(User.id).where(User.manager_id == manager.id)
    stmt = select(Candidate).where(Candidate.recruiter_id.in_(subq))
    
    if recruiter_id:
        stmt = stmt.where(Candidate.recruiter_id == recruiter_id)
        
    result = await db.execute(stmt)
    cands = result.scalars().all()
    return {"candidates": [{"id": c.id, "name": f"{c.first_name} {c.last_name}"} for c in cands]}

# ── Team API Keys Configuration (BYOK Encrypted at Rest) ─────────────────────

class TeamApiKeysConfig(BaseModel):
    openai_key: Optional[str] = None
    serper_key: Optional[str] = None
    anthropic_key: Optional[str] = None

class TeamApiKeysOut(BaseModel):
    openai_key_hint: Optional[str] = None
    serper_key_hint: Optional[str] = None
    anthropic_key_hint: Optional[str] = None
    configured: bool

def _mask_api_key(encrypted: Optional[str]) -> Optional[str]:
    if not encrypted:
        return None
    try:
        plain = decrypt_pii(encrypted)
        if len(plain) > 8:
            return f"{plain[:4]}{'•' * (len(plain) - 8)}{plain[-4:]}"
        return "••••"
    except Exception:
        return "••••"

@router.get("/keys", response_model=TeamApiKeysOut)
async def get_team_api_keys(
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager)
):
    """Fetch masked team API keys."""
    # Find team
    stmt = select(Team).where(Team.manager_id == manager.id)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="No team found for this manager")
        
    stmt_keys = select(TeamApiKeys).where(TeamApiKeys.team_id == team.id)
    res_keys = await db.execute(stmt_keys)
    keys = res_keys.scalar_one_or_none()
    
    configured = bool(keys and (keys.openai_key or keys.serper_key or keys.anthropic_key))
    return TeamApiKeysOut(
        openai_key_hint=_mask_api_key(keys.openai_key) if keys else None,
        serper_key_hint=_mask_api_key(keys.serper_key) if keys else None,
        anthropic_key_hint=_mask_api_key(keys.anthropic_key) if keys else None,
        configured=configured
    )

@router.post("/keys")
async def save_team_api_keys(
    payload: TeamApiKeysConfig,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager)
):
    """Save encrypted team API keys."""
    stmt = select(Team).where(Team.manager_id == manager.id)
    result = await db.execute(stmt)
    team = result.scalar_one_or_none()
    if not team:
        raise HTTPException(status_code=404, detail="No team found for this manager")
        
    stmt_keys = select(TeamApiKeys).where(TeamApiKeys.team_id == team.id)
    res_keys = await db.execute(stmt_keys)
    keys = res_keys.scalar_one_or_none()
    
    if not keys:
        keys = TeamApiKeys(team_id=team.id)
        db.add(keys)
        
    if payload.openai_key is not None:
        keys.openai_key = encrypt_pii(payload.openai_key) if payload.openai_key.strip() else None
    if payload.serper_key is not None:
        keys.serper_key = encrypt_pii(payload.serper_key) if payload.serper_key.strip() else None
    if payload.anthropic_key is not None:
        keys.anthropic_key = encrypt_pii(payload.anthropic_key) if payload.anthropic_key.strip() else None
        
    await db.commit()
    return {"status": "saved", "message": "Team API keys saved and encrypted successfully"}

