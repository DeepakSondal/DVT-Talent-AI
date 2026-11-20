"""
DVT Talent AI — Database Models
Full PostgreSQL schema with SQLAlchemy async ORM
"""
import sys

if __name__.startswith("backend.db."):
    sys.modules[__name__.replace("backend.db.", "db.")] = sys.modules[__name__]
elif __name__.startswith("db."):
    sys.modules["backend." + __name__] = sys.modules[__name__]

import atexit
import enum
import os
import tempfile
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    # FIX [M-02]: Removed unused BigInteger import
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func

try:
    from backend.config import settings
except ImportError:
    from config import settings  # pyrefly: ignore[missing-import]  # type: ignore


# ── Engine & Session ────────────────────────────────────────────────────────
# Fail fast — never silently fall back to in-memory SQLite in production.
if not settings.database_url:
    raise ValueError(
        "DATABASE_URL environment variable is required but not set. "
        "Set it in backend/.env before starting the server."
    )
db_url = settings.database_url

from sqlalchemy import event
from sqlalchemy.pool import NullPool

# Use NullPool during test execution or SQLite mode so connections are not held open across async tasks causing lock contention
is_testing = "pytest" in sys.modules or os.environ.get("TESTING") == "true"
is_sqlite = "sqlite" in db_url
connect_args = {"timeout": 30} if is_sqlite else {}

# NullPool closes each SQLite connection cleanly, which destroys :memory: databases between
# test setup and request handling; isolate :memory: test runs onto a per-process temp file.
engine_db_url = db_url
sync_engine_db_url = settings.database_sync_url
if is_testing and is_sqlite and db_url.rstrip("/").endswith(":memory:"):
    scheme = db_url.split("://", 1)[0]
    _test_sqlite_db_path = Path(tempfile.gettempdir()) / f"dvt_talent_test_{os.getpid()}.db"
    for _suffix in ("", "-wal", "-shm"):
        _stale = Path(f"{_test_sqlite_db_path}{_suffix}")
        if _stale.exists():
            _stale.unlink()
    engine_db_url = f"{scheme}:///{_test_sqlite_db_path.as_posix()}"
    if not sync_engine_db_url or sync_engine_db_url.rstrip("/").endswith(":memory:"):
        sync_engine_db_url = f"sqlite:///{_test_sqlite_db_path.as_posix()}"

    def _cleanup_test_sqlite_db(db_path: Path = _test_sqlite_db_path) -> None:
        for _suffix in ("", "-wal", "-shm"):
            _target = Path(f"{db_path}{_suffix}")
            try:
                if _target.exists():
                    _target.unlink()
            except OSError:
                pass

    atexit.register(_cleanup_test_sqlite_db)

# Optimization: Disable verbose engine echo to eliminate console I/O bottleneck under concurrency
db_echo = os.getenv("DB_ECHO", "false").lower() == "true"
pool_size = max(settings.db_pool_size, 50)
max_overflow = max(settings.db_max_overflow, 25)

if is_testing or is_sqlite:
    engine = create_async_engine(
        engine_db_url,
        echo=db_echo,
        poolclass=NullPool,
        connect_args=connect_args,
    )
else:
    engine = create_async_engine(
        engine_db_url,
        echo=db_echo,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=30,
        pool_recycle=1800,
        connect_args=connect_args,
    )

