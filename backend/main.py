import os
import sys

# 🛡️ SDET: Ensure the project root is in sys.path so 'backend' can be imported as a package
root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
from contextlib import asynccontextmanager

import structlog
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import RedirectResponse
from prometheus_client import make_asgi_app

# ── Sentry Observability ──────────────────────────────────────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN", "")
if _sentry_dsn:
    try:
        import logging

        import sentry_sdk
        from sentry_sdk.integrations.celery import CeleryIntegration
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        from sentry_sdk.integrations.redis import RedisIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        sentry_sdk.init(
            dsn=_sentry_dsn,
            environment=os.getenv("APP_ENV", "production"),
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                RedisIntegration(),
                CeleryIntegration(),
                LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            ],
            traces_sample_rate=0.2,       # 20% of transactions traced
            profiles_sample_rate=0.1,     # 10% profiled
            send_default_pii=False,       # GDPR: never send PII
        )
    except ImportError:
        pass

from api.routes import (
    agents,
    analytics,
    auth,
    auth_social,
    billing,
    campaigns,
    candidate_portal,
    candidates,
    compliance,
    copilot,
    email_sender,
    integrations,
    jobs,
    monitoring,
    team,
    tenants,
    users,
    webhooks,
    websocket,
)
from api.routes import health as health_routes
from config import settings
from db.models import engine, get_db

log = structlog.get_logger()

# ── Lifespan ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("dvt_startup", env=settings.app_env)

    # FIX [NEW-E-01]: Ensure missing critical settings halt the app
    settings.validate_required_settings()

    # Verify database connectivity (schema lifecycle managed exclusively by Alembic migrations)
    try:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
            if "postgresql" in settings.database_url.lower():
                await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        log.info("database_connected")
    except Exception as e:
        log.warning("database_connection_warning", error=str(e))
    yield
    await engine.dispose()
    log.info("dvt_shutdown")


from api.middleware.audit_log import AuditLogMiddleware
from api.middleware.rate_limit import (
    RateLimitMiddleware,
    enforce_endpoint_rate_limit,
    get_real_client_ip,
)
from services.redis_service import record_rate_limit

# ── App ───────────────────────────────────────────────────────────────────
app = FastAPI(
    title="DVT Talent AI API",
    description="Autonomous AI Recruiting & Sales Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
)

# ── Middleware ────────────────────────────────────────────────────────────
from starlette.middleware.sessions import SessionMiddleware

app.add_middleware(SessionMiddleware, secret_key=settings.secret_key)
app.add_middleware(RateLimitMiddleware, requests_per_minute=settings.api_rate_limit)
app.add_middleware(AuditLogMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)
# ── Security Headers Middleware ───────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        
        # Base security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        
        # Strict privacy & no-store headers on invitation, auth, and portal routes
        if "/invite" in path or "/auth" in path or "/candidate-portal" in path or "/pii" in path:
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
            response.headers["Pragma"] = "no-cache"
        else:
            response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
            
        return response

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Routes ────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,       prefix=f"{PREFIX}/auth",       tags=["Authentication"])
app.include_router(auth_social.router, prefix=f"{PREFIX}/auth",       tags=["Social Authentication"])
app.include_router(tenants.router,    prefix=f"{PREFIX}/tenants",    tags=["Tenants"])
app.include_router(users.router,      prefix=f"{PREFIX}/users",      tags=["Users"])
app.include_router(candidates.router, prefix=f"{PREFIX}/candidates", tags=["Candidates"])
app.include_router(jobs.router,       prefix=f"{PREFIX}/jobs",       tags=["Jobs"])
app.include_router(campaigns.router,  prefix=f"{PREFIX}/campaigns",  tags=["Campaigns"])
app.include_router(analytics.router,  prefix=f"{PREFIX}/analytics",  tags=["Analytics"])
app.include_router(agents.router,     prefix=f"{PREFIX}/agents",     tags=["Agents"])
app.include_router(webhooks.router,   prefix=f"{PREFIX}/webhooks",   tags=["Webhooks"])
app.include_router(monitoring.router, prefix=f"{PREFIX}/monitoring", tags=["Monitoring"])
app.include_router(compliance.router, prefix=PREFIX,                 tags=["Compliance & AI Governance"])
app.include_router(websocket.router,  prefix=f"{PREFIX}/ws",         tags=["WebSocket"])
app.include_router(copilot.router,    prefix=PREFIX,                 tags=["Copilot"])
app.include_router(billing.router,        prefix=f"{PREFIX}/billing",        tags=["Billing"])
app.include_router(integrations.router,   prefix=f"{PREFIX}/integrations",   tags=["ATS Integrations"])
app.include_router(email_sender.router,    prefix=PREFIX,                     tags=["Email Sender"])
app.include_router(team.router,              prefix=PREFIX,                     tags=["Team Management"])
app.include_router(candidate_portal.router, prefix=f"{PREFIX}/candidate-portal", tags=["Candidate Portal"])
app.include_router(health_routes.router, tags=["Health"])

