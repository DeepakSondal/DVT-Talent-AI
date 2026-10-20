"""
DVT Talent AI — Password Reset & Demo Account Provisioning
Ensures valid bcrypt hashes for all default accounts:
- admin@dvttalent.com       -> admin123
- recruiter@dvttalent.com   -> recruiter123
- candidate@dvttalent.com   -> candidate123
"""
import sys
import os
import asyncio
import bcrypt
import uuid

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db.models import AsyncSessionLocal, User, Tenant, UserRole
from sqlalchemy import select

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

ACCOUNTS = [
    {
        "email": "admin@dvttalent.com",
        "password": "admin123",
        "full_name": "Elite Administrator",
        "role": UserRole.ADMIN,
    },
    {
        "email": "recruiter@dvttalent.com",
        "password": "recruiter123",
        "full_name": "Lead Recruiter",
        "role": UserRole.RECRUITER,
    },
    {
        "email": "candidate@dvttalent.com",
        "password": "candidate123",
        "full_name": "Senior Candidate",
        "role": UserRole.CANDIDATE,
    },
]

async def reset_passwords():
    print("🔐 Provisioning & resetting demo user credentials...")
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

        for acc in ACCOUNTS:
            u_res = await session.execute(select(User).where(User.email == acc["email"]))
            user = u_res.scalar_one_or_none()
            new_hash = hash_pw(acc["password"])

            if user:
                user.hashed_password = new_hash
                user.is_active = True
                user.is_verified = True
                user.role = acc["role"]
                user.tenant_id = tenant.id
                print(f"  ✅ Updated password for: {acc['email']} -> {acc['password']}")
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
                print(f"  ✅ Created new user: {acc['email']} -> {acc['password']}")

        await session.commit()
    print("\n🎉 All demo account passwords have been successfully provisioned!")

if __name__ == "__main__":
    asyncio.run(reset_passwords())
