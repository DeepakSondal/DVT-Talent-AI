"""
DVT Talent AI — Database Models
Full PostgreSQL schema with SQLAlchemy async ORM
"""
import uuid
from datetime import datetime
from typing import Optional
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, JSON, Enum, Index
    # FIX [M-02]: Removed unused BigInteger import
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func
import enum

from config import settings


# ── Engine & Session ────────────────────────────────────────────────────────
# Fail fast — never silently fall back to in-memory SQLite in production.
if not settings.database_url:
    raise ValueError(
        "DATABASE_URL environment variable is required but not set. "
        "Set it in backend/.env before starting the server."
    )
db_url = settings.database_url

engine = create_async_engine(
    db_url,
    echo=settings.app_env == "development",
    # [NEW] Enterprise Hardening: Connection Pooling
    # Uses settings to handle high concurrency during pilots
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_timeout=30,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# ── Base ─────────────────────────────────────────────────────────────────────
class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    RECRUITER = "recruiter"
    VIEWER = "viewer"


class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"


class CandidateStatus(str, enum.Enum):
    SOURCED = "sourced"
    SCREENED = "screened"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    PLACED = "placed"
    REJECTED = "rejected"


class EmailStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    OPENED = "opened"
    CLICKED = "clicked"
    REPLIED = "replied"
    BOUNCED = "bounced"
    UNSUBSCRIBED = "unsubscribed"


class InterviewStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CONFIRMED = "confirmed"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"


class AgentTaskStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_INPUT = "awaiting_input" # [NEW] Copilot Mode Pause State
    COMPLETED = "completed"
    FAILED = "failed"
    RETRYING = "retrying"


class CreditTransactionType(str, enum.Enum):
    CREDIT = "credit"    # Credits added (subscription, topup)
    DEBIT = "debit"      # Credits consumed (agent run)
    REFUND = "refund"    # Credits refunded


# ── Models ───────────────────────────────────────────────────────────────────
class TimestampMixin:
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), unique=True)
    is_active = Column(Boolean, default=True)
    settings = Column(JSON, default=dict)
    subscription_plan = Column(String(50), default="starter")  # legacy, kept for compat

    # ── Stripe Billing Fields ─────────────────────────────────────────────
    stripe_customer_id = Column(String(255), unique=True, nullable=True, index=True)
    subscription_plan_id = Column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    credits_balance = Column(Integer, default=0, nullable=False)
    credits_last_reset_at = Column(DateTime(timezone=True), nullable=True)

    # ── Email Sender Configuration (Per-Tenant SMTP) ──────────────────────
    # Lets each customer send outreach from their own email address
    smtp_host = Column(String(255), nullable=True)             # e.g. smtp.gmail.com
    smtp_port = Column(Integer, nullable=True, default=587)    # 587 (TLS) or 465 (SSL)
    smtp_user = Column(String(255), nullable=True)             # their login email
    smtp_password_encrypted = Column(Text, nullable=True)      # AES-encrypted app password
    sender_name = Column(String(255), nullable=True)           # "Sarah at Acme Recruiting"
    sender_email = Column(String(255), nullable=True)          # sarah@acmecorp.com
    sender_verified = Column(Boolean, default=False, nullable=False)
    sender_verification_token = Column(String(255), nullable=True)
    onboarded = Column(Boolean, default=False, nullable=False)  # True = Finished First Run Wizard
    logo_url = Column(String(500), nullable=True)               # Company branding


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    default_credit_limit = Column(Integer, default=1000)
    shared_pool_enabled = Column(Boolean, default=False)

    tenant = relationship("Tenant")

class TeamApiKeys(Base, TimestampMixin):
    __tablename__ = "team_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False, index=True)
    openai_key = Column(String(500), nullable=True)
    serper_key = Column(String(500), nullable=True)
    anthropic_key = Column(String(500), nullable=True)

