#!/usr/bin/env bash
# =============================================================================
# DVT Talent AI — Create Pilot Tenant Script
# =============================================================================
# Usage:
#   bash scripts/create_pilot_tenant.sh \
#     --name "Acme Recruiting" \
#     --email "admin@acme.com" \
#     --password "PilotPass2026!" \
#     --credits 10000
#
# Prerequisites:
#   - Backend environment variables loaded (source backend/.env)
#   - PostgreSQL accessible (DATABASE_URL set)
#   - Python venv active (or run inside Docker: docker exec -it dvt-api bash)
# =============================================================================

set -euo pipefail

# ── Defaults ──────────────────────────────────────────────────────────────────
TENANT_NAME="Pilot Customer"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
PILOT_CREDITS=10000
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/backend"

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --name)     TENANT_NAME="$2";    shift 2 ;;
    --email)    ADMIN_EMAIL="$2";    shift 2 ;;
    --password) ADMIN_PASSWORD="$2"; shift 2 ;;
    --credits)  PILOT_CREDITS="$2";  shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "${ADMIN_EMAIL}" || -z "${ADMIN_PASSWORD}" ]]; then
  echo "Error: Both --email and --password are required (no default credentials allowed)." >&2
  exit 1
fi
if [[ ${#ADMIN_PASSWORD} -lt 12 ]]; then
  echo "Error: --password must be at least 12 characters." >&2
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          DVT Talent AI — Pilot Tenant Setup                  ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Tenant Name : ${TENANT_NAME}"
echo "║  Admin Email : ${ADMIN_EMAIL}"
echo "║  Credits     : ${PILOT_CREDITS}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Run Python seed script ───────────────────────────────────────────
cd "$BACKEND_DIR"

python3 - <<PYTHON
import asyncio
import uuid
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")

from db.models import (
    AsyncSessionLocal, Tenant, User, UserRole, Candidate, Job, Company,
    SubscriptionPlan, CreditTransaction, CreditTransactionType
)
from sqlalchemy import select
import bcrypt

TENANT_NAME  = "${TENANT_NAME}"
ADMIN_EMAIL  = "${ADMIN_EMAIL}"
ADMIN_PASS   = "${ADMIN_PASSWORD}"
PILOT_CREDITS = int("${PILOT_CREDITS}")


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def create_pilot_tenant():
    async with AsyncSessionLocal() as session:

        # ── 1. Create or reuse Tenant ────────────────────────────────────────
        result = await session.execute(
            select(Tenant).where(Tenant.name == TENANT_NAME)
        )
        tenant = result.scalar_one_or_none()

        if tenant:
            print(f"  ℹ️  Tenant '{TENANT_NAME}' already exists (ID: {tenant.id}). Updating credits.")
        else:
            tenant = Tenant(
                id=uuid.uuid4(),
                name=TENANT_NAME,
                slug=TENANT_NAME.lower().replace(" ", "-"),
                plan="pilot",
                is_active=True,
            )
            session.add(tenant)
            await session.flush()
            print(f"  ✅ Tenant created: {tenant.name} (ID: {tenant.id})")

        # ── 2. Set pilot credits ─────────────────────────────────────────────
        tenant.credits_balance = PILOT_CREDITS
        tenant.credits_last_reset_at = datetime.now(timezone.utc)

        credit_tx = CreditTransaction(
            tenant_id=tenant.id,
            amount=PILOT_CREDITS,
            type=CreditTransactionType.CREDIT,
            description="Pilot program — complimentary credit grant",
        )
        session.add(credit_tx)
        print(f"  ✅ Credits set: {PILOT_CREDITS:,}")

        # ── 3. Create Admin User ─────────────────────────────────────────────
        result = await session.execute(
            select(User).where(User.email == ADMIN_EMAIL)
        )
        user = result.scalar_one_or_none()

        if user:
            print(f"  ℹ️  User {ADMIN_EMAIL} already exists. Skipping.")
        else:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email=ADMIN_EMAIL,
                full_name="Pilot Admin",
                role=UserRole.ADMIN,
                is_superadmin=False,
                hashed_password=hash_password(ADMIN_PASS),
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            print(f"  ✅ Admin user created: {ADMIN_EMAIL}")

        # ── 4. Seed Demo Companies ────────────────────────────────────────────
        demo_companies = [
            {"name": "TechCorp Global",   "industry": "Software", "size": "201-500",  "location": "San Francisco, CA", "score": 88.0},
            {"name": "FinEdge Solutions", "industry": "FinTech",  "size": "51-200",   "location": "New York, NY",      "score": 76.5},
            {"name": "HealthAI Inc",      "industry": "HealthTech","size": "1001-5000","location": "Austin, TX",        "score": 91.2},
        ]
        for c in demo_companies:
            comp = Company(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name=c["name"],
                industry=c["industry"],
                size=c["size"],
                location=c["location"],
                score=c["score"],
                is_client=False,
                hiring_signals=["active_job_posts", "recent_funding"],
                tech_stack=["Python", "React", "AWS"],
            )
            session.add(comp)
        print(f"  ✅ Seeded {len(demo_companies)} demo companies")

        # ── 5. Seed Demo Jobs ────────────────────────────────────────────────
        demo_jobs = [
            {"title": "Senior Python Engineer",      "location": "Remote", "remote": True},
            {"title": "Full Stack Developer",         "location": "New York, NY", "remote": False},
            {"title": "Machine Learning Engineer",    "location": "San Francisco, CA", "remote": True},
        ]
        for j in demo_jobs:
            job = Job(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                title=j["title"],
                location=j["location"],
                remote=j["remote"],
                meta_data={"source": "demo", "pilot": True},
            )
            session.add(job)
        print(f"  ✅ Seeded {len(demo_jobs)} demo jobs")

        # ── 6. Seed Demo Candidates ───────────────────────────────────────────
        demo_candidates = [
            {"first_name": "Alex",    "last_name": "Johnson",  "email": "alex.j@demo.dvt",  "score": 92.0, "skills": ["Python", "FastAPI", "PostgreSQL"]},
            {"first_name": "Priya",   "last_name": "Sharma",   "email": "priya.s@demo.dvt", "score": 85.5, "skills": ["React", "TypeScript", "GraphQL"]},
            {"first_name": "Marcus",  "last_name": "Williams", "email": "marcus.w@demo.dvt","score": 78.0, "skills": ["Machine Learning", "PyTorch", "MLOps"]},
            {"first_name": "Sofia",   "last_name": "Chen",     "email": "sofia.c@demo.dvt", "score": 88.0, "skills": ["Node.js", "AWS", "Docker"]},
            {"first_name": "James",   "last_name": "Okafor",   "email": "james.o@demo.dvt", "score": 81.0, "skills": ["Go", "Kubernetes", "Terraform"]},
        ]
        for cand_data in demo_candidates:
            cand = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                first_name=cand_data["first_name"],
                last_name=cand_data["last_name"],
                email=cand_data["email"],
                score=cand_data["score"],
                skills=cand_data["skills"],
                status="sourced",
                source="demo_seed",
                ai_summary=f"Demo candidate seeded for pilot. Match score: {cand_data['score']}/100.",
            )
            session.add(cand)
        print(f"  ✅ Seeded {len(demo_candidates)} demo candidates")

        # ── Commit all ────────────────────────────────────────────────────────
        await session.commit()

        print("")
        print("═══════════════════════════════════════════════════════════")
        print("  🎉  Pilot Tenant Ready!")
        print("═══════════════════════════════════════════════════════════")
        print(f"  Tenant ID   : {tenant.id}")
        print(f"  Login URL   : http://127.0.0.1:3000/auth/login")
        print(f"  Email       : {ADMIN_EMAIL}")
        print(f"  Password    : {ADMIN_PASS}")
        print(f"  Credits     : {PILOT_CREDITS:,}")
        print("═══════════════════════════════════════════════════════════")
        print("")

asyncio.run(create_pilot_tenant())
PYTHON

echo "✅ Pilot tenant creation complete."
