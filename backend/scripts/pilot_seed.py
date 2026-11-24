"""
DVT Talent AI — Canonical Platform Superadmin & Pilot Workspace Seed
Maintains a single platform superadmin (admin@dvttalent.com) with credentials
supplied strictly via ADMIN_PASSWORD environment variable.
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

from config import settings
from db.models import (
    AsyncSessionLocal,
    CreditTransaction,
    CreditTransactionType,
    Tenant,
    User,
    UserRole,
    engine,
)
from services.redis_service import revoke_user_tokens


async def seed() -> None:
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
    if not admin_password:
        print("ADMIN_PASSWORD environment variable is required.")
        raise SystemExit(1)
    if settings.is_production and len(admin_password) < 12:
        print("ADMIN_PASSWORD must be at least 12 characters in production.")
        raise SystemExit(1)

    print("Initiating DVT Talent AI Canonical Admin Seed...")

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

    print("Schema verified at Alembic head.")

    async with AsyncSessionLocal() as session:
        # 1. Check or create canonical platform tenant (dvttalent.com)
        existing_tenant = await session.execute(
            select(Tenant).where(Tenant.domain == "dvttalent.com")
        )
        tenant = existing_tenant.scalar_one_or_none()

        if not tenant:
            tenant = Tenant(
                id=uuid.uuid4(),
                name="DVT Talent AI Platform",
                domain="dvttalent.com",
                credits_balance=5000,
                onboarded=True,
                is_active=True,
            )
            session.add(tenant)
            await session.flush()
            print(f"Created canonical tenant: {tenant.name}")
        else:
            print("Canonical tenant 'dvttalent.com' already exists.")

        # 2. Enforce strict single platform superadmin invariant
        existing_super = (
            await session.execute(select(User).where(User.is_superadmin.is_(True)))
        ).scalar_one_or_none()
        if existing_super and existing_super.email.lower() != "admin@dvttalent.com":
            print(
                f"ERROR: A different platform superadmin already exists ({existing_super.email}). "
                "Only one platform superadmin is permitted."
            )
            raise SystemExit(1)

        existing_user = await session.execute(
            select(User).where(User.email == "admin@dvttalent.com")
        )
        user = existing_user.scalar_one_or_none()

        hashed_pw = bcrypt.hashpw(admin_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        if not user:
            user = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                email="admin@dvttalent.com",
                full_name="Platform Superadmin",
                hashed_password=hashed_pw,
                role=UserRole.ADMIN,
                is_superadmin=True,
                is_active=True,
                is_verified=True,
            )
            session.add(user)
            print("Created canonical platform superadmin: admin@dvttalent.com")
        else:
            setattr(user, "hashed_password", hashed_pw)
            setattr(user, "role", UserRole.ADMIN)
            setattr(user, "is_superadmin", True)
            setattr(user, "is_active", True)
            setattr(user, "is_verified", True)
            await revoke_user_tokens(str(user.id))
            print("Updated canonical platform superadmin password and claims: admin@dvttalent.com")

        # 3. Ensure initial pilot credits in non-production
        if not settings.is_production and int(tenant.credits_balance or 0) < 5000:
            setattr(tenant, "credits_balance", 5000)
            session.add(
                CreditTransaction(
                    id=uuid.uuid4(),
                    tenant_id=tenant.id,
                    amount=5000,
                    type=CreditTransactionType.CREDIT,
                    description="Master Seed Credit Refill",
                    created_at=datetime.now(timezone.utc),
                )
            )
            print("5,000 demo credits verified/refilled.")

        await session.commit()
        print("Canonical single-superadmin setup complete.")


if __name__ == "__main__":
    asyncio.run(seed())
