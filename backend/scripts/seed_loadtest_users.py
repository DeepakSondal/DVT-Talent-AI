"""
Seed 50 independent synthetic test accounts across 5 isolated tenants for 50-user concurrent load testing.
"""
import os
import sys
import uuid
import bcrypt
import sqlite3

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
db_path = os.path.join(os.path.dirname(backend_dir), "dvt_talent.db")

print(f"Connecting to database: {db_path}")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

# Precompute single bcrypt hash for performance
salt = bcrypt.gensalt()
hashed_password = bcrypt.hashpw(b"PerfPass123!", salt).decode("utf-8")

# 5 Isolated Tenants
tenants_data = [
    ("alpha", "Tenant Alpha Enterprise", "alpha.loadtest.dvt.com"),
    ("beta", "Tenant Beta Technologies", "beta.loadtest.dvt.com"),
    ("gamma", "Tenant Gamma Health", "gamma.loadtest.dvt.com"),
    ("delta", "Tenant Delta Logistics", "delta.loadtest.dvt.com"),
    ("epsilon", "Tenant Epsilon Finance", "epsilon.loadtest.dvt.com"),
]

tenant_ids = {}

for prefix, name, domain in tenants_data:
    cur.execute("SELECT id FROM tenants WHERE domain = ?", (domain,))
    row = cur.fetchone()
    if row:
        t_id = row[0]
    else:
        t_id = uuid.uuid4().hex
        cur.execute("""
            INSERT INTO tenants (id, name, domain, is_active, settings, subscription_plan, credits_balance, onboarded, sender_verified)
            VALUES (?, ?, ?, 1, '{}', 'enterprise', 50000, 1, 0)
        """, (t_id, name, domain))
    tenant_ids[prefix] = t_id
    print(f"Tenant {prefix}: {t_id}")

# Create 50 Users (10 per tenant)
users = []
user_idx = 1
for prefix, name, domain in tenants_data:
    t_id = tenant_ids[prefix]
    # Create a company for each tenant if not exists
    comp_id = uuid.uuid4().hex
    cur.execute("SELECT id FROM companies WHERE tenant_id = ?", (t_id,))
    comp_row = cur.fetchone()
    if comp_row:
        comp_id = comp_row[0]
    else:
        cur.execute("""
            INSERT INTO companies (id, tenant_id, name, domain, industry, size, location)
            VALUES (?, ?, ?, ?, 'Technology', '500-1000', 'San Francisco, CA')
        """, (comp_id, t_id, f"{name} Corp", domain))

    # Create 5 jobs per tenant
    for j in range(1, 6):
        job_id = uuid.uuid4().hex
        cur.execute("SELECT id FROM jobs WHERE tenant_id = ? AND title = ?", (t_id, f"{prefix.capitalize()} Senior Engineer {j}"))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO jobs (id, tenant_id, company_id, title, description, location, remote, salary_min, salary_max, skills_required, experience_years, is_active, is_published)
                VALUES (?, ?, ?, ?, ?, 'Remote', 1, 140000, 190000, '["Python", "FastAPI", "React"]', 5, 1, 1)
            """, (job_id, t_id, comp_id, f"{prefix.capitalize()} Senior Engineer {j}", f"Exciting job at {name}"))

    # Create 15 candidates per tenant
    for c in range(1, 16):
        cand_id = uuid.uuid4().hex
        cand_email = f"candidate_{prefix}_{c}@talent.example.com"
        cur.execute("SELECT id FROM candidates WHERE email = ? AND tenant_id = ?", (cand_email, t_id))
        if not cur.fetchone():
            cur.execute("""
                INSERT INTO candidates (id, tenant_id, first_name, last_name, email, title, location, skills, experience_years, score, status, is_searchable, pii_erased, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'Software Engineer', 'New York, NY', '["Python", "TypeScript", "PostgreSQL"]', 4, 88.5, 'screened', 1, 0, datetime('now'), datetime('now'))
            """, (cand_id, t_id, f"Candidate{c}", prefix.capitalize(), cand_email))

    # Create 10 users per tenant
    for u in range(1, 11):
        email = f"perf_user_{user_idx:02d}@loadtest.dvt.com"
        cur.execute("SELECT id FROM users WHERE email = ?", (email,))
        if not cur.fetchone():
            u_id = uuid.uuid4().hex
            role = "ADMIN" if u == 1 else "RECRUITER"
            cur.execute("""
                INSERT INTO users (id, tenant_id, email, full_name, hashed_password, role, is_active, is_verified, preferences, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 1, '{"theme": "dark"}', datetime('now'), datetime('now'))
            """, (u_id, t_id, email, f"LoadTest User {user_idx:02d}", hashed_password, role))
        users.append(email)
        user_idx += 1

conn.commit()
conn.close()
print(f"Successfully provisioned 50 test users across 5 tenants! Total created/verified: {len(users)}")
