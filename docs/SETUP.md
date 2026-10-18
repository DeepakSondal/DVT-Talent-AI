# DVT Talent AI — Complete Setup & Deployment Guide
**Version:** 2.0.0 (October 2026)  

---

## 1. System Requirements

- **Local Development**:
  - Python 3.11+ / Python 3.14
  - Node.js 18+ or 20+ (with npm)
  - Git
  - *(Optional)* Docker Desktop & Redis
- **Production VPS (Recommended Minimum)**:
  - 4 vCPU Cores
  - 8 GB RAM
  - 50 GB+ SSD Disk
  - Ubuntu 22.04 / 24.04 LTS

---

## 2. Local Development Setup (Quick Start)

### Step 1: Clone Repository
```powershell
git clone https://github.com/yourorg/dvt-talent-ai.git
cd dvt-talent-ai
```

### Step 2: Backend Setup (FastAPI & Pydantic AI)
```powershell
cd backend

# Create and activate Python virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1

# Install Python dependencies
pip install -r requirements.txt

# Configure environment variables
Copy-Item .env.example .env
```

Edit `backend/.env` with your preferred LLM provider key:
```env
# Primary LLM API Key (at least one required)
OPENAI_API_KEY=sk-...
# OR
GROQ_API_KEY=gsk_...
# OR
ANTHROPIC_API_KEY=sk-ant-...

# Search & Sourcing (optional for local mock testing)
SERPER_API_KEY=...
GITHUB_TOKEN=ghp_...

# Database (Default uses local SQLite; set PostgreSQL URL for prod)
DATABASE_URL=sqlite+aiosqlite:///../dvt_talent.db

# JWT Secret
SECRET_KEY=generate_a_secure_random_hex_key_here
```

Run database migrations:
```powershell
python -m alembic upgrade head
# Or run direct initialization script
python run_migration.py
```

Start the FastAPI backend server:
```powershell
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```
- API is running at: `http://127.0.0.1:8000`
- Interactive OpenAPI Docs: `http://127.0.0.1:8000/api/docs`

---

### Step 3: Frontend Setup (Next.js 14 App Router)

In a separate terminal window:
```powershell
cd frontend

# Install npm dependencies
npm install --legacy-peer-deps

# Configure frontend environment
Copy-Item .env.example .env.local
```

Verify `frontend/.env.local` contains:
```env
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/api/v1/ws/live
```

Start Next.js dev server:
```powershell
npm run dev
```

- **Candidate Portal:** `http://localhost:3000/portal` (or `http://localhost:3001/portal` if 3000 is occupied)
- **Recruiter Command Center:** `http://localhost:3000/dashboard`
- **Landing Page:** `http://localhost:3000`

---

## 3. Docker Compose Setup

To launch the full containerized stack locally:

```bash
# Copy root environment file
cp .env.example .env

# Build and start all services
docker compose up --build -d
```

### Services Launched:
- `backend`: FastAPI API server on port 8000
- `frontend`: Next.js web application on port 3000
- `postgres`: PostgreSQL 15 database on port 5432
- `redis`: Redis cache & event bus on port 6379

Verify running containers:
```bash
docker compose ps
```

---

## 4. Production VPS Deployment

### 1. Provision Host
Ensure your VPS has Docker and Docker Compose v2 installed:
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

### 2. Clone & Configure
```bash
git clone https://github.com/yourorg/dvt-talent-ai.git /opt/dvt-talent-ai
cd /opt/dvt-talent-ai

cp .env.example .env
# Fill in domain, PostgreSQL passwords, and production secrets
nano .env
```

### 3. Launch Production Stack
```bash
docker compose -f docker-compose.prod.yml up --build -d
```

### 4. Automated HTTPS with Caddy
The included `Caddyfile` handles automated Let's Encrypt SSL/TLS certificates and reverses proxy traffic to Next.js (port 3000) and FastAPI (port 8000).

---

## 5. Decommissioned Service Configurations

- **MarketPulse / Celery Beat**: Periodic market scraping loops have been removed from backend startup.
- **Twilio Voice AI**: Voice routes are unmounted; no telephony credentials are required.
