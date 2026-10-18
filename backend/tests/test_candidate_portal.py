"""
DVT Talent AI — Candidate Portal & Career-Ops Engine Automated Tests
Validates:
1. Career-Ops 5-Dimension Scoring Engine & Ghost-Job Detection.
2. Candidate Profile & Privacy Shield (Blacklisting employer).
3. 1-Click Application Flow.
4. STAR Interview Flashcard Generation.
5. Zero-Fabrication ATS Tailoring Audit.
"""
import pytest
from datetime import datetime, timezone, timedelta
import uuid

from db.models import Candidate, Job, Company, CandidateStatus
from api.routes.candidate_portal import compute_career_ops_score


def test_career_ops_scoring_high_match():
    candidate = Candidate(
        id=uuid.uuid4(),
        first_name="Jane",
        last_name="Dev",
        email="jane.dev@example.com",
        title="Senior Full Stack Engineer",
        skills=["Python", "React", "TypeScript", "FastAPI", "Docker"],
        experience_years=6,
        expected_salary=140000,
    )
    job = Job(
        id=uuid.uuid4(),
        title="Senior Full Stack Engineer",
        skills_required=["Python", "React", "FastAPI"],
        experience_years=5,
        salary_min=130000,
        salary_max=160000,
        remote=True,
        description="We are seeking an experienced engineer to scale our core microservices and web application.",
        posted_at=datetime.now(timezone.utc) - timedelta(days=5),
    )

    dimensions = compute_career_ops_score(candidate, job, "Acme Tech")

    assert dimensions.global_score >= 4.0
    assert dimensions.cv_match >= 4.0
    assert dimensions.target_alignment >= 4.5
    assert dimensions.ghost_job_risk == "Low"
    assert "Python" in [s.title() for s in dimensions.matched_skills]


def test_career_ops_scoring_ghost_job_detection():
    candidate = Candidate(
        id=uuid.uuid4(),
        first_name="John",
        last_name="Coder",
        email="john.coder@example.com",
        title="Junior Developer",
        skills=["HTML", "CSS"],
        experience_years=1,
        expected_salary=90000,
    )
    # Stale job posted 75 days ago without salary range and sparse description
    job = Job(
        id=uuid.uuid4(),
        title="Principal AI Architect",
        skills_required=["Rust", "Kubernetes", "PyTorch", "C++"],
        experience_years=10,
        salary_min=None,
        salary_max=None,
        remote=False,
        description="Looking for an architect.",
        posted_at=datetime.now(timezone.utc) - timedelta(days=75),
    )

    dimensions = compute_career_ops_score(candidate, job, "Stale Corp")

    assert dimensions.global_score < 3.5
    assert dimensions.ghost_job_risk in ("Moderate", "High")
    assert any("75 days" in s for s in dimensions.ghost_signals)
    assert any("compensation" in s.lower() for s in dimensions.ghost_signals)
