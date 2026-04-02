"""
DVT Talent AI — Outreach Agent
Writes hyper-personalized cold emails and manages sending via Gmail API.
Handles candidate outreach AND client/lead outreach.
"""
import json
import base64
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from agents.base_agent import BaseAgent
from config import settings


SYSTEM_PROMPT = """You are an elite email copywriter and outreach specialist for DVT Talent AI.
You write short, highly personalized, human-sounding cold emails that get replies.

Core principles:
1. SHORT: Max 5 sentences. No fluff.
2. PERSONAL: Reference specific details about the recipient or company
3. VALUE-FIRST: Lead with what's in it for them
4. SINGLE CTA: One clear ask (a reply, a quick call)
5. HUMAN: Sound like a real person, not a bot
6. NO BUZZWORDS: Never say "synergy", "circle back", "leverage"

For candidate outreach: Make the opportunity sound exciting. Be brief.
For client outreach: Lead with candidates you have. Show results.

Return ONLY valid JSON. No extra text."""


class OutreachAgent(BaseAgent):
    """
    Writes & sends personalized outreach emails.
    Handles two modes:
    - Candidate outreach: Reaching out to potential candidates about open roles
    - Client outreach: Reaching out to HR managers about placing candidates
    """

    def __init__(self):
        super().__init__(
            name="outreach",
            description="Writes and sends personalized cold emails for recruiting outreach",
        )

    def run(
        self,
        outreach_type: str,  # "candidate" or "client"
        recipient: Dict[str, Any],
        context: Dict[str, Any],
        send_email: bool = False,
    ) -> Dict[str, Any]:
        self.log_start(f"Drafting {outreach_type} outreach to {recipient.get('email', 'unknown')}")

        try:
            if outreach_type == "candidate":
                email_data = self._write_candidate_email(recipient, context)
            elif outreach_type == "client":
                email_data = self._write_client_email(recipient, context)
            else:
                raise ValueError(f"Unknown outreach type: {outreach_type}")

            result = {
                "to_email": recipient.get("email"),
                "subject": email_data.get("subject", ""),
                "body": email_data.get("body", ""),
                "preview_text": email_data.get("preview", ""),
                "follow_up_day": email_data.get("follow_up_day", 3),
                "tracking_id": str(uuid.uuid4()),
                "sent": False,
            }

            if send_email and recipient.get("email") and settings.gmail_sender_email:
                send_result = self._send_via_gmail(
                    to_email=recipient["email"],
                    subject=result["subject"],
                    body=result["body"],
                    tracking_id=result["tracking_id"],
                )
                result["sent"] = send_result.get("success", False)
                result["gmail_message_id"] = send_result.get("message_id")

            # Save to Database
            self._save_to_db(outreach_type, recipient, result, context)

            self.log_complete(f"Email drafted for {recipient.get('email')}, sent={result['sent']}")
            return result

        except Exception as e:
            self.log_error(e)
            return {"error": str(e), "sent": False}

    def _save_to_db(self, outreach_type: str, recipient: Dict[str, Any], result: Dict[str, Any], context: Dict[str, Any]):
        """Save the outreach attempt to the database for tracking & review"""
        try:
            from sqlalchemy import create_engine, text
            from config import settings
            engine = create_engine(settings.database_sync_url)
            
            with engine.connect() as conn:
                # 1. Ensure a default campaign exists if not provided
                campaign_id = context.get("campaign_id")
                if not campaign_id:
                    # Find or create a 'General' campaign
                    campaign_name = f"General {outreach_type.capitalize()} Outreach"
                    row = conn.execute(
                        text("SELECT id FROM email_campaigns WHERE name = :name LIMIT 1"),
                        {"name": campaign_name}
                    ).fetchone()
                    if row:
                        campaign_id = str(row[0])
                    else:
                        campaign_id = str(uuid.uuid4())
                        conn.execute(
                            text("INSERT INTO email_campaigns (id, name, campaign_type, is_active) VALUES (:id, :name, :type, TRUE)"),
                            {"id": campaign_id, "name": campaign_name, "type": f"{outreach_type}_outreach"}
                        )

                # 2. Insert EmailSent record
                conn.execute(
                    text("""
                        INSERT INTO email_sent 
                        (id, campaign_id, to_email, subject, body, status, sent_at)
                        VALUES (:id, :cid, :email, :sub, :body, :status, :sent_at)
                    """),
                    {
                        "id": result["tracking_id"],
                        "cid": campaign_id,
                        "email": result["to_email"],
                        "sub": result["subject"],
                        "body": result["body"],
                        "status": "sent" if result["sent"] else "draft",
                        "sent_at": datetime.utcnow() if result["sent"] else None
                    }
                )
                conn.commit()
        except Exception as e:
            self.log.error("db_save_failed", error=str(e))

    def _write_candidate_email(self, candidate: Dict[str, Any], context: Dict[str, Any]) -> dict:
        """Write personalized email to a candidate about an opportunity"""
        job = context.get("job", {})
        company = context.get("company", {})

        user_prompt = f"""Write a short, personalized cold email to this software engineer about a job opportunity.

CANDIDATE:
- Name: {candidate.get('first_name', 'there')} {candidate.get('last_name', '')}
- Current title: {candidate.get('title', 'Software Engineer')}
- Current company: {candidate.get('current_company', 'their company')}
- Top skills: {', '.join(candidate.get('skills', [])[:5])}
- GitHub: {candidate.get('github_url', 'N/A')}
- Source: {candidate.get('source', 'LinkedIn')}

JOB OPPORTUNITY:
- Role: {job.get('title', 'Senior Software Engineer')}
- Company: {company.get('name', 'an exciting startup')}
- Location: {job.get('location', 'Remote')} {'(Remote OK)' if job.get('remote') else ''}
- Salary: ${job.get('salary_min', 120)}k-${job.get('salary_max', 180)}k
- Tech stack: {', '.join(job.get('skills_required', [])[:5])}

PERSONALIZATION HOOKS (use 1-2):
- Their GitHub has impressive contributions → mention specific value
- They recently changed companies → timing might be right
- Their skills match perfectly → call this out specifically

Return JSON:
{{
  "subject": "Quick question about your Python work",
  "body": "Hi [Name],\\n\\n[3-4 sentence email]\\n\\nBest,\\nAlex\\nDVT Talent AI",
  "preview": "First line of email...",
  "follow_up_day": 3,
  "personalization_used": "GitHub contributions in Python"
}}"""

        try:
            response = self.chat(SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.7)
            return json.loads(response)
        except Exception:
            return {
                "subject": f"Opportunity: {job.get('title', 'Senior Engineer')} role",
                "body": f"Hi {candidate.get('first_name', 'there')},\n\nI came across your profile and think you'd be a great fit for a {job.get('title', 'senior engineering')} role at {company.get('name', 'an exciting company')}. The role is {job.get('location', 'remote')} with a strong team.\n\nWould you be open to a quick 15-minute chat?\n\nBest,\nAlex\nDVT Talent AI",
                "preview": "Quick opportunity question",
                "follow_up_day": 3,
            }

    def _write_client_email(self, contact: Dict[str, Any], context: Dict[str, Any]) -> dict:
        """Write personalized email to a hiring manager/HR director"""
        company = context.get("company", {})
        candidates = context.get("candidates", [])
        open_roles = context.get("open_roles", [])

        candidate_teaser = ""
        if candidates:
            candidate_teaser = f"I currently have {len(candidates)} pre-vetted {open_roles[0] if open_roles else 'senior engineer'}s available immediately."

        user_prompt = f"""Write a short, compelling cold email to this hiring manager about recruiting services.

RECIPIENT:
- Name: {contact.get('first_name', 'there')} {contact.get('last_name', '')}
- Title: {contact.get('title', 'VP of Engineering')}
- Company: {company.get('name', 'their company')}
- Company industry: {company.get('industry', 'technology')}
- Company size: {company.get('size', '51-200')}

CONTEXT:
- Their open roles: {', '.join(open_roles[:3]) if open_roles else 'software engineers'}
- Hiring signals: {', '.join([str(s) for s in company.get('hiring_signals', [])[:2]])}
- {candidate_teaser}

ANGLE: Lead with the candidate teaser if available. Otherwise lead with a specific observation about their company.
Keep it to 4 sentences max. End with one soft CTA.

Return JSON:
{{
  "subject": "3 senior Python engineers → {company_name}?",
  "body": "Hi [Name],\\n\\n[4 sentence email]\\n\\nBest,\\nAlex\\nDVT Talent AI",
  "preview": "First line...",
  "follow_up_day": 4,
  "angle_used": "candidate teaser"
}}"""

        try:
            response = self.chat(SYSTEM_PROMPT, user_prompt, json_mode=True, temperature=0.7)
            data = json.loads(response)
            # Replace placeholder
            company_name = company.get('name', 'your company')
            data["subject"] = data.get("subject", "").replace("{company_name}", company_name)
            return data
        except Exception:
            return {
                "subject": f"Senior engineers for {company.get('name', 'your team')}",
                "body": f"Hi {contact.get('first_name', 'there')},\n\nI saw {company.get('name', 'your company')} is expanding its engineering team. I specialize in placing senior {open_roles[0] if open_roles else 'software'} engineers and have a few strong candidates available now.\n\nWould it be worth a quick call this week?\n\nBest,\nAlex\nDVT Talent AI",
                "preview": "Senior engineers available",
                "follow_up_day": 4,
            }

    def generate_follow_up(self, original_email: Dict[str, Any], day_number: int = 1) -> dict:
        """Generate follow-up email for no-reply sequences"""
        follow_up_templates = [
            {
                "subject": f"Re: {original_email.get('subject', '')}",
                "body": f"Hi,\n\nJust bumping this up in case it got buried. Happy to share more details if helpful.\n\nBest,\nAlex",
            },
            {
                "subject": f"Re: {original_email.get('subject', '')}",
                "body": f"Hi,\n\nLast follow-up from me — if the timing isn't right, no worries at all. Happy to reconnect whenever works better.\n\nBest,\nAlex",
            },
        ]
        index = min(day_number - 1, len(follow_up_templates) - 1)
        return follow_up_templates[index]

    def _send_via_gmail(self, to_email: str, subject: str, body: str, tracking_id: str) -> dict:
        """Send email via Gmail API with open tracking pixel"""
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build

            creds = Credentials(
                token=None,
                refresh_token=settings.gmail_refresh_token,
                client_id=settings.gmail_client_id,
                client_secret=settings.gmail_client_secret,
                token_uri="https://oauth2.googleapis.com/token",
            )
            service = build("gmail", "v1", credentials=creds)

            # FIX [M-07]: Use APP_BASE_URL from settings, not hardcoded placeholder
            tracking_pixel = (
                f'<img src="{settings.app_base_url}/api/v1/track/{tracking_id}/open" '
                f'width="1" height="1" style="display:none" />'
            )
            html_body = body.replace("\n", "<br>") + tracking_pixel

            message = MIMEMultipart("alternative")
            message["to"] = to_email
            message["from"] = settings.gmail_sender_email
            message["subject"] = subject
            message.attach(MIMEText(body, "plain"))
            message.attach(MIMEText(html_body, "html"))

            raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
            sent = service.users().messages().send(
                userId="me", body={"raw": raw}
            ).execute()

            return {"success": True, "message_id": sent["id"]}

        except Exception as e:
            self.log.error("gmail_send_failed", error=str(e))
            return {"success": False, "error": str(e)}

    def write_bulk_campaign(
        self,
        outreach_type: str,
        recipients: List[Dict[str, Any]],
        context: Dict[str, Any],
        send: bool = False,
    ) -> List[Dict[str, Any]]:
        """Write emails for a bulk campaign"""
        results = []
        for recipient in recipients:
            result = self.run(outreach_type, recipient, context, send_email=send)
            result["recipient_id"] = recipient.get("id") or recipient.get("email")
            results.append(result)
        return results
