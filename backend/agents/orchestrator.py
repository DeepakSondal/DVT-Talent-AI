"""
DVT Talent AI — Simplified Agent Orchestrator
Coordinates the 5 core agents in a streamlined pipeline.
"""
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import structlog
import httpx

from config import settings
from agents.pydantic_config import AgentDeps, get_pydantic_model

from agents.discovery_pydantic import discovery_agent
from agents.sourcing_pydantic import sourcing_agent
from agents.outreach_pydantic import outreach_agent
from agents.analytics_pydantic import analytics_agent
from agents.screening_pydantic import screening_agent
from agents.critic_pydantic import critic_agent
from agents.market_iq_pydantic import market_iq_agent
from services.notification_service import notification_service

log = structlog.get_logger(__name__)

def _get_agent_data(res: Any) -> Any:
    """Helper to safely retrieve data/output from Pydantic AI AgentRunResult across versions."""
    if hasattr(res, 'output'):
        return res.output
    if hasattr(res, 'data'):
        return res.data
    return res

def broadcast_signal(message: str, signal_type: str = "agent_info", tenant_id: str = "default", payload: Any = None):
    """Bridge to the Celery task broadcaster for live UI telemetry"""
    from workers.tasks import broadcast_signal as relay
    relay(message, signal_type, tenant_id, payload=payload)

