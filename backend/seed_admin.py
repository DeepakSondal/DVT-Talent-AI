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

from db.models import (
    AsyncSessionLocal,
    Candidate,
    CandidateStatus,
    Company,
    Job,
    Tenant,
    User,
    UserRole,
)


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

        # 3. Check or create Company
        res = await session.execute(select(Company).where(Company.tenant_id == tenant.id))
        company = res.scalars().first()
        if not company:
            company = Company(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                name="Acme AI Technologies",
                domain="acme-ai.io",
                website="https://acme-ai.io",
                industry="Artificial Intelligence",
                size="101-500",
                location="San Francisco, CA",
            )
            session.add(company)
            await session.flush()
            print("Created demo Company")

        # 4. Check or create demo Jobs
        res = await session.execute(select(Job).where(Job.tenant_id == tenant.id))
        jobs = res.scalars().all()
        if not jobs:
            job1 = Job(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                title="Senior Full Stack Engineer",
                description="Lead the frontend and backend development of high-performance recruitment tools.",
                requirements="React, TypeScript, Python, FastAPI, PostgreSQL",
                location="San Francisco, CA / Remote",
                remote=True,
                salary_min=150000,
                salary_max=190000,
                skills_required=["React", "TypeScript", "Python", "FastAPI", "PostgreSQL"],
                experience_years=5,
                job_type="Full-time",
                is_active=True,
                is_published=True,
            )
            job2 = Job(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                company_id=company.id,
                title="Staff AI Research Scientist",
                description="Develop deep retrieval models, LLM agents, and semantic matching engines.",
                requirements="PyTorch, Transformer Architectures, Python, LLMs",
                location="Remote",
                remote=True,
                salary_min=180000,
                salary_max=240000,
                skills_required=["PyTorch", "Python", "LLMs", "Vector DBs"],
                experience_years=6,
                job_type="Full-time",
                is_active=True,
                is_published=True,
            )
            session.add_all([job1, job2])
            print("Created demo Jobs")

        # 5. Check or create demo Candidates
        res = await session.execute(select(Candidate).where(Candidate.tenant_id == tenant.id))
        candidates = res.scalars().all()
        if not candidates:
            c1 = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                first_name="Elena",
                last_name="Rostova",
                email="elena.rostova@example.com",
                title="Lead AI Engineer",
                location="San Francisco, CA",
                linkedin_url="https://linkedin.com/in/elena-rostova",
                skills=["Python", "FastAPI", "PyTorch", "Next.js"],
                status=CandidateStatus.SOURCED,
                score=0.96,
                experience_years=7,
                current_company="Meta AI",
                current_salary=180000,
                expected_salary=210000,
            )
            c2 = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                first_name="Devon",
                last_name="Chen",
                email="devon.chen@example.com",
                title="Senior Full Stack Developer",
                location="New York, NY",
                linkedin_url="https://linkedin.com/in/devon-chen",
                skills=["React", "Node.js", "TypeScript", "PostgreSQL"],
                status=CandidateStatus.SCREENED,
                score=0.88,
                experience_years=5,
                current_company="Stripe",
                current_salary=160000,
                expected_salary=185000,
            )
            c3 = Candidate(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                first_name="Marcus",
                last_name="Vance",
                email="marcus.vance@example.com",
                title="Principal Infrastructure Architect",
                location="Seattle, WA",
                linkedin_url="https://linkedin.com/in/marcus-vance",
                skills=["Kubernetes", "AWS", "Go", "Distributed Systems"],
                status=CandidateStatus.INTERVIEWING,
                score=0.92,
                experience_years=9,
                current_company="Amazon Web Services",
                current_salary=200000,
                expected_salary=230000,
            )
            session.add_all([c1, c2, c3])
            print("Created demo Candidates")

        await session.commit()
        print("Successfully committed admin@dvt.com credentials and demo data to database.")

if __name__ == "__main__":
    asyncio.run(seed())
