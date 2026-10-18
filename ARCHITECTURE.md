# DVT Talent AI — System Architecture Specification
**Version:** 2.0.0 (October 2026)  
**Status:** Production Ready  
**Audited By:** Staff Platform Architect & QA Lead  

---

## 1. System Overview

DVT Talent AI is an autonomous, dual-sided AI recruitment and candidate career enablement platform. The architecture couples a **Next.js 14 App Router** frontend with a high-performance **FastAPI async backend**, coordinating **Pydantic AI agents** for recruiters and the **Career-Ops AI Engine** for job seekers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        NEXT.JS 14 WEB CLIENT                          │
├──────────────────────────────────┬─────────────────────────────────────┤
│   💼 RECRUITER WORKSPACE         │   🎯 CANDIDATE PORTAL (Career-Ops)   │
│   • Requisitions & JDs           │   • Verified Job Board              │
│   • 5-Agent Sourcing Swarm       │   • 5-Dimension Match Scoring       │
│   • Human-in-the-Loop Copilot    │   • Ghost Job Detection (Block G)   │
│   • Explainable Fit Scoring      │   • Zero-Fabrication ATS CV Tailor  │
│   • ATS Sync (Greenhouse/CEIPAL) │   • STAR Interview Flashcards       │
│   • Stripe Credits & Billing     │   • Employer Privacy Blacklist      │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
                  │  (REST / WebSocket / Bearer JWT)  │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        FASTAPI SERVER (api/v1/*)                       │
├────────────────────────────────────────────────────────────────────────┤
│  AUTH & IDENTITY:                                                      │
│  • Role-Aware JWT (role: 'recruiter' | 'candidate')                    │
│  • B2B Tenant Isolation Middleware (for agency/enterprise data)         │
│  • Enterprise SAML 2.0 SSO (Okta, Azure AD) & OAuth2 (Google/GitHub)   │
├──────────────────────────────────┬─────────────────────────────────────┤
│  RECRUITER DOMAIN ROUTERS:       │  CANDIDATE PORTAL ROUTERS:          │
│  • /agents/* (Swarm & Tasks)     │  • /candidate-portal/profile        │
│  • /copilot/* (HITL Checkpoints) │  • /candidate-portal/resume         │
│  • /jobs/* (Requisitions)        │  • /candidate-portal/jobs           │
│  • /candidates/* (Sourcing)      │  • /candidate-portal/jobs/{id}/apply│
│  • /compliance/* (EEOC Ledgers)  │  • /candidate-portal/applications   │
│  • /billing/* (Stripe Credits)   │  • /candidate-portal/interview-prep │
│  • /integrations/* (ATS Sync)    │  • /candidate-portal/tailor-resume  │
└─────────────────┬────────────────┴──────────────────┬──────────────────┘
                  │                                   │
        ┌─────────┴─────────┐               ┌─────────┴─────────┐
        ▼                   ▼               ▼                   ▼
┌──────────────────┐ ┌─────────────┐ ┌───────────────┐ ┌────────────────┐
│ Pydantic AI Swarm│ │ Career-Ops  │ │ SQLAlchemy ORM│ │ Celery & Redis │
│ • Requisition    │ │ Engine      │ │ • PostgreSQL  │ │ • Async tasks  │
│ • Sourcing       │ │ • 5D Match  │ │ • SQLite      │ │ • Event bus    │
│ • Screening      │ │ • Ghost-Job │ │ • RLS Scoping │ │ • Telemetry    │
│ • Critic         │ │ • STAR Prep │ │ • 24 Tables   │ │                │
│ • Outreach       │ │ • ATS Tailor│ │               │ │                │
└──────────────────┘ └─────────────┘ └───────────────┘ └────────────────┘
```

---

## 2. Core Architectural Layers

### 2.1 Presentation & State Management Layer (`frontend/`)
- **Framework:** Next.js 14.2.3 App Router with React 18 and Tailwind CSS 3.4.
- **Client Topology:**
  - **Recruiter Experience (`/dashboard/*`):** Mission control workspace for requisitions, candidate sourcing swarms, HITL Copilot checkpoints, analytics, team management, and ATS integrations.
  - **Candidate Experience (`/portal/*`):** Clean, dedicated candidate portal with job discovery, real-time match scoring, resume management, application tracking, interview prep, and privacy shield settings.
- **State Management:**
  - **Server State & Cache:** TanStack React Query (`@tanstack/react-query`) with optimistic mutations.
  - **Global Client State:** Lightweight Zustand stores for active session, theme, and transient UI selections.
- **Telemetry Streaming:** WebSockets stream live agent status to the Swarm Monitor and Neural Stream.

### 2.2 API & Control Plane Layer (`backend/api/`)
- **Framework:** FastAPI with Python 3.11+ / 3.14.
- **Protocol:** RESTful JSON endpoints grouped into domain routers prefixed by `/api/v1/`.
- **Dual-Persona Authentication & RBAC:**
  - Stateless Bearer JWT tokens encode `user_id`, `tenant_id`, and `role` (`"recruiter"`, `"candidate"`, `"admin"`).
  - **Recruiter Endpoints:** Enforce `tenant_id` presence and scope all queries to the tenant's isolated data partition.
  - **Candidate Portal Endpoints (`/api/v1/candidate-portal/*`):** Allow `tenant_id = null`, authenticating the candidate directly to their own candidate record linked via `Candidate.user_id`.

### 2.3 Agent Intelligence & Orchestration (`backend/agents/`)
- **Engine:** Pydantic AI 1.94.0.
- **Recruiter Swarm Roster:**
  1. `RequisitionAnalyzerAgent`: Parses raw requirements, extracts skill taxonomies, and removes exclusionary language.
  2. `CandidateSourcingAgent`: Executes automated candidate search across GitHub, LinkedIn, and external indexes.
  3. `ScreeningAgent`: Evaluates candidate resumes against qualification rubrics, computing strengths and gaps.
  4. `CriticAgent`: Performs algorithmic bias and fairness checks, verifying EEOC and EU AI Act compliance.
  5. `OutreachDispatcherAgent`: Generates personalized multi-channel email drafts subject to human approval.
- **Career-Ops Candidate Engine (`backend/api/routes/candidate_portal.py`):**
  1. **5-Dimension Scoring Engine:** Evaluates match across Title Alignment, Tech Stack, Years of Experience, Domain Expertise, and Cultural/Working Style.
  2. **Ghost Job Detector (Block G):** Identifies stale listings, compliance placeholders, or unmonitored job postings.
  3. **Zero-Fabrication ATS CV Tailor:** Analyzes CV against job requirements, identifying missing target keywords while preserving verified experience.
  4. **STAR Behavioral Interview Flashcards:** Synthesizes structured Situation-Task-Action-Result prompts and answers for job-specific interviews.

### 2.4 Data & Persistence Layer (`backend/db/`)
- **Engine:** Async SQLAlchemy 2.0 with connection pooling (`pool_size=20`, `max_overflow=10`).
- **Relational Stores:** PostgreSQL 15+ for production; SQLite for local rapid iteration and unit tests.
- **Dual-Persona Schema Extensions:**
  - `users`: `tenant_id` is nullable (candidates do not require a tenant); `role` distinguishes access.
  - `candidates`: Added `user_id` (FK to `users.id`), `is_searchable` (recruiter discovery toggle), and `hide_from_companies` (employer domain privacy blacklist).
  - `jobs`: Added `is_published` (controls visibility on the public Candidate Portal).
  - `job_candidates`: Added `applied_by_candidate` (direct applicant tracking) and `career_ops_scoring` (5D fit breakdown).

---

## 3. Decommissioned Legacy Features

In accordance with the product pivot to a dedicated Recruiter + Candidate platform, the following features have been decommissioned:

| Feature | Prior State | Pivot Action | Rationale |
|---|---|---|---|
| **MarketIQ Background Loop** | Scraped macroeconomic job trends periodically in `main.py` lifespan | **Completely Removed** | Eliminated redundant background CPU/network overhead and scraping failures. |
| **Voice AI / Twilio** | Synthetic outbound voice calls for phone screening | **Decommissioned & Unmounted** | High regulatory/TCPA compliance risk, complex telephony setup; low enterprise adoption. |
| **Sales Leads & CRM** | Cold company prospecting and sales lead pipeline | **UI/Nav Removed & Redirected** | Refocused 100% on talent acquisition. Legacy routes redirect to `/dashboard/candidates` and `/dashboard/jobs`; DB tables preserved for zero destructive data loss. |

---

## 4. Module Responsibilities Matrix

| Module | Location | Primary Responsibility |
|---|---|---|
| **Auth & RBAC** | `api/routes/auth*.py` | Role-based token issuance, candidate registration, OAuth social logins, SAML SSO. |
| **Candidate Portal** | `api/routes/candidate_portal.py` | Career-Ops suite: profile, resume upload, 5D match scoring, ghost job detection, ATS CV tailoring, STAR interview flashcards. |
| **Swarm Orchestrator** | `agents/orchestrator.py` | 5-agent recruitment swarm chaining, multi-provider LLM failover, rate-limit backoff. |
| **Copilot Controller** | `api/routes/copilot.py` | Human-in-the-loop checkpoints (`AWAITING_APPROVAL`) for requisition, candidate curation, and sequence review. |
| **Candidate Engine** | `api/routes/candidates.py` | Recruiter-facing talent roster, resume parsing, match scoring, GDPR right-to-erasure. |
| **Job Management** | `api/routes/jobs.py` | Recruiter requisition authoring, publishing controls, and applicant pipeline. |
| **Billing & Credits** | `api/routes/billing.py` | Stripe checkout sessions, usage-based credit ledger, and customer portal. |
| **ATS Integration** | `integrations/unified_ats.py` | Bi-directional Greenhouse Harvest and CEIPAL Talent API synchronization. |
| **Compliance & EEOC** | `api/routes/compliance.py` | Immutable `AIDecisionLedger`, 4/5ths adverse impact calculations, human reviewer overrides. |

---

## 5. Security, Privacy & Data Isolation

1. **Dual-Persona Data Isolation**:
   - Recruiters operate under strict `tenant_id` boundaries. No recruiter can view requisitions or candidate dossiers belonging to another agency or enterprise tenant.
   - Candidates manage their personal profile independently. If a candidate sets `is_searchable = false` or lists an employer domain in `hide_from_companies`, recruiters matching that criteria cannot discover or view the candidate profile.
2. **At-Rest Encryption**: Sensitive credentials (custom SMTP passwords, Team Bring-Your-Own-Key LLM keys, ATS API tokens) are encrypted using AES-256 Fernet via `services/security_service.py`.
3. **GDPR Right-to-Erasure**: `DELETE /api/v1/candidates/{id}/pii` completely erases personal identifiable information while preserving anonymized metrics for compliance ledgers.
4. **Audit Trail**: Every automated agent decision, human reviewer approval, and score override is recorded in `audit_ledgers` with user agent, IP address, and timestamp.
