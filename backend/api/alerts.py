"""
DVT Talent AI — Slack & Health Alerting
Runs as a standalone script (cron/scheduler) to check health endpoints
and fire Slack webhook alerts on failure.

Usage:
    python -m api.alerts
    # Or add to cron: */5 * * * * python -m api.alerts
"""
import asyncio
import httpx
import structlog
import os
from datetime import datetime, timezone

log = structlog.get_logger(__name__)

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:8000")

HEALTH_ENDPOINTS = {
    "database": f"{APP_BASE_URL}/health/db",
    "redis": f"{APP_BASE_URL}/health/redis",
    "llm": f"{APP_BASE_URL}/health/llm",
}


async def send_slack_alert(service: str, error: str):
    """Fire a Slack webhook with a structured alert message."""
    if not SLACK_WEBHOOK_URL:
        log.warning("slack_webhook_not_configured")
        return

    payload = {
        "text": f":red_circle: *DVT Talent AI — Health Alert*",
        "attachments": [
            {
                "color": "#FF0000",
                "fields": [
                    {"title": "Service", "value": service.upper(), "short": True},
                    {"title": "Status", "value": "UNHEALTHY", "short": True},
                    {"title": "Error", "value": error, "short": False},
                    {"title": "Timestamp", "value": datetime.now(timezone.utc).isoformat(), "short": True},
                    {"title": "Environment", "value": os.getenv("APP_ENV", "production"), "short": True},
                ],
                "footer": "DVT Talent AI Monitoring",
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(SLACK_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
            log.info("slack_alert_sent", service=service)
    except Exception as e:
        log.error("slack_alert_failed", error=str(e))


async def send_slack_recovery(service: str):
    """Fire a Slack webhook to announce service recovery."""
    if not SLACK_WEBHOOK_URL:
        return

    payload = {
        "text": f":large_green_circle: *DVT Talent AI — Service Recovered*",
        "attachments": [
            {
                "color": "#36a64f",
                "fields": [
                    {"title": "Service", "value": service.upper(), "short": True},
                    {"title": "Status", "value": "HEALTHY", "short": True},
                    {"title": "Timestamp", "value": datetime.now(timezone.utc).isoformat(), "short": True},
                ],
                "footer": "DVT Talent AI Monitoring",
            }
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(SLACK_WEBHOOK_URL, json=payload)
            resp.raise_for_status()
            log.info("slack_recovery_sent", service=service)
    except Exception as e:
        log.error("slack_recovery_failed", error=str(e))


# Simple state tracker to avoid alert storms (alert only on transition)
_previous_state: dict[str, bool] = {}


async def run_health_checks():
    """Run all health checks and fire alerts on status changes."""
    log.info("health_check_run_started")

    async with httpx.AsyncClient(timeout=10) as client:
        for service, url in HEALTH_ENDPOINTS.items():
            is_healthy = False
            error_msg = "Unknown"
            try:
                resp = await client.get(url)
                data = resp.json()
                is_healthy = resp.status_code == 200 and data.get("status") == "healthy"
                error_msg = data.get("error", "Status check failed")
            except Exception as e:
                error_msg = str(e)

            was_healthy = _previous_state.get(service, True)  # Assume healthy on first run

            if not is_healthy and was_healthy:
                # Transition: healthy → unhealthy
                log.error("service_went_unhealthy", service=service, error=error_msg)
                await send_slack_alert(service, error_msg)
            elif is_healthy and not was_healthy:
                # Transition: unhealthy → healthy
                log.info("service_recovered", service=service)
                await send_slack_recovery(service)

            _previous_state[service] = is_healthy

    log.info("health_check_run_completed", states=_previous_state)


if __name__ == "__main__":
    asyncio.run(run_health_checks())
