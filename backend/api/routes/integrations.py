"""
DVT Talent AI — ATS Integration API Routes
Endpoints for connecting, syncing, and exporting to Greenhouse and Ceipal.
"""
import uuid
import structlog
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

import ipaddress
from urllib.parse import urlparse
from db.models import get_db, User, UserRole, IntegrationConnection, ATSExportLog
from api.routes.auth import get_current_user
from services.security_service import encrypt_pii, decrypt_pii
from integrations.unified_ats import sync_jobs, export_candidate, get_ats_client, SUPPORTED_PROVIDERS

log = structlog.get_logger(__name__)
router = APIRouter()

ATSProvider = Literal["greenhouse", "ceipal"]


def _validate_safe_outbound_url(raw_url: str) -> str:
    """Validate external integration base_url against SSRF (blocks non-HTTPS, loopback, link-local, RFC1918, and internal service names)."""
    cleaned = (raw_url or "").strip()
    parsed = urlparse(cleaned)
    if parsed.scheme != "https" or not parsed.hostname:
        raise HTTPException(status_code=400, detail="Integration base_url must use https:// and include a valid public hostname.")
    host = parsed.hostname.lower().strip("[]")
    blocked_names = {"localhost", "redis", "postgres", "db", "chromadb", "api", "frontend", "worker", "scheduler", "metadata.google.internal"}
    if host in blocked_names or host.endswith(".local") or host.endswith(".internal"):
        raise HTTPException(status_code=400, detail="Integration base_url cannot target internal or local hosts.")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved or ip.is_unspecified:
            raise HTTPException(status_code=400, detail="Integration base_url cannot target private, loopback, or link-local IP addresses.")
    except ValueError:
        pass
    return cleaned


