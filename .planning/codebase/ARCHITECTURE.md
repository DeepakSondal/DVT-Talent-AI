---
last_mapped_commit: 91fa041
last_mapped_at: 2026-10-24
---
<!-- refreshed: 2026-10-24 -->

# Architecture

**Analysis Date:** 2026-10-24

## System Overview

```text
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

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Edge Proxy | Automatic TLS, compression, security headers, reverse proxy | `Caddyfile` |
| API Entry & Middleware | Mounts routes, CORS, session, audit logging, rate limiting, and Sentry | `backend/main.py` |
| Settings & Config | Centralized typed configuration with multi-LLM failover detection | `backend/config.py` |
| Swarm Orchestrator | Coordinates 7-agent PydanticAI pipeline with self-healing fallback loops | `backend/agents/orchestrator.py` |
| Candidate Portal Route | 5D match scoring, ghost job detection, resume upload, and STAR prep | `backend/api/routes/candidate_portal.py` |
| Database Models | 26 SQLAlchemy models supporting dual-persona tenancy, enums, and partial unique index | `backend/db/models.py` |
| Storage Service | Pluggable local and AWS S3/MinIO/Cloudflare R2 object storage drivers | `backend/services/storage_service.py` |
| LLM Guardrails | Redis token-bucket RPM/TPM limiter and circuit breaker | `backend/services/llm_guardrail_service.py` |
| Swarm Memory | Distributed Redis semantic cache for agent memory and findings | `backend/agents/swarm_memory.py` |
| Celery Task Worker | Asynchronous background processing for long-running agent tasks | `backend/workers/tasks.py` |
| Frontend Web Client | Dual-persona UI: Recruiter Dashboard and Candidate Career-Ops Portal | `frontend/src/app/` |

## Key Patterns & Architectural Remediations

1. **Dual-Database Segregation:**
   - Testing/Staging: PostgreSQL 15 (`dvt-postgres`, `dvt_staging`, host port 5432).
   - Production: PostgreSQL 16 (`dvt_db`, `dvt_talent`, internal port 5432, volume `postgres_prod_data`).
2. **Multi-Tenant Candidate Isolation:**
   - Candidate uniqueness is governed by `uq_candidate_tenant_email` (`ON candidates (tenant_id, email) WHERE tenant_id IS NOT NULL`), allowing multiple tenants to source the same candidate email without collisions.
3. **Startup Race Elimination:**
   - Destructive `create_all` calls removed from startup; schema lifecycle is managed exclusively by Alembic migrations (`007_team_invitations`).
4. **WebSocket Multiplexing:**
   - Multi-tab support via `Dict[str, Set[WebSocket]]` in `backend/api/routes/websocket.py` with an auto-reconnecting Redis Pub/Sub listener.
5. **Token Revocation & Logout:**
   - `POST /api/v1/auth/logout` blacklists JWT tokens in Redis; token blacklist check in `get_current_user`.