class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.RECRUITER, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(500))
    preferences = Column(JSON, default=dict)
    last_login = Column(DateTime(timezone=True))
    provider = Column(String(50))  # e.g. "google", "github", "linkedin"
    provider_id = Column(String(255))

    # Relationships
    tenant = relationship("Tenant")
    leads = relationship("Lead", back_populates="owner", foreign_keys="[Lead.owner_id]")
    campaigns = relationship("EmailCampaign", back_populates="owner")


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    name = Column(String(255), nullable=False, index=True)
    domain = Column(String(255), unique=True)
    website = Column(String(500))
    linkedin_url = Column(String(500))
    industry = Column(String(100))
    size = Column(String(50))  # e.g. "51-200", "1001-5000"
    location = Column(String(255))
    description = Column(Text)
    tech_stack = Column(JSON, default=list)
    hiring_signals = Column(JSON, default=list)  # evidence they're hiring
    open_roles_count = Column(Integer, default=0)
    funding_stage = Column(String(100))
    revenue_range = Column(String(100))
    score = Column(Float, default=0.0)  # AI-computed prospect score
    is_client = Column(Boolean, default=False)
    meta_data = Column("metadata", JSON, default=dict)
    last_enriched = Column(DateTime(timezone=True))

    # Relationships
    leads = relationship("Lead", back_populates="company")
    jobs = relationship("Job", back_populates="company")

    __table_args__ = (
        Index("ix_companies_industry", "industry"),
        Index("ix_companies_score", "score"),
    )


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, index=True)
    source = Column(String(100))  # how it was found
    score = Column(Float, default=0.0)
    notes = Column(Text)
    next_action = Column(String(255))
    next_action_date = Column(DateTime(timezone=True))
    value_estimate = Column(Float)
    meta_data = Column("metadata", JSON, default=dict)

    # Relationships
    owner = relationship("User", back_populates="leads", foreign_keys=[owner_id])
    company = relationship("Company", back_populates="leads")
    contact = relationship("Contact")
    activities = relationship("Activity", back_populates="lead")


class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("email_campaigns.id"), nullable=False, index=True)
    company_name = Column(String(255), index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), index=True)
    phone = Column(String(50))
    title = Column(String(255))
    department = Column(String(100))
    seniority = Column(String(50))
    linkedin_url = Column(String(500))
    twitter_url = Column(String(500))
    is_decision_maker = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    do_not_contact = Column(Boolean, default=False)
    meta_data = Column("metadata", JSON, default=dict)

    company = relationship("Company")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    requirements = Column(Text)
    location = Column(String(255))
    remote = Column(Boolean, default=False)
    salary_min = Column(Integer)
    salary_max = Column(Integer)
    skills_required = Column(JSON, default=list)
    experience_years = Column(Integer)
    job_type = Column(String(50))
    source_url = Column(String(500))
    is_active = Column(Boolean, default=True)
    posted_at = Column(DateTime(timezone=True))
    embedding_id = Column(String(255))  # ChromaDB reference

    company = relationship("Company", back_populates="jobs")
    candidates = relationship("JobCandidate", back_populates="job")
    # FIX [H-04]: Added missing back_populates target for Interview.job
    interviews = relationship("Interview", back_populates="job")


