"""
DVT Talent AI — Notification Service
Handles system-to-recruiter alerts (e.g. Action Required, New Candidates).
Uses the per-tenant SMTP settings if available, else falls back to system SMTP.
"""
import structlog
from typing import Optional, List
from jinja2 import Template

try:
    from services.email_service import email_service
    from db.models import AsyncSessionLocal, User, Tenant, Candidate
except ImportError:
    from services.email_service import email_service
    from db.models import AsyncSessionLocal, User, Tenant, Candidate
from sqlalchemy import select

log = structlog.get_logger(__name__)

ACTION_REQUIRED_TEMPLATE = """
Hi {{ name }},

DVT Talent AI has an update regarding your job: {{ job_title }}.

Action Required: {{ action_description }}

Details:
{{ details }}

View in Dashboard: {{ dashboard_url }}

Best,
DVT Swarm Bot
"""

class NotificationService:
    async def notify_recruiter_action(
        self, 
        tenant_id: str, 
        action_type: str, 
        job_title: str,
        details: str
    ):
        """Sends an 'Action Required' email to all admins/recruiters of a tenant."""
        async with AsyncSessionLocal() as session:
            # 1. Get Tenant & Recruiters
            tenant = await session.get(Tenant, tenant_id)
            if not tenant:
                log.error("notification_failed_tenant_not_found", tenant_id=tenant_id)
                return

            result = await session.execute(
                select(User).where(User.tenant_id == tenant_id, User.role.in_(["admin", "recruiter"]))
            )
            recruiters = result.scalars().all()

            if not recruiters:
                log.warning("no_recruiters_to_notify", tenant_id=tenant_id)
                return

            # 2. Prepare Content
            template = Template(ACTION_REQUIRED_TEMPLATE)
            
            for recruiter in recruiters:
                html_content = template.render(
                    name=recruiter.first_name or "Recruiter",
                    job_title=job_title,
                    action_description=action_type,
                    details=details,
                    dashboard_url=f"https://app.dvt-talent-ai.com/dashboard"
                )

                # 3. Dispatch via Email Service
                try:
                    await email_service.send_email(
                        tenant_id=tenant_id,
                        # pyrefly: ignore [unexpected-keyword]
                        to_email=recruiter.email,
                        subject=f"⚠️ Action Required: {action_type}",
                        body=html_content
                    )
                    log.info("notification_sent", user_email=recruiter.email, type=action_type)
                except Exception as e:
                    log.error("notification_dispatch_failed", error=str(e), user=recruiter.email)

notification_service = NotificationService()
