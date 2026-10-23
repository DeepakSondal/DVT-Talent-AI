<div align="center">
  <h1>DVT Talent AI</h1>
  <p><strong>Dual-Sided AI Recruitment & Candidate Platform (v2.1)</strong></p>
  
  <p>
    <img src="https://img.shields.io/badge/Pydantic_AI-1.94-FF6F00?style=for-the-badge&logo=pydantic&logoColor=white" />
    <img src="https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=FastAPI&logoColor=white" />
    <img src="https://img.shields.io/badge/Next.js-14.2-000000?style=for-the-badge&logo=next.js&logoColor=white" />
    <img src="https://img.shields.io/badge/PostgreSQL-16%20Prod%20%7C%2015%20Staging-316192?style=for-the-badge&logo=postgresql&logoColor=white" />
    <img src="https://img.shields.io/badge/Redis-7%20Bus%20%26%20Cache-DC382D?style=for-the-badge&logo=redis&logoColor=white" />
    <img src="https://img.shields.io/badge/Pytest-52%20Passed-brightgreen?style=for-the-badge" />
    <img src="https://img.shields.io/badge/E2E-26%2F26%20Passed-brightgreen?style=for-the-badge" />
  </p>
</div>

---

## 🌟 Product Vision & Architecture

**DVT Talent AI** is an enterprise-grade, dual-sided AI talent platform engineered to align recruiters and active job seekers in a unified, ethical ecosystem:

1. **Recruiter & Agency Workspace (B2B SaaS)**: An autonomous 7-agent talent acquisition swarm powered by **Pydantic AI** (`market_iq`, `discovery`, `sourcing`, `critic`, `outreach`, `analytics`, `screening`). Features include dynamic constraint extraction, candidate sourcing with an automated self-healing fallback loop, payload-trimmed anti-bias auditing (NYC Local Law 144 / EU AI Act), Human-in-the-Loop (HITL) Copilot approval gates, ATS bi-directional synchronization (Ashby, Greenhouse, Lever), and personalized candidate outreach microsites (`/m/[id]`).
2. **Candidate Portal & Talent Network (B2C Free Core)**: A candidate empowerment workspace powered by the integrated **Career-Ops Engine**. Job seekers upload resumes, browse verified job postings, view multi-dimensional match breakdowns (Title, Stack, Experience, Domain, Culture), detect ghost job postings, generate zero-fabrication ATS-tailored CVs, prepare with STAR behavioral interview flashcards, and protect their privacy with an employer domain blacklist (`hide_from_companies`).

---

## 📚 Canonical Documentation Index

- **[System Architecture (Root)](ARCHITECTURE.md):** Complete architectural topology, auth boundaries, dual databases, and data flow.
- **[System Architecture Guide](docs/ARCHITECTURE.md):** In-depth technical architecture and multi-agent interaction model.
- **[Database Architecture](docs/DATABASE.md):** PostgreSQL 16 prod vs 15 staging, 26 tables, 8 enums, partial unique index, and Alembic governance.
- **[Autonomous AI Agents](docs/AI_AGENTS.md):** Detailed guide to the 7-agent recruitment swarm, self-healing loop, and Career-Ops engine.
- **[Production Deployment & Containers](docs/DEPLOYMENT.md):** Dual Docker Compose stacks (`docker-compose.prod.yml` and `docker-compose.yml`), Caddy proxy, and storage setup.
- **[Project & Folder Structure Guide](docs/PROJECT_STRUCTURE.md):** Directory layout, conventions, and module separation.
- **[API Reference & Conventions](docs/API.md):** Complete REST endpoints for Recruiters and Candidate Portal.
- **[API Quickstart](docs/API_QUICKSTART.md):** Curl examples for rapid API integration.
- **[Testing & QA Guide](docs/TESTING.md):** Pytest suite (52 passed) and E2E verification (26/26 passed).
- **[User Guide](docs/USER_GUIDE.md):** Dual user walkthroughs for Recruiters and Job Seekers.
- **[Complete Setup Guide](docs/SETUP.md):** Local development and VPS deployment instructions.

---

## 🚀 Key Architectural Highlights & Remediations

1. **Dual-Database Segregation**:
   - **Production:** PostgreSQL 16 Alpine (`dvt_db`, database `dvt_talent`, persistent volume `postgres_prod_data`).
   - **Staging / Testing:** PostgreSQL 15 Alpine (`dvt-postgres`, database `dvt_staging`, host port 5432).
2. **Multi-Tenant Candidate Isolation**:
   - Replaced global email uniqueness with a PostgreSQL partial unique index:
     `CREATE UNIQUE INDEX uq_candidate_tenant_email ON candidates (tenant_id, email) WHERE tenant_id IS NOT NULL;`
   - Multiple recruiting agencies can source the same candidate without collisions.
3. **Startup Race Elimination**:
   - Eliminated destructive `Base.metadata.create_all` calls from startup; schema is governed strictly by Alembic migrations (`007_team_invitations`).
4. **Horizontally-Scalable Redis Swarm Memory**:
   - Migrated agent memory from single-file SQLite to a distributed Redis semantic cache with TTL.
5. **Multiplexed WebSockets**:
   - Real-time telemetry events (`dvt_signals:{tenant_id}`) multiplex seamlessly across multiple browser tabs via `Dict[str, Set[WebSocket]]`.
6. **Token Blacklist & Session Revocation**:
   - Full JWT revocation on `POST /api/v1/auth/logout` checked against Redis on all protected routes.
7. **Unified File Storage Service**:
   - Pluggable `LocalStorageDriver` and `S3StorageDriver` (AWS S3, MinIO, Cloudflare R2) with MIME validation and path traversal defense.
8. **LLM Guardrails**:
   - Token bucket RPM/TPM rate limiter and circuit breaker with exponential cool-off.

---

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Agent Framework:** Pydantic AI 1.94.0 with dynamic multi-model routing (Groq, OpenAI, Anthropic, DeepSeek)
- **Database ORM:** Async SQLAlchemy 2.0 with connection pooling
- **Schema & Migrations:** Alembic (Head: `007_team_invitations`)
- **Task Queue & Cache:** Celery & Redis 7
- **Reverse Proxy:** Caddy 2 with automated TLS
- **Testing:** Pytest (52 passed, 6 skipped)

### Frontend
- **Framework:** Next.js 14.2.3 App Router (React 18 & TypeScript)
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
# Staging / Local Testing Stack (PostgreSQL 15 dvt_staging + Redis)
docker compose up --build -d

# Production Stack (Caddy + Next.js + FastAPI + PostgreSQL 16 dvt_talent + Redis + Celery)
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.prod.yml exec api alembic upgrade head
```

---

## 🧪 Quality Assurance & Test Verification

```bash
# Run backend pytest suite (all 52 tests including architectural remediations pass)
cd backend && python -m pytest -v

# Run frontend type checking (0 errors)
cd frontend && npm run type-check

# Run frontend production build
cd frontend && npm run build
```

---

## 📄 License
Proprietary Core — DVT Talent AI. All rights reserved.
