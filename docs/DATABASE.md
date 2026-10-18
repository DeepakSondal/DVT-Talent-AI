# Database Architecture & Schema Reference
**Version:** 2.0.0 (October 2026)  
**Database Engine:** PostgreSQL 15+ (Production) / SQLite (Local Dev & Unit Tests)  
**ORM:** Async SQLAlchemy 2.0  

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

| Table | Purpose | Key Columns | Constraints & Indexes |
|---|---|---|---|
| `tenants` | Agency/Enterprise workspace tenancy | `id`, `name`, `subdomain`, `plan`, `credits_balance` | Primary key, unique index on `subdomain` |
| `teams` | Functional recruiter teams within a tenant | `id`, `tenant_id`, `name`, `manager_id` | FK `manager_id -> users.id` (`use_alter=True`) |
| `users` | User credentials & authentication | `id`, `tenant_id` *(nullable)*, `email`, `role`, `password_hash` | Unique index on `email`, index on `tenant_id`. `role` in `('recruiter', 'candidate', 'admin')` |
| `candidates` | Talent profiles & career dossier | `id`, `tenant_id` *(nullable)*, `user_id`, `email`, `score`, `is_searchable`, `hide_from_companies` | Unique `(tenant_id, email)`, FK `user_id -> users.id`, index on `(tenant_id, score)` |
| `jobs` | Open requisitions & JD specifications | `id`, `tenant_id`, `title`, `description`, `is_published`, `status` | Index on `tenant_id`, index on `is_published` |
| `job_candidates` | Association between jobs & candidates | `id`, `job_id`, `candidate_id`, `status`, `applied_by_candidate`, `career_ops_scoring` | Composite unique `(job_id, candidate_id)` |
| `email_campaigns`| Outreach sequences & stages | `id`, `tenant_id`, `name`, `status`, `is_active` | Index on `tenant_id` |
| `audit_ledgers` | Immutable EEOC / AI decision records | `id`, `tenant_id`, `user_id`, `action`, `rationale`, `status` | Index on `(tenant_id, created_at)` |
| `leads` *(legacy)* | Dormant sales lead table | `id`, `tenant_id`, `company_id`, `status` | Preserved for schema stability |

---

## 3. Schema Extensions for Candidate Portal & Career-Ops

1. **Nullable Tenancy on Users (`users.tenant_id`)**:
   - Independent job seekers registering on the public portal do not belong to an agency tenant.
   - `users.tenant_id` is defined with `nullable=True` to allow direct B2C candidate onboarding.
2. **Candidate Identity & Privacy Shield (`candidates`)**:
   - `user_id`: UUID foreign key linking a candidate profile directly to an authenticated user account.
   - `is_searchable`: Boolean flag allowing candidates to opt in or out of recruiter sourcing swarms.
   - `hide_from_companies`: JSON / text array containing employer domains (e.g., `["currentcompany.com", "stealth.io"]`). Recruiter swarms filtering candidates automatically exclude profiles whose blacklist matches the recruiter's tenant or client domain.
3. **Job Publishing Control (`jobs.is_published`)**:
   - Controls whether a recruiter's job requisition is published on the Candidate Portal job board.
4. **Candidate-Initiated Applications (`job_candidates`)**:
   - `applied_by_candidate`: Boolean flag distinguishing inbound candidate applications from outbound recruiter-sourced profiles.
   - `career_ops_scoring`: JSON document persisting the 5-dimension match breakdown (Title, Stack, Experience, Domain, Culture) computed at application time.

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

## 5. Connection Pooling Configuration

Connection pooling is defined in `backend/config.py` and managed via `backend/db/session.py`:
- `db_pool_size = 20`: Maximum active connections in the persistent pool.
- `db_max_overflow = 10`: Burst allowance for sudden traffic spikes.
- `pool_pre_ping = True`: Issues `SELECT 1` prior to checkout to verify socket health.
- `pool_recycle = 1800`: Recycles idle sockets every 30 minutes to prevent backend drops.

---

## 6. Migration Workflows (Alembic)

To generate a new migration after updating models:
```powershell
cd backend
venv\Scripts\alembic revision --autogenerate -m "add_candidate_portal_fields"
```

To apply pending migrations:
```powershell
venv\Scripts\alembic upgrade head
```

To roll back the most recent migration:
```powershell
venv\Scripts\alembic downgrade -1
```
