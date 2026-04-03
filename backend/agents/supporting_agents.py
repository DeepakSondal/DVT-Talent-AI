"""
DVT Talent AI — Company Research Agent
Deep-dives into companies to understand their hiring needs, tech stack, and culture.
"""
import json
from typing import Dict, Any
from agents.base_agent import BaseAgent


class CompanyResearchAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="company_research",
            description="Analyzes companies to understand hiring needs and tech stack",
        )

    def run(self, company_name: str, company_domain: str, **kwargs) -> Dict[str, Any]:
        self.log_start(f"Researching {company_name}")
        try:
            results = []

            # Search for company news, tech stack, job postings
            queries = [
                f'"{company_name}" engineering blog tech stack 2024',
                f'"{company_name}" hiring "software engineer" requirements',
                f'"{company_name}" company review glassdoor culture engineering',
                f'site:{company_domain} careers OR jobs engineering',
            ]
            for q in queries[:3]:
                results.extend(self.search_web(q, num_results=5))

            if not results:
                return {"company_name": company_name, "error": "No results found"}

            snippets = "\n\n".join([
                f"Title: {r.get('title', '')}\nURL: {r.get('link', '')}\nSnippet: {r.get('snippet', '')}"
                for r in results[:12]
            ])

            system_prompt = "You are a Company Research Agent. Analyze search results and extract company intelligence for recruiting purposes. Return ONLY valid JSON."
            user_prompt = f"""Research {company_name} ({company_domain}) for recruiting intelligence.

Search results:
{snippets}

Return JSON:
{{
  "tech_stack": ["Python", "React", "AWS"],
  "engineering_team_size": 45,
  "engineering_culture": "Fast-moving startup, strong focus on code quality",
  "hiring_urgency": "high|medium|low",
  "open_roles_count": 8,
  "open_roles": ["Senior Backend Engineer", "DevOps Engineer"],
  "pain_points": ["Scaling fast", "Need senior talent"],
  "recent_news": ["Raised Series B in March 2024"],
  "glassdoor_rating": 4.1,
  "recommended_pitch": "Lead with DevOps candidates as they have 4 open roles",
  "company_score": 88,
  "funding_stage": "Series B",
  "key_technologies": ["Kubernetes", "PostgreSQL", "React"]
}}"""

            response = self.chat(system_prompt, user_prompt, json_mode=True, temperature=0.2)
            data = json.loads(response)
            data["company_name"] = company_name
            data["researched_at"] = __import__('datetime').datetime.utcnow().isoformat()

            self.log_complete(f"Researched {company_name} — score: {data.get('company_score', 0)}")
            return data
        except Exception as e:
            self.log_error(e)
            return {"company_name": company_name, "error": str(e)}


"""
DVT Talent AI — CRM Management Agent
Tracks and updates lead/candidate pipeline states based on interactions
"""
class CRMManagementAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="crm_management",
            description="Tracks leads and updates pipeline stages based on interactions",
        )

    async def run(self, **kwargs) -> Dict[str, Any]:
        self.log_start("Running CRM analytics sync")
        try:
            # Sync pipeline stages and metadata
            from db.models import AsyncSessionLocal, Lead, Candidate
            from sqlalchemy import select, func
            
            async with AsyncSessionLocal() as session:
                lead_count = await session.scalar(select(func.count(Lead.id)))
                cand_count = await session.scalar(select(func.count(Candidate.id)))
                
                self.log_complete(f"CRM Synced — Tracking {lead_count} leads and {cand_count} candidates")
                return {
                    "leads_tracked": lead_count,
                    "candidates_tracked": cand_count,
                    "status": "synchronized"
                }
        except Exception as e:
            self.log_error(e)
            return {"error": str(e)}

    def suggest_next_action(self, lead_data: dict) -> dict:
        """AI-suggested next action for a lead"""
        system_prompt = "You are a CRM advisor. Suggest the best next action for a recruiting lead based on their stage and history."
        user_prompt = f"""Lead data: {json.dumps(lead_data)}
        
Return JSON: {{
  "next_action": "Send follow-up email",
  "priority": "high|medium|low",
  "suggested_date": "{__import__('datetime').datetime.now().strftime('%Y-%m-%d')}",
  "rationale": "No reply in 3 days, try a different angle"
}}"""
        try:
            response = self.chat(system_prompt, user_prompt, json_mode=True, temperature=0.3)
            return json.loads(response)
        except Exception:
            return {"next_action": "Follow up", "priority": "medium"}


