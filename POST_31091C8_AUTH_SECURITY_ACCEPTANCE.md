# DVT Talent AI — Post-31091c8 Authentication & MFA Security Acceptance Audit

**Target Commit:** `31091c8` + local blocker-fix working tree on `fix/auth-security-hardening` (uncommitted per no-auto-push safety constraint)  
**Audit Date:** 2026-11-24  
**Verdict:** **`READY FOR STAGING ACCEPTANCE`** (after committing the verified blocker fix below)

---

## 1. Authentication Architecture

DVT Talent AI uses a single unified login interface (`/auth/login`) backed by FastAPI JWT + `HttpOnly` cookie session management (`backend/api/routes/auth.py`, `backend/api/routes/auth_social.py`, `backend/api/routes/team.py`) and Next.js Edge request gating (`frontend/src/proxy.ts`).

- **Identity & Role Model:** Roles are strictly server-determined from PostgreSQL/SQLite (`User.role` in `{candidate, recruiter, manager, admin}` and `User.is_superadmin`). Client-supplied role or superadmin claims are ignored on login, OAuth, and invitation acceptance.
- **Session Transport:** Access (`dvt_token`, `Bearer <jwt>`) and refresh (`dvt_refresh_token`) tokens are issued via `HttpOnly`, `SameSite=Lax`, `Path=/` cookies (`Secure=settings.is_production`). Frontend `auth.service.ts` explicitly removes `localStorage.dvt_token` and never persists JWTs in Web Storage.
- **Authorization Enforcement:** `get_current_user` verifies JWT signature, `type == "access"`, Redis token blocklist (`is_token_revoked`), user-wide revocation timestamp (`is_user_token_revoked`), DB `User.is_active`, and `_ensure_token_privileges_current` (rejecting stale `is_superadmin` or `role` claims). Platform monitoring endpoints independently enforce `Depends(require_superadmin)`.

---

## 2. Token Issuance Paths

| # | Path | Entry Point | Access / Refresh / Cookie Creation |
|---|------|-------------|-------------------------------------|
| 1 | Password login (JSON) | `POST /api/v1/auth/login` | `_extract_login_credentials` -> `build_mfa_gate_if_required`; if `None`, `_build_auth_session_response` + `set_session_cookies` (`dvt_token`, `dvt_refresh_token`). |
| 2 | Password login (form-encoded) | `POST /api/v1/auth/login` | Same as above via `request.form()` (`username` / `email` + `password`). |
| 3 | Password login requiring TOTP | `POST /api/v1/auth/login` | `build_mfa_gate_if_required` returns `200` JSON `{mfa_required: true, challenge_token}` (`type="mfa_challenge"`, 300s). **No session cookies or access/refresh tokens issued.** |
| 4 | Superadmin first-login TOTP enrollment | `POST /api/v1/auth/login` | `build_mfa_gate_if_required` generates/encrypts TOTP secret, returns `{mfa_required: true, mfa_setup_required: true, challenge_token, secret, otpauth_uri}` (`type="mfa_setup"`, 300s). **No session cookies or access/refresh tokens issued.** |
| 5–7 | Google / Microsoft / GitHub OAuth | `GET /api/v1/auth/login/{provider}` -> `/callback/{provider}` | Authlib `authorize_redirect` / `authorize_access_token`; if no MFA gate, `social_callback` creates `create_access_token` + `create_refresh_token`, calls `set_session_cookies`, and `302` redirects to `/auth/callback?redirect=...` (no tokens in URL). |
| 8 | OAuth login requiring TOTP / Superadmin setup | `GET /api/v1/auth/callback/{provider}` | Sets `HttpOnly` `dvt_mfa_challenge` cookie (`max_age=300`) and `302` redirects to `/auth/login?mfa=challenge|setup`. Frontend hydrates state via `GET /api/v1/auth/mfa/pending`. **No session cookies issued.** |
| 9 | MFA challenge completion | `POST /api/v1/auth/mfa/challenge` | Verifies TOTP + revokes challenge token -> `_build_auth_session_response` + `set_session_cookies` (deletes `dvt_mfa_challenge`). |
| 10 | MFA setup completion | `POST /api/v1/auth/mfa/verify-setup` | Verifies TOTP against encrypted secret, sets `mfa_enabled=True`; if invoked with `mfa_setup` token/cookie, revokes it and returns `_build_auth_session_response` + `set_session_cookies` (deletes `dvt_mfa_challenge`). |
| 11 | Invitation acceptance | `POST /api/v1/team/invitations/accept` | Atomic `UPDATE ... WHERE status=PENDING`, binds `role=invitation.role` & `is_superadmin=False`, calls `set_session_cookies`, returns `redirect_to`. |
| 12 | Token refresh | `POST /api/v1/auth/refresh` | Validates `dvt_refresh_token` (`type="refresh"`), checks blocklists & `_ensure_token_privileges_current`, blacklists consumed refresh token (rotation), returns `_build_auth_session_response` + `set_session_cookies`. |
| 13 | Authenticated login-page redirect | `GET /auth/login` or `/auth/register` | `frontend/src/proxy.ts` inspects valid `dvt_token` cookie and `307`/`302` redirects to `safeFrom` or `is_superadmin -> /dashboard/monitoring`, `candidate -> /portal`, else `/dashboard`. |
| 14 | Logout & session invalidation | `POST /api/v1/auth/logout` | Blacklists both access token (`Authorization` or `dvt_token`) and `dvt_refresh_token` in Redis; deletes `dvt_token`, `dvt_refresh_token` (`/` and `/api/v1/auth/refresh`), and `dvt_mfa_challenge`. |

