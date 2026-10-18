---
last_mapped_commit: f2fad2b1e423077443f26c93600f11df821b3e3f
last_mapped_at: 2026-10-18
---
# Testing Patterns

**Analysis Date:** 2026-10-18

## Test Framework

**Backend Runner:**
- Pytest 8.1.1 with `pytest-asyncio` 0.23.6
- Configuration: `backend/pytest.ini` (`asyncio_mode = auto`, `pythonpath = . ..`, `testpaths = tests`)

**Frontend Runner:**
- Playwright 1.44.0 (`frontend/playwright.config.ts`)

**Run Commands:**

```powershell

# Backend: Run complete test suite

cd backend
venv\Scripts\python.exe -m pytest -v

# Backend: Run fast unit tests (excluding external network dependencies)

venv\Scripts\python.exe -m pytest -v -m "not integration"

# Backend: Run candidate portal test suite

venv\Scripts\python.exe -m pytest -v tests/api/test_candidate_portal.py

# Backend: Run swarm logic tests

venv\Scripts\python.exe -m pytest -v tests/agents/test_swarm_logic.py

# Frontend: Type checking & linting

cd frontend
npm run type-check
npm run lint

# Frontend: Playwright E2E tests

npx playwright test
```

## Test File Organization

**Location:**
- Backend tests live in `backend/tests/` structured by subsystem:
  - `backend/tests/api/`: REST endpoint integration tests (`test_candidate_portal.py`, `test_swarm_endpoints.py`)
  - `backend/tests/agents/`: Multi-agent orchestration and tool tests (`test_swarm_logic.py`)
  - `backend/tests/db/`: Database models and multi-tenant isolation tests (`test_isolation.py`)
  - `backend/tests/communication/`: Redis pub/sub and state fabric tests (`test_fabric.py`)
  - Root test files in `backend/tests/test_*.py` for specialized features (ATS, billing, team, vector store)
- Frontend tests live in `frontend/tests/`:
  - `auth.spec.ts`, `candidates.spec.ts`, `dashboard.spec.ts`, `leads.spec.ts`, `outreach.spec.ts`

**Naming:**
- Backend: `test_<module>.py`
- Frontend: `<feature>.spec.ts`

## Test Structure

**Backend Suite Pattern (`conftest.py` & Pytest Asyncio):**

```python
import pytest
from httpx import AsyncClient
from db.models import get_db, Base, engine

@pytest.fixture(scope="session")
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_candidate_5d_match(async_client: AsyncClient, test_candidate, test_job):
    response = await async_client.get(
        f"/api/v1/candidate-portal/jobs?candidate_id={test_candidate.id}"
    )
    assert response.status_code == 200
    data = response.json()
    assert "fit_score" in data[0]
    assert data[0]["fit_score"]["overall"] >= 0
```

## Mocking

**Framework:**
- `unittest.mock.AsyncMock` and `unittest.mock.patch` for Python backend testing.

**Mocking Patterns:**

```python
from unittest.mock import patch, AsyncMock

# Mock external LLM response during testing

@patch("agents.pydantic_config.get_model")
async def test_jd_parser_mocked(mock_model):
    mock_model.return_value = AsyncMock()
    # Execute test without consuming live LLM tokens
```

**What to Mock:**
- Third-party paid APIs: OpenAI, Anthropic, Serper, Stripe checkout sessions, Greenhouse Harvest API.
- Live email transmission: SMTP server calls in `email_service.send_email`.

**What NOT to Mock:**
- Database interactions: Use `aiosqlite` in-memory or SQLite file database for realistic SQL execution.
- Pydantic schema validation: Keep schema validation active to catch regression bugs.

## Fixtures and Factories

**Test Data Fixtures:**
- Located in `backend/tests/conftest.py`:
  - `db_session`: Fresh async database session with auto-rollback.
  - `test_tenant`: Seeded tenant organization for isolation testing.
  - `recruiter_token`: JWT access token with recruiter role.
  - `candidate_token`: JWT access token with candidate role.

## Coverage & Baseline Metrics

**Current Test Status (Post-Pivot v2.0):**
- **47 passed, 6 skipped, 0 failed** in ~66 seconds.
- Skipped tests (6): Integration tests requiring live external credentials (live Stripe production checkout, live Greenhouse token, live SendGrid SMTP).
- **TypeScript Type Safety:** 0 diagnostic errors (`tsc --noEmit`).
- **Production Build:** 35 application routes compiled successfully.

## Test Types

**Unit Tests:**
- Agent prompts, rubric score math, PII sanitizer regexes, JWT token generation.

**Integration Tests:**
- FastAPI routes with DB operations, multi-tenant isolation barriers, Celery task invocation.

**End-to-End (E2E) Functional Scenarios:**
- Complete 26-step audit pipeline verified in `E2E_AUDIT_REPORT.md` (Recruiter onboarding, job posting, candidate 5D match, ghost job detection, and Copilot HITL review).

---

*Testing analysis: 2026-10-18*
