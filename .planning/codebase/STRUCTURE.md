---
last_mapped_commit: f2fad2b1e423077443f26c93600f11df821b3e3f
last_mapped_at: 2026-10-18
---
# Codebase Structure

**Analysis Date:** 2026-10-18

## Directory Layout

```
dvt-talent-ai/
├── backend/                      # FastAPI application, Pydantic AI agents & database
│   ├── agents/                   # Autonomous AI swarm agents & tools
│   │   ├── tools/                # Playwright, resume, job, and search tools
│   │   ├── orchestrator.py       # Multi-agent coordination DAG
│   │   ├── jd_agent.py           # Job requirement extraction & bias checks
│   │   ├── candidate_sourcing.py # Candidate discovery & privacy filters
│   │   ├── screening_agent.py    # Rubric scoring & qualification match
│   │   ├── critic_agent.py       # EEOC compliance & decision ledger
│   │   ├── outreach_agent.py     # Email sequence drafting
│   │   └── swarm_memory.py       # Redis shared state
│   ├── alembic/                  # Database migration scripts
│   ├── api/                      # REST API routing and middleware
│   │   ├── middleware/           # Tenant scoping, audit logging, rate limiting
│   │   └── routes/               # Modular route controllers (/api/v1/*)
│   ├── db/                       # SQLAlchemy models, sessions, and vector store
│   │   ├── models.py             # 24 relational database models
│   │   ├── session.py            # Async engine and connection pooling
│   │   └── vector_store.py       # ChromaDB / Pinecone adapter
│   ├── integrations/             # External service adapters (Greenhouse, CEIPAL)
│   ├── services/                 # Domain business services (email, billing, sanitizer)
│   ├── tests/                    # Backend Pytest automated tests
│   ├── workers/                  # Celery background workers and tasks
│   ├── config.py                 # Centralized Pydantic application settings
│   ├── main.py                   # ASGI application entry point
│   ├── pytest.ini                # Pytest configuration
│   ├── requirements.txt          # Python dependency specifications
│   └── ruff.toml                 # Python linter and formatter rules
├── frontend/                     # Next.js 14 App Router client
│   ├── src/
│   │   ├── app/                  # Route definitions, layouts, and pages
│   │   │   ├── (auth)/auth/      # Login and registration (dual-persona)
│   │   │   ├── dashboard/        # Recruiter workspace routes
│   │   │   ├── portal/           # Candidate Career-Ops portal routes
│   │   │   ├── layout.tsx        # Root HTML layout and providers
│   │   │   └── page.tsx          # Landing page
│   │   ├── components/           # Reusable UI components and Copilot widgets
│   │   │   ├── copilot/          # Copilot stepper and modal components
│   │   │   ├── dashboard/        # Dashboard cards, metric stats, and tables
│   │   │   ├── portal/           # Candidate portal cards and flashcard decks
│   │   │   └── ui/               # Radix UI design primitives
│   │   ├── lib/                  # Utilities, API client facade, and store
│   │   ├── providers/            # React Query, Theme, and Auth providers
│   │   ├── services/             # Domain HTTP client services
│   │   └── types/                # TypeScript interface declarations
│   ├── tests/                    # Playwright E2E and component test specs
│   ├── package.json              # Frontend npm dependencies and scripts
│   ├── tailwind.config.js        # Tailwind CSS configuration and theme tokens
│   └── tsconfig.json             # TypeScript compiler configuration
├── docs/                         # System architecture, API docs, and guides
├── docker/                       # Docker initialization scripts and Dockerfiles
├── docker-compose.yml            # Local development cluster
├── docker-compose.prod.yml       # Hardened production stack
├── Caddyfile                     # Production reverse proxy and automated TLS config
└── README.md                     # Project overview and quickstart instructions
```

## Directory Purposes

**`backend/agents/`:**
- Purpose: Hosts autonomous AI agents implemented with Pydantic AI.
- Contains: Agent definitions, system prompts, output models, and tool definitions.
- Key files: `orchestrator.py`, `candidate_sourcing.py`, `screening_agent.py`, `critic_agent.py`.

**`backend/api/routes/`:**
- Purpose: HTTP REST API endpoint controllers grouped by domain.
- Contains: Endpoint handlers for authentication, candidates, jobs, swarm execution, candidate portal, billing, and webhooks.
- Key files: `backend/api/routes/candidate_portal.py`, `backend/api/routes/candidates.py`, `backend/api/routes/jobs.py`.

**`backend/db/`:**
- Purpose: Relational database persistence and vector storage.
- Contains: SQLAlchemy ORM models, session life-cycle management, and vector storage clients.
- Key files: `backend/db/models.py`, `backend/db/vector_store.py`.