class AgentOrchestrator:
    """
    Coordinates the modern DVT Talent AI pipeline using Pydantic AI:
    1. Discovery -> Market scan, lead finding, JD prep.
    2. Sourcing  -> Global talent search, resume scoring, integrity check.
    3. Outreach  -> Multichannel communication (locked for conflict resolution).
    4. Analytics -> Performance reporting.
    5. Screening -> Technical screen (optional).
    """
    
    def __init__(self, tenant_id: Optional[str] = None, job_id: Optional[str] = None):
        self.tenant_id = tenant_id
        self.job_id = job_id
        self.context = {"tenant_id": tenant_id, "job_id": job_id}
        self.agents = {
            "market_iq": market_iq_agent,
            "discovery": discovery_agent,
            "sourcing": sourcing_agent,
            "outreach": outreach_agent,
            "analytics": analytics_agent,
            "screening": screening_agent,
            "critic": critic_agent,
        }

    async def _resolve_tenant_keys(self) -> Dict[str, Optional[str]]:
        """Query the database to load and decrypt Team API Keys for this tenant."""
        from sqlalchemy import select
        from db.models import AsyncSessionLocal, Team, TeamApiKeys
        from services.security_service import decrypt_pii
        
        keys_dict = {
            "openai_key": None,
            "serper_key": None,
            "anthropic_key": None,
        }
        
        if not self.tenant_id or self.tenant_id == "default":
            return keys_dict
            
        try:
            async with AsyncSessionLocal() as session:
                import uuid
                tenant_uuid = uuid.UUID(self.tenant_id) if isinstance(self.tenant_id, str) else self.tenant_id
                
                stmt_team = select(Team).where(Team.tenant_id == tenant_uuid)
                res_team = await session.execute(stmt_team)
                team = res_team.scalar_one_or_none()
                
                if team:
                    stmt_keys = select(TeamApiKeys).where(TeamApiKeys.team_id == team.id)
                    res_keys = await session.execute(stmt_keys)
                    keys = res_keys.scalar_one_or_none()
                    
                    if keys:
                        if keys.openai_key:
                            keys_dict["openai_key"] = decrypt_pii(keys.openai_key)
                        if keys.serper_key:
                            keys_dict["serper_key"] = decrypt_pii(keys.serper_key)
                        if keys.anthropic_key:
                            keys_dict["anthropic_key"] = decrypt_pii(keys.anthropic_key)
        except Exception as e:
            log.warning("failed_to_resolve_tenant_keys", error=str(e), tenant_id=self.tenant_id)
            
        return keys_dict


    async def run_full_swarm(
        self,
        industry: str = "technology",
        location: str = "United States",
        enable_screening: bool = False,
        enable_microsite: bool = False,
        mock_mode: bool = False
    ) -> Dict[str, Any]:
        """Alias for compatibility with the native task runner"""
        return await self.run_full_pipeline(
            industry=industry,
            location=location,
            enable_screening=enable_screening,
            enable_microsite=enable_microsite,
            mock_mode=mock_mode
        )

    async def _run_agent_with_retry(
        self, agent, prompt: str, deps: Any, model: Any, model_settings: Optional[Dict[str, Any]] = None, max_attempts: int = 3
    ) -> Any:
        if hasattr(agent, "run_async"):
            return await agent.run_async(prompt, deps=deps, model=model, model_settings=model_settings)
        last_error = None
        for attempt in range(max_attempts):
            try:
                if attempt > 0:
                    await asyncio.sleep(4 * attempt)
                return await agent.run(prompt, deps=deps, model=model, model_settings=model_settings)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "rate_limit" in err_str or "tpm" in err_str or "too large" in err_str:
                    log.warning("agent_rate_limit_retry", attempt=attempt+1, error=str(e))
                    await asyncio.sleep(5 * (attempt + 1))
                else:
                    raise e
        raise last_error

    async def run_full_pipeline(
        self,
        industry: str = "technology",
        location: str = "United States",
        enable_screening: bool = False,
        enable_microsite: bool = False,
        mock_mode: bool = False
    ) -> Dict[str, Any]:
        pipeline_start = datetime.utcnow()
        log.info("unified_pipeline_started", industry=industry, location=location)
        
        results = {"stages": {}}

        async with httpx.AsyncClient() as client:
            t_keys = await self._resolve_tenant_keys()
            
            deps = AgentDeps(
                http_client=client, 
                tenant_id=self.tenant_id or "default",
                serper_key=t_keys.get("serper_key") or settings.serper_api_key,
                openai_key=t_keys.get("openai_key"),
                anthropic_key=t_keys.get("anthropic_key")
            )
            
            dynamic_model = get_pydantic_model(deps=deps)
            
            try:
                # 1. Market IQ
                broadcast_signal("Agent 'market_iq' initiating market analysis...", "agent_start", self.tenant_id)
                market_iq_res = await self._run_agent_with_retry(
                    market_iq_agent, f"Analyze {industry} market in {location}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                broadcast_signal("Agent 'market_iq' completed analysis.", "agent_success", self.tenant_id)
                m_data = _get_agent_data(market_iq_res)
                results["stages"]["market_iq"] = m_data.model_dump() if hasattr(m_data, 'model_dump') else m_data
                
                await asyncio.sleep(3)

                # 2. Discovery
                broadcast_signal("Agent 'discovery' extracting JD constraints...", "agent_start", self.tenant_id)
                discovery_res = await self._run_agent_with_retry(
                    discovery_agent, f"Identify leads and extract JD for {industry} in {location}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                broadcast_signal("Agent 'discovery' completed JD extraction.", "agent_success", self.tenant_id)
                
                await asyncio.sleep(3)

                # 3. Sourcing with Self-Healing Fallback Loop
                broadcast_signal("Agent 'sourcing' initiated node discovery...", "agent_start", self.tenant_id)
                
                disc_data = _get_agent_data(discovery_res)
                extracted_jd_data = "{}"
                if hasattr(disc_data, 'extracted_jd') and disc_data.extracted_jd:
                    extracted_jd_data = disc_data.extracted_jd.model_dump_json()
                elif hasattr(disc_data, 'optimized_jd') and disc_data.optimized_jd:
                    extracted_jd_data = disc_data.optimized_jd.model_dump_json()

                sourcing_res = await self._run_agent_with_retry(
                    sourcing_agent, f"Find candidates for {industry} roles in {location} matching constraints: {extracted_jd_data}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                
                sourc_data = _get_agent_data(sourcing_res)
                candidates = getattr(sourc_data, 'candidates', [])
                
                # THE FALLBACK PROTOCOL
                if len(candidates) < 3:
                    broadcast_signal("WARNING: Sourcing threshold unmet (0-2 nodes found). Initiating fallback to Discovery...", "agent_info", self.tenant_id)
                    await asyncio.sleep(3)
                    
                    discovery_res = await self._run_agent_with_retry(
                        discovery_agent, f"Extract JD for {industry} in {location}. PREVIOUS EXTRACTION YIELDED NO CANDIDATES. LOOSEN THE 'MUST-HAVE' CONSTRAINTS IMMEDIATELY.", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                    )
                    disc_data = _get_agent_data(discovery_res)
                    if hasattr(disc_data, 'extracted_jd') and disc_data.extracted_jd:
                        extracted_jd_data = disc_data.extracted_jd.model_dump_json()
                    elif hasattr(disc_data, 'optimized_jd') and disc_data.optimized_jd:
                        extracted_jd_data = disc_data.optimized_jd.model_dump_json()
                        
                    broadcast_signal("Agent 'sourcing' re-initiating hunt with loosened market constraints...", "agent_start", self.tenant_id)
                    await asyncio.sleep(3)
                    sourcing_res = await self._run_agent_with_retry(
                        sourcing_agent, f"Find candidates for {industry} roles in {location} matching loosened constraints: {extracted_jd_data}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                    )
                    sourc_data = _get_agent_data(sourcing_res)
                    candidates = getattr(sourc_data, 'candidates', [])

                broadcast_signal("Agent 'sourcing' completed node discovery.", "agent_success", self.tenant_id)
                await asyncio.sleep(3)

                # 3. Logic Audit (Critic) with Payload Trimming
                broadcast_signal("Agent 'critic' initiating logic audit...", "agent_start", self.tenant_id)
                
                sanitized_candidates = []
                for c in candidates:
                    c_dict = c.model_dump() if hasattr(c, 'model_dump') else c
                    sanitized_candidates.append({
                        "name": c_dict.get("full_name", ""),
                        "skills": c_dict.get("skills", []),
                        "experience": c_dict.get("experience_years", 0)
                    })
                
                audit_res = await self._run_agent_with_retry(
                    critic_agent, f"Audit these trimmed candidates: {sanitized_candidates}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                broadcast_signal("Agent 'critic' audit complete: Trust verified.", "agent_success", self.tenant_id)
                
                c_data = _get_agent_data(audit_res)
                results["stages"]["discovery"] = disc_data.model_dump() if hasattr(disc_data, 'model_dump') else disc_data
                results["stages"]["sourcing"] = sourc_data.model_dump() if hasattr(sourc_data, 'model_dump') else sourc_data
                results["stages"]["critic"] = c_data.model_dump() if hasattr(c_data, 'model_dump') else c_data
                
                await asyncio.sleep(3)

                # 4. Outreach
                broadcast_signal("Agent 'outreach' drafting personalized sequences in bulk...", "agent_start", self.tenant_id)
                
                candidate_names = [c.full_name if hasattr(c, 'full_name') else c.get('full_name', 'Unknown') for c in candidates[:5]]
                raw_role = getattr(disc_data, 'job_description', f"{industry} Role")
                role_desc = str(raw_role)[:200]
                
                out_res = await self._run_agent_with_retry(
                    outreach_agent, f"Draft personalized outreach for these candidates: {candidate_names} for role {role_desc}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                
                broadcast_signal("Agent 'outreach' sequence drafting complete.", "agent_success", self.tenant_id)
                out_data = _get_agent_data(out_res)
                results["stages"]["outreach"] = out_data.model_dump() if hasattr(out_data, 'model_dump') else out_data
                
                await asyncio.sleep(3)

                # 5. Analytics
                broadcast_signal("Agent 'analytics' generating run report...", "agent_start", self.tenant_id)
                analytics_res = await self._run_agent_with_retry(
                    analytics_agent, "Generate report for this run", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                )
                broadcast_signal("Agent 'analytics' report generated.", "agent_success", self.tenant_id)
                a_data = _get_agent_data(analytics_res)
                results["stages"]["analytics"] = a_data.model_dump() if hasattr(a_data, 'model_dump') else a_data
                
                # 6. Optional Screening
                if enable_screening:
                    await asyncio.sleep(3)
                    screening_results = []
                    for cand in candidates[:3]:
                        scr_res = await self._run_agent_with_retry(
                            screening_agent, f"Screen {getattr(cand, 'full_name', 'Candidate')} for role {role_desc}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 1200}
                        )
                        s_item = _get_agent_data(scr_res)
                        screening_results.append(s_item.model_dump() if hasattr(s_item, 'model_dump') else s_item)
                    results["stages"]["screening"] = screening_results

            except Exception as e:
                log.error("pipeline_failed", error=str(e))
                results["error"] = str(e)

        results["duration_seconds"] = (datetime.utcnow() - pipeline_start).total_seconds()
        return results


    # ── SWARM COMMAND CENTER: 3-Phase Execution ──────────────────────────────
    async def run_swarm_phase(self, phase: str, mode: str = "copilot", **kwargs) -> Dict[str, Any]:
        """Unified entry point for the 3-phase Swarm Command Center."""
        log.info("swarm_phase_initiated", phase=phase, mode=mode, tenant_id=self.tenant_id)
        
        async with httpx.AsyncClient() as client:
            t_keys = await self._resolve_tenant_keys()
            
            deps = AgentDeps(
                http_client=client, 
                tenant_id=self.tenant_id or "default",
                serper_key=t_keys.get("serper_key") or settings.serper_api_key,
                openai_key=t_keys.get("openai_key"),
                anthropic_key=t_keys.get("anthropic_key")
            )
            
            if phase == "discovery":
                return await self.run_discovery_phase(
                    deps, 
                    kwargs.get("industry"), 
                    kwargs.get("location"), 
                    mode=mode,
                    work_mode=kwargs.get("work_mode"),
                    target_company=kwargs.get("target_company"),
                    skills=kwargs.get("skills"),
                    job_title=kwargs.get("job_title")
                )
            elif phase == "sourcing":
                return await self.run_sourcing_phase(deps, kwargs.get("job_description"), kwargs.get("location"), mode=mode)
            elif phase == "outreach":
                return await self.run_outreach_phase(deps, kwargs.get("approved_candidates"), kwargs.get("job"), mode=mode)
            else:
                raise ValueError(f"Invalid swarm phase: {phase}")

    async def run_discovery_phase(
        self, 
        deps: AgentDeps, 
        industry: str, 
        location: str, 
        mode: str = "copilot",
        work_mode: Optional[str] = None,
        target_company: Optional[str] = None,
        skills: Optional[str] = None,
        job_title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Phase 1: Leads & Discovery with Hyper-Sourcing."""
        results = {}
        dynamic_model = get_pydantic_model(deps=deps)
        
        context_parts = []
        if job_title: context_parts.append(f"for {job_title}")
        if industry: context_parts.append(f"in {industry} sector")
        if location: context_parts.append(f"in {location}")
        if work_mode: context_parts.append(f"({work_mode} mode)")
        if target_company: context_parts.append(f"targeting company: {target_company}")
        if skills: context_parts.append(f"requiring {skills}")
        
        full_context = " ".join(context_parts)
        
        broadcast_signal(f"Discovery Agent scanning {full_context}...", "agent_start", self.tenant_id)
        
        res_iq = await market_iq_agent.run(f"Analyze market trends {full_context}", deps=deps, model=dynamic_model)
        m_data = _get_agent_data(res_iq)
        results["market_iq"] = m_data.model_dump() if hasattr(m_data, 'model_dump') else m_data
        broadcast_signal("Market IQ Analysis Complete: Strategic vectors identified.", "agent_info", self.tenant_id, payload={"market_iq": results["market_iq"]})
        
        broadcast_signal(f"Synthesizing Hyper-Sourcing results {full_context}...", "agent_start", self.tenant_id)
        res_disc = await discovery_agent.run(f"Identify leads and optimize JD {full_context}", deps=deps, model=dynamic_model)
        d_data = _get_agent_data(res_disc)
        results["discovery"] = d_data.model_dump() if hasattr(d_data, 'model_dump') else d_data
        broadcast_signal("Hyper-Sourcing Complete: Market positioning and target nodes synthesized.", "agent_success", self.tenant_id, payload={"discovery": results["discovery"]})
        
        if mode == "copilot":
            await notification_service.notify_recruiter_action(
                tenant_id=deps.tenant_id,
                action_type="Hyper-Sourcing Ready",
                job_title=job_title or f"{industry} Role",
                details=f"The Discovery Agent has completed a deep-dive scan {full_context}."
            )
        
        return results

    async def run_sourcing_phase(self, deps: AgentDeps, job_description: str, location: str, mode: str = "copilot") -> Dict[str, Any]:
        """Phase 2: Talent Sourcing."""
        dynamic_model = get_pydantic_model(deps=deps)
        res = await sourcing_agent.run(f"Find candidates for: {job_description}", deps=deps, model=dynamic_model)
        s_data = _get_agent_data(res)
        sourcing_res = s_data.model_dump() if hasattr(s_data, 'model_dump') else s_data
        
        audit = await critic_agent.run(f"Audit: {s_data.model_dump_json() if hasattr(s_data, 'model_dump_json') else str(s_data)}", deps=deps, model=dynamic_model)
        a_data = _get_agent_data(audit)
        sourcing_res["audit"] = a_data.model_dump() if hasattr(a_data, 'model_dump') else a_data
        
        if mode == "copilot":
            cand_count = len(getattr(s_data, 'candidates', [])) if hasattr(s_data, 'candidates') else 0
            await notification_service.notify_recruiter_action(
                tenant_id=deps.tenant_id,
                action_type="Candidates Ready",
                job_title=job_description[:50],
                details=f"Found {cand_count} candidates."
            )
        return {"sourcing": sourcing_res}

    async def run_outreach_phase(self, deps: AgentDeps, approved_candidates: List[Dict[str, Any]], job: Dict[str, Any], mode: str = "copilot", enable_screening: bool = False) -> List[Dict[str, Any]]:
        """Phase 3: Signal Outreach with Batching and Opt-In Screening."""
        results = []
        dynamic_model = get_pydantic_model(deps=deps)
        
        MAX_DAILY_OUTREACH = 30
        if len(approved_candidates) > MAX_DAILY_OUTREACH:
            approved_candidates = approved_candidates[:MAX_DAILY_OUTREACH]
            print(f"WARNING: Outreach capped at {MAX_DAILY_OUTREACH} candidates to protect domain reputation.")
        
        candidate_names = [c.get("full_name") for c in approved_candidates]
        
        out = await outreach_agent.run(f"Draft outreach for {candidate_names} for role {job.get('title')}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 800})
        o_data = _get_agent_data(out)
        outreach_data = o_data.model_dump() if hasattr(o_data, 'model_dump') else o_data
        
        for cand in approved_candidates:
            res_item = {"candidate": cand.get("full_name"), "outreach": outreach_data}
            
            if enable_screening:
                scr = await screening_agent.run(f"Screen {cand.get('full_name')} for {job.get('title')}", deps=deps, model=dynamic_model, model_settings={"max_tokens": 400})
                sc_data = _get_agent_data(scr)
                res_item["screening"] = sc_data.model_dump() if hasattr(sc_data, 'model_dump') else sc_data
                
            results.append(res_item)
            
        return results
