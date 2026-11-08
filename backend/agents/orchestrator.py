"""
DVT Talent AI — Unified Agent Orchestrator
Coordinates the 7-agent Pydantic AI recruitment swarm across discovery, sourcing,
anti-bias critic auditing, outreach generation, analytics, and screening.
"""
import sys

if __name__.startswith("backend.agents."):
    sys.modules[__name__.replace("backend.agents.", "agents.")] = sys.modules[__name__]
elif __name__.startswith("agents."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx
import structlog

try:
    from backend.config import settings
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore

try:
    from backend.agents.pydantic_config import AgentDeps, get_pydantic_model
    from backend.agents.discovery_pydantic import discovery_agent
    from backend.agents.sourcing_pydantic import sourcing_agent, prefetch_all_sourcing_signals
    from backend.agents.outreach_pydantic import outreach_agent
    from backend.agents.analytics_pydantic import analytics_agent
    from backend.agents.screening_pydantic import screening_agent
    from backend.agents.critic_pydantic import critic_agent
    from backend.services.notification_service import notification_service
    from backend.services.llm_guardrail_service import guardrail_service
except ImportError:
    from agents.pydantic_config import AgentDeps, get_pydantic_model  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.discovery_pydantic import discovery_agent  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.sourcing_pydantic import sourcing_agent, prefetch_all_sourcing_signals  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.outreach_pydantic import outreach_agent  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.analytics_pydantic import analytics_agent  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.screening_pydantic import screening_agent  # pyrefly: ignore[missing-import]  # type: ignore
    from agents.critic_pydantic import critic_agent  # pyrefly: ignore[missing-import]  # type: ignore
    from services.notification_service import notification_service  # pyrefly: ignore[missing-import]  # type: ignore
    from services.llm_guardrail_service import guardrail_service  # pyrefly: ignore[missing-import]  # type: ignore


log = structlog.get_logger(__name__)

# Short-lived TTL cache for decrypted tenant keys: tenant_id -> (timestamp, keys_dict)
_TENANT_KEYS_CACHE: Dict[str, Tuple[float, Dict[str, Optional[str]]]] = {}

# Sourcing and outreach volume boundaries
_MIN_SOURCING_CANDIDATE_THRESHOLD = 3
_MAX_DAILY_OUTREACH_CAP = 30


def _get_agent_data(res: Any) -> Any:
    """Safely extracts payload from Pydantic AI AgentRunResult, RunResult, or mocks."""
    if hasattr(res, "output"):
        return res.output
    if hasattr(res, "data"):
        return res.data
    return res


def _serialize(obj: Any) -> Any:
    """Recursively serializes Pydantic models, dicts, dataclasses, and primitives."""
    if obj is None:
        return None
    if hasattr(obj, "model_dump") and callable(obj.model_dump):
        return obj.model_dump()
    if hasattr(obj, "dict") and callable(obj.dict):
        return obj.dict()
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_serialize(item) for item in obj]
    return obj


def _trim_candidates_for_critic(candidates: List[Any]) -> List[Dict[str, Any]]:
    """
    Strips non-predictive PII and heavy attributes before Critic audit.
    Satisfies NYC Local Law 144 / EU AI Act bias constraints and conserves token budget.
    """
    sanitized = []
    for c in candidates or []:
        if hasattr(c, "model_dump") and callable(c.model_dump):
            c_dict = c.model_dump()
        elif hasattr(c, "dict") and callable(c.dict):
            c_dict = c.dict()
        elif isinstance(c, dict):
            c_dict = c
        else:
            c_dict = {
                "full_name": getattr(c, "full_name", ""),
                "skills": getattr(c, "skills", []),
                "experience_years": getattr(c, "experience_years", 0),
            }
        sanitized.append({
            "name": c_dict.get("full_name") or c_dict.get("name", ""),
            "skills": c_dict.get("skills", []),
            "experience": c_dict.get("experience_years") or c_dict.get("experience", 0),
        })
    return sanitized


def broadcast_signal(message: str, signal_type: str = "agent_info", tenant_id: Optional[str] = "default", payload: Any = None):
    """Bridges telemetry to Celery & WebSocket bus (fast-skips if Redis broker is offline)."""
    from workers.tasks import broadcast_signal as relay, is_celery_broker_available
    if not is_celery_broker_available():
        return
    relay(message, signal_type, tenant_id or "default", payload=payload)


