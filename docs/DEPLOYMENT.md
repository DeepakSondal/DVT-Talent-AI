# Production Deployment & Containerization Guide
**Version:** 2.1.0 (October 2026)  
**Status:** Production Ready  

---

## 1. Overview & Multi-Stack Architecture

DVT Talent AI provides two standardized container stacks:
1. **Production Stack (`docker-compose.prod.yml`)**: Full enterprise configuration with Caddy reverse proxy, automated SSL/TLS, PostgreSQL 16 on persistent volumes, Redis 7 message bus, Next.js frontend, FastAPI API gateway, Celery worker, and Celery Beat scheduler.
2. **Testing / Staging Stack (`docker-compose.yml`)**: Rapid development and testing configuration featuring PostgreSQL 15 (`dvt_staging`), Redis, and local development fixtures.

---

## 2. Production Topology (`docker-compose.prod.yml`)

```
┌────────────────────────────────────────────────────────┐
│                   Caddy Proxy (dvt-proxy)              │
│                (Ports: 80, 443 - Auto HTTPS)           │
└───────────────────────────┬────────────────────────────┘
                            │
         ┌──────────────────┴──────────────────┐
         ▼ (/*)                                ▼ (/api/*, /ws/*)
┌─────────────────┐                   ┌─────────────────┐
│ Next.js Web App │                   │ FastAPI Gateway │
│   (frontend)    │                   │      (api)      │
│   (Port 3000)   │                   │   (Port 8000)   │
└─────────────────┘                   └────────┬────────┘
                                               │
         ┌───────────────────────┬─────────────┴─────────────┐
         ▼                       ▼                           ▼
┌─────────────────┐     ┌─────────────────┐         ┌─────────────────┐
│  PostgreSQL 16  │     │  Celery Worker  │         │  Redis 7 Bus    │
│    (dvt_db)     │     │  (dvt-worker)   │◄───────►│   (dvt_redis)   │
│  (Port 5432)    │     └────────┬────────┘         │   (Port 6379)   │
│ (Volume: prod)  │              │                  └────────┬────────┘
└─────────────────┘     ┌────────┴────────┐                  │
                        │   Celery Beat   │                  │
                        │ (dvt-scheduler) │──────────────────┘
                        └─────────────────┘
```

### Production Services Matrix:

| Container Name | Service | Base Image | Role | Port Mapping |
|---|---|---|---|---|
| `dvt-proxy` | `proxy` | `caddy:alpine` | Automated TLS, compression, reverse proxy | `80:80`, `443:443` |
| `dvt-frontend` | `frontend` | `node:18-alpine` | Next.js 14 App Router production bundle | `3000` (internal) |
| `dvt-api` | `api` | `python:3.11-slim` | FastAPI async API gateway | `8000` (internal) |
| `dvt_db` | `postgres` | `postgres:16-alpine` | Production database (`dvt_talent`, volume `postgres_prod_data`) | `5432` (internal) |
| `dvt_redis` | `redis` | `redis:7-alpine` | Cache, Celery broker, WebSocket Pub/Sub | `6379` (internal) |
| `dvt-worker` | `worker` | `python:3.11-slim` | Background Celery task processing | None |
| `dvt-scheduler` | `scheduler` | `python:3.11-slim` | Celery Beat periodic job scheduler | None |

---

## 3. Staging / Testing Stack (`docker-compose.yml`)

Used for automated integration testing, CI pipelines, and local development:
- **Database Container:** `dvt-postgres` (PostgreSQL 15 Alpine).
- **Database Name:** `dvt_staging` on exposed host port `5432:5432`.
- **Purpose:** Isolated testing environment with pre-seeded fixtures that guarantees production `dvt_talent` data is never touched or polluted during test execution.

---

## 4. Production Deployment Step-by-Step

### 4.1 Prerequisites
- Docker Engine 24.0+ and Docker Compose v2.20+
- Valid public domain pointing to the host server IP (for automated Let's Encrypt certificates)

### 4.2 Configuration
Create and configure your production `.env` file:
```bash
cp .env.example .env
```

Ensure critical variables are set:
```ini
# Production Environment
APP_ENV=production
SECRET_KEY=generate_a_64_character_random_hex_string

# PostgreSQL 16 Production DB
DATABASE_URL=postgresql+asyncpg://postgres:your_secure_password@postgres:5432/dvt_talent
DATABASE_SYNC_URL=postgresql://postgres:your_secure_password@postgres:5432/dvt_talent

# Redis 7 Bus
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# Object Storage Driver (local or s3)
STORAGE_DRIVER=s3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET_NAME=dvt-talent-production-resumes

# Inference API Keys
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
SERPER_API_KEY=your_serper_key
```

### 4.3 Launching the Stack
1. **Build and start all production containers:**
   ```bash
   docker compose -f docker-compose.prod.yml up --build -d
   ```

2. **Execute Alembic database migrations:**
   ```bash
   docker compose -f docker-compose.prod.yml exec api alembic upgrade head
   ```

3. **Verify container health:**
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

4. **Verify API health:**
   ```bash
   curl -k https://localhost/ping
   curl -k https://localhost/health
   ```

---

## 5. Maintenance & Observability

1. **Viewing Live Container Logs:**
   ```bash
   # All services
   docker compose -f docker-compose.prod.yml logs -f

   # Specifically the Celery AI worker
   docker compose -f docker-compose.prod.yml logs -f worker
   ```

2. **Metrics & Prometheus Scrapes:**
   - Prometheus scrape endpoint is accessible at `https://<domain>/metrics`.
   - Metrics include HTTP request latency, active WebSocket connections, Celery task throughput, and LLM guardrail token consumption.

3. **Database Backups:**
   ```bash
   docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres dvt_talent > backups/dvt_talent_$(date +%Y%m%d_%H%M%S).sql
   ```