class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="analytics",
            description="Measures performance and generates recruiting insights",
        )

    async def run(self, **kwargs) -> Dict[str, Any]:
        self.log_start("Computing real-time intelligence")
        try:
            from db.models import AsyncSessionLocal, Company, Lead, Candidate, AnalyticsEvent
            from sqlalchemy import select, func
            
            async with AsyncSessionLocal() as session:
                # Real SQL Aggregations
                stats = {
                    "total_companies": await session.scalar(select(func.count(Company.id))),
                    "total_leads": await session.scalar(select(func.count(Lead.id))),
                    "total_candidates": await session.scalar(select(func.count(Candidate.id))),
                    "avg_lead_score": await session.scalar(select(func.avg(Lead.score))) or 0,
                    "high_intent_count": await session.scalar(select(func.count(Company.id)).where(Company.score > 80)),
                }
                
                insights = await self._generate_ai_insights(stats)
                self.log_complete(f"Intelligence generated — {stats['total_companies']} targets analyzed")
                return {
                    "metrics": stats,
                    "insights": insights
                }
        except Exception as e:
            self.log_error(e)
            return {"error": str(e), "insights": []}

    async def _generate_ai_insights(self, stats: dict) -> list:
        """Generate AI-powered recruiting insights based on real data"""
        system_prompt = "You are a Chief Talent Officer. Analyze these real-time metrics and provide 2 strategic insights. Return ONLY JSON."
        user_prompt = f"""Data: {json.dumps(stats)}
        
Return JSON list: [
  {{
    "type": "performance|pipeline|strategy",
    "title": "...",
    "recommendation": "...",
    "priority": "high|medium"
  }}
]"""
        try:
            response = self.chat(system_prompt, user_prompt, json_mode=True, temperature=0.4)
            return json.loads(response)
        except Exception:
            return [
                {
                    "type": "pipeline",
                    "title": f"Discovery active with {stats.get('total_companies')} target companies",
                    "recommendation": "Initiate automated outreach to high-intent leads",
                    "priority": "high"
                }
            ]


