import hmac
import ipaddress
import json
from typing import List, Optional

import structlog
from fastapi import HTTPException, Request, Response
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.status import HTTP_429_TOO_MANY_REQUESTS

from config import settings
from services.redis_service import record_rate_limit

log = structlog.get_logger(__name__)

# Routes where IP-level rate limiting must always be enforced regardless of any Bearer token
_PUBLIC_IP_ENFORCED_PREFIXES = (
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/sso",
    "/api/v1/webhooks",
    "/api/v1/track",
    "/api/v1/invite/validate",
    "/api/v1/invite/accept",
)


def _get_trusted_networks() -> List[ipaddress._BaseNetwork]:
    cidrs_str = getattr(settings, "trusted_proxy_cidrs", "127.0.0.1/32,::1/128,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16")
    nets: List[ipaddress._BaseNetwork] = []
    for raw_cidr in (cidrs_str or "").split(","):
        cidr = raw_cidr.strip()
        if not cidr:
            continue
        try:
            nets.append(ipaddress.ip_network(cidr, strict=False))
        except ValueError:
            continue
    return nets


def is_trusted_proxy_peer(peer_host: str) -> bool:
    """Returns True only if the immediate TCP peer is a trusted reverse proxy or local test runner."""
    if not peer_host:
        return False
    if peer_host in ("127.0.0.1", "::1", "localhost", "testclient"):
        return True
    try:
        addr = ipaddress.ip_address(peer_host)
        for net in _get_trusted_networks():
            if addr in net:
                return True
    except ValueError:
        pass
    return False


def get_real_client_ip(request: Optional[Request]) -> str:
    """
    Safely resolves the true client IP address.
    Only trusts X-Forwarded-For / X-Real-IP when the immediate socket peer is a verified trusted proxy.
    """
    if request is None:
        return "unknown"

    peer_host = request.client.host if request.client else "unknown"
    if not is_trusted_proxy_peer(peer_host):
        return peer_host

    xff = request.headers.get("X-Forwarded-For")
    if xff:
        # Walk from rightmost hop backwards to find first non-trusted-proxy IP, or fallback to first valid IP
        hops = [h.strip() for h in xff.split(",") if h.strip()]
        valid_ips: List[str] = []
        for hop in hops:
            try:
                ipaddress.ip_address(hop)
                valid_ips.append(hop)
            except ValueError:
                continue
        if valid_ips:
            for candidate_ip in reversed(valid_ips):
                if not is_trusted_proxy_peer(candidate_ip):
                    return candidate_ip
            return valid_ips[0]

    x_real_ip = request.headers.get("X-Real-IP")
    if x_real_ip:
        candidate = x_real_ip.strip()
        try:
            ipaddress.ip_address(candidate)
            return candidate
        except ValueError:
            pass

    return peer_host


def is_load_test_bypass_allowed(request: Optional[Request]) -> bool:
    """
    Strictly controls load-test rate-limit bypass:
    1. NEVER allowed in production (settings.is_production == True).
    2. If load_test_bypass_secret is configured, requires constant-time match.
    3. Otherwise in local dev/test mode, only allowed from loopback peer without external X-Forwarded-For.
    """
    if request is None or settings.is_production:
        return False

    bypass_header = request.headers.get("X-Load-Test-Bypass")
    if not bypass_header:
        return False

    configured_secret = getattr(settings, "load_test_bypass_secret", "") or ""
    if configured_secret:
        return hmac.compare_digest(bypass_header.encode("utf-8"), configured_secret.encode("utf-8"))

    # In local development/test only: allow "true" strictly from local loopback socket with no external forwarding
    peer_host = request.client.host if request.client else ""
    if peer_host in ("127.0.0.1", "::1", "localhost", "testclient") and not request.headers.get("X-Forwarded-For"):
        return bypass_header == "true"

    return False


def _extract_verified_user_id(request: Request) -> Optional[str]:
    """
    Extracts user_id ('sub') ONLY if the Bearer token is cryptographically signed and valid.
    Prevents attackers from bypassing IP rate limits by sending random/spoofed Authorization headers.
    """
    raw_token = None
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        parts = auth_header.split(" ", 1)
        if len(parts) == 2 and parts[1].strip():
            raw_token = parts[1].strip()
    else:
        cookie_token = request.cookies.get("dvt_token")
        if cookie_token and cookie_token.startswith("Bearer "):
            parts = cookie_token.split(" ", 1)
            if len(parts) == 2 and parts[1].strip():
                raw_token = parts[1].strip()

    if not raw_token:
        return None

    try:
        payload = jwt.decode(raw_token, settings.secret_key, algorithms=[settings.algorithm])
        if payload.get("type") != "access":
            return None
        sub = payload.get("sub")
        return str(sub) if sub else None
    except JWTError:
        return None


async def enforce_endpoint_rate_limit(
    request: Optional[Request],
    scope: str,
    identifier: str,
    limit: int,
    window_seconds: int = 60,
    detail: str = "Rate limit exceeded. Please wait before trying again.",
) -> int:
    """
    Enforces a route-specific rate limit and raises HTTP 429 if exceeded.
    Returns the current sliding-window count.
    """
    if is_load_test_bypass_allowed(request):
        return 0

    key = f"rl:{scope}:{identifier}"
    is_allowed, count = await record_rate_limit(key, limit=limit, window_seconds=window_seconds)
    if not is_allowed:
        log.warning("endpoint_rate_limit_exceeded", scope=scope, identifier=identifier, count=count, limit=limit)
        raise HTTPException(
            status_code=HTTP_429_TOO_MANY_REQUESTS,
            detail=detail,
            headers={"Retry-After": str(window_seconds)},
        )
    return count


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_per_minute: int = 600):
        super().__init__(app)
        self.requests_per_minute = requests_per_minute or 600

    async def dispatch(self, request: Request, call_next):
        if is_load_test_bypass_allowed(request):
            return await call_next(request)

        path = request.url.path or ""
        real_ip = get_real_client_ip(request)
        force_ip_bucket = any(path.startswith(p) for p in _PUBLIC_IP_ENFORCED_PREFIXES)

        # 1. Identify Client using ONLY verified JWT claims; fallback to validated real client IP
        client_id = None
        if not force_ip_bucket:
            verified_uid = _extract_verified_user_id(request)
            if verified_uid:
                client_id = f"rl:user:{verified_uid}"
            else:
                user = getattr(request.state, "user", None)
                if user and getattr(user, "id", None):
                    client_id = f"rl:user:{user.id}"

        if not client_id:
            client_id = f"rl:ip:{real_ip}"

        # 2. Check Rate Limit using resilient sliding-window service
        is_allowed, count = await record_rate_limit(
            client_id,
            limit=self.requests_per_minute,
            window_seconds=60,
        )

        if not is_allowed:
            log.warning("rate_limit_exceeded", client=client_id, path=path, count=count)
            return Response(
                content=json.dumps({"error": "Rate limit exceeded. Try again in a minute."}),
                status_code=HTTP_429_TOO_MANY_REQUESTS,
                media_type="application/json",
                headers={"Retry-After": "60"},
            )

        return await call_next(request)