if is_sqlite:
    @event.listens_for(engine.sync_engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

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
from sqlalchemy.types import TypeDecorator

try:
    from pgvector.sqlalchemy import Vector as PgVector
    PGVECTOR_AVAILABLE = True
except ImportError:
    PGVECTOR_AVAILABLE = False
    PgVector = None


class VectorColumn(TypeDecorator):
    """
    Portable 384-dimensional vector column:
    Uses native pgvector.sqlalchemy.Vector(dim) on PostgreSQL,
    and JSON array on SQLite / fallback dialects for test isolation.
    """
    impl = JSON
    cache_ok = True

    def __init__(self, dim=384, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.dim = dim

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql" and PGVECTOR_AVAILABLE and PgVector is not None:
            return dialect.type_descriptor(PgVector(self.dim))
        return dialect.type_descriptor(JSON())


class Base(DeclarativeBase):
    pass


# ── Enums ────────────────────────────────────────────────────────────────────
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    RECRUITER = "recruiter"
    VIEWER = "viewer"
    CANDIDATE = "candidate"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.strip().lower()
            for member in cls:
                if member.value.lower() == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class LeadStatus(str, enum.Enum):
    NEW = "new"
    CONTACTED = "contacted"
    QUALIFIED = "qualified"
    PROPOSAL = "proposal"
    NEGOTIATION = "negotiation"
    WON = "won"
    LOST = "lost"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.strip().lower()
            for member in cls:
                if member.value.lower() == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class CandidateStatus(str, enum.Enum):
    SOURCED = "sourced"
    APPLIED = "applied"
    SCREENED = "screened"
    CONTACTED = "contacted"
    INTERESTED = "interested"
    INTERVIEWING = "interviewing"
    OFFERED = "offered"
    PLACED = "placed"
    REJECTED = "rejected"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.strip().lower()
            aliases = {
                "shortlisted": cls.SCREENED,
                "interviewed": cls.INTERVIEWING,
            }
            if val_lower in aliases:
                return aliases[val_lower]
            for member in cls:
                if member.value.lower() == val_lower or member.name.lower() == val_lower:
                    return member
        return None


class EmailStatus(str, enum.Enum):
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENT = "sent"
    OPENED = "opened"
    CLICKED = "clicked"
    REPLIED = "replied"
    BOUNCED = "bounced"
    FAILED = "failed"
    UNSUBSCRIBED = "unsubscribed"

    @classmethod
    def _missing_(cls, value):
        if isinstance(value, str):
            val_lower = value.strip().lower()
            for member in cls:
                if member.value.lower() == val_lower or member.name.lower() == val_lower:
                    return member
        return None


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


class InvitationStatus(str, enum.Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    REVOKED = "revoked"
    EXPIRED = "expired"


class CreditTransactionType(str, enum.Enum):
    CREDIT = "credit"    # Credits added (subscription, topup)
    DEBIT = "debit"      # Credits consumed (agent run)
    REFUND = "refund"    # Credits refunded


# ── Models ───────────────────────────────────────────────────────────────────
class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class Tenant(Base, TimestampMixin):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), unique=True)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    settings: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    subscription_plan: Mapped[Optional[str]] = mapped_column(String(50), default="starter")  # legacy, kept for compat

    # ── Stripe Billing Fields ─────────────────────────────────────────────
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True, index=True)
    subscription_plan_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("subscription_plans.id"), nullable=True)
    credits_balance: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    credits_last_reset_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── Email Sender Configuration (Per-Tenant SMTP) ──────────────────────
    # Lets each customer send outreach from their own email address
    smtp_host: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)             # e.g. smtp.gmail.com
    smtp_port: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, default=587)    # 587 (TLS) or 465 (SSL)
    smtp_user: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)             # their login email
    smtp_password_encrypted: Mapped[Optional[str]] = mapped_column(Text, nullable=True)      # AES-encrypted app password
    sender_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)           # "Sarah at Acme Recruiting"
    sender_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)          # sarah@acmecorp.com
    sender_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    sender_verification_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    onboarded: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True = Finished First Run Wizard
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)               # Company branding


class Team(Base, TimestampMixin):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    manager_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", use_alter=True, name="fk_teams_manager_id"), nullable=False)
    default_credit_limit: Mapped[Optional[int]] = mapped_column(Integer, default=1000)
    shared_pool_enabled: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)

    tenant: Mapped["Tenant"] = relationship("Tenant")


