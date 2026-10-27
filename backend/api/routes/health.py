"""
DVT Talent AI — Production Health Check Endpoints
Provides deep health checks for all critical infrastructure components.
"""
import time
import structlog
from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from api.routes.auth import require_admin
from db.models import User

log = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/health", tags=["Health"], summary="Basic liveness check")
async def health_check():
    """Fast liveness check. Returns immediately."""
    return {"status": "healthy", "service": "dvt-talent-ai", "version": "1.0.0"}


@router.get("/health/db", tags=["Health"], summary="PostgreSQL connectivity check")
async def health_db():
    """Checks that a real PostgreSQL query can be executed."""
    try:
        from db.models import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            row = result.fetchone()
        if row and row[0] == 1:
            return {"status": "healthy", "database": "postgresql", "latency_ms": None}
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={"status": "unhealthy", "database": "postgresql", "error": "Unexpected result"})
    except Exception as e:
        log.error("health_db_failed", error=str(e))
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={"status": "unhealthy", "database": "postgresql", "error": "Database connectivity check failed"})


@router.get("/health/redis", tags=["Health"], summary="Redis connectivity check")
async def health_redis():
    """Pings Redis and measures round-trip latency with circuit-breaker protection."""
    from services.redis_service import is_redis_available, get_redis_client
    if not is_redis_available():
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "unhealthy", "service": "redis", "error": "Redis broker unreachable"}
        )
    try:
        t0 = time.monotonic()
        r = get_redis_client()
        if not r:
            return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                content={"status": "unhealthy", "service": "redis", "error": "Client unavailable"})
        pong = await r.ping()
        latency_ms = round((time.monotonic() - t0) * 1000, 2)
        if pong:
            return {"status": "healthy", "service": "redis", "latency_ms": latency_ms}
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={"status": "unhealthy", "service": "redis", "error": "Ping failed"})
    except Exception as e:
        log.error("health_redis_failed", error=str(e))
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={"status": "unhealthy", "service": "redis", "error": "Redis connectivity check failed"})


@router.get("/health/llm", tags=["Health"], summary="LLM API key & connectivity check (Admin only)")
async def health_llm(current_user: User = Depends(require_admin)):
    """Calls the configured LLM with a minimal prompt to verify API key works. Restricted to admins to prevent cost exhaustion."""
    try:
        from config import settings
        from openai import AsyncOpenAI
        if not settings.primary_llm_api_key:
            return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                                content={"status": "unhealthy", "service": "llm", "error": "No API key configured"})
        t0 = time.monotonic()
        client = AsyncOpenAI(api_key=settings.primary_llm_api_key, base_url=settings.primary_llm_base_url)
        resp = await client.chat.completions.create(
            model=settings.primary_llm_model,
            messages=[{"role": "user", "content": "Reply with the single word: OK"}],
            max_tokens=5,
        )
        latency_ms = round((time.monotonic() - t0) * 1000, 2)
        content = resp.choices[0].message.content.strip()
        return {
            "status": "healthy", "service": "llm",
            "model": settings.primary_llm_model,
            "response": content,
            "latency_ms": latency_ms
        }
    except Exception as e:
        log.error("health_llm_failed", error=str(e))
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            content={"status": "unhealthy", "service": "llm", "error": "LLM connectivity check failed"})


@router.get("/health/all", tags=["Health"], summary="Composite health check for all systems")
async def health_all():
    """
    Runs all health checks and returns a composite status.
    Returns 200 only if ALL systems are healthy.
    """
    import asyncio
    db_task = health_db()
    redis_task = health_redis()
    # LLM check is slow and costly — run it only if explicitly needed
    db_result, redis_result = await asyncio.gather(db_task, redis_task)

    # Extract status from response objects
    def extract(r):
        if isinstance(r, JSONResponse):
            import json
            return json.loads(r.body)
        return r

    db_r = extract(db_result)
    redis_r = extract(redis_result)

    all_healthy = db_r.get("status") == "healthy" and redis_r.get("status") == "healthy"

    payload = {
        "status": "healthy" if all_healthy else "degraded",
        "checks": {
            "database": db_r,
            "redis": redis_r,
        }
    }
    code = status.HTTP_200_OK if all_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
    return JSONResponse(status_code=code, content=payload)
