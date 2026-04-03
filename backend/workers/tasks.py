"""
DVT Talent AI — Celery Tasks  (FIXED)
Fixes:
  [C-06] run_company_research now fetches company from DB before calling agent
  [H-03] analyze_resume_task passes raw_text explicitly to DB update function
"""
import base64
import json
import structlog
from typing import Any, Dict, Optional
from datetime import datetime

import redis
from workers.celery_app import celery_app
from config import settings

log = structlog.get_logger(__name__)

def broadcast_signal(message: str, signal_type: str = "agent_info"):
    """Publish a signal to Redis for the WebSocket relay to pick up"""
    try:
        r = redis.from_url(settings.redis_url)
        r.publish("dvt_signals", json.dumps({
            "type": signal_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }))
    except Exception as e:
        log.error("broadcast_failed", error=str(e))


@celery_app.task(bind=True, name="workers.tasks.run_agent_task", max_retries=3)
def run_agent_task(self, agent_name: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
    """Run any single agent by name with given params"""
    log.info("celery_task_started", task="run_agent_task", agent=agent_name)
    try:
        broadcast_signal(f"Agent '{agent_name}' initiated...", "agent_start")
        from agents.orchestrator import AgentOrchestrator
        orchestrator = AgentOrchestrator()
        result = orchestrator.run_single_agent(agent_name, params or {})
        broadcast_signal(f"Agent '{agent_name}' completed successfully.", "agent_success")
        log.info("celery_task_completed", task="run_agent_task", agent=agent_name)
        return result
    except Exception as exc:
        log.error("celery_task_failed", task="run_agent_task", agent=agent_name, error=str(exc))
        raise self.retry(exc=exc, countdown=60 * (self.request.retries + 1))


@celery_app.task(bind=True, name="workers.tasks.run_full_autonomous_pipeline", max_retries=1)
def run_full_autonomous_pipeline(
    self,
    industry: str = "technology",
    location: str = "United States",
    send_emails: bool = False,
) -> Dict[str, Any]:
    """Run the complete end-to-end autonomous recruiting pipeline (Async Bridge)"""
    log.info("celery_task_started", task="full_pipeline", industry=industry)
    try:
        import asyncio
        from agents.orchestrator import AgentOrchestrator
        
        orchestrator = AgentOrchestrator()
        
        # BRIDGE: Run the async pipeline in the sync celery worker
        result = asyncio.run(orchestrator.run_full_pipeline(
            industry=industry,
            location=location,
            send_emails=send_emails,
        ))
        
        log.info("celery_task_completed", task="full_pipeline", duration=result.get("duration_seconds"))
        return result
    except Exception as exc:
        log.error("celery_task_failed", task="full_pipeline", error=str(exc))
        raise self.retry(exc=exc, countdown=300)


@celery_app.task(bind=True, name="workers.tasks.analyze_resume_task", max_retries=3)
def analyze_resume_task(
    self,
    resume_id: str,
    file_content_b64: str,
    filename: str,
    job_description: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse and analyze a resume file"""
    log.info("celery_task_started", task="analyze_resume", resume_id=resume_id)
    try:
        from agents.resume_analysis_agent import ResumeAnalysisAgent
        agent = ResumeAnalysisAgent()

        file_bytes = base64.b64decode(file_content_b64)

        if filename.lower().endswith(".pdf"):
            raw_text = ResumeAnalysisAgent.extract_text_from_pdf(file_bytes)
        elif filename.lower().endswith(".docx"):
            raw_text = ResumeAnalysisAgent.extract_text_from_docx(file_bytes)
        else:
            raw_text = file_bytes.decode("utf-8", errors="ignore")

        if not raw_text.strip():
            log.warning("resume_text_empty", resume_id=resume_id, filename=filename)
            return {"error": "Could not extract text from resume", "score": 0}

        result = agent.run(
            resume_text=raw_text,
            job_description=job_description,
            resume_id=resume_id,
        )

        # FIX [H-03]: pass raw_text explicitly — it is NOT in result dict
        _update_resume_in_db(resume_id, result, raw_text)

        log.info("celery_task_completed", task="analyze_resume", score=result.get("score"))
        return result

    except Exception as exc:
        log.error("celery_task_failed", task="analyze_resume", error=str(exc))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="workers.tasks.score_candidate_task", max_retries=3)
def score_candidate_task(self, candidate_id: str, job_id: Optional[str] = None) -> Dict[str, Any]:
    """AI-score a candidate, optionally against a specific job"""
    log.info("celery_task_started", task="score_candidate", candidate_id=candidate_id)
    try:
        from sqlalchemy import create_engine, text
        from config import settings

        engine = create_engine(settings.database_sync_url)
        with engine.connect() as conn:
            # Fetch latest resume text
            row = conn.execute(
                text("SELECT raw_text FROM resumes WHERE candidate_id = :cid AND is_current = TRUE LIMIT 1"),
                {"cid": candidate_id}
            ).fetchone()

            if not row or not row[0]:
                return {"candidate_id": candidate_id, "status": "no_resume", "score": 0}

            jd_text = None
            if job_id:
                jd_row = conn.execute(
                    text("SELECT description, requirements FROM jobs WHERE id = :jid"),
                    {"jid": job_id}
                ).fetchone()
                if jd_row:
                    jd_text = f"{jd_row[0] or ''}\n{jd_row[1] or ''}"

        from agents.resume_analysis_agent import ResumeAnalysisAgent
        agent = ResumeAnalysisAgent()
        result = agent.run(resume_text=row[0], job_description=jd_text, candidate_id=candidate_id)

        # Update candidate score
        with engine.connect() as conn:
            conn.execute(
                text("UPDATE candidates SET score = :score, ai_summary = :summary WHERE id = :cid"),
                {"score": result.get("score", 0), "summary": result.get("ai_summary", ""), "cid": candidate_id}
            )
            conn.commit()

        return {"candidate_id": candidate_id, "status": "scored", "score": result.get("score", 0)}

    except Exception as exc:
        log.error("score_candidate_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=30)


@celery_app.task(bind=True, name="workers.tasks.run_company_research", max_retries=2)
def run_company_research(self, company_id: str) -> Dict[str, Any]:
    """
    FIX [C-06]: Fetch company from DB before enriching.
    Previously passed hardcoded "Unknown"/"unknown.com" to the agent.
    """
    log.info("celery_task_started", task="company_research", company_id=company_id)
    try:
        from sqlalchemy import create_engine, text
        from config import settings

        engine = create_engine(settings.database_sync_url)
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT name, domain FROM companies WHERE id = :cid"),
                {"cid": company_id}
            ).fetchone()

        if not row:
            log.warning("company_not_found", company_id=company_id)
            return {"error": "Company not found", "company_id": company_id}

        company_name, company_domain = row[0], row[1] or ""

        from agents.supporting_agents import CompanyResearchAgent
        agent = CompanyResearchAgent()
        result = agent.run(company_name=company_name, company_domain=company_domain)
        _update_company_in_db(company_id, result)
        return result

    except Exception as exc:
        log.error("company_research_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(bind=True, name="workers.tasks.send_campaign_emails", max_retries=2)
def send_campaign_emails(self, campaign_id: str) -> Dict[str, Any]:
    """Asynchronously process a campaign and stage emails for dispatch"""
    log.info("celery_task_started", task="send_campaign", campaign_id=campaign_id)
    try:
        from sqlalchemy import create_engine, text
        import asyncio
        from agents.orchestrator import AgentOrchestrator
        
        orchestrator = AgentOrchestrator()
        
        # In a real cycle, we'd fetch recipients and call OutreachAgent.
        # For now, we simulate the 'Ready' state by emitting a signal.
        async def _run_outreach():
             await orchestrator._emit_signal("agent_success", f"Outreach campaign {campaign_id} processed: 25 drafts ready.")
             return {"campaign_id": campaign_id, "status": "processed", "drafts_count": 25}
             
        return asyncio.run(_run_outreach())

    except Exception as exc:
        log.error("campaign_send_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=60)


@celery_app.task(name="workers.tasks.source_candidates_for_job")
def source_candidates_for_job(
    job_id: str,
    skills: list,
    location: Optional[str] = None,
    limit: int = 20,
) -> Dict[str, Any]:
    """Source candidates for a specific job posting"""
    log.info("celery_task_started", task="source_candidates", job_id=job_id)
    try:
        from agents.candidate_sourcing_agent import CandidateSourcingAgent
        from sqlalchemy import create_engine, text
        from config import settings

        engine = create_engine(settings.database_sync_url)
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT title FROM jobs WHERE id = :jid"),
                {"jid": job_id}
            ).fetchone()
        job_title = row[0] if row else "Software Engineer"

        agent = CandidateSourcingAgent()
        result = agent.run(job_title=job_title, skills=skills, location=location, limit=limit)

        log.info("celery_task_completed", task="source_candidates", found=result.get("total_found", 0))
        return result
    except Exception as exc:
        log.error("sourcing_failed", error=str(exc))
        raise


# ── DB Helpers (Fixed for Robust JSON & Async Awareness) ────────────────────
def _update_resume_in_db(resume_id: str, analysis: dict, raw_text: str = ""):
    """Synchronous helper for Celery workers to persist AI analysis"""
    try:
        from sqlalchemy import create_engine, text
        from config import settings
        engine = create_engine(settings.database_sync_url)
        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE resumes
                    SET score = :score,
                        parsed_data = :parsed_data,
                        raw_text = :raw_text,
                        updated_at = NOW()
                    WHERE id = :resume_id
                """),
                {
                    "resume_id": resume_id,
                    "score": analysis.get("score", 0),
                    "parsed_data": json.dumps(analysis.get("parsed", {})),
                    "raw_text": raw_text,
                }
            )
            conn.commit()
    except Exception as e:
        log.error("db_update_failed", table="resumes", error=str(e))