class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True)
    phone = Column(String(50))
    title = Column(String(255))
    location = Column(String(255))
    linkedin_url = Column(String(500))
    github_url = Column(String(500))
    portfolio_url = Column(String(500))
    skills = Column(JSON, default=list)
    experience_years = Column(Integer)
    current_company = Column(String(255))
    current_salary = Column(Integer)
    expected_salary = Column(Integer)
    availability = Column(String(100))
    status = Column(Enum(CandidateStatus), default=CandidateStatus.SOURCED, index=True)
    source = Column(String(100))
    score = Column(Float, default=0.0)
    embedding_id = Column(String(255))  # ChromaDB reference
    ai_summary = Column(Text)
    do_not_contact = Column(Boolean, default=False)
    meta_data = Column("metadata", JSON, default=dict)
    # GDPR Right-to-Erasure
    pii_erased = Column(Boolean, default=False, nullable=False)
    pii_erased_at = Column(DateTime(timezone=True), nullable=True)

    # ── AI Transparency & Reasoning ───────────────────────────────────────
    scoring_reasoning = Column(JSON, default=dict)    # Why the match score?
    integrity_reasoning = Column(JSON, default=dict)  # Why the integrity score?

    resumes = relationship("Resume", back_populates="candidate")
    job_applications = relationship("JobCandidate", back_populates="candidate")
    emails_received = relationship("EmailSent", back_populates="candidate")
    interviews = relationship("Interview", back_populates="candidate")


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    file_name = Column(String(255))
    file_url = Column(String(500))
    raw_text = Column(Text)
    parsed_data = Column(JSON, default=dict)
    score = Column(Float, default=0.0)
    embedding_id = Column(String(255))
    is_current = Column(Boolean, default=True)

    candidate = relationship("Candidate", back_populates="resumes")


class JobCandidate(Base, TimestampMixin):
    __tablename__ = "job_candidates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    match_score = Column(Float, default=0.0)
    status = Column(Enum(CandidateStatus), default=CandidateStatus.SOURCED)
    notes = Column(Text)
    ai_reasoning = Column(Text)

    job = relationship("Job", back_populates="candidates")
    candidate = relationship("Candidate", back_populates="job_applications")


class EmailCampaign(Base, TimestampMixin):
    __tablename__ = "email_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    name = Column(String(255), nullable=False)
    campaign_type = Column(String(50))  # "candidate_outreach", "client_outreach"
    target_type = Column(String(50))   # "candidate" | "contact"
    subject_template = Column(Text)
    body_template = Column(Text)
    is_active = Column(Boolean, default=True)
    send_days = Column(JSON, default=list)  # ["Monday", "Tuesday"]
    send_time = Column(String(10))     # "09:00"
    total_sent = Column(Integer, default=0)
    total_opened = Column(Integer, default=0)
    total_replied = Column(Integer, default=0)
    meta_data = Column("metadata", JSON, default=dict)

    owner = relationship("User", back_populates="campaigns")
    emails = relationship("EmailSent", back_populates="campaign")


class EmailSent(Base, TimestampMixin):
    __tablename__ = "emails_sent"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("email_campaigns.id"), index=True)
    recruiter_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"))
    contact_id = Column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    to_email = Column(String(255), nullable=False)
    subject = Column(Text, nullable=False)
    body = Column(Text, nullable=False)
    status = Column(Enum(EmailStatus), default=EmailStatus.DRAFT, index=True)
    sent_at = Column(DateTime(timezone=True))
    opened_at = Column(DateTime(timezone=True))
    replied_at = Column(DateTime(timezone=True))
    microsite_url = Column(String(500))
    clicks_count = Column(Integer, default=0)
    gmail_message_id = Column(String(255))
    tracking_id = Column(String(255), unique=True, default=lambda: str(uuid.uuid4()))
    meta_data = Column("metadata", JSON, default=dict)

    campaign = relationship("EmailCampaign", back_populates="emails")
    candidate = relationship("Candidate", back_populates="emails_received")


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), index=True)
    interviewer_email = Column(String(255))
    scheduled_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Integer, default=60)
    meeting_url = Column(String(500))
    status = Column(Enum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    notes = Column(Text)
    feedback = Column(JSON, default=dict)
    calendar_event_id = Column(String(255))

    candidate = relationship("Candidate", back_populates="interviews")
    # FIX [H-04]: Added job back-reference
    job = relationship("Job", back_populates="interviews")


class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    activity_type = Column(String(50))  # "email_sent", "call", "note", "status_change"
    description = Column(Text)
    meta_data = Column("metadata", JSON, default=dict)

    lead = relationship("Lead", back_populates="activities")


class AgentTask(Base, TimestampMixin):
    __tablename__ = "agent_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    agent_name = Column(String(100), nullable=False, index=True)
    task_type = Column(String(100), nullable=False)
    status = Column(Enum(AgentTaskStatus), default=AgentTaskStatus.PENDING, index=True)
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, default=dict)
    error_message = Column(Text)
    retries = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    celery_task_id = Column(String(255))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # [NEW] Copilot Mode State Tracking
    pipeline_mode = Column(String(50), default="autonomous") # 'autonomous' or 'copilot'
    current_checkpoint = Column(String(100)) # 'discovery_complete', 'sourcing_complete', etc.


