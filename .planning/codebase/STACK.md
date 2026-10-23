---
last_mapped_commit: 91fa041
last_mapped_at: 2026-10-24
---
# Technology Stack

**Analysis Date:** 2026-10-24

## Languages

**Primary:**
- Python 3.10 / 3.11+ — Backend API, agent orchestration, background tasks, database models (`backend/`)
- TypeScript 5.4.5 — Frontend web client, React components, types, services, API client (`frontend/src/`)

**Secondary:**
- JavaScript (Node.js) — Build configuration scripts (`frontend/next.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`)
- SQL — Schema migrations and database queries (`backend/alembic/`, `backend/db/models.py`)
- Shell (Bash / PowerShell) — Deployment, startup, and automation scripts (`start_local.ps1`, `setup_vps.sh`)

## Runtime

**Environment:**
- Python: CPython 3.10+ / 3.11 (`backend/.venv/`, `backend/Dockerfile`)
- Node.js: 20.x LTS (`frontend/Dockerfile`)
- Browser: Modern evergreen browsers (Chrome, Edge, Firefox, Safari)

**Package Manager:**
- Python: `pip` with `requirements.txt` (`backend/requirements.txt`)
- Node.js: `npm` 10.x with lockfile (`frontend/package.json`, `frontend/package-lock.json`)

## Frameworks

**Core:**
- FastAPI 0.115+ — Asynchronous Python web framework for REST API, WebSockets, and middleware (`backend/main.py`)
- Pydantic AI 1.94.0 — Multi-agent orchestration, structured output generation, and tool binding (`backend/agents/`)
- Next.js 14.2.3 (App Router) — React full-stack framework with React 18.3.1 (`frontend/src/app/`)
- Tailwind CSS 3.4.3 & Radix UI — Component styling, design tokens, and UI primitives (`frontend/tailwind.config.js`, `frontend/src/components/ui/`)

**Testing:**
- Pytest 8.1.1 + `pytest-asyncio` 0.23.6 — Backend asynchronous test runner (`backend/pytest.ini`, `backend/tests/`)
- Playwright 1.44.0 — Frontend and browser agent automation (`frontend/playwright.config.ts`, `frontend/tests/`)

**Build/Dev:**
- Uvicorn 0.29+ — ASGI production web server (`backend/main.py`)
- Next.js Compiler (SWC) — Fast bundling and TypeScript transpilation (`frontend/next.config.js`)
- Ruff — Fast Python linter and formatter (`backend/ruff.toml`)
- Alembic — Database migrations engine (`backend/alembic/`, `backend/alembic.ini`)
- Celery 5.3+ — Distributed task queue with Redis broker (`backend/workers/celery_app.py`)

## Key Dependencies

**Critical:**
- `pydantic-ai` 1.94.0 — Core agent definitions, prompts, and schema validation (`backend/agents/`)
- `sqlalchemy` 2.0+ (with `asyncpg` and `psycopg2-binary`) — Async ORM and database persistence (`backend/db/models.py`)
- `groq`, `anthropic`, `openai`, `httpx` — Multi-model LLM provider integration with automatic failover (`backend/config.py`, `backend/agents/pydantic_config.py`)
- `python-jose` 3.3.0 & `passlib` 1.7.4 — JWT authentication and bcrypt password hashing (`backend/api/routes/auth.py`)
- `@tanstack/react-query` 5.37.1 — Server state management, caching, and mutation hooks (`frontend/src/providers/query-provider.tsx`)
- `zustand` 4.5.2 — Client-side global state management for auth and copilot (`frontend/src/lib/store.ts`)
- `zod` 3.23.8 & `react-hook-form` 7.51.4 — Client-side form validation and schema definitions (`frontend/src/components/`)
- `framer-motion` 11.2.10 & `lucide-react` 0.383.0 — UI animations and icons (`frontend/src/`)

**Infrastructure:**
- `redis` & `celery` — Distributed queue, agent semantic memory, token blacklist, and rate-limiting storage (`backend/workers/`, `backend/agents/swarm_memory.py`)
- `boto3` / `aiobotocore` — AWS S3 / MinIO / Cloudflare R2 object storage drivers (`backend/services/storage_service.py`)
- `stripe` 9.6.0 — Recruiter subscription billing and credit allocation (`backend/api/routes/billing.py`)
- `structlog` & `prometheus-client` — Structured JSON logging and Prometheus metrics endpoint (`backend/main.py`)
- `sentry-sdk` 1.44+ — Application performance monitoring and error telemetry (`backend/main.py`)

## Configuration & Platform Requirements

**Databases:**
- **Production:** PostgreSQL 16 Alpine (`dvt_db` container, `dvt_talent` database, `postgres_prod_data` persistent volume)
- **Staging / Testing:** PostgreSQL 15 Alpine (`dvt-postgres` container, `dvt_staging` database, host port 5432)

**Deployment:**
- `docker-compose.prod.yml`: Production container stack with Caddy proxy (auto-HTTPS), Next.js frontend, FastAPI API, Celery worker/scheduler, Redis 7, and PostgreSQL 16.
- `docker-compose.yml`: Local testing stack with PostgreSQL 15 and Redis.
