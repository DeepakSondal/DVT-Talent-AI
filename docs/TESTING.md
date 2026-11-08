# Testing & Quality Assurance Guide
**Version:** 2.1.0 (October 2026)  

---

## 1. Quality Assurance Verification Summary

DVT Talent AI enforces automated test validation across both backend and frontend layers:

- **Backend Pytest Suite:** **213 passed, 3 skipped, 0 failed** in ~198s.
- **Frontend Strict TypeScript:** **0 diagnostic errors** (`tsc --noEmit`).
- **Next.js Production Build:** **30 application routes** compiled into static and optimized dynamic bundles via Next.js 15.5.
- **Database & Migration Integrity:** Multi-tenant composite indices and pgvector extension verified under test isolation.

---

## 2. Backend Test Suite (Pytest)

The backend test suite is configured via `backend/pytest.ini` and executed against the Python virtual environment.

### Running Backend Tests

```powershell
cd backend

# Run the complete test suite with concise output
venv\Scripts\python.exe -m pytest -q

# Run with verbose reporting
venv\Scripts\python.exe -m pytest -v

# Run candidate portal tests
venv\Scripts\python.exe -m pytest -v tests/api/test_candidate_portal.py

# Run swarm and agent tests
venv\Scripts\python.exe -m pytest -v tests/agents/test_swarm_logic.py

# Run workflow fixes regression suite
venv\Scripts\python.exe -m pytest -v tests/test_workflow_fixes.py
```

### Verified Test Categories & Coverage (213 Passing Tests)

| Test Module | Coverage Scope | Status |
|---|---|---|
| `tests/test_workflow_fixes.py` | Dodo webhook HMAC signature check, checkout return URL validation, team tenant isolation, GDPR candidate filter, company domain composite index, pgvector init | **26 Passed** |
| `tests/api/test_candidate_portal.py` | Career-Ops suite: profile, resume intake, 5D match, ghost job check, applications, STAR interview prep | **Passed** |
| `tests/agents/test_swarm_logic.py` | 7-agent recruitment swarm coordination, sourcing filters, tool execution | **Passed** |
| `tests/api/test_swarm_endpoints.py` | Swarm triggers, telemetry signal polling, task state transitions | **Passed** |
| `tests/communication/test_fabric.py` | Agent shared memory, execution checkpoints, event broadcasting | **Passed** |
| `tests/db/test_isolation.py` | Multi-tenant isolation boundaries & session scoping | **Passed** |
| `tests/test_agents.py` | Pydantic AI agent instantiation, prompt schemas, tool bindings | **Passed** |
| `tests/test_ai_advanced.py` | JD bias optimization, candidate screening, compliance critic | **Passed** |
| `tests/test_ats_integrations.py` | Greenhouse Harvest & CEIPAL client authentication and syncing | **Passed** |
| `tests/test_auth_social.py` | OAuth redirects, token exchange, role defaults | **Passed** |
| `tests/test_billing.py` / `test_dodo_billing.py` | Dodo Payments checkout sessions, customer portal, webhook event ingestion | **Passed** |
| `tests/test_email_oauth.py` | Google Workspace & Microsoft 365 OAuth 2.0 flow and encrypted token storage | **Passed** |
| `tests/test_email_sender.py` | Dual-Tier mailer (Tier 1: OAuth native; Tier 2: Reply-To Relay fallback; Tier 3: SMTP) | **Passed** |
| `tests/test_hub_integrations.py` | Unified ATS providers, pagination, data mapping | **Passed** |
| `tests/test_outreach_logic.py` | Template variable substitution, tone adaptation, HITL approval gate | **Passed** |
| `tests/test_system_pulse.py` | Full autonomous swarm lifecycle simulation | **Passed** |
| `tests/test_team.py` | Manager provisioning, invitation flows, BYOK AES-256 key encryption | **Passed** |
| `tests/test_tenant_isolation.py` | Cross-tenant data leakage prevention gates and partial candidate index | **Passed** |
| `tests/test_vector_store_mock.py` | FastEmbed ONNX CPU embeddings & PostgreSQL pgvector cosine similarity | **Passed** |
| `tests/test_workers.py` | Signal monitor scans, event deduplication | **Passed** |

> **Skipped Tests (3):** Integration tests requiring live external network credentials (live external ATS endpoints and remote SMTP server).

---

## 3. Frontend Verification Suite

Frontend verification validates static types, code formatting, and Next.js 15 production build readiness.

### Running Frontend Verification

```powershell
cd frontend

# 1. TypeScript Strict Type-Checking
npm run type-check

# 2. Next.js ESLint Code Quality Inspection
npm run lint

# 3. Production Compilation & Static Page Generation
npm run build
```

### Verification Criteria

- `npm run type-check`: Must complete with exit code 0 and zero TypeScript diagnostic errors.
- `npm run lint`: Must pass all rules defined in `.eslintrc.json`.
- `npm run build`: Must compile all 30 application routes successfully on Next.js 15.5.

---

## 4. End-to-End (E2E) Functional Verification

The end-to-end audit encompasses **28 distinct user scenarios**:
1. Recruiter registration and onboarding flow.
2. Job requisition creation and AI skill taxonomy optimization.
3. Candidate Portal user registration and role assignment.
4. Candidate resume upload and profile parsing.
5. Candidate verified job browsing with 5D fit score calculation.
6. Ghost-job detection flagging on aged listings.
7. Candidate application submission and tracking.
8. Zero-fabrication ATS resume suggestion generation.
9. STAR behavioral interview coaching flashcards.
10. Employer domain privacy blacklist enforcement (`hide_from_companies`).
11. Recruiter autonomous swarm sourcing run with self-healing fallback loop.
12. Copilot Checkpoint 1: JD approval.
13. Copilot Checkpoint 2: Candidate curation.
14. Copilot Checkpoint 3: Email sequence inspection.
15. EEOC 4/5ths adverse impact ratio calculation.
16. AI Decision Ledger immutable audit record creation.
17. Manual recruiter score override with rationale notes.
18. Dodo Payments hosted Checkout Session generation.
19. Dodo Payments HMAC-SHA256 webhook signature verification and credit grant.
20. Customer billing portal session URL generation.
21. Dual-tier recruiter email delivery: Tier 1 (Google/Microsoft OAuth 2.0).
22. Dual-tier recruiter email delivery: Tier 2 (Platform Reply-To Relay fallback).
23. Team member invite and role assignment scoped to tenant.
24. AES-256 Bring-Your-Own-Key encryption and retrieval.
25. Custom SMTP credentials validation with TLS.
26. ATS connection credentials encryption.
27. GDPR candidate PII 4-tier permanent erasure.
28. Real-time WebSocket telemetry event streaming multiplexed across browser tabs.
