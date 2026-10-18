# Production Deployment & Containerization Guide

## Overview
DVT Talent AI can be deployed via Docker Compose for single-node environments or Kubernetes / ECS for multi-tenant enterprise production.

---

## 1. Docker Compose Architecture

The project includes container specifications in `docker-compose.yml`:

```
┌────────────────────────────────────────────────────────┐
│                   Docker Compose Stack                 │
└────────────────────────────────────────────────────────┘
          │                      │                 │
          ▼                      ▼                 ▼
   ┌─────────────┐        ┌─────────────┐   ┌─────────────┐
   │  frontend   │        │   backend   │   │  postgres   │
   │ (Port 3000) │        │ (Port 8000) │   │ (Port 5432) │
   └─────────────┘        └──────┬──────┘   └─────────────┘
                                 │
                                 ▼
                          ┌─────────────┐
                          │    redis    │
                          │ (Port 6379) │
                          └─────────────┘
```

### Services Breakdown

| Service | Base Image | Internal Port | External Port | Description |
|---|---|---|---|---|
| `frontend` | `node:18-alpine` | 3000 | 3000 | Next.js 14 production standalone build |
| `backend` | `python:3.11-slim` | 8000 | 8000 | FastAPI application managed via Uvicorn |
| `postgres` | `postgres:15-alpine` | 5432 | 5432 | Relational database storage |
| `redis` | `redis:7-alpine` | 6379 | 6379 | In-memory message bus and worker cache |

---

## 2. Launching with Docker Compose

### Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+

### Step-by-Step Launch

1. **Configure Environment Variables**:
   Copy `.env.example` to `.env` in the repository root:
   ```bash
   cp .env.example .env
   ```
   Provide strong credentials for `POSTGRES_PASSWORD`, `SECRET_KEY`, and at least one LLM key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`).

2. **Build and Run Containers**:
   ```bash
   docker compose up --build -d
   ```

3. **Verify Container Health**:
   ```bash
   docker compose ps
   ```

4. **Run Database Migrations Inside Container**:
   ```bash
   docker compose exec backend alembic upgrade head
   ```

5. **Access Application**:
   - Web Cockpit: `http://localhost:3000`
   - API Docs: `http://localhost:8000/docs`
   - API Health: `http://localhost:8000/health`

---

## 3. Production Hardening Checklist

When preparing for live production hosting (AWS, GCP, Azure, or Fly.io):

1. **Database & Persistence**:
   - Use managed database instances (AWS RDS PostgreSQL, Supabase, or GCP Cloud SQL) rather than containerized volumes.
   - Configure automatic daily snapshots and cross-region replication.
2. **Reverse Proxy & SSL/TLS**:
   - Terminate SSL using Cloudflare, AWS ALB, or Nginx with Let's Encrypt certificates.
   - Set `NEXT_PUBLIC_API_URL` to the public HTTPS domain (e.g., `https://api.talent-ai.dvt.com/api/v1`).
3. **Secrets Management**:
   - Store API keys, SMTP credentials, and encryption keys in AWS Secrets Manager, Vault, or GitHub Actions Secrets.
   - Never inject production secrets into Dockerfiles or commit `.env` to version control.
4. **Observability & Logging**:
   - Configure Sentry (`SENTRY_DSN`) for exception tracking and Logfire (`LOGFIRE_TOKEN`) for distributed trace telemetry.
   - Direct structured JSON logs to CloudWatch, Datadog, or Grafana Loki.
5. **CORS & Cookies**:
   - Set `CORS_ORIGINS` in backend environment strictly to the production frontend domain.
   - Ensure session cookies use `Secure; SameSite=Lax; HttpOnly`.