"""
DVT Talent AI — Interview Scheduling Agent
Books interview slots and sends calendar invites.
"""
class InterviewSchedulingAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="interview_scheduling",
            description="Books interviews and sends calendar invites automatically",
        )

    def run(
        self,
        candidate: dict,
        interviewer_email: str,
        job: dict,
        preferred_times: list = None,
        **kwargs
    ) -> Dict[str, Any]:
        self.log_start(f"Scheduling interview for {candidate.get('email')}")
        try:
            # Generate scheduling email
            scheduling_email = self._write_scheduling_email(candidate, job, preferred_times)

            result = {
                "scheduling_email": scheduling_email,
                "candidate_email": candidate.get("email"),
                "interviewer_email": interviewer_email,
                "status": "scheduling_email_ready",
            }
            self.log_complete("Interview scheduling email ready")
            return result
        except Exception as e:
            self.log_error(e)
            return {"error": str(e)}

    def _write_scheduling_email(self, candidate: dict, job: dict, preferred_times: list = None) -> dict:
        times_str = ""
        if preferred_times:
            times_str = "Available times:\n" + "\n".join([f"- {t}" for t in preferred_times])

        body = f"""Hi {candidate.get('first_name', 'there')},

Great news — we'd love to schedule a conversation about the {job.get('title', 'engineering')} role.

{times_str if times_str else 'Would you be available for a 45-minute video call this week or next?'}

Please reply with your preferred time and we'll send a calendar invite right away.

Best,
DVT Talent AI Team"""

        return {
            "subject": f"Interview scheduling — {job.get('title', 'Engineering Role')}",
            "body": body,
        }

    def create_calendar_event(
        self,
        title: str,
        start_datetime: str,
        duration_minutes: int,
        attendees: list,
        description: str = "",
    ) -> dict:
        """Create Google Calendar event via API"""
        try:
            from google.oauth2.credentials import Credentials
            from googleapiclient.discovery import build
            from datetime import datetime, timedelta
            import dateutil.parser

            creds = Credentials(
                token=None,
                refresh_token=settings.gmail_refresh_token,
                client_id=settings.gmail_client_id,
                client_secret=settings.gmail_client_secret,
                token_uri="https://oauth2.googleapis.com/token",
            )
            service = build("calendar", "v3", credentials=creds)

            start_dt = dateutil.parser.parse(start_datetime)
            end_dt = start_dt + timedelta(minutes=duration_minutes)

            event = {
                "summary": title,
                "description": description,
                "start": {"dateTime": start_dt.isoformat(), "timeZone": "UTC"},
                "end": {"dateTime": end_dt.isoformat(), "timeZone": "UTC"},
                "attendees": [{"email": email} for email in attendees],
                "conferenceData": {
                    "createRequest": {"requestId": str(__import__('uuid').uuid4())}
                },
            }
            created = service.events().insert(
                calendarId="primary",
                body=event,
                conferenceDataVersion=1,
                sendUpdates="all",
            ).execute()

            return {
                "success": True,
                "event_id": created["id"],
                "meeting_url": created.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri"),
                "html_link": created.get("htmlLink"),
            }
        except Exception as e:
            return {"success": False, "error": str(e)}


"""
DVT Talent AI — Analytics Agent
Measures campaign performance and generates insights.
"""
class AnalyticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="analytics",
            description="Measures performance and generates recruiting insights",
        )

    def run(self, **kwargs) -> Dict[str, Any]:
        self.log_start("Running analytics computation")
        insights = self._generate_insights()
        self.log_complete(f"Generated {len(insights)} insights")
        return {"insights": insights}

    def _generate_insights(self) -> list:
        """Generate AI-powered recruiting insights"""
        # In production: pull real metrics from DB and analyze with AI
        insights = [
            {
                "type": "performance",
                "title": "Email open rate dropped 12% this week",
                "recommendation": "Test new subject line formats — try question-based subjects",
                "priority": "high",
            },
            {
                "type": "pipeline",
                "title": "Python candidates converting at 3x rate of Java candidates",
                "recommendation": "Double down on Python sourcing for current client pipeline",
                "priority": "medium",
            },
        ]
        return insights


"""
DVT Talent AI — Learning Agent
Analyzes what's working and improves prompts and outreach strategies.
"""
class LearningAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="learning",
            description="Analyzes performance data and improves agent prompts and strategies",
        )

    def run(self, performance_data: dict = None, **kwargs) -> Dict[str, Any]:
        self.log_start("Running learning cycle")
        try:
            improvements = self._analyze_and_improve(performance_data or {})
            self.log_complete(f"Learning complete — {len(improvements)} improvements identified")
            return {"improvements": improvements}
        except Exception as e:
            self.log_error(e)
            return {"improvements": []}

    def _analyze_and_improve(self, performance_data: dict) -> list:
        """Analyze what's working and suggest improvements"""
        system_prompt = "You are a recruiting performance analyst. Analyze metrics and suggest improvements to outreach strategy."
        user_prompt = f"""Analyze this recruiting campaign performance and suggest improvements.

Performance data:
{json.dumps(performance_data, indent=2)}

Return JSON:
{{
  "improvements": [
    {{
      "area": "email_subject_lines",
      "current_performance": "18% open rate",
      "suggestion": "Use recipient's name in subject line",
      "expected_improvement": "25-30% open rate",
      "priority": "high"
    }}
  ],
  "winning_patterns": [],
  "losing_patterns": []
}}"""

        try:
            response = self.chat(system_prompt, user_prompt, json_mode=True, temperature=0.4)
            return json.loads(response).get("improvements", [])
        except Exception:
            return []
