import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any
import uuid
import structlog

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc
from pydantic import BaseModel, EmailStr

from db.models import (
    get_db,
    User,
    UserRole,
    Team,
    Candidate,
    EmailSent,
    TeamApiKeys,
    TeamInvitation,
    InvitationStatus,
    Tenant,
)
from api.routes.auth import get_current_user, hash_password, create_access_token
from services.security_service import encrypt_pii, decrypt_pii
from services.email_service import email_service
from config import settings

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/team", tags=["team"])


async def require_manager(current_user: User = Depends(get_current_user)) -> User:
    """Authorize manager or administrator role for team operations."""
    if current_user.role not in [UserRole.MANAGER, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Manager or administrator privileges required."
        )
    if not current_user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User must belong to an active organization."
        )
    return current_user


class InviteRecruiterRequest(BaseModel):
    email: EmailStr
    team_id: Optional[uuid.UUID] = None
    role: Optional[UserRole] = UserRole.RECRUITER


class AcceptInvitationRequest(BaseModel):
    token: str
    password: str
    full_name: str


@router.post("/invite")
async def invite_recruiter(
    payload: Optional[InviteRecruiterRequest] = None,
    email: Optional[str] = Query(None),
    team_id: Optional[str] = Query(None),
    role: Optional[UserRole] = Query(None),
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """
    Creates a cryptographically secure, single-use team invitation.
    Derives tenant from caller session. Persists only the SHA-256 token hash.
    Dispatches invitation link via configured email service.
    """
    raw_email = (payload.email if payload else email) or ""
    clean_email = str(raw_email).strip().lower()
    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid recipient email address is required."
        )

    target_team_uuid: Optional[uuid.UUID] = None
    if payload and payload.team_id:
        target_team_uuid = payload.team_id
    elif team_id:
        try:
            target_team_uuid = uuid.UUID(team_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid team_id format.")

    target_role = (payload.role if payload else role) or UserRole.RECRUITER

    # Privilege escalation defense:
    # 1. Non-admin managers cannot invite administrators
    if target_role == UserRole.ADMIN and manager.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization administrators can invite other administrators."
        )
    # 2. Cannot invite candidate accounts via team management
    if target_role == UserRole.CANDIDATE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Candidate accounts cannot be invited through team management."
        )

    tenant_id = manager.tenant_id

    # Validate team scope if specified
    team = None
    if target_team_uuid:
        stmt = select(Team).where(Team.id == target_team_uuid, Team.tenant_id == tenant_id)
        res = await db.execute(stmt)
        team = res.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found in this organization.")
        if manager.role == UserRole.MANAGER and team.manager_id != manager.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Managers can only invite members to their own teams."
            )

    # Check for active account collision
    existing_user_stmt = select(User).where(User.email == clean_email)
    existing_user = (await db.execute(existing_user_stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already belongs to an organization."
        )

    # Revoke any prior pending invitations for this email in this tenant
    prior_stmt = select(TeamInvitation).where(
        TeamInvitation.tenant_id == tenant_id,
        TeamInvitation.email == clean_email,
        TeamInvitation.status == InvitationStatus.PENDING,
    )
    prior_invites = (await db.execute(prior_stmt)).scalars().all()
    for prior in prior_invites:
        prior.status = InvitationStatus.REVOKED

    # Generate cryptographically secure single-use token; store ONLY the SHA-256 hash
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

    invitation = TeamInvitation(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        team_id=team.id if team else None,
        invited_by_user_id=manager.id,
        email=clean_email,
        role=target_role,
        token_hash=token_hash,
        status=InvitationStatus.PENDING,
        expires_at=expires_at,
        email_sent=False,
        email_error=None,
    )
    db.add(invitation)
    await db.commit()
    await db.refresh(invitation)

    # Look up tenant display name for email
    tenant_res = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_res.scalar_one_or_none()
    tenant_name = tenant.name if tenant else "Your Organization"

    # Dispatch email through established EmailService
    email_delivered = await email_service.send_team_invitation_email(
        to_address=clean_email,
        tenant_name=tenant_name,
        inviter_name=manager.full_name or "Team Administrator",
        invite_token=raw_token,
        role=target_role.value if hasattr(target_role, "value") else str(target_role),
        tenant_id=tenant_id,
    )

    invitation.email_sent = email_delivered
    if not email_delivered:
        invitation.email_error = "SMTP unconfigured or message delivery failed"
    await db.commit()

    log.info(
        "team_invitation_created",
        invitation_id=str(invitation.id),
        tenant_id=str(tenant_id),
        email=clean_email,
        role=target_role.value if hasattr(target_role, "value") else str(target_role),
        email_sent=email_delivered,
    )

    accept_url = f"{settings.frontend_url}/invite/accept?token={raw_token}"

    return {
        "status": "success",
        "message": (
            "Invitation created and dispatched"
            if email_delivered
            else "Invitation created; email service unconfigured or delivery failed"
        ),
        "invitation": {
            "id": str(invitation.id),
            "email": invitation.email,
            "role": invitation.role.value if hasattr(invitation.role, "value") else str(invitation.role),
            "status": invitation.status.value,
            "expires_at": invitation.expires_at.isoformat(),
            "email_sent": invitation.email_sent,
            "email_error": invitation.email_error,
        },
        "recovery_accept_url": accept_url if not email_delivered else None,
    }


@router.get("/invitations")
async def list_team_invitations(
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """
    Lists pending and historical team invitations for caller's organization.
    Tokens and token hashes are never exposed.
    """
    stmt = (
        select(TeamInvitation)
        .where(TeamInvitation.tenant_id == manager.tenant_id)
        .order_by(desc(TeamInvitation.created_at))
    )
    result = await db.execute(stmt)
    invitations = result.scalars().all()
    return {
        "invitations": [
            {
                "id": str(inv.id),
                "email": inv.email,
                "role": inv.role.value if hasattr(inv.role, "value") else str(inv.role),
                "status": inv.status.value,
                "expires_at": inv.expires_at.isoformat(),
                "accepted_at": inv.accepted_at.isoformat() if inv.accepted_at else None,
                "email_sent": inv.email_sent,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            }
            for inv in invitations
        ]
    }


@router.delete("/invitations/{invitation_id}")
async def revoke_team_invitation(
    invitation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_manager),
):
    """Revokes an outstanding pending team invitation."""
    stmt = select(TeamInvitation).where(
        TeamInvitation.id == invitation_id,
        TeamInvitation.tenant_id == manager.tenant_id,
    )
    invitation = (await db.execute(stmt)).scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot revoke invitation with status '{invitation.status.value}'."
        )

    invitation.status = InvitationStatus.REVOKED
    await db.commit()
    return {"message": "Invitation revoked successfully", "id": str(invitation_id)}


