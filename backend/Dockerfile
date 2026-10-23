# ─────────────────────────────────────────────────────────────────
# DVT Talent AI — Backend Dockerfile
# Multi-stage build for production
# ─────────────────────────────────────────────────────────────────

FROM python:3.11-slim AS base

# System dependencies (including libxmlsec1 for Enterprise SAML SSO)
RUN apt-get update && apt-get install -y \
    gcc g++ libpq-dev curl libmagic1 \
    pkg-config libxml2-dev libxmlsec1-dev libxmlsec1-openssl xmlsec1 \
    && rm -rf /var/lib/apt/lists/*

# Python environment
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# Copy application code
COPY . .


# Create non-root user with a writable home directory and persistent storage directories
RUN addgroup --gid 1001 appgroup \
    && adduser --uid 1001 --gid 1001 --home /home/appuser --disabled-password appuser \
    && mkdir -p /home/appuser /app/storage /app/uploads/resumes \
    && chown -R appuser:appgroup /app /home/appuser

ENV HOME=/home/appuser

USER appuser

# ── API Server ────────────────────────────────────────────────────
FROM base AS api
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# ── Celery Worker ─────────────────────────────────────────────────
FROM base AS worker
CMD ["celery", "-A", "workers.celery_app", "worker", "--loglevel=info", "--concurrency=4", "--queues=default"]

# ── Celery Beat (Scheduler) ───────────────────────────────────────
FROM base AS scheduler
CMD ["celery", "-A", "workers.celery_app", "beat", "--loglevel=info", "--scheduler", "celery.beat:PersistentScheduler"]
