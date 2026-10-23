# Database Architecture & Schema Reference
**Version:** 2.1.0 (October 2026)  
**Database Engines:** 
- **Production:** PostgreSQL 16 Alpine (`dvt_db`, database `dvt_talent`, volume `postgres_prod_data`)
- **Staging / Testing:** PostgreSQL 15 Alpine (`dvt-postgres`, database `dvt_staging`, host port 5432)
**ORM:** Async SQLAlchemy 2.0 with Alembic Migrations  

---

## 1. Overview & Dual-Persona Entity Relationships

DVT Talent AI supports both **B2B Multi-Tenant Recruiter Workspaces** and an **Independent Candidate Talent Network (Career-Ops)** within a unified relational schema.

```
                           ┌──────────────────┐
                           │     Tenants      │ (Agency / Employer)
                           └────────┬─────────┘
                                    │ 1:N
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌──────────────┐             ┌──────────────┐            ┌──────────────┐
│    Users     │◄────────────┤    Teams     │            │  Companies   │
└──────┬───────┘             └──────────────┘            └──────┬───────┘
       │                                                        │
       │ (1:1 candidate link)                                   ▼
       │                                                 ┌──────────────┐
       │                                                 │    Jobs      │
       │                                                 └──────┬───────┘
       │                                                        │
       ▼                                                        ▼
┌──────────────┐                                         ┌──────────────┐
│  Candidates  │◄────────────────────────────────────────┤JobCandidates │
└──────────────┘                                         └──────────────┘
```

---

## 2. Table Specifications & Column Reference

The schema contains **26 relational tables** and **8 custom PostgreSQL enums**:

### Custom Enums:
1. `UserRole`: `admin`, `manager`, `recruiter`, `viewer`, `candidate`
2. `LeadStatus`: `new`, `contacted`, `qualified`, `proposal`, `negotiation`, `won`, `lost`
3. `CandidateStatus`: `sourced`, `applied`, `screened`, `contacted`, `interested`, `interviewing`, `offered`, `placed`, `rejected`
4. `EmailStatus`: `draft`, `scheduled`, `sent`, `opened`, `clicked`, `replied`, `bounced`, `unsubscribed`
5. `InterviewStatus`: `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show`
6. `AgentTaskStatus`: `pending`, `running`, `awaiting_input`, `completed`, `failed`, `retrying`
7. `InvitationStatus`: `pending`, `accepted`, `revoked`, `expired`
8. `CreditTransactionType`: `credit`, `debit`, `refund`

