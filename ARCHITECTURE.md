# DVT Talent AI — System Architecture Specification
**Version:** 2.1.0 (October 2026)  
**Status:** Production Ready  
**Audited & Remediated By:** Staff Platform Architect & Systems Engineering  

---

## 1. System Overview

DVT Talent AI is an autonomous, dual-sided AI talent recruitment and candidate career enablement platform. The architecture couples a **Next.js 15 App Router** frontend with a high-performance **FastAPI async backend**, coordinating a 7-agent **Pydantic AI swarm** for recruiters and the **Career-Ops AI Engine** for job seekers.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        EDGE INGRESS (Caddy Proxy)                      │
│        • Automatic TLS (Let's Encrypt) • HSTS & Security Headers       │
│        • Modern Compression (zstd/gzip) • Reverse Proxy & Upgrades     │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
                   ▼ (/*)                             ▼ (/api/*, /ws/*)
┌─────────────────────────────────────┐  ┌───────────────────────────────┐
│        NEXT.JS 15 WEB CLIENT        │  │     FASTAPI ASYNC API         │
├──────────────────┬──────────────────┤  ├───────────────────────────────┤
│ 💼 RECRUITER     │ 🎯 CANDIDATE     │  │ AUTH & IDENTITY:              │
│ DASHBOARD        │ PORTAL           │  │ • Role-Aware JWT & Blacklist  │
│ (/dashboard/*)   │ (/portal/*)      │  │ • Dual-Tenant Scoping         │
│ • Requisitions   │ • Job Board      │  │ • SAML SSO & Social OAuth     │
│ • AI Sourcing    │ • 5D Match Score │  ├───────────────────────────────┤
│ • HITL Copilot   │ • Ghost Job Scan │  │ CORE DOMAIN ROUTERS:          │
│ • Bias Audit     │ • ATS CV Tailor  │  │ • /agents & /copilot          │
│ • Team Invites   │ • STAR Rehearsal │  │ • /jobs & /candidates         │
│ • ATS Sync       │ • Privacy Shield │  │ • /candidate-portal           │
│ • Dynamic /m/*   │ • Applications   │  │ • /billing (Dodo MoR) & /email│
└──────────────────┴──────────────────┘  └───────┬──────────────┬────────┘
                                                 │              │
                    ┌────────────────────────────┘              └───────────┐
                    ▼                                                       ▼
┌──────────────────────────────────────┐                ┌───────────────────────────────────┐
│     AUTONOMOUS AI SWARM ENGINE       │                │      PERSISTENCE & DATA LAYER     │
│          (Pydantic AI)               │                ├───────────────────────────────────┤
│ • MarketIQ & Discovery Agents        │                │ PRIMARY PRODUCTION DB:            │
│ • Sourcing Agent (Self-Healing Loop) │                │ • PostgreSQL 16 (dvt_talent)      │
│ • Critic Agent (Anti-Bias Audit)     │                │ • Native pgvector (384-d Cosine)  │
│ • Outreach, Analytics, Screening     │                │ • 26 Tables, 8 Enums, Alembic     │
│ • Redis Semantic Swarm Memory        │                │ • Partial Unique Candidate Index  │
│ • LLM Guardrails (RPM/TPM + Breaker) │                │ • Composite Company Domain Index  │
└──────────────────┬───────────────────┘                ├───────────────────────────────────┤
                   │                                    │ STAGING & TEST DB:                │
                   ▼                                    │ • PostgreSQL 15 (pgvector:pg15)   │
┌──────────────────────────────────────┐                ├───────────────────────────────────┤
│   CELERY ASYNC WORKER & BEAT         │                │ IN-MEMORY & ASYNC QUEUE:          │
│ • Background AI Pipelines            │                │ • Redis 7 (Broker, Result Backend,│
│ • Scheduled Discovery & Daily Runs   │                │   Semantic Cache, Pub/Sub Signals)│
│ • ATS Sync (Ashby, Greenhouse, Lever)│                ├───────────────────────────────────┤
│ • Post-Restore Erasure Reconciliation│                │ OBJECT & RESUME STORAGE:          │
└──────────────────────────────────────┘                │ • StorageService (Local / AWS S3) │
                                                        └───────────────────────────────────┘
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
- **Framework:** Next.js 15.5 App Router with React 18/19, Tailwind CSS, Framer Motion, and shadcn/ui.
- **Recruiter Dashboard (`/dashboard/*`):**
  - `/dashboard/sourcing`: Real-time talent discovery interface with pgvector semantic similarity.
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
  - Priority 2: System Anthropic (`claude-3-5-sonnet-20241022`).
  - Priority 3: System Groq (`llama-3.3-70b-versatile`).
  - Priority 4: System OpenAI (`gpt-4o`).
  - Priority 5: Kimi (`moonshot-v1-32k`).
  - Priority 6: DeepSeek (`deepseek-chat`).
- **Vector Embeddings & Semantic Search (`backend/db/vector_store.py`):**
  - FastEmbed CPU ONNX embeddings (`BAAI/bge-small-en-v1.5`, 384 dimensions).
  - Native PostgreSQL `pgvector` (`VectorColumn(384)`) for candidate-job semantic similarity matching.
  - ChromaDB container has been completely removed.
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
  - Backed by Redis semantic caching with TTL, enabling horizontally-scalable multi-worker shared memory across containers.
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
    - Every 15 minutes: GDPR Right-to-Erasure reconciliation sweep (`reconcile_post_restore_erasures`).
- **Pluggable Storage Abstraction (`backend/services/storage_service.py`):**
  - `LocalStorageDriver`: Local disk storage with path traversal defense.
  - `S3StorageDriver`: AWS S3, MinIO, or Cloudflare R2 object storage with streaming uploads, MIME-type validation, and presigned URLs.

### 2.6 Monetization & Billing Architecture (`backend/services/billing_service.py`)
- **Merchant of Record (MoR) Integration:** Governed via **Dodo Payments** SDK (`dodopayments`). Dodo acts as Merchant of Record handling global tax remittance, VAT/GST compliance, and payment processing.
- **Hosted Checkout Sessions (`POST /api/v1/billing/checkout`):** Generates hosted checkout URLs with validated return paths to prevent open redirect vulnerabilities.
- **Self-Serve Customer Portal (`POST /api/v1/billing/portal`):** Provides authenticated portal sessions for invoice history, card updates, and subscription upgrades/cancellations.
- **Cryptographic Webhook Ingestion (`POST /api/v1/billing/webhook`):** Verifies inbound payloads against `DODO_PAYMENTS_WEBHOOK_KEY` via HMAC-SHA256 signature verification (`webhook-signature`), mapping payment successes and subscription events directly into tenant credit ledgers.

### 2.7 Recruiter Mailbox Delivery Architecture (`backend/services/email_service.py`)
- **Dual-Tier Sending Architecture:**
  - **Tier 1 (One-Click OAuth 2.0):** Recruiters link Google Workspace (Gmail API) or Microsoft 365 (Microsoft Graph API) via OAuth 2.0 (`/api/v1/email-sender/oauth/google`, `/microsoft`). OAuth refresh tokens are encrypted at rest with AES-256 Fernet in `Tenant.google_oauth_token_encrypted` and `Tenant.ms_oauth_token_encrypted`. Emails are dispatched directly through the recruiter's native corporate inbox for 99%+ deliverability.
  - **Tier 2 (Zero-Setup Relay Fallback):** Recruiters send via platform relay (`noreply@platform.domain`) with dynamic candidate `Reply-To: recruiter@agency.com`.
  - **Tier 3 (Custom SMTP):** Per-tenant custom SMTP host, port, TLS, and credentials with field-level encryption.

---

## 3. Database & Data Isolation Architecture

### 3.1 Dual-Database Topology
The platform maintains strict separation between testing/staging and production environments:

| Environment | Container | PostgreSQL Image | Port | Database Name | Volume / Storage |
|---|---|---|---|---|---|
| **Testing / Staging** | `dvt-postgres` | `pgvector/pgvector:pg15` | `5432` (Host) | `dvt_staging` | Ephemeral test fixtures / seeded data |
| **Production** | `dvt_db` | PostgreSQL 16 Alpine (`vector` ext) | `5432` (Internal) | `dvt_talent` | `postgres_prod_data` (Persistent volume) |

### 3.2 Schema Composition & Migration Governance
- **Total Tables:** 26 relational tables.
- **Custom Postgres Enums:** 8 enums (`UserRole`, `LeadStatus`, `CandidateStatus`, `EmailStatus`, `InterviewStatus`, `AgentTaskStatus`, `InvitationStatus`, `CreditTransactionType`).
- **Migration Governance:** Managed strictly via Alembic (`alembic upgrade head`). Destructive `Base.metadata.create_all` calls are eliminated from application startup.
- **Current Migration Stamp:** `0001_initial_schema`.

### 3.3 Multi-Tenant Candidate & Company Isolation
1. **Candidate Scoping:**
   ```sql
   CREATE UNIQUE INDEX uq_candidate_tenant_email 
   ON candidates (tenant_id, email) 
   WHERE tenant_id IS NOT NULL;
   ```
   - **Recruiter Candidates:** Scoped by `(tenant_id, email)`. Separate agencies can maintain independent records, scores, and pipelines for the same candidate email.
   - **B2C Candidate Profiles:** Direct candidate signups have `tenant_id = NULL` and link to `users.id`. Recruiters discover these profiles only if `is_searchable = True` and the candidate's `hide_from_companies` blacklist does not match the recruiter's tenant or client company.
2. **Company Domain Scoping:**
   ```sql
   CREATE UNIQUE INDEX uq_companies_tenant_domain 
   ON companies (tenant_id, domain);
   ```
   - Companies are scoped per workspace, enabling distinct agencies to target identical enterprise prospects without cross-tenant collision.
3. **Workspace RBAC Isolation:**
   - Team queries (`list_team_members`, `get_team_analytics`, `get_team_candidates`) are strictly filtered by `manager.tenant_id`.
   - GDPR-erased records (`pii_erased = True`) are automatically excluded from active queries.

---

## 4. Security, Privacy & AI Governance

1. **GDPR Article 17 Right to Erasure 4-Tier Atomic Purge Protocol:**
   - **Tier 1 (Primary Database):** Candidate records sanitized (`pii_erased = True`, names/emails/phones redacted).
   - **Tier 2 (File Storage):** Physical resume files (`uploads/resumes/`) permanently unlinked and deleted from disk or S3.
   - **Tier 3 (Vector Database):** FastEmbed ONNX embeddings in PostgreSQL `pgvector` deleted.
   - **Tier 4 (Cache & Queues):** Associated Redis cache keys and pending notification tasks invalidated.
   - **Resurrection Prevention:** `reconcile_post_restore_erasures()` runs post-restore to prevent resurrected PII from database snapshot syncs.
2. **AI Transparency & Governance (`services/compliance_service.py`):**
   - Compliant with NYC Local Law 144 and EU AI Act standards.
   - Computes candidate selection rates across demographic cohorts to verify compliance with the 4/5ths (80%) adverse impact rule.
   - Stores immutable audit records in `compliance_audits` for every automated screening decision.
3. **At-Rest & In-Flight Encryption:**
   - Sensitive credentials (OAuth tokens, SMTP passwords, BYOK API keys, ATS access tokens) are encrypted at rest using AES-256 Fernet via `services/security_service.py`.
   - In-flight communications are enforced over TLS via Caddy.
   - HMAC-SHA256 signature verification guards all inbound billing webhooks against spoofing.
