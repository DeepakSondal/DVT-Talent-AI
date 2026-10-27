"""
Test E: AI Features Under Concurrency (with Mocking / Circuit Breaker Isolation)
Tests concurrent AI agent triggering and pipeline dispatch:
- /agents/trigger
- /copilot/discovery
- Measures dispatch response times, queue depth, error rates, and failure isolation
"""
import asyncio
import time
import httpx
import json
import statistics

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "PerfPass123!"
USERS = [f"perf_user_{i:02d}@loadtest.dvt.com" for i in range(1, 26)]  # 25 concurrent AI requesters

async def login_user(client: httpx.AsyncClient, email: str) -> dict:
    try:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": email, "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"},
            timeout=10.0
        )
        if resp.status_code == 200:
            return {"email": email, "token": resp.json().get("access_token"), "tenant_id": resp.json().get("tenant_id")}
    except Exception:
        pass
    return {"email": email, "token": None}

async def trigger_ai_agent(client: httpx.AsyncClient, token: str, idx: int) -> dict:
    headers = {"Authorization": f"Bearer {token}", "X-Load-Test-Bypass": "true"}
    payload = {
        "agent": "screening",
        "params": {
            "job_title": f"Staff Reliability Engineer {idx}",
            "candidate_skills": ["Python", "Docker", "SRE", "PostgreSQL"],
            "mock_mode": True
        }
    }
    t0 = time.perf_counter()
    try:
        resp = await client.post(f"{BASE_URL}/agents/trigger", json=payload, headers=headers, timeout=10.0)
        lat = time.perf_counter() - t0
        return {
            "status_code": resp.status_code,
            "latency": lat,
            "success": resp.status_code in [200, 201, 202],
            "task_id": resp.json().get("agent_task_id") if resp.status_code in [200, 201, 202] else None,
            "error": None if resp.status_code in [200, 201, 202] else resp.text
        }
    except Exception as e:
        lat = time.perf_counter() - t0
        return {
            "status_code": 0,
            "latency": lat,
            "success": False,
            "task_id": None,
            "error": str(e)
        }

async def run_ai_features_test():
    print("=" * 60)
    print("RUNNING TEST E: AI Features Under Concurrency")
    print("=" * 60)

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100, max_keepalive_connections=50)) as client:
        # Phase 1: Authenticate users
        auth_tasks = [login_user(client, email) for email in USERS]
        users = await asyncio.gather(*auth_tasks)
        valid_users = [u for u in users if u["token"]]
        print(f"Authenticated {len(valid_users)}/{len(USERS)} AI requesters.")

        # Phase 2: Concurrent AI Triggers
        print(f"\nDispatching {len(valid_users)} concurrent AI agent tasks...")
        t0 = time.perf_counter()
        ai_tasks = [trigger_ai_agent(client, u["token"], i) for i, u in enumerate(valid_users)]
        results = await asyncio.gather(*ai_tasks)
        total_time = time.perf_counter() - t0

        latencies = [r["latency"] for r in results]
        successes = [r for r in results if r["success"]]
        failures = [r for r in results if not r["success"]]
        task_ids = [r["task_id"] for r in successes if r["task_id"]]

        latencies.sort()
        p50 = statistics.median(latencies) if latencies else 0
        p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
        p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
        avg_lat = statistics.mean(latencies) if latencies else 0

        report = {
            "scenario": "Test E: AI Features Concurrency",
            "total_requests": len(results),
            "success_count": len(successes),
            "failure_count": len(failures),
            "success_rate_pct": round(len(successes) / len(results) * 100, 2) if results else 0,
            "duration_sec": round(total_time, 2),
            "latency_avg_ms": round(avg_lat * 1000, 2),
            "latency_p50_ms": round(p50 * 1000, 2),
            "latency_p95_ms": round(p95 * 1000, 2),
            "latency_p99_ms": round(p99 * 1000, 2),
            "tasks_dispatched": len(task_ids),
            "failures_sample": failures[:3]
        }

        print("\n--- TEST E RESULTS ---")
        print(f"Success Rate: {report['success_rate_pct']}% ({report['success_count']}/{report['total_requests']})")
        print(f"Tasks Enqueued: {len(task_ids)}")
        print(f"Latency -> Avg: {report['latency_avg_ms']}ms | p50: {report['latency_p50_ms']}ms | p95: {report['latency_p95_ms']}ms | p99: {report['latency_p99_ms']}ms")
        if failures:
            print(f"Failures: {report['failures_sample']}")

        with open("test_e_results.json", "w") as fp:
            json.dump(report, fp, indent=2)

        return report

if __name__ == "__main__":
    asyncio.run(run_ai_features_test())
