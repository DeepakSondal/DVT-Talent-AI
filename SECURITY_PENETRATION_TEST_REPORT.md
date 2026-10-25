# DVT Talent AI — Adversarial Security Audit & Penetration Testing Report

**Date:** October 26, 2026  
**Target Application:** DVT Talent AI (Next.js 14 App Router Frontend, FastAPI + SQLAlchemy 2.0 Async Backend, Celery Workers, ChromaDB / Pinecone Vector Stores, PydanticAI Multi-Agent Swarm)  
**Audit Type:** Full-Scope White-Box Code Audit + Adversarial Multi-Tenant Penetration Testing + Root-Cause Remediation + Automated Regression Verification  

---

## 1. Executive Summary

An adversarial security audit and penetration test was conducted against **DVT Talent AI** across all nine assessment domains: Authentication & Session Management, Cross-Tenant Data Isolation, Broken Access Controls & Privilege Escalation, File Uploads & Resume Processing, AI Security Boundaries, APIs/Inputs/Business Logic, GDPR Erasure & Candidate Privacy, and Infrastructure/Secrets Configuration.

### Security Posture Summary
- **Before Audit:** While the application featured foundational security components (Argon2id/bcrypt password hashing, JWT access/refresh tokens, prompt-injection sanitization in `SanitizerService`, and initial tenant checks on basic CRUD routes), **13 exploitable application vulnerabilities** and **5 infrastructure hardening gaps** were identified. Most critically, several endpoints lacked authentication or role enforcement altogether, leaked sensitive database columns (`hashed_password`, `smtp_password_encrypted`, `sender_verification_token`) in API responses, allowed cross-tenant candidate hijacking via email deduplication, permitted cross-tenant AI semantic cache pollution/retrieval, and failed to `await` async password-hashing coroutines during password changes.
- **After Remediation:** All **13 application-layer vulnerabilities** (4 Critical, 6 High, 3 Medium) have been remediated at the root cause in deterministic backend code. A dedicated adversarial regression suite ([`backend/tests/test_security_penetration_audit.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/tests/test_security_penetration_audit.py)) was added alongside existing security suites, with **31 automated security and multi-tenant isolation tests passing (100%)**.

### Summary of Confirmed Findings

| ID | Title | Domain | Severity | Status |
| :--- | :--- | :--- | :--- | :--- |
| **VULN-01** | Unauthenticated & Cross-Tenant AI Swarm / Copilot Execution and Task Inspection | Auth / Multi-Tenancy / AI | **Critical** | **Fixed & Verified** |
| **VULN-02** | Cross-Tenant Candidate Hijack, Overwrite & Data Exfiltration via Resume Upload Deduplication | Cross-Tenant Isolation | **Critical** | **Fixed & Verified** |
| **VULN-03** | Sensitive Credential & Token Exposure (`hashed_password`, `smtp_password_encrypted`, `sender_verification_token`) and B2C User Enumeration in Tenant Endpoints | Broken Access Control / Data Exposure | **Critical** | **Fixed & Verified** |
| **VULN-04** | Broken `async` Password Change (`RuntimeWarning` Coroutine Not Awaited) & Cross-Tenant Admin User Management | Auth / Privilege Escalation | **Critical** | **Fixed & Verified** |
| **VULN-05** | Privilege Escalation: B2C `CANDIDATE` and Read-Only `VIEWER` Accounts Able to Mutate Recruiter Workspace Resources | Broken Access Control | **High** | **Fixed & Verified** |
| **VULN-06** | Cross-Tenant Campaign Email Disclosure & Cross-Tenant Company Linking in Job Creation | Cross-Tenant Isolation | **High** | **Fixed & Verified** |
| **VULN-07** | Cross-Tenant AI Swarm Memory Poisoning & Vector Delete Tenant Bypass | AI Security / Vector Store | **High** | **Fixed & Verified** |
| **VULN-08** | Server-Side Request Forgery (SSRF) in ATS Integration Configuration, Export & Custom SMTP Testing | APIs / SSRF | **High** | **Fixed & Verified** |
| **VULN-09** | B2C Candidate Signup & Portal Cross-Tenant Profile Hijacking + Application to Unpublished Jobs | Auth / Business Logic | **High** | **Fixed & Verified** |
| **VULN-10** | Refresh Token Replay, Suspended User Token Refresh, SAML SSO Unauthenticated Config & Missing Claims | Authentication & Sessions | **High** | **Fixed & Verified** |
| **VULN-11** | Unauthenticated Monitoring, Cross-Tenant Audit Log Leak, Unauthenticated Billable LLM Health Probe & Verbose Error Leaks | APIs / Info Disclosure | **Medium** | **Fixed & Verified** |
| **VULN-12** | Open Redirect on Email Click Tracking Endpoint (`/api/v1/track/{tracking_id}/click`) & CSV Formula Injection on Candidate Export | Input Validation / Business Logic | **Medium** | **Fixed & Verified** |
| **VULN-13** | Resume Parser Resource Exhaustion (Unbounded PDF Pages, DOCX Zip Bomb) & Binary Garbage Fallback | File Uploads & Parsing | **Medium** | **Fixed & Verified** |
| **INFRA-01..05** | Docker Host Port Exposure (`5432`, `6379`), Unauthenticated Redis, Fallback Grafana Password, Unprotected `/metrics`, Dual Token Storage | Infrastructure & Secrets | **Medium / Low** | **Documented for Ops** |

---

## 2. Scope and Test Environment

- **Authorized Target:** Local repository and isolated test runtime in `c:\Users\Lenovo\Downloads\dvt-talent-ai`.
- **Test Harness:** FastAPI `AsyncClient` + `ASGITransport` executing against an isolated in-memory SQLite (`sqlite+aiosqlite:///:memory:`) database, mocked external network interfaces, and temporary filesystem directories (`tmp_path`).
- **Synthetic Actors Used:**
  - **Tenant A (`tenant_a`)**: `admin_a` (`ADMIN`), `recruiter_a` (`RECRUITER`), `viewer_a` (`VIEWER`), plus synthetic company, job, campaign, and candidate records (`cand_a`).
  - **Tenant B (`tenant_b`)**: `admin_b` (`ADMIN`), `recruiter_b` (`RECRUITER`), plus synthetic company, job, campaign, and candidate records (`cand_b`).
  - **B2C Candidate (`b2c_candidate`)**: Standalone job-seeker user (`role=CANDIDATE`, `tenant_id=None`).
- **Safety Boundaries Enforced:** Zero external requests were sent to live third-party services, customer databases, or production LLM APIs during adversarial testing. No plaintext secrets are printed in this report.

---

## 3. Attack Surface and Endpoint Inventory

| Router / Module | Prefix | Key Endpoints | Auth / Role Enforcement (Post-Remediation) | Tenant Scoping Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| [`auth.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth.py) | `/api/v1/auth` | `/register`, `/login`, `/refresh`, `/logout`, `/me`, `/forgot-password`, `/reset-password`, `/accept-invite` | Public for auth entrypoints; JWT + Redis blacklist + active-user check for `/refresh`, `/me`, `/logout` | `User.tenant_id` embedded in JWT; B2C signup isolated to `Candidate.tenant_id IS NULL` |
| [`auth_sso.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth_sso.py) | `/api/v1/auth/sso` | `/login/{slug}`, `/acs`, `/config`, `/test` | `/config` and `/test` require `require_admin` + `https://` validation | Scoped by tenant slug and `current_user.tenant_id` |
| [`users.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/users.py) | `/api/v1/users` | `/`, `/me`, `/me/change-password`, `/{id}/role`, `/{id}` | `get_current_user` for `/me`; `require_admin` for user management | Strict `User.tenant_id == current_user.tenant_id` filter on all admin queries |
| [`tenants.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/tenants.py) | `/api/v1/tenants` | `/me`, `/team`, `/invite`, `/invitations`, `/team/{id}` | Non-candidate tenant check; `ADMIN`/`MANAGER` for invites; `TenantOut` & `TeamMemberOut` schemas | `current_user.tenant_id` (blocks `None`) |
| [`candidates.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidates.py) | `/api/v1/candidates` | `/`, `/export`, `/{id}`, `/{id}/status`, `/{id}/resume`, `/upload`, `/{id}/score`, `/{id}/erase` | `_require_recruiter_workspace_access` (`ADMIN`, `MANAGER`, `RECRUITER` with valid `tenant_id`) | `Candidate.tenant_id == current_user.tenant_id` across CRUD, upload deduplication, storage, and ChromaDB |
| [`candidate_portal.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidate_portal.py) | `/api/v1/portal` | `/jobs`, `/profile`, `/profile/resume`, `/apply/{job_id}`, `/applications`, `/interview-prep/{job_id}` | `require_candidate` (`UserRole.CANDIDATE`) | Self-owned `Candidate.user_id == current_user.id` and `Candidate.tenant_id IS NULL`; jobs filtered to `is_active & is_published` |
| [`jobs.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/jobs.py) | `/api/v1/jobs` | `/`, `/{id}` (GET, POST, PUT, DELETE) | `_require_jobs_access` (blocks `CANDIDATE`; blocks `VIEWER` on write/delete) | `Job.tenant_id == current_user.tenant_id` + verifies `company_id` belongs to tenant |
| [`companies.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/companies.py) | `/api/v1/companies` | `/`, `/{id}`, `/{id}/Pipeline` | `_require_companies_access` (blocks `CANDIDATE`; blocks `VIEWER` on write/delete) | `Company.tenant_id == current_user.tenant_id` |
| [`campaigns.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/campaigns.py) | `/api/v1/campaigns` | `/`, `/{id}`, `/{id}/emails`, `/{id}/launch`, `/{id}/pause` | `_require_campaign_access` (blocks `CANDIDATE`; blocks `VIEWER` on write) | `EmailCampaign` joined with `User.tenant_id == current_user.tenant_id` |
| [`agents.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/agents.py) | `/api/v1/agents` | `/trigger`, `/dag/run`, `/swarm/run`, `/swarm/phase/{phase}`, `/tasks`, `/tasks/{id}` | `_require_agent_access` (`ADMIN`, `MANAGER`, `RECRUITER` with `tenant_id`) | `AgentTask.tenant_id == current_user.tenant_id` |
| [`copilot.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/copilot.py) | `/api/v1/copilot/copilot` | `/discovery`, `/sourcing`, `/outreach` | `_require_copilot_access` (`ADMIN`, `MANAGER`, `RECRUITER` with `tenant_id`) | Server-side `current_user.tenant_id` overrides client `req.tenant_id`; validates `task.tenant_id` |
| [`integrations.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/integrations.py) | `/api/v1/integrations` | `/ats/configure`, `/ats/jobs`, `/ats/export`, `/ats/webhook/{provider}` | `ADMIN`/`MANAGER` for configure; recruiter workspace role for jobs/export; HMAC-SHA256 for webhooks | `current_user.tenant_id` + outbound SSRF URL validation |
| [`email_sender.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/email_sender.py) | `/api/v1/email-settings` | `/`, `/verify`, `/custom-smtp`, `/test-connection` | `ADMIN`/`MANAGER` for config changes; SSRF host/port validation on SMTP | `current_user.tenant_id` |
| [`monitoring.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/monitoring.py) | `/api/v1/monitoring` | `/signals/recent`, `/mediations`, `/audit-logs`, `/celery/workers` | Auth required on all; `require_admin` on `/mediations`, `/audit-logs`, `/celery/workers` | `AuditLog.tenant_id == current_user.tenant_id`; signals filtered by tenant |
| [`health.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/health.py) | `/health` | `/health`, `/health/db`, `/health/redis`, `/health/llm` | `/health/llm` requires `require_admin`; sanitized error strings on all | Global health checks (no tenant data) |
| [`websocket.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/websocket.py) | `/api/v1/ws` | `/stream`, `/dashboard` | JWT signature + expiration + Redis `blacklist:{token}` check | Rejects empty/`"default"` tenant broadcast |

---

## 4. Confirmed Findings (with Severity, Evidence, and Reproduction Steps)

### VULN-01: Unauthenticated & Cross-Tenant AI Swarm / Copilot Execution and Task Inspection
- **Severity:** **Critical**
- **Affected Components:** [`backend/api/routes/copilot.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/copilot.py), [`backend/api/routes/agents.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/agents.py)
- **Prerequisites:** None (unauthenticated network access to `/api/v1/copilot/copilot/*`, `/api/v1/agents/tasks`, or `/api/v1/agents/swarm/*`).
- **Vulnerability Details & Reproduction:**
  1. In `copilot.py`, `start_copilot_discovery`, `start_copilot_sourcing`, and `start_copilot_outreach` had **no `Depends(get_current_user)` dependency** and trusted `req.tenant_id` directly from the JSON body. Furthermore, `/sourcing` and `/outreach` loaded `AgentTask` by `req.task_id` without checking `task.tenant_id`, allowing an attacker to read/hijack another tenant's AI workflow and trigger outbound recruitment emails.
  2. In `agents.py`, `run_swarm_pipeline`, `run_swarm_phase`, `list_agent_tasks`, and `get_task_status` had **no authentication dependency** and queried `SELECT * FROM agent_tasks` globally across all tenants.
- **Impact:** Unauthenticated LLM cost exhaustion, unauthorized outbound recruitment outreach, and full cross-tenant disclosure of all AI agent task inputs and outputs.

---

### VULN-02: Cross-Tenant Candidate Hijack, Overwrite & Data Exfiltration via Resume Upload Deduplication
- **Severity:** **Critical**
- **Affected Components:** [`backend/api/routes/candidates.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidates.py) (`intake_candidate_resume`, `score_candidate`)
- **Prerequisites:** Any authenticated recruiter account in Tenant B knowing or guessing the email address of a candidate in Tenant A.
- **Vulnerability Details & Reproduction:**
  1. In `POST /api/v1/candidates/upload` (`intake_candidate_resume`), after parsing the uploaded resume, the endpoint checked for an existing candidate using:
     ```python
     existing = await db.execute(select(Candidate).where(Candidate.email == email))
     candidate = existing.scalar_one_or_none()
     ```
     Because `Candidate.tenant_id == current_user.tenant_id` was omitted, uploading a resume containing `victim@example.com` matched Tenant A's candidate record, overwrote Tenant A's candidate fields (`resume_text`, `skills`, `resume_file_path`), and returned Tenant A's `candidate.id` and full profile to Tenant B.
  2. Additionally, `POST /api/v1/candidates/{candidate_id}/score` did not verify that `candidate_id` belonged to `current_user.tenant_id`.
- **Impact:** Cross-tenant PII disclosure, cross-tenant data corruption/overwrite, and crash potential (`MultipleResultsFound`) when two tenants legitimately store candidates with the same email.

---

### VULN-03: Sensitive Credential & Token Exposure and B2C User Enumeration in Tenant Endpoints
- **Severity:** **Critical**
- **Affected Components:** [`backend/api/routes/tenants.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/tenants.py) (`get_my_tenant`, `list_team_members`)
- **Prerequisites:** Any authenticated user (including a low-privilege `VIEWER` or a B2C `CANDIDATE` with `tenant_id=None`).
- **Vulnerability Details & Reproduction:**
  1. `GET /api/v1/tenants/me` returned the raw SQLAlchemy `Tenant` ORM model without a `response_model`, serializing `smtp_password_encrypted` and `sender_verification_token` to every user in the tenant.
  2. `GET /api/v1/tenants/team` returned raw `User` ORM objects without a `response_model`, exposing `hashed_password` for every team member in the tenant.
  3. Worse, when a B2C `CANDIDATE` (`current_user.tenant_id == None`) called `GET /api/v1/tenants/team`, SQLAlchemy evaluated `User.tenant_id == None` (`WHERE tenant_id IS NULL`), returning **every B2C candidate user account and their `hashed_password` across the entire platform**.
- **Impact:** Mass exposure of password hashes, encrypted SMTP credentials, and sender verification tokens across tenants and B2C users.

---

### VULN-04: Broken `async` Password Change & Cross-Tenant Admin User Management
- **Severity:** **Critical**
- **Affected Components:** [`backend/api/routes/users.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/users.py) (`change_password`, `list_users`, `update_user_role`, `deactivate_user`)
- **Prerequisites:** Authenticated user changing password; or Tenant B `ADMIN` targeting Tenant A user IDs.
- **Vulnerability Details & Reproduction:**
  1. In `backend/services/security_service.py`, `verify_password` and `hash_password` are `async def` functions. However, `POST /api/v1/users/me/change-password` called `verify_password(...)` and `hash_password(...)` **without `await`**. In Python, an unawaited coroutine object is always truthy (`bool(coroutine) == True`), meaning:
     - **Any wrong `current_password` bypassed verification!**
     - Setting `current_user.hashed_password = hash_password(data.new_password)` attempted to assign a coroutine object to the database column, crashing or corrupting the user's password hash.
  2. In `users.py`, `GET /api/v1/users`, `PUT /api/v1/users/{user_id}/role`, and `DELETE /api/v1/users/{user_id}` checked `require_admin` but **never filtered by `User.tenant_id == current_user.tenant_id`**, allowing a Tenant B Admin to list all users in Tenant A, change Tenant A users' roles, or deactivate Tenant A's administrator.
- **Impact:** Complete cross-tenant administrative takeover and broken password verification.

---

### VULN-05: Privilege Escalation — B2C `CANDIDATE` and Read-Only `VIEWER` Accounts Able to Mutate Recruiter Workspace Resources
- **Severity:** **High**
- **Affected Components:** [`backend/api/routes/candidates.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidates.py), [`backend/api/routes/jobs.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/jobs.py), [`backend/api/routes/companies.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/companies.py), [`backend/api/routes/campaigns.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/campaigns.py)
- **Prerequisites:** Authenticated B2C `CANDIDATE` (`tenant_id=None`) or tenant `VIEWER` account.
- **Vulnerability Details & Reproduction:**
  - Endpoints across `candidates.py`, `jobs.py`, `companies.py`, and `campaigns.py` only depended on `get_current_user` without role checks.
  - A `VIEWER` user could create/delete jobs, create/delete companies, create/update candidates, upload resumes, and launch email campaigns.
  - A B2C `CANDIDATE` (`tenant_id=None`) could query recruiter endpoints where `Model.tenant_id == current_user.tenant_id` matched `tenant_id IS NULL` (including all B2C candidate profiles in `candidates`!) or create orphan records.
- **Impact:** Horizontal and vertical privilege escalation across B2C candidates and read-only viewers.

---

### VULN-06: Cross-Tenant Campaign Email Disclosure & Cross-Tenant Company Linking in Job Creation
- **Severity:** **High**
- **Affected Components:** [`backend/api/routes/campaigns.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/campaigns.py) (`get_campaign_emails`), [`backend/api/routes/jobs.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/jobs.py) (`create_job`)
- **Prerequisites:** Authenticated recruiter in Tenant B.
- **Vulnerability Details & Reproduction:**
  1. `GET /api/v1/campaigns/{campaign_id}/emails` queried `EmailSent` by `campaign_id` without verifying that `campaign_id` belonged to `current_user.tenant_id`, allowing Tenant B to read all outreach emails sent by Tenant A.
  2. `POST /api/v1/jobs` accepted an arbitrary `company_id` in the payload without verifying that the target `Company` belonged to `current_user.tenant_id`.
- **Impact:** Cross-tenant outreach email disclosure and unauthorized cross-tenant relational linking.

---

### VULN-07: Cross-Tenant AI Swarm Memory Poisoning & Vector Delete Tenant Bypass
- **Severity:** **High**
- **Affected Components:** [`backend/agents/swarm_memory.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/agents/swarm_memory.py), [`backend/agents/critic_pydantic.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/agents/critic_pydantic.py), [`backend/db/vector_store.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/db/vector_store.py)
- **Prerequisites:** Authenticated user triggering AI Critic / Swarm Memory or vector operations.
- **Vulnerability Details & Reproduction:**
  1. `SwarmMemory.retrieve_similar_context(query_text)` used a global Redis key `swarm_cache:{md5(query)}` and queried Pinecone without any `tenant_id` filter. Even worse, `store_experience` explicitly stored records with `"tenant_id": tenant_id or "global_network"`, and `consult_swarm_memory` in `critic_pydantic.py` never passed `ctx.deps.tenant_id`. A prompt injection or sensitive candidate evaluation in Tenant A was cached and served directly into Tenant B's AI reasoning context.
  2. In `vector_store.py`, `delete_resumes(ids=..., tenant_id=...)` deleted by `ids` without passing `where={"tenant_id": str(tenant_id)}` when `ids` was provided.
- **Impact:** Cross-tenant AI context leakage, indirect prompt injection across tenants, and potential cross-tenant vector deletion.

---

### VULN-08: Server-Side Request Forgery (SSRF) in ATS Integration Configuration, Export & Custom SMTP Testing
- **Severity:** **High**
- **Affected Components:** [`backend/api/routes/integrations.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/integrations.py), [`backend/integrations/unified_ats.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/integrations/unified_ats.py), [`backend/api/routes/email_sender.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/email_sender.py)
- **Prerequisites:** Authenticated tenant user configuring ATS or custom SMTP settings.
- **Vulnerability Details & Reproduction:**
  1. `POST /api/v1/integrations/ats/configure` accepted an arbitrary `base_url` (e.g., `http://169.254.169.254/latest/meta-data/` or `http://redis:6379`) and passed it to `CeipalClient` / `GreenhouseClient`, which immediately issued outbound HTTP requests.
  2. `unified_ats.export_candidate` downloaded `candidate.resume_file_path` via `httpx.AsyncClient().get(...)` if it began with `http`, without SSRF validation or verifying `Candidate.tenant_id == tenant_id`.
  3. `POST /api/v1/email-settings/custom-smtp` and `/test-connection` accepted internal container hostnames (`redis`, `postgres`, `127.0.0.1`) and arbitrary TCP ports (`6379`, `5432`), enabling internal port scanning and banner grabbing.
- **Impact:** Cloud metadata credential theft (`169.254.169.254`) and internal Docker network reconnaissance.

---

### VULN-09: B2C Candidate Signup & Portal Cross-Tenant Profile Hijacking + Application to Unpublished Jobs
- **Severity:** **High**
- **Affected Components:** [`backend/api/routes/auth.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth.py) (`register`), [`backend/api/routes/candidate_portal.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidate_portal.py)
- **Prerequisites:** External user registering as a B2C `CANDIDATE` with the same email address as a candidate sourced by a recruiting tenant.
- **Vulnerability Details & Reproduction:**
  1. During B2C registration (`auth.py`) and portal profile retrieval (`candidate_portal.py`), the code searched `select(Candidate).where(Candidate.email == user.email)` without requiring `Candidate.tenant_id.is_(None)`. This linked the external B2C user directly to a recruiting tenant's private `Candidate` record (`tenant_id = X`), exposing recruiter notes/scores or throwing `MultipleResultsFound` (500 DoS) if two tenants had sourced the same candidate email.
  2. In `candidate_portal.py`, `POST /api/v1/portal/apply/{job_id}`, `/interview-prep/{job_id}`, and `/tailor-resume/{job_id}` checked `Job.id == job_id` without verifying `job.is_active and job.is_published`.
- **Impact:** Cross-tenant candidate profile hijacking, 500 DoS on B2C registration, and applications to private/draft tenant jobs.

---

### VULN-10: Refresh Token Replay, Suspended User Token Refresh, SAML SSO Unauthenticated Config & Missing Claims
- **Severity:** **High**
- **Affected Components:** [`backend/api/routes/auth.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth.py), [`backend/api/routes/auth_sso.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth_sso.py), [`backend/api/routes/auth_social.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth_social.py), [`backend/api/routes/websocket.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/websocket.py)
- **Prerequisites:** Captured/logged-out refresh token, deactivated user session, or unauthenticated access to `/api/v1/auth/sso/config`.
- **Vulnerability Details & Reproduction:**
  1. `POST /api/v1/auth/refresh` did not check if `dvt_refresh_token` was blacklisted in Redis, did not rotate/blacklist used refresh tokens, did not check `user.is_active`, and omitted `role` and `tenant_id` claims in the newly minted access token.
  2. `POST /api/v1/auth/logout` only blacklisted the access token, leaving `dvt_refresh_token` reusable for 7 days.
  3. `POST /api/v1/auth/sso/config` and `/test` had no authentication (`require_admin` was missing).
  4. `_verify_ws_token` in `websocket.py` did not check Redis `blacklist:{token}`, and `broadcast_to_tenant` broadcasted to all connected sockets if `tenant_id` was empty or `"default"`.
- **Impact:** Persistent session access after logout or account deactivation, and unauthenticated SAML configuration tampering.

---

### VULN-11: Unauthenticated Monitoring, Cross-Tenant Audit Log Leak, Unauthenticated Billable LLM Health Probe & Verbose Error Leaks
- **Severity:** **Medium**
- **Affected Components:** [`backend/api/routes/monitoring.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/monitoring.py), [`backend/api/routes/health.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/health.py)
- **Prerequisites:** Unauthenticated user or authenticated admin in another tenant.
- **Vulnerability Details & Reproduction:**
  1. `/api/v1/monitoring/signals/recent`, `/mediations`, and `/celery/workers` were completely unauthenticated.
  2. `/api/v1/monitoring/audit-logs` did not filter by `AuditLog.tenant_id == current_user.tenant_id`, leaking audit trails across all tenants, and referenced non-existent model attributes (`resource_type`/`resource_id` instead of `entity_type`/`entity_id`).
  3. `/health/llm` was unauthenticated and triggered live, billable API completions to OpenAI/Anthropic/Gemini on every request.
  4. `/health/db`, `/health/redis`, and `/health/llm` returned raw internal `str(e)` exception strings to unauthenticated callers.
- **Impact:** Cross-tenant audit log disclosure, LLM quota/financial exhaustion, and infrastructure topology disclosure.

---

### VULN-12: Open Redirect on Email Click Tracking Endpoint & CSV Formula Injection on Candidate Export
- **Severity:** **Medium**
- **Affected Components:** [`backend/main.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/main.py) (`track_link_click`), [`backend/api/routes/candidates.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidates.py) (`export_candidates`)
- **Prerequisites:** External attacker crafting a tracking link or submitting a resume with formula-prefixed fields.
- **Vulnerability Details & Reproduction:**
  1. `GET /api/v1/track/{tracking_id}/click?url=https://evil.example.com` blindly redirected (`RedirectResponse(url=url)`) to any external domain even when `tracking_id` did not exist.
  2. `GET /api/v1/candidates/export` wrote candidate fields (`first_name`, `email`, `title`, `location`) directly into CSV cells without escaping leading `=`, `+`, `-`, or `@` characters, enabling spreadsheet formula execution when opened by a recruiter in Excel/Google Sheets.
- **Impact:** Phishing via trusted domain open redirect and client-side command/formula execution via exported CSV files.

---

### VULN-13: Resume Parser Resource Exhaustion (Unbounded PDF Pages, DOCX Zip Bomb) & Binary Garbage Fallback
- **Severity:** **Medium**
- **Affected Components:** [`backend/services/resume_parser.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/services/resume_parser.py)
- **Prerequisites:** Candidate or recruiter uploading a crafted `.pdf`, `.docx`, or binary file.
- **Vulnerability Details & Reproduction:**
  1. `_extract_pdf` iterated over every page in `reader.pages` without a ceiling, allowing a multi-thousand-page PDF to exhaust worker CPU/memory.
  2. `_extract_docx` opened `.docx` archives via `zipfile.ZipFile` without inspecting uncompressed `file_size` headers, making it vulnerable to zip bombs.
  3. When `_extract_pdf` or `_extract_docx` failed on a corrupted binary or when an executable (`MZ` / `\x7fELF`) was uploaded, `extract_text_from_bytes` fell back to `file_bytes.decode("utf-8", errors="ignore")`, injecting raw binary strings into the database and LLM prompts without passing through `sanitizer_service.sanitize()`.
- **Impact:** Worker denial-of-service (DoS) and unvalidated binary/prompt injection into downstream LLM pipelines.

---

## 5. Root Causes and Fixes Applied

| File | Root Cause Fixed |
| :--- | :--- |
| [`backend/api/routes/candidates.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidates.py) | Added `_require_recruiter_workspace_access` (blocks `CANDIDATE`, `VIEWER`, and `tenant_id=None`); scoped email deduplication in `intake_candidate_resume` to `Candidate.tenant_id == current_user.tenant_id`; enforced tenant ownership in `score_candidate`; added `_sanitize_csv_cell` in `export_candidates`. |
| [`backend/api/routes/tenants.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/tenants.py) | Added `TenantOut` and `TeamMemberOut` response schemas to strip `hashed_password`, `smtp_password_encrypted`, and `sender_verification_token`; blocked `CANDIDATE` and `tenant_id=None` from `/me` and `/team`. |
| [`backend/api/routes/copilot.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/copilot.py) | Added `Depends(get_current_user)` and `_require_copilot_access` to `/discovery`, `/sourcing`, and `/outreach`; enforced `task.tenant_id == current_user.tenant_id` and ignored client-supplied `req.tenant_id`. |
| [`backend/api/routes/agents.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/agents.py) | Added `Depends(get_current_user)` and `_require_agent_access` to all trigger, DAG, swarm, and task status routes; scoped `/tasks` and `/tasks/{task_id}` strictly to `AgentTask.tenant_id == current_user.tenant_id`. |
| [`backend/api/routes/users.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/users.py) | Added missing `await` to `verify_password` and `hash_password` in `change_password` plus minimum password length validation; scoped `list_users`, `update_user_role`, and `deactivate_user` to `User.tenant_id == current_user.tenant_id` and blocked self-deactivation. |
| [`backend/api/routes/campaigns.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/campaigns.py) | Added `_require_campaign_access`; joined `EmailCampaign` with `User` in `get_campaign_emails` to verify `User.tenant_id == current_user.tenant_id`. |
| [`backend/api/routes/jobs.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/jobs.py) & [`companies.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/companies.py) | Added `_require_jobs_access` and `_require_companies_access` (blocking `CANDIDATE` on all and `VIEWER` on write/delete); verified `company_id` belongs to `current_user.tenant_id` in `create_job`. |
| [`backend/api/routes/auth.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth.py) & [`candidate_portal.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/candidate_portal.py) | Scoped B2C candidate lookup to `Candidate.tenant_id.is_(None)` and `Candidate.user_id.is_(None)`; enforced `job.is_active and job.is_published` on portal job application and AI prep routes; updated `/refresh` to check Redis blacklist, verify `user.is_active`, rotate refresh tokens, and include `role`/`tenant_id` claims; updated `/logout` to blacklist refresh tokens. |
| [`backend/api/routes/auth_sso.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth_sso.py), [`auth_social.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/auth_social.py), [`websocket.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/websocket.py) | Required `require_admin` and `https://` validation on SSO config/test; embedded `role` and `tenant_id` in SSO/OAuth JWTs; made `_verify_ws_token` check Redis token blacklist and prevented wildcard tenant broadcasts. |
| [`backend/api/routes/integrations.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/integrations.py), [`unified_ats.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/integrations/unified_ats.py), [`email_sender.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/email_sender.py) | Added `_validate_safe_outbound_url` and `_validate_smtp_target` to block loopback, RFC1918 private IPs, link-local metadata (`169.254.169.254`), internal container hostnames, and non-standard SMTP ports; enforced tenant ownership in `export_candidate`. |
| [`backend/main.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/main.py), [`monitoring.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/monitoring.py), [`health.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/api/routes/health.py) | Restricted `/api/v1/track/{tracking_id}/click` redirects to trusted origins or exact recorded `microsite_url`; required auth/admin on monitoring routes and scoped `/audit-logs` to `current_user.tenant_id`; required `require_admin` on `/health/llm` and sanitized health check errors. |
| [`backend/services/resume_parser.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/services/resume_parser.py) | Enforced `MAX_PDF_PAGES = 50`, `MAX_DOCX_UNCOMPRESSED_BYTES = 25 MB`, magic-byte executable rejection (`MZ`, `\x7fELF`), no raw binary UTF-8 fallback on failed PDF/DOCX archives, and mandatory `sanitizer_service.sanitize()` on extracted text. |
| [`backend/agents/swarm_memory.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/agents/swarm_memory.py), [`critic_pydantic.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/agents/critic_pydantic.py), [`vector_store.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/db/vector_store.py) | Scoped Redis semantic cache keys and Pinecone metadata filters strictly by `tenant_id`; passed `ctx.deps.tenant_id` in `consult_swarm_memory`; enforced `where={"tenant_id": str(tenant_id)}` on `delete_resumes`. |

---

## 6. Regression Tests Added

A new comprehensive penetration test suite was created in [`backend/tests/test_security_penetration_audit.py`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/backend/tests/test_security_penetration_audit.py) alongside the existing security test suites (`test_tenant_isolation.py`, `test_candidate_erasure.py`, `test_resume_endpoints.py`, `test_team_invitations.py`):
1. **`test_authentication_boundaries_and_token_tampering`**: Verifies unauthenticated `401` rejections across protected routes, expired token rejection, refresh-token-as-access-token type confusion rejection, deactivated user session refresh rejection, and `async` password verification/hashing on `/api/v1/users/me/change-password`.
2. **`test_cross_tenant_resume_upload_cannot_hijack_other_tenant_candidate`**: Verifies uploading a resume in Tenant B containing Tenant A's candidate email creates an isolated Tenant B candidate record without modifying or leaking Tenant A's candidate.
3. **`test_tenant_and_team_endpoints_do_not_leak_hashes_or_secrets`**: Verifies `hashed_password`, `smtp_password_encrypted`, and `sender_verification_token` are stripped from `/api/v1/tenants/me` and `/api/v1/tenants/team`, and verifies B2C `CANDIDATE` (`tenant_id=None`) receives `403 Forbidden` on `/api/v1/tenants/team`.
4. **`test_cross_tenant_idor_defenses`**: Verifies cross-tenant `404`/`403` isolation across `/campaigns/{id}/emails`, `/agents/status/{id}`, `/agents/tasks`, `/copilot/copilot/discovery`, `/copilot/copilot/sourcing`, `/users`, `/users/{id}/role`, `/users/{id}/deactivate`, `/monitoring/audit-logs`, and `/jobs` (`company_id` hijack).
5. **`test_rbac_and_cross_candidate_isolation`**: Verifies B2C `CANDIDATE` cannot tamper with another candidate's status/resume or apply/prep for unpublished jobs; verifies non-admin `RECRUITER` cannot overwrite SAML SSO configuration; verifies `VIEWER` cannot create or delete workspace resources.
6. **`test_open_redirect_ssrf_and_ai_file_boundaries`**: Verifies open redirect blocking on `/api/v1/track/{id}/click`, SSRF blocking on Ceipal `base_url` (`169.254.169.254`, `127.0.0.1`, `localhost`, `redis`, `10.0.0.5`) and SMTP host/port (`127.0.0.1:6379`, `redis:587`), prompt-injection (`[REDACTED_PROMPT_INJECTION]`) and `<script>` sanitization in `ResumeParserService.extract_text`, executable (`MZ`) rejection, and CSV formula injection neutralization (`'=cmd|...`).

---

## 7. Retest Results (Before-and-After Comparison)

| Attack Vector / Test Case | Before Remediation | After Remediation (Retest Result) |
| :--- | :--- | :--- |
| Unauthenticated `POST /api/v1/copilot/copilot/discovery` | `200 OK` / `500` (Executes agent with arbitrary `tenant_id`) | `401 Unauthorized` (**Blocked**) |
| Unauthenticated `GET /api/v1/agents/tasks` | `200 OK` (Returns all tenants' tasks) | `401 Unauthorized` (**Blocked**) |
| Tenant B `GET /api/v1/agents/tasks/{tenant_a_task_id}` | `200 OK` (Leaks Tenant A task output) | `404 Not Found` (**Blocked**) |
| Tenant B uploads resume with Tenant A candidate's email | `201 Created` (Overwrites & returns Tenant A candidate) | `201 Created` (Creates separate Tenant B candidate; Tenant A untouched) |
| `GET /api/v1/tenants/me` & `/api/v1/tenants/team` | `200 OK` (Leaked `hashed_password` & `smtp_password_encrypted`) | `200 OK` (Sensitive fields completely stripped by Pydantic schema) |
| B2C Candidate `GET /api/v1/tenants/team` | `200 OK` (Leaked all B2C users where `tenant_id IS NULL`) | `403 Forbidden` (**Blocked**) |
| `POST /api/v1/users/me/change-password` with wrong password | `200 OK` / `500` (Unawaited coroutine evaluated truthy!) | `400 Bad Request` (`Incorrect current password`) |
| Tenant B Admin `PUT /api/v1/users/{admin_a_id}/role` | `200 OK` (Cross-tenant privilege modification) | `404 Not Found` (**Blocked**) |
| `VIEWER` `POST /api/v1/jobs`, `/companies`, `/candidates` | `200/201` (Allowed write operations) | `403 Forbidden` (**Blocked**) |
| Tenant B `GET /api/v1/campaigns/{camp_a_id}/emails` | `200 OK` (Leaked Tenant A campaign emails) | `404 Not Found` (**Blocked**) |
| ATS config with `https://169.254.169.254/latest/meta-data/` | `200/400` after outbound SSRF request | `400 Bad Request` (Blocked pre-request by IP/host validator) |
| `GET /api/v1/track/fake/click?url=https://evil.example.com` | `307 Redirect` to `https://evil.example.com` | `400 Bad Request` (`Untrusted redirect destination`) |
| `GET /api/v1/candidates/export` with `=HYPERLINK(...)` name | Raw `=HYPERLINK(...)` in CSV cell | Escaped `'=HYPERLINK(...)` in CSV cell |
| `SwarmMemory` cache lookup across Tenant A & Tenant B | Shared key `swarm_cache:{md5}` across all tenants | Isolated keys `swarm_cache:tenant_a:{md5}` vs `swarm_cache:tenant_b:{md5}` |

---

## 8. Unresolved Items and Manual Deployment Actions

The following infrastructure and operational items require manual action by the deployment/DevOps team when promoting to staging or production:

1. **Restrict Host Port Bindings in `docker-compose.yml` / `docker-compose.monitoring.yml` (INFRA-01):**
   - `docker-compose.yml` binds PostgreSQL (`5432:5432`) and Redis (`6379:6379`) to `0.0.0.0`. Bind local development ports to `127.0.0.1:5432:5432` and `127.0.0.1:6379:6379`, and bind Prometheus/Grafana/Alertmanager in `docker-compose.monitoring.yml` to `127.0.0.1` or place them behind Caddy basic/SSO auth.
2. **Enable Redis Password Authentication (`--requirepass`) (INFRA-02):**
   - Both `docker-compose.yml` and `docker-compose.prod.yml` run `redis:7-alpine` without `--requirepass`. Configure `--requirepass ${REDIS_PASSWORD}` and update `REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0`.
3. **Remove Default Grafana Fallback Password in `docker-compose.monitoring.yml` (INFRA-03):**
   - Change `GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD:-<redacted_default>}` to `${GRAFANA_PASSWORD:?GRAFANA_PASSWORD must be set}` so monitoring containers fail closed if `GRAFANA_PASSWORD` is unset.
4. **Block `/metrics` on `api.dvttalent.com` in `Caddyfile` (INFRA-04):**
   - In [`Caddyfile`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/Caddyfile), `api.dvttalent.com` proxies all paths (`reverse_proxy api:8000`), exposing Prometheus `/metrics` publicly. Add `@metrics path /metrics*` with `respond @metrics 403` on the external Caddy vhost so only internal Prometheus scraping can reach `api:8000/metrics`.
5. **Migrate Frontend Token Storage from `localStorage` to Pure `HttpOnly` Cookies (INFRA-05):**
   - [`frontend/src/lib/http.ts`](file:///c:/Users/Lenovo/Downloads/dvt-talent-ai/frontend/src/lib/http.ts) persists `dvt_token` in `localStorage` alongside the backend's `HttpOnly` cookie (`dvt_access_token`). Because the backend already reads `request.cookies.get("dvt_access_token")` and enforces CSRF origin validation (`CSRFMiddleware`), remove `localStorage.setItem("dvt_token", ...)` and use `credentials: "include"` exclusively to eliminate XSS token theft risk.
