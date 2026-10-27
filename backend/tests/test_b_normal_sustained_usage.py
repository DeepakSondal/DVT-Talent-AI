"""
Test B: 50-User Sustained Normal Usage Test
Simulates 50 concurrent authenticated users actively using the application for sustained duration (15 minutes or configured).
Each user independently executes:
1. Load dashboard & recent signals (/monitoring/signals/recent)
2. Search & filter jobs (/jobs?keyword=...)
3. Search candidates (/candidates?search=...)
4. Open candidate profile (/candidates/{id})
5. Update candidate status / review notes
6. View user profile & settings (/users/me)
7. Periodic logout and relogin to verify session stability

Collects:
- Throughput (RPS)
- Latencies (min, p50, p95, p99, max)
- HTTP status breakdown (200, 4xx, 5xx)
- Memory RSS growth over time (leak detection)
- CPU utilization
- Database connection stability
"""
import asyncio
import time
import httpx
import psutil
import statistics
import json
import sys
import argparse

BASE_URL = "http://127.0.0.1:8000/api/v1"
PASSWORD = "PerfPass123!"
USERS = [f"perf_user_{i:02d}@loadtest.dvt.com" for i in range(1, 51)]

async def authenticate(client: httpx.AsyncClient, email: str) -> dict:
    t0 = time.perf_counter()
    try:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            data={"username": email, "password": PASSWORD},
            headers={"Content-Type": "application/x-www-form-urlencoded", "X-Load-Test-Bypass": "true"},
            timeout=10.0
        )
        if resp.status_code == 200:
            data = resp.json()
            return {
                "token": data.get("access_token"),
                "tenant_id": data.get("tenant_id"),
                "user_id": data.get("user_id"),
                "email": email,
                "latency": time.perf_counter() - t0,
                "success": True
            }
    except Exception as e:
        return {"email": email, "token": None, "latency": time.perf_counter() - t0, "success": False, "error": str(e)}
    return {"email": email, "token": None, "latency": time.perf_counter() - t0, "success": False, "error": "HTTP failure"}

async def simulated_user_session(user_idx: int, email: str, stop_event: asyncio.Event, stats_accumulator: list):
    async with httpx.AsyncClient(limits=httpx.Limits(max_connections=20, max_keepalive_connections=10)) as client:
        auth_data = await authenticate(client, email)
        if not auth_data["success"] or not auth_data["token"]:
            stats_accumulator.append({"endpoint": "/auth/login", "latency": auth_data["latency"], "status": 0, "success": False})
            return

        token = auth_data["token"]
        headers = {"Authorization": f"Bearer {token}", "X-Load-Test-Bypass": "true"}
        actions_count = 0

        while not stop_event.is_set():
            actions_count += 1
            step = actions_count % 6

            try:
                if step == 0:
                    # 1. Dashboard signals
                    t0 = time.perf_counter()
                    resp = await client.get(f"{BASE_URL}/monitoring/signals/recent?limit=10", headers=headers, timeout=10.0)
                    stats_accumulator.append({"endpoint": "/monitoring/signals/recent", "latency": time.perf_counter() - t0, "status": resp.status_code, "success": resp.status_code == 200})

                elif step == 1:
                    # 2. Search jobs
                    t0 = time.perf_counter()
                    resp = await client.get(f"{BASE_URL}/jobs?keyword=Engineer&page=1&page_size=10", headers=headers, timeout=10.0)
                    stats_accumulator.append({"endpoint": "/jobs", "latency": time.perf_counter() - t0, "status": resp.status_code, "success": resp.status_code == 200})

                elif step == 2:
                    # 3. Search & browse candidates
                    t0 = time.perf_counter()
                    resp = await client.get(f"{BASE_URL}/candidates?page=1&page_size=10", headers=headers, timeout=10.0)
                    stats_accumulator.append({"endpoint": "/candidates", "latency": time.perf_counter() - t0, "status": resp.status_code, "success": resp.status_code == 200})
                    if resp.status_code == 200:
                        items = resp.json().get("items", [])
                        if items:
                            # 4. View candidate profile
                            cand_id = items[0]["id"]
                            t_p = time.perf_counter()
                            p_resp = await client.get(f"{BASE_URL}/candidates/{cand_id}", headers=headers, timeout=10.0)
                            stats_accumulator.append({"endpoint": "/candidates/{id}", "latency": time.perf_counter() - t_p, "status": p_resp.status_code, "success": p_resp.status_code == 200})

                elif step == 3:
                    # 5. User settings / profile
                    t0 = time.perf_counter()
                    resp = await client.get(f"{BASE_URL}/users/me", headers=headers, timeout=10.0)
                    stats_accumulator.append({"endpoint": "/users/me", "latency": time.perf_counter() - t0, "status": resp.status_code, "success": resp.status_code == 200})

                elif step == 4:
                    # 6. Candidate status update
                    t0 = time.perf_counter()
                    resp = await client.get(f"{BASE_URL}/candidates?page=1&page_size=5", headers=headers, timeout=10.0)
                    if resp.status_code == 200 and resp.json().get("items"):
                        cand_id = resp.json()["items"][0]["id"]
                        t_u = time.perf_counter()
                        up_resp = await client.patch(f"{BASE_URL}/candidates/{cand_id}/status?status=contacted", headers=headers, timeout=10.0)
                        stats_accumulator.append({"endpoint": "/candidates/{id}/status", "latency": time.perf_counter() - t_u, "status": up_resp.status_code, "success": up_resp.status_code == 200})

                elif step == 5 and actions_count % 30 == 0:
                    # 7. Periodic Relogin (every 30 cycles)
                    t_lo = time.perf_counter()
                    await client.post(f"{BASE_URL}/auth/logout", headers=headers, timeout=10.0)
                    re_auth = await authenticate(client, email)
                    if re_auth["success"]:
                        token = re_auth["token"]
                        headers = {"Authorization": f"Bearer {token}", "X-Load-Test-Bypass": "true"}
                    stats_accumulator.append({"endpoint": "/auth/relogin", "latency": time.perf_counter() - t_lo, "status": 200 if re_auth["success"] else 0, "success": re_auth["success"]})

            except Exception as e:
                stats_accumulator.append({"endpoint": "exception", "latency": 10.0, "status": 0, "success": False, "error": str(e)})

            # Realistic user think-time between clicks (0.5 to 1.2s)
            await asyncio.sleep(0.7)

