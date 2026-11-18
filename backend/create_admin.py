import asyncio
import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from sqlalchemy import select

from api.routes.auth import hash_password

try:
    from config import settings
except ImportError:
    from backend.config import settings
from db.models import AsyncSessionLocal, Base, Tenant, User, UserRole, engine


async def create_admin():
    if settings.is_production:
        print("Refusing to run create_admin in production.")
        raise SystemExit(1)

    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
    if not admin_password:
        print("ADMIN_PASSWORD environment variable is required.")
        raise SystemExit(1)

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
            print("User admin@dvt.com already exists! Updating password from ADMIN_PASSWORD...")
            setattr(existing, "hashed_password", await hash_password(admin_password))
            setattr(existing, "is_active", True)
            await session.commit()
            print("Password for admin@dvt.com has been updated.")
            return
            
        print("Creating admin@dvt.com ...")
        user = User(
            tenant_id=tenant.id,
            email="admin@dvt.com",
            full_name="System Admin",
            hashed_password=await hash_password(admin_password),
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        )
        session.add(user)
        try:
            await session.commit()
            print("Successfully created admin account!")
            print("Email: admin@dvt.com")
        except Exception as e:
            print(f"Failed to create user: {e}")

if __name__ == "__main__":
    asyncio.run(create_admin())
