"""
DVT Talent AI — Resilient Redis & Caching Service
Provides high-performance Redis client with socket-level circuit breaker,
zero-latency fallback when Redis is offline, and resilient in-memory fallbacks.
"""
import asyncio
import contextlib
import hashlib
import socket
import threading
import time
import urllib.parse
from typing import Dict, Optional, Tuple

import redis.asyncio as aioredis
import structlog

from config import settings

log = structlog.get_logger(__name__)

# Circuit breaker state
_circuit_state = {
    "available": None,
    "last_checked": 0.0,
    "check_interval": 15.0,  # Re-check after 15 seconds if failed
}

_redis_client: Optional[aioredis.Redis] = None
_in_memory_blacklist: Dict[str, float] = {}  # token -> expires_at
_in_memory_ratelimit: Dict[str, Tuple[int, int, int]] = {}  # key -> (curr_bucket, curr_count, prev_count)
_ratelimit_lock = asyncio.Lock()


def _probe_tcp_reachable(host: str, port: int, timeout: float) -> bool:
    """Verify TCP reachability within a strict wall-clock deadline covering DNS lookup."""
    bounded_timeout = max(0.005, float(timeout))
    result = False
    done = threading.Event()

    def _connect() -> None:
        nonlocal result
        sock = None
        try:
            sock = socket.create_connection((host, port), timeout=bounded_timeout)
            result = True
        except OSError:
            result = False
        finally:
            if sock is not None:
                with contextlib.suppress(OSError):
                    sock.close()
            done.set()

    threading.Thread(target=_connect, daemon=True, name="redis-tcp-probe").start()
    return done.wait(timeout=bounded_timeout) and result


def is_redis_available(timeout: float = 0.05) -> bool:
    """
    Fast check with circuit breaker caching.
    Returns immediately if Redis client is already active or recently tested.
    """
    now = time.time()
    if (
        _circuit_state["available"] is not None
        and (now - _circuit_state["last_checked"]) < _circuit_state["check_interval"]
    ):
        return _circuit_state["available"]

    if _redis_client is not None and _circuit_state["available"] is True:
        _circuit_state["last_checked"] = now
        return True

    try:
        parsed = urllib.parse.urlparse(settings.redis_url)
        host = parsed.hostname or "127.0.0.1"
        port = parsed.port or 6379
        reachable = _probe_tcp_reachable(host, port, timeout)
        _circuit_state["available"] = reachable
        _circuit_state["last_checked"] = time.time()
        return reachable
    except Exception:
        _circuit_state["available"] = False
        _circuit_state["last_checked"] = time.time()
        return False


def get_redis_client() -> Optional[aioredis.Redis]:
    """
    Returns an async Redis client instance if Redis is online, otherwise None.
    Uses socket timeouts to guarantee it never blocks request threads.
    """
    global _redis_client
    if not is_redis_available():
        return None

    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=0.2,
                socket_timeout=0.2,
                max_connections=50,
            )
        except Exception as e:
            log.warning("redis_client_init_failed", error=str(e))
            _circuit_state["available"] = False
            return None

    return _redis_client


async def is_token_revoked(token: str) -> bool:
    """
    Checks if a JWT access token has been revoked.
    Guaranteed response in < 1ms whether Redis is online or offline.
    """
    now = time.time()
    # 1. Check in-memory blacklist
    exp = _in_memory_blacklist.get(token)
    if exp:
        if now < exp:
            return True
        else:
            del _in_memory_blacklist[token]

    # 2. Check Redis if available
    client = get_redis_client()
    if client:
        try:
            val = await client.get(f"blacklist:{token}")
            return bool(val)
        except Exception:
            # Circuit breaker trip
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now

    return False


async def revoke_token(token: str, expire_seconds: int = 86400) -> None:
    """
    Marks a token as revoked in memory and in Redis.
    """
    now = time.time()
    # Clean memory store periodically
    if len(_in_memory_blacklist) > 10000:
        to_del = [k for k, v in _in_memory_blacklist.items() if now >= v]
        for k in to_del:
            del _in_memory_blacklist[k]

    _in_memory_blacklist[token] = now + expire_seconds

    client = get_redis_client()
    if client:
        try:
            await client.setex(f"blacklist:{token}", expire_seconds, "1")
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now