class TeamApiKeys(Base, TimestampMixin):
    __tablename__ = "team_api_keys"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    team_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=False, index=True)
    openai_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    serper_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    anthropic_key: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    manager_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id", use_alter=True, name="fk_users_team_id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.RECRUITER, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    preferences: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    last_login: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    monthly_credit_limit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    provider: Mapped[Optional[str]] = mapped_column(String(50))  # e.g. "google", "github", "linkedin"
    provider_id: Mapped[Optional[str]] = mapped_column(String(255))

    # Relationships
    tenant: Mapped[Optional["Tenant"]] = relationship("Tenant")
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="owner", foreign_keys="[Lead.owner_id]")
    campaigns: Mapped[List["EmailCampaign"]] = relationship("EmailCampaign", back_populates="owner")


class TeamInvitation(Base, TimestampMixin):
    __tablename__ = "team_invitations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    team_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True, index=True)
    invited_by_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.RECRUITER, nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    status: Mapped[InvitationStatus] = mapped_column(Enum(InvitationStatus), default=InvitationStatus.PENDING, nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    email_error: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant")
    team: Mapped[Optional["Team"]] = relationship("Team")
    invited_by: Mapped["User"] = relationship("User", foreign_keys=[invited_by_user_id])
    accepted_by: Mapped[Optional["User"]] = relationship("User", foreign_keys=[accepted_by_user_id])


class Company(Base, TimestampMixin):
    __tablename__ = "companies"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    domain: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    website: Mapped[Optional[str]] = mapped_column(String(500))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    industry: Mapped[Optional[str]] = mapped_column(String(100))
    size: Mapped[Optional[str]] = mapped_column(String(50))  # e.g. "51-200", "1001-5000"
    location: Mapped[Optional[str]] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text)
    tech_stack: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list)
    hiring_signals: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list)  # evidence they're hiring
    open_roles_count: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    funding_stage: Mapped[Optional[str]] = mapped_column(String(100))
    revenue_range: Mapped[Optional[str]] = mapped_column(String(100))
    score: Mapped[Optional[float]] = mapped_column(Float, default=0.0)  # AI-computed prospect score
    is_client: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    last_enriched: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    # Relationships
    leads: Mapped[List["Lead"]] = relationship("Lead", back_populates="company")
    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="company")

    __table_args__ = (
        Index("ix_companies_industry", "industry"),
        Index("ix_companies_score", "score"),
        Index("uq_companies_tenant_domain", "tenant_id", "domain", unique=True, postgresql_where=(tenant_id.isnot(None))),
    )


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    recruiter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    status: Mapped[Optional[LeadStatus]] = mapped_column(Enum(LeadStatus), default=LeadStatus.NEW, index=True)
    source: Mapped[Optional[str]] = mapped_column(String(100))  # how it was found
    score: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    next_action: Mapped[Optional[str]] = mapped_column(String(255))
    next_action_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    value_estimate: Mapped[Optional[float]] = mapped_column(Float)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    # Relationships
    owner: Mapped[Optional["User"]] = relationship("User", back_populates="leads", foreign_keys=[owner_id])
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="leads")
    contact: Mapped[Optional["Contact"]] = relationship("Contact")
    activities: Mapped[List["Activity"]] = relationship("Activity", back_populates="lead")


class Contact(Base, TimestampMixin):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("email_campaigns.id"), nullable=False, index=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    department: Mapped[Optional[str]] = mapped_column(String(100))
    seniority: Mapped[Optional[str]] = mapped_column(String(50))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    twitter_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_decision_maker: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    email_verified: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    do_not_contact: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    company: Mapped[Optional["Company"]] = relationship("Company")


class Job(Base, TimestampMixin):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    company_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("companies.id"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    requirements: Mapped[Optional[str]] = mapped_column(Text)
    location: Mapped[Optional[str]] = mapped_column(String(255))
    remote: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    salary_min: Mapped[Optional[int]] = mapped_column(Integer)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer)
    skills_required: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    experience_years: Mapped[Optional[int]] = mapped_column(Integer)
    job_type: Mapped[Optional[str]] = mapped_column(String(50))
    source_url: Mapped[Optional[str]] = mapped_column(String(500))
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)  # Visible to candidate portal
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    embedding_id: Mapped[Optional[str]] = mapped_column(String(255))

    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="jobs")
    candidates: Mapped[List["JobCandidate"]] = relationship("JobCandidate", back_populates="job")
    # FIX [H-04]: Added missing back_populates target for Interview.job
    interviews: Mapped[List["Interview"]] = relationship("Interview", back_populates="job")


