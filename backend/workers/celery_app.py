"""
DVT Talent AI — Celery App Configuration (Simplified)
Background task queue for consolidated 5-agent operations.
"""
import os
import uuid
from typing import Optional

from celery import Celery
from celery.schedules import crontab

from config import settings

celery_app = Celery(
    "dvt_talent_ai",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["workers.tasks", "workers.ats_tasks"],
)

celery_app.conf.update(
    broker_connection_retry_on_startup=False,
    broker_connection_max_retries=1,
    broker_connection_retry=False,
    broker_connection_timeout=0.5,
    task_publish_retry=False,
    broker_transport_options={"max_retries": 1, "socket_timeout": 0.5, "socket_connect_timeout": 0.5},
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_max_retries=3,
    task_soft_time_limit=300,   # 5 minutes soft limit
    task_time_limit=600,        # 10 minutes hard limit
    result_expires=86400,       # Results expire in 24 hours
)

def _resolve_beat_tenant_id() -> Optional[str]:
    raw = (os.getenv("BEAT_TENANT_ID") or "").strip()
    if not raw or raw.lower() == "default":
        return None
    try:
        return str(uuid.UUID(raw))
    except (ValueError, TypeError):
        return None


_BEAT_TENANT_ID = _resolve_beat_tenant_id()

# ── Periodic Schedule (Autonomous Daily Operations) ─────────────────────────
celery_app.conf.beat_schedule = {
    # Periodic GDPR cleanup retry sweep every 15 minutes (reconciles broker outages)
    "periodic-gdpr-cleanup-sweep": {
        "task": "workers.tasks.process_pending_gdpr_cleanups_task",
        "schedule": crontab(minute="*/15"),
        "args": [],
        "kwargs": {},
    },
}

if _BEAT_TENANT_ID:
    celery_app.conf.beat_schedule.update({
        # Full pipeline runs every morning at 7 AM UTC (enabled only with valid BEAT_TENANT_ID)
        "daily-full-swarm-pipeline": {
            "task": "workers.tasks.run_full_autonomous_pipeline",
            "schedule": crontab(hour=7, minute=0),
            "args": [],
            "kwargs": {
                "industry": "technology",
                "location": "United States",
                "send_emails": True,
                "tenant_id": _BEAT_TENANT_ID,
            },
        },
        # Unified Discovery scan every 6 hours
        "swarm-discovery": {
            "task": "workers.tasks.run_agent_task",
            "schedule": crontab(hour="*/6", minute=30),
            "args": ["discovery"],
            "kwargs": {"params": {"industry": "technology"}, "tenant_id": _BEAT_TENANT_ID},
        },
        # Analytics & Learning refresh every 2 hours
        "swarm-analytics-refresh": {
            "task": "workers.tasks.run_agent_task",
            "schedule": crontab(minute=15, hour="*/2"),
            "args": ["analytics"],
            "kwargs": {"params": {}, "tenant_id": _BEAT_TENANT_ID},
        },
    })

from celery.signals import worker_process_init


@worker_process_init.connect
def init_worker(**kwargs):
    import structlog
    log = structlog.get_logger()
    try:
        if getattr(settings, "is_production", False):
            settings.validate_required_settings()
        # Note: Embedding warmup now handled inside SourcingAgent if needed
        log.info("celery_worker_process_init")
    except Exception as e:
        log.error("celery_worker_init_failed", error=str(e))
        if getattr(settings, "is_production", False):
            raise