class CreditBalance(Base, TimestampMixin):
    __tablename__ = "credit_balances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), unique=True)
    balance = Column(Integer, default=0)
    last_recharge = Column(DateTime(timezone=True))
    total_spent = Column(Integer, default=0)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)  # e.g. "VIEW_CANDIDATE", "UPDATE_CAMPAIGN"
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    severity = Column(String(20), default="INFO")  # INFO, WARNING, CRITICAL
    status = Column(String(20), default="SUCCESS") # SUCCESS, FAILURE
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    meta_data = Column("metadata", JSON, default=dict)


class AnalyticsEvent(Base, TimestampMixin):
    __tablename__ = "analytics_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50))  # "lead", "candidate", "email", etc.
    entity_id = Column(UUID(as_uuid=True))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    properties = Column(JSON, default=dict)

    __table_args__ = (
        Index("ix_analytics_events_type_date", "event_type", "created_at"),
    )


# ── Billing Models ────────────────────────────────────────────────────────────

class SubscriptionPlan(Base, TimestampMixin):
    """Mirrors Stripe Products/Prices. Populate via Stripe dashboard or seed script."""
    __tablename__ = "subscription_plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True)  # e.g. "Starter", "Growth", "Enterprise"
    stripe_price_id = Column(String(255), nullable=False, unique=True)  # e.g. "price_xxxxx"
    credits_per_month = Column(Integer, nullable=False, default=500)
    features = Column(JSON, default=list)  # Feature bullet list for marketing UI
    price_usd_cents = Column(Integer, default=0)  # e.g. 29900 = $299/mo
    is_active = Column(Boolean, default=True, nullable=False)
    is_one_time = Column(Boolean, default=False, nullable=False)  # True = Credit Pack, False = Subscription


class CreditTransaction(Base):
    """Immutable audit log of every credit debit/credit for a tenant."""
    __tablename__ = "credit_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    amount = Column(Integer, nullable=False)  # Positive = credit, Negative = debit
    type = Column(Enum(CreditTransactionType), nullable=False)
    description = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_credit_transactions_tenant_date", "tenant_id", "created_at"),
    )


# ── ATS Integration Models ────────────────────────────────────────────────────

class IntegrationConnection(Base, TimestampMixin):
    """Stores encrypted ATS credentials per tenant per provider."""
    __tablename__ = "integration_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)             # 'greenhouse', 'ceipal'
    api_key_encrypted = Column(Text(), nullable=False)
    api_secret_encrypted = Column(Text(), nullable=True)
    base_url = Column(String(500), nullable=True)
    auto_export_enabled = Column(Boolean, default=False, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    last_sync_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_integration_connections_tenant", "tenant_id"),
        Index("uq_integration_tenant_provider", "tenant_id", "provider", unique=True),
    )


class ATSExportLog(Base):
    """Immutable log of every candidate export to an ATS."""
    __tablename__ = "ats_export_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    provider = Column(String(50), nullable=False)
    candidate_id = Column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    external_candidate_id = Column(String(255), nullable=True)
    status = Column(String(50), nullable=False, default="pending")
    response_payload = Column(JSON, default=dict)
    error_message = Column(Text(), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ats_export_logs_tenant_provider", "tenant_id", "provider"),
    )