---

## 3. MFA Enforcement Paths

- **Password + OAuth parity:** Both `POST /api/v1/auth/login` (`auth.py:609`) and `GET /api/v1/auth/callback/{provider}` (`auth_social.py:401`) invoke `build_mfa_gate_if_required(user, db)` before issuing any access or refresh tokens.
- **Scoped Token Separation:** `mfa_challenge` and `mfa_setup` tokens carry `"type": "mfa_challenge"` / `"mfa_setup"` and `jti` with 300s expiry. `get_current_user` requires `type == "access"` (`auth.py:300`), and `/refresh` requires `type == "refresh"` (`auth.py:645`).
- **TOTP Replay Protection:** `verify_totp_code` returns the matched 30s counter step and `mark_totp_step_used` marks it consumed in Redis (`auth.py:836, 887`).

---

## 4. Cookie Security Findings

Audited `dvt_mfa_challenge` in `auth_social.py:408-417`, `auth.py:173`, `auth.py:714`, and verified live header output via `test_phase2_mfa_cookie_attributes_and_oauth_redirect`:

- **HttpOnly:** `True` (`HttpOnly` present in `Set-Cookie`).
- **Secure in production:** `secure=settings.is_production` (`Secure` verified present when `settings.is_production=True`).
- **SameSite:** `samesite="lax"` (`SameSite=lax` allows top-level OAuth `GET` callback redirects while blocking cross-site `POST` CSRF).
- **Path / Domain / Expiration:** `path="/"`, host-only (no wildcard domain), `max_age=300`, `expires=300`.
- **Clearing behavior:** Deleted on `set_session_cookies` (`/mfa/challenge`, `/mfa/verify-setup`, `/login`, `/refresh`) and `/logout`.
- **URL / Log / JS isolation:** OAuth MFA redirect uses `/auth/login?mfa=challenge|setup` (no `token` or `challenge_token` in URL); not logged; inaccessible to `document.cookie`.
- **Session rejection:** Rejected (`401`) on protected endpoints (`/api/v1/auth/me`, `/api/v1/monitoring/mediations`).

---

## 5. Challenge Replay and Isolation Findings

Verified via `test_phase3_challenge_isolation_replay_and_rate_limit` (PASS):

- **Cross-user isolation:** User B's TOTP code cannot satisfy User A's challenge (`401`).
- **Expired & forged tokens:** Expired `mfa_challenge` and wrong-key-signed tokens are rejected (`401`).
- **Single-use challenge invalidation:** Successful `/mfa/challenge` calls `_revoke_short_lived_token`; immediate reuse fails (`401`).
- **TOTP replay:** Re-using the same 6-digit TOTP code within the same 30s window against a fresh challenge fails (`401`).
- **Rate limiting:** 5 failed `/mfa/challenge` attempts lock out the user (`429 Too Many Requests`, `Retry-After: 900`).
- **Protected endpoints:** Challenge tokens fail `401` on `/api/v1/auth/me` and `/api/v1/monitoring/mediations`.
- **Live DB privileges:** `/mfa/challenge` and `/mfa/verify-setup` load the live `User` row from DB (`auth.py:818, 881`) before `_build_auth_session_response(user)` builds claims.
- **Minor defense-in-depth note (Resolved):** `_decode_mfa_token` (`auth.py:733-759`) now also checks `is_user_token_revoked(str(user_uuid), claims.get("iat"))`, so password resets or `revoke_user_tokens` invalidate any in-flight `mfa_challenge` / `mfa_setup` tokens.

---

## 6. Superadmin Enrollment Findings

Tested all 7 required Superadmin account states in `audit_post_31091c8.py`:

