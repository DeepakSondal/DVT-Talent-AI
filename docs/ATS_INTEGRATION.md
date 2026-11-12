# DVT Talent AI — ATS Integration Guide

This document explains how to connect Greenhouse and Ceipal to DVT Talent AI for two‑way candidate sync.

---

## Overview

DVT Talent AI supports native two-way sync with:

| Provider | Auth Method | Supported Operations |
|---|---|---|
| **Greenhouse** | HTTP Basic (API Key) | List jobs, Create candidates, Get application status |
| **Ceipal** | X-API-Key Header | List jobs, Create applicants, Get applicant status |

All API keys are **encrypted at rest** using the Fernet cipher (AES-128-CBC) tied to your `SECRET_KEY`. Keys are never exposed in API responses.

---

## Getting Your API Keys

### Greenhouse

1. Log in to [app.greenhouse.io](https://app.greenhouse.io)
2. Go to **Configure** → **Dev Center** → **API Credential Management**
3. Click **Create New API Key**
4. Select **Permissions:**
   - ✅ `jobs` (read)
   - ✅ `candidates` (create)
   - ✅ `applications` (read)
5. Copy the generated key — **you can only see it once**

> [!NOTE]
> Greenhouse API keys are scoped to your organization. The `On-Behalf-Of` header is set automatically by DVT Talent AI to your tenant ID for audit compliance.

### Ceipal

1. Log in to [app.ceipal.com](https://app.ceipal.com)
2. Go to **Administration** → **Settings** → **API Configuration**  
3. Click **Generate API Key**
4. Note your **Base URL** — it may be region-specific (e.g. `https://api.ceipal.com/v1` or `https://eu.api.ceipal.com/v1`)
5. Copy the API key

---

## Configuring in DVT Talent AI

### Option A: Through the UI (Recommended)

1. Open your DVT Dashboard → **Settings** → **Integrations**
2. Select the **Greenhouse** or **Ceipal** tab
3. Paste your API key into the masked input field
4. (Ceipal only) Enter your Base URL if it differs from the default
5. Toggle **"Auto-export top candidates (score > 80)"** if desired
6. Click **Connect** — DVT will test the connection before saving

### Option B: Environment Variables (CI/CD)

Set in your `backend/.env`:
```env
GREENHOUSE_API_KEY=your_key_here
CEIPAL_API_KEY=your_key_here
CEIPAL_API_BASE_URL=https://api.ceipal.com/v1
```

Then connect via the API:
```bash
curl -X POST http://localhost:8000/api/v1/integrations/greenhouse/connect \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_key", "auto_export_enabled": true}'
```

---

## How Two-Way Sync Works

### Job Sync (ATS → DVT)

```
Scheduler (Celery Beat) or Manual Trigger
        ↓
sync_all_ats_jobs(tenant_id)
        ↓
GreenhouseClient.list_jobs() / CeipalClient.list_jobs()
        ↓
Upsert into Job table (keyed on external_id)
        ↓  
Available in Pipeline and Run Agents pages
```

**Trigger manually:**
```bash
POST /api/v1/integrations/greenhouse/sync-jobs
```

**Auto sync:** Every 6 hours via Celery Beat scheduler (configurable).

### Candidate Export (DVT → ATS)

```
SourcingAgent scores a candidate > 80
        ↓
auto_export_enabled check for each connected ATS
        ↓
export_candidate_task.delay() [Celery, fire-and-forget]
        ↓
GreenhouseClient.create_candidate() / CeipalClient.create_candidate()
        ↓
External ID stored in ATSExportLog
```

**Trigger manually:**
```bash
POST /api/v1/integrations/greenhouse/export
{
  "candidate_id": "uuid-of-candidate",
  "job_id": "uuid-of-job"
}
```

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/integrations/{provider}/connect` | Save API key, test, and activate connection |
| `DELETE` | `/integrations/{provider}/disconnect` | Deactivate integration |
| `GET` | `/integrations/{provider}/status` | Get connection status and last sync time |
| `GET` | `/integrations/{provider}/jobs` | Cached jobs from last sync |
| `POST` | `/integrations/{provider}/sync-jobs` | Trigger manual job sync (async) |
| `POST` | `/integrations/{provider}/export` | Push candidate to ATS (async) |
| `GET` | `/integrations/{provider}/export-logs` | View recent export history |

**Supported providers:** `greenhouse`, `ceipal`

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid API key on connect | HTTP 401 returned — key NOT saved |
| ATS API rate limit (429) | Exponential backoff via `tenacity` (3 retries, 2s → 30s) |
| ATS API network timeout | Retry with backoff, Sentry error captured |
| Duplicate candidate in ATS | Gracefully returns `status: "exists"` — no crash |
| Missing `SENTRY_DSN` | Errors logged via structlog only |

---

## Running Tests

```bash
# Unit tests (no real API keys needed)
pip install pytest-httpx
pytest tests/test_ats_integrations.py -v

# Integration tests (requires real API keys in .env)
GREENHOUSE_API_KEY=your_key pytest tests/test_ats_integrations.py -v -m integration
CEIPAL_API_KEY=your_key pytest tests/test_ats_integrations.py -v -m integration
```

---

## File Structure

```
backend/integrations/
├── ats_base.py                    # Original BaseATS abstract class
├── unified_ats.py                 # Orchestration: sync_jobs, export_candidate, factory
├── greenhouse/
│   ├── __init__.py
│   └── client.py                  # GreenhouseClient (Harvest API v1)
└── ceipal/
    ├── __init__.py
    └── client.py                  # CeipalClient (TalentHire REST API)

backend/api/routes/
└── integrations.py                # All /integrations/* endpoints

backend/workers/
└── ats_tasks.py                   # Celery: sync_all_ats_jobs, export_candidate_task

backend/migrations/versions/
└── 0001_initial_schema.py         # Baseline schema including integration_connections + ats_export_logs

frontend/src/app/dashboard/settings/integrations/
└── page.tsx                       # Provider tabs, key form, jobs list, export logs
```
