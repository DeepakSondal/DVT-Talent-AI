"""
DVT Talent AI — FastAPI Application Entry Point
"""
import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from prometheus_client import make_asgi_app

from config import settings
from db.models import Base, engine, get_db
from api.routes import auth, auth_social, users, companies, leads, candidates, jobs, campaigns, analytics, agents, websocket

log = structlog.get_logger()

# ── Lifespan ──────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("dvt_startup", env=settings.app_env)

    # FIX [H-05]: Warn about missing critical settings at startup
    warnings = settings.validate_required_settings()
    for w in warnings:
        log.warning("config_warning", message=w)

    # Create tables (use Alembic for production migrations)
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        log.info("database_initialized")
    except Exception as e:
        log.warning("database_initialization_race_or_already_exists", error=str(e))
    yield
    await engine.dispose()
    log.info("dvt_shutdown")


# ── App ───────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="DVT Talent AI API",
    description="Autonomous AI Recruiting & Sales Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.is_production else None,
    redoc_url="/api/redoc" if not settings.is_production else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Middleware ────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    # FIX [M-04]: Restrict to explicit methods/headers instead of wildcard
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    log.info("request", method=request.method, path=request.url.path)
    response = await call_next(request)
    log.info("response", status=response.status_code, path=request.url.path)
    return response


# ── Routes ────────────────────────────────────────────────────────────────
PREFIX = "/api/v1"

app.include_router(auth.router,       prefix=f"{PREFIX}/auth",       tags=["Authentication"])
app.include_router(auth_social.router, prefix=f"{PREFIX}/auth",       tags=["Social Authentication"])
app.include_router(users.router,      prefix=f"{PREFIX}/users",      tags=["Users"])
app.include_router(companies.router,  prefix=f"{PREFIX}/companies",  tags=["Companies"])
app.include_router(leads.router,      prefix=f"{PREFIX}/leads",      tags=["Leads"])
app.include_router(candidates.router, prefix=f"{PREFIX}/candidates", tags=["Candidates"])
app.include_router(jobs.router,       prefix=f"{PREFIX}/jobs",       tags=["Jobs"])
app.include_router(campaigns.router,  prefix=f"{PREFIX}/campaigns",  tags=["Campaigns"])
app.include_router(analytics.router,  prefix=f"{PREFIX}/analytics",  tags=["Analytics"])
app.include_router(agents.router,     prefix=f"{PREFIX}/agents",     tags=["Agents"])
app.include_router(websocket.router,  prefix=f"{PREFIX}/ws",         tags=["WebSocket"])

# ── Email Open Tracking (no auth — called by email clients) ──────────────
from fastapi.responses import Response as FastAPIResponse
import uuid as _uuid

@app.get("/api/v1/track/{tracking_id}/open", include_in_schema=False)
async def track_email_open(tracking_id: _uuid.UUID, db=Depends(get_db)):
    """
    FIX [C-07]: Email open-tracking pixel endpoint.
    Called when recipient opens an email with embedded tracking pixel.
    Returns a 1x1 transparent GIF.
    """
    from sqlalchemy import update
    from datetime import datetime as _dt
    from db.models import EmailSent, EmailStatus

    try:
        await db.execute(
            update(EmailSent)
            .where(EmailSent.tracking_id == str(tracking_id))
            .where(EmailSent.opened_at.is_(None))
            .values(opened_at=_dt.utcnow(), status=EmailStatus.OPENED)
        )
        await db.commit()
    except Exception:
        pass  # Never fail on tracking — silent

    # 1×1 transparent GIF
    gif = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04\x00\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
    return FastAPIResponse(content=gif, media_type="image/gif")

# ── Metrics ───────────────────────────────────────────────────────────────
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)


# ── Health ────────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "dvt-talent-ai", "version": "1.0.0"}


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": "DVT Talent AI API",
        "version": "1.0.0",
        "docs": "/api/docs",
    }
