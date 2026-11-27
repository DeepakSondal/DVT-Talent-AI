# Zero-VPS Free Cloud Deployment Guide — DVT Talent AI

This repo is configured for a **\$0/month free-tier stack** with Cloudflare at the edge:

| Layer | Provider | Target |
| :--- | :--- | :--- |
| **Edge DNS, SSL, DMARC, WAF, Web Analytics** | Cloudflare Free | `dvttalent.com` (Zone `6911e1d396a5d65357d83c4965ebb389`) |
| **Frontend (Next.js 16)** | Cloudflare Workers (`@opennextjs/cloudflare`) | `https://dvttalent.com`, `https://www.dvttalent.com` |
| **Backend (FastAPI)** | Render Free Web Service (`render.yaml`) | `https://api.dvttalent.com` |
| **Database (PostgreSQL + `pgvector`)** | Supabase Free (`dvt-talent-ai`, `obwfdjdxwarlhtdxmeta`, `us-east-1`) | `vector` extension enabled |
| **Cache / Rate Limit / Token Revocation** | Upstash Redis Free | `rediss://...` |
| **Resume Object Storage** | Cloudflare R2 Free (10 GB/mo, \$0 egress) | `dvt-talent-resumes` (`services/r2_storage.py`) |
| **Local Dev Tunnel** | Cloudflare Tunnel (`cloudflared`) | `https://dev-api.dvttalent.com` → `http://localhost:8000` |

---

## 1. Deploy Next.js Frontend to Cloudflare Workers

```bash
cd frontend
npm run cf:deploy
```

This builds with `@opennextjs/cloudflare` and deploys to `https://dvttalent.com` and `https://www.dvttalent.com` via `frontend/wrangler.jsonc`.

## 2. Run Database Migrations on Supabase

Copy your Supabase **Session Pooler** Postgres URI from the Supabase Dashboard (`obwfdjdxwarlhtdxmeta` → Settings → Database), then run:

```powershell
cd backend
$env:DATABASE_URL="postgresql+asyncpg://postgres.<ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?ssl=require"
$env:DATABASE_SYNC_URL="postgresql://postgres.<ref>:<password>@aws-0-us-east-1.pooler.supabase.com:5432/postgres?sslmode=require"
.\venv\Scripts\python.exe -m alembic upgrade head
```

## 3. Deploy FastAPI Backend on Render

1. Open [Render Blueprints](https://dashboard.render.com/blueprints) and select `DeepakSondal/DVT-Talent-AI`.
2. Render reads `render.yaml` and creates `dvt-talent-ai-api` (Free tier, `virginia`).
3. Populate the `sync: false` secrets in Render → Environment:
   - `DATABASE_URL` & `DATABASE_SYNC_URL` (Supabase)
   - `REDIS_URL` (Upstash `rediss://...`)
   - `ENCRYPTION_KEY` (Fernet key)
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`
   - *(Optional once R2 is activated)* `R2_ENDPOINT_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`
4. In Cloudflare DNS, add a **Proxied CNAME** `api.dvttalent.com` → `<your-service>.onrender.com`, and add `api.dvttalent.com` as a Custom Domain in Render.

## 4. Free Local Machine Cloudflare Tunnel (Optional Dev / Demo)

Install `cloudflared` (`winget install --id Cloudflare.cloudflared`) and run:

```powershell
# Instant temporary HTTPS URL (no setup needed):
cloudflared tunnel --url http://localhost:8000

# Or persistent named tunnel bound to dev-api.dvttalent.com:
cloudflared tunnel login
cloudflared tunnel create dvt-local-dev
cloudflared tunnel route dns dvt-local-dev dev-api.dvttalent.com
cloudflared tunnel run --url http://localhost:8000 dvt-local-dev
```

## 5. Enable Cloudflare R2 Resume Storage (10 GB/mo Free)

1. In Cloudflare Dashboard → **R2 Object Storage**, activate R2 and create a private bucket named `dvt-talent-resumes`.
2. Create an R2 API Token scoped to `dvt-talent-resumes` (`Object Read & Write`).
3. Set `R2_BUCKET_NAME`, `R2_ENDPOINT_URL` (`https://62e2878288cae527f5d369fbe953b675.r2.cloudflarestorage.com`), `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` in Render Environment.
4. `ResumeParserService` automatically writes resumes to `r2://dvt-talent-resumes/resumes/...`, streams downloads from R2, and purges R2 objects on GDPR Article 17 erasure.
