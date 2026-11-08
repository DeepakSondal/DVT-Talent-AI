# DVT Talent AI — Repository & Project Structure Guide
**Version:** 2.1.0 (October 2026)  

---

## 1. High-Level Repository Layout

```
dvt-talent-ai/
├── ARCHITECTURE.md             # System architecture & module responsibilities
├── ARCHITECTURE_AUDIT.md       # Engineering audit and remediation history
├── CHANGELOG.md                # System-wide version history and pivot notes
├── README.md                   # Project overview & quick start guide
├── SECURITY.md                 # Security, encryption & vulnerability disclosure
├── Caddyfile                   # Production reverse proxy and automated TLS config
├── docker-compose.yml          # Local multi-service development cluster (pgvector + Redis)
├── docker-compose.prod.yml     # Production hardened container stack
├── docker-compose.monitoring.yml # Prometheus, Grafana & Loki monitoring
├── backend/                    # FastAPI backend service & Pydantic AI agents
├── frontend/                   # Next.js 15 App Router web client (Recruiter + Candidate)
└── docs/                       # Technical specifications, API reference & user guides
```

---

## 2. Backend Layout (`backend/`)

Built with FastAPI, Pydantic AI 1.94, Async SQLAlchemy 2.0, Celery, and Redis.

```
backend/
├── agents/                     # Autonomous AI agents and orchestrator
│   ├── tools/                  # Reusable agent tools
│   │   ├── browser_tools.py    # Playwright browser agent integration
│   │   ├── job_tools.py        # Requisition parsing & skill taxonomies
│   │   ├── memory_tools.py     # Tenant memory & preference store
│   │   └── resume_tools.py     # Resume parsing & qualification scoring
│   ├── orchestrator.py         # Multi-agent coordinator with LLM failover
│   ├── pydantic_config.py      # LLM provider configurations & dynamic fallback
│   ├── jd_agent.py             # Requisition parsing & bias optimization
│   ├── candidate_sourcing.py   # Global talent hunting & candidate extraction
│   ├── screening_agent.py      # Technical candidate screening & rubrics
│   ├── critic_agent.py         # EEOC compliance, bias & fairness auditing
│   ├── outreach_agent.py       # Personalized sequence drafting
│   └── swarm_memory.py         # Redis shared agent state
│
├── alembic/                    # Database schema versioning & migration scripts
│   ├── versions/               # Sequential migration files (Head: 007_team_invitations)
│   └── env.py                  # Async Alembic execution environment
│
├── api/                        # HTTP interface layer
│   ├── middleware/             # Rate limiting, tenant scoping, Sentry tracing
│   └── routes/                 # Domain REST controllers (/api/v1/*)
│       ├── candidate_portal.py # Career-Ops suite: profile, resume, jobs, 5D match, STAR prep
│       ├── agents.py           # Swarm execution, tasks, and telemetry
│       ├── analytics.py        # Funnel conversion metrics & placement KPIs
│       ├── auth.py             # Dual-persona registration (recruiter/candidate), login, JWT
│       ├── auth_social.py      # Google / GitHub OAuth social logins
│       ├── auth_sso.py         # SAML 2.0 Enterprise Single Sign-On (Okta / Azure AD)
│       ├── billing.py          # Dodo Payments checkout, portal, webhook handling, credit ledger
│       ├── campaigns.py        # Outreach sequence management
│       ├── candidates.py       # Recruiter candidate roster, scoring, resume intake
│       ├── compliance.py       # EEOC audit ledger, AI Decision Ledger and human override
│       ├── copilot.py          # Human-in-the-loop checkpoint actions
│       ├── email_sender.py     # Dual-Tier mailer (Google/MS OAuth 2.0, Relay fallback, custom SMTP)
│       ├── health.py           # Liveness & readiness probes
│       ├── integrations.py     # ATS connectors (Greenhouse, CEIPAL, Ashby, Lever)
│       ├── jobs.py             # Requisitions & job description parsing
│       ├── team.py             # Team management, RBAC & Bring-Your-Own-Key
│       ├── tenants.py          # Organization settings and branding
│       ├── users.py            # User management and profile settings
│       ├── webhooks.py         # Inbound webhook intake (Dodo Payments, ATS, Monster)
│       └── websocket.py        # Real-time WebSocket activity broadcast (multiplexed)
│
├── db/                         # Data layer
│   ├── models.py               # 26 SQLAlchemy models with dual-persona extensions
│   ├── session.py              # Async engine with connection pooling
│   └── vector_store.py         # FastEmbed ONNX + PostgreSQL pgvector adapter (384-dim)
│
├── integrations/               # External service adapters
│   ├── greenhouse/             # Greenhouse Harvest API client
│   ├── ceipal/                 # CEIPAL Talent API client
│   └── unified_ats.py          # Unified ATS adapter abstraction
│
├── services/                   # Business domain services
│   ├── ats_sync.py             # Bi-directional ATS sync processor
│   ├── billing_service.py      # Dodo Payments SDK client, credit deduction, plan sync
│   ├── compliance_service.py   # Adverse impact calculator & decision auditing
│   ├── email_service.py        # Dual-tier OAuth & SMTP mailer with TLS & retries
│   ├── notification_service.py # In-app notifications & alert dispatcher
│   ├── oauth_service.py        # Google Workspace & Microsoft 365 OAuth 2.0 token management
│   ├── privacy_service.py      # GDPR Article 17 4-tier erasure protocol
│   ├── sanitizer_service.py    # GDPR PII masking & resume sanitization
│   └── security_service.py     # Fernet AES-256 field-level encryption
│
├── tests/                      # Automated test suite (213 passed, 3 skipped)
│   ├── agents/                 # Multi-agent coordination tests
│   ├── api/                    # Endpoint integration tests
│   ├── db/                     # Tenant isolation & ORM tests
│   └── test_*.py               # Functional, ATS, Dodo billing, OAuth mailer, and system tests
│
└── config.py                   # Pydantic Settings & environment validation
```