@router.get("/invite/validate")
@router.get("/invitations/validate")
async def validate_team_invitation(
    token: str = Query(..., description="Raw single-use invitation token"),
    db: AsyncSession = Depends(get_db),
):
    """
    Validates a team invitation token before acceptance.
    Returns invitation metadata (email, role, tenant name, expires_at) if valid and pending.
    Returns 400 or 404 with descriptive details if expired, revoked, already accepted, or invalid.
    """
    raw_token = token.strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="Invitation token is required.")

    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    stmt = select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
    invitation = (await db.execute(stmt)).scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or unrecognized invitation token.")

    if invitation.status == InvitationStatus.ACCEPTED:
        raise HTTPException(
            status_code=400,
            detail="This invitation has already been accepted and used."
        )

    if invitation.status == InvitationStatus.REVOKED:
        raise HTTPException(
            status_code=400,
            detail="This invitation has been revoked by your team administrator."
        )

    if invitation.status == InvitationStatus.EXPIRED:
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired. Please contact your team administrator for a new invite."
        )

    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        invitation.status = InvitationStatus.EXPIRED
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired. Please contact your team administrator for a new invite."
        )

    tenant_name = "Your Organization"
    if invitation.tenant_id:
        tenant_res = await db.execute(select(Tenant.name).where(Tenant.id == invitation.tenant_id))
        tenant_name = tenant_res.scalar_one_or_none() or tenant_name

    return {
        "valid": True,
        "email": invitation.email,
        "role": invitation.role.value if hasattr(invitation.role, "value") else str(invitation.role),
        "tenant_name": tenant_name,
        "expires_at": invitation.expires_at.isoformat(),
    }


