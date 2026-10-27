"""
Seed Admin User: admin@dvt.com with password: admin123
"""
import asyncio
import os
import sys
import uuid

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import bcrypt
from sqlalchemy import select
from db.models import AsyncSessionLocal, User, Tenant, UserRole

async def seed():
    salt = bcrypt.gensalt()
    hashed_pwd = bcrypt.hashpw(b"admin123", salt).decode("utf-8")
    
    async with AsyncSessionLocal() as session:
        # 1. Check or create Tenant for dvt.com
        res = await session.execute(select(Tenant).where(Tenant.domain == "dvt.com"))
        tenant = res.scalar_one_or_none()
        if not tenant:
            tenant = Tenant(
                id=uuid.uuid4(),
                name="DVT Talent",
                domain="dvt.com",
                is_active=True,
                subscription_plan="enterprise",
                credits_balance=100000,
                onboarded=True,
            )
            session.add(tenant)
            await session.flush()
            print(f"Created Tenant: {tenant.name} (id={tenant.id})")
        else:
            print(f"Using Existing Tenant: {tenant.name} (id={tenant.id})")

        # 2. Check or create User admin@dvt.com
        res = await session.execute(select(User).where(User.email == "admin@dvt.com"))
        user = res.scalar_one_or_none()
        if not user:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email="admin@dvt.com",
                full_name="DVT Administrator",
                hashed_password=hashed_pwd,
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
                preferences={"theme": "dark"},
            )
            session.add(user)
            print("Created new user: admin@dvt.com with role=ADMIN")
        else:
            user.hashed_password = hashed_pwd
            user.role = UserRole.ADMIN
            user.is_active = True
            user.is_verified = True
            user.tenant_id = tenant.id
            print("Updated existing user: admin@dvt.com with role=ADMIN and reset password")

        await session.commit()
        print("Successfully committed admin@dvt.com credentials to database.")

if __name__ == "__main__":
    asyncio.run(seed())
