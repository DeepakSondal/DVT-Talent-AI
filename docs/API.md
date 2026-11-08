# DVT Talent AI — API Reference & Conventions Guide
**Base URL:** `/api/v1`  
**Protocol:** RESTful HTTPS & WSS  
**Authentication:** HTTP Bearer JSON Web Tokens (JWT)  
**Version:** 2.0.0 (October 2026)  

---

## 1. Authentication & Dual-Persona Model

Every protected API request requires a JWT access token in the `Authorization` header:

```http
Authorization: Bearer <your_jwt_access_token>
Content-Type: application/json
```

The JWT access token encodes three key claims:
- `sub`: User ID (UUID)
- `tenant_id`: Organization tenancy identifier (required for recruiters, `null` for independent candidates)
- `role`: User role — `"recruiter"`, `"candidate"`, or `"admin"`

---

## 2. Standard Response Format

### Success Response
```json
{
  "status": "success",
  "data": { ... }
}
```
*(Direct resource objects or lists are also returned per standard FastAPI conventions).*

### Standard Error Response
```json
{
  "detail": "Descriptive human-readable error message explaining what failed."
}
```

---

## 3. Candidate Portal & Career-Ops API (`/api/v1/candidate-portal/*`)

These endpoints power the free B2C Candidate Portal and Career-Ops AI engine.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/candidate-portal/profile` | Retrieve candidate profile, skills, and privacy settings. |
| `PUT` | `/api/v1/candidate-portal/profile` | Update profile information, `is_searchable` toggle, and `hide_from_companies` blacklist. |
| `POST` | `/api/v1/candidate-portal/resume` | Upload and parse candidate resume (PDF, DOCX, or text). |
| `GET` | `/api/v1/candidate-portal/jobs` | Browse verified published jobs with ghost-job flags and 5-dimension match scores. |
| `POST` | `/api/v1/candidate-portal/jobs/{job_id}/apply` | Apply directly to an open job requisition with 5D fit score tracking. |
| `GET` | `/api/v1/candidate-portal/applications` | Track submitted applications, statuses, and historical match breakdowns. |
| `GET` | `/api/v1/candidate-portal/interview-prep/{job_id}` | Generate STAR behavioral interview coaching flashcards for a specific role. |
| `POST` | `/api/v1/candidate-portal/tailor-resume/{job_id}` | Generate zero-fabrication ATS resume optimization recommendations. |

### Example: Candidate Profile Update
```http
PUT /api/v1/candidate-portal/profile
Content-Type: application/json

{
  "title": "Staff Backend Engineer",
  "bio": "10+ years specializing in distributed systems and async Python.",
  "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes"],
  "location": "San Francisco, CA (Remote)",
  "is_searchable": true,
  "hide_from_companies": ["currentemployer.com", "stealthstartup.io"]
}
```

### Example: 5-Dimension Job Scoring Response
```json
{
  "job_id": "8f2a1b9c-...",
  "title": "Senior AI Systems Engineer",
  "company": "NextGen Robotics",
  "overall_score": 88,
  "is_ghost_job": false,
  "dimensions": {
    "title_alignment": 90,
    "tech_stack": 92,
    "experience": 85,
    "domain": 80,
    "culture": 90
  },
  "recommendations": [
    "Highlight your Celery and Redis queuing experience in your introduction.",
    "Mention previous Pytest and async test coverage achievements."
  ]
}
```

---

## 4. Recruiter & Agency Endpoints

### 4.1 Authentication & Registration
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/auth/register` | Register a new user (`role: "recruiter"` or `"candidate"`). |
| `POST` | `/api/v1/auth/login` | Authenticate with credentials and receive a role-aware JWT. |
| `POST` | `/api/v1/auth/refresh` | Refresh an expiring session token. |
| `GET` | `/api/v1/users/me` | Fetch authenticated user profile and permissions. |
| `POST` | `/api/v1/auth/sso/saml/login` | Initiate Enterprise SAML 2.0 Single Sign-On (Okta / Azure AD). |

