"""
DVT Talent AI — ATS Sync Celery Task
Background task: sync all enabled ATS connections for a tenant.
"""
import structlog

from workers.celery_app import celery_app

log = structlog.get_logger(__name__)


@celery_app.task(bind=True, name="workers.ats_tasks.sync_all_ats_jobs", max_retries=3)
def sync_all_ats_jobs(self, tenant_id: str):
    """
    Loops over all active ATS connections for a tenant and syncs jobs.
    Called from the scheduler or triggered manually via API.
    """
    import asyncio

    from integrations.unified_ats import get_all_enabled_connections, sync_jobs

    async def _run():
        connections = await get_all_enabled_connections(tenant_id)
        results = []
        for conn in connections:
            try:
                summary = await sync_jobs(tenant_id, conn.provider)
                results.append(summary)
                log.info("ats_sync_completed", provider=conn.provider, tenant_id=tenant_id, result=summary)
            except Exception as e:
                log.error("ats_sync_failed", provider=conn.provider, tenant_id=tenant_id, error=str(e))
                results.append({"provider": conn.provider, "error": str(e)})
        return results

    return asyncio.get_event_loop().run_until_complete(_run())


@celery_app.task(bind=True, name="workers.ats_tasks.export_candidate_task", max_retries=3)
def export_candidate_task(
    self,
    tenant_id: str,
    candidate_id: str,
    job_id: str,
    provider: str,
    triggered_by_user_id: str | None = None,
):
    """
    Fire-and-forget Celery task to push a candidate to an ATS.
    Used by SourcingAgent for auto-export when score > 80.
    """
    import asyncio

    from integrations.unified_ats import export_candidate

    async def _run():
        return await export_candidate(
            tenant_id=tenant_id,
            candidate_id=candidate_id,
            job_id=job_id,
            provider=provider,
            triggered_by_user_id=triggered_by_user_id,
        )

    try:
        result = asyncio.get_event_loop().run_until_complete(_run())
        log.info("ats_export_task_done", provider=provider, result=result)
        return result
    except Exception as exc:
        log.error("ats_export_task_failed", provider=provider, error=str(exc))
        raise self.retry(exc=exc, countdown=2 ** self.request.retries * 30) from exc
