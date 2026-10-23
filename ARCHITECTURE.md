# DVT Talent AI — System Architecture Specification
**Version:** 2.1.0 (October 2026)  
**Status:** Production Ready  
**Audited & Remediated By:** Staff Platform Architect & Systems Engineering  

---

## 1. System Overview

DVT Talent AI is an autonomous, dual-sided AI talent recruitment and candidate career enablement platform. The architecture couples a **Next.js 14 App Router** frontend with a high-performance **FastAPI async backend**, coordinating a 7-agent **Pydantic AI swarm** for recruiters and the **Career-Ops AI Engine** for job seekers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EDGE INGRESS (Caddy Proxy)                      │
│        • Automatic TLS (Let's Encrypt) • HSTS & Security Headers       │
│        • Modern Compression (zstd/gzip) • Reverse Proxy & Upgrades     │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼ (/*)                             ▼ (/api/*, /ws/*)
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│        NEXT.JS 14 WEB CLIENT        │  │     FASTAPI ASYNC API         │
├──────────────────┬──────────────────┤  ├───────────────────────────────┤
│ 💼 RECRUITER     │ 🎯 CANDIDATE     │  │ AUTH & IDENTITY:              │
│ DASHBOARD        │ PORTAL           │  │ • Role-Aware JWT & Blacklist  │
│ (/dashboard/*)   │ (/portal/*)      │  │ • Dual-Tenant Scoping         │
│ • Requisitions   │ • Job Board      │  │ • SAML SSO & OAuth2           │
│ • AI Sourcing    │ • 5D Match Score │  ├───────────────────────────────┤
│ • HITL Copilot   │ • Ghost Job Scan │  │ CORE DOMAIN ROUTERS:          │
│ • Bias Audit     │ • ATS CV Tailor  │  │ • /agents & /copilot          │
│ • Team Invites   │ • STAR Rehearsal │  │ • /jobs & /candidates         │
│ • ATS Sync       │ • Privacy Shield │  │ • /candidate-portal           │
│ • Dynamic /m/*   │ • Applications   │  │ • /compliance & /billing      │
└──────────────────┴──────────────────┘  └───────┬──────────────┬────────┘
                                                 │              │
                    ┌────────────────────────────┘              └───────────┐
                    ▼                                                       ▼
┌──────────────────────────────────────┐                ┌───────────────────────────────────┐
│     AUTONOMOUS AI SWARM ENGINE       │                │      PERSISTENCE & DATA LAYER     │
│          (Pydantic AI)               │                ├───────────────────────────────────┤
│ • MarketIQ & Discovery Agents        │                │ PRIMARY PRODUCTION DB:            │
│ • Sourcing Agent (Self-Healing Loop) │                │ • PostgreSQL 16 (dvt_talent)      │
│ • Critic Agent (Anti-Bias Audit)     │                │ • 26 Tables, 8 Enums, Alembic     │
│ • Outreach, Analytics, Screening     │                │ • Partial Unique Candidate Index  │
│ • Redis Semantic Swarm Memory        │                ├───────────────────────────────────┤
│ • LLM Guardrails (RPM/TPM + Breaker) │                │ STAGING & TEST DB:                │
└──────────────────┬───────────────────┘                │ • PostgreSQL 15 (dvt_staging)     │
                   │                                    ├───────────────────────────────────┤
                   ▼                                    │ IN-MEMORY & ASYNC QUEUE:          │
┌──────────────────────────────────────┐                │ • Redis 7 (Broker, Result Backend,│
│   CELERY ASYNC WORKER & BEAT         │                │   Semantic Cache, Pub/Sub Signals)│
│ • Background AI Pipelines            │                ├───────────────────────────────────┤
│ • Scheduled Discovery & Daily Runs   │                │ OBJECT & RESUME STORAGE:          │
│ • ATS Sync (Ashby, Greenhouse, Lever)│                │ • StorageService (Local / AWS S3) │
└──────────────────────────────────────┘                └───────────────────────────────────┘
```

---

## 2. Core Architectural Layers & Remediations

### 2.1 Ingress & Edge Proxy Layer (`Caddyfile`)
- **Automated TLS & Security Headers:** Managed via Caddy with Let's Encrypt certificates, enforcing HTTP Strict Transport Security (`HSTS`), `X-Frame-Options: SAMEORIGIN`, and `X-Content-Type-Options: nosniff`.
- **Dynamic Compression:** Automatic payload compression using `zstd` and `gzip`.
- **Intelligent Reverse Proxy:**
  - `/api/*`, `/health*`, `/ping`: Routed upstream to FastAPI (`api:8000`).
  - `/api/v1/ws/*`: Routed upstream with WebSocket connection upgrades.
  - `/metrics`: Routed upstream for Prometheus scraping.
  - Catch-all `/*`: Routed upstream to Next.js (`frontend:3000`).

### 2.2 Presentation & Frontend Layer (`frontend/`)
- **Framework:** Next.js 14 App Router with React 18, Tailwind CSS, and Shadcn UI.
- **Recruiter Dashboard (`/dashboard/*`):**
  - `/dashboard/sourcing`: Real-time talent discovery interface.
  - `/dashboard/candidates`: Candidate pipeline with fit scores, resume views, and audit logs.
  - `/dashboard/jobs`: Job requisition management with AI constraint extraction.
  - `/dashboard/approvals`: Human-in-the-Loop (HITL) gate for reviewing AI pitches before email dispatch.
  - `/dashboard/compliance`: AI Governance dashboard showing NYC Local Law 144 impact ratios and 4/5ths rule statistics.
  - `/dashboard/team`: Multi-tenant team invitations and RBAC management.
- **Candidate Portal (`/portal/*`):**
  - `/portal/profile`: Resume upload and Privacy Shield (employer domain blacklist).
  - `/portal/jobs`: 5-Dimension job matcher with ghost-job risk scoring.
  - `/portal/applications`: Kanban application tracker.
  - `/portal/interview-prep`: Mock STAR behavioral interview rehearsal coach.
- **Dynamic Candidate Microsites (`/m/[id]`):** Tailored landing pages dynamically served to candidates contacted during email sequences.

### 2.3 API Gateway & Control Plane (`backend/api/`)
- **Framework:** FastAPI async with Python 3.11+.
- **Middlewares:**
  - `SessionMiddleware`: Secure cryptographic session cookies.
  - `RateLimitMiddleware`: SlowAPI sliding-window rate limiter preventing denial of service.
  - `AuditLogMiddleware`: Records client IP, HTTP method, path, response status, and duration for SOC 2 / compliance audits.
  - `SecurityHeadersMiddleware`: Strips referrer headers and injects `no-store` cache controls on auth, invitation, and candidate PII endpoints.
  - `CORSMiddleware` & `GZipMiddleware`.
- **Authentication & Token Revocation:**
  - Stateless Bearer JWT tokens encoding `user_id`, `tenant_id`, and `role`.
  - Redis Token Blacklist: Calling `POST /api/v1/auth/logout` stores token JTIs in Redis with a TTL matching expiration. `get_current_user` verifies each token against the blacklist in real time.
- **Email Tracking:**
  - Open tracking: `GET /api/v1/track/{tracking_id}/open` returns a 1x1 transparent GIF and records `EmailSent.opened_at`.
  - Click tracking: `GET /api/v1/track/{tracking_id}/click` increments click count and redirects via 307 redirect.

### 2.4 Autonomous AI Swarm Engine (`backend/agents/`)
- **Framework:** Pydantic AI with typed schemas and dynamic multi-model routing.
- **Model Routing Strategy (`pydantic_config.py`):**
  - Priority 1: Decrypted Tenant BYOK keys (Anthropic Claude 3.5 Sonnet / OpenAI GPT-4o).
  - Priority 2: System Groq (`llama-3.3-70b-versatile`).
  - Priority 3: System OpenAI (`gpt-4o`).
  - Priority 4: System DeepSeek.
- **Agent Roster:**
  1. `market_iq_agent`: Analyzes market dynamics, salary benchmarks, and talent availability.
  2. `discovery_agent`: Ingests raw job requirements and models hard technical constraints.
  3. `sourcing_agent`: Scans candidate profiles across web nodes and internal databases.
     - **Self-Healing Fallback Protocol:** If fewer than 3 candidates are discovered, the orchestrator triggers `discovery_agent` with loosened constraints and re-runs sourcing automatically.
  4. `critic_agent`: Sanitizes candidate payloads (trims irrelevant PII to eliminate bias and hallucination) and validates qualification logic.
  5. `outreach_agent`: Generates personalized multi-channel email pitches with microsite tokens.
  6. `analytics_agent`: Generates post-run pipeline telemetry and efficiency reports.
  7. `screening_agent`: Conducts technical and behavioral candidate assessments.
- **Shared Memory (`backend/agents/swarm_memory.py`):**
  - Backed by Redis semantic caching with TTL, enabling horizontally-scalable multi-worker shared memory across containers (replacing legacy SQLite single-file memory).
- **LLM Guardrails (`backend/services/llm_guardrail_service.py`):**
  - Redis sliding-window token bucket regulates requests per minute (RPM) and tokens per minute (TPM).
  - Built-in circuit breaker trips into an `open` state upon consecutive provider failures, preventing API cascading timeouts.
- **Real-Time Telemetry & Multiplexed WebSockets (`backend/api/routes/websocket.py`):**
  - Agents publish events to Redis channel `dvt_signals:{tenant_id}`.
  - Dedicated background Pub/Sub listener relays signals to `Dict[str, Set[WebSocket]]`, allowing live streaming across multiple browser tabs concurrently.

### 2.5 Storage & Asynchronous Worker Layer (`backend/workers/` & `backend/services/`)
- **Celery & Redis Worker Architecture (`celery_app.py`, `tasks.py`):**
  - Backed by Redis broker (`redis:6379/1`) and result backend (`redis:6379/2`).
  - Tasks: `run_agent_task`, `run_full_autonomous_pipeline`, `source_candidates_for_job`, `send_campaign_emails`, `ats_sync.py`.
  - Periodic Celery Beat schedules:
    - Daily 07:00 UTC: Full autonomous recruitment scan.
    - Every 6 hours: Unified discovery refresh.
    - Every 2 hours: Swarm analytics recalculation.
    - Every 15 minutes: GDPR Right-to-Erasure reconciliation sweep.
- **Pluggable Storage Abstraction (`backend/services/storage_service.py`):**
  - `LocalStorageDriver`: Local disk storage with path traversal defense.
  - `S3StorageDriver`: AWS S3, MinIO, or Cloudflare R2 object storage with streaming uploads, MIME-type validation, and presigned URLs.

---

## 3. Database & Data Isolation Architecture

### 3.1 Dual-Database Topology
The platform maintains strict separation between testing/staging and production environments:

| Environment | Container | PostgreSQL Version | Port | Database Name | Volume / Storage |
|---|---|---|---|---|---|
| **Testing / Staging** | `dvt-postgres` | PostgreSQL 15 Alpine | `5432` (Host) | `dvt_staging` | Ephemeral test fixtures / seeded data |
| **Production** | `dvt_db` | PostgreSQL 16 Alpine | `5432` (Internal) | `dvt_talent` | `postgres_prod_data` (Persistent volume) |

### 3.2 Schema Composition & Migration Governance
- **Total Tables:** 26 relational tables.
- **Custom Postgres Enums:** 8 enums (`UserRole`, `LeadStatus`, `CandidateStatus`, `EmailStatus`, `InterviewStatus`, `AgentTaskStatus`, `InvitationStatus`, `CreditTransactionType`).
- **Migration Governance:** Managed strictly and exclusively via Alembic (`alembic upgrade head`). Destructive `Base.metadata.create_all` calls have been eliminated from application startup to avoid DDL locking and schema corruption.
- **Current Migration Stamp:** `007_team_invitations`.

### 3.3 Multi-Tenant Candidate Isolation
To allow multiple independent enterprise tenants to source the same candidate without collisions, the global `unique=True` constraint on `candidates.email` has been replaced with a partial PostgreSQL unique index:

```sql
CREATE UNIQUE INDEX uq_candidate_tenant_email 
ON candidates (tenant_id, email) 
WHERE tenant_id IS NOT NULL;
```

- **Recruiter Candidates:** Scoped by `(tenant_id, email)`. Tenant A and Tenant B can both maintain their own candidate records for `candidate@example.com` with isolated scores, notes, and pipelines.
- **B2C Candidate Profiles:** Direct candidate signups have `tenant_id = NULL` and link directly to `users.id`. Recruiters can only discover these profiles if `is_searchable = True` and the candidate has not blacklisted the recruiter's company via `hide_from_companies`.

---

## 4. Security, Privacy & AI Governance

1. **GDPR Article 17 Right to Erasure (`services/privacy_service.py`):**
   - Automated PII eradication: `DELETE /api/v1/candidates/{id}/pii` anonymizes all personal identifiers (name, email, phone, resumes, raw text, embeddings) while preserving non-identifiable statistical aggregates for audit ledgers.
2. **AI Transparency & Governance (`services/compliance_service.py`):**
   - Built to comply with NYC Local Law 144 and EU AI Act standards.
   - Computes candidate selection rates across demographic cohorts to verify compliance with the 4/5ths (80%) adverse impact rule.
   - Stores immutable audit records in the compliance ledger for every automated screening decision.
3. **At-Rest & In-Flight Encryption:**
   - Sensitive credentials (per-tenant SMTP passwords, BYOK API keys, ATS access tokens) are encrypted at rest using AES-256 Fernet via `services/security_service.py`.
   - In-flight communications are enforced over TLS via Caddy.
