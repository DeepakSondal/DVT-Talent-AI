import asyncio
from sqlalchemy import text
from db.models import engine, Base

async def patch_database():
    print("Connecting to database...")
    
    # 1. First, we let SQLAlchemy automatically create any brand NEW tables (Team, TeamApiKeys)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Ensured all base tables exist.")
        
    # 2. Next, we manually inject the new columns into the EXISTING tables
    # Since SQLite doesn't natively crash if the column already exists, we use a try-except block
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE candidates ADD COLUMN recruiter_id CHAR(32);"))
            print("Added recruiter_id to candidates.")
        except Exception:
            print("recruiter_id already exists in candidates.")
            
        try:
            await conn.execute(text("ALTER TABLE leads ADD COLUMN recruiter_id CHAR(32);"))
            print("Added recruiter_id to leads.")
        except Exception:
            print("recruiter_id already exists in leads.")
            
        try:
            await conn.execute(text("ALTER TABLE emails_sent ADD COLUMN recruiter_id CHAR(32);"))
            print("Added recruiter_id to emails_sent.")
        except Exception:
            print("recruiter_id already exists in emails_sent.")
            
    print("\nDatabase Schema Migration Completed!")

if __name__ == "__main__":
    asyncio.run(patch_database())