class AgentOrchestrator:
    """
    Coordinates the modern DVT Talent AI pipeline using Pydantic AI:
    1. Discovery -> Market scan, lead finding, JD constraint extraction.
    2. Sourcing  -> Concurrent multi-source search (VectorStore + GitHub + StackExchange + Serper).
    3. Critic    -> Anti-bias logic audit on trimmed candidate payloads.
    4. Post-Sourcing (Parallel) -> Concurrent Outreach drafting, Analytics reporting, Screening guide.
    """

    def __init__(self, tenant_id: Optional[str] = None, job_id: Optional[str] = None):
        self.tenant_id = tenant_id
        self.job_id = job_id
        self.context = {"tenant_id": tenant_id, "job_id": job_id}
        self.agents = {
            "discovery": discovery_agent,
            "sourcing": sourcing_agent,
            "outreach": outreach_agent,
            "analytics": analytics_agent,
            "screening": screening_agent,
            "critic": critic_agent,
        }

    async def _resolve_tenant_keys(self) -> Dict[str, Optional[str]]:
        """Queries DB to decrypt Team API Keys with 60-second in-memory TTL caching."""
        keys_dict: Dict[str, Optional[str]] = {
            "openai_key": None,
            "serper_key": None,
            "anthropic_key": None,
        }
        if not self.tenant_id or self.tenant_id == "default":
            return keys_dict

        try:
            tenant_uuid = uuid.UUID(str(self.tenant_id)) if not isinstance(self.tenant_id, uuid.UUID) else self.tenant_id
        except (ValueError, TypeError):
            return keys_dict

        cache_key = str(tenant_uuid)
        now = time.monotonic()
        cached_entry = _TENANT_KEYS_CACHE.get(cache_key)
        if cached_entry and (now - cached_entry[0]) < 60.0:
            return dict(cached_entry[1])

        try:
            from sqlalchemy import select
            from db.models import AsyncSessionLocal, Team, TeamApiKeys
            from services.security_service import decrypt_pii

            async with AsyncSessionLocal() as session:
                stmt = (
                    select(TeamApiKeys)
                    .join(Team, Team.id == TeamApiKeys.team_id)
                    .where(Team.tenant_id == tenant_uuid)
                    .limit(1)
                )
                res_keys = await session.execute(stmt)
                keys = res_keys.scalar_one_or_none()
                if keys:
                    if keys.openai_key:
                        keys_dict["openai_key"] = decrypt_pii(keys.openai_key)
                    if keys.serper_key:
                        keys_dict["serper_key"] = decrypt_pii(keys.serper_key)
                    if keys.anthropic_key:
                        keys_dict["anthropic_key"] = decrypt_pii(keys.anthropic_key)
            _TENANT_KEYS_CACHE[cache_key] = (now, dict(keys_dict))
        except Exception as e:
            log.warning("failed_to_resolve_tenant_keys", error=str(e), tenant_id=self.tenant_id)

        return keys_dict

    async def _run_agent_with_retry(
        self,
        agent: Any,
        prompt: str,
        deps: Any,
        model: Any,
        model_settings: Optional[Dict[str, Any]] = None,
        max_attempts: int = 3,
    ) -> Any:
        """Executes agent with token-bucket guardrail check and exponential backoff on 429 errors."""
        tenant_key = str(self.tenant_id or getattr(deps, "tenant_id", "default") or "default")
        allowed, rl_reason = await guardrail_service.check_rate_limit(tenant_id=tenant_key, provider="groq")
        if not allowed:
            log.warning("llm_guardrail_throttled", tenant_id=tenant_key, reason=rl_reason)
            await asyncio.sleep(2.0)

        if hasattr(agent, "run_async"):
            return await agent.run_async(prompt, deps=deps, model=model, model_settings=model_settings)

        last_error = None
        for attempt in range(max_attempts):
            try:
                if attempt > 0:
                    await asyncio.sleep(4.0 * attempt)
                return await agent.run(prompt, deps=deps, model=model, model_settings=model_settings)
            except Exception as e:
                last_error = e
                err_str = str(e).lower()
                if "429" in err_str or "rate_limit" in err_str or "tpm" in err_str or "too large" in err_str:
                    log.warning("agent_rate_limit_retry", attempt=attempt + 1, error=str(e))
                    await guardrail_service.record_provider_error(provider="groq", error_status=429)
                    await asyncio.sleep(5.0 * (attempt + 1))
                else:
                    raise e
        # pyrefly: ignore[bad-raise]
        raise last_error

    async def run_full_swarm(
        self,
        industry: str = "technology",
        location: str = "United States",
        enable_screening: bool = False,
        enable_microsite: bool = False,
        mock_mode: bool = False,
    ) -> Dict[str, Any]:
        """Alias for compatibility with api routes and legacy task runners."""
        return await self.run_full_pipeline(
            industry=industry,
            location=location,
            enable_screening=enable_screening,
            enable_microsite=enable_microsite,
            mock_mode=mock_mode,
        )

    async def run_full_pipeline(
        self,
        industry: str = "technology",
        location: str = "United States",
        enable_screening: bool = False,
        enable_microsite: bool = False,
        mock_mode: bool = False,
    ) -> Dict[str, Any]:
        """Runs the complete 5/6-stage recruitment swarm pipeline."""
        pipeline_start = datetime.now(timezone.utc)
        log.info("unified_pipeline_started", industry=industry, location=location)
        results: Dict[str, Any] = {"stages": {}}

        async with httpx.AsyncClient() as client:
            t_keys = {} if mock_mode else await self._resolve_tenant_keys()
            deps = AgentDeps(
                http_client=client,
                tenant_id=self.tenant_id or "default",
                serper_key=t_keys.get("serper_key") or settings.serper_api_key,
                openai_key=t_keys.get("openai_key"),
                anthropic_key=t_keys.get("anthropic_key"),
            )
            dynamic_model = get_pydantic_model(deps=deps)

            try:
                # 1. Discovery + Concurrent Deterministic Sourcing Pre-Fetch
                broadcast_signal("Agent 'discovery' extracting JD constraints...", "agent_start", self.tenant_id)
                is_sourcing_mocked = mock_mode or hasattr(sourcing_agent.run, "_mock_name")

                if not is_sourcing_mocked:
                    discovery_res, prefetched_signals = await asyncio.gather(
                        self._run_agent_with_retry(
                            discovery_agent,
                            f"Identify leads and extract JD for {industry} in {location}",
                            deps=deps,
                            model=dynamic_model,
                            model_settings={"max_tokens": 1200},
                        ),
                        prefetch_all_sourcing_signals(deps, f"{industry} {location}"),
                    )
                    prefetched_block = f"\n\nPre-fetched candidate signals:\n{prefetched_signals}"
                else:
                    discovery_res = await self._run_agent_with_retry(
                        discovery_agent,
                        f"Identify leads and extract JD for {industry} in {location}",
                        deps=deps,
                        model=dynamic_model,
                        model_settings={"max_tokens": 1200},
                    )
                    prefetched_block = ""

                broadcast_signal("Agent 'discovery' completed JD extraction.", "agent_success", self.tenant_id)

                # 2. Sourcing with Pre-Fetched Signals & Self-Healing Fallback Loop
                broadcast_signal("Agent 'sourcing' initiated node discovery...", "agent_start", self.tenant_id)
                disc_data = _get_agent_data(discovery_res)
                extracted_jd_data = self._format_jd_context(disc_data)

                sourcing_res = await self._run_agent_with_retry(
                    sourcing_agent,
                    f"Find candidates for {industry} roles in {location} matching constraints: {extracted_jd_data}{prefetched_block}",
                    deps=deps,
                    model=dynamic_model,
                    model_settings={"max_tokens": 1200},
                )
                sourc_data = _get_agent_data(sourcing_res)
                candidates = self._extract_candidates(sourc_data)

                # Sourcing Self-Healing Fallback Protocol
                if len(candidates) < _MIN_SOURCING_CANDIDATE_THRESHOLD:
                    broadcast_signal(
                        "WARNING: Sourcing threshold unmet (0-2 nodes found). Initiating fallback to Discovery...",
                        "agent_info",
                        self.tenant_id,
                    )
                    discovery_res = await self._run_agent_with_retry(
                        discovery_agent,
                        f"Extract JD for {industry} in {location}. PREVIOUS EXTRACTION YIELDED NO CANDIDATES. LOOSEN THE 'MUST-HAVE' CONSTRAINTS IMMEDIATELY.",
                        deps=deps,
                        model=dynamic_model,
                        model_settings={"max_tokens": 1200},
                    )
                    disc_data = _get_agent_data(discovery_res)
                    extracted_jd_data = self._format_jd_context(disc_data)

                    broadcast_signal(
                        "Agent 'sourcing' re-initiating hunt with loosened market constraints...",
                        "agent_start",
                        self.tenant_id,
                    )
                    sourcing_res = await self._run_agent_with_retry(
                        sourcing_agent,
                        f"Find candidates for {industry} roles in {location} matching loosened constraints: {extracted_jd_data}{prefetched_block}",
                        deps=deps,
                        model=dynamic_model,
                        model_settings={"max_tokens": 1200},
                    )
                    sourc_data = _get_agent_data(sourcing_res)
                    candidates = self._extract_candidates(sourc_data)

                broadcast_signal("Agent 'sourcing' completed node discovery.", "agent_success", self.tenant_id)

                # 3. Logic Audit (Critic) with Payload Trimming
                results["stages"]["discovery"] = _serialize(disc_data)
                results["stages"]["sourcing"] = _serialize(sourc_data)

                broadcast_signal("Agent 'critic' initiating logic audit...", "agent_start", self.tenant_id)
                sanitized_candidates = _trim_candidates_for_critic(candidates)
                audit_res = await self._run_agent_with_retry(
                    critic_agent,
                    f"Audit these trimmed candidates: {sanitized_candidates}",
                    deps=deps,
                    model=dynamic_model,
                    model_settings={"max_tokens": 1200},
                )
                c_data = _get_agent_data(audit_res)
                results["stages"]["critic"] = _serialize(c_data)
                audit_passed = getattr(c_data, "passed", True) if not isinstance(c_data, dict) else c_data.get("passed", True)
                broadcast_signal(
                    f"Agent 'critic' audit complete: {'Trust verified.' if audit_passed else 'Issues flagged for human review.'}",
                    "agent_success",
                    self.tenant_id,
                )

                # Persist sourced candidates and AI Decision Ledger records for real tenant workspaces
                if not mock_mode:
                    await self._persist_sourcing_and_ledger(
                        candidates=candidates,
                        audit_data=_serialize(c_data),
                        role_title=self._extract_role_summary(disc_data, industry),
                    )

                # 4, 5 & 6. Concurrent Post-Sourcing Execution (Outreach + Analytics + Optional Screening)
                candidate_names = [
                    c.get("full_name") or c.get("name") if isinstance(c, dict) else getattr(c, "full_name", str(c))
                    for c in candidates[:5]
                ]
                role_desc = self._extract_role_summary(disc_data, industry)

                broadcast_signal("Agent 'outreach' drafting personalized sequences in bulk...", "agent_start", self.tenant_id)
                broadcast_signal("Agent 'analytics' generating run report...", "agent_start", self.tenant_id)

                post_tasks = [
                    self._run_agent_with_retry(
                        outreach_agent,
                        f"Draft personalized outreach for these candidates: {candidate_names} for role {role_desc}",
                        deps=deps,
                        model=dynamic_model,
                        model_settings={"max_tokens": 1200},
                    ),
                    self._run_agent_with_retry(
                        analytics_agent,
                        f"Generate report for this run: role={role_desc}, sourced_candidates={len(candidates)}, audit={_serialize(c_data)}",
                        deps=deps,
                        model=dynamic_model,
                        model_settings={"max_tokens": 1200},
                    ),
                ]

                if enable_screening:
                    broadcast_signal("Agent 'screening' generating interview guide...", "agent_start", self.tenant_id)
                    post_tasks.append(
                        self._run_agent_with_retry(
                            screening_agent,
                            f"Generate interview guide and benchmark questions for role: {role_desc}. Requisition context: {extracted_jd_data}",
                            deps=deps,
                            model=dynamic_model,
                            model_settings={"max_tokens": 1500},
                        )
                    )

                post_results = await asyncio.gather(*post_tasks)

                out_data = _get_agent_data(post_results[0])
                results["stages"]["outreach"] = _serialize(out_data)
                broadcast_signal("Agent 'outreach' sequence drafting complete.", "agent_success", self.tenant_id)

                a_data = _get_agent_data(post_results[1])
                results["stages"]["analytics"] = _serialize(a_data)
                broadcast_signal("Agent 'analytics' report generated.", "agent_success", self.tenant_id)

                if enable_screening and len(post_results) > 2:
                    s_item = _get_agent_data(post_results[2])
                    results["stages"]["screening_guide"] = _serialize(s_item)
                    broadcast_signal("Agent 'screening' completed interview guide.", "agent_success", self.tenant_id)

            except Exception as e:
                log.error("pipeline_failed", error=str(e))
                results["error"] = str(e)

        results["duration_seconds"] = (datetime.now(timezone.utc) - pipeline_start).total_seconds()
        return results

    # ── SWARM COMMAND CENTER: 3-Phase Execution ──────────────────────────────
    async def run_swarm_phase(self, phase: str, mode: str = "copilot", **kwargs) -> Any:
        """Unified entry point for the 3-phase Swarm Command Center."""
        log.info("swarm_phase_initiated", phase=phase, mode=mode, tenant_id=self.tenant_id)
        mock_mode = kwargs.get("mock_mode", False)

        async with httpx.AsyncClient() as client:
            t_keys = {} if mock_mode else await self._resolve_tenant_keys()
            deps = AgentDeps(
                http_client=client,
                tenant_id=self.tenant_id or "default",
                serper_key=t_keys.get("serper_key") or settings.serper_api_key,
                openai_key=t_keys.get("openai_key"),
                anthropic_key=t_keys.get("anthropic_key"),
            )

            if phase == "discovery":
                return await self.run_discovery_phase(
                    deps,
                    industry=kwargs.get("industry", "technology"),
                    location=kwargs.get("location", "United States"),
                    mode=mode,
                    work_mode=kwargs.get("work_mode"),
                    target_company=kwargs.get("target_company"),
                    skills=kwargs.get("skills"),
                    job_title=kwargs.get("job_title"),
                )
            elif phase == "sourcing":
                return await self.run_sourcing_phase(
                    deps,
                    job_description=kwargs.get("job_description", ""),
                    location=kwargs.get("location", ""),
                    mode=mode,
                    mock_mode=mock_mode,
                )
            elif phase == "outreach":
                cands = kwargs.get("approved_candidates") or kwargs.get("recipients") or []
                job_ctx = kwargs.get("job") or {
                    "id": kwargs.get("job_id"),
                    "title": kwargs.get("campaign_name") or kwargs.get("job_title") or "Target Role",
                    "sequence_type": kwargs.get("sequence_type"),
                }
                return await self.run_outreach_phase(
                    deps,
                    approved_candidates=cands,
                    job=job_ctx,
                    mode=mode,
                    enable_screening=kwargs.get("enable_screening", False),
                    mock_mode=mock_mode,
                )
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
        job_title: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Phase 1: Leads & Discovery with Hyper-Sourcing."""
        results: Dict[str, Any] = {}
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
        broadcast_signal(f"Synthesizing Hyper-Sourcing results {full_context}...", "agent_start", self.tenant_id)

        res_disc = await self._run_agent_with_retry(
            discovery_agent,
            f"Identify leads and optimize JD {full_context}",
            deps=deps,
            model=dynamic_model,
        )
        d_data = _get_agent_data(res_disc)
        results["discovery"] = _serialize(d_data)
        broadcast_signal(
            "Hyper-Sourcing Complete: Market positioning and target nodes synthesized.",
            "agent_success",
            self.tenant_id,
            payload={"discovery": results["discovery"]},
        )

        if mode == "copilot":
            await notification_service.notify_recruiter_action(
                tenant_id=deps.tenant_id,
                action_type="Hyper-Sourcing Ready",
                job_title=job_title or f"{industry} Role",
                details=f"The Discovery Agent has completed a deep-dive scan {full_context}.",
            )

        return results

    async def run_sourcing_phase(
        self,
        deps: AgentDeps,
        job_description: str,
        location: str,
        mode: str = "copilot",
        mock_mode: bool = False,
    ) -> Dict[str, Any]:
        """Phase 2: Talent Sourcing with Concurrent Pre-Fetch and Trimmed Critic Audit."""
        dynamic_model = get_pydantic_model(deps=deps)
        is_sourcing_mocked = mock_mode or hasattr(sourcing_agent.run, "_mock_name")
        prefetched_block = ""
        if not is_sourcing_mocked:
            prefetched_signals = await prefetch_all_sourcing_signals(deps, f"{job_description or ''} {location or ''}".strip())
            prefetched_block = f"\n\nPre-fetched candidate signals:\n{prefetched_signals}"

        res = await self._run_agent_with_retry(
            sourcing_agent,
            f"Find candidates for: {job_description}{prefetched_block}",
            deps=deps,
            model=dynamic_model,
        )
        s_data = _get_agent_data(res)
        sourcing_res = _serialize(s_data)

        candidates = self._extract_candidates(s_data)
        sanitized_candidates = _trim_candidates_for_critic(candidates)

        audit = await self._run_agent_with_retry(
            critic_agent,
            f"Audit these trimmed candidates: {sanitized_candidates}",
            deps=deps,
            model=dynamic_model,
        )
        a_data = _get_agent_data(audit)
        if isinstance(sourcing_res, dict):
            sourcing_res["audit"] = _serialize(a_data)

        if not is_sourcing_mocked:
            await self._persist_sourcing_and_ledger(
                candidates=candidates,
                audit_data=_serialize(a_data),
                role_title=(job_description or "Target Role")[:80],
            )

        if mode == "copilot":
            cand_count = len(candidates)
            await notification_service.notify_recruiter_action(
                tenant_id=deps.tenant_id,
                action_type="Candidates Ready",
                job_title=(job_description or "Target Role")[:50],
                details=f"Found {cand_count} candidates.",
            )
        return {"sourcing": sourcing_res}

    async def run_outreach_phase(
        self,
        deps: AgentDeps,
        approved_candidates: List[Dict[str, Any]],
        job: Dict[str, Any],
        mode: str = "copilot",
        enable_screening: bool = False,
        mock_mode: bool = False,
    ) -> List[Dict[str, Any]]:
        """Phase 3: Signal Outreach with Batching and Opt-In Concurrent Screening."""
        results: List[Dict[str, Any]] = []
        dynamic_model = get_pydantic_model(deps=deps)

        if len(approved_candidates) > _MAX_DAILY_OUTREACH_CAP:
            approved_candidates = approved_candidates[:_MAX_DAILY_OUTREACH_CAP]
            log.warning("outreach_capped", cap=_MAX_DAILY_OUTREACH_CAP, tenant_id=deps.tenant_id)

        candidate_names = [
            c.get("full_name") or c.get("name") if isinstance(c, dict) else getattr(c, "full_name", str(c))
            for c in approved_candidates
        ]
        job_title = job.get("title") or job.get("role") or "Target Role"

        out_task = self._run_agent_with_retry(
            outreach_agent,
            f"Draft outreach for {candidate_names} for role {job_title}",
            deps=deps,
            model=dynamic_model,
            model_settings={"max_tokens": 800},
        )

        if enable_screening and job:
            scr_task = self._run_agent_with_retry(
                screening_agent,
                f"Generate interview guide for role: {job_title}. Description: {job.get('description', '')}",
                deps=deps,
                model=dynamic_model,
                model_settings={"max_tokens": 1500},
            )
            out_res, scr_res = await asyncio.gather(out_task, scr_task)
            screening_guide = _serialize(_get_agent_data(scr_res))
        else:
            out_res = await out_task
            screening_guide = None

        outreach_data = _serialize(_get_agent_data(out_res))
        drafts_list = outreach_data.get("drafts", []) if isinstance(outreach_data, dict) else []

        for idx, cand in enumerate(approved_candidates):
            cand_name = cand.get("full_name") or cand.get("name") if isinstance(cand, dict) else str(cand)
            cand_email = cand.get("email") if isinstance(cand, dict) else None
            matched_draft = None
            if drafts_list:
                for d in drafts_list:
                    if isinstance(d, dict) and cand_email and d.get("candidate_email") == cand_email:
                        matched_draft = d
                        break
                if not matched_draft:
                    matched_draft = drafts_list[idx % len(drafts_list)]
            cand_outreach = matched_draft if (matched_draft and isinstance(outreach_data, dict) and "subject" not in outreach_data) else outreach_data
            res_item = {"candidate": cand_name, "email": cand_email, "outreach": cand_outreach}
            if screening_guide:
                res_item["screening_guide"] = screening_guide
            results.append(res_item)

        if not mock_mode and not hasattr(outreach_agent.run, "_mock_name"):
            await self._persist_outreach_campaign(results=results, job=job)

        return results

    async def _persist_sourcing_and_ledger(
        self,
        candidates: List[Any],
        audit_data: Any,
        role_title: str,
    ) -> None:
        """Persists newly sourced candidates and AI Decision Ledger rows scoped to self.tenant_id."""
        if not self.tenant_id or self.tenant_id == "default" or not candidates:
            return
        try:
            tenant_uuid = uuid.UUID(str(self.tenant_id)) if not isinstance(self.tenant_id, uuid.UUID) else self.tenant_id
        except (ValueError, TypeError):
            return

        try:
            import hashlib
            from sqlalchemy import select
            from db.models import AsyncSessionLocal, Candidate, CandidateStatus, AIDecisionLedger

            job_uuid = None
            if self.job_id:
                try:
                    job_uuid = uuid.UUID(str(self.job_id))
                except (ValueError, TypeError):
                    job_uuid = None

            audit_passed = audit_data.get("passed", True) if isinstance(audit_data, dict) else True
            audit_rec = (audit_data.get("recommendation") if isinstance(audit_data, dict) else None) or (
                "APPROVED" if audit_passed else "PENDING_REVIEW"
            )

            async with AsyncSessionLocal() as session:
                for c in candidates:
                    c_dict = _serialize(c) if not isinstance(c, dict) else c
                    if not isinstance(c_dict, dict):
                        continue
                    full_name = str(c_dict.get("full_name") or c_dict.get("name") or "Talent Candidate").strip()
                    parts = full_name.split(" ", 1)
                    first_name = parts[0][:100] or "Candidate"
                    last_name = (parts[1] if len(parts) > 1 else "Profile")[:100]
                    email = c_dict.get("email")
                    if not email or "@" not in str(email):
                        slug = hashlib.md5(f"{tenant_uuid}:{full_name}".encode()).hexdigest()[:8]
                        email = f"{first_name.lower()}.{slug}@sourced.dvt-talent.io"

                    existing_res = await session.execute(
                        select(Candidate).where(
                            Candidate.tenant_id == tenant_uuid,
                            Candidate.email == str(email),
                        )
                    )
                    cand_row = existing_res.scalar_one_or_none()
                    raw_score = c_dict.get("match_score") or c_dict.get("score") or 85
                    try:
                        score_val = float(raw_score)
                    except (ValueError, TypeError):
                        score_val = 85.0

                    reasoning_val = c_dict.get("ai_reasoning") or c_dict.get("reasoning") or {}
                    if isinstance(reasoning_val, str):
                        summary_str = reasoning_val
                        reasoning_dict = {"alignment": reasoning_val}
                    elif isinstance(reasoning_val, dict):
                        summary_str = reasoning_val.get("alignment") or reasoning_val.get("summary") or json.dumps(reasoning_val)
                        reasoning_dict = reasoning_val
                    else:
                        summary_str = f"Sourced for {role_title}"
                        reasoning_dict = {"alignment": summary_str}

                    if not cand_row:
                        cand_row = Candidate(
                            tenant_id=tenant_uuid,
                            first_name=first_name,
                            last_name=last_name,
                            email=str(email),
                            phone=c_dict.get("phone"),
                            title=(c_dict.get("title") or role_title or "Software Engineer")[:255],
                            location=(c_dict.get("location") or "Remote")[:255],
                            linkedin_url=c_dict.get("linkedin_url"),
                            github_url=c_dict.get("github_url"),
                            skills=c_dict.get("skills") if isinstance(c_dict.get("skills"), list) else [],
                            experience_years=int(c_dict.get("experience_years") or c_dict.get("experience") or 5),
                            current_company=c_dict.get("company") or c_dict.get("current_company"),
                            status=CandidateStatus.SOURCED,
                            source=c_dict.get("source") or "AI Swarm",
                            score=score_val,
                            ai_summary=summary_str,
                            scoring_reasoning=reasoning_dict,
                        )
                        session.add(cand_row)
                        await session.flush()

                    input_hash = hashlib.sha256(f"{tenant_uuid}:{cand_row.email}:{role_title}".encode()).hexdigest()
                    ledger = AIDecisionLedger(
                        tenant_id=tenant_uuid,
                        job_id=job_uuid,
                        candidate_id=cand_row.id,
                        decision_type="sourcing_evaluation",
                        model_provider="Groq",
                        model_name=getattr(settings, "llm_model", "llama-3.3-70b-versatile"),
                        prompt_version="v2.0",
                        input_data_hash=input_hash,
                        qualification_score=int(round(score_val)),
                        confidence_level="HIGH" if score_val >= 85 else "MEDIUM",
                        evidence_signals={
                            "candidate_name": f"{cand_row.first_name} {cand_row.last_name}",
                            "candidate_email": cand_row.email,
                            "role_title": role_title,
                            "skills": cand_row.skills or [],
                            "critic_passed": audit_passed,
                            "critic_recommendation": audit_rec,
                        },
                        reasoning_summary=summary_str,
                        human_action="PENDING_REVIEW",
                    )
                    session.add(ledger)

                await session.commit()
        except Exception as e:
            log.warning("persist_sourcing_and_ledger_failed", error=str(e), tenant_id=str(self.tenant_id))

    async def _persist_outreach_campaign(
        self,
        results: List[Dict[str, Any]],
        job: Dict[str, Any],
    ) -> None:
        """Persists an EmailCampaign and EmailSent rows and dispatches via EmailService."""
        if not self.tenant_id or self.tenant_id == "default" or not results:
            return
        try:
            tenant_uuid = uuid.UUID(str(self.tenant_id)) if not isinstance(self.tenant_id, uuid.UUID) else self.tenant_id
        except (ValueError, TypeError):
            return

        try:
            from sqlalchemy import select
            from db.models import AsyncSessionLocal, EmailCampaign, EmailSent, EmailStatus, User, Candidate
            from services.email_service import EmailService

            job_title = job.get("title") or job.get("role") or "Target Role"
            async with AsyncSessionLocal() as session:
                user_res = await session.execute(
                    select(User).where(User.tenant_id == tenant_uuid).limit(1)
                )
                owner = user_res.scalar_one_or_none()
                campaign = EmailCampaign(
                    owner_id=owner.id if owner else None,
                    name=f"Outreach: {job_title}"[:255],
                    campaign_type="candidate_outreach",
                    target_type="candidate",
                    is_active=True,
                )
                session.add(campaign)
                await session.flush()

                for item in results:
                    to_email = item.get("email")
                    cand_name = item.get("candidate") or "Candidate"
                    if not to_email or "@" not in str(to_email):
                        continue
                    out_payload = item.get("outreach") or {}
                    subject = f"Opportunity: {job_title}"
                    body = f"Hi {cand_name},\n\nWe'd love to connect regarding the {job_title} role."
                    if isinstance(out_payload, dict):
                        if out_payload.get("subject"):
                            subject = str(out_payload["subject"])
                        elif out_payload.get("drafts") and isinstance(out_payload["drafts"], list):
                            first_draft = out_payload["drafts"][0]
                            if isinstance(first_draft, dict):
                                subject = str(first_draft.get("subject") or subject)
                                body = str(first_draft.get("body") or body)
                        if out_payload.get("body"):
                            body = str(out_payload["body"])

                    cand_res = await session.execute(
                        select(Candidate).where(
                            Candidate.tenant_id == tenant_uuid,
                            Candidate.email == str(to_email),
                        )
                    )
                    cand_obj = cand_res.scalar_one_or_none()

                    email_row = EmailSent(
                        tenant_id=tenant_uuid,
                        campaign_id=campaign.id,
                        recruiter_id=owner.id if owner else None,
                        candidate_id=cand_obj.id if cand_obj else None,
                        to_email=str(to_email),
                        subject=subject,
                        body=body,
                        status=EmailStatus.DRAFT,
                    )
                    session.add(email_row)

                await session.commit()
                campaign_id_str = str(campaign.id)

            email_srv = EmailService()
            await email_srv.send_campaign(campaign_id_str)
        except Exception as e:
            log.warning("persist_outreach_campaign_failed", error=str(e), tenant_id=str(self.tenant_id))

    # ── Helpers ──────────────────────────────────────────────────────────────
    @staticmethod
    def _format_jd_context(disc_data: Any) -> str:
        """Extracts JSON or text representation of requisition constraints from discovery data."""
        extracted_jd = getattr(disc_data, "extracted_jd", None) or getattr(disc_data, "optimized_jd", None)
        if extracted_jd is not None:
            if hasattr(extracted_jd, "model_dump_json") and callable(extracted_jd.model_dump_json):
                return extracted_jd.model_dump_json()
            if hasattr(extracted_jd, "model_dump") and callable(extracted_jd.model_dump):
                return json.dumps(extracted_jd.model_dump())
            if isinstance(extracted_jd, dict):
                return json.dumps(extracted_jd)
            return str(extracted_jd)
        return "{}"

    @staticmethod
    def _extract_candidates(sourc_data: Any) -> List[Any]:
        """Pulls candidate list from objects or dicts defensively."""
        cands = getattr(sourc_data, "candidates", None)
        if cands is not None:
            return cands
        if isinstance(sourc_data, dict):
            return sourc_data.get("candidates", [])
        return []

    @staticmethod
    def _extract_role_summary(disc_data: Any, fallback_industry: str) -> str:
        """Pulls the best human-readable role summary from discovery output."""
        raw_role = getattr(disc_data, "job_description", None)
        if not raw_role and hasattr(disc_data, "extracted_jd"):
            jd = getattr(disc_data, "extracted_jd")
            raw_role = getattr(jd, "title", None) or getattr(jd, "job_description", None)
        if not raw_role and isinstance(disc_data, dict):
            raw_role = disc_data.get("job_description") or (disc_data.get("extracted_jd") or {}).get("title")
        return str(raw_role or f"{fallback_industry} Role")[:200]
