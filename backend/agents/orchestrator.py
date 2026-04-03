"""
DVT Talent AI — Agent Orchestrator
Coordinates the full autonomous recruiting pipeline.
Manages agent execution order, error handling, and shared memory.
"""
import json
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime
import structlog

from sqlalchemy import create_engine, text
from config import settings
from agents.market_intelligence_agent import MarketIntelligenceAgent
from agents.lead_discovery_agent import LeadDiscoveryAgent
from agents.candidate_sourcing_agent import CandidateSourcingAgent
from agents.resume_analysis_agent import ResumeAnalysisAgent
from agents.outreach_agent import OutreachAgent
from agents.supporting_agents import (
    CompanyResearchAgent,
    CRMManagementAgent,
    InterviewSchedulingAgent,
    AnalyticsAgent,
    LearningAgent,
)

log = structlog.get_logger(__name__)


class AgentOrchestrator:
    """
    Orchestrates all DVT Talent AI agents in the correct sequence.
    
    Pipeline:
    1. Market Intelligence → Find hiring companies
    2. Company Research   → Deep dive each company
    3. Lead Discovery     → Find decision makers
    4. Candidate Sourcing → Find qualified candidates
    5. Resume Analysis    → Score candidates
    6. Outreach           → Send personalized emails
    7. CRM Management     → Update pipeline
    8. Analytics          → Compute metrics
    9. Learning           → Improve strategies
    """

    def __init__(self):
        self.agents = {
            "market_intelligence": MarketIntelligenceAgent(),
            "company_research": CompanyResearchAgent(),
            "lead_discovery": LeadDiscoveryAgent(),
            "candidate_sourcing": CandidateSourcingAgent(),
            "resume_analysis": ResumeAnalysisAgent(),
            "outreach": OutreachAgent(),
            "crm_management": CRMManagementAgent(),
            "analytics": AnalyticsAgent(),
            "learning": LearningAgent(),
        }
        self.shared_memory: Dict[str, Any] = {}
        self.run_log: List[Dict[str, Any]] = []

    def run_single_agent(self, agent_name: str, params: Dict[str, Any] = None) -> Dict[str, Any]:
        """Run a single agent by name"""
        if agent_name not in self.agents:
            raise ValueError(f"Unknown agent: {agent_name}")

        agent = self.agents[agent_name]
        log.info("running_single_agent", agent=agent_name, params=params)

        start_time = datetime.utcnow()
        try:
            result = agent.run(**(params or {}))
            duration = (datetime.utcnow() - start_time).total_seconds()
            self._log_run(agent_name, "success", result, duration)
            return result
        except Exception as e:
            duration = (datetime.utcnow() - start_time).total_seconds()
            self._log_run(agent_name, "failed", {"error": str(e)}, duration)
            raise

    async def _emit_signal(self, type: str, message: str, data: dict = None):
        """Broadcast an intelligence signal to the frontend via Redis"""
        try:
             import redis.asyncio as redis
             r = redis.from_url(settings.redis_url)
             signal = {
                 "type": type,
                 "message": message,
                 "data": data or {},
                 "timestamp": datetime.utcnow().isoformat()
             }
             await r.publish("dvt_signals", json.dumps(signal))
             log.info("signal_emitted", type=type)
        except Exception as e:
             log.error("signal_failed", error=str(e))

    async def run_full_pipeline(
        self,
        industry: str = "technology",
        location: str = "United States",
        target_companies: int = 10,
        target_candidates_per_role: int = 15,
        send_emails: bool = False,
    ) -> Dict[str, Any]:
        """
        Run the complete autonomous recruiting pipeline end-to-end (Asynchronous).
        """
        pipeline_start = datetime.utcnow()
        log.info("full_pipeline_started", industry=industry, location=location)
        await self._emit_signal("pipeline_start", f"Initializing autonomous discovery for {industry} in {location}")

        pipeline_results = {
            "started_at": pipeline_start.isoformat(),
            "stages": {},
        }

        try:
            # ── Stage 1: Market Intelligence ─────────────────────────────
            log.info("pipeline_stage", stage=1, name="market_intelligence")
            market_result = self.agents["market_intelligence"].run(
                industry=industry,
                location=location,
                limit=target_companies,
            )
            companies = market_result.get("companies", [])
            self.shared_memory["companies"] = companies
            
            # SAVE TO DB (Async)
            saved_count = 0
            for c in companies:
                cid = await self._save_company(c)
                if cid: saved_count += 1
                
            await self._emit_signal("agent_success", f"Market Intel completed: {saved_count} companies identified", {"count": saved_count})
            pipeline_results["stages"]["market_intelligence"] = {"companies_found": len(companies)}

            # ── Stage 2: Company Research ─────────────────────────────────
            log.info("pipeline_stage", stage=2, name="company_research")
            enriched_companies = []
            for company in companies[:target_companies]:
                research = self.agents["company_research"].run(
                    company_name=company.get("name", ""),
                    company_domain=company.get("domain", ""),
                )
                company.update(research)
                enriched_companies.append(company)
                await self._save_company(company) # Update with research
            
            self.shared_memory["enriched_companies"] = enriched_companies
            await self._emit_signal("agent_success", f"Company research completed for {len(enriched_companies)} targets")
            pipeline_results["stages"]["company_research"] = {"companies_enriched": len(enriched_companies)}

            # ── Stage 3: Lead Discovery ───────────────────────────────────
            log.info("pipeline_stage", stage=3, name="lead_discovery")
            all_contacts = []
            for company in enriched_companies[:5]:
                contacts_result = self.agents["lead_discovery"].run(
                    company_name=company.get("name", ""),
                    company_domain=company.get("domain", ""),
                    limit=3,
                )
                contacts = contacts_result.get("contacts", [])
                for c in contacts:
                    c["company"] = company
                    await self._save_lead(c)
                all_contacts.extend(contacts)
            
            self.shared_memory["contacts"] = all_contacts
            await self._emit_signal("agent_success", f"Lead discovery finished: {len(all_contacts)} decision makers found")
            pipeline_results["stages"]["lead_discovery"] = {"contacts_found": len(all_contacts)}

            # ── Stage 4: Candidate Sourcing ───────────────────────────────
            log.info("pipeline_stage", stage=4, name="candidate_sourcing")
            all_candidates = []
            for company in enriched_companies[:3]:
                roles = company.get("open_roles", ["Software Engineer"])
                tech_stack = company.get("tech_stack", ["Python"])
                for role in roles[:1]:
                    candidate_result = self.agents["candidate_sourcing"].run(
                        job_title=role,
                        skills=tech_stack[:3],
                        location=location if not company.get("remote") else None,
                        limit=target_candidates_per_role,
                    )
                    candidates = candidate_result.get("candidates", [])
                    for c in candidates:
                        await self._save_candidate(c)
                    all_candidates.extend(candidates)
            
            self.shared_memory["candidates"] = all_candidates
            await self._emit_signal("agent_success", f"Candidate sourcing complete: {len(all_candidates)} matched profiles")
            pipeline_results["stages"]["candidate_sourcing"] = {"candidates_found": len(all_candidates)}

            # ── Stage 5: Outreach (New Async Logic) ───────────────────────
            log.info("pipeline_stage", stage=5, name="outreach")
            outreach_count = 0
            if all_contacts:
                for contact in all_contacts[:target_companies]:
                    company = contact.get("company", {})
                    context = {
                        "company": company,
                        "candidates": all_candidates[:3],
                        "open_roles": company.get("open_roles", []),
                    }
                    await self.agents["outreach"].run(
                        outreach_type="client",
                        recipient=contact,
                        context=context,
                        send_email=send_emails
                    )
                    outreach_count += 1
                
            await self._emit_signal("agent_success", f"Outreach drafting complete: {outreach_count} hyper-personalized messages ready.")
            pipeline_results["stages"]["outreach"] = {"drafts_created": outreach_count}

            # ── Stage 6: CRM & Analytics (New Data-Driven Logic) ──────────
            log.info("pipeline_stage", stage=6, name="crm_and_analytics")
            crm_result = await self.agents["crm_management"].run()
            analytics_result = await self.agents["analytics"].run()
            
            await self._emit_signal("agent_success", "Intelligence Stream updated with real-time performance metrics")
            pipeline_results["stages"]["crm_management"] = crm_result
            pipeline_results["stages"]["analytics"] = analytics_result

        except Exception as e:
            log.error("pipeline_error", error=str(e), exc_info=True)
            await self._emit_signal("agent_failed", f"Pipeline interrupted: {str(e)}")
            pipeline_results["error"] = str(e)

        pipeline_end = datetime.utcnow()
        pipeline_results["completed_at"] = pipeline_end.isoformat()
        pipeline_results["duration_seconds"] = (pipeline_end - pipeline_start).total_seconds()

        await self._emit_signal("pipeline_complete", "Autonomous recruiting cycle successfully finished")
        return pipeline_results

    def _log_run(self, agent_name: str, status: str, result: dict, duration: float):
        entry = {
            "agent": agent_name,
            "status": status,
            "duration_seconds": duration,
            "timestamp": datetime.utcnow().isoformat(),
        }
        self.run_log.append(entry)
        log.info("agent_run_logged", **entry)

    def get_agent_status(self) -> Dict[str, Any]:
        """Return status of all agents"""
        return {
            "agents": list(self.agents.keys()),
            "last_runs": self.run_log[-10:] if self.run_log else [],
            "shared_memory_keys": list(self.shared_memory.keys()),
        }

    # ── DB Persistence Helpers (Asynchronous & Robust Upsert) ────────────────
    async def _get_async_session(self):
        from db.models import AsyncSessionLocal
        return AsyncSessionLocal()

    async def _save_company(self, data: dict):
        """Asynchronously save or update a company found by AI agents"""
        async with await self._get_async_session() as session:
            try:
                from sqlalchemy import select
                from db.models import Company
                
                # Check for existing company by domain
                domain = data.get("domain", "").lower()
                stmt = select(Company).where(Company.domain == domain)
                result = await session.execute(stmt)
                company = result.scalar_one_or_none()
                
                if company:
                    # Update existing
                    company.score = data.get("company_score", company.score)
                    company.tech_stack = data.get("tech_stack", company.tech_stack)
                    company.last_enriched = datetime.utcnow()
                    log.info("company_updated", domain=domain)
                else:
                    # Create new
                    company = Company(
                        name=data.get("name", "Unknown"),
                        domain=domain,
                        industry=data.get("industry", "Technology"),
                        location=data.get("location", "Global"),
                        score=data.get("company_score", 50),
                        tech_stack=data.get("tech_stack", []),
                        last_enriched=datetime.utcnow()
                    )
                    session.add(company)
                    log.info("company_created", domain=domain)
                
                await session.commit()
                return company.id
            except Exception as e:
                await session.rollback()
                log.error("db_save_failed", type="company", error=str(e))
                return None

    async def _save_lead(self, data: dict):
        """Asynchronously save a lead and link to company"""
        async with await self._get_async_session() as session:
            try:
                from db.models import Lead, Company, Contact
                from sqlalchemy import select
                
                # 1. Find or Create Contact
                email = data.get("email", "").lower()
                stmt = select(Contact).where(Contact.email == email)
                res = await session.execute(stmt)
                contact = res.scalar_one_or_none()
                
                if not contact:
                    contact = Contact(
                        first_name=data.get("first_name", "AI"),
                        last_name=data.get("last_name", "Lead"),
                        email=email,
                        title=data.get("title", "Unknown"),
                        linkedin_url=data.get("linkedin_url"),
                        meta_data=data
                    )
                    session.add(contact)
                    await session.flush()
                
                # 2. Find Company
                domain = data.get("domain", "").lower() or data.get("company", {}).get("domain", "").lower()
                stmt = select(Company).where(Company.domain == domain)
                res = await session.execute(stmt)
                comp = res.scalar_one_or_none()
                
                # 3. Create Lead
                lead = Lead(
                    company_id=comp.id if comp else None,
                    contact_id=contact.id,
                    status="new",
                    source="ai_discovery",
                    score=data.get("score", 0),
                    meta_data=data
                )
                session.add(lead)
                await session.commit()
                log.info("lead_persisted", email=email)
            except Exception as e:
                await session.rollback()
                log.error("db_save_failed", type="lead", error=str(e))

    async def _save_candidate(self, data: dict):
        """Asynchronously save or update a candidate"""
        async with await self._get_async_session() as session:
            try:
                from db.models import Candidate
                from sqlalchemy import select
                
                email = data.get("email", "").lower()
                if not email:
                     email = f"ai_{uuid.uuid4()}@dvt.local"

                stmt = select(Candidate).where(Candidate.email == email)
                res = await session.execute(stmt)
                candidate = res.scalar_one_or_none()
                
                if candidate:
                    candidate.score = data.get("score", candidate.score)
                    candidate.title = data.get("title", candidate.title)
                    log.info("candidate_updated", email=email)
                else:
                    candidate = Candidate(
                        first_name=data.get("first_name", "AI"),
                        last_name=data.get("last_name", "Candidate"),
                        email=email,
                        title=data.get("title", "Software Engineer"),
                        location=data.get("location", "Remote"),
                        score=data.get("score", 0),
                        meta_data=data
                    )
                    session.add(candidate)
                    log.info("candidate_created", email=email)
                
                await session.commit()
            except Exception as e:
                await session.rollback()
                log.error("db_save_failed", type="candidate", error=str(e))
