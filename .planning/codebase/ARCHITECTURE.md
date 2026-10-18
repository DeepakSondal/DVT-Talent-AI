---
last_mapped_commit: ee9d6a24a777ec960b14cb11bf7c76de171b3e23
last_mapped_at: 2026-10-18
---
<!-- refreshed: 2026-10-18 -->

# Architecture

**Analysis Date:** 2026-10-18

## System Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│               Presentation Layer (Next.js 14 App Router)               │
├───────────────────────────────────┬────────────────────────────────────┤
│  Recruiter Workspace              │  Candidate Career-Ops Portal       │
│  `frontend/src/app/dashboard/*`   │  `frontend/src/app/portal/*`       │
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                  │                                    │
                  │   HTTPS REST & WebSockets (JWT)    │
                  ▼                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                 API Gateway & Control Plane (FastAPI)                  │
│                        `backend/main.py`                               │
├───────────────────────────────────┬────────────────────────────────────┤
│  Recruiter Swarm Orchestration    │  Candidate Career-Ops Router       │
│  `backend/agents/orchestrator.py` │  `backend/api/routes/candidate_...`│
└─────────────────┬─────────────────┴──────────────────┬─────────────────┘
                  │                                    │
                  ▼                                    ▼
┌───────────────────────────────────┐ ┌──────────────────────────────────┐
│  5-Agent Pydantic AI Swarm        │ │  Background Workers & Brokers    │
│  - Requisition Analyzer (`jd_...`)│ │  - Celery Worker & Beat          │
│  - Candidate Sourcing (`sourc...`)│ │  - Redis Message Bus (`redis:7`) │
│  - Screening Agent (`screen...`)  │ │  `backend/workers/`              │
│  - Critic & EEOC (`critic_...`)   │ └──────────────────────────────────┘
│  - Outreach Dispatcher (`outr...`)│
└─────────────────┬─────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Persistence & Vector Layer                       │
│  - PostgreSQL 15+ / SQLite (`backend/db/models.py`)                    │
│  - ChromaDB / Pinecone (`backend/db/vector_store.py`)                  │
└────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| API Entry & Middleware | Mounts routes, CORS, session, audit logging, rate limiting, and Sentry | `backend/main.py` |
| Settings & Config | Centralized typed configuration with multi-LLM failover detection | `backend/config.py` |
| Swarm Orchestrator | Coordinates multi-agent sourcing, screening, and outreach pipeline | `backend/agents/orchestrator.py` |
| Candidate Portal Route | 5D match scoring, ghost job detection, resume upload, and STAR prep | `backend/api/routes/candidate_portal.py` |
| Database Models | 24 SQLAlchemy models supporting dual-persona tenancy and compliance ledgers | `backend/db/models.py` |
| Vector Store Adapter | Unified embedding index abstraction over ChromaDB and Pinecone | `backend/db/vector_store.py` |
| ATS Integrations | Unified synchronization engine for Greenhouse Harvest and CEIPAL APIs | `backend/integrations/unified_ats.py` |
| Celery Task Worker | Asynchronous background processing for long-running agent tasks | `backend/workers/tasks.py` |
| Frontend Web Client | Dual-persona UI: Recruiter Dashboard and Candidate Career-Ops Portal | `frontend/src/app/` |

## Pattern Overview

**Overall:** Modular Monolith API with Asynchronous Autonomous AI Agent Swarms and Dual-Persona Client.

**Key Characteristics:**
- **Dual-Persona Architecture:** B2B Recruiters (tenant-scoped) and B2C Candidates (user-scoped with privacy shields) share a unified backend.
- **Asynchronous Agent DAG:** Multi-agent pipeline built with Pydantic AI with step-by-step state checkpoints in Redis and database.
- **Human-in-the-Loop (HITL) Copilot:** Critical actions (such as dispatching outreach sequences or hiring decisions) pause in `AWAITING_INPUT` until confirmed by human operators.

## Layers

**Presentation Layer:**
- Purpose: Delivers responsive, high-fidelity UI for recruiters and candidates.
- Location: `frontend/src/app/`
- Contains: Next.js App Router pages, layout shells, Zustand stores, and Radix UI components.
- Depends on: Backend HTTP REST endpoints and WebSocket channels.
- Used by: End users (Recruiters, Hiring Managers, Job Seekers).

**API Routing & Control Plane:**
- Purpose: HTTP request routing, authentication, authorization, and tenant isolation.
- Location: `backend/api/routes/`, `backend/api/middleware/`
- Contains: FastAPI router modules, dependency injection helpers, and rate limiters.
- Depends on: Database models and agent orchestrators.
- Used by: Frontend client and inbound webhooks.

**Intelligence & Reasoning Layer:**
- Purpose: Executes autonomous LLM-driven parsing, sourcing, screening, and outreach.
- Location: `backend/agents/`
- Contains: Pydantic AI agents (`jd_agent.py`, `candidate_sourcing.py`, `screening_agent.py`, `critic_agent.py`, `outreach_agent.py`).
- Depends on: LLM providers (Anthropic, Groq, OpenAI) and vector storage.
- Used by: Swarm orchestrator and background workers.

**Persistence & Data Layer:**
- Purpose: Relational data storage, vector embeddings, and task queuing.
- Location: `backend/db/`, `backend/workers/`
- Contains: SQLAlchemy models, Alembic migrations, ChromaDB/Pinecone adapters, and Celery tasks.
- Depends on: PostgreSQL and Redis.
- Used by: All backend services and agents.

## Data Flow

### Primary Request Path (Recruiter Sourcing Swarm)