class Candidate(Base, TimestampMixin):
    __tablename__ = "candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True, nullable=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    recruiter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True, nullable=True)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    title: Mapped[Optional[str]] = mapped_column(String(255))
    location: Mapped[Optional[str]] = mapped_column(String(255))
    linkedin_url: Mapped[Optional[str]] = mapped_column(String(500))
    github_url: Mapped[Optional[str]] = mapped_column(String(500))
    portfolio_url: Mapped[Optional[str]] = mapped_column(String(500))
    skills: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)
    experience_years: Mapped[Optional[int]] = mapped_column(Integer)
    current_company: Mapped[Optional[str]] = mapped_column(String(255))
    current_salary: Mapped[Optional[int]] = mapped_column(Integer)
    expected_salary: Mapped[Optional[int]] = mapped_column(Integer)
    availability: Mapped[Optional[str]] = mapped_column(String(100))
    status: Mapped[Optional[CandidateStatus]] = mapped_column(Enum(CandidateStatus), default=CandidateStatus.SOURCED, index=True)
    source: Mapped[Optional[str]] = mapped_column(String(100))
    score: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(255))
    ai_summary: Mapped[Optional[str]] = mapped_column(Text)
    do_not_contact: Mapped[Optional[bool]] = mapped_column(Boolean, default=False)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)
    # Candidate Portal & Privacy
    is_searchable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    hide_from_companies: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)  # List of company domains or names
    # GDPR Right-to-Erasure
    pii_erased: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pii_erased_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── AI Transparency & Reasoning ───────────────────────────────────────
    scoring_reasoning: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)    # Why the match score?
    integrity_reasoning: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)  # Why the integrity score?

    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[user_id])
    resumes: Mapped[List["Resume"]] = relationship("Resume", back_populates="candidate")
    job_applications: Mapped[List["JobCandidate"]] = relationship("JobCandidate", back_populates="candidate")
    emails_received: Mapped[List["EmailSent"]] = relationship("EmailSent", back_populates="candidate")
    interviews: Mapped[List["Interview"]] = relationship("Interview", back_populates="candidate")

    __table_args__ = (
        Index("uq_candidate_tenant_email", "tenant_id", "email", unique=True, postgresql_where=(tenant_id.isnot(None))),
    )


class Resume(Base, TimestampMixin):
    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True, nullable=True)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    file_name: Mapped[Optional[str]] = mapped_column(String(255))
    file_url: Mapped[Optional[str]] = mapped_column(String(500))
    raw_text: Mapped[Optional[str]] = mapped_column(Text)
    parsed_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    score: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    embedding_id: Mapped[Optional[str]] = mapped_column(String(255))
    embedding: Mapped[Optional[List[float]]] = mapped_column(VectorColumn(384), nullable=True)  # Native pgvector (384-d FastEmbed)
    is_current: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)

    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", back_populates="resumes")


class JobCandidate(Base, TimestampMixin):
    __tablename__ = "job_candidates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True, nullable=True)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), index=True)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    match_score: Mapped[Optional[float]] = mapped_column(Float, default=0.0)
    status: Mapped[Optional[CandidateStatus]] = mapped_column(Enum(CandidateStatus), default=CandidateStatus.SOURCED)
    applied_by_candidate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    career_ops_scoring: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)  # 5 dimensions + ghost job check
    notes: Mapped[Optional[str]] = mapped_column(Text)
    ai_reasoning: Mapped[Optional[str]] = mapped_column(Text)

    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="candidates")
    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", back_populates="job_applications")