| State | Result | Details |
|-------|--------|---------|
| 1. Superadmin with enrolled TOTP (`mfa_enabled=True`, secret present) | **PASS** | Returns `mfa_challenge`; full session only after valid TOTP. |
| 2. Superadmin with `mfa_enabled=False` | **PASS** | Returns `mfa_setup_required=True`; inline `/mfa/verify-setup` required before session cookies. |
| 3. **Superadmin with `mfa_enabled=True` AND `mfa_secret_encrypted=None` (or undecryptable secret)** | **PASS (Fixed & Verified)** | **`build_mfa_gate_if_required` (`auth.py:222-254`) decrypts up front, resets `mfa_enabled=False`, provisions a fresh encrypted secret, and forces `mfa_setup_required=True` (non-superadmins fail closed with `401`).** |
| 4. Superadmin during incomplete enrollment | **PASS** | `mfa_setup` token rejected (`401`) on `/api/v1/monitoring/mediations`. |
| 5. Superadmin after interrupted enrollment | **PASS** | Re-login still triggers `mfa_setup_required=True` cleanly. |
| 6. Superadmin after MFA reset (`/mfa/disable`) | **PASS** | Old tokens revoked (`401`); next login forces `mfa_setup_required=True`. |
| 7. Superadmin with expired enrollment challenge | **PASS** | Expired `mfa_setup` rejected (`401`) on `/mfa/verify-setup`. |

---

## 7. OAuth Findings

- **Configured Provider (Google):** `google_client_id` and `google_client_secret` are set in `backend/.env`. Live authorize request `GET /api/v1/auth/login/google` (`test_phase5_oauth_authorize_and_unconfigured_providers`) returned `302` to `https://accounts.google.com/o/oauth2/v2/auth` with `state`, OIDC `nonce`, and `redirect_uri=.../api/v1/auth/callback/google`. Note: Authlib OIDC registration (`auth_social.py:49-55`) relies on `state` + `nonce` + confidential `client_secret`, and does not configure `code_challenge_method="S256"` (PKCE).
- **Unconfigured Providers (Microsoft, GitHub):** `microsoft_client_id`/`secret` and `github_client_id`/`secret` are unset. `GET /api/v1/auth/login/microsoft` safely redirects to `/auth/login?error=oauth_not_configured&provider=microsoft`.
- **Callback Security (code + mocked `authorize_access_token`):**
  - State/nonce validated via Authlib `authorize_access_token` before any DB read/write (`auth_social.py:226`).
  - Verified email required fail-closed (`_select_verified_primary_email`: `email_verified is True` for Google/Microsoft; `verified is True and primary is True` for GitHub).
  - Account collisions (`user.provider != provider`) never auto-link; they issue a 15-minute Redis-nonce-backed `oauth_link` email token and return `409 Conflict`.
  - No role/superadmin claims are accepted from provider `userinfo`.
  - Mandatory TOTP / Superadmin setup gate runs (`auth_social.py:401`) prior to issuing any access/refresh tokens.

---

## 8. Invitation Security Findings

Verified via `team.py:420-569` and `test_phase6_and_7_invitations_and_direct_api_authz` (PASS):

- Invalid/expired/consumed invitations fail (`400`/`404`).
- Request payload `role` / `is_superadmin` overrides are ignored; `User.role` is bound to `invitation.role`, `is_superadmin=False`, and `tenant_id=invitation.tenant_id`.
- Existing user email fails with `409 Conflict` without overwriting privileges.
- 5 concurrent `POST /api/v1/team/invitations/accept` requests yielded **1** `200` and **4** failures (`409`/`400`), preventing duplicate memberships/accounts.
- **Policy Clarification:** Mandatory first-login TOTP enrollment in `build_mfa_gate_if_required` applies to Platform Superadmins (`is_superadmin=True`), not invited tenant `ADMIN` users (`is_superadmin=False`).

---

## 9. Redirect Security Findings

- **Canonical Routing:** Verified `resolve_post_login_redirect` (`auth.py:150-156`) and frontend `resolvePostLoginRoute` (`login/page.tsx:51-73`):
  - Candidate → `/portal`
  - Recruiter → `/dashboard`
  - Workspace ADMIN → `/dashboard`
  - Platform Superadmin → `/dashboard/monitoring`
- **Malicious Redirect Defense:** Both `proxy.ts` and `login/page.tsx` / `callback/page.tsx` enforce `startsWith("/") && !startsWith("//")` (preventing `https://` and protocol-relative `//evil.com` open redirects). Cross-role redirects (candidate requesting `/dashboard`, non-superadmin requesting `/dashboard/monitoring`) are blocked in both `proxy.ts` and `resolvePostLoginRoute`.
- **Direct API Authorization:** Verified via `test_phase6_and_7_invitations_and_direct_api_authz`: direct FastAPI requests to `/api/v1/monitoring/mediations` bypassing Next.js `proxy.ts` return `403` for Candidate, Recruiter, and Tenant Admin, and `200` only for `is_superadmin=True`.