### 4.2 Requisitions & Jobs
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/jobs` | List active job requisitions for the authenticated tenant. |
| `POST` | `/api/v1/jobs` | Create new job requisition and generate skill taxonomy. |
| `GET` | `/api/v1/jobs/{id}` | Retrieve requisition details and matching candidate pipeline. |
| `PUT` | `/api/v1/jobs/{id}` | Update requisition details or toggle `is_published` visibility. |

### 4.3 Autonomous Sourcing Swarm (`/api/v1/agents/*`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/agents/swarm/trigger` | Trigger an autonomous talent sourcing swarm for a requisition. |
| `GET` | `/api/v1/agents/tasks/{task_id}` | Check status and real-time outputs of an agent task. |
| `GET` | `/api/v1/agents/tasks` | List recent agent tasks with tenant scoping and pagination. |
| `POST` | `/api/v1/agents/swarm/signal` | Inject external signal into the multi-agent event bus. |

### 4.4 Human-in-the-Loop Copilot (`/api/v1/copilot/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/copilot/tasks/{task_id}/checkpoint` | Retrieve awaiting input checkpoint state (JD review, sourcing, outreach). |
| `POST` | `/api/v1/copilot/tasks/{task_id}/approve-discovery` | Submit edited Job Description and approve next stage (sourcing). |
| `POST` | `/api/v1/copilot/tasks/{task_id}/approve-sourcing` | Submit curated candidate list and approve sequence generation. |

### 4.5 Candidate Management (`/api/v1/candidates/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/candidates` | List candidates with score filtering, search, and pagination. |
| `POST` | `/api/v1/candidates` | Create or import candidate profile. |
| `GET` | `/api/v1/candidates/{id}` | Retrieve candidate profile, resume text, and AI match reasoning. |
| `POST` | `/api/v1/candidates/{id}/match` | Compute AI match score between candidate and job requisition. |
| `DELETE` | `/api/v1/candidates/{id}/pii` | GDPR Right-to-Erasure: permanently erase candidate personal data. |

### 4.6 Compliance & Governance (`/api/v1/compliance/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/compliance/policy-packs` | List active compliance packs (EEOC, NYC Local Law 144, EU AI Act). |
| `POST` | `/api/v1/compliance/adverse-impact/report` | Calculate 4/5ths rule adverse impact ratio between candidate demographic pools. |
| `GET` | `/api/v1/compliance/ledgers` | Fetch immutable AI decision ledger entries. |
| `POST` | `/api/v1/compliance/ledgers/{id}/override` | Record human reviewer override with mandatory rationale note. |

### 4.7 Billing & Credits (Dodo Payments) (`/api/v1/billing/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/billing/plans` | Fetch available subscription tiers and credit packs. |
| `GET` | `/api/v1/billing/credits` | Get current credit balance, active subscription, and ledger. |
| `POST` | `/api/v1/billing/create-checkout` | Create Dodo Payments Checkout session URL. |
| `POST` | `/api/v1/billing/portal` | Create Dodo Payments Customer Portal link for invoices. |
| `POST` | `/api/v1/billing/webhook-sync` | Internal Next.js synchronizer with `X-Internal-Secret`. |
| `POST` | `/api/v1/billing/webhook` | Direct Dodo Payments standard webhook receiver. |

### 4.8 Email Sender & OAuth 2.0 (`/api/v1/email-sender/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/email-sender` | Get current workspace connected OAuth sender mailbox status. |
| `POST` | `/api/v1/email-sender/oauth/{provider}/connect` | Connect Google Workspace / Microsoft 365 mailbox via OAuth 2.0. |
| `GET` | `/api/v1/email-sender/oauth/{provider}/callback` | Handle OAuth 2.0 authorization code exchange. |
| `POST` | `/api/v1/email-sender/test` | Send a test verification email using connected OAuth mailbox. |
| `DELETE` | `/api/v1/email-sender` | Disconnect OAuth mailbox and revert to Zero-Setup Relay fallback. |

### 4.9 Candidate Portal & Career-Ops (`/api/v1/candidate-portal/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/candidate-portal/profile` | Retrieve candidate profile and Privacy Shield blacklist. |
| `PATCH` | `/api/v1/candidate-portal/profile` | Update profile, salary requirements, and employer blacklist. |
| `POST` | `/api/v1/candidate-portal/resume` | Upload, parse structured CV text, and extract skills. |
| `GET` | `/api/v1/candidate-portal/jobs` | Browse jobs with Career-Ops 5-Dimension match scoring. |
| `POST` | `/api/v1/candidate-portal/jobs/{id}/apply` | 1-Click job application with match score snapshot. |
| `GET` | `/api/v1/candidate-portal/applications` | Kanban application tracking and timeline. |
| `POST` | `/api/v1/candidate-portal/interview-prep/{id}` | Generate tailored STAR interview rehearsal flashcards. |

### 4.10 Team Management (`/api/v1/team/*`)
| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/team/invite` | Send single-use, role-governed team invitation link. |
| `GET` | `/api/v1/team/members` | List recruiters and team members under manager. |
| `GET` | `/api/v1/team/analytics` | View team-level sourcing and credit consumption analytics. |
| `GET` | `/api/v1/team/candidates` | List candidates sourced across the manager's team. |
| `GET` | `/api/v1/team/keys` | Retrieve masked team BYOK API keys. |
| `POST` | `/api/v1/team/keys` | Save encrypted team BYOK API keys (OpenAI, Serper, Anthropic). |

### 4.11 ATS Integrations (`/api/v1/integrations/*`)
| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/integrations/connections` | List active ATS connections (Greenhouse, CEIPAL). |
| `POST` | `/api/v1/integrations/connect` | Connect ATS with encrypted credentials and sync settings. |
| `POST` | `/api/v1/integrations/{provider}/sync-jobs` | Synchronize active requisitions from ATS into DVT Talent AI. |
| `POST` | `/api/v1/integrations/{provider}/export-candidate` | Export sourced candidate into ATS candidate pipeline. |

---

## 5. Real-Time Telemetry (WebSocket)

- **Endpoint:** `ws://127.0.0.1:8000/api/v1/ws/live`
- **Protocol:** JSON message streams
- **Message Format:**
```json
{
  "type": "agent_signal",
  "agent": "sourcing",
  "message": "Sourced 12 candidates matching AI Engineer constraints from GitHub and LinkedIn.",
  "timestamp": "2026-10-18T10:00:00Z"
}
```

---

## 6. Deprecated & Legacy Endpoints

- `/api/v1/leads/*`: Marked as **Deprecated**. Lead generation features have been removed from frontend navigation and redirected to Candidate/Job pipelines.
