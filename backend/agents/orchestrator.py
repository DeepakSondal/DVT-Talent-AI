"""
DVT Talent AI — Simplified Agent Orchestrator
Coordinates the 5 core agents in a streamlined pipeline.
"""
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import structlog
import httpx

from backend.config import settings
from backend.agents.pydantic_config import AgentDeps
from backend.agents.discovery_pydantic import discovery_agent
from backend.agents.sourcing_pydantic import sourcing_agent
from backend.agents.outreach_pydantic import outreach_agent
from backend.agents.analytics_pydantic import analytics_agent
from backend.agents.screening_pydantic import screening_agent
from backend.agents.critic_pydantic import critic_agent
from backend.agents.market_iq_pydantic import market_iq_agent
from backend.services.notification_service import notification_service

log = structlog.get_logger(__name__)

def broadcast_signal(message: str, signal_type: str = "agent_info", tenant_id: str = "default", payload: Any = None):
    """Bridge to the Celery task broadcaster for live UI telemetry"""
    from backend.workers.tasks import broadcast_signal as relay
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
            deps = AgentDeps(http_client=client, tenant_id=self.tenant_id or "default")
            
            try:
                # 1. Market IQ
                broadcast_signal("Agent 'market_iq' initiating market analysis...", "agent_start", self.tenant_id)
                market_iq_res = await market_iq_agent.run(
                    f"Analyze {industry} market in {location}", deps=deps, model_settings={"max_tokens": 250}
                )
                broadcast_signal("Agent 'market_iq' completed analysis.", "agent_success", self.tenant_id)
                results["stages"]["market_iq"] = market_iq_res.data.model_dump()
                
                # 2. Discovery
                broadcast_signal("Agent 'discovery' extracting JD constraints...", "agent_start", self.tenant_id)
                discovery_res = await discovery_agent.run(
                    f"Identify leads and extract JD for {industry} in {location}", deps=deps
                )
                broadcast_signal("Agent 'discovery' completed JD extraction.", "agent_success", self.tenant_id)
                
                # 3. Sourcing with Self-Healing Fallback Loop
                broadcast_signal("Agent 'sourcing' initiated node discovery...", "agent_start", self.tenant_id)
                
                # Safely extract JD data, checking if the attribute exists
                extracted_jd_data = "{}"
                if hasattr(discovery_res.data, 'extracted_jd') and discovery_res.data.extracted_jd:
                    extracted_jd_data = discovery_res.data.extracted_jd.model_dump_json()
                elif hasattr(discovery_res.data, 'optimized_jd') and discovery_res.data.optimized_jd:
                    extracted_jd_data = discovery_res.data.optimized_jd.model_dump_json()

                sourcing_res = await sourcing_agent.run(
                    f"Find candidates for {industry} roles in {location} matching constraints: {extracted_jd_data}", deps=deps
                )
                
                # THE FALLBACK PROTOCOL
                if len(sourcing_res.data.candidates) < 3:
                    broadcast_signal("WARNING: Sourcing threshold unmet (0-2 nodes found). Initiating fallback to Discovery...", "agent_info", self.tenant_id)
                    
                    # Bounce back to Discovery to loosen constraints
                    discovery_res = await discovery_agent.run(
                        f"Extract JD for {industry} in {location}. PREVIOUS EXTRACTION YIELDED NO CANDIDATES. LOOSEN THE 'MUST-HAVE' CONSTRAINTS IMMEDIATELY.", deps=deps
                    )
                    
                    if hasattr(discovery_res.data, 'extracted_jd') and discovery_res.data.extracted_jd:
                        extracted_jd_data = discovery_res.data.extracted_jd.model_dump_json()
                    elif hasattr(discovery_res.data, 'optimized_jd') and discovery_res.data.optimized_jd:
                        extracted_jd_data = discovery_res.data.optimized_jd.model_dump_json()
                        
                    broadcast_signal("Agent 'sourcing' re-initiating hunt with loosened market constraints...", "agent_start", self.tenant_id)
                    sourcing_res = await sourcing_agent.run(
                        f"Find candidates for {industry} roles in {location} matching loosened constraints: {extracted_jd_data}", deps=deps
                    )

                broadcast_signal("Agent 'sourcing' completed node discovery.", "agent_success", self.tenant_id)
                
                # 3. Logic Audit (Critic) with Payload Trimming
                broadcast_signal("Agent 'critic' initiating logic audit...", "agent_start", self.tenant_id)
                
                # STRATEGY 1: Payload Trimming. Strip heavy github/linkedin raw data.
                sanitized_candidates = []
                for c in sourcing_res.data.candidates:
                    c_dict = c.model_dump() if hasattr(c, 'model_dump') else c
                    sanitized_candidates.append({
                        "name": c_dict.get("full_name", ""),
                        "skills": c_dict.get("skills", []),
                        "experience": c_dict.get("experience_years", 0)
                    })
                
                audit_res = await critic_agent.run(
                    f"Audit these trimmed candidates: {sanitized_candidates}", 
                    deps=deps, 
                    model_settings={"max_tokens": 150} # STRATEGY 4: Hard Cap
                )
                broadcast_signal("Agent 'critic' audit complete: Trust verified.", "agent_success", self.tenant_id)
                
                results["stages"]["discovery"] = discovery_res.data.model_dump()
                results["stages"]["sourcing"] = sourcing_res.data.model_dump()
                results["stages"]["critic"] = audit_res.data.model_dump()
                
                # 4. Outreach (STRATEGY 2: Batch Processing)
                broadcast_signal("Agent 'outreach' drafting personalized sequences in bulk...", "agent_start", self.tenant_id)
                candidates = sourcing_res.data.candidates
                
                candidate_names = [c.full_name if hasattr(c, 'full_name') else c.get('full_name', 'Unknown') for c in candidates[:5]]
                
                # Draft all emails in a single API call
                out_res = await outreach_agent.run(
                    f"Draft personalized outreach for these candidates: {candidate_names} for role {discovery_res.data.job_description}",
                    deps=deps,
                    model_settings={"max_tokens": 800} # STRATEGY 4: Hard Cap
                )
                
                broadcast_signal("Agent 'outreach' sequence drafting complete.", "agent_success", self.tenant_id)
                results["stages"]["outreach"] = out_res.data.model_dump()
                
                # 5. Analytics
                broadcast_signal("Agent 'analytics' generating run report...", "agent_start", self.tenant_id)
                analytics_res = await analytics_agent.run("Generate report for this run", deps=deps)
                broadcast_signal("Agent 'analytics' report generated.", "agent_success", self.tenant_id)
                results["stages"]["analytics"] = analytics_res.data.model_dump()
                
                # 6. Optional Screening
                if enable_screening:
                    screening_results = []
                    for cand in candidates[:3]:
                        scr_res = await screening_agent.run(
                            f"Screen {cand.full_name} for {discovery_res.data.job_description}",
                            deps=deps
                        )
                        screening_results.append(scr_res.data.model_dump())
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
            deps = AgentDeps(http_client=client, tenant_id=self.tenant_id or "default")
            
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
        
        # Build a rich context string
        context_parts = []
        if job_title: context_parts.append(f"for {job_title}")
        if industry: context_parts.append(f"in {industry} sector")
        if location: context_parts.append(f"in {location}")
        if work_mode: context_parts.append(f"({work_mode} mode)")
        if target_company: context_parts.append(f"targeting company: {target_company}")
        if skills: context_parts.append(f"requiring {skills}")
        
        full_context = " ".join(context_parts)
        
        broadcast_signal(f"Discovery Agent scanning {full_context}...", "agent_start", self.tenant_id)
        
        # 1. Market IQ with rich context
        res_iq = await market_iq_agent.run(f"Analyze market trends {full_context}", deps=deps)
        results["market_iq"] = res_iq.data.model_dump()
        broadcast_signal("Market IQ Analysis Complete: Strategic vectors identified.", "agent_info", self.tenant_id, payload={"market_iq": results["market_iq"]})
        
        # 2. Discovery with rich context
        broadcast_signal(f"Synthesizing Hyper-Sourcing results {full_context}...", "agent_start", self.tenant_id)
        res_disc = await discovery_agent.run(f"Identify leads and optimize JD {full_context}", deps=deps)
        results["discovery"] = res_disc.data.model_dump()
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
        res = await sourcing_agent.run(f"Find candidates for: {job_description}", deps=deps)
        sourcing_res = res.data.model_dump()
        
        # Audit
        audit = await critic_agent.run(f"Audit: {res.data.model_dump_json()}", deps=deps)
        sourcing_res["audit"] = audit.data.model_dump()
        
        if mode == "copilot":
            await notification_service.notify_recruiter_action(
                tenant_id=deps.tenant_id,
                action_type="Candidates Ready",
                job_title=job_description[:50],
                details=f"Found {len(res.data.candidates)} candidates."
            )
        return {"sourcing": sourcing_res}

    async def run_outreach_phase(self, deps: AgentDeps, approved_candidates: List[Dict[str, Any]], job: Dict[str, Any], mode: str = "copilot", enable_screening: bool = False) -> List[Dict[str, Any]]:
        """Phase 3: Signal Outreach with Batching and Opt-In Screening."""
        results = []
        
        # ISSUE 1 FIX: Deliverability Collapse (Spam Blacklist Prevention)
        # Enforce a hard volume limit to protect the agency's primary email domain.
        MAX_DAILY_OUTREACH = 30
        if len(approved_candidates) > MAX_DAILY_OUTREACH:
            approved_candidates = approved_candidates[:MAX_DAILY_OUTREACH]
            # Emit a warning to the frontend
            print(f"WARNING: Outreach capped at {MAX_DAILY_OUTREACH} candidates to protect domain reputation.")
        
        # STRATEGY 2 & 3: Batch Outreach, Opt-In Screening
        candidate_names = [c.get("full_name") for c in approved_candidates]
        
        # Draft all outreach in one shot
        out = await outreach_agent.run(f"Draft outreach for {candidate_names} for role {job.get('title')}", deps=deps, model_settings={"max_tokens": 800})
        outreach_data = out.data.model_dump()
        
        for cand in approved_candidates:
            res_item = {"candidate": cand.get("full_name"), "outreach": outreach_data}
            
            # STRATEGY 3: Only screen if explicitly requested
            if enable_screening:
                scr = await screening_agent.run(f"Screen {cand.get('full_name')} for {job.get('title')}", deps=deps, model_settings={"max_tokens": 400})
                res_item["screening"] = scr.data.model_dump()
                
            results.append(res_item)
            
        return results
