<div align="center">
  <h1>DVT Talent AI</h1>
  <p><strong>Dual-Sided AI Recruitment & Candidate Platform (v2.1)</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Pydantic_AI-1.94-FF6F00?style=for-the-badge&logo=pydantic&logoColor=white" />
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=FastAPI&logoColor=white" />
    <img src="https://img.shields.io/badge/Next.js-15.5-000000?style=for-the-badge&logo=next.js&logoColor=white" />
    <img src="https://img.shields.io/badge/PostgreSQL-16%20Prod%20%7C%2015%20Staging%20(pgvector)-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/Redis-7%20Bus%20%26%20Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
    <img src="https://img.shields.io/badge/Pytest-213%20Passed-brightgreen?style=for-the-badge" />
    <img src="https://img.shields.io/badge/Next.js%20Routes-30%2F30%20Compiled-brightgreen?style=for-the-badge" />
  </p>
</div>

---

## 🌟 Product Vision & Architecture

**DVT Talent AI** is an enterprise-grade, dual-sided AI talent platform engineered to align recruiters and active job seekers in a unified, ethical ecosystem:

1. **Recruiter & Agency Workspace (B2B SaaS)**: An autonomous 7-agent talent acquisition swarm powered by **Pydantic AI** (`market_iq`, `discovery`, `sourcing`, `critic`, `outreach`, `analytics`, `screening`). Features include dynamic constraint extraction, candidate sourcing with an automated self-healing fallback loop, payload-trimmed anti-bias auditing (NYC Local Law 144 / EU AI Act), Human-in-the-Loop (HITL) Copilot approval gates, ATS bi-directional synchronization (Ashby, Greenhouse, Lever), dual-tier recruiter mailbox delivery (Google Workspace & Microsoft 365 OAuth 2.0 or Reply-To Relay), and personalized candidate outreach microsites (`/m/[id]`).
2. **Candidate Portal & Talent Network (B2C Free Core)**: A candidate empowerment workspace powered by the integrated **Career-Ops Engine**. Job seekers upload resumes, browse verified job postings, view multi-dimensional match breakdowns (Title, Stack, Experience, Domain, Culture), detect ghost job postings, generate zero-fabrication ATS-tailored CVs, prepare with STAR behavioral interview flashcards, and protect their privacy with an employer domain blacklist (`hide_from_companies`).

---

## 📚 Canonical Documentation Index

- **[System Architecture (Root)](ARCHITECTURE.md):** Complete architectural topology, auth boundaries, dual databases, and data flow.
- **[System Architecture Guide](docs/ARCHITECTURE.md):** In-depth technical architecture and multi-agent interaction model.
- **[Database Architecture](docs/DATABASE.md):** PostgreSQL 16 prod vs 15 staging, 26 tables, 8 enums, pgvector, partial unique candidate index, and composite company index.
- **[Autonomous AI Agents](docs/AI_AGENTS.md):** Detailed guide to the 7-agent recruitment swarm, self-healing loop, and Career-Ops engine.
- **[Dodo Payments Integration](docs/DODO_PAYMENTS.md):** Merchant of Record (MoR) setup, hosted Checkout Sessions, Customer Portal, and HMAC-SHA256 verified webhooks.
- **[Production Deployment & Containers](docs/DEPLOYMENT.md):** Dual Docker Compose stacks (`docker-compose.prod.yml` and `docker-compose.yml`), Caddy proxy, and storage setup.
- **[Project & Folder Structure Guide](docs/PROJECT_STRUCTURE.md):** Directory layout, conventions, and module separation.
- **[API Reference & Conventions](docs/API.md):** Complete REST endpoints for Recruiters, Candidate Portal, Dodo Payments, and OAuth Mailbox Delivery.
- **[API Quickstart](docs/API_QUICKSTART.md):** Curl examples for rapid API integration.
- **[Testing & QA Guide](docs/TESTING.md):** Pytest suite (213 passed, 3 skipped) and frontend production compilation (30 routes).
- **[User Guide](docs/USER_GUIDE.md):** Dual user walkthroughs for Recruiters and Job Seekers.
- **[Complete Setup Guide](docs/SETUP.md):** Local development and VPS deployment instructions.

---

## 🚀 Key Architectural Highlights & Remediations

1. **Dual-Database Segregation & pgvector**:
   - **Production:** PostgreSQL 16 Alpine (`dvt_db`, database `dvt_talent`, persistent volume `postgres_prod_data`, native `vector` extension).
   - **Staging / Testing:** PostgreSQL 15 Alpine (`dvt-postgres`, image `pgvector/pgvector:pg15`, database `dvt_staging`, host port 5432).
   - **Vector Store:** FastEmbed CPU ONNX embeddings (384-d `BAAI/bge-small-en-v1.5`) + PostgreSQL `pgvector` (`VectorColumn(384)`). ChromaDB has been decommissioned.
