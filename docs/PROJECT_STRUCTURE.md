# DVT Talent AI — Repository & Project Structure Guide
**Version:** 2.0.0 (October 2026)  

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
├── docker-compose.yml          # Local multi-service development cluster
├── docker-compose.prod.yml     # Production hardened container stack
├── docker-compose.monitoring.yml # Prometheus, Grafana & Loki monitoring
├── backend/                    # FastAPI backend service & Pydantic AI agents
├── frontend/                   # Next.js 14 App Router web client (Recruiter + Candidate)
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
│   ├── versions/               # Sequential migration files
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
│       ├── billing.py          # Stripe checkout, webhooks, credit ledger
│       ├── campaigns.py        # Outreach sequence management
│       ├── candidates.py       # Recruiter candidate roster, scoring, resume intake
│       ├── compliance.py       # EEOC audit ledger and human override
│       ├── copilot.py          # Human-in-the-loop checkpoint actions
│       ├── email_sender.py     # Per-tenant SMTP settings & verification
│       ├── health.py           # Liveness & readiness probes
│       ├── integrations.py     # ATS connectors (Greenhouse, CEIPAL)
│       ├── jobs.py             # Requisitions & job description parsing
│       ├── team.py             # Team management & Bring-Your-Own-Key
│       ├── tenants.py          # Organization settings and branding
│       ├── users.py            # User management and profile settings
│       ├── webhooks.py         # Inbound webhook intake (email, ATS, Stripe)
│       └── websocket.py        # Real-time WebSocket activity broadcast
│
├── db/                         # Data layer
│   ├── models.py               # 24 SQLAlchemy models with dual-persona extensions
│   └── session.py              # Async engine with connection pooling
│
├── integrations/               # External service adapters
│   ├── greenhouse/             # Greenhouse Harvest API client
│   ├── ceipal/                 # CEIPAL Talent API client
│   └── unified_ats.py          # Unified ATS adapter abstraction
│
├── services/                   # Business domain services
│   ├── ats_sync.py             # Bi-directional ATS sync processor
│   ├── billing_service.py      # Credit deduction, Stripe integration
│   ├── compliance_service.py   # Adverse impact calculator & decision auditing
│   ├── email_service.py        # Secure SMTP mailer with TLS & retries
│   ├── notification_service.py # In-app notifications & alert dispatcher
│   ├── sanitizer_service.py    # GDPR PII masking & resume sanitization
│   └── security_service.py     # Fernet AES-256 field-level encryption
│
├── tests/                      # Automated test suite (47 passed, 6 skipped)
│   ├── agents/                 # Multi-agent coordination tests
│   ├── api/                    # Endpoint integration tests
│   ├── db/                     # Tenant isolation & ORM tests
│   └── test_*.py               # Functional, ATS, billing, and system tests
│
├── config.py                   # Pydantic Settings & environment validation
├── dvt_talent.db               # SQLite database for local development
├── main.py                     # FastAPI application startup & ASGI lifespan
└── requirements.txt            # Python dependencies
```

---

## 3. Frontend Layout (`frontend/`)

Built with Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, TanStack React Query, and Zustand.

```
frontend/
├── src/
│   ├── app/                    # Next.js 14 App Router pages
│   │   ├── page.tsx            # Dual-persona landing page (Recruiter CTA + Candidate CTA)
│   │   ├── layout.tsx          # Root HTML layout with providers
│   │   ├── globals.css         # Tailwind directives and theme variables
│   │   │
│   │   ├── auth/               # Authentication views
│   │   │   ├── login/page.tsx  # Segmented login (Recruiter vs Candidate)
│   │   │   └── register/page.tsx # Segmented registration with role assignment
│   │   │
│   │   ├── portal/             # Dedicated B2C Candidate Portal (Career-Ops)
│   │   │   ├── layout.tsx      # Candidate portal layout, top navigation & privacy badge
│   │   │   ├── page.tsx        # Career-Ops dashboard overview & quick stats
│   │   │   ├── jobs/page.tsx   # Verified job board with 5D fit score & ghost job flags
│   │   │   ├── applications/page.tsx # Application tracker & submission history
│   │   │   ├── interview-prep/page.tsx # STAR behavioral interview flashcards
│   │   │   └── profile/page.tsx # CV upload, skills editor & employer privacy shield
│   │   │
│   │   ├── dashboard/          # Authenticated B2B Recruiter Workspace
│   │   │   ├── approvals/      # Candidate review & approvals
│   │   │   ├── audit/          # Compliance & EEOC decision audit log
│   │   │   ├── billing/        # Live Stripe billing, credits, plans
│   │   │   ├── candidates/     # Candidate roster & talent profiles
│   │   │   ├── compliance/     # Governance policy packs & 4/5ths rule
│   │   │   ├── copilot/[taskId]# Step-by-step human-in-the-loop wizard
│   │   │   ├── jobs/           # Open requisitions & JD editor
│   │   │   ├── leads/          # [Redirects to /dashboard/candidates]
│   │   │   ├── discovery/      # [Redirects to /dashboard/jobs]
│   │   │   ├── monitoring/     # Swarm telemetry & agent activity log
│   │   │   ├── outreach/       # Multi-channel campaign sequences
│   │   │   ├── pipeline/       # Visual recruiting Kanban stage view
│   │   │   ├── settings/       # Workspace settings & team config
│   │   │   ├── sourcing/       # Global talent search & candidate filter
│   │   │   ├── swarm/          # Live 5-agent coordination & command center
│   │   │   └── team/           # Team members, permissions, and BYOK keys
│   │   │
│   │   └── m/[id]/             # Public candidate microsite landing page
│   │
│   ├── components/             # Reusable UI components
│   │   ├── candidates/         # Candidate profile widgets & intelligence signals
│   │   ├── copilot/            # Human-in-the-loop review components
│   │   ├── dashboard/          # Metric cards and briefing components
│   │   ├── layout/             # Sidebar, topbar, mobile drawer, layout shells
│   │   ├── shared/             # Generic Modals, ConfirmDialog, TableEmptyState
│   │   └── ui/                 # Atomic design primitives (Button, Card, Input, Badge)
│   │
│   ├── lib/
│   │   ├── api.ts              # Central API client facade
│   │   └── utils.ts            # Formatting helpers
│   │
│   └── providers/              # React Context Providers
│       ├── index.tsx           # Combined provider tree
│       ├── theme-provider.tsx  # Light/dark mode provider
│       └── websocket-provider.tsx # Live agent WebSocket state
│
├── next.config.js              # Next.js production settings
├── package.json                # Frontend dependencies
├── tailwind.config.js          # Tailwind styling tokens
└── tsconfig.json               # TypeScript compiler options
```

---

## 4. Key Architectural Conventions

- **Candidate vs Recruiter Routes**:
  - Candidate-facing pages live exclusively under `/portal/*`.
  - Recruiter-facing pages live under `/dashboard/*`.
- **API URL Prefixes**:
  - Candidate Portal endpoints are grouped under `/api/v1/candidate-portal/*`.
  - Recruiter endpoints are grouped under `/api/v1/jobs/*`, `/api/v1/candidates/*`, `/api/v1/agents/*`, `/api/v1/copilot/*`.
- **Clean Redirects**:
  - Deprecated sales features (`/dashboard/leads` and `/dashboard/discovery`) redirect automatically without broken links.