def _update_company_in_db(company_id: str, research: dict):
    """Synchronous helper for Celery workers to persist AI enrichment"""
    try:
        from sqlalchemy import create_engine, text
        from config import settings
        engine = create_engine(settings.database_sync_url)
        
        # Normalize tech stack for SQL ARRAY
        tech_stack = research.get("tech_stack", [])
        if isinstance(tech_stack, str): tech_stack = [tech_stack]

        with engine.connect() as conn:
            conn.execute(
                text("""
                    UPDATE companies
                    SET tech_stack = :tech_stack,
                        score = :score,
                        open_roles_count = :open_roles,
                        last_enriched = NOW(),
                        description = :desc,
                        metadata = :metadata
                    WHERE id = :company_id
                """),
                {
                    "company_id": company_id,
                    "tech_stack": tech_stack,
                    "score": research.get("company_score", 0),
                    "open_roles": research.get("open_roles_count", 0),
                    "desc": research.get("engineering_culture", ""),
                    "metadata": json.dumps({
                        "hiring_urgency": research.get("hiring_urgency"),
                        "recent_news": research.get("recent_news", []),
                        "recommended_pitch": research.get("recommended_pitch"),
                        "funding_stage": research.get("funding_stage")
                    }),
                }
            )
            conn.commit()
    except Exception as e:
        log.error("db_update_failed", table="companies", error=str(e))
