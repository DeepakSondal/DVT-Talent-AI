# DVT Talent AI — System Architecture Specification (Technical Deep Dive)

## Overview

DVT Talent AI is a production-grade, dual-sided AI talent platform that unifies **Recruiter & Agency Talent Acquisition (B2B)** with **Candidate Career Enablement (B2C Free Core)**.

```
┌──────────────────────────────────────────────────────────────────────┐
│                        DVT TALENT AI PLATFORM                         │
├──────────────────────────────────────────────────────────────────────┤
│  PRESENTATION LAYER (Next.js 14 App Router + TailwindCSS + ShadCN)    │
│  ┌─────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ Recruiter Command Center    │   │ Candidate Career-Ops Portal  │  │
│  │ (/dashboard/*)              │   │ (/portal/*)                  │  │
│  │ • Requisitions & Parsing    │   │ • 5D Match & Ghost Job Check │  │
│  │ • 5-Agent Autonomous Swarm  │   │ • Zero-Fabrication ATS CV    │  │
│  │ • HITL Copilot Stepper      │   │ • STAR Interview Flashcards  │  │
│  │ • ATS Sync & Stripe Billing │   │ • Employer Privacy Shield    │  │
│  └──────────────┬──────────────┘   └──────────────┬───────────────┘  │
├─────────────────┼─────────────────────────────────┼──────────────────┤
│  REST API + WebSocket (FastAPI, JWT Bearer Auth with Role Scoping)   │
├──────────────────────────────────────────────────────────────────────┤
│  API CONTROL PLANE (FastAPI + Python 3.11+)                          │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ Auth (Role-Aware) │ Jobs │ Candidates │ Candidate Portal        │  │
│  │ Swarm Orchestrator │ Copilot HITL │ Billing │ Compliance │ ATS │  │
│  └────────────────────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  INTELLIGENCE & REASONING ENGINES                                     │
│  ┌──────────────────────────────┐   ┌─────────────────────────────┐  │
│  │ Recruiter Swarm (Pydantic AI)│   │ Career-Ops Candidate Engine │  │
│  │ • Requisition Analyzer Agent │   │ • 5-Dimension Match Scorer  │  │
│  │ • Talent Sourcing Agent      │   │ • Ghost-Job Detector (Blk G)│  │
│  │ • Candidate Screening Agent  │   │ • Zero-Fabrication Tailor   │  │
│  │ • Critic & Governance Agent  │   │ • STAR Interview Coach      │  │
│  │ • Outreach Dispatcher Agent  │   │                             │  │
│  └──────────────────────────────┘   └─────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  PERSISTENCE & INFRASTRUCTURE                                         │
│  ┌───────────────────────┐ ┌────────────────────┐ ┌────────────────┐ │
│  │ PostgreSQL 15+        │ │ Vector Storage     │ │ Redis 7+       │ │
│  │ (Async SQLAlchemy 2.0)│ │ (ChromaDB / Mock)  │ │ (Pub/Sub & Bus)│ │
│  └───────────────────────┘ └────────────────────┘ └────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 1. Dual-Persona Authentication & Authorization Boundaries

The platform operates across two distinct user personas with clearly delineated data boundaries:

```mermaid
graph TD
    User([User Registration / Login]) --> Token[JWT Token Issued: user_id, tenant_id, role]
    
    Token --> CheckRole{role == 'recruiter'?}
    
    CheckRole -->|Yes| RecruiterPath[B2B Recruiter Flow]
    CheckRole -->|No| CandidatePath[B2C Candidate Flow]
    
    RecruiterPath --> TenantScope[Tenant Isolation Middleware: tenant_id required]
    TenantScope --> RecruiterDB[(Tenant-Scoped Data: Requisitions, Sourced Candidates, Campaigns)]
    
    CandidatePath --> UserScope[Candidate User Scope: tenant_id optional]
    UserScope --> PrivacyShield{Candidate.is_searchable?}
    PrivacyShield -->|Yes| Searchable[Discoverable by Recruiters in Global Network]
    PrivacyShield -->|No| Private[Hidden from Sourcing Swarms]
    
    UserScope --> BlacklistCheck{Employer Domain in hide_from_companies?}
    BlacklistCheck -->|Yes| BlockRecruiter[Hidden from specific employer recruiters]
    BlacklistCheck -->|No| AllowMatch[Eligible for matching]
