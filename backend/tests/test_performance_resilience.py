"""
Unit Tests for Performance & Concurrency Resilience Improvements
Validates:
1. Redis circuit-breaker offline behavior (fast-fail, non-blocking)
2. In-memory token revocation & blacklist fallback
3. In-memory per-user rate limit isolation
4. Case-insensitive Enum _missing_ mapping for database consistency
"""
import os
import sys
import time

import pytest

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from db.models import CandidateStatus, UserRole
from services.redis_service import (
    is_redis_available,
    is_token_revoked,
    record_rate_limit,
    revoke_token,
)


def test_redis_circuit_breaker_offline():
    """Verify is_redis_available returns fast without blocking event loops."""
    t0 = time.perf_counter()
    status = is_redis_available(timeout=0.05)
    duration = time.perf_counter() - t0
    # Must complete in under 100ms
    assert duration < 0.1, f"Circuit breaker took too long: {duration}s"
    assert isinstance(status, bool)

@pytest.mark.asyncio
async def test_in_memory_token_revocation():
    """Verify token revocation functions with in-memory fallback."""
    fake_token = "eyTestPerformanceResilienceToken12345"
    # Initially not revoked
    assert await is_token_revoked(fake_token) is False

    # Revoke token for 60 seconds
    await revoke_token(fake_token, expire_seconds=60)

    # Immediately detected as revoked
    assert await is_token_revoked(fake_token) is True

@pytest.mark.asyncio
async def test_in_memory_rate_limiting():
    """Verify rate limit records hits and blocks after threshold."""
    client_key = "test_perf_user_rate_limit_bucket"
    limit = 3

    allowed_1, count_1 = await record_rate_limit(client_key, limit=limit, window_seconds=60)
    assert allowed_1 is True
    assert count_1 >= 1

    allowed_2, count_2 = await record_rate_limit(client_key, limit=limit, window_seconds=60)
    allowed_3, count_3 = await record_rate_limit(client_key, limit=limit, window_seconds=60)
    
    # 4th request exceeds threshold
    allowed_4, count_4 = await record_rate_limit(client_key, limit=limit, window_seconds=60)
    assert allowed_4 is False
    assert count_4 > limit

def test_case_insensitive_enum_missing():
    """Verify _missing_ handler resolves uppercase, lowercase, and mixed-case DB enums without 500 error."""
    # CandidateStatus checks
    assert CandidateStatus("screened") == CandidateStatus.SCREENED
    assert CandidateStatus("SCREENED") == CandidateStatus.SCREENED
    assert CandidateStatus("Screened") == CandidateStatus.SCREENED
    assert CandidateStatus("sourced") == CandidateStatus.SOURCED
    assert CandidateStatus("unknown_status_fallback") == CandidateStatus.SOURCED

    # UserRole checks
    assert UserRole("admin") == UserRole.ADMIN
    assert UserRole("ADMIN") == UserRole.ADMIN
    assert UserRole("recruiter") == UserRole.RECRUITER
    assert UserRole("RECRUITER") == UserRole.RECRUITER

if __name__ == "__main__":
    import asyncio
    print("Running test_redis_circuit_breaker_offline...")
    test_redis_circuit_breaker_offline()
    print("Running test_in_memory_token_revocation...")
    asyncio.run(test_in_memory_token_revocation())
    print("Running test_in_memory_rate_limiting...")
    asyncio.run(test_in_memory_rate_limiting())
    print("Running test_case_insensitive_enum_missing...")
    test_case_insensitive_enum_missing()
    print("\nALL 4 RESILIENCE UNIT TESTS PASSED SUCCESSFULLY!")
