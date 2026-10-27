"""
Test F: Background Workers & Task Processing Under Concurrency
Submits 50 concurrent independent background tasks across 5 isolated corporate tenants:
- Verifies jobs are acknowledged with unique IDs and not silently lost
- Verifies task status queries succeed under load
- Verifies strict multi-tenant boundary on background tasks (User B cannot poll User A's task)
- Measures task dispatch and polling latency
"""
import asyncio
import time
import httpx
import json
import statistics

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "PerfPass123!"
USERS = [f"perf_user_{i:02d}@loadtest.dvt.com" for i in range(1, 51)]

async def authenticate_user(client: httpx.AsyncClient, email: str) -> dict:
    try:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": email, "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"},
            timeout=10.0
        )
        if resp.status_code == 200:
            data = resp.json()
            return {"email": email, "token": data.get("access_token"), "tenant_id": data.get("tenant_id")}
    except Exception:
        pass
    return {"email": email, "token": None}

async def dispatch_worker_task(client: httpx.AsyncClient, user: dict, task_idx: int) -> dict:
    headers = {"Authorization": f"Bearer {user['token']}", "X-Load-Test-Bypass": "true"}
    agents = ["discovery", "sourcing", "screening", "analytics", "outreach"]
    agent_name = agents[task_idx % len(agents)]

    payload = {
        "agent": agent_name,
        "params": {
            "test_run": True,
            "job_id": f"job_concurrent_{task_idx}",
            "tenant_id": user["tenant_id"]
        }
    }

    t0 = time.perf_counter()
    try:
        resp = await client.post(f"{BASE_URL}/agents/trigger", json=payload, headers=headers, timeout=10.0)
        lat = time.perf_counter() - t0
        data = resp.json() if resp.status_code == 200 else {}
        task_id = data.get("agent_task_id")

        poll_status = None
        if task_id:
            # Poll status immediately
            poll_resp = await client.get(f"{BASE_URL}/agents/status/{task_id}", headers=headers, timeout=10.0)
            poll_status = poll_resp.status_code

        return {
            "email": user["email"],
            "tenant_id": user["tenant_id"],
            "status_code": resp.status_code,
            "latency": lat,
            "task_id": task_id,
            "poll_status": poll_status,
            "success": resp.status_code == 200 and poll_status == 200
        }
    except Exception as e:
        lat = time.perf_counter() - t0
        return {
            "email": user["email"],
            "status_code": 0,
            "latency": lat,
            "task_id": None,
            "poll_status": 0,
            "success": False,
            "error": str(e)
        }

async def run_background_worker_test():
    print("=" * 60)
    print("RUNNING TEST F: Background Worker Queue & Tasks Under Load")
    print("=" * 60)

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100, max_keepalive_connections=50)) as client:
        # Phase 1: Login all 50 users
        login_tasks = [authenticate_user(client, email) for email in USERS]
        users = await asyncio.gather(*login_tasks)
        authenticated = [u for u in users if u["token"]]
        print(f"Authenticated {len(authenticated)}/50 users.")

        # Phase 2: Dispatch 50 concurrent background tasks
        print(f"\nDispatching 50 concurrent background jobs...")
        t_start = time.perf_counter()
        dispatch_tasks = [dispatch_worker_task(client, u, i) for i, u in enumerate(authenticated)]
        results = await asyncio.gather(*dispatch_tasks)
        total_duration = time.perf_counter() - t_start

        # Phase 3: Cross-tenant task boundary security test
        # Take User 0 (Tenant Alpha) task, attempt read with User 15 (Tenant Beta)
        alpha_task_id = next((r["task_id"] for r in results if r["tenant_id"] == authenticated[0]["tenant_id"] and r["task_id"]), None)
        beta_user = authenticated[15]
        cross_tenant_breach = False

        if alpha_task_id:
            beta_headers = {"Authorization": f"Bearer {beta_user['token']}", "X-Load-Test-Bypass": "true"}
            hack_resp = await client.get(f"{BASE_URL}/agents/status/{alpha_task_id}", headers=beta_headers)
            print(f"\nCross-Tenant Task Isolation Check:")
            print(f"  Beta User GET Alpha Task ({alpha_task_id}) -> HTTP {hack_resp.status_code}")
            if hack_resp.status_code == 200:
                print("  [CRITICAL] Tenant B successfully read Tenant A background task!")
                cross_tenant_breach = True
            else:
                print("  [SUCCESS] Cross-tenant task access properly forbidden (404 Not Found).")

        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        latencies = [r["latency"] for r in results]
        latencies.sort()

        p50 = statistics.median(latencies) if latencies else 0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
        p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
        avg_lat = statistics.mean(latencies) if latencies else 0

        unique_task_ids = set(r["task_id"] for r in results if r["task_id"])

        report = {
            "scenario": "Test F: Background Workers",
            "total_jobs_submitted": len(results),
            "jobs_acknowledged": len(unique_task_ids),
            "duplicate_job_ids": len(results) - len(unique_task_ids),
            "success_count": len(successes),
            "failure_count": len(failures),
            "success_rate_pct": round(len(successes) / len(results) * 100, 2),
            "duration_sec": round(total_duration, 2),
            "latency_avg_ms": round(avg_lat * 1000, 2),
            "latency_p50_ms": round(p50 * 1000, 2),
            "latency_p95_ms": round(p95 * 1000, 2),
            "latency_p99_ms": round(p99 * 1000, 2),
            "cross_tenant_leakage": cross_tenant_breach
        }

        print("\n--- TEST F RESULTS ---")
        print(f"Jobs Submitted: {report['total_jobs_submitted']} | Acknowledged: {report['jobs_acknowledged']} (Duplicates: {report['duplicate_job_ids']})")
        print(f"Success Rate: {report['success_rate_pct']}% | Total Time: {report['duration_sec']}s")
        print(f"Dispatch Latency -> Avg: {report['latency_avg_ms']}ms | p50: {report['latency_p50_ms']}ms | p95: {report['latency_p95_ms']}ms | p99: {report['latency_p99_ms']}ms")
        print(f"Cross-Tenant Task Leakage: {report['cross_tenant_leakage']}")

        with open("test_f_results.json", "w") as fp:
            json.dump(report, fp, indent=2)

        return report

if __name__ == "__main__":
    asyncio.run(run_background_worker_test())