```

### Authorization Rules
1. **Recruiter Role (`role: "recruiter"`)**:
   - Access: `/dashboard/*` web routes and `/api/v1/jobs`, `/api/v1/candidates`, `/api/v1/agents/*`, `/api/v1/copilot/*`, `/api/v1/billing/*`, `/api/v1/integrations/*`.
   - Data Scope: Strictly constrained to rows matching `tenant_id`.
2. **Candidate Role (`role: "candidate"`)**:
   - Access: `/portal/*` web routes and `/api/v1/candidate-portal/*`.
   - Data Scope: Constrained to the authenticated user's `Candidate` record linked via `Candidate.user_id == current_user.id`.

---

## 2. Recruiter Swarm Intelligence Architecture

The recruiter swarm automates candidate sourcing and screening using **Pydantic AI 1.94.0** with strict typing and structured outputs.

### The 5 Core Recruiter Agents:
1. **Requisition Analyzer Agent (`backend/agents/jd_agent.py`)**:
   - Ingests raw job requirements, extracts essential vs preferred skills, salary bands, and removes non-inclusive bias.
2. **Talent Sourcing Agent (`backend/agents/candidate_sourcing.py`)**:
   - Coordinates multi-channel searches across GitHub, LinkedIn, and external sources.
   - Respects candidate privacy shields (`is_searchable == False` and `hide_from_companies`).
3. **Screening Agent (`backend/agents/screening_agent.py`)**:
   - Evaluates parsed CVs against job rubrics, computing objective score breakdowns (strengths, gaps, risk factors).
4. **Critic & Governance Agent (`backend/agents/critic_agent.py`)**:
   - Monitors scoring for adverse impact against protected classes according to EEOC 4/5ths guidelines.
   - Logs immutable decision entries in `AIDecisionLedger`.
5. **Outreach Dispatcher Agent (`backend/agents/outreach_agent.py`)**:
   - Composes hyper-personalized multi-stage email drafts.
   - Enforces the Human-in-the-Loop review gate before sending any email.

---

## 3. Career-Ops Candidate AI Engine

The Candidate Portal is powered by the integrated **Career-Ops Engine** (`backend/api/routes/candidate_portal.py`):

### 3.1 5-Dimension Match Scoring
Evaluates candidate profiles against published job postings across 5 weighted dimensions:
- **Title Alignment (20%)**: Semantic match between candidate current/past titles and target job title.
- **Tech Stack (35%)**: Exact and contextual overlap of programming languages, frameworks, and tooling.
- **Experience Level (20%)**: Seniority, years of domain experience, and leadership scope.
- **Domain Expertise (15%)**: Industry background (FinTech, HealthTech, AI/ML, Enterprise SaaS).
- **Culture & Work Style (10%)**: Remote preferences, pace, team topology, and communication style.

### 3.2 Ghost Job Detection (Block G)
Detects job listings that are likely inactive, stale, or compliance-only placeholders by inspecting:
- Requisition age > 60 days without pipeline movement.
- Generic, unmaintained descriptions without designated hiring team contacts.
- Stale external applicant counts.

### 3.3 Zero-Fabrication ATS CV Tailoring
Unlike generic LLM resume rewriting tools that hallucinate past achievements, the Zero-Fabrication Tailoring Engine:
- Extracts required keywords and skills from the target job posting.
- Cross-references the candidate's existing, verified CV text.
- Re-orders, emphasizes, and formats existing verified experiences to maximize ATS parser readability without adding fabricated claims.

### 3.4 STAR Behavioral Interview Coach
Generates job-specific interview flashcards:
- Synthesizes realistic behavioral interview scenarios based on the target requisition's technical and cultural demands.
- Prompts the candidate with structured **S**ituation, **T**ask, **A**ction, **R**esult frameworks.
- Provides sample answers and evaluation rubrics.

---

## 4. Decommissioned Legacy Features

1. **MarketIQ Background Loop**:
   - Previously scraped hiring signals in a background loop on startup.
   - Removed completely to prevent background CPU/network drain and API rate-limiting issues.
2. **Voice AI / Synthetic Calling**:
   - Unmounted and decommissioned due to strict TCPA compliance constraints and unnecessary operational complexity.
3. **Sales Leads & CRM**:
   - Sales prospecting removed from UI navigation; legacy `/dashboard/leads` and `/dashboard/discovery` routes automatically redirect to `/dashboard/candidates` and `/dashboard/jobs`.
