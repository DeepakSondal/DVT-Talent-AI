"""
DVT Talent AI — Celery Tasks (Simplified & Persistent)
Unified task execution for the 5-agent model with DB synchronization.
"""
import base64
import json
import structlog
import asyncio
from typing import Any, Dict, Optional
from datetime import datetime

import redis
from sqlalchemy import create_engine, text
from workers.celery_app import celery_app
from backend.config import settings
from backend.agents.orchestrator import AgentOrchestrator
from backend.agents.pydantic_config import AgentDeps
from backend.agents.discovery_pydantic import discovery_agent
from backend.agents.sourcing_pydantic import sourcing_agent
from backend.agents.outreach_pydantic import outreach_agent
from backend.agents.analytics_pydantic import analytics_agent
from backend.agents.screening_pydantic import screening_agent
from backend.agents.market_iq_pydantic import market_iq_agent

log = structlog.get_logger(__name__)

def broadcast_signal(message: str, signal_type: str = "agent_info", tenant_id: str = "default", payload: Any = None):
    """Publish a signal to Redis for the WebSocket relay to pick up"""
    try:
        r = redis.from_url(settings.redis_url)
        # Publish to tenant-specific channel so WebSocket relay can route it
        channel = f"dvt_signals:{tenant_id}"
        r.publish(channel, json.dumps({
            "type": signal_type,
            "message": message,
            "timestamp": datetime.utcnow().isoformat(),
            "tenant_id": tenant_id,
            "payload": payload
        }))
    except Exception as e:
        log.error("broadcast_failed", error=str(e))

# ── Unified Runner ──────────────────────────────────────────────────────────

@celery_app.task(bind=True, name="workers.tasks.run_agent_task", max_retries=3)
def run_agent_task(self, agent_name: str, params: Dict[str, Any] = None, tenant_id: str = "default") -> Dict[str, Any]:
    """Run any single agent by name (Discovery, Sourcing, Outreach, Analytics, Screening)"""
    log.info("celery_task_started", task="run_agent_task", agent=agent_name, tenant_id=tenant_id)
    try:
        broadcast_signal(f"Agent '{agent_name}' initiated sequence...", "agent_start", tenant_id=tenant_id)
        
        agents_map = {
            "discovery": discovery_agent,
            "sourcing": sourcing_agent,
            "outreach": outreach_agent,
            "analytics": analytics_agent,
            "screening": screening_agent,
            "market_iq": market_iq_agent
        }
        
        if agent_name not in agents_map:
            raise ValueError(f"Unknown agent: {agent_name}")
            
        agent = agents_map[agent_name]
        
        # Use httpx client for agent deps
        async def _run():
            async with httpx.AsyncClient() as client:
                deps = AgentDeps(http_client=client, tenant_id=tenant_id)
                # Run the Pydantic AI agent
                result = await agent.run(f"Process task with params: {json.dumps(params)}", deps=deps)
                return result.output.model_dump()

        import httpx
        result = asyncio.run(_run())
            
        broadcast_signal(f"Agent '{agent_name}' completed sequence.", "agent_success", tenant_id=tenant_id)
        log.info("celery_task_completed", task="run_agent_task", agent=agent_name)
        return result
    except Exception as exc:
        log.error("celery_task_failed", task="run_agent_task", agent=agent_name, error=str(exc))
        raise self.retry(exc=exc, countdown=60)

@celery_app.task(bind=True, name="workers.tasks.run_full_autonomous_pipeline", max_retries=1)
def run_full_autonomous_pipeline(
    self,
    industry: str = "technology",
    location: str = "United States",
    send_emails: bool = False,
    mock_mode: bool = False,
    tenant_id: str = "default",
) -> Dict[str, Any]:
    """Run the complete end-to-end 5-agent pipeline"""
    log.info("celery_task_started", task="full_pipeline", industry=industry, tenant_id=tenant_id)
    try:
        orchestrator = AgentOrchestrator(tenant_id=tenant_id)
        broadcast_signal(f"Initiating full swarm for {industry} in {location}...", "swarm_start", tenant_id=tenant_id)
        result = asyncio.run(orchestrator.run_full_pipeline(
            industry=industry,
            location=location,
            mock_mode=mock_mode
        ))
        log.info("celery_task_completed", task="full_pipeline")
        return result
    except Exception as exc:
        log.error("celery_task_failed", task="full_pipeline", error=str(exc))
        raise self.retry(exc=exc, countdown=300)

# ── Specialized Tasks (Legacy Support & Granular Control) ───────────────────

@celery_app.task(bind=True, name="workers.tasks.analyze_resume_task", max_retries=3)
def analyze_resume_task(
    self,
    resume_id: str,
    file_content_b64: str,
    filename: str,
    job_description: Optional[str] = None,
) -> Dict[str, Any]:
    """Parse and analyze a resume using SourcingAgent"""
    log.info("celery_task_started", task="analyze_resume", resume_id=resume_id)
    try:
        file_bytes = base64.b64decode(file_content_b64)
        
        # In a real impl, we'd use a PDF/Docx parser here. 
        # For now, passing placeholder or extracted text if available.
        raw_text = file_bytes.decode("utf-8", errors="ignore")
        
        async def _run():
            import httpx
            async with httpx.AsyncClient() as client:
                deps = AgentDeps(http_client=client, tenant_id="default")
                prompt = f"Analyze this resume against the JD: {job_description or 'Software Engineer'}. Resume text: {raw_text}"
                res = await sourcing_agent.run(prompt, deps=deps)
                return res.output.model_dump()
                
        result = asyncio.run(_run())
        
        # Persist results
        _update_resume_in_db(resume_id, result, raw_text)
        return result
    except Exception as exc:
        log.error("celery_task_failed", task="analyze_resume", error=str(exc))
        raise self.retry(exc=exc, countdown=30)

