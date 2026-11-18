"""
DVT Talent AI — Password Reset & Dev Account Provisioning
Reads credentials from environment variables (non-production only):
- admin@dvttalent.com       <- ADMIN_PASSWORD
- recruiter@dvttalent.com   <- RECRUITER_PASSWORD
- candidate@dvttalent.com   <- CANDIDATE_PASSWORD
"""
import asyncio
import os
import sys
import uuid

import bcrypt

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

try:
    from config import settings
except ImportError:
    from backend.config import settings
from db.models import AsyncSessionLocal, Tenant, User, UserRole


def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

ACCOUNTS = [
    {
        "email": "admin@dvttalent.com",
        "env_var": "ADMIN_PASSWORD",
        "full_name": "Elite Administrator",
        "role": UserRole.ADMIN,
    },
    {
        "email": "recruiter@dvttalent.com",
        "env_var": "RECRUITER_PASSWORD",
        "full_name": "Lead Recruiter",
        "role": UserRole.RECRUITER,
    },
    {
        "email": "candidate@dvttalent.com",
        "env_var": "CANDIDATE_PASSWORD",
        "full_name": "Senior Candidate",
        "role": UserRole.CANDIDATE,
    },
]

async def reset_passwords():
    if settings.is_production:
        print("Refusing to run reset_auth_passwords in production.")
        raise SystemExit(1)

    resolved_accounts = []
    for acc in ACCOUNTS:
        raw_pw = os.getenv(acc["env_var"], "").strip()
        if not raw_pw:
            print(f"{acc['env_var']} environment variable is required.")
            raise SystemExit(1)
        resolved_accounts.append({**acc, "password": raw_pw})

    print("🔐 Provisioning & resetting dev user credentials...")
    async with AsyncSessionLocal() as session:
        # Find or create tenant
        t_res = await session.execute(select(Tenant).where(Tenant.domain == "dvttalent.com"))
        tenant = t_res.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                id=uuid.uuid4(),
                name="Elite Pilot Workspace",
                domain="dvttalent.com",
                credits_balance=5000,
                onboarded=True,
                is_active=True
            )
            session.add(tenant)
            await session.flush()

        for acc in resolved_accounts:
            u_res = await session.execute(select(User).where(User.email == acc["email"]))
            user = u_res.scalar_one_or_none()
            new_hash = hash_pw(acc["password"])

            if user:
                setattr(user, "hashed_password", new_hash)
                setattr(user, "is_active", True)
                setattr(user, "is_verified", True)
                setattr(user, "role", acc["role"])
                setattr(user, "tenant_id", tenant.id)
                print(f"  ✅ Updated password for: {acc['email']}")
            else:
                user = User(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    email=acc["email"],
                    full_name=acc["full_name"],
                    hashed_password=new_hash,
                    role=acc["role"],
                    is_active=True,
                    is_verified=True
                )
                session.add(user)
                print(f"  ✅ Created new user: {acc['email']}")

        await session.commit()
    print("\n🎉 All demo account passwords have been successfully provisioned!")

if __name__ == "__main__":
    asyncio.run(reset_passwords())
