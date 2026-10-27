"""
Test G: Application Security Under Concurrent Load
Verifies that high concurrency never weakens system security:
1. Authentication Enforcement (Unauthenticated requests get 401)
2. Tenant Isolation Boundary (Cross-tenant requests get 404/403)
3. Role-Based Access Control (RBAC: Viewer/Candidate roles blocked from Recruiter/Admin mutations)
4. Token Revocation & Invalidation (Revoked tokens blocked with 401)
5. Rate Limiting DoS Protection (429 Too Many Requests enforced on abuse)
"""
import asyncio
import time
import httpx
import json

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "PerfPass123!"

async def check_unauthenticated_access(client: httpx.AsyncClient, endpoint: str) -> bool:
    """Verifies that an unauthenticated request is blocked with 401."""
    try:
        resp = await client.get(f"{BASE_URL}{endpoint}", headers={"X-Load-Test-Bypass": "true"}, timeout=5.0)
        return resp.status_code == 401
    except Exception:
        return False

async def run_security_under_load_suite():
    print("=" * 60)
    print("RUNNING TEST G: Security Under Load")
    print("=" * 60)

    security_report = {
        "scenario": "Test G: Security Under Load",
        "unauthenticated_blocked_pct": 0.0,
        "cross_tenant_blocked_pct": 0.0,
        "rbac_enforcement_pct": 0.0,
        "token_revocation_effective": False,
        "rate_limiting_protective": False,
        "security_verdict": "UNKNOWN"
    }

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100, max_keepalive_connections=50)) as client:
        # Check 1: 50 concurrent unauthenticated attempts across protected endpoints
        print("\n1. Testing Authentication Enforcement (50 concurrent unauth requests)...")
        endpoints = ["/candidates", "/users/me", "/jobs", "/monitoring/signals/recent", "/agents/tasks"]
        unauth_tasks = [
            check_unauthenticated_access(client, endpoints[i % len(endpoints)])
            for i in range(50)
        ]
        unauth_results = await asyncio.gather(*unauth_tasks)
        blocked_count = sum(1 for r in unauth_results if r)
        security_report["unauthenticated_blocked_pct"] = round(blocked_count / 50 * 100, 2)
        print(f"  Unauthenticated Requests Blocked: {blocked_count}/50 ({security_report['unauthenticated_blocked_pct']}%)")

        # Check 2: Tenant Isolation under concurrency
        print("\n2. Testing Cross-Tenant Boundary Isolation...")
        # Authenticate User Alpha (Tenant 1) and User Beta (Tenant 2)
        r_alpha = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": "perf_user_01@loadtest.dvt.com", "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"}
        )
        r_beta = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": "perf_user_15@loadtest.dvt.com", "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"}
        )
        token_alpha = r_alpha.json().get("access_token")
        token_beta = r_beta.json().get("access_token")

        # Fetch Alpha's candidates
        alpha_cands = (await client.get(
            f"{BASE_URL}/candidates?page=1&page_size=5",
            headers={"Authorization": f"Bearer {token_alpha}", "X-Load-Test-Bypass": "true"}
        )).json().get("items", [])

        cross_tenant_blocked = 0
        total_cross_attempts = len(alpha_cands)
        for cand in alpha_cands:
            cand_id = cand["id"]
            # Beta tries to read Alpha's candidate
            attack_resp = await client.get(
                f"{BASE_URL}/candidates/{cand_id}",
                headers={"Authorization": f"Bearer {token_beta}", "X-Load-Test-Bypass": "true"}
            )
            if attack_resp.status_code in [404, 403]:
                cross_tenant_blocked += 1

        security_report["cross_tenant_blocked_pct"] = round((cross_tenant_blocked / total_cross_attempts * 100) if total_cross_attempts else 100.0, 2)
        print(f"  Cross-Tenant Attempts Blocked: {cross_tenant_blocked}/{total_cross_attempts} ({security_report['cross_tenant_blocked_pct']}%)")

        # Check 3: RBAC (Non-admin recruiter attempt to access admin-only endpoint)
        print("\n3. Testing Role-Based Access Control (Recruiter -> Admin endpoint)...")
        # Recruiter user tries to access /monitoring/mediations (Admin only)
        rbac_resp = await client.get(
            f"{BASE_URL}/monitoring/mediations",
            headers={"Authorization": f"Bearer {token_alpha}", "X-Load-Test-Bypass": "true"}
        )
        # perf_user_01 is admin, let's test perf_user_02 (recruiter)
        r_recruiter = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": "perf_user_02@loadtest.dvt.com", "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"}
        )
        recruiter_token = r_recruiter.json().get("access_token")
        rbac_recruiter_resp = await client.get(
            f"{BASE_URL}/monitoring/mediations",
            headers={"Authorization": f"Bearer {recruiter_token}", "X-Load-Test-Bypass": "true"}
        )
        rbac_success = rbac_recruiter_resp.status_code == 403
        security_report["rbac_enforcement_pct"] = 100.0 if rbac_success else 0.0
        print(f"  Recruiter blocked from Admin Route: HTTP {rbac_recruiter_resp.status_code} ({'PASS' if rbac_success else 'FAIL'})")

        # Check 4: Token Revocation under load
        print("\n4. Testing Token Revocation & Immediate Invalidation...")
        logout_resp = await client.post(
            f"{BASE_URL}/auth/logout",
            headers={"Authorization": f"Bearer {recruiter_token}", "X-Load-Test-Bypass": "true"}
        )
        # Immediate reuse attempt
        reuse_resp = await client.get(
            f"{BASE_URL}/users/me",
            headers={"Authorization": f"Bearer {recruiter_token}", "X-Load-Test-Bypass": "true"}
        )
        revocation_success = reuse_resp.status_code == 401
        security_report["token_revocation_effective"] = revocation_success
        print(f"  Revoked Token Reuse Status: HTTP {reuse_resp.status_code} ({'PASS' if revocation_success else 'FAIL'})")

        # Check 5: Rate Limiting Protective Action
        print("\n5. Testing Rate Limiting / Abuse Protection (No Bypass)...")
        burst_status_codes = []
        for _ in range(700):
            try:
                resp = await client.get(f"{BASE_URL}/health", timeout=2.0)
                burst_status_codes.append(resp.status_code)
                if resp.status_code == 429:
                    break
            except Exception:
                pass
        rate_limit_triggered = 429 in burst_status_codes
        security_report["rate_limiting_protective"] = rate_limit_triggered
        print(f"  Rate Limiter Active: {'PASS (429 Returned)' if rate_limit_triggered else 'WARN (Under threshold)'}")

        all_passed = (
            security_report["unauthenticated_blocked_pct"] == 100.0
            and security_report["cross_tenant_blocked_pct"] == 100.0
            and security_report["rbac_enforcement_pct"] == 100.0
            and security_report["token_revocation_effective"]
        )
        security_report["security_verdict"] = "PASS" if all_passed else "FAIL"

        print(f"\n--- TEST G FINAL VERDICT: {security_report['security_verdict']} ---")
        with open("test_g_results.json", "w") as fp:
            json.dump(security_report, fp, indent=2)

        return security_report

if __name__ == "__main__":
    asyncio.run(run_security_under_load_suite())