@celery_app.task(bind=True, name="workers.tasks.score_candidate_task", max_retries=3)
def score_candidate_task(self, candidate_id: str, job_id: Optional[str] = None) -> Dict[str, Any]:
    """Score a candidate using SourcingAgent"""
    log.info("celery_task_started", task="score_candidate", candidate_id=candidate_id)
    try:
        engine = create_engine(settings.database_sync_url)
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT raw_text FROM resumes WHERE candidate_id = :cid AND is_current = TRUE LIMIT 1"),
                {"cid": candidate_id}
            ).fetchone()
            
            if not row or not row[0]:
                return {"candidate_id": candidate_id, "status": "no_resume", "score": 0}
            
            jd_text = "Software Engineer"
            if job_id:
                jd_row = conn.execute(
                    text("SELECT description FROM jobs WHERE id = :jid"),
                    {"jid": job_id}
                ).fetchone()
                if jd_row: jd_text = jd_row[0]

        async def _run():
            import httpx
            async with httpx.AsyncClient() as client:
                deps = AgentDeps(http_client=client, tenant_id="default")
                prompt = f"Score this candidate against JD: {jd_text}. Candidate info: {row[0]}"
                res = await sourcing_agent.run(prompt, deps=deps)
                return res.output.model_dump()

        result = asyncio.run(_run())
        
        with engine.connect() as conn:
            candidates = result.get("candidates", [])
            cand_data = candidates[0] if candidates else {}
            conn.execute(
                text("UPDATE candidates SET score = :score, title = :title, ai_summary = :summary WHERE id = :cid"),
                {"score": cand_data.get("match_score", 0), 
                 "title": jd_text,
                 "summary": cand_data.get("ai_reasoning", {}).get("alignment", ""), 
                 "cid": candidate_id}
            )
            conn.commit()
            
        return {"candidate_id": candidate_id, "status": "scored"}
    except Exception as exc:
        log.error("ats_sync_failed", error=str(exc))
        raise self.retry(exc=exc, countdown=300)

# ── Copilot Celery Tasks (High Concurrency 1000+ Users) ──────────────────────

@celery_app.task(bind=True, name="workers.tasks.copilot_discovery_task", max_retries=5)
def copilot_discovery_task(self, task_id: str, industry: str, location: str, tenant_id: str):
    from backend.db.models import AgentTask, AgentTaskStatus, AsyncSessionLocal
    async def _run():
        orchestrator = AgentOrchestrator(tenant_id=tenant_id)
        try:
            results = await orchestrator.run_discovery_phase(industry, location)
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.output_data = results
                    task.status = AgentTaskStatus.AWAITING_INPUT
                    task.current_checkpoint = "discovery_complete"
                    await db.commit()
            broadcast_signal("Discovery phase completed.", "agent_success", tenant_id)
        except Exception as e:
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = str(e)
                    await db.commit()
            raise
    try:
        asyncio.run(_run())
    except Exception as exc:
        # Rate Limit Backoff: 4, 8, 16, 32, 64 seconds
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 2))

@celery_app.task(bind=True, name="workers.tasks.copilot_sourcing_task", max_retries=5)
def copilot_sourcing_task(self, task_id: str, approved_jd: str, location: str, tenant_id: str):
    from backend.db.models import AgentTask, AgentTaskStatus, AsyncSessionLocal
    async def _run():
        orchestrator = AgentOrchestrator(tenant_id=tenant_id)
        try:
            results = await orchestrator.run_sourcing_phase(approved_jd, location)
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.output_data = results
                    task.status = AgentTaskStatus.AWAITING_INPUT
                    task.current_checkpoint = "sourcing_complete"
                    await db.commit()
            broadcast_signal("Sourcing phase completed.", "agent_success", tenant_id)
        except Exception as e:
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = str(e)
                    await db.commit()
            raise
    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 2))

@celery_app.task(bind=True, name="workers.tasks.copilot_outreach_task", max_retries=5)
def copilot_outreach_task(self, task_id: str, approved_candidates: list, job_context: dict, tenant_id: str, enable_screening: bool = False):
    from backend.db.models import AgentTask, AgentTaskStatus, AsyncSessionLocal
    async def _run():
        orchestrator = AgentOrchestrator(tenant_id=tenant_id)
        try:
            results = await orchestrator.run_outreach_phase(approved_candidates, job_context, enable_screening=enable_screening)
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.output_data = {"outreach_results": results}
                    task.status = AgentTaskStatus.COMPLETED
                    task.current_checkpoint = "pipeline_complete"
                    await db.commit()
            broadcast_signal("Outreach pipeline completed.", "agent_success", tenant_id)
        except Exception as e:
            async with AsyncSessionLocal() as db:
                task = await db.get(AgentTask, task_id)
                if task:
                    task.status = AgentTaskStatus.FAILED
                    task.error_message = str(e)
                    await db.commit()
            raise
    try:
        asyncio.run(_run())
    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** (self.request.retries + 2))

# ── DB Helpers (Synchronous) ───────────────────────────────────────────────

def _update_resume_in_db(resume_id: str, analysis: dict, raw_text: str = ""):
    try:
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
    try:
        engine = create_engine(settings.database_sync_url)
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
                    "tech_stack": research.get("tech_stack", []),
                    "score": research.get("score", 0),
                    "open_roles": research.get("open_roles", 0),
                    "desc": research.get("description", ""),
                    "metadata": json.dumps(research.get("metadata", {})),
                }
            )
            conn.commit()
    except Exception as e:
        log.error("db_update_failed", table="companies", error=str(e))
