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

        # Candidate Portal & Privacy Migrations
        try:
            await conn.execute(text("ALTER TABLE jobs ADD COLUMN is_published BOOLEAN DEFAULT 1;"))
            print("Added is_published to jobs.")
        except Exception:
            print("is_published already exists in jobs.")

        try:
            await conn.execute(text("ALTER TABLE candidates ADD COLUMN user_id CHAR(32);"))
            print("Added user_id to candidates.")
        except Exception:
            print("user_id already exists in candidates.")

        try:
            await conn.execute(text("ALTER TABLE candidates ADD COLUMN is_searchable BOOLEAN DEFAULT 1;"))
            print("Added is_searchable to candidates.")
        except Exception:
            print("is_searchable already exists in candidates.")

        try:
            await conn.execute(text("ALTER TABLE candidates ADD COLUMN hide_from_companies JSON DEFAULT '[]';"))
            print("Added hide_from_companies to candidates.")
        except Exception:
            print("hide_from_companies already exists in candidates.")

        try:
            await conn.execute(text("ALTER TABLE job_candidates ADD COLUMN applied_by_candidate BOOLEAN DEFAULT 0;"))
            print("Added applied_by_candidate to job_candidates.")
        except Exception:
            print("applied_by_candidate already exists in job_candidates.")

        try:
            await conn.execute(text("ALTER TABLE job_candidates ADD COLUMN career_ops_scoring JSON DEFAULT '{}';"))
            print("Added career_ops_scoring to job_candidates.")
        except Exception:
            print("career_ops_scoring already exists in job_candidates.")
            
    print("\nDatabase Schema Migration Completed!")

if __name__ == "__main__":
    asyncio.run(patch_database())