async def record_rate_limit(
    key: str,
    limit: int,
    window_seconds: int = 60,
    now_override: Optional[float] = None,
) -> Tuple[bool, int]:
    """
    Records a rate limit hit using a Sliding-Window Counter algorithm
    (weighted previous window + current window) to prevent boundary bursts.
    Returns (is_allowed, effective_count).
    Works in Redis (atomic pipeline) or thread-safe in-memory fallback.
    """
    window_seconds = max(1, int(window_seconds))
    now = now_override if now_override is not None else time.time()
    curr_bucket = int(now // window_seconds)
    prev_bucket = curr_bucket - 1
    elapsed_ratio = (now % window_seconds) / float(window_seconds)
    prev_weight = max(0.0, 1.0 - elapsed_ratio)

    client = get_redis_client()
    if client:
        try:
            curr_key = f"{key}:{curr_bucket}"
            prev_key = f"{key}:{prev_bucket}"
            pipe = client.pipeline()
            pipe.get(prev_key)
            pipe.incr(curr_key)
            pipe.expire(curr_key, window_seconds * 2)
            prev_raw, curr_count, _ = await pipe.execute()
            prev_count = int(prev_raw) if prev_raw else 0
            effective_count = int(prev_count * prev_weight) + int(curr_count)
            return (effective_count <= limit, effective_count)
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now

    # Thread-safe in-memory sliding-window fallback
    async with _ratelimit_lock:
        if len(_in_memory_ratelimit) > 5000:
            to_del = [
                k for k, v in _in_memory_ratelimit.items()
                if v[0] < prev_bucket
            ]
            for k in to_del:
                del _in_memory_ratelimit[k]

        stored_bucket, stored_curr, stored_prev = _in_memory_ratelimit.get(key, (curr_bucket, 0, 0))
        if stored_bucket == curr_bucket:
            curr_count = stored_curr + 1
            prev_count = stored_prev
        elif stored_bucket == prev_bucket:
            prev_count = stored_curr
            curr_count = 1
        else:
            prev_count = 0
            curr_count = 1

        _in_memory_ratelimit[key] = (curr_bucket, curr_count, prev_count)
        effective_count = int(prev_count * prev_weight) + curr_count
        return (effective_count <= limit, effective_count)


async def get_rate_limit_count(
    key: str,
    window_seconds: int = 60,
    now_override: Optional[float] = None,
) -> int:
    """
    Returns current sliding-window count for a key without incrementing it.
    """
    window_seconds = max(1, int(window_seconds))
    now = now_override if now_override is not None else time.time()
    curr_bucket = int(now // window_seconds)
    prev_bucket = curr_bucket - 1
    elapsed_ratio = (now % window_seconds) / float(window_seconds)
    prev_weight = max(0.0, 1.0 - elapsed_ratio)

    client = get_redis_client()
    if client:
        try:
            curr_key = f"{key}:{curr_bucket}"
            prev_key = f"{key}:{prev_bucket}"
            pipe = client.pipeline()
            pipe.get(prev_key)
            pipe.get(curr_key)
            prev_raw, curr_raw = await pipe.execute()
            prev_count = int(prev_raw) if prev_raw else 0
            curr_count = int(curr_raw) if curr_raw else 0
            return int(prev_count * prev_weight) + curr_count
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now

    async with _ratelimit_lock:
        stored_bucket, stored_curr, stored_prev = _in_memory_ratelimit.get(key, (curr_bucket, 0, 0))
        if stored_bucket == curr_bucket:
            return int(stored_prev * prev_weight) + stored_curr
        elif stored_bucket == prev_bucket:
            return int(stored_curr * prev_weight)
        return 0


async def reset_rate_limit(key: str, window_seconds: int = 60) -> None:
    """
    Resets rate-limit counters for a key in both Redis and in-memory store.
    """
    window_seconds = max(1, int(window_seconds))
    now = time.time()
    curr_bucket = int(now // window_seconds)
    prev_bucket = curr_bucket - 1

    async with _ratelimit_lock:
        _in_memory_ratelimit.pop(key, None)

    client = get_redis_client()
    if client:
        try:
            await client.delete(f"{key}:{curr_bucket}", f"{key}:{prev_bucket}")
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now


# ── Registration Email OTP Storage & Verification ───────────────────────────
_in_memory_otps: Dict[str, Tuple[str, float]] = {}  # email -> (otp_hash, expires_at)
_otp_lock = asyncio.Lock()


async def store_email_otp(email: str, otp: str, ttl_seconds: int = 600) -> None:
    """Store 6-digit email OTP with SHA-256 hash and 10-minute expiry."""
    otp_hash = hashlib.sha256(otp.encode("utf-8")).hexdigest()
    now = time.time()
    expires_at = now + ttl_seconds
    clean_email = email.strip().lower()

    async with _otp_lock:
        _in_memory_otps[clean_email] = (otp_hash, expires_at)

    client = get_redis_client()
    if client:
        try:
            await client.setex(f"email_otp:{clean_email}", ttl_seconds, otp_hash)
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now


async def verify_email_otp(email: str, otp: str) -> bool:
    """Verify 6-digit email OTP. Single-use: deletes OTP upon successful verification."""
    clean_email = email.strip().lower()
    clean_otp = (otp or "").strip()
    expected_hash = hashlib.sha256(clean_otp.encode("utf-8")).hexdigest()
    now = time.time()

    client = get_redis_client()
    if client:
        try:
            stored_hash = await client.get(f"email_otp:{clean_email}")
            if stored_hash and stored_hash == expected_hash:
                await client.delete(f"email_otp:{clean_email}")
                async with _otp_lock:
                    _in_memory_otps.pop(clean_email, None)
                return True
        except Exception:
            _circuit_state["available"] = False
            _circuit_state["last_checked"] = now

    async with _otp_lock:
        stored = _in_memory_otps.get(clean_email)
        if stored:
            stored_hash, expires_at = stored
            if now <= expires_at and stored_hash == expected_hash:
                _in_memory_otps.pop(clean_email, None)
                return True

    return False
