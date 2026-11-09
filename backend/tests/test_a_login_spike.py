"""
Test A: Login Spike
50 independent users attempt to log in within 10 seconds.
Measures:
- Successful login rate
- Failed login rate
- Response times (min, avg, p50, p95, p99, max)
- HTTP status code distribution (200, 429, 500, etc.)
- CPU and RAM utilization
- Authentication and database connection errors
"""
import asyncio
import json
import statistics
import time

import httpx
import psutil

BASE_URL = "http://127.0.0.1:8000/api/v1"
USERS = [f"perf_user_{i:02d}@loadtest.dvt.com" for i in range(1, 51)]
PASSWORD = "PerfPass123!"

async def attempt_login(client: httpx.AsyncClient, email: str, delay: float) -> dict:
    if delay > 0:
        await asyncio.sleep(delay)
    t0 = time.perf_counter()
    status_code = None
    error = None
    token = None
    try:
        data = {"username": email, "password": PASSWORD}
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15.0
        )
        status_code = resp.status_code
        latency = time.perf_counter() - t0
        if status_code == 200:
            token = resp.json().get("access_token")
        else:
            try:
                error = resp.json()
            except Exception:
                error = resp.text
        return {
            "email": email,
            "status_code": status_code,
            "latency": latency,
            "success": status_code == 200,
            "error": error,
            "has_token": bool(token)
        }
    except Exception as e:
        latency = time.perf_counter() - t0
        return {
            "email": email,
            "status_code": 0,
            "latency": latency,
            "success": False,
            "error": str(e),
            "has_token": False
        }

async def run_login_spike(stagger_total_seconds: float = 10.0):
    print("=" * 60)
    print(f"RUNNING TEST A: 50 Concurrent User Login Spike ({stagger_total_seconds}s window)")
    print("=" * 60)

    process = psutil.Process()
    cpu_before = psutil.cpu_percent(interval=None)
    mem_before = process.memory_info().rss / (1024 * 1024)

    # Distribute 50 logins evenly over 10 seconds
    delays = [i * (stagger_total_seconds / len(USERS)) for i in range(len(USERS))]

    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=100, max_keepalive_connections=50)) as client:
        start_time = time.perf_counter()
        tasks = [
            attempt_login(client, email, delays[i])
            for i, email in enumerate(USERS)
        ]
        results = await asyncio.gather(*tasks)
        total_duration = time.perf_counter() - start_time

    cpu_after = psutil.cpu_percent(interval=None)
    mem_after = process.memory_info().rss / (1024 * 1024)

    successes = [r for r in results if r["success"]]
    failures = [r for r in results if not r["success"]]
    latencies = [r["latency"] for r in results]
    status_counts = {}
    for r in results:
        code = r["status_code"]
        status_counts[code] = status_counts.get(code, 0) + 1

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    avg_latency = statistics.mean(latencies) if latencies else 0

    report = {
        "scenario": "Test A: Login Spike",
        "total_users": len(USERS),
        "total_duration_sec": round(total_duration, 2),
        "success_count": len(successes),
        "failure_count": len(failures),
        "success_rate_pct": round((len(successes) / len(USERS)) * 100, 2),
        "status_distribution": status_counts,
        "latency_min_sec": round(min(latencies), 3) if latencies else 0,
        "latency_avg_sec": round(avg_latency, 3),
        "latency_p50_sec": round(p50, 3),
        "latency_p95_sec": round(p95, 3),
        "latency_p99_sec": round(p99, 3),
        "latency_max_sec": round(max(latencies), 3) if latencies else 0,
        "ram_start_mb": round(mem_before, 2),
        "ram_end_mb": round(mem_after, 2),
        "cpu_before_pct": cpu_before,
        "cpu_after_pct": cpu_after,
        "failures_sample": failures[:5]
    }

    print("\n--- RESULTS ---")
    print(f"Total Requests: {len(USERS)}")
    print(f"Successes: {report['success_count']} ({report['success_rate_pct']}%)")
    print(f"Failures: {report['failure_count']}")
    print(f"Status Codes: {status_counts}")
    print(f"Latency Avg: {report['latency_avg_sec']}s | p50: {report['latency_p50_sec']}s | p95: {report['latency_p95_sec']}s | p99: {report['latency_p99_sec']}s | Max: {report['latency_max_sec']}s")
    if failures:
        print("\nFailure Sample:")
        for f in failures[:5]:
            print(f"  User: {f['email']} -> Code: {f['status_code']} -> Error: {f['error']}")

    with open("test_a_results.json", "w") as fp:
        json.dump(report, fp, indent=2)

    return report

if __name__ == "__main__":
    asyncio.run(run_login_spike())
