# Database Architecture & Schema Reference
**Version:** 2.1.0 (October 2026)  
**Database Engines:** 
- **Production:** PostgreSQL 16 Alpine (`dvt_db`, database `dvt_talent`, volume `postgres_prod_data`, native `vector` extension)
- **Staging / Testing:** PostgreSQL 15 Alpine (`dvt-postgres`, image `pgvector/pgvector:pg15`, database `dvt_staging`, host port 5432)
**ORM:** Async SQLAlchemy 2.0 with Alembic Migrations  
**Vector Extension:** `pgvector` (384 dimensions via FastEmbed CPU ONNX)

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
| `tenants` | Agency/Enterprise workspace tenancy | `id`, `name`, `domain`, `dodo_customer_id`, `credits_balance`, `google_oauth_token_encrypted`, `ms_oauth_token_encrypted`, `smtp_host`, `smtp_user`, `smtp_password_encrypted` | Primary key, unique index on `domain` |
| `teams` | Functional recruiter teams within a tenant | `id`, `tenant_id`, `name`, `manager_id`, `default_credit_limit` | FK `manager_id -> users.id` (`use_alter=True`), index on `tenant_id` |
| `team_api_keys` | Encrypted BYOK credentials per team | `id`, `team_id`, `openai_key`, `serper_key`, `anthropic_key` | FK `team_id -> teams.id`, AES-256 encrypted at rest |
| `team_invitations` | Cryptographic team invite tokens | `id`, `tenant_id`, `email`, `role`, `token_hash`, `status`, `expires_at` | Unique index on `token_hash`, index on `email` |
| `users` | User credentials & authentication | `id`, `tenant_id` *(nullable)*, `email`, `role`, `hashed_password`, `is_active` | Unique index on `email`, index on `tenant_id` |
| `candidates` | Talent profiles & career dossier | `id`, `tenant_id` *(nullable)*, `user_id`, `email`, `score`, `is_searchable`, `hide_from_companies`, `pii_erased` | Partial unique `uq_candidate_tenant_email` on `(tenant_id, email) WHERE tenant_id IS NOT NULL`, FK `user_id -> users.id` |
| `jobs` | Open requisitions & JD specifications | `id`, `tenant_id`, `company_id`, `title`, `description`, `is_published`, `is_active` | Index on `tenant_id`, index on `is_published` |
| `job_candidates` | Association between jobs & candidates | `id`, `tenant_id`, `job_id`, `candidate_id`, `status`, `applied_by_candidate`, `career_ops_scoring` | Composite unique `(job_id, candidate_id)` |
| `companies` | Prospective and client employer entities | `id`, `tenant_id`, `name`, `domain`, `industry`, `size`, `score` | Composite unique index `uq_companies_tenant_domain` on `(tenant_id, domain)` |
| `resumes` | Candidate resume files, parsed AST, and vector embeddings | `id`, `tenant_id`, `candidate_id`, `file_url`, `raw_text`, `parsed_data`, `embedding` *(VectorColumn 384-dim)* | FK `candidate_id -> candidates.id`, pgvector cosine index |
| `email_campaigns`| Outreach sequences & stages | `id`, `owner_id`, `name`, `subject_template`, `body_template`, `is_active` | Index on `owner_id` |
| `emails_sent` | Dispatched outreach with tracking metrics | `id`, `candidate_id`, `tracking_id`, `status`, `opened_at`, `clicks_count` | Unique index on `tracking_id` |
| `interviews` | Scheduled candidate interviews | `id`, `job_id`, `candidate_id`, `status`, `scheduled_at`, `zoom_link` | FK `job_id -> jobs.id`, FK `candidate_id -> candidates.id` |
| `agent_tasks` | Swarm execution tracking and checkpoints | `id`, `tenant_id`, `task_type`, `status`, `current_checkpoint`, `output_data` | Index on `tenant_id`, index on `status` |
| `audit_logs` | Immutable audit log trail | `id`, `tenant_id`, `user_id`, `ip_address`, `method`, `path`, `status_code` | Index on `(tenant_id, created_at)` |
| `compliance_audits` | NYC Local Law 144 / EU AI Act records | `id`, `tenant_id`, `job_id`, `demographic_group`, `selection_rate`, `impact_ratio` | Index on `(tenant_id, created_at)` |
| `ai_decision_ledger` | Immutable log of AI decisions and calibration overrides | `id`, `tenant_id`, `candidate_id`, `job_id`, `action`, `rationale`, `actor_id` | Index on `(tenant_id, created_at)` |

---

## 3. Multi-Tenant Candidate & Company Isolation

### 3.1 Candidate Partial Unique Index
```sql
CREATE UNIQUE INDEX uq_candidate_tenant_email 
ON candidates (tenant_id, email) 
WHERE tenant_id IS NOT NULL;
```
- **Recruiter-Sourced Candidates:** Scoped by `(tenant_id, email)`. Different tenants can independently maintain records for the same email without conflicting.
- **B2C Candidate Direct Signups:** When candidates register directly via `/portal`, `tenant_id` is set to `NULL`. Uniqueness for user authentication is enforced on `users.email`.
- **Privacy Shield Enforcement:** Recruiters querying candidates automatically filter against `is_searchable == True` and verify that the candidate's `hide_from_companies` blacklist does not contain the recruiter's tenant name or client company domain.

### 3.2 Company Domain Composite Unique Index
```sql
CREATE UNIQUE INDEX uq_companies_tenant_domain 
ON companies (tenant_id, domain);
```
- Replaced the previous global uniqueness constraint on `companies.domain`.
- Distinct agencies can now manage and prospect the same client enterprise domains within their own isolated tenant workspaces.

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

## 5. Native Vector Search (`pgvector`)

All resume and job semantic embeddings are managed via the native PostgreSQL `pgvector` extension:
- **Vector Dimensions:** 384 dimensions (`BAAI/bge-small-en-v1.5` generated via FastEmbed ONNX CPU runtime).
- **Extension Initialization:** `CREATE EXTENSION IF NOT EXISTS "vector";` executed during container bootstrap (`docker/postgres/init.sql`).
- **ORM Integration:** `pgvector.sqlalchemy.Vector(384)` mapped directly to `Resume.embedding`.
- **Cosine Distance Search:**
  ```python
  query = select(Resume).order_by(Resume.embedding.cosine_distance(query_vector)).limit(top_k)
  ```
- **ChromaDB Decommissioning:** ChromaDB has been completely removed in favor of native in-database vector storage, eliminating distributed lock issues and separate container overhead.

---

## 6. GDPR Article 17 "Right to Erasure" 4-Tier Invariants

When a candidate requests erasure (`DELETE /api/v1/candidates/{id}/erase`):
1. **Tier 1 (Primary Database):** Sets `candidates.pii_erased = True`, scrubs candidate names, emails, phone numbers, and raw resume text.
2. **Tier 2 (File Storage):** Physical resume files (`uploads/resumes/`) are permanently deleted from local disk or S3.
3. **Tier 3 (Vector Database):** `resumes.embedding` vector rows are deleted or zeroed in PostgreSQL `pgvector`.
4. **Tier 4 (Cache & Queues):** Redis cache keys prefixed with the candidate ID and pending Celery notification tasks are invalidated.
5. **Resurrection Prevention:** Celery Beat runs `reconcile_post_restore_erasures()` periodically and after any database backup restore to ensure erased candidates are not resurrected from stale database dumps.