class EmailCampaign(Base, TimestampMixin):
    __tablename__ = "email_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    campaign_type: Mapped[Optional[str]] = mapped_column(String(50))  # "candidate_outreach", "client_outreach"
    target_type: Mapped[Optional[str]] = mapped_column(String(50))   # "candidate" | "contact"
    subject_template: Mapped[Optional[str]] = mapped_column(Text)
    body_template: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[Optional[bool]] = mapped_column(Boolean, default=True)
    send_days: Mapped[Optional[List[str]]] = mapped_column(JSON, default=list)  # ["Monday", "Tuesday"]
    send_time: Mapped[Optional[str]] = mapped_column(String(10))     # "09:00"
    total_sent: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_opened: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    total_replied: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    owner: Mapped[Optional["User"]] = relationship("User", back_populates="campaigns")
    emails: Mapped[List["EmailSent"]] = relationship("EmailSent", back_populates="campaign")


class EmailSent(Base, TimestampMixin):
    __tablename__ = "emails_sent"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("email_campaigns.id"), index=True)
    recruiter_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), index=True)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"))
    contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"))
    to_email: Mapped[str] = mapped_column(String(255), nullable=False)
    subject: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[Optional[EmailStatus]] = mapped_column(Enum(EmailStatus), default=EmailStatus.DRAFT, index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    opened_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    replied_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    microsite_url: Mapped[Optional[str]] = mapped_column(String(500))
    clicks_count: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    gmail_message_id: Mapped[Optional[str]] = mapped_column(String(255))
    tracking_id: Mapped[Optional[str]] = mapped_column(String(255), unique=True, default=lambda: str(uuid.uuid4()))
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    campaign: Mapped[Optional["EmailCampaign"]] = relationship("EmailCampaign", back_populates="emails")
    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", back_populates="emails_received")


class Interview(Base, TimestampMixin):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), index=True)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), index=True)
    interviewer_email: Mapped[Optional[str]] = mapped_column(String(255))
    scheduled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[Optional[int]] = mapped_column(Integer, default=60)
    meeting_url: Mapped[Optional[str]] = mapped_column(String(500))
    status: Mapped[Optional[InterviewStatus]] = mapped_column(Enum(InterviewStatus), default=InterviewStatus.SCHEDULED)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    feedback: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    calendar_event_id: Mapped[Optional[str]] = mapped_column(String(255))

    candidate: Mapped[Optional["Candidate"]] = relationship("Candidate", back_populates="interviews")
    # FIX [H-04]: Added job back-reference
    job: Mapped[Optional["Job"]] = relationship("Job", back_populates="interviews")


class Activity(Base, TimestampMixin):
    __tablename__ = "activities"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("leads.id"), index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    activity_type: Mapped[Optional[str]] = mapped_column(String(50))  # "email_sent", "call", "note", "status_change"
    description: Mapped[Optional[str]] = mapped_column(Text)
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)

    lead: Mapped[Optional["Lead"]] = relationship("Lead", back_populates="activities")


class AgentTask(Base, TimestampMixin):
    __tablename__ = "agent_tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    agent_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    task_type: Mapped[str] = mapped_column(String(100), nullable=False)
    status: Mapped[Optional[AgentTaskStatus]] = mapped_column(Enum(AgentTaskStatus), default=AgentTaskStatus.PENDING, index=True)
    input_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    output_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text)
    retries: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    celery_task_id: Mapped[Optional[str]] = mapped_column(String(255))
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # [NEW] Copilot Mode State Tracking
    pipeline_mode: Mapped[Optional[str]] = mapped_column(String(50), default="autonomous")  # 'autonomous' or 'copilot'
    current_checkpoint: Mapped[Optional[str]] = mapped_column(String(100))  # 'discovery_complete', 'sourcing_complete', etc.


class CreditBalance(Base, TimestampMixin):
    __tablename__ = "credit_balances"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), unique=True)
    balance: Mapped[Optional[int]] = mapped_column(Integer, default=0)
    last_recharge: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    total_spent: Mapped[Optional[int]] = mapped_column(Integer, default=0)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), index=True)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g. "VIEW_CANDIDATE", "UPDATE_CAMPAIGN"
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    severity: Mapped[Optional[str]] = mapped_column(String(20), default="INFO")  # INFO, WARNING, CRITICAL
    status: Mapped[Optional[str]] = mapped_column(String(20), default="SUCCESS")  # SUCCESS, FAILURE
    ip_address: Mapped[Optional[str]] = mapped_column(String(50))
    user_agent: Mapped[Optional[str]] = mapped_column(String(500))
    meta_data: Mapped[Optional[Dict[str, Any]]] = mapped_column("metadata", JSON, default=dict)