2. **Multi-Tenant Candidate & Company Isolation**:
   - Candidate email uniqueness scoped via partial index:
     `CREATE UNIQUE INDEX uq_candidate_tenant_email ON candidates (tenant_id, email) WHERE tenant_id IS NOT NULL;`
   - Company domains scoped per workspace via composite index:
     `CREATE UNIQUE INDEX uq_companies_tenant_domain ON companies (tenant_id, domain);`
   - Team member and analytics routes strictly filtered by `manager.tenant_id`.
3. **Monetization via Dodo Payments (Merchant of Record)**:
   - Full global tax compliance, automated invoicing, and MoR management via Dodo Payments.
   - Hosted Checkout Sessions, Customer Portal self-serve management, and cryptographically verified HMAC-SHA256 webhooks.
4. **Dual-Tier Recruiter Mailbox Delivery**:
   - **Tier 1 (One-Click OAuth 2.0):** Native mailbox sending via Google Workspace (Gmail API) and Microsoft 365 (Microsoft Graph API) with encrypted token storage.
   - **Tier 2 (Zero-Setup Relay Fallback):** Instant platform sending via verified domain reply-to relay.
5. **GDPR Article 17 4-Tier Erasure Protocol**:
   - Sweeps and confirms atomic deletion across Primary Database (`pii_erased = True`), disk storage (`uploads/resumes/`), vector database embeddings, and Redis caches.
6. **Horizontally-Scalable Redis Swarm Memory**:
   - Agent memory operates on distributed Redis semantic cache with TTL, replacing single-file SQLite state.
7. **Multiplexed WebSockets**:
   - Real-time telemetry events (`dvt_signals:{tenant_id}`) multiplex across multiple browser tabs via `Dict[str, Set[WebSocket]]`.
8. **Token Blacklist & Session Revocation**:
   - Full JWT revocation on `POST /api/v1/auth/logout` checked against Redis on all protected routes.
9. **Unified File Storage Service**:
   - Pluggable `LocalStorageDriver` and `S3StorageDriver` (AWS S3, MinIO, Cloudflare R2) with MIME validation and path traversal defense.
10. **LLM Guardrails & Multi-Model Routing**:
    - Token bucket RPM/TPM rate limiter and circuit breaker with support for Anthropic Claude, Groq, OpenAI, Kimi, and DeepSeek.

---

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Agent Framework:** Pydantic AI 1.94.0 with dynamic multi-model routing (Anthropic, Groq, OpenAI, Kimi, DeepSeek)
- **Database ORM:** Async SQLAlchemy 2.0 with connection pooling
- **Vector Search:** FastEmbed CPU ONNX + PostgreSQL pgvector (384 dimensions)
- **Billing & MoR:** Dodo Payments SDK (`dodopayments`)
- **Schema & Migrations:** Alembic (Head: `0001_initial_schema`)
- **Task Queue & Cache:** Celery & Redis 7
- **Reverse Proxy:** Caddy 2 with automated TLS
- **Testing:** Pytest (213 passed, 3 skipped)

### Frontend
- **Framework:** Next.js 15.5 App Router (React 18/19 & TypeScript)
- **Styling:** Tailwind CSS + Radix UI + Framer Motion
- **State & Data Fetching:** TanStack React Query + Zustand
- **Real-Time Telemetry:** WebSockets

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

- **Candidate Portal:** `http://localhost:3000/portal`
- **Recruiter Command Center:** `http://localhost:3000/dashboard`
- **FastAPI OpenAPI Interactive Docs:** `http://127.0.0.1:8000/api/docs`

### 2. Docker Compose Stacks

```bash
# Staging / Local Testing Stack (PostgreSQL 15 pgvector + Redis)
docker compose up --build -d

# Production Stack (Caddy + Next.js + FastAPI + PostgreSQL 16 dvt_talent + Redis + Celery)
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
docker compose -f docker-compose.prod.yml exec api python scripts/pilot_seed.py
```

---

## 🧪 Quality Assurance & Test Verification

```bash
# Run backend pytest suite (all 213 tests pass)
cd backend && python -m pytest -q

# Run frontend type checking (0 errors)
cd frontend && npm run type-check

# Run frontend production build (30 routes compiled)
cd frontend && npm run build
```

---

## 📄 License
Proprietary Core — DVT Talent AI. All rights reserved.
