"""
Test D: Concurrent Database Operations & Cross-Tenant Isolation
Simulates 50 concurrent authenticated users across 5 corporate tenants performing:
- Concurrent candidate searches and listings
- Concurrent candidate updates / notes / status updates
- Verification of ZERO cross-tenant data leakage (Tenant Alpha cannot read Tenant Beta data)
- Verification of ZERO database deadlocks or SQLite locked errors
"""
import asyncio
import json
import time
import uuid

import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"
USERS = [f"perf_user_{i:02d}@loadtest.dvt.com" for i in range(1, 51)]
PASSWORD = "PerfPass123!"

async def login_user(client: httpx.AsyncClient, email: str) -> dict:
    resp = await client.post(
        f"{BASE_URL}/auth/login",
        data={"username": email, "password": PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10.0
    )
    if resp.status_code == 200:
        data = resp.json()
        return {
            "email": email,
            "token": data.get("access_token"),
            "tenant_id": data.get("tenant_id"),
            "user_id": data.get("user_id"),
        }
    return {"email": email, "token": None, "error": resp.text}

async def user_db_workflow(client: httpx.AsyncClient, user_info: dict, run_idx: int) -> dict:
    email = user_info["email"]
    token = user_info["token"]
    tenant_id = user_info["tenant_id"]
    headers = {"Authorization": f"Bearer {token}"}
    
    workflow_results = {
        "email": email,
        "tenant_id": tenant_id,
        "queries_success": 0,
        "mutations_success": 0,
        "isolation_violations": 0,
        "deadlocks": 0,
        "errors": []
    }

    # 1. Fetch Candidate List
    try:
        resp = await client.get(f"{BASE_URL}/candidates?page=1&limit=20", headers=headers, timeout=10.0)
        if resp.status_code == 200:
            cands = resp.json().get("items", [])
            workflow_results["queries_success"] += 1
            # Check tenant isolation on candidate list
            for c in cands:
                c_tenant = c.get("tenant_id")
                if c_tenant and tenant_id and str(c_tenant) != str(tenant_id):
                    workflow_results["isolation_violations"] += 1
                    workflow_results["errors"].append(f"Leakage in candidate list: seen {c_tenant} vs {tenant_id}")
        else:
            workflow_results["errors"].append(f"Candidate list failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        if "locked" in str(e).lower() or "deadlock" in str(e).lower():
            workflow_results["deadlocks"] += 1
        workflow_results["errors"].append(f"Candidate list exc: {str(e)}")

    # 2. Search Jobs
    try:
        resp = await client.get(f"{BASE_URL}/jobs?keyword=Engineer", headers=headers, timeout=10.0)
        if resp.status_code == 200:
            workflow_results["queries_success"] += 1
        else:
            workflow_results["errors"].append(f"Jobs search failed: {resp.status_code}")
    except Exception as e:
        workflow_results["errors"].append(f"Jobs search exc: {str(e)}")

    # 3. Create a Synthetic Candidate Record for this tenant
    created_cand_id = None
    try:
        unique_cand_email = f"lead_{uuid.uuid4().hex[:8]}@perf-test.com"
        cand_payload = {
            "first_name": f"PerfCand_{run_idx}",
            "last_name": "TestSubject",
            "email": unique_cand_email,
            "title": "Senior Reliability Engineer",
            "location": "Remote",
            "status": "sourced"
        }
        resp = await client.post(f"{BASE_URL}/candidates", json=cand_payload, headers=headers, timeout=10.0)
        if resp.status_code in [200, 201]:
            workflow_results["mutations_success"] += 1
            created_cand_id = resp.json().get("id")
        else:
            workflow_results["errors"].append(f"Candidate create failed: {resp.status_code} - {resp.text}")
    except Exception as e:
        if "locked" in str(e).lower() or "deadlock" in str(e).lower():
            workflow_results["deadlocks"] += 1
        workflow_results["errors"].append(f"Candidate create exc: {str(e)}")

    # 4. If created, update that candidate record
    if created_cand_id:
        try:
            resp = await client.patch(f"{BASE_URL}/candidates/{created_cand_id}/status?status=contacted", headers=headers, timeout=10.0)
            if resp.status_code == 200:
                workflow_results["mutations_success"] += 1
            else:
                workflow_results["errors"].append(f"Candidate update failed: {resp.status_code} - {resp.text}")
        except Exception as e:
            if "locked" in str(e).lower() or "deadlock" in str(e).lower():
                workflow_results["deadlocks"] += 1
            workflow_results["errors"].append(f"Candidate update exc: {str(e)}")

    return workflow_results

async def run_concurrent_db_test():
    print("=" * 60)
    print("RUNNING TEST D: Concurrent Database Operations & Tenant Isolation")
    print("=" * 60)

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100, max_keepalive_connections=50)) as client:
        # Phase 1: Log in all 50 users
        print("Logging in 50 synthetic users...")
        login_tasks = [login_user(client, email) for email in USERS]
        users = await asyncio.gather(*login_tasks)
        authenticated_users = [u for u in users if u["token"]]
        print(f"Authenticated {len(authenticated_users)}/50 users successfully.")
        assert len(authenticated_users) == 50, "All 50 users must be authenticated"

        # Phase 2: Fire concurrent database operations simultaneously
        print("\nFiring 50 concurrent DB workflows (reads, inserts, updates, isolation checks)...")
        t0 = time.perf_counter()
        db_tasks = [user_db_workflow(client, u, i) for i, u in enumerate(authenticated_users)]
        results = await asyncio.gather(*db_tasks)
        duration = time.perf_counter() - t0

        # Phase 3: Cross-tenant attack simulation
        # Pick User 0 (Tenant Alpha) and User 15 (Tenant Beta)
        # Attempt to read each other's candidate by ID directly
        user_alpha = authenticated_users[0]
        user_beta = authenticated_users[15]
        print("\nVerifying Cross-Tenant Security:")
        print(f"  User Alpha Tenant: {user_alpha['tenant_id']}")
        print(f"  User Beta Tenant:  {user_beta['tenant_id']}")

        # Fetch Alpha's candidates
        alpha_headers = {"Authorization": f"Bearer {user_alpha['token']}"}
        beta_headers = {"Authorization": f"Bearer {user_beta['token']}"}
        resp = await client.get(f"{BASE_URL}/candidates?page=1&page_size=5", headers=alpha_headers)
        alpha_cands = resp.json().get("items", []) if resp.status_code == 200 else []
        
        leakage_detected = False
        if alpha_cands:
            target_cand_id = alpha_cands[0]["id"]
            # Beta tries to read Alpha's candidate
            attack_resp = await client.get(f"{BASE_URL}/candidates/{target_cand_id}", headers=beta_headers)
            print(f"  Beta GET Alpha Candidate ({target_cand_id}) -> Status {attack_resp.status_code}")
            if attack_resp.status_code == 200:
                print("  [CRITICAL SECURITY ALERT] Cross-tenant leakage! Beta accessed Alpha's candidate!")
                leakage_detected = True
            else:
                print("  [SUCCESS] Cross-tenant access properly blocked (HTTP 404/403).")

        total_queries = sum(r["queries_success"] for r in results)
        total_mutations = sum(r["mutations_success"] for r in results)
        total_deadlocks = sum(r["deadlocks"] for r in results)
        total_isolation_violations = sum(r["isolation_violations"] for r in results) + (1 if leakage_detected else 0)
        all_errors = [e for r in results for e in r["errors"]]

        report = {
            "scenario": "Test D: Concurrent Database Operations & Isolation",
            "duration_sec": round(duration, 2),
            "concurrent_users": 50,
            "total_queries_succeeded": total_queries,
            "total_mutations_succeeded": total_mutations,
            "deadlocks_detected": total_deadlocks,
            "cross_tenant_isolation_violations": total_isolation_violations,
            "errors_count": len(all_errors),
            "errors_sample": all_errors[:5]
        }

        print("\n--- TEST D RESULTS ---")
        print(f"Duration: {report['duration_sec']}s")
        print(f"Queries Succeeded: {total_queries}/100")
        print(f"Mutations Succeeded: {total_mutations}/100")
        print(f"Deadlocks Detected: {total_deadlocks}")
        print(f"Cross-Tenant Data Leakage: {total_isolation_violations}")
        if all_errors:
            print(f"Errors ({len(all_errors)}): {all_errors[:3]}")

        with open("test_d_results.json", "w") as fp:
            json.dump(report, fp, indent=2)

        return report

if __name__ == "__main__":
    asyncio.run(run_concurrent_db_test())
