"""
DVT Talent AI — Master Pilot Seed
Rebuilds the environment with an Admin, Tenant, and 5,000 demo credits.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone

import bcrypt

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select

from db.models import (
    AsyncSessionLocal,
    CreditTransaction,
    CreditTransactionType,
    Tenant,
    User,
    UserRole,
)


async def seed():
    print("🚀 Initiating Master Pilot Seed...")
    
    # 🏗️ SDET: Build the foundation first! 
    # Ensure all tables are created in the fresh DB file.
    from db.models import Base, engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  ✅ Database Schema Initialized.")
    
    async with AsyncSessionLocal() as session:
        # 1. Check if Elite Tenant already exists
        existing_tenant = await session.execute(
            select(Tenant).where(Tenant.domain == "dvttalent.com")
        )
        tenant = existing_tenant.scalar_one_or_none()
        
        if not tenant:
            tenant_id = uuid.uuid4()
            tenant = Tenant(
                id=tenant_id,
                name="Elite Pilot Workspace",
                domain="dvttalent.com",
                credits_balance=5000,
                onboarded=True,
                is_active=True
            )
            session.add(tenant)
            print(f"  ✅ Tenant Created: {tenant.name}")
        else:
            print("  ℹ️ Tenant 'dvttalent.com' already exists. Skipping.")
            tenant_id = tenant.id

        # 2. Check if Admin User exists
        existing_user = await session.execute(
            select(User).where(User.email == "admin@dvttalent.com")
        )
        user = existing_user.scalar_one_or_none()
        
        if not user:
            password = os.getenv("ADMIN_PASSWORD", "admin_password_123")
            hashed_pw = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
            
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                email="admin@dvttalent.com",
                full_name="Elite Administrator",
                hashed_password=hashed_pw,
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True
            )
            session.add(user)
            print(f"  ✅ Admin Created: {user.email} (Password: admin_password_123)")
        else:
            print("  ℹ️ Admin 'admin@dvttalent.com' already exists. Skipping.")

        # 3. Ensure Credit Injection
        # Only inject if balance is low or new tenant
        if tenant.credits_balance < 5000:
            tenant.credits_balance = 5000
            transaction = CreditTransaction(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                amount=5000,
                type=CreditTransactionType.CREDIT,
                description="Master Seed Credit Refill",
                created_at=datetime.now(timezone.utc)
            )
            session.add(transaction)
            print("  ✅ 5,000 Credits Verified/Refilled.")

        await session.commit()
        print("\n🏆 ENVIRONMENT READY. You can now log in and initiate a swarm.")

if __name__ == "__main__":
    asyncio.run(seed())
