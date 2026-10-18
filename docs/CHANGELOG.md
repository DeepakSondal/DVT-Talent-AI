# DVT Talent AI — Changelog

All notable changes and architectural refactorings are documented in this file.

---

## [2.0.0] — 2026-10-18
### Major Product Pivot: Dual-Sided AI Recruitment & Candidate Platform (Career-Ops Integration)
**Architected & Refactored by:** Principal Product Architect, Senior Full-Stack Engineer, Application Security Engineer

#### 🚀 Dual-Persona Platform Model
- **Recruiter & Agency SaaS Workspace (B2B)**: Dedicated workspace for requisition management, 5-agent autonomous candidate sourcing swarms, explainable fit scoring, human-in-the-loop Copilot checkpoints, and enterprise ATS/SAML SSO integrations.
- **Candidate Portal & Career-Ops Suite (B2C Free Core)**: Integrated the Career-Ops suite into `/portal`, enabling active job seekers to browse verified jobs, inspect 5-dimension fit scores, detect ghost jobs, tailor resumes without fabrication, practice with STAR interview coaching flashcards, and protect privacy with an employer domain blacklist.

#### 🛠️ Backend & API
- **New Candidate Portal Router (`/api/v1/candidate-portal/*`)**:
  - `GET/PUT /profile`: Candidate profile, skills, and privacy settings (`is_searchable`, `hide_from_companies`).
  - `POST /resume`: Ingest and parse candidate CVs (PDF, DOCX, text).
  - `GET /jobs`: Browse published requisitions with 5D match scores and ghost-job flags.
  - `POST /jobs/{id}/apply`: Apply with persisted 5-dimension fit score records.
  - `GET /applications`: Real-time application tracker.
  - `GET /interview-prep/{id}`: Synthesizes job-specific STAR behavioral interview flashcards.
  - `POST /tailor-resume/{id}`: Zero-fabrication ATS keyword and formatting recommendations.
- **Dual-Persona Auth**: Extended `/api/v1/auth/register` to accept `role` (`"recruiter"` | `"candidate"`). Automatically provisions `Candidate` records linked via `Candidate.user_id = user.id`. Nullable `tenant_id` for independent job seekers.
- **Relational Schema Extensions (`backend/db/models.py`)**:
  - `users.tenant_id`: Set `nullable=True` for independent candidate accounts.
  - `candidates`: Added `user_id`, `is_searchable` (Boolean), `hide_from_companies` (JSON domain blacklist).
  - `jobs`: Added `is_published` (Boolean).
  - `job_candidates`: Added `applied_by_candidate` (Boolean) and `career_ops_scoring` (JSON).
- **Cleaned Legacy Features**:
  - Removed `MarketPulseScheduler` background loop from `main.py` lifespan (zero background scraping overhead).
  - Unmounted legacy `plg.router`.
  - Maintained unmounted status for legacy Voice AI calling.

#### 💻 Frontend (Next.js 14 App Router)
- **Segmented Landing Page (`/`)**: Added dual hero CTAs and dedicated `#candidate-features` showcase.
- **Segmented Auth (`/auth/login` & `/auth/register`)**: Added interactive toggle between Recruiter and Candidate sign-in modes.
- **Dedicated Candidate Portal (`/portal/*`)**:
  - Created portal layout with role indicators and privacy badge.
  - Created `/portal` (overview dashboard), `/portal/jobs` (verified jobs with 5D scores), `/portal/applications` (tracker), `/portal/interview-prep` (STAR flashcards), and `/portal/profile` (CV upload & privacy shield).
- **Graceful Redirects**: Converted deprecated `/dashboard/leads` and `/dashboard/discovery` routes into seamless redirects to `/dashboard/candidates` and `/dashboard/jobs`.
- **Focused Swarm UI (`/dashboard/swarm`)**: Removed MarketIQ tabs; focused UI on the 5 core talent acquisition agents.

#### 🧪 Verification & Test Results
- **Backend Pytest**: **47 passed, 6 skipped, 0 failed** in 66.59s.
- **E2E Audit**: **26/26 scenarios passed**.
- **Frontend Type Check**: **0 errors** (`npm run type-check`).
- **Production Build**: **35 routes compiled** successfully.

---

## [1.2.0] — 2026-10-14
### Enterprise Architecture Hardening, Modularity & Quality Assurance Pass
- Resolved cyclic foreign key warning between `teams.manager_id` and `users.team_id`.
- Connection pool de-duplication in `backend/config.py`.
- Decomposed monolithic Copilot into modular subcomponents (`PhaseStepper.tsx`, `MarketIQPanel.tsx`, `JDEditor.tsx`, `CandidateCard.tsx`, `ScoreRing.tsx`, `OutreachResults.tsx`).
- Standardized `Badge.tsx` and created `services/billing.service.ts`.

---

## [1.1.0] — 2026-04-29
### Pydantic AI & Native Swarm Orchestration
- Migrated 7-agent swarm to Pydantic AI framework.
- Transitioned swarm execution to native FastAPI background tasks.
- Resolved candidate table unique constraints.

---

## [1.0.0] — 2026-04-10
### Initial Release: Autonomous Recruitment Swarm
- Multi-agent async DAG orchestrator with Redis shared memory.
- Real-time WebSocket activity monitoring.
- PostgreSQL Row-Level Security (RLS) multi-tenancy.
