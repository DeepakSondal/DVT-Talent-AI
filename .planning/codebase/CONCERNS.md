---
last_mapped_commit: ee9d6a24a777ec960b14cb11bf7c76de171b3e23
last_mapped_at: 2026-10-18
---
# Codebase Concerns

**Analysis Date:** 2026-10-18

## Tech Debt

**Recursive Symlink Hack (`backend/backend` -> `.`):**
- Issue: Inconsistent import styles (`from backend.xxx import ...` vs `from xxx import ...`) required creating a symlink `backend/backend` pointing to `.` and running `sh -c "ln -sfn . /app/backend && ..."` in Docker.
- Files: `backend/backend`, `backend/Dockerfile:29`, `docker-compose.yml:60`.
- Impact: In Python, importing a module under two names (`config` vs `backend.config`) creates two entries in `sys.modules`, which risks broken SQLAlchemy model registries and singleton divergence.
- Fix approach: Standardize all internal imports to package imports (`backend.xxx`) or top-level imports consistently, set `PYTHONPATH` in environments, and delete the recursive symlink.

**Monolithic Frontend Components:**
- Issue: Components such as `frontend/src/components/copilot/CopilotActionModal.tsx` (757 lines) and `frontend/src/app/dashboard/settings/page.tsx` (765 lines) inline massive amounts of UI, state, and API logic.
- Files: `frontend/src/components/copilot/CopilotActionModal.tsx`, `frontend/src/app/dashboard/settings/page.tsx`.
- Impact: High re-render overhead, difficult maintenance, and poor reusability.
- Fix approach: Decompose into focused subcomponents with explicit TypeScript props.

**Monolithic Frontend API Client:**
- Issue: `frontend/src/lib/api.ts` (374 lines) acts as a monolithic catch-all for Axios client configuration, interceptors, TypeScript interfaces, and 12 different domain API calls.
- Files: `frontend/src/lib/api.ts`.
- Impact: Violates single-responsibility principle; tight coupling between data fetching and types.
- Fix approach: Split domain operations into modular services in `frontend/src/services/` and interfaces in `frontend/src/types/`.

## Known Bugs

**Circular Foreign Key Warning in Database Models:**
- Symptoms: Emits SQLAlchemy warning: `SAWarning: Can't sort tables for DROP; an unresolvable foreign key dependency exists between tables: teams, users`.
- Files: `backend/db/models.py:169` (`Team.manager_id -> users.id`) and `backend/db/models.py:190` (`User.team_id -> teams.id`).
- Trigger: Database teardown or metadata reflection.
- Fix approach: Add `use_alter=True, name="fk_teams_manager_id"` to the `Team.manager_id` foreign key definition.

## Security Considerations

**Default Secret Key in Development:**
- Risk: `backend/config.py` sets `secret_key = "change-me-in-production"`.
- Files: `backend/config.py:27`, `backend/config.py:190`.
- Current mitigation: `validate_required_settings()` raises a `ValueError` on startup if `app_env == "production"` and the default secret key is present.
- Recommendations: Ensure automated production deploy pipelines generate high-entropy random keys.

**Candidate Domain Blacklist Enforcement:**
- Risk: Recruiters might accidentally discover candidates who have blacklisted their current employer domain.
- Files: `backend/agents/candidate_sourcing.py`, `backend/api/routes/candidate_portal.py`.
- Current mitigation: Privacy filters inspect `hide_from_companies` domain blacklist and `is_searchable == False`.
- Recommendations: Add automated regression tests validating that email domain matches strictly exclude candidate records from all search results.

## Performance Bottlenecks

**Cold LLM Inference Latency in Swarm Execution:**
- Problem: Multi-step Pydantic AI agent pipelines (JD parsing -> Sourcing -> Screening -> Critic -> Outreach) can take 20–60 seconds if executed synchronously.
- Files: `backend/agents/orchestrator.py`, `backend/api/routes/agents.py`.
- Cause: Sequential remote LLM API roundtrips across multiple agents.
- Improvement path: Offload swarm runs to background Celery workers and broadcast real-time progress via WebSocket (`/api/v1/ws/pipeline-events`).

## Fragile Areas

**Multi-Provider LLM Failover Configuration:**
- Files: `backend/config.py`, `backend/agents/pydantic_config.py`.
- Why fragile: If external providers (Groq, Anthropic, Moonshot, OpenAI) change API formats, deprecate models, or trigger rate limits, agent pipelines fail unless fallbacks are continuously tested.
- Safe modification: Rely on `backend/tests/pydantic_pulse_test.py` before modifying LLM configurations.

**Pydantic AI Version Pinning:**
- Files: `backend/requirements.txt:15` (`pydantic-ai==1.94.0`).
- Why fragile: Pydantic AI is undergoing active early-stage development with frequent breaking changes across minor releases.
- Safe modification: Keep exact version pinned until migration tests pass.

## Scaling Limits

**Local SQLite Database:**
- Current capacity: Suitable for local development and single-developer testing (`backend/dvt_talent.db`).
- Limit: File-locking contention occurs under concurrent writes from multiple worker processes.
- Scaling path: Must use PostgreSQL 15+ (`DATABASE_URL=postgresql+asyncpg://...`) in staging and production.

## Dependencies at Risk

**Pinned Auth Libraries:**
- `python-jose[cryptography]==3.3.0` and `passlib[bcrypt]==1.7.4` are pinned to specific versions to prevent bcrypt 4.x compatibility issues.
- Migration plan: Consider migrating to PyJWT and native `hashlib`/`argon2-cffi` in a future infrastructure phase.

## Missing Critical Features

**Self-Service Enterprise SSO Setup:**
- Problem: SAML 2.0 endpoint exists (`backend/api/routes/auth_sso.py`), but tenant self-service metadata upload UI in recruiter settings is not yet implemented.
- Blocks: Self-service onboarding for enterprise IT administrators without engineering intervention.

## Test Coverage Gaps

**Skipped Integration Tests:**
- What's not tested: Live Stripe checkout webhooks, live Greenhouse Harvest API token exchanges, and live SendGrid SMTP delivery (6 tests skipped in current suite).
- Files: `backend/tests/test_billing.py`, `backend/tests/test_ats_integrations.py`.
- Risk: Third-party API changes could cause runtime errors that are not detected during local CI unit test runs.

---

*Concerns analysis: 2026-10-18*
