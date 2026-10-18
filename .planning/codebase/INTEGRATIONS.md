---
last_mapped_commit: f2fad2b1e423077443f26c93600f11df821b3e3f
last_mapped_at: 2026-10-18
---
# External Integrations

**Analysis Date:** 2026-10-18

## APIs & External Services

**Large Language Models (LLM Providers):**
- Anthropic Claude (Primary for Complex Reasoning)
  - Model: `claude-3-5-sonnet-latest`
  - Auth: `ANTHROPIC_API_KEY`
  - Implementation: `backend/config.py`, `backend/agents/pydantic_config.py`
- Groq (High Speed Inference)
  - Models: `openai/gpt-oss-20b`, `llama-3.3-70b-versatile`
  - Base URL: `https://api.groq.com/openai/v1`
  - Auth: `GROQ_API_KEY`
- OpenAI (Fallback & General Tasks)
  - Models: `gpt-4-turbo-preview`, `gpt-4o`
  - Auth: `OPENAI_API_KEY`
- Kimi / Moonshot AI & DeepSeek (Secondary Reasoning)
  - Models: `moonshot-v1-128k`, `deepseek-chat`
  - Auth: `KIMI_API_KEY`, `DEEPSEEK_API_KEY`

**Talent Discovery & Sourcing Search:**
- Serper.dev / Google Search API
  - Purpose: Real-time candidate resume and profile discovery across GitHub and LinkedIn
  - Auth: `SERPER_API_KEY`
  - Implementation: `backend/agents/tools/search_tools.py`
- Apify Web Scraper API
  - Purpose: Headless social network and job board data extraction
  - Auth: `APIFY_API_KEY`
  - Implementation: `backend/agents/tools/search_tools.py`

**Applicant Tracking Systems (ATS):**
- Greenhouse Software
  - Purpose: Two-way sync of job openings and candidate profile applications
  - Client: `backend/integrations/greenhouse/harvest_client.py`
  - Auth: `GREENHOUSE_API_KEY`
- CEIPAL Talent ATS
  - Purpose: Enterprise recruitment workflow integration
  - Client: `backend/integrations/ceipal/ceipal_client.py`
  - Auth: `CEIPAL_API_KEY`, `CEIPAL_API_BASE_URL`
- Unified ATS Adapter:
  - Implementation: `backend/integrations/unified_ats.py`

**Job Hub Integrations:**
- ZipRecruiter & Dice APIs
  - Auth: `ZIPRECRUITER_API_KEY`, `DICE_API_KEY`
  - Implementation: `backend/config.py`, `backend/integrations/`

## Data Storage

**Relational Database:**
- PostgreSQL 15+ (Production) / SQLite (`backend/dvt_talent.db` for local dev)
  - Connection: `DATABASE_URL` (`postgresql+asyncpg://...` or `sqlite+aiosqlite:///...`)
  - Client: SQLAlchemy 2.0 Async Engine with connection pooling (`backend/db/session.py`, `backend/db/models.py`)
  - Migrations: Alembic (`backend/alembic/`)

**Vector Storage:**
- ChromaDB (Local/Docker) & Pinecone (Production Vector Cloud)
  - Collections: `dvt_resumes`, `dvt_jobs`, `dvt_companies`
  - Connections: `CHROMA_HOST`, `CHROMA_PORT`, `PINECONE_API_KEY`, `PINECONE_HOST`
  - Client: `backend/db/vector_store.py`

**Caching & Message Broker:**
- Redis 7+
  - Connections: `REDIS_URL` (cache/rate limiting), `CELERY_BROKER_URL` (db 1), `CELERY_RESULT_BACKEND` (db 2)
  - Client: `redis.asyncio` and `celery` (`backend/workers/celery_app.py`, `backend/agents/swarm_memory.py`)

## Authentication & Identity

**JWT Bearer Auth (Native Dual-Persona):**
- Custom dual-role authentication for B2B Recruiters and B2C Candidates
- Implementation: `backend/api/routes/auth.py`, `backend/api/middleware/tenant.py`
- Encryption: `SECRET_KEY`, `ALGORITHM` (HS256)

**Social Authentication (OAuth 2.0):**
- Google OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (`backend/api/routes/auth_social.py`)
- GitHub OAuth: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- LinkedIn OAuth: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

**Enterprise Single Sign-On (SAML 2.0):**
- Okta / Azure Active Directory integration
- Configuration: `SAML_IDP_ENTITY_ID`, `SAML_IDP_SSO_URL`, `SAML_IDP_CERT`
- Implementation: `backend/api/routes/auth_sso.py` using `python3-saml`

## Billing & Payments

**Stripe:**
- Purpose: SaaS tier subscriptions (Starter, Pro, Enterprise) and pay-per-credit allocation
- Auth: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Implementation: `backend/api/routes/billing.py`, `backend/services/billing_service.py`

## Email & Communication

**Transactional & Outreach SMTP:**
- Purpose: Recruiter multi-touch email sequences and candidate application notifications
- Credentials: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` (supports per-tenant custom SMTP)
- Implementation: `backend/services/email_service.py`, `backend/api/routes/email_sender.py`
- Open & Click Tracking: 1x1 GIF tracking pixel (`backend/main.py:137`)

## Monitoring & Observability

**Error Tracking & Performance:**
- Sentry SDK for Python & FastAPI
  - Auth: `SENTRY_DSN`
  - Implementation: `backend/main.py:20`

**Metrics & Telemetry:**
- Prometheus Client ASGI endpoint at `/metrics` (`backend/main.py:164`)
- Logfire / Structlog structured JSON logger (`backend/main.py:53`)

## Webhooks & Callbacks

**Incoming:**
- `/api/v1/billing/webhook` — Stripe subscription and payment intent events
- `/api/v1/webhooks/email/reply` — Inbound email replies and sentiment scoring
- `/api/v1/webhooks/ats/sync` — Inbound webhook updates from Greenhouse and CEIPAL

**Outgoing:**
- WebSocket broadcast: `/api/v1/ws/pipeline-events` for live agent swarm progress telemetry

---

*Integration audit: 2026-10-18*