@router.post("/invite/accept")
@router.post("/invitations/accept")
async def accept_team_invitation(
    payload: AcceptInvitationRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Accepts a single-use team invitation.
    Verifies token hash, expiration, and single-use status.
    Creates user account with chosen password, never a placeholder.
    """
    raw_token = payload.token.strip()
    if not raw_token:
        raise HTTPException(status_code=400, detail="Invitation token is required.")

    # Match token hash
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    stmt = select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
    invitation = (await db.execute(stmt)).scalar_one_or_none()
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid or unrecognized invitation token.")

    if invitation.status != InvitationStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"This invitation is no longer active (current status: {invitation.status.value})."
        )

    now = datetime.now(timezone.utc)
    expires_at = invitation.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at < now:
        # Conditionally mark expired if still pending
        await db.execute(
            update(TeamInvitation)
            .where(
                TeamInvitation.id == invitation.id,
                TeamInvitation.status == InvitationStatus.PENDING,
            )
            .values(status=InvitationStatus.EXPIRED)
            .execution_options(synchronize_session=False)
        )
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="This invitation has expired. Please request a new invite from your administrator."
        )

    clean_pwd = payload.password.strip()
    if len(clean_pwd) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    clean_name = payload.full_name.strip()
    if not clean_name:
        raise HTTPException(status_code=400, detail="Full name is required.")

    # Check existing user collision
    user_stmt = select(User).where(User.email == invitation.email)
    existing_user = (await db.execute(user_stmt)).scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email address already exists."
        )

    # Hash chosen password using legitimate bcrypt auth flow
    hashed_pwd = await hash_password(clean_pwd)

    new_user_id = uuid.uuid4()
    new_user = User(
        id=new_user_id,
        tenant_id=invitation.tenant_id,
        team_id=invitation.team_id,
        manager_id=invitation.invited_by_user_id,
        email=invitation.email,
        full_name=clean_name,
        role=invitation.role,  # Role strictly bound to invitation, preventing privilege escalation
        hashed_password=hashed_pwd,
        is_active=True,
        is_verified=True,
    )

    # Insert user in transaction first so foreign key accepted_by_user_id is valid
    try:
        db.add(new_user)
        await db.flush()
    except Exception as exc:
        await db.rollback()
        log.error("team_invitation_user_creation_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not create user account. A user with this email may have registered simultaneously."
        )

    # Database-level atomic conditional update:
    # Guarantees that ONLY ONE concurrent request can transition the invitation from PENDING to ACCEPTED
    consume_stmt = (
        update(TeamInvitation)
        .where(
            TeamInvitation.id == invitation.id,
            TeamInvitation.token_hash == token_hash,
            TeamInvitation.status == InvitationStatus.PENDING,
            TeamInvitation.expires_at >= now,
        )
        .values(
            status=InvitationStatus.ACCEPTED,
            accepted_at=now,
            accepted_by_user_id=new_user.id,
        )
        .execution_options(synchronize_session=False)
    )
    consume_res = await db.execute(consume_stmt)
    if consume_res.rowcount == 0:
        await db.rollback()
        raise HTTPException(
            status_code=400,
            detail="This invitation is no longer active, expired, or was already accepted by another session."
        )

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        log.error("team_invitation_commit_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Could not finalize invitation acceptance."
        )

    await db.refresh(new_user)

    log.info(
        "team_invitation_accepted",
        invitation_id=str(invitation.id),
        user_id=str(new_user.id),
        tenant_id=str(invitation.tenant_id),
        role=new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
    )

    token_data = {
        "sub": str(new_user.id),
        "email": new_user.email,
        "role": new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
        "tenant_id": str(new_user.tenant_id),
    }
    access_token = create_access_token(token_data)

    return {
        "status": "success",
        "message": "Invitation accepted and account created successfully",
        "user": {
            "id": str(new_user.id),
            "email": new_user.email,
            "full_name": new_user.full_name,
            "role": new_user.role.value if hasattr(new_user.role, "value") else str(new_user.role),
            "tenant_id": str(new_user.tenant_id),
        },
        "access_token": access_token,
        "token_type": "bearer",
    }

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