**`backend/workers/`:**
- Purpose: Distributed asynchronous task processing and scheduled automation.
- Contains: Celery application configuration, task functions, and scheduler workers.
- Key files: `backend/workers/celery_app.py`, `backend/workers/tasks.py`.

**`frontend/src/app/dashboard/`:**
- Purpose: B2B Recruiter and hiring manager SaaS workspace.
- Contains: Pages for job requisitions, candidate pipeline, autonomous swarm control, copilot reviews, team management, and billing.
- Key files: `frontend/src/app/dashboard/page.tsx`, `frontend/src/app/dashboard/candidates/page.tsx`, `frontend/src/app/dashboard/jobs/page.tsx`.

**`frontend/src/app/portal/`:**
- Purpose: B2C Candidate Career-Ops portal for active job seekers.
- Contains: Pages for verified job browsing, 5D fit score inspection, resume tailoring, and STAR behavioral interview practice.
- Key files: `frontend/src/app/portal/page.tsx`, `frontend/src/app/portal/jobs/page.tsx`, `frontend/src/app/portal/interview-prep/page.tsx`.

## Key File Locations

**Entry Points:**
- `backend/main.py`: Primary FastAPI application entry point.
- `backend/workers/celery_app.py`: Background Celery worker entry point.
- `frontend/src/app/page.tsx`: Web client landing page.
- `frontend/src/app/dashboard/page.tsx`: Recruiter dashboard entry point.
- `frontend/src/app/portal/page.tsx`: Candidate portal entry point.

**Configuration:**
- `backend/config.py`: Pydantic application settings.
- `backend/ruff.toml`: Ruff Python linter configuration.
- `frontend/next.config.js`: Next.js compiler and bundle settings.
- `frontend/tailwind.config.js`: Tailwind design system theme definitions.
- `frontend/tsconfig.json`: TypeScript compiler options with `@/*` aliases.

**Core Logic:**
- `backend/agents/orchestrator.py`: Multi-agent coordination DAG.
- `backend/api/routes/candidate_portal.py`: 5D fit scoring & ghost job detection logic.
- `backend/services/sanitizer_service.py`: GDPR PII masking and redaction.
- `backend/services/security_service.py`: AES-256 field encryption for secrets.

**Testing:**
- `backend/tests/`: Pytest test suite (unit, integration, multi-agent, isolation).
- `frontend/tests/`: Playwright end-to-end test specifications.

## Naming Conventions

**Files:**
- Backend: `snake_case.py` (e.g., `candidate_portal.py`, `screening_agent.py`)
- Frontend routes: `kebab-case/page.tsx` (e.g., `interview-prep/page.tsx`)
- Frontend components: `PascalCase.tsx` (e.g., `CopilotActionModal.tsx`, `CandidateCard.tsx`)
- Frontend services: `camelCase.service.ts` (e.g., `candidates.service.ts`)
- TypeScript types: `camelCase.ts` or `kebab-case.ts` (e.g., `types/auth.ts`)

**Directories:**
- Backend packages: `snake_case/` (e.g., `backend/api/routes/`)
- Frontend route segments: `kebab-case/` (e.g., `frontend/src/app/portal/interview-prep/`)

## Where to Add New Code

**New Recruiter Feature / Workflow:**
- Backend endpoint: `backend/api/routes/{feature}.py`
- Backend agent / service: `backend/agents/{feature}_agent.py` or `backend/services/{feature}_service.py`
- Database schema changes: Update `backend/db/models.py` and generate migration with `alembic revision --autogenerate`
- Frontend page: `frontend/src/app/dashboard/{feature}/page.tsx`
- Frontend service: `frontend/src/services/{feature}.service.ts`
- Tests: `backend/tests/api/test_{feature}.py`

**New Candidate Portal Feature:**
- Backend endpoint: Add to `backend/api/routes/candidate_portal.py`
- Frontend page: `frontend/src/app/portal/{feature}/page.tsx`
- Frontend components: `frontend/src/components/portal/`
- Tests: `backend/tests/api/test_candidate_portal.py`

**New Shared Utility / Helper:**
- Backend: `backend/services/` or `backend/db/`
- Frontend: `frontend/src/lib/` or `frontend/src/components/ui/`

## Special Directories

**`.planning/`:**
- Purpose: Contains GSD framework project roadmap, requirements, and codebase maps.
- Generated: Managed by GSD tools.
- Committed: Yes.

**`backend/alembic/versions/`:**
- Purpose: Database migration version history.
- Generated: Created by `alembic revision`.
- Committed: Yes.

**`backend/dvt_talent.db`:**
- Purpose: Local SQLite development database.
- Generated: Automatically created on backend startup.
- Committed: Should be in `.gitignore` for production.

---

*Structure analysis: 2026-10-18*
