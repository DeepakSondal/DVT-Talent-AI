"""
DVT Talent AI — Unified ATS Service
Provider-agnostic orchestration layer:
 - sync_jobs()       → pull jobs into Job table
 - export_candidate() → push candidate to ATS
 - get_client()      → factory for provider clients
"""
import uuid
import structlog
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    Job, IntegrationConnection, ATSExportLog, AsyncSessionLocal,
)
from services.security_service import decrypt_pii, log_audit_event
from integrations.greenhouse.client import GreenhouseClient
from integrations.ceipal.client import CeipalClient
from config import settings

log = structlog.get_logger(__name__)

SUPPORTED_PROVIDERS = ["greenhouse", "ceipal"]


# ── Factory ──────────────────────────────────────────────────────────────────
def get_ats_client(conn: "IntegrationConnection"):
    """Return the correct ATS client for a given IntegrationConnection record."""
    api_key = decrypt_pii(conn.api_key_encrypted)

    if conn.provider == "greenhouse":
        return GreenhouseClient(api_key=api_key, tenant_id=str(conn.tenant_id))

    if conn.provider == "ceipal":
        base_url = conn.base_url or settings.ceipal_api_base_url or "https://api.ceipal.com/v1"
        return CeipalClient(api_key=api_key, base_url=base_url, tenant_id=str(conn.tenant_id))

    raise ValueError(f"Unsupported ATS provider: {conn.provider}")


# ── Job Sync ──────────────────────────────────────────────────────────────────
async def sync_jobs(tenant_id: str, provider: str) -> Dict[str, Any]:
    """
    Pull jobs from the ATS and upsert them into the Job table.
    Returns a summary dict with counts.
    """
    async with AsyncSessionLocal() as session:
        conn = await _get_connection(session, tenant_id, provider)
        if not conn:
            return {"error": f"No active {provider} connection for tenant {tenant_id}"}

        client = get_ats_client(conn)
        jobs_raw = await client.list_jobs()

        created_count = 0
        updated_count = 0

        for job_data in jobs_raw:
            external_id = job_data["external_id"]
            # Upsert: check if job exists by external_id + source
            result = await session.execute(
                select(Job).where(
                    Job.tenant_id == uuid.UUID(tenant_id),
                    Job.source_url == job_data.get("source_url", ""),
                )
            )
            existing: Optional[Job] = result.scalar_one_or_none()

            if existing:
                existing.title = job_data["title"]
                existing.location = job_data.get("location", "")
                existing.meta_data = {**(existing.meta_data or {}), "external_id": external_id, "raw": job_data.get("raw", {})}
                updated_count += 1
            else:
                new_job = Job(
                    tenant_id=uuid.UUID(tenant_id),
                    title=job_data["title"],
                    location=job_data.get("location", ""),
                    remote=False,
                    source_url=job_data.get("source_url", ""),
                    meta_data={"external_id": external_id, "source": provider, "raw": job_data.get("raw", {})},
                )
                session.add(new_job)
                created_count += 1

        # Update last_sync_at
        conn.last_sync_at = datetime.now(timezone.utc)
        await session.commit()

    summary = {"provider": provider, "synced": len(jobs_raw), "created": created_count, "updated": updated_count}
    log.info("ats_jobs_synced", **summary, tenant_id=tenant_id)
    return summary


# ── Candidate Export ──────────────────────────────────────────────────────────
async def export_candidate(
    tenant_id: str,
    candidate_id: str,
    job_id: str,
    provider: str,
    triggered_by_user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Push a DVT candidate to the specified ATS provider.
    Logs the export in ATSExportLog for audit trail.
    """
    from db.models import Candidate

    async with AsyncSessionLocal() as session:
        conn = await _get_connection(session, tenant_id, provider)
        if not conn:
            return {"error": f"No active {provider} connection for tenant {tenant_id}"}

        # Fetch candidate (strictly scoped to tenant_id)
        candidate: Optional[Candidate] = await session.get(Candidate, uuid.UUID(candidate_id))
        if not candidate or str(candidate.tenant_id) != str(tenant_id):
            return {"error": f"Candidate {candidate_id} not found"}

        # Get the external job_id from the Job's metadata (strictly scoped to tenant_id)
        job: Optional[Job] = await session.get(Job, uuid.UUID(job_id))
        if job and str(job.tenant_id) != str(tenant_id):
            return {"error": f"Job {job_id} not found"}
        external_job_id = str(job.meta_data.get("external_id", job_id)) if (job and job.meta_data) else job_id

        candidate_data = {
            "name": f"{candidate.first_name} {candidate.last_name}",
            "email": candidate.email or "",
            "phone": candidate.phone or "",
            "linkedin_url": candidate.linkedin_url or "",
            "resume_url": candidate.resume_url or "",
            "source": candidate.source or "dvt_ai",
        }

        client = get_ats_client(conn)
        result = await client.create_candidate(
            candidate_data=candidate_data,
            job_id=external_job_id,
            ai_score=candidate.score,
        )

        # Log export
        export_log = ATSExportLog(
            tenant_id=uuid.UUID(tenant_id),
            provider=provider,
            candidate_id=uuid.UUID(candidate_id),
            job_id=uuid.UUID(job_id),
            external_candidate_id=result.get("external_id"),
            status=result.get("status", "unknown"),
            response_payload=result,
        )
        session.add(export_log)

        # Audit log
        if triggered_by_user_id:
            await log_audit_event(
                tenant_id=uuid.UUID(tenant_id),
                user_id=uuid.UUID(triggered_by_user_id),
                action="ATS_EXPORT_CANDIDATE",
                entity_type="candidate",
                entity_id=uuid.UUID(candidate_id),
                metadata={"provider": provider, "status": result.get("status")},
            )

        await session.commit()
        log.info("ats_candidate_exported", provider=provider, status=result.get("status"), tenant_id=tenant_id)
        return result


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _get_connection(
    session: AsyncSession, tenant_id: str, provider: str
) -> Optional["IntegrationConnection"]:
    result = await session.execute(
        select(IntegrationConnection).where(
            IntegrationConnection.tenant_id == uuid.UUID(tenant_id),
            IntegrationConnection.provider == provider,
            IntegrationConnection.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def get_all_enabled_connections(tenant_id: str) -> List["IntegrationConnection"]:
    """Returns all active ATS connections for a tenant."""
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(IntegrationConnection).where(
                IntegrationConnection.tenant_id == uuid.UUID(tenant_id),
                IntegrationConnection.is_active == True,
            )
        )
        return result.scalars().all()
