import sys
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.models import User, UserRole, Tenant, AsyncSessionLocal, engine, Base
from api.routes.auth import hash_password

async def create_admin():
    print("Ensuring database tables exist...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("Database schema verified.")
    except Exception as e:
        print(f"Warning during schema init: {e}")

    async with AsyncSessionLocal() as session:
        # Get or create default tenant
        t_result = await session.execute(select(Tenant).limit(1))
        tenant = t_result.scalar_one_or_none()
        if not tenant:
            print("Creating default tenant...")
            tenant = Tenant(name="DVT Talent AI", domain="dvttalent.com", is_active=True)
            session.add(tenant)
            await session.flush()

        # Check if user exists
        result = await session.execute(select(User).where(User.email == "admin@dvt.com"))
        existing = result.scalar_one_or_none()
        
        if existing:
            print("User admin@dvt.com already exists! Resetting password to admin123...")
            existing.hashed_password = await hash_password("admin123")
            existing.is_active = True
            await session.commit()
            print("Password for admin@dvt.com has been reset to: admin123")
            return
            
        print("Creating admin@dvt.com ...")
        user = User(
            tenant_id=tenant.id,
            email="admin@dvt.com",
            full_name="System Admin",
            hashed_password=await hash_password("admin123"),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        try:
            await session.commit()
            print("Successfully created admin account!")
            print("Email: admin@dvt.com")
            print("Password: admin123")
        except Exception as e:
            print(f"Failed to create user: {e}")

if __name__ == "__main__":
    asyncio.run(create_admin())