# ── Email Open Tracking (no auth — called by email clients) ──────────────
import uuid as _uuid

from fastapi.responses import Response as FastAPIResponse


@app.get("/api/v1/track/{tracking_id}/open", include_in_schema=False)
async def track_email_open(tracking_id: _uuid.UUID, request: Request, db=Depends(get_db)):
    """
    FIX [C-07]: Email open-tracking pixel endpoint.
    Called when recipient opens an email with embedded tracking pixel.
    Returns a 1x1 transparent GIF. Debounces DB writes per tracking_id and IP.
    """
    from datetime import datetime as _dt

    from sqlalchemy import update

    from db.models import EmailSent, EmailStatus

    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(request, "track_open_ip", client_ip, limit=60, window_seconds=60)

    # Debounce DB write per tracking_id (max 2 open writes per minute per tracking_id)
    write_allowed, _ = await record_rate_limit(f"rl:track_open_id:{tracking_id}", limit=2, window_seconds=60)
    if write_allowed:
        try:
            await db.execute(
                update(EmailSent)
                .where(EmailSent.tracking_id == str(tracking_id))
                .where(EmailSent.opened_at.is_(None))
                .values(opened_at=_dt.utcnow(), status=EmailStatus.OPENED)
            )
            await db.commit()
        except Exception as exc:
            log.debug("email_open_track_skipped", error=str(exc), tracking_id=str(tracking_id))  # Never fail on tracking — silent

    # 1×1 transparent GIF
    gif = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
    return FastAPIResponse(content=gif, media_type="image/gif")

# ── Metrics ───────────────────────────────────────────────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# ── Health & Safe Click Tracking ──────────────────────────────────────────
@app.get("/api/v1/track/{tracking_id}/click", include_in_schema=False)
async def track_link_click(tracking_id: _uuid.UUID, url: str, request: Request, db=Depends(get_db)):
    """
    Tracks clicks on personalized links (e.g. Microsites).
    Increments click count and redirects ONLY to validated safe origins or the recorded microsite URL.
    """
    from urllib.parse import urlparse

    from fastapi import HTTPException
    from sqlalchemy import select, update

    from db.models import EmailSent

    client_ip = get_real_client_ip(request)
    await enforce_endpoint_rate_limit(request, "track_click_ip", client_ip, limit=30, window_seconds=60)
    write_allowed, _ = await record_rate_limit(f"rl:track_click_id:{tracking_id}:{client_ip}", limit=3, window_seconds=60)

    stored_microsite_url = None
    try:
        res = await db.execute(select(EmailSent).where(EmailSent.tracking_id == str(tracking_id)))
        email_rec = res.scalar_one_or_none()
        if email_rec and getattr(email_rec, "microsite_url", None):
            stored_microsite_url = email_rec.microsite_url

        if write_allowed:
            await db.execute(
                update(EmailSent)
                .where(EmailSent.tracking_id == str(tracking_id))
                .values(clicks_count=EmailSent.clicks_count + 1)
            )
            await db.commit()
    except Exception as e:
        log.error("click_track_failed", error=str(e))

    # Validate redirect target against open-redirect abuse
    raw_url = (url or "").strip()
    if not raw_url or "\\" in raw_url or "\x00" in raw_url or "\r" in raw_url or "\n" in raw_url:
        raise HTTPException(status_code=400, detail="Invalid redirect URL")

    if raw_url.startswith("/") and not raw_url.startswith("//"):
        return RedirectResponse(url=raw_url)

    parsed = urlparse(raw_url)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise HTTPException(status_code=400, detail="Invalid redirect URL scheme")

    allowed_hosts = set()
    for base in [settings.frontend_url, settings.app_base_url, *settings.cors_origins]:
        try:
            h = urlparse(base).hostname
            if h:
                allowed_hosts.add(h.lower())
        except ValueError as exc:
            log.debug("invalid_allowed_origin_host", base=base, error=str(exc))
    allowed_hosts.update({"dvttalent.com", "www.dvttalent.com", "dvt.com", "talent-ai.dvt.com"})

    target_host = (parsed.hostname or "").lower()
    is_trusted_host = (
        target_host in allowed_hosts
        or target_host.endswith(".dvttalent.com")
        or target_host.endswith(".dvt.com")
    )
    if raw_url == stored_microsite_url or is_trusted_host:
        return RedirectResponse(url=raw_url)

    raise HTTPException(status_code=400, detail="Untrusted redirect destination blocked")


# Basic liveness (also defined in health_routes but kept here for backwards compat with load balancers)
@app.get("/ping", tags=["Health"], include_in_schema=False)
async def ping():
    return {"pong": True}


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "DVT Talent AI API",
        "version": "1.0.0",
        "docs": "/api/docs",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)  # noqa: S104
