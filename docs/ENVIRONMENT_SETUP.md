# DVT Talent AI — Environment Setup & Local Development Guide
**Version:** 1.0.0  
**Updated:** October 2026  

This guide provides step-by-step instructions for running **DVT Talent AI** on local workstations (Windows PowerShell, Linux/macOS) and with Docker Compose.

---

## 1. System Prerequisites

| Component | Minimum Version | Recommended Version | Notes |
|---|---|---|---|
| **Python** | 3.11+ | 3.11.x or 3.12.x | Tested with Python 3.11 / 3.14 |
| **Node.js** | 18.17+ | 20.x LTS | Recommended for Next.js 14 |
| **npm** | 9.x+ | 10.x | Package manager |
| **Git** | 2.30+ | Latest | Version control |
| **Docker (Optional)** | 24.0+ | Latest | For containerized development |
| **Redis (Optional)** | 6.2+ | 7.x | Required for Celery background jobs & live pub/sub |

---

## 2. Windows Local Development (PowerShell)

### Step 2.1: Clone the Repository
```powershell
git clone https://github.com/your-org/dvt-talent-ai.git
cd dvt-talent-ai
```

### Step 2.2: Backend Setup
1. Navigate to the `backend` folder and create a Python virtual environment:
   ```powershell
   cd backend
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
2. Upgrade `pip` and install dependencies:
   ```powershell
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```
3. Create your local environment configuration:
   ```powershell
   Copy-Item .env.example .env
   ```
4. Verify critical environment settings in `backend\.env`:
   ```dotenv
   APP_ENV=development
   DATABASE_URL=sqlite+aiosqlite:///./dvt_talent.db
   SECRET_KEY=change-this-in-production-to-a-secure-secret-key-min-32-chars
   GROQ_API_KEY=gsk_...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Seed or initialize the local database:
   ```powershell
   python -c "import asyncio; from db.models import Base, engine; asyncio.run(engine.begin().then(lambda c: c.run_sync(Base.metadata.create_all)))"
   ```
   Or initialize admin user:
   ```powershell
   python create_admin.py
   ```
6. Start the FastAPI development server:
   ```powershell
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```
   *The backend will be available at `http://127.0.0.1:8000` with Swagger documentation at `http://127.0.0.1:8000/docs`.*

### Step 2.3: Frontend Setup
1. Open a new PowerShell terminal, navigate to `frontend`, and install npm dependencies:
   ```powershell
   cd frontend
   npm install
   ```
2. Create frontend environment configuration:
   ```powershell
   Copy-Item .env.example .env.local
   ```
3. Start the Next.js development server:
   ```powershell
   npm run dev
   ```
   *The application will be accessible at `http://localhost:3000`:*
   - **Candidate Portal:** `http://localhost:3000/portal`
   - **Recruiter Command Center:** `http://localhost:3000/dashboard`

---

## 3. Docker Compose Development

To run the complete stack (FastAPI, Next.js, PostgreSQL, Redis, Celery Worker, Celery Beat, ChromaDB):

1. Copy the root environment file:
   ```bash
   cp .env.example .env
   ```
2. Populate your AI provider keys in `.env`:
   ```dotenv
   GROQ_API_KEY=gsk_...
   ANTHROPIC_API_KEY=sk-ant-...
   OPENAI_API_KEY=sk-...
   ```
3. Launch the container cluster:
   ```bash
   docker compose up --build -d
   ```
4. Check running services:
   ```bash
   docker compose ps
   ```
5. Tail service logs:
   ```bash
   docker compose logs -f api
   ```

### Default Port Mappings in Docker
- **Frontend App:** `http://localhost:3000`
- **FastAPI API:** `http://localhost:8000`
- **FastAPI Docs:** `http://localhost:8000/docs`
- **PostgreSQL Database:** `localhost:5432`
- **Redis Cache & Broker:** `localhost:6379`
- **ChromaDB Vector Store:** `localhost:8001`

---

## 4. Running Automated Tests

### Backend Unit & Integration Tests (pytest)
```powershell
cd backend
.\venv\Scripts\Activate.ps1
python -m pytest -v
```

### Frontend Type Safety Check
```powershell
cd frontend
npm run type-check
```

### Frontend Code Quality & Linting
```powershell
cd frontend
npm run lint
```

### Frontend Production Build
```powershell
cd frontend
npm run build
```

---

## 5. Troubleshooting Common Issues

### Issue 1: `Script Execution Disabled` in PowerShell
If activating the virtual environment throws an `ExecutionPolicy` error:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Issue 2: `DATABASE_URL is missing`
Ensure `backend/.env` exists and contains a valid connection string:
- SQLite: `DATABASE_URL=sqlite+aiosqlite:///./dvt_talent.db`
- PostgreSQL: `DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/dvt_talent`

### Issue 3: Rate Limiting on Free AI Keys
Configure multiple AI providers in `backend/.env`. The orchestrator prioritizes:
`Anthropic (Claude 3.5 Sonnet)` -> `Groq (Llama 3.3 70B)` -> `OpenAI (GPT-4o)` -> `Kimi` -> `DeepSeek`.
If a provider returns HTTP 429, the orchestrator automatically applies exponential backoff and retries.