---

## 10. Test Results

### Live Backend + Live Frontend Chromium E2E (`task-2415`, Zero Mocked Auth Routes)
- **Live Stack:** `uvicorn main:app` (`0.0.0.0:8000`, isolated SQLite DB) + `next start` (`localhost:3000`) + headless Chromium:
  - **Candidate login → `/portal` → `GET /api/v1/monitoring/mediations` (`403`) → `POST /api/v1/auth/logout` (`200`) → post-logout cookie replay (`401`):** **PASS**
  - **Recruiter login → `/dashboard` → `GET /api/v1/monitoring/mediations` (`403`) → `POST /api/v1/auth/logout` (`200`):** **PASS**
  - **Superadmin first-login inline 2FA enrollment (real RFC 6238 TOTP from UI secret) → `/dashboard/monitoring` → `GET /api/v1/monitoring/mediations` (`200`) → `POST /api/v1/auth/logout` (`200`) → post-logout cookie replay (`401`):** **PASS**
  - **Superadmin subsequent login TOTP challenge → `/dashboard/monitoring`:** **PASS**

### Offline / In-Process Backend & Adversarial Tests (`task-2304`)
- `ruff check api/routes/auth.py tests/test_auth_security_hardening.py` → **All checks passed!**
- `pytest` across adversarial audit (`audit_post_31091c8.py`, 6 tests) + 6 backend security/auth suites (`test_auth_security_hardening.py`, `test_zero_state_and_auth_contracts.py`, `test_alembic_schema_consistency.py`, `test_auth_social.py`, `test_security_audit_remediations.py`, `test_security_penetration_audit.py`, 43 tests) → **49 passed in 41.23s** (uses SQLite / in-memory Redis doubles).

### Frontend Build & Mocked Playwright Suites (`task-2310`, `task-2390`, `task-2394`)
- `npm run lint && npx tsc --noEmit && npm run build` (`task-2310`) → **passed** (31/31 pages).
- `tests/callback.spec.ts`, `tests/logout-and-middleware.spec.ts`, `tests/framer_motion_audit.spec.ts` (`task-2390`) → **6 passed (12.1s)** (mocked auth APIs).
- `tests/auth.spec.ts -g "renders unified|redirects from dashboard|streams candidate"` (`task-2394`) → **3 passed (33.8s)** (mocked auth APIs).

---

## 11. Untested Cases & Unavailable Credentials

- **Live End-to-End Google OAuth Callback:** Client ID/secret are present in `.env` and the `302` authorize redirect to `accounts.google.com` was verified, but an interactive Google account sign-in in a headless browser was not run.
- **Microsoft & GitHub Live OAuth Round-Trips:** Unverified (client ID/secret credentials unavailable in `.env`).
- **Staging PostgreSQL + Redis Cluster:** Automated tests ran against SQLite + in-memory Redis doubles rather than staging PostgreSQL/Redis instances.

---

## 12. Exact Defects & Remediation Recommendations

### Blocker 1 (High — FIXED & VERIFIED) — Superadmin MFA Bypass When `mfa_enabled=True` Without Valid Secret
- **Location:** `backend/api/routes/auth.py:222-254` (`build_mfa_gate_if_required`)
- **Resolution:** Decrypted `mfa_secret_encrypted` up front; when `is_superadmin=True` and no valid decrypted secret exists (whether `mfa_enabled=False` or `True`), `mfa_enabled` is reset to `False`, a fresh encrypted TOTP secret is provisioned, and `mfa_setup_required=True` is enforced. Non-superadmins with `mfa_enabled=True` and missing/corrupt secret now fail closed with `401`. Verified via `test_phase4_superadmin_state3_missing_secret` and `test_mfa_gate_fail_closed_and_challenge_user_revocation`.

### Hardening 1 (Low — FIXED & VERIFIED) — User-Level Token Revocation Check on Pending MFA Tokens
- **Location:** `backend/api/routes/auth.py:733-759` (`_decode_mfa_token`)
- **Resolution:** Added `is_user_token_revoked(str(user_uuid), claims.get("iat"))` check. Verified via `test_mfa_gate_fail_closed_and_challenge_user_revocation`.

### Hardening 2 (Low — FIXED & VERIFIED) — Backslash Guard on Frontend Redirect Sanitizers & PKCE Note
- **Location:** `frontend/src/app/auth/login/page.tsx:55-60`, `frontend/src/app/auth/callback/page.tsx:30-35`, `frontend/src/proxy.ts:41-42`
- **Resolution:** Added `!val.includes("\\")` to redirect sanitizers. Remaining optional enhancement: add `code_challenge_method="S256"` (PKCE) to OAuth client kwargs in `backend/api/routes/auth_social.py`.
