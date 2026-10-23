# Graph Report - dvt-talent-ai  (2026-10-21)

## Corpus Check
- 304 files · ~560,327 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 18 file(s) not represented in the graph (top: (none) 8, .example 3, .ini 2)

## Summary
- 2592 nodes · 5422 edges · 156 communities (108 shown, 48 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 527 edges (avg confidence: 0.93)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ba9d19e7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- api.ts
- api.ts
- typing
- Button
- team.py
- email_sender.py
- uuid
- models.py
- ResumeParserService
- Card.tsx
- agents.py
- candidate_portal.py
- candidates.py
- auth.py
- MarketPulseScheduler
- health.py
- test_billing.py
- test_agents.py
- package.json
- dependencies
- tasks.py
- Settings
- Communities (155 total, 45 thin omitted)
- is_domain_or_company_blocked
- config.py
- auth_sso.py
- env.py
- main.py
- AgentOrchestrator
- sourcing_pydantic.py
- integrations.py
- AgentDeps
- campaigns.py
- safe_dispatch_task
- OnboardingWizard.tsx
- pydantic_config.py
- companies.py
- leads.py
- react
- httpx
- PreflightCheck
- compilerOptions
- DVT Talent AI — Environment Setup & Local Development Guide
- BaseATS
- swarm_memory.py
- jobs.py
- discovery_pydantic.py
- memory_tools.py
- User
- ConnectionManager
- HTTPXMock
- DVT Talent AI — ATS Integration Guide
- DVT Talent AI — Observability Guide
- outreach_pydantic.py
- VectorStore
- unittest_mock
- test_vector_store_mock.py
- celery_app.py
- 🎯 2. Candidate Portal API (Career-Ops)
- DVT Talent AI — Complete Setup & Deployment Guide
- DVT Talent AI — Production Readiness & Deployment Gate Report
- CeipalClient
- 2. Weekly Tracker
- app/layout.tsx
- README.md
- _basic_auth
- GreenhouseClient
- DVT Talent AI — System Architecture Specification (Technical Deep Dive)
- Architecture
- DVT Talent AI — Comprehensive Architecture & Quality Audit
- 💼 Track A: Recruiter Onboarding
- KanbanBoard.tsx
- DVT Talent AI — System Architecture Specification
- market_iq_pydantic.py
- Enterprise Team & BYOK Architecture
- record_human_override
- Autonomous AI Agents & Intelligence Engines
- DVT Talent AI — API Reference & Conventions Guide
- DVT Talent AI — Pilot Program Agreement
- devDependencies
- screening_pydantic.py
- browser_tools.py
- Coding Conventions
- test_rls_session_context
- TestCeipalClient
- SOC 2 Compliance: Audit Logging Policy
- 🛠️ Checklist Verification
- Testing & Quality Assurance Guide
- copilot.py
- GitHub Copilot Workspace Instructions
- Testing Patterns
- test_swarm_endpoints.py
- 4. Recruiter & Agency Endpoints
- Production Deployment & Containerization Guide
- DVT Talent AI — Frequently Asked Questions (FAQ)
- DVT Talent AI — Pilot Feedback Form
- 💼 Track A: Recruiter & Agency Guide
- External Integrations
- billing.py
- test_ats_integrations.py
- test_resume_endpoints.py
- DVT Talent AI — Agent Communication Fabric
- Database Architecture & Schema Reference
- DVT Talent AI — Funding & Pilot Readiness Report
- Codebase Structure
- 🛡️ Best Practices for Credential Management
- FastAPI
- DVT Talent AI — Stripe Billing Setup Guide
- sqlalchemy_ext_asyncio
- ComplianceService
- ValidationService
- DVT Talent AI — Final Optimization & Audit Report
- DVT Talent AI — Theme & Contrast Audit Report
- 3. Work Breakdown & Task Execution Plan
- @playwright/test
- ats_sync.py
- 7. Step-by-Step VPS Deployment Runbook
- VoiceService
- test_sso_endpoints.py
- DVT Talent AI — 15-Minute Executive Demo Script
- monitoring/page.tsx
- .eslintrc.json
- scripts
- cn
- PromptSanitizer
- charts.tsx
- middleware.ts
- 4. Security & Reliability Audit Findings
- RateLimitMiddleware
- utils.ts
- notification_service.py
- InsufficientCreditsError
- next.config.js
- backup_db.sh
- backup_tenant_data.sh
- create_pilot_tenant.sh
- restore_db.sh
- setup_vps.sh
- 1. Verified Test Results & Reproduction Commands

## God Nodes (most connected - your core abstractions)
1. `User` - 120 edges
2. `Communities (155 total, 45 thin omitted)` - 111 edges
3. `Button` - 88 edges
4. `cn()` - 87 edges
5. `Badge()` - 81 edges
6. `Card` - 77 edges
7. `react` - 72 edges
8. `lucide-react` - 58 edges
9. `framer-motion` - 39 edges
10. `Base` - 34 edges

## Surprising Connections (you probably didn't know these)
- `Workflow 1: Authentication & Authorization (RBAC)` --references--> `Tenant`  [INFERRED]
  E2E_AUDIT_REPORT.md → backend/db/models.py
- `6. Frontend Roadmap (Next Steps)` --references--> `TeamApiKeys`  [INFERRED]
  docs/ENTERPRISE_TEAM.md → backend/db/models.py
- `2. Technical Scope` --references--> `AuditLog`  [INFERRED]
  docs/compliance/SOC2_AUDIT_LOGGING_POLICY.md → backend/db/models.py
- `4. Module Responsibilities Matrix` --references--> `AIDecisionLedger`  [INFERRED]
  ARCHITECTURE.md → backend/db/models.py
- `5. Security, Tenancy, and Compliance Review` --references--> `AIDecisionLedger`  [INFERRED]
  ARCHITECTURE_AUDIT.md → backend/db/models.py

## Import Cycles
- None detected.

## Communities (156 total, 48 thin omitted)

### Community 0 - "api.ts"
Cohesion: 0.05
Nodes (43): icons, TaskFeedItem(), TaskFeedItemProps, timeAgo(), billingApi, API_BASE, http, analyticsService (+35 more)

### Community 1 - "api.ts"
Cohesion: 0.11
Nodes (31): AuthCallbackPage(), AuthContent(), CandidateRecord, INITIAL_CANDIDATES, BadgeProps, analyticsApi, api, campaignsApi (+23 more)

### Community 3 - "Button"
Cohesion: 0.08
Nodes (35): AuditPage(), BillingPage(), PLAN_ICONS, JobDetailPage(), DashboardHome(), SupportPage(), TeamPage(), GlobalError() (+27 more)

### Community 4 - "team.py"
Cohesion: 0.14
Nodes (10): get_team_analytics(), get_team_api_keys(), invite_recruiter(), list_team_members(), _mask_api_key(), require_manager(), save_team_api_keys(), set_user_quota() (+2 more)

### Community 5 - "email_sender.py"
Cohesion: 0.09
Nodes (14): delete_email_sender(), EmailSenderConfig, EmailSenderOut, get_email_sender(), _get_tenant(), _mask_password(), save_email_sender(), _send_verification_bg() (+6 more)

### Community 6 - "uuid"
Cohesion: 0.06
Nodes (15): export_candidate(), get_all_enabled_connections(), get_ats_client(), _get_connection(), sync_jobs(), patch_database(), hash_pw(), reset_passwords() (+7 more)

### Community 7 - "models.py"
Cohesion: 0.08
Nodes (35): get_dashboard_kpis(), require_admin(), create_admin(), Activity, AIDecisionLedger, AnalyticsEvent, ATSExportLog, AuditLog (+27 more)

### Community 9 - "Card.tsx"
Cohesion: 0.15
Nodes (30): LoginContent(), LoginPage(), RegisterContent(), RegisterPage(), CompliancePage(), DecisionLedgerItem, PolicyPack, CreateJobPage() (+22 more)

### Community 10 - "agents.py"
Cohesion: 0.09
Nodes (13): AgentTrigger, get_task_status(), list_agent_tasks(), PipelineTrigger, run_swarm_phase(), run_swarm_pipeline(), SwarmTriggerSchema, trigger_agent() (+5 more)

### Community 11 - "candidate_portal.py"
Cohesion: 0.12
Nodes (19): ApplicationOut, CandidateProfileOut, Config, CandidateProfileUpdate, CareerOpsDimensions, download_candidate_resume(), generate_interview_prep(), generate_tailored_resume_advice() (+11 more)

### Community 12 - "candidates.py"
Cohesion: 0.11
Nodes (20): analyze_resume_background(), CandidateCreate, CandidateList, CandidateOut, Config, create_candidate(), download_candidate_resume(), erase_candidate_pii() (+12 more)

### Community 13 - "auth.py"
Cohesion: 0.08
Nodes (24): create_access_token(), create_refresh_token(), get_current_user(), get_me(), hash_password(), login(), refresh_token_route(), register() (+16 more)

### Community 14 - "MarketPulseScheduler"
Cohesion: 0.05
Nodes (27): MarketPulseScheduler, [1.0.0] — 2026-04-10, [1.1.0] — 2026-04-29, [1.2.0] — 2026-10-14, [2.0.0] — 2026-10-18, 🛠️ Backend & API, 🚀 Dual-Persona Platform Model, DVT Talent AI — Changelog (+19 more)

### Community 15 - "health.py"
Cohesion: 0.21
Nodes (5): health_all(), health_check(), health_db(), health_llm(), health_redis()

### Community 16 - "test_billing.py"
Cohesion: 0.16
Nodes (7): generate_stripe_signature(), MockTenant, test_deduct_credits_db_error_fails_open(), test_deduct_credits_insufficient(), test_deduct_credits_success(), test_webhook_checkout_completed(), test_webhook_invalid_signature()

### Community 17 - "test_agents.py"
Cohesion: 0.05
Nodes (25): test_lead_discovery_reaction(), test_market_intelligence_parallel_logic(), test_sourcing_filters(), test_candidate_sourcing_agent_structure(), test_market_intelligence_agent_structure(), test_outreach_agent_structure(), test_critic_agent_structure(), test_job_description_agent_optimization() (+17 more)

### Community 18 - "package.json"
Cohesion: 0.05
Nodes (38): name, private, version, autoprefixer, axios, clsx, date-fns, @dnd-kit/utilities (+30 more)

### Community 19 - "dependencies"
Cohesion: 0.05
Nodes (37): dependencies, axios, class-variance-authority, clsx, date-fns, @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities (+29 more)

### Community 20 - "tasks.py"
Cohesion: 0.12
Nodes (17): analyze_resume_task(), broadcast_signal(), copilot_discovery_task(), _run(), copilot_outreach_task(), _run(), copilot_sourcing_task(), _run() (+9 more)

### Community 21 - "Settings"
Cohesion: 0.07
Nodes (19): get_settings(), Settings, Codebase Concerns, Dependencies at Risk, Fragile Areas, Known Bugs, Missing Critical Features, Performance Bottlenecks (+11 more)

### Community 22 - "Communities (155 total, 45 thin omitted)"
Cohesion: 0.02
Nodes (111): Communities (155 total, 45 thin omitted), Community 0 - "api.ts", Community 101 - "DVT Talent AI — Agent Communication Fabric", Community 102 - "Database Architecture & Schema Reference", Community 103 - "DVT Talent AI — Funding & Pilot Readiness Report", Community 104 - "Codebase Structure", Community 105 - "🛡️ Best Practices for Credential Management", Community 107 - "format_jd_and_source" (+103 more)

### Community 23 - "is_domain_or_company_blocked"
Cohesion: 0.10
Nodes (6): is_candidate_visible_to_recruiter(), is_domain_or_company_blocked(), normalize_domain(), TestBlacklistDomainMatching, TestCandidateVisibilityGatekeeper, TestDomainNormalization

### Community 25 - "auth_sso.py"
Cohesion: 0.14
Nodes (9): get_saml_settings(), get_sso_config(), prepare_saml_request(), sso_acs(), sso_login(), sso_metadata(), SSOConfigPayload, test_sso_config() (+1 more)

### Community 26 - "env.py"
Cohesion: 0.09
Nodes (8): do_run_migrations(), run_async_migrations(), run_migrations_offline(), run_migrations_online(), upgrade(), upgrade(), upgrade(), upgrade()

### Community 27 - "main.py"
Cohesion: 0.07
Nodes (8): ping(), root(), track_email_open(), track_link_click(), test_social_callback_creates_user_with_tenant(), test_social_login_invalid_provider(), test_social_login_redirect(), Naming Patterns

### Community 28 - "AgentOrchestrator"
Cohesion: 0.15
Nodes (4): AgentOrchestrator, broadcast_signal(), _get_agent_data(), get_pydantic_model()

### Community 29 - "sourcing_pydantic.py"
Cohesion: 0.10
Nodes (18): AgentDeps, apply_recruiter_memory(), CandidateNode, deep_research_on_web(), IntegrityScore, Reasoning, search_github_talent(), search_internal_ats() (+10 more)

### Community 30 - "integrations.py"
Cohesion: 0.15
Nodes (9): connect_integration(), ConnectRequest, disconnect_integration(), export_candidate_route(), ExportRequest, get_export_logs(), get_integration_status(), get_synced_jobs() (+1 more)

### Community 31 - "AgentDeps"
Cohesion: 0.12
Nodes (6): async_client(), db_session(), ensure_db_tables(), event_loop(), test_engine(), Fixtures and Factories

### Community 32 - "campaigns.py"
Cohesion: 0.17
Nodes (13): CampaignCreate, CampaignOut, Config, create_campaign(), EmailSentOut, Config, get_campaign(), get_campaign_emails() (+5 more)

### Community 33 - "safe_dispatch_task"
Cohesion: 0.12
Nodes (15): enrich_company_background(), is_celery_broker_available(), safe_dispatch_task(), 1. Executive Summary, 3. Detailed Workflow Tracing & Verification, 5. Regression Test Automation Suite, 6. Final Audit Verdict, DVT Talent AI — End-to-End Functional Audit Report (+7 more)

### Community 34 - "OnboardingWizard.tsx"
Cohesion: 0.22
Nodes (11): Layout(), SidebarLayout(), ATS_OPTIONS, INDUSTRIES, OnboardingWizard(), OnboardingWizardProps, emailSenderApi, tenantsApi (+3 more)

### Community 35 - "pydantic_config.py"
Cohesion: 0.10
Nodes (4): AnalyticsReport, PerformanceMetrics, AuditResult, consult_swarm_memory()

### Community 36 - "companies.py"
Cohesion: 0.17
Nodes (11): CompanyCreate, CompanyList, CompanyOut, Config, CompanyUpdate, create_company(), delete_company(), enrich_company() (+3 more)

### Community 37 - "leads.py"
Cohesion: 0.10
Nodes (16): get_candidate_funnel(), get_email_performance(), get_lead_funnel(), get_top_industries(), create_lead(), delete_lead(), get_lead(), get_pipeline_leads() (+8 more)

### Community 38 - "react"
Cohesion: 0.10
Nodes (19): CopilotTaskPage(), CandidateCard(), CandidateCardProps, CopilotCandidate, CopilotActionModal(), CopilotActionModalProps, JDEditor(), JDEditorProps (+11 more)

### Community 39 - "httpx"
Cohesion: 0.18
Nodes (6): trigger_vapi_outbound_call(), run_health_checks(), send_slack_alert(), send_slack_recovery(), record(), run_e2e_audit()

### Community 41 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+10 more)

### Community 42 - "DVT Talent AI — Environment Setup & Local Development Guide"
Cohesion: 0.11
Nodes (17): 1. System Prerequisites, 2. Windows Local Development (PowerShell), 3. Docker Compose Development, 4. Running Automated Tests, 5. Troubleshooting Common Issues, Backend Unit & Integration Tests (pytest), Default Port Mappings in Docker, DVT Talent AI — Environment Setup & Local Development Guide (+9 more)

### Community 44 - "swarm_memory.py"
Cohesion: 0.18
Nodes (9): add_negative_vector(), _get_cache(), _get_db(), get_negative_vectors(), query_memory_tree(), _set_cache(), get_fernet_key(), test_shared_memory_persistence() (+1 more)

### Community 45 - "jobs.py"
Cohesion: 0.12
Nodes (14): apply_to_job(), compute_career_ops_score(), list_matched_jobs(), create_job(), deactivate_job(), get_job(), JobCreate, JobOut (+6 more)

### Community 46 - "discovery_pydantic.py"
Cohesion: 0.18
Nodes (7): analyze_talent_hotspots(), DiscoveryResult, ExtractedJD, MarketIQ, research_company_deep_dive(), search_market_signals(), TargetCompany

### Community 47 - "memory_tools.py"
Cohesion: 0.14
Nodes (6): add_recruiter_preference(), fetch_recruiter_preferences(), get_mem0_client(), add_preference(), get_preferences(), PreferenceAddRequest

### Community 48 - "User"
Cohesion: 0.09
Nodes (18): complete_onboarding(), get_my_tenant(), get_team_members(), TenantUpdate, update_my_tenant(), change_password(), deactivate_user(), get_my_profile() (+10 more)

### Community 49 - "ConnectionManager"
Cohesion: 0.17
Nodes (3): ConnectionManager, pipeline_events_endpoint(), _verify_ws_token()

### Community 51 - "DVT Talent AI — ATS Integration Guide"
Cohesion: 0.12
Nodes (15): API Reference, Candidate Export (DVT → ATS), Ceipal, Configuring in DVT Talent AI, DVT Talent AI — ATS Integration Guide, Error Handling, File Structure, Getting Your API Keys (+7 more)

### Community 52 - "DVT Talent AI — Observability Guide"
Cohesion: 0.12
Nodes (15): 1. Sentry Error Tracking, 2. Starting the Monitoring Stack, 3. Grafana Dashboard, 4. Health Check Endpoints, 5. Alerting, 6. Configuration Reference, 7. File Structure, Default URLs (+7 more)

### Community 53 - "outreach_pydantic.py"
Cohesion: 0.14
Nodes (5): OutreachDraft, OutreachSynthesis, push_to_smartlead_campaign(), test_outreach_email_content_generation(), Workflow 5: AI-Generated Personalized Outreach

### Community 56 - "test_vector_store_mock.py"
Cohesion: 0.18
Nodes (5): MockClient, MockCollection, test_singleton_pattern(), test_vector_store_query_mock(), test_vector_store_upsert_mock()

### Community 57 - "celery_app.py"
Cohesion: 0.14
Nodes (4): export_candidate_task(), _run(), sync_all_ats_jobs(), init_worker()

### Community 58 - "🎯 2. Candidate Portal API (Career-Ops)"
Cohesion: 0.13
Nodes (14): 🔑 1. Authentication, 🎯 2. Candidate Portal API (Career-Ops), 💼 3. Recruiter API & Swarm Operations, 📡 4. Real-Time Telemetry (WebSocket), Approve Candidate Curation Checkpoint, Browse Verified Jobs with 5-Dimension Match Scores, Candidate Registration, DVT Talent AI — API Quickstart Guide (+6 more)

### Community 59 - "DVT Talent AI — Complete Setup & Deployment Guide"
Cohesion: 0.13
Nodes (14): 1. Provision Host, 1. System Requirements, 2. Clone & Configure, 2. Local Development Setup (Quick Start), 3. Docker Compose Setup, 3. Launch Production Stack, 4. Automated HTTPS with Caddy, 4. Production VPS Deployment (+6 more)

### Community 60 - "DVT Talent AI — Production Readiness & Deployment Gate Report"
Cohesion: 0.18
Nodes (10): 3. Distinction of Test Types & Service Integrations, 5. Prioritized Production Issue Matrix (Phase 2 Resolution), 6. Fixes Implemented During Verification, 8. Post-Deployment Verification & Smoke Tests, 9. Rollback & Disaster Recovery Procedures, Database Recovery from Backup, DVT Talent AI — Production Readiness & Deployment Gate Report, Executive Summary & Deployment Gate Verdict (+2 more)

### Community 62 - "2. Weekly Tracker"
Cohesion: 0.14
Nodes (13): 1. North Star Metrics (Pilot Targets), 2. Weekly Tracker, 3.1 Totals, 3.2 Quality Assessment, 3.3 Efficiency Impact, 3.4 Pilot Verdict, 3. Pilot Summary (Complete at End of Pilot), 4. Benchmarks (DVT Internal — Do Not Share) (+5 more)

### Community 63 - "app/layout.tsx"
Cohesion: 0.20
Nodes (10): inter, jetBrainsMono, metadata, RootLayout(), Providers(), Theme, ThemeContext, ThemeContextType (+2 more)

### Community 64 - "README.md"
Cohesion: 0.10
Nodes (18): 1. High-Level Repository Layout, 2. Backend Layout (`backend/`), 3. Frontend Layout (`frontend/`), 4. Key Architectural Conventions, DVT Talent AI — Repository & Project Structure Guide, 1. Local Development (Windows / PowerShell), 2. Docker Compose Cluster, Backend (+10 more)

### Community 67 - "DVT Talent AI — System Architecture Specification (Technical Deep Dive)"
Cohesion: 0.15
Nodes (12): 1. Dual-Persona Authentication & Authorization Boundaries, 2. Recruiter Swarm Intelligence Architecture, 3.1 5-Dimension Match Scoring, 3.2 Ghost Job Detection (Block G), 3.3 Zero-Fabrication ATS CV Tailoring, 3.4 STAR Behavioral Interview Coach, 3. Career-Ops Candidate AI Engine, 4. Decommissioned Legacy Features (+4 more)

### Community 68 - "Architecture"
Cohesion: 0.12
Nodes (16): Anti-Patterns, Architectural Constraints, Architecture, Component Responsibilities, Cross-Cutting Concerns, Data Flow, Entry Points, Error Handling (+8 more)

### Community 69 - "DVT Talent AI — Comprehensive Architecture & Quality Audit"
Cohesion: 0.10
Nodes (20): 1. Executive Summary, 2. System Architecture & Topology, 3. High-Priority Architectural Findings & Risks, 4. Audit of the 14 Business Modules, 5. Security, Tenancy, and Compliance Review, 6. Target Folder Structure Proposal, 7. Prioritized Implementation Roadmap, Application Entry Points (+12 more)

### Community 70 - "💼 Track A: Recruiter Onboarding"
Cohesion: 0.17
Nodes (11): DVT Talent AI — Onboarding Guide, Step 1: Authentication & Workspace Setup, Step 1: Register on the Candidate Portal, Step 2: Configure Keys & Integrations, Step 2: Profile & Resume Intake, Step 3: Configure Your Employer Privacy Shield, Step 3: Create or Import Requisitions, Step 4: Discover Jobs & Practice (+3 more)

### Community 71 - "KanbanBoard.tsx"
Cohesion: 0.19
Nodes (13): PipelinePage(), MicrositePage(), KanbanBoard(), STATUSES, KanbanCard(), KanbanCardProps, KanbanColumn(), KanbanColumnProps (+5 more)

### Community 72 - "DVT Talent AI — System Architecture Specification"
Cohesion: 0.18
Nodes (10): 1. System Overview, 2.1 Presentation & State Management Layer (`frontend/`), 2.2 API & Control Plane Layer (`backend/api/`), 2.3 Agent Intelligence & Orchestration (`backend/agents/`), 2.4 Data & Persistence Layer (`backend/db/`), 2. Core Architectural Layers, 3. Decommissioned Legacy Features, 4. Module Responsibilities Matrix (+2 more)

### Community 73 - "market_iq_pydantic.py"
Cohesion: 0.22
Nodes (4): JobPosting, MarketIQReport, MarketTrend, search_job_portals()

### Community 74 - "Enterprise Team & BYOK Architecture"
Cohesion: 0.17
Nodes (7): AuditLogMiddleware, 1. The Disconnected Swarm Trap: Solved, 3. Manager API Endpoints (`team.py`), 4. Modified Agent Logic (`pydantic_config.py`), 5. Security & Testing, 6. Frontend Roadmap (Next Steps), Enterprise Team & BYOK Architecture

### Community 75 - "record_human_override"
Cohesion: 0.19
Nodes (4): get_adverse_impact_report(), get_decision_ledger(), get_policy_packs(), record_human_override()

### Community 76 - "Autonomous AI Agents & Intelligence Engines"
Cohesion: 0.15
Nodes (12): 1. Overview, 2. The 5-Agent Recruiter Swarm, 3.1 5-Dimension Match Scoring, 3.2 Ghost Job Detection (Block G), 3.3 Zero-Fabrication ATS CV Tailoring, 3.4 STAR Behavioral Interview Coach, 3. Career-Ops Candidate AI Engine, 4. Shared Memory & Telemetry Fabric (+4 more)

### Community 77 - "DVT Talent AI — API Reference & Conventions Guide"
Cohesion: 0.18
Nodes (10): 1. Authentication & Dual-Persona Model, 2. Standard Response Format, 3. Candidate Portal & Career-Ops API (`/api/v1/candidate-portal/*`), 5. Real-Time Telemetry (WebSocket), 6. Deprecated & Legacy Endpoints, DVT Talent AI — API Reference & Conventions Guide, Example: 5-Dimension Job Scoring Response, Example: Candidate Profile Update (+2 more)

### Community 78 - "DVT Talent AI — Pilot Program Agreement"
Cohesion: 0.18
Nodes (10): 1. Scope of Pilot, 2. Access & Duration, 3. Data Handling, 4. Feedback Expectations, 5. Intellectual Property, 6. Limitation of Liability, 7. Termination, DVT Talent AI — Pilot Program Agreement (+2 more)

### Community 79 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, autoprefixer, eslint, eslint-config-next, @playwright/test, postcss, tailwindcss, @types/node (+3 more)

### Community 80 - "screening_pydantic.py"
Cohesion: 0.22
Nodes (3): initiate_voice_screening(), ScreeningPlan, ScreeningQuestion

### Community 82 - "Coding Conventions"
Cohesion: 0.25
Nodes (7): Code Style, Coding Conventions, Comments, Error Handling, Function Design, Import Organization, Logging

### Community 83 - "test_rls_session_context"
Cohesion: 0.29
Nodes (4): test_rls_session_context(), test_vector_store_live_index(), 5. Unverified / Partially Verified Features & Environmental Limitations, 2. In-Depth Analysis of the Six Skipped Tests

### Community 85 - "SOC 2 Compliance: Audit Logging Policy"
Cohesion: 0.20
Nodes (9): 1. Overview, 2. Technical Scope, 3. Logged Events, 4. Log Content, 5. Security & Immutability, 6. Retention & Disposal, 7. Review & Monitoring, 8. Technical Implementation (Verifiable) (+1 more)

### Community 86 - "🛠️ Checklist Verification"
Cohesion: 0.20
Nodes (9): 1. Authentication & Onboarding (✅ PASS), 2. Dashboard & Swarm Command (✅ PASS), 3. Candidate & Lead Synthesis (✅ PASS), 4. Outreach & Integrity Guardrails (✅ PASS), 5. Governance & Enterprise Sovereignty (✅ PASS), 🛠️ Checklist Verification, DVT Talent AI — Full Site Review Report, 🏁 Overall Readiness Score: 9.8 / 10 (+1 more)

### Community 87 - "Testing & Quality Assurance Guide"
Cohesion: 0.20
Nodes (9): 1. Quality Assurance Verification Summary, 2. Backend Test Suite (Pytest), 3. Frontend Verification Suite, 4. End-to-End (E2E) Functional Verification, Running Backend Tests, Running Frontend Verification, Testing & Quality Assurance Guide, Verification Criteria (+1 more)

### Community 88 - "copilot.py"
Cohesion: 0.24
Nodes (11): DiscoveryRequest, execute_discovery_bg(), execute_outreach_bg(), execute_sourcing_bg(), OutreachRequest, SourcingRequest, start_copilot_discovery(), start_copilot_outreach() (+3 more)

### Community 89 - "GitHub Copilot Workspace Instructions"
Cohesion: 0.20
Nodes (9): Conventions, GitHub Copilot Workspace Instructions, How to run and test, Important links, Key directories, Primary goals for Copilot, What this repository is, What to review first for changes (+1 more)

### Community 90 - "Testing Patterns"
Cohesion: 0.10
Nodes (10): _get_system_smtp(), _get_tenant_smtp(), SMTPConfig, Coverage & Baseline Metrics, Mocking, Test File Organization, Test Framework, Test Structure (+2 more)

### Community 91 - "test_swarm_endpoints.py"
Cohesion: 0.22
Nodes (3): test_monster_webhook_intake(), test_nexus_monitoring_recent_signals(), test_swarm_trigger_endpoint()

### Community 92 - "4. Recruiter & Agency Endpoints"
Cohesion: 0.22
Nodes (9): 4.1 Authentication & Registration, 4.2 Requisitions & Jobs, 4.3 Autonomous Sourcing Swarm (`/api/v1/agents/*`), 4.4 Human-in-the-Loop Copilot (`/api/v1/copilot/*`), 4.5 Candidate Management (`/api/v1/candidates/*`), 4.6 Compliance & Governance (`/api/v1/compliance/*`), 4.7 Billing & Credits (Stripe) (`/api/v1/billing/*`), 4.8 ATS Integrations (`/api/v1/integrations/*`) (+1 more)

### Community 93 - "Production Deployment & Containerization Guide"
Cohesion: 0.22
Nodes (8): 1. Docker Compose Architecture, 2. Launching with Docker Compose, 3. Production Hardening Checklist, Overview, Prerequisites, Production Deployment & Containerization Guide, Services Breakdown, Step-by-Step Launch

### Community 94 - "DVT Talent AI — Frequently Asked Questions (FAQ)"
Cohesion: 0.22
Nodes (8): 1. What is DVT Talent AI?, 2. How does the 5-Dimension Match Score work for candidates?, 3. What is "Ghost-Job Detection" (Block G)?, 4. Can candidates hide their profile from current employers?, 5. What happened to MarketIQ, Voice AI, and Sales Leads?, 6. What ATS integrations are supported for recruiters?, 7. How is tenant isolation enforced?, DVT Talent AI — Frequently Asked Questions (FAQ)

### Community 95 - "DVT Talent AI — Pilot Feedback Form"
Cohesion: 0.22
Nodes (8): DVT Talent AI — Pilot Feedback Form, Section 1: Overall Experience, Section 2: What Worked, Section 3: What Broke / What Needs Improvement, Section 4: Candidate Quality, Section 5: Outreach & Engagement, Section 6: ATS & Integrations, Section 7: Open Feedback

### Community 96 - "💼 Track A: Recruiter & Agency Guide"
Cohesion: 0.12
Nodes (15): 1. Profile & Resume Intake, 1. Requisitions & Job Descriptions, 2. Autonomous Talent Sourcing Swarm, 2. Verified Job Board & 5-Dimension Match Scoring, 3. Ghost Job Detection (Block G), 3. Human-in-the-Loop (HITL) Copilot, 4. Governance & EEOC Compliance, 4. Zero-Fabrication ATS CV Tailoring (+7 more)

### Community 97 - "External Integrations"
Cohesion: 0.22
Nodes (8): APIs & External Services, Authentication & Identity, Billing & Payments, Data Storage, Email & Communication, External Integrations, Monitoring & Observability, Webhooks & Callbacks

### Community 98 - "billing.py"
Cohesion: 0.16
Nodes (7): CheckoutRequest, create_checkout(), create_portal(), get_credits(), list_plans(), PortalRequest, stripe_webhook()

### Community 101 - "DVT Talent AI — Agent Communication Fabric"
Cohesion: 0.25
Nodes (7): 1. Overview, 2. Agent Interaction & Pipeline Topology, 3. Shared Context & Pydantic AI Dependencies, 4. Telemetry Signals & Event Bus, 5. Structured Data Integrity, DVT Talent AI — Agent Communication Fabric, Shared Dependencies:

### Community 102 - "Database Architecture & Schema Reference"
Cohesion: 0.25
Nodes (7): 1. Overview & Dual-Persona Entity Relationships, 2. Table Specifications & Column Reference, 3. Schema Extensions for Candidate Portal & Career-Ops, 4. Circular Foreign Key Resolution, 5. Connection Pooling Configuration, 6. Migration Workflows (Alembic), Database Architecture & Schema Reference

### Community 103 - "DVT Talent AI — Funding & Pilot Readiness Report"
Cohesion: 0.25
Nodes (7): 1. Executive Summary, 2. Technical Readiness Audit (Finalized), 3. Key Accomplishments (Final Hardening Phase), 4. Performance Metrics (Verified), 5. Compliance & Investor Trust, 6. Deployment Guide (Production Launch), DVT Talent AI — Funding & Pilot Readiness Report

### Community 104 - "Codebase Structure"
Cohesion: 0.25
Nodes (7): Codebase Structure, Directory Layout, Directory Purposes, Key File Locations, Naming Conventions, Special Directories, Where to Add New Code

### Community 105 - "🛡️ Best Practices for Credential Management"
Cohesion: 0.25
Nodes (7): 1. Never Commit Secrets to Version Control, 2. Credential Rotation, 3. Using Environment Variables, 4. Git Safety Tools, 5. Reporting Vulnerabilities, 🛡️ Best Practices for Credential Management, Security Policy — DVT Talent AI

### Community 106 - "FastAPI"
Cohesion: 0.09
Nodes (7): social_callback(), social_login(), format_jd_and_source(), get_daily_signals(), JDFormatRequest, NicheRequest, lifespan()

### Community 107 - "DVT Talent AI — Stripe Billing Setup Guide"
Cohesion: 0.12
Nodes (15): API Endpoints Reference, DVT Talent AI — Stripe Billing Setup Guide, File Structure, Local Development (Stripe CLI), Prerequisites, Production (VPS / Docker), Running the Tests, Step 1: Configure Your Stripe Keys (+7 more)

### Community 108 - "sqlalchemy_ext_asyncio"
Cohesion: 0.16
Nodes (3): email_inbound_webhook(), monster_application_webhook(), EmailService

### Community 111 - "DVT Talent AI — Final Optimization & Audit Report"
Cohesion: 0.29
Nodes (6): 🧹 Code Purification (Pruning), DVT Talent AI — Final Optimization & Audit Report, 🚀 Optimized Assets Added, ⚡ Performance Matrix, 🛡️ Security & Governance, 📊 Test Coverage & Quality

### Community 112 - "DVT Talent AI — Theme & Contrast Audit Report"
Cohesion: 0.29
Nodes (6): 1. Foreground Logic, 2. Nexus Harmonization, 🛡️ Contrast & Accessibility (WCAG AA), DVT Talent AI — Theme & Contrast Audit Report, 🚀 Optimized Components, 🎨 Unified Design Tokens

### Community 113 - "3. Work Breakdown & Task Execution Plan"
Cohesion: 0.17
Nodes (11): 1. Context & Problem Statement, 2. Target Architecture, 3. Work Breakdown & Task Execution Plan, 4. Verification Gates & Acceptance Criteria, Current Limitations Identified, Phase Plan: Full Resume Ingestion, Multi-Format Extraction & Document Management, Task 1: Parser Dependency & Document Engine (`backend/services/resume_parser.py`), Task 2: File Storage & Download Endpoints (+3 more)

### Community 116 - "7. Step-by-Step VPS Deployment Runbook"
Cohesion: 0.29
Nodes (7): 7. Step-by-Step VPS Deployment Runbook, Step 1: Provision the VPS, Step 2: Clone Repository & Configure Secrets, Step 3: Configure DNS, Step 4: Build & Launch the Container Stack, Step 5: Bootstrap Database & Initial Admin User, Step 6: Setup Daily Database Backup Cron

### Community 119 - "DVT Talent AI — 15-Minute Executive Demo Script"
Cohesion: 0.33
Nodes (5): 00:00 - 04:00 // Act 1: The Recruiter Command Center & Autonomous Swarm, 04:00 - 07:00 // Act 2: Explainable Scoring & Human-in-the-Loop Copilot, 07:00 - 11:00 // Act 3: The Candidate Portal & Career-Ops Engine, 11:00 - 15:00 // Act 4: Enterprise Governance & Compliance, DVT Talent AI — 15-Minute Executive Demo Script

### Community 120 - "monitoring/page.tsx"
Cohesion: 0.36
Nodes (6): MonitoringPage(), SignalItem, SignalItemProps, useWebSocket(), WebSocketContext, WebSocketContextType

### Community 121 - ".eslintrc.json"
Cohesion: 0.33
Nodes (5): extends, rules, @next/next/no-img-element, react/no-unescaped-entities, next/core-web-vitals

### Community 122 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, dev, lint, start, type-check

### Community 123 - "cn"
Cohesion: 0.08
Nodes (27): ApprovalsPage(), MOCK_APPROVALS, PendingApprovalItem, CandidatesPage(), CompaniesPage(), JobsPage(), RecruitingPage(), ConnectionStatus (+19 more)

### Community 125 - "charts.tsx"
Cohesion: 0.50
Nodes (4): CustomTooltip(), PerformanceCharts(), PerformanceChartsProps, recharts

### Community 126 - "middleware.ts"
Cohesion: 0.40
Nodes (3): config, PROTECTED_PREFIXES, PUBLIC_PATHS

### Community 127 - "4. Security & Reliability Audit Findings"
Cohesion: 0.40
Nodes (5): 4.2 Network Isolation & Public Exposure, 4.3 Container Health & Startup Dependency Order, 4.4 Reverse Proxy & Routing Fix, 4.5 Optional Dependency Resilience, 4. Security & Reliability Audit Findings

### Community 130 - "utils.ts"
Cohesion: 0.10
Nodes (25): CandidateDetailPage(), LeadDetailPage(), CandidateItem, CombinedRequirementJob, INITIAL_COMBINED_JOBS, OutreachLab(), INITIAL_SOURCED_CANDIDATES, SourcedCandidate (+17 more)

### Community 155 - "1. Verified Test Results & Reproduction Commands"
Cohesion: 0.50
Nodes (4): 1.1 Automated End-to-End Audit Suite (26/26 Passed), 1.2 Pytest Backend Suite (45 Passed, 6 Skipped in 32.07s), 1.3 Frontend Type-Checking & Production Build, 1. Verified Test Results & Reproduction Commands

## Knowledge Gaps
- **31 isolated node(s):** `next/core-web-vitals`, `@hookform/resolvers`, `@radix-ui/react-avatar`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu` (+26 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1274 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **48 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `God Nodes (most connected - your core abstractions)` connect `User` to `cn`, `Button`, `auth.py`, `models.py`?**
  _High betweenness centrality (0.209) - this node is a cross-community bridge._
- **Are the 70 inferred relationships involving `User` (e.g. with `get_current_user()` and `get_me()`) actually correct?**
  _`User` has 70 INFERRED edges - model-reasoned connections that need verification._
- **What connects `next/core-web-vitals`, `@hookform/resolvers`, `@radix-ui/react-avatar` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.050580997949419004 - nodes in this community are weakly interconnected._
- **Why does `User` connect `User` to `team.py`, `email_sender.py`, `uuid`, `models.py`, `notification_service.py`, `agents.py`, `candidate_portal.py`, `candidates.py`, `auth.py`, `config.py`, `auth_sso.py`, `integrations.py`, `campaigns.py`, `companies.py`, `leads.py`, `jobs.py`, `memory_tools.py`, `record_human_override`, `billing.py`, `FastAPI`, `test_sso_endpoints.py`?**
  _High betweenness centrality (0.198) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `Badge()` (e.g. with `[RISK-06] Giant Frontend Monolithic Components` and `God Nodes (most connected - your core abstractions)`) actually correct?**
  _`Badge()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **Should `api.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11137254901960784 - nodes in this community are weakly interconnected._