class AnalyticsEvent(Base, TimestampMixin):
    __tablename__ = "analytics_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    entity_type: Mapped[Optional[str]] = mapped_column(String(50))  # "lead", "candidate", "email", etc.
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    properties: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)

    __table_args__ = (
        Index("ix_analytics_events_type_date", "event_type", "created_at"),
    )


# ── Billing Models ────────────────────────────────────────────────────────────

class SubscriptionPlan(Base, TimestampMixin):
    """Mirrors Stripe Products/Prices. Populate via Stripe dashboard or seed script."""
    __tablename__ = "subscription_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)  # e.g. "Starter", "Growth", "Enterprise"
    stripe_price_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)  # e.g. "price_xxxxx"
    credits_per_month: Mapped[int] = mapped_column(Integer, nullable=False, default=500)
    features: Mapped[Optional[List[Any]]] = mapped_column(JSON, default=list)  # Feature bullet list for marketing UI
    price_usd_cents: Mapped[Optional[int]] = mapped_column(Integer, default=0)  # e.g. 29900 = $299/mo
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_one_time: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)  # True = Credit Pack, False = Subscription


class CreditTransaction(Base):
    """Immutable audit log of every credit debit/credit for a tenant."""
    __tablename__ = "credit_transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # Positive = credit, Negative = debit
    type: Mapped[CreditTransactionType] = mapped_column(Enum(CreditTransactionType), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_credit_transactions_tenant_date", "tenant_id", "created_at"),
    )


# ── ATS Integration Models ────────────────────────────────────────────────────

class IntegrationConnection(Base, TimestampMixin):
    """Stores encrypted ATS credentials per tenant per provider."""
    __tablename__ = "integration_connections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)             # 'greenhouse', 'ceipal'
    api_key_encrypted: Mapped[str] = mapped_column(Text(), nullable=False)
    api_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    base_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    auto_export_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_integration_connections_tenant", "tenant_id"),
        Index("uq_integration_tenant_provider", "tenant_id", "provider", unique=True),
    )


class ATSExportLog(Base):
    """Immutable log of every candidate export to an ATS."""
    __tablename__ = "ats_export_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(50), nullable=False)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    external_candidate_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    response_payload: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    error_message: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ats_export_logs_tenant_provider", "tenant_id", "provider"),
    )


class AIDecisionLedger(Base):
    """
    Immutable AI Decision Ledger for EEOC, GDPR Article 22, and EU AI Act Annex III compliance.
    Records input data hashes, model version, prompt version, confidence scores, and human override actions.
    """
    __tablename__ = "ai_decision_ledger"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False, index=True)
    job_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=True)
    candidate_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("candidates.id"), nullable=True)
    decision_type: Mapped[str] = mapped_column(String(100), nullable=False, default="candidate_evaluation")

    # Audit details
    model_provider: Mapped[str] = mapped_column(String(50), nullable=False, default="Groq")
    model_name: Mapped[str] = mapped_column(String(100), nullable=False, default="openai/gpt-oss-20b")
    prompt_version: Mapped[str] = mapped_column(String(50), nullable=False, default="v1.0")
    input_data_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # AI Results
    qualification_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    confidence_level: Mapped[Optional[str]] = mapped_column(String(50), default="HIGH")
    evidence_signals: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, default=dict)
    reasoning_summary: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)

    # Human-in-the-loop audit
    reviewer_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    human_action: Mapped[Optional[str]] = mapped_column(String(50), default="PENDING_REVIEW")  # PENDING_REVIEW, APPROVED, REJECTED
    is_override: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    override_reason: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ai_decision_ledger_tenant", "tenant_id"),
        Index("ix_ai_decision_ledger_job_cand", "job_id", "candidate_id"),
    )