---

## 3. Frontend Layout (`frontend/`)

Built with Next.js 15.5 App Router, React 18/19, TypeScript, Tailwind CSS, TanStack React Query, and Zustand.

```
frontend/
├── app/                        # Next.js 15 App Router pages & API routes
│   ├── (auth)/                 # Public auth routes (login, register, forgot-password)
│   ├── (candidate)/            # Candidate Portal routes (/portal/*)
│   │   ├── portal/             # Overview, 5D job matches, applications, STAR prep
│   │   └── profile/            # Resume upload & Privacy Shield blacklist
│   ├── (recruiter)/            # B2B Recruiter Command Center (/dashboard/*)
│   │   ├── dashboard/          # Pipeline metrics, requisitions, candidate roster
│   │   ├── sourcing/           # Real-time swarm talent discovery
│   │   ├── approvals/          # HITL Copilot decision gates
│   │   ├── compliance/         # AI Decision Ledger & NYC Local Law 144 audits
│   │   ├── billing/            # Dodo Payments pricing, checkout, customer portal
│   │   └── team/               # Team member invites & BYOK key configuration
│   ├── m/                      # Personalized candidate outreach microsites (/m/[id])
│   └── layout.tsx              # Root HTML shell & ThemeProvider
│
├── components/                 # Reusable UI component library
│   ├── candidate/              # 5D match cards, ghost job warning badges, STAR flashcards
│   ├── copilot/                # HITL approval cards, prompt inspector, confidence bars
│   ├── dashboard/              # Funnel charts, metric cards, requisition tables
│   ├── ui/                     # Radix UI + shadcn/ui accessible primitives
│   └── shared/                 # Navigation bars, user dropdowns, error boundaries
│
├── hooks/                      # Custom React hooks
│   ├── use-agents.ts           # Swarm execution lifecycle & task tracking
│   ├── use-auth.ts             # JWT token decode, role gating, session refresh
│   └── use-websocket.ts        # Multiplexed real-time WebSocket connection
│
├── lib/                        # Client-side utility functions
│   ├── api.ts                  # Axios client with JWT injection & error handling
│   └── utils.ts                # Tailwind class merging (clsx + twMerge)
│
└── tests/                      # Frontend unit & Playwright E2E suites
```

---

## 4. Documentation Directory (`docs/`)

```
docs/
├── ARCHITECTURE.md             # In-depth technical architecture & swarm topology
├── DATABASE.md                 # PostgreSQL 16 prod vs 15 staging, pgvector, schemas, Alembic
├── AI_AGENTS.md                # 7-agent recruitment swarm, self-healing loop, Career-Ops
├── DODO_PAYMENTS.md            # Merchant of Record setup, checkout sessions, webhooks
├── DEPLOYMENT.md               # Docker Compose stacks, Caddy reverse proxy, VPS guidelines
├── PROJECT_STRUCTURE.md        # Repository layout, directory conventions (this file)
├── API.md                      # Complete REST endpoint specifications & schemas
├── API_QUICKSTART.md           # Curl commands for rapid API testing
├── TESTING.md                  # Pytest verification (213 passed) and frontend QA
├── USER_GUIDE.md               # User manuals for Recruiters and Job Seekers
├── SETUP.md                    # Step-by-step local & server installation guide
├── STRIPE_SETUP.md             # Legacy deprecation notice pointing to DODO_PAYMENTS.md
├── DISASTER_RECOVERY.md        # SOP for backup restoration and GDPR erasure reconciliation
└── OBSERVABILITY.md            # Prometheus, Grafana, Loki monitoring setup
```
