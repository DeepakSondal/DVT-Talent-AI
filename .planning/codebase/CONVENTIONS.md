---
last_mapped_commit: f2fad2b1e423077443f26c93600f11df821b3e3f
last_mapped_at: 2026-10-18
---
# Coding Conventions

**Analysis Date:** 2026-10-18

## Naming Patterns

**Files:**
- Backend: `snake_case.py` (e.g., `candidate_portal.py`, `sanitizer_service.py`, `pydantic_config.py`)
- Frontend routes: `kebab-case` directories with `page.tsx`, `layout.tsx`, `loading.tsx`
- Frontend components: `PascalCase.tsx` (e.g., `CopilotActionModal.tsx`, `ScoreRing.tsx`)
- Frontend services: `camelCase.service.ts` (e.g., `billing.service.ts`)
- TypeScript types: `camelCase.ts` or `kebab-case.ts` (e.g., `types/auth.ts`)

**Functions & Methods:**
- Python: `snake_case()` (e.g., `validate_required_settings()`, `get_db()`, `track_email_open()`)
- TypeScript: `camelCase()` (e.g., `fetchCandidateProfile()`, `useDebounce()`, `handleSubmit()`)

**Variables & Constants:**
- Python local variables: `snake_case` (e.g., `candidate_id`, `match_score`)
- Python global constants: `UPPER_SNAKE_CASE` (e.g., `BASE_DIR`, `PREFIX = "/api/v1"`)
- TypeScript variables: `camelCase` (e.g., `isSubmitting`, `candidateList`)
- TypeScript constants: `UPPER_SNAKE_CASE` or `camelCase` (e.g., `MAX_RETRY_COUNT = 3`)

**Types & Classes:**
- Python Classes: `PascalCase` (e.g., `Settings`, `Candidate`, `JobPosting`, `PydanticAgent`)
- TypeScript Interfaces & Types: `PascalCase` (e.g., `CandidateProfile`, `JobRequisition`, `AuthState`)

## Code Style

**Formatting:**
- Python: Formatted with Ruff (`backend/ruff.toml`), target version Python 3.10+, line length 100, double quotes.
- TypeScript/React: Next.js ESLint (`frontend/.eslintrc.json`) extending `next/core-web-vitals`.

**Linting Rules:**
- Python (`backend/ruff.toml`):
  - Linters enabled: `E`, `F`, `I` (isort), `N` (naming), `ASYNC`, `S` (flake8-bandit/security), `B` (bugbear), `PL` (pylint).
  - Ignored: `E501` (line length delegated to formatter).
  - Max function arguments: 8.
  - Max branches: 12.
- TypeScript:
  - `"react/no-unescaped-entities": "off"`
  - `"@next/next/no-img-element": "warn"`

## Import Organization

**Python (`backend/`):**
Order enforced by Ruff isort:
1. Standard library imports (e.g., `sys`, `os`, `uuid`, `datetime`, `contextlib`)
2. Third-party dependencies (e.g., `fastapi`, `structlog`, `sqlalchemy`, `pydantic_ai`)
3. First-party internal packages (defined in `known-first-party = ["agents", "api", "communication", "db", "workers", "services"]`)

**TypeScript (`frontend/`):**
1. React & Next.js core (`react`, `next/navigation`, `next/link`)
2. External UI libraries (`lucide-react`, `@radix-ui/*`, `framer-motion`)
3. Internal providers, services, and hooks (`@/providers/*`, `@/services/*`, `@/hooks/*`)
4. Internal components (`@/components/*`)
5. Types and utilities (`@/types/*`, `@/lib/utils`)

**Path Aliases:**
- Frontend: `@/*` maps to `frontend/src/*` (configured in `frontend/tsconfig.json`).

## Error Handling

**Backend Strategy:**
- Use FastAPI `HTTPException` with explicit HTTP status codes (`status.HTTP_404_NOT_FOUND`, `status.HTTP_400_BAD_REQUEST`, `status.HTTP_403_FORBIDDEN`).
- Pydantic models automatically reject invalid request payloads with HTTP 422 Unprocessable Entity.
- Multi-provider LLM error fallback: wrapped in `try/except` inside `backend/agents/pydantic_config.py` to seamlessly fall back between Anthropic, Groq, and OpenAI.
- Non-critical operations (email pixel tracking) wrap in `try/except` and never throw exceptions to the client (`backend/main.py:156`).

**Frontend Strategy:**
- Form inputs validated via Zod schemas before submission.
- Network errors caught in React Query `onError` handlers and displayed via `sonner` toast notifications.
- React Error Boundary at `frontend/src/app/error.tsx` provides recovery options for uncaught render errors.

## Logging

**Framework:**
- Backend: Structured JSON logging with `structlog` (`backend/main.py:53`).
- Frontend: `console.error` only for unexpected client exceptions.

**Patterns:**
- Always pass structured contextual keys rather than string concatenation:
  ```python
  log.info("candidate_scored", candidate_id=str(candidate.id), score=score, tenant_id=tenant_id)
  ```
- Errors logged with `error=str(e)` and traceback where applicable.

## Comments

**When to Comment:**
- Document complex business logic, regulatory rules (e.g. EEOC 4/5ths rule in `critic_agent.py`), and non-obvious security mitigations.
- Reference architectural fix IDs where applicable (e.g. `# FIX [NEW-E-01]: Ensure missing critical settings halt the app`).

**Docstrings:**
- Python modules and route handlers use Google-style or standard triple-quoted docstrings explaining parameters, returns, and authorization requirements.

## Function Design

**Size:**
- Aim for functions under 50 lines. Large workflow orchestration should be split into discrete, testable steps.

**Parameters:**
- Backend: Dependency injection using FastAPI `Depends()` for database sessions, current user, and permissions.
- Frontend: Props passed via strongly-typed TypeScript interfaces.

---

*Convention analysis: 2026-10-18*
