"""
Test C: Traffic Spike & Capacity Saturation Ramp-Up
Tests stages: 5 -> 10 -> 25 -> 50 -> 75 -> 100 concurrent users.
Measures:
- Requests per second (Throughput)
- Latency (avg, p50, p95, p99)
- Success and Error rates
- Identifies the saturation inflection point
"""
import asyncio
import json
import statistics
import time

import httpx

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "PerfPass123!"

async def authenticate_user(client: httpx.AsyncClient, user_idx: int) -> dict:
    email = f"perf_user_{(user_idx % 50) + 1:02d}@loadtest.dvt.com"
    try:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": email, "password": PASSWORD},
            headers={
                "Content-Type": "application/x-www-form-urlencoded",
                "X-Load-Test-Bypass": "true"
            },
            timeout=10.0
        )
        if resp.status_code == 200:
            return {"email": email, "token": resp.json().get("access_token")}
    except Exception:
        pass
    return {"email": email, "token": None}

async def user_request_loop(client: httpx.AsyncClient, token: str, duration_sec: float) -> list:
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Load-Test-Bypass": "true"
    }
    latencies = []
    status_codes = []
    endpoints = [
        "/jobs?page=1&page_size=10",
        "/candidates?page=1&page_size=10",
        "/monitoring/signals/recent?limit=10",
    ]
    t_end = time.perf_counter() + duration_sec
    req_idx = 0

    while time.perf_counter() < t_end:
        ep = endpoints[req_idx % len(endpoints)]
        req_idx += 1
        t0 = time.perf_counter()
        try:
            resp = await client.get(f"{BASE_URL}{ep}", headers=headers, timeout=10.0)
            lat = time.perf_counter() - t0
            latencies.append(lat)
            status_codes.append(resp.status_code)
        except Exception:
            lat = time.perf_counter() - t0
            latencies.append(lat)
            status_codes.append(0)
        # Realistic pacing between user clicks (100ms - 250ms)
        await asyncio.sleep(0.15)

    return {"latencies": latencies, "status_codes": status_codes}

async def run_stage(concurrency: int, stage_duration_sec: float = 8.0) -> dict:
    print(f"\n--- Testing Stage: {concurrency} Concurrent Users ---")
    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=200, max_keepalive_connections=100)) as client:
        # 1. Login phase
        login_tasks = [authenticate_user(client, i) for i in range(concurrency)]
        auth_results = await asyncio.gather(*login_tasks)
        valid_users = [u for u in auth_results if u["token"]]

        if len(valid_users) < concurrency:
            print(f"Warning: Only {len(valid_users)}/{concurrency} users authenticated successfully.")

        # 2. Sustained traffic phase
        t_start = time.perf_counter()
        worker_tasks = [
            user_request_loop(client, u["token"], stage_duration_sec)
            for u in valid_users
        ]
        results = await asyncio.gather(*worker_tasks)
        actual_duration = time.perf_counter() - t_start

        all_latencies = []
        all_status_codes = []
        for r in results:
            all_latencies.extend(r["latencies"])
            all_status_codes.extend(r["status_codes"])

        total_requests = len(all_latencies)
        successes = sum(1 for c in all_status_codes if c == 200)
        failures = total_requests - successes
        rps = total_requests / actual_duration if actual_duration > 0 else 0

        all_latencies.sort()
        p50 = statistics.median(all_latencies) if all_latencies else 0
        p95 = all_latencies[int(len(all_latencies) * 0.95)] if all_latencies else 0
        p99 = all_latencies[int(len(all_latencies) * 0.99)] if all_latencies else 0
        avg_lat = statistics.mean(all_latencies) if all_latencies else 0

        stage_metrics = {
            "concurrency": concurrency,
            "duration_sec": round(actual_duration, 2),
            "total_requests": total_requests,
            "success_rate_pct": round((successes / total_requests * 100) if total_requests else 0, 2),
            "requests_per_sec": round(rps, 2),
            "latency_avg_ms": round(avg_lat * 1000, 2),
            "latency_p50_ms": round(p50 * 1000, 2),
            "latency_p95_ms": round(p95 * 1000, 2),
            "latency_p99_ms": round(p99 * 1000, 2),
            "failures": failures,
        }

        print(f"  Requests: {total_requests} | Throughput: {stage_metrics['requests_per_sec']} req/s | Success: {stage_metrics['success_rate_pct']}%")
        print(f"  Latency -> Avg: {stage_metrics['latency_avg_ms']}ms | p50: {stage_metrics['latency_p50_ms']}ms | p95: {stage_metrics['latency_p95_ms']}ms | p99: {stage_metrics['latency_p99_ms']}ms")

        return stage_metrics

async def run_traffic_spike_suite():
    print("=" * 60)
    print("RUNNING TEST C: Traffic Spike & Saturation Ramp-Up Suite")
    print("=" * 60)

    stages = [5, 10, 25, 50, 75, 100]
    stage_results = []

    for stage_users in stages:
        res = await run_stage(stage_users, stage_duration_sec=7.0)
        stage_results.append(res)
        # Small cooldown between stages
        await asyncio.sleep(1.0)

    with open("test_c_results.json", "w") as fp:
        json.dump(stage_results, fp, indent=2)

    print("\n--- TEST C FINAL RAMP-UP SUMMARY ---")
    print(f"{'Users':<8}{'Req/s':<10}{'Success%':<12}{'p50 (ms)':<12}{'p95 (ms)':<12}{'p99 (ms)':<12}")
    for s in stage_results:
        print(f"{s['concurrency']:<8}{s['requests_per_sec']:<10}{s['success_rate_pct']:<12}{s['latency_p50_ms']:<12}{s['latency_p95_ms']:<12}{s['latency_p99_ms']:<12}")

    return stage_results

if __name__ == "__main__":
    asyncio.run(run_traffic_spike_suite())