### Core Table Matrix:
| Table | Purpose | Key Columns | Constraints & Indexes |
|---|---|---|---|
| `tenants` | Agency/Enterprise workspace tenancy | `id`, `name`, `domain`, `stripe_customer_id`, `credits_balance`, `smtp_host`, `smtp_user`, `smtp_password_encrypted` | Primary key, unique index on `domain` |
| `teams` | Functional recruiter teams within a tenant | `id`, `tenant_id`, `name`, `manager_id`, `default_credit_limit` | FK `manager_id -> users.id` (`use_alter=True`) |
| `team_api_keys` | Encrypted BYOK credentials per team | `id`, `team_id`, `openai_key`, `serper_key`, `anthropic_key` | FK `team_id -> teams.id`, encrypted at rest |
| `team_invitations` | Cryptographic team invite tokens | `id`, `tenant_id`, `email`, `role`, `token_hash`, `status`, `expires_at` | Unique index on `token_hash`, index on `email` |
| `users` | User credentials & authentication | `id`, `tenant_id` *(nullable)*, `email`, `role`, `hashed_password`, `is_active` | Unique index on `email`, index on `tenant_id` |
| `candidates` | Talent profiles & career dossier | `id`, `tenant_id` *(nullable)*, `user_id`, `email`, `score`, `is_searchable`, `hide_from_companies`, `pii_erased` | Partial unique `(tenant_id, email) WHERE tenant_id IS NOT NULL`, FK `user_id -> users.id` |
| `jobs` | Open requisitions & JD specifications | `id`, `tenant_id`, `company_id`, `title`, `description`, `is_published`, `is_active` | Index on `tenant_id`, index on `is_published` |
| `job_candidates` | Association between jobs & candidates | `id`, `tenant_id`, `job_id`, `candidate_id`, `status`, `applied_by_candidate`, `career_ops_scoring` | Composite unique `(job_id, candidate_id)` |
| `companies` | Prospective and client employer entities | `id`, `tenant_id`, `name`, `domain`, `industry`, `size`, `score` | Unique index on `domain`, index on `score` |
| `resumes` | Candidate resume files and parsed AST | `id`, `tenant_id`, `candidate_id`, `file_url`, `raw_text`, `parsed_data` | FK `candidate_id -> candidates.id` |
| `email_campaigns`| Outreach sequences & stages | `id`, `owner_id`, `name`, `subject_template`, `body_template`, `is_active` | Index on `owner_id` |
| `emails_sent` | Dispatched outreach with tracking metrics | `id`, `candidate_id`, `tracking_id`, `status`, `opened_at`, `clicks_count` | Unique index on `tracking_id` |
| `interviews` | Scheduled candidate interviews | `id`, `job_id`, `candidate_id`, `status`, `scheduled_at`, `zoom_link` | FK `job_id -> jobs.id`, FK `candidate_id -> candidates.id` |
| `agent_tasks` | Swarm execution tracking and checkpoints | `id`, `tenant_id`, `task_type`, `status`, `current_checkpoint`, `output_data` | Index on `tenant_id`, index on `status` |
| `audit_logs` | Immutable audit log trail | `id`, `tenant_id`, `user_id`, `ip_address`, `method`, `path`, `status_code` | Index on `(tenant_id, created_at)` |
| `compliance_audits` | NYC Local Law 144 / EU AI Act records | `id`, `tenant_id`, `job_id`, `demographic_group`, `selection_rate`, `impact_ratio` | Index on `(tenant_id, created_at)` |

---

## 3. Multi-Tenant Candidate Isolation & Partial Index

Previously, a global `unique=True` constraint on `candidates.email` caused cross-tenant collisions when two recruiting agencies sourced the same candidate. This has been remediated using a **PostgreSQL partial unique index**:

```sql
CREATE UNIQUE INDEX uq_candidate_tenant_email 
ON candidates (tenant_id, email) 
WHERE tenant_id IS NOT NULL;
```

### Isolation Logic:
1. **Recruiter-Sourced Candidates:** Scoped by `(tenant_id, email)`. Different tenants can independently maintain records for the same email without conflicting.
2. **B2C Candidate Direct Signups:** When candidates register directly via `/portal`, `tenant_id` is set to `NULL`. Uniqueness for user authentication is enforced on `users.email`.
3. **Privacy Shield Enforcement:** Recruiters querying candidates automatically filter against `is_searchable == True` and verify that the candidate's `hide_from_companies` blacklist does not contain the recruiter's tenant name or client company domain.

---

## 4. Circular Foreign Key Resolution

In `backend/db/models.py`, `teams.manager_id` references `users.id` while `users.team_id` references `teams.id`. This is resolved cleanly using SQLAlchemy's deferred constraint generation:

```python
manager_id = Column(
    UUID(as_uuid=True),
    ForeignKey("users.id", ondelete="SET NULL", use_alter=True, name="fk_teams_manager_id"),
    nullable=True,
)
```

---

## 5. Startup Lifecycle & Migration Governance

To prevent DDL locks, connection exhaustion, and startup race conditions across multi-worker deployments:
- **Startup Connectivity Verification:** `backend/main.py:lifespan` runs a non-destructive `SELECT 1` connectivity test. Destructive `Base.metadata.create_all` calls have been completely removed.
- **Alembic Governance:** Schema lifecycle is managed strictly and exclusively through Alembic:
  ```powershell
  # Check current revision status
  alembic current

  # Upgrade to the latest migration
  alembic upgrade head

  # Create a new autogenerated revision
  alembic revision --autogenerate -m "describe_changes"
  ```
- **Active Migration Head:** `007_team_invitations`.