1. Recruiter triggers candidate search in UI (`frontend/src/app/dashboard/sourcing/page.tsx`)
2. API endpoint receives request and validates JWT/tenant (`backend/api/routes/agents.py:start_swarm`)
3. Orchestrator initializes task in Redis and DB with status `PENDING` (`backend/agents/orchestrator.py`)
4. Requisition Analyzer parses job requirements into skill rubrics (`backend/agents/jd_agent.py`)
5. Sourcing Agent queries GitHub/LinkedIn while respecting candidate privacy shields (`backend/agents/candidate_sourcing.py`)
6. Screening Agent computes qualification match scores (`backend/agents/screening_agent.py`)
7. Critic Agent runs EEOC adverse-impact check and logs decision in `AIDecisionLedger` (`backend/agents/critic_agent.py`)
8. Outreach Dispatcher drafts sequences and halts at HITL checkpoint (`backend/agents/outreach_agent.py`)
9. Status broadcast via WebSocket (`backend/api/routes/websocket.py`) to UI (`frontend/src/components/copilot/CopilotActionModal.tsx`)

### Secondary Flow (Candidate Career-Ops Match)

1. Candidate uploads resume and views verified jobs (`frontend/src/app/portal/jobs/page.tsx`)
2. Backend receives profile and runs 5-dimension scoring (`backend/api/routes/candidate_portal.py:get_candidate_jobs`)
3. Weights applied: 20% title, 35% tech stack, 20% experience, 15% domain, 10% culture
4. Ghost-job detector checks requisition age > 60 days and pipeline staleness
5. Candidate receives verified match scores and practices with STAR flashcards (`frontend/src/app/portal/interview-prep/page.tsx`)

**State Management:**
- Relational state: Persisted in PostgreSQL tables (`backend/db/models.py`).
- Swarm runtime memory: Redis key-value store (`backend/agents/swarm_memory.py`).
- Client state: Zustand stores for authentication and copilot stepper state (`frontend/src/lib/store.ts`).

## Key Abstractions

**Pydantic AI Agent:**
- Purpose: Type-safe LLM agent definition with system prompts, dependency injection, and schema enforcement.
- Examples: `jd_agent.py`, `critic_agent.py`, `outreach_agent.py` in `backend/agents/`
- Pattern: Dependency-injected Agent instance with structured output models.

**Unified ATS Adapter:**
- Purpose: Standardized abstraction over disparate ATS APIs (Greenhouse Harvest, CEIPAL).
- Examples: `backend/integrations/unified_ats.py`
- Pattern: Adapter / Strategy pattern.

**Vector Store Singleton:**
- Purpose: Unified embedding operations over local ChromaDB or cloud Pinecone.
- Examples: `backend/db/vector_store.py`
- Pattern: Singleton client with lazy connection initialization and mock fallbacks.

## Entry Points

**Backend HTTP API:**
- Location: `backend/main.py`
- Triggers: Uvicorn ASGI server starting on port 8000.
- Responsibilities: Startup validation (`settings.validate_required_settings()`), DB initialization, middleware attachment, router registration.

**Frontend Web Application:**
- Location: `frontend/src/app/layout.tsx` and `frontend/src/app/page.tsx`
- Triggers: Next.js server on port 3000.
- Responsibilities: Root HTML shell, ThemeProvider, QueryProvider, AuthProvider, and route rendering.

**Distributed Background Worker:**
- Location: `backend/workers/celery_app.py`
- Triggers: Celery worker CLI process (`celery -A workers.celery_app worker`).
- Responsibilities: Execution of offloaded asynchronous tasks (email dispatch, background sourcing, ATS sync).

## Architectural Constraints

- **Multi-Tenant Scoping:** All B2B recruiter operations MUST filter queries by `tenant_id`.
- **Candidate Privacy Shield:** Candidate records with `is_searchable = False` or employer domains in `hide_from_companies` MUST NOT be returned in recruiter sourcing swarms.
- **EEOC AI Audit Trail:** All autonomous candidate scoring decisions MUST log an immutable entry to `AIDecisionLedger` with explanation metadata.
- **Async Execution:** Heavy AI model calls and web scraping must run asynchronously outside the HTTP request lifecycle.

## Anti-Patterns

### Recursive Symlink Hack (`backend/backend`)

**What happens:** Directory symlink `backend/backend` pointing back to `.` allows inconsistent imports (`from backend.xxx import ...` vs `from xxx import ...`).  
**Why it's wrong:** Causes duplicate module entries in `sys.modules`, which risks broken singletons in SQLAlchemy.  
**Do this instead:** Standardize on package-level imports and set `PYTHONPATH=.` in virtual environments.

### Giant Monolithic Frontend Components

**What happens:** Multi-step wizard workflows (`frontend/src/components/copilot/CopilotActionModal.tsx`) combine state, networking, and rendering across 750+ lines.  
**Why it's wrong:** Difficult to test, high re-render penalty, and poor code maintainability.  
**Do this instead:** Decompose into modular components with explicit props (`PhaseStepper.tsx`, `CandidateCard.tsx`, `ScoreRing.tsx`).

## Error Handling

**Strategy:** Fail-fast validation at boundary layers with centralized error responses.

**Patterns:**
- Pydantic models validate all incoming request bodies (`pydantic.ValidationError` -> HTTP 422).
- HTTP exceptions raised as `fastapi.HTTPException` with explicit status codes and error detail strings.
- Silent fail-safe for email open/click tracking pixels (`backend/main.py:156`) to ensure user tracking never crashes client experience.

## Cross-Cutting Concerns

**Logging:** Structured JSON logging using `structlog` (`backend/main.py:53`), tracking user ID, tenant ID, and execution duration.  
**Validation:** Dual-layer validation with Pydantic v2 schemas on backend and Zod on frontend.  
**Authentication:** Stateless JWT bearer tokens with embedded role (`"recruiter"` | `"candidate"`) and tenant identifier.

---

*Architecture analysis: 2026-10-18*