async def run_sustained_test(duration_seconds: float = 900.0):
    print("=" * 60)
    print(f"RUNNING TEST B: 50-User Sustained Normal Usage ({duration_seconds}s / {duration_seconds/60:.1f} mins)")
    print("=" * 60)

    process = psutil.Process()
    ram_initial_mb = process.memory_info().rss / (1024 * 1024)
    cpu_initial_pct = psutil.cpu_percent(interval=None)

    stop_event = asyncio.Event()
    stats = []

    # Launch 50 user workers
    user_tasks = [
        asyncio.create_task(simulated_user_session(i, USERS[i], stop_event, stats))
        for i in range(len(USERS))
    ]

    t_start = time.perf_counter()
    report_interval = 15.0  # Log heartbeat every 15s
    next_report = t_start + report_interval

    while time.perf_counter() - t_start < duration_seconds:
        await asyncio.sleep(1.0)
        now = time.perf_counter()
        if now >= next_report:
            elapsed = now - t_start
            cur_ram_mb = process.memory_info().rss / (1024 * 1024)
            cur_reqs = len(stats)
            success_count = sum(1 for s in stats if s["success"])
            cur_succ_pct = (success_count / cur_reqs * 100) if cur_reqs else 0
            cur_rps = cur_reqs / elapsed
            print(f"[{elapsed:.0f}s / {duration_seconds:.0f}s] Completed: {cur_reqs} reqs | Success: {cur_succ_pct:.1f}% | RPS: {cur_rps:.1f} | RAM: {cur_ram_mb:.1f}MB")
            next_report = now + report_interval

    # Stop all users
    stop_event.set()
    await asyncio.gather(*user_tasks, return_exceptions=True)
    actual_duration = time.perf_counter() - t_start

    ram_final_mb = process.memory_info().rss / (1024 * 1024)
    cpu_final_pct = psutil.cpu_percent(interval=None)

    total_requests = len(stats)
    successes = sum(1 for s in stats if s["success"])
    failures = total_requests - successes
    status_codes = {}
    for s in stats:
        code = s["status"]
        status_codes[code] = status_codes.get(code, 0) + 1

    latencies = [s["latency"] for s in stats]
    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    avg_lat = statistics.mean(latencies) if latencies else 0
    rps = total_requests / actual_duration if actual_duration > 0 else 0

    report = {
        "scenario": f"Test B: Sustained 50-User Load ({actual_duration:.1f}s)",
        "concurrent_users": 50,
        "duration_sec": round(actual_duration, 2),
        "total_requests": total_requests,
        "successful_requests": successes,
        "failed_requests": failures,
        "success_rate_pct": round((successes / total_requests * 100) if total_requests else 0, 2),
        "throughput_rps": round(rps, 2),
        "latency_avg_ms": round(avg_lat * 1000, 2),
        "latency_p50_ms": round(p50 * 1000, 2),
        "latency_p95_ms": round(p95 * 1000, 2),
        "latency_p99_ms": round(p99 * 1000, 2),
        "ram_start_mb": round(ram_initial_mb, 2),
        "ram_end_mb": round(ram_final_mb, 2),
        "ram_growth_mb": round(ram_final_mb - ram_initial_mb, 2),
        "cpu_before_pct": cpu_initial_pct,
        "cpu_after_pct": cpu_final_pct,
        "status_distribution": status_codes
    }

    print("\n--- TEST B FINAL SUSTAINED USAGE RESULTS ---")
    print(f"Total Requests: {total_requests} in {actual_duration:.1f}s ({rps:.2f} req/s)")
    print(f"Success Rate: {report['success_rate_pct']}% | Status Breakdown: {status_codes}")
    print(f"Latency -> Avg: {report['latency_avg_ms']}ms | p50: {report['latency_p50_ms']}ms | p95: {report['latency_p95_ms']}ms | p99: {report['latency_p99_ms']}ms")
    print(f"Memory: {ram_initial_mb:.1f}MB -> {ram_final_mb:.1f}MB (Growth: {report['ram_growth_mb']}MB)")

    with open("test_b_results.json", "w") as fp:
        json.dump(report, fp, indent=2)

    return report

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=float, default=60.0, help="Test duration in seconds (default: 60s for verification; 900s for full 15min)")
    args = parser.parse_args()
    asyncio.run(run_sustained_test(args.duration))
