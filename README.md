<div align="center">
  <h1>DVT Talent AI</h1>
  <p><strong>Dual-Sided AI Recruitment & Candidate Platform (v2.0)</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Pydantic_AI-1.94-FF6F00?style=for-the-badge&logo=pydantic&logoColor=white" />
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=FastAPI&logoColor=white" />
    <img src="https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white" />
    <img src="https://img.shields.io/badge/PostgreSQL-15-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/Pytest-47%20Passed-brightgreen?style=for-the-badge" />
    <img src="https://img.shields.io/badge/E2E-26%2F26%20Passed-brightgreen?style=for-the-badge" />
  </p>
</div>

---

## 🌟 Product Vision & Architecture

**DVT Talent AI** is a production-hardened, dual-sided AI talent platform engineered to align enterprise recruiters and active job seekers in a unified, ethical ecosystem:

1. **Recruiter & Agency Workspace (B2B SaaS)**: An autonomous multi-agent talent acquisition engine powered by **Pydantic AI**. Recruiters manage requisitions, launch autonomous candidate sourcing swarms across GitHub, LinkedIn, and external sources, review explainable AI fit scoring, and orchestrate approval-gated outreach with enterprise SAML SSO and ATS integrations (Greenhouse, CEIPAL).
2. **Candidate Portal & Talent Network (B2C Free Core)**: A candidate empowerment workspace powered by the integrated **Career-Ops Engine**. Job seekers upload resumes, browse verified job postings, view multi-dimensional match breakdowns (Title, Stack, Experience, Domain, Culture), detect ghost job postings, generate zero-fabrication ATS-tailored CVs, prepare with STAR behavioral interview flashcards, and protect their privacy with an employer domain blacklist.

> **Architecture Pivot Note:** Legacy sales-lead prospecting, cold company discovery, Voice AI calling, and continuous background scraping loops (MarketIQ) have been decommissioned. The platform is 100% focused on ethical, high-precision recruitment and candidate career enablement.

---

## 📚 Canonical Documentation Index

- **[System Architecture (Root)](ARCHITECTURE.md):** Complete architectural topology, auth boundaries, and data flow.
- **[System Architecture Guide](docs/ARCHITECTURE.md):** In-depth technical architecture and multi-agent interaction model.
- **[Project & Folder Structure Guide](docs/PROJECT_STRUCTURE.md):** Directory layout, conventions, and module separation.
- **[API Reference & Conventions](docs/API.md):** Complete REST endpoints for Recruiters and Candidate Portal.
- **[API Quickstart](docs/API_QUICKSTART.md):** Curl examples for rapid API integration.
- **[Database Architecture](docs/DATABASE.md):** Relational schema, dual-persona models, RLS, and pooling.
- **[Autonomous AI Agents](docs/AI_AGENTS.md):** Detailed guide to the 5-agent recruitment swarm and Career-Ops AI engine.
- **[Agent Communication Fabric](docs/AGENT_COMMUNICATION.md):** Telemetry, event bus, and shared memory contracts.
- **[Testing & QA Guide](docs/TESTING.md):** Pytest suite (47 passed, 6 skipped) and E2E verification (26/26 passed).
- **[User Guide](docs/USER_GUIDE.md):** Dual user walkthroughs for Recruiters and Job Seekers.
- **[Complete Setup Guide](docs/SETUP.md):** Local development and VPS deployment instructions.
- **[Executive Demo Script](docs/DEMO_SCRIPT.md):** 15-minute executive walkthrough script.

---

## 🚀 Key Platform Capabilities

### 💼 For Recruiters & Staffing Agencies (B2B)
- **Autonomous Multi-Agent Swarm (Pydantic AI)**:
  - **Requisition Analyzer Agent**: Parses raw JDs, optimizes skill taxonomies, and neutralizes exclusionary bias.
  - **Talent Sourcing Agent**: Discovers candidates matching open requisitions across GitHub, LinkedIn, and web indexes.
  - **Screening Agent**: Evaluates qualifications, computing alignment, strengths, and experience risks.
  - **Critic & Governance Agent**: Audits candidate scoring for EEOC adverse impact and EU AI Act compliance.
  - **Outreach Dispatcher Agent**: Drafts hyper-personalized email sequences with mandatory human approval gates.
- **Human-in-the-Loop (HITL) Copilot**: Stepper checkpoints (`AWAITING_APPROVAL`) for requisition review, candidate curation, and sequence inspection before dispatch.
- **Enterprise Multi-Tenancy & Security**: Tenant-scoped database queries, Fernet AES-256 encrypted SMTP and BYOK API keys, Enterprise SAML 2.0 SSO (Okta, Azure AD), and GDPR Right-to-Erasure support.
- **Bi-Directional ATS Synchronization**: Normalized sync with Greenhouse Harvest and CEIPAL Talent APIs.
- **Stripe Billing & Credits Ledger**: Usage-based credit deductions, tier upgrades, and self-serve customer billing portal.

### 🎯 For Candidates & Job Seekers (B2C Career-Ops Suite)
- **5-Dimension Fit Scoring**: Real-time evaluation against published jobs across Title, Stack, Experience, Domain, and Culture with actionable recommendations.
- **Ghost Job Detection (Block G)**: Algorithmic detection of stale, compliance-only, or unmonitored job postings.
- **Zero-Fabrication ATS CV Tailoring**: AI resume optimization that aligns keywords and formats strictly to the candidate's verified background without hallucinating credentials.
- **STAR Behavioral Interview Flashcards**: Targeted interview questions, scenario prompts, and structured answer coaching tailored to specific job requisitions.
- **Employer Privacy Shield**: Domain blacklist (`hide_from_companies`) ensuring current employers and competitors cannot view the candidate's searchable profile.
- **Application Tracking**: Real-time status tracking across applied requisitions with submission timestamps and match history.

---

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11+ / 3.14)
- **Agent Framework:** Pydantic AI 1.94.0
- **Database ORM:** Async SQLAlchemy 2.0 with connection pooling (`pool_size=20`, `max_overflow=10`)
- **Schema & Migrations:** Alembic async migrations
- **Task Queue & Cache:** Celery & Redis
- **Testing:** Pytest (47 passed, 6 skipped, 0 failed)

### Frontend
- **Framework:** Next.js 14.2.3 App Router (React 18 & TypeScript)
- **Styling:** Tailwind CSS + Radix UI + Framer Motion
- **State & Data Fetching:** TanStack React Query + Zustand
- **Real-Time Telemetry:** WebSockets
- **Production Routing:** 35 optimized static and dynamic routes

---

## 💻 Quick Start

### 1. Local Development (Windows / PowerShell)

```powershell
# 1. Backend API Server
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --host 127.0.0.1 --port 8000

# 2. Frontend Web Application (in a second terminal)
cd frontend
npm install --legacy-peer-deps
Copy-Item .env.example .env.local
npm run dev
```

- **Candidate Portal:** `http://localhost:3000/portal` (or port `3001` if 3000 is occupied)
- **Recruiter Command Center:** `http://localhost:3000/dashboard`
- **FastAPI OpenAPI Interactive Docs:** `http://127.0.0.1:8000/api/docs`

### 2. Docker Compose Cluster

```bash
cp .env.example .env
docker compose up --build -d
```

---

## 🧪 Quality Assurance & Test Verification

```bash
# Run backend pytest suite (47 passed, 6 skipped)
cd backend && python -m pytest -v

# Run frontend type checking (0 errors)
cd frontend && npm run type-check

# Run frontend production build (35 routes compiled)
cd frontend && npm run build
```

---

## 📄 License
Proprietary Core — DVT Talent AI. All rights reserved.
