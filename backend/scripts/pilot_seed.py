"""
DVT Talent AI — Master Pilot Seed
Rebuilds the environment with an Admin, Tenant, and 5,000 demo credits.
"""
import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import bcrypt

# Add backend root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import select

from db.models import (
    AsyncSessionLocal,
    CreditTransaction,
    CreditTransactionType,
    Tenant,
    User,
    UserRole,
    engine,
)


async def seed():
    print("🚀 Initiating Master Pilot Seed...")

    alembic_ini = Path(__file__).resolve().parent.parent / "alembic.ini"
    cfg = Config(str(alembic_ini))
    cfg.set_main_option(
        "script_location",
        str(Path(__file__).resolve().parent.parent / "migrations"),
    )
    expected_head = ScriptDirectory.from_config(cfg).get_current_head()

    async with engine.connect() as conn:
        current = await conn.run_sync(
            lambda sync_conn: MigrationContext.configure(sync_conn).get_current_revision()
        )

    if current != expected_head:
        print(
            "ERROR: database is not at Alembic head.\n"
            f"  Current:  {current or '(none — not migrated)'}\n"
            f"  Expected: {expected_head}\n"
            "  Run:      alembic upgrade head\n"
        )
        sys.exit(1)

    print("  ✅ Schema at head.")
    
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