def _require_integration_access(current_user: User, admin_only: bool = False) -> None:
    if not current_user.tenant_id or current_user.role == UserRole.CANDIDATE:
        raise HTTPException(status_code=403, detail="Workspace permissions required.")
    if admin_only and current_user.role not in (UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Admin or manager permissions required to configure ATS integrations.")
    if not admin_only and current_user.role not in (UserRole.RECRUITER, UserRole.ADMIN, UserRole.MANAGER):
        raise HTTPException(status_code=403, detail="Recruiter, manager, or admin permissions required.")


# ── Schemas ───────────────────────────────────────────────────────────────────
class ConnectRequest(BaseModel):
    api_key: str
    base_url: str | None = None
    auto_export_enabled: bool = False

    @field_validator("api_key")
    @classmethod
    def api_key_not_empty(cls, v):
        if not v.strip():
            raise ValueError("api_key cannot be empty")
        return v.strip()


class ExportRequest(BaseModel):
    candidate_id: str
    job_id: str


# ── Connect & Test ────────────────────────────────────────────────────────────
@router.post("/{provider}/connect", summary="Save API key and test ATS connection")
async def connect_integration(
    provider: ATSProvider,
    req: ConnectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Saves (or updates) the ATS API key for the tenant, encrypted at rest.
    Tests the connection before saving.
    """
    _require_integration_access(current_user, admin_only=True)
    if provider not in SUPPORTED_PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")

    # Test connection before saving
    from integrations.greenhouse.client import GreenhouseClient
    from integrations.ceipal.client import CeipalClient
    from config import settings

    validated_base_url = None
    if provider == "greenhouse":
        client = GreenhouseClient(api_key=req.api_key, tenant_id=str(current_user.tenant_id))
    else:
        raw_base_url = req.base_url or settings.ceipal_api_base_url or "https://api.ceipal.com/v1"
        validated_base_url = _validate_safe_outbound_url(raw_base_url)
        client = CeipalClient(api_key=req.api_key, base_url=validated_base_url, tenant_id=str(current_user.tenant_id))

    is_valid = await client.test_connection()
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Connection to {provider} failed. Please check your API key."
        )

    # Upsert IntegrationConnection
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == current_user.tenant_id,
            IntegrationConnection.provider == provider,
        )
    )
    conn = result.scalar_one_or_none()

    encrypted_key = encrypt_pii(req.api_key)

    if conn:
        conn.api_key_encrypted = encrypted_key
        conn.base_url = validated_base_url
        conn.auto_export_enabled = req.auto_export_enabled
        conn.is_active = True
    else:
        conn = IntegrationConnection(
            tenant_id=current_user.tenant_id,
            provider=provider,
            api_key_encrypted=encrypted_key,
            base_url=validated_base_url,
            auto_export_enabled=req.auto_export_enabled,
            is_active=True,
        )
        db.add(conn)

    await db.commit()
    log.info("ats_connected", provider=provider, tenant_id=str(current_user.tenant_id))
    return {"status": "connected", "provider": provider, "auto_export_enabled": req.auto_export_enabled}


@router.delete("/{provider}/disconnect", summary="Remove ATS integration")
async def disconnect_integration(
    provider: ATSProvider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_integration_access(current_user, admin_only=True)
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == current_user.tenant_id,
            IntegrationConnection.provider == provider,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        raise HTTPException(status_code=404, detail=f"No {provider} connection found")
    conn.is_active = False
    await db.commit()
    return {"status": "disconnected", "provider": provider}


@router.get("/{provider}/status", summary="Get integration connection status")
async def get_integration_status(
    provider: ATSProvider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_integration_access(current_user, admin_only=False)
    result = await db.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == current_user.tenant_id,
            IntegrationConnection.provider == provider,
        )
    )
    conn = result.scalar_one_or_none()
    if not conn:
        return {"connected": False, "provider": provider}
    return {
        "connected": conn.is_active,
        "provider": provider,
        "auto_export_enabled": conn.auto_export_enabled,
        "last_sync_at": conn.last_sync_at,
    }


# ── Jobs ──────────────────────────────────────────────────────────────────────
@router.get("/{provider}/jobs", summary="Get jobs from last ATS sync")
async def get_synced_jobs(
    provider: ATSProvider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 50,
):
    """Returns jobs that were last pulled from the ATS (cached in Job table)."""
    _require_integration_access(current_user, admin_only=False)
    from db.models import Job
    result = await db.execute(
        select(Job).where(
            Job.tenant_id == current_user.tenant_id,
            Job.meta_data["source"].astext == provider,
        ).order_by(Job.created_at.desc()).limit(limit)
    )
    jobs = result.scalars().all()
    return [
        {
            "id": str(j.id),
            "title": j.title,
            "location": j.location,
            "external_id": j.meta_data.get("external_id") if j.meta_data else None,
            "source_url": j.source_url,
        }
        for j in jobs
    ]


@router.post("/{provider}/sync-jobs", summary="Trigger manual ATS job sync")
async def trigger_sync_jobs(
    provider: ATSProvider,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """Triggers a background sync of jobs from the ATS. Returns immediately."""
    _require_integration_access(current_user, admin_only=False)
    background_tasks.add_task(sync_jobs, str(current_user.tenant_id), provider)
    return {"status": "sync_queued", "provider": provider}


# ── Export ────────────────────────────────────────────────────────────────────
@router.post("/{provider}/export", summary="Export a candidate to the ATS")
async def export_candidate_route(
    provider: ATSProvider,
    req: ExportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
):
    """
    Pushes a scored DVT candidate to a job in the specified ATS.
    Runs in the background — returns immediately.
    """
    _require_integration_access(current_user, admin_only=False)
    background_tasks.add_task(
        export_candidate,
        str(current_user.tenant_id),
        req.candidate_id,
        req.job_id,
        provider,
        str(current_user.id),
    )
    return {"status": "export_queued", "provider": provider, "candidate_id": req.candidate_id}


# ── Export Logs ───────────────────────────────────────────────────────────────
@router.get("/{provider}/export-logs", summary="Get recent export logs for an ATS")
async def get_export_logs(
    provider: ATSProvider,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    limit: int = 20,
):
    _require_integration_access(current_user, admin_only=False)
    result = await db.execute(
        select(ATSExportLog).where(
            ATSExportLog.tenant_id == current_user.tenant_id,
            ATSExportLog.provider == provider,
        ).order_by(ATSExportLog.created_at.desc()).limit(limit)
    )
    logs = result.scalars().all()
    return [
        {
            "id": str(entry.id),
            "candidate_id": str(entry.candidate_id),
            "job_id": str(entry.job_id),
            "external_candidate_id": entry.external_candidate_id,
            "status": entry.status,
            "created_at": entry.created_at,
        }
        for entry in logs
    ]
