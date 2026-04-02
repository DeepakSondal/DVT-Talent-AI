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

    def run_full_pipeline(
        self,
        industry: str = "technology",
        location: str = "United States",
        target_companies: int = 10,
        target_candidates_per_role: int = 15,
        send_emails: bool = False,
    ) -> Dict[str, Any]:
        """
        Run the complete autonomous recruiting pipeline end-to-end.
        """
        pipeline_start = datetime.utcnow()
        log.info("full_pipeline_started", industry=industry, location=location)

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
            pipeline_results["stages"]["market_intelligence"] = {
                "companies_found": len(companies),
            }

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
            self.shared_memory["enriched_companies"] = enriched_companies
            pipeline_results["stages"]["company_research"] = {
                "companies_enriched": len(enriched_companies),
            }

            # ── Stage 3: Lead Discovery ───────────────────────────────────
            log.info("pipeline_stage", stage=3, name="lead_discovery")
            all_contacts = []
            for company in enriched_companies[:5]:  # Top 5 companies
                contacts_result = self.agents["lead_discovery"].run(
                    company_name=company.get("name", ""),
                    company_domain=company.get("domain", ""),
                    limit=3,
                )
                contacts = contacts_result.get("contacts", [])
                for c in contacts:
                    c["company"] = company
                all_contacts.extend(contacts)
            self.shared_memory["contacts"] = all_contacts
            pipeline_results["stages"]["lead_discovery"] = {
                "contacts_found": len(all_contacts),
            }

            # ── Stage 4: Candidate Sourcing ───────────────────────────────
            log.info("pipeline_stage", stage=4, name="candidate_sourcing")
            all_candidates = []
            for company in enriched_companies[:3]:
                roles = company.get("open_roles", ["Software Engineer"])
                tech_stack = company.get("tech_stack", ["Python"])
                for role in roles[:2]:
                    candidate_result = self.agents["candidate_sourcing"].run(
                        job_title=role,
                        skills=tech_stack[:4],
                        location=location if not company.get("remote") else None,
                        limit=target_candidates_per_role,
                    )
                    candidates = candidate_result.get("candidates", [])
                    for c in candidates:
                        c["target_role"] = role
                        c["target_company"] = company.get("name")
                    all_candidates.extend(candidates)
            self.shared_memory["candidates"] = all_candidates
            pipeline_results["stages"]["candidate_sourcing"] = {
                "candidates_found": len(all_candidates),
            }

            # ── Stage 5: Outreach ─────────────────────────────────────────
            if all_contacts:
                log.info("pipeline_stage", stage=5, name="client_outreach")
                outreach_results = []
                for contact in all_contacts[:10]:
                    company = contact.get("company", {})
                    context = {
                        "company": company,
                        "candidates": all_candidates[:5],
                        "open_roles": company.get("open_roles", []),
                    }
                    result = self.agents["outreach"].run(
                        outreach_type="client",
                        recipient=contact,
                        context=context,
                        send_email=send_emails,
                    )
                    outreach_results.append(result)
                pipeline_results["stages"]["client_outreach"] = {
                    "emails_sent": sum(1 for r in outreach_results if r.get("sent")),
                    "emails_drafted": len(outreach_results),
                }

            # ── Stage 6: CRM Update ───────────────────────────────────────
            log.info("pipeline_stage", stage=6, name="crm_management")
            crm_result = self.agents["crm_management"].run()
            pipeline_results["stages"]["crm_management"] = crm_result

            # ── Stage 7: Analytics ────────────────────────────────────────
            log.info("pipeline_stage", stage=7, name="analytics")
            analytics_result = self.agents["analytics"].run()
            pipeline_results["stages"]["analytics"] = {
                "insights": len(analytics_result.get("insights", [])),
            }

            # ── Stage 8: Learning ─────────────────────────────────────────
            log.info("pipeline_stage", stage=8, name="learning")
            learning_result = self.agents["learning"].run(
                performance_data=pipeline_results.get("stages", {})
            )
            pipeline_results["stages"]["learning"] = {
                "improvements": len(learning_result.get("improvements", [])),
            }

        except Exception as e:
            log.error("pipeline_error", error=str(e), exc_info=True)
            pipeline_results["error"] = str(e)

        pipeline_end = datetime.utcnow()
        pipeline_results["completed_at"] = pipeline_end.isoformat()
        pipeline_results["duration_seconds"] = (pipeline_end - pipeline_start).total_seconds()

        log.info("full_pipeline_completed", duration=pipeline_results["duration_seconds"])
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
