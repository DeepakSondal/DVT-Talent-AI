import json
import time
from fastapi import Request, Response, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
import redis.asyncio as redis
from config import settings
import structlog

log = structlog.get_logger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 60):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self._redis = None
        self._redis_down_until = 0.0
        self._memory_counts: dict[str, tuple[int, int]] = {}  # key -> (minute, count)

    async def get_redis(self):
        if self._redis is None:
            self._redis = redis.from_url(
                settings.redis_url,
                socket_connect_timeout=0.3,
                socket_timeout=0.3,
            )
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # 1. Identify Client (User ID or IP)
        user = getattr(request.state, "user", None)
        client_id = f"rl:user:{user.id}" if user else f"rl:ip:{request.client.host if request.client else 'unknown'}"
        current_minute = int(time.time() / 60)
        now = time.time()

        # 2. If Redis circuit breaker is open, use fast in-memory rate limiting
        if now < self._redis_down_until:
            if len(self._memory_counts) > 2048:
                self._memory_counts = {
                    k: v for k, v in self._memory_counts.items() if v[0] == current_minute
                }
            minute, count = self._memory_counts.get(client_id, (current_minute, 0))
            if minute != current_minute:
                count = 0
            count += 1
            self._memory_counts[client_id] = (current_minute, count)
            if count > self.requests_per_minute:
                return Response(
                    content=json.dumps({"error": "Rate limit exceeded. Try again in a minute."}),
                    status_code=HTTP_429_TOO_MANY_REQUESTS,
                    media_type="application/json"
                )
            return await call_next(request)

        # 3. Check Rate Limit in Redis
        r = await self.get_redis()
        key = f"{client_id}:{current_minute}"
        
        try:
            count = await r.incr(key)
            if count == 1:
                await r.expire(key, 60) # Cleanup after 1 minute

            if count > self.requests_per_minute:
                log.warning("rate_limit_exceeded", client=client_id, count=count)
                return Response(
                    content=json.dumps({"error": "Rate limit exceeded. Try again in a minute."}),
                    status_code=HTTP_429_TOO_MANY_REQUESTS,
                    media_type="application/json"
                )
        except Exception as e:
            # Trip circuit breaker for 30s to avoid blocking requests
            self._redis_down_until = now + 30.0
            log.warning("rate_limit_redis_failed_falling_back_to_memory", error=str(e))
        
        return await call_next(request)
