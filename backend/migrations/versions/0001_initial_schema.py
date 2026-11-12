"""Initial full database schema baseline.

Revision ID: 0001_initial_schema
Revises: None
Create Date: 2026-11-13 00:05:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from db.models import VectorColumn

# revision identifiers, used by Alembic.
revision: str = "0001_initial_schema"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_ENUM_TYPES: dict[str, tuple[str, ...]] = {
    "userrole": ("ADMIN", "MANAGER", "RECRUITER", "VIEWER", "CANDIDATE"),
    "leadstatus": (
        "NEW",
        "CONTACTED",
        "QUALIFIED",
        "PROPOSAL",
        "NEGOTIATION",
        "WON",
        "LOST",
    ),
    "candidatestatus": (
        "SOURCED",
        "APPLIED",
        "SCREENED",
        "CONTACTED",
        "INTERESTED",
        "INTERVIEWING",
        "OFFERED",
        "PLACED",
        "REJECTED",
    ),
    "emailstatus": (
        "DRAFT",
        "SCHEDULED",
        "SENT",
        "OPENED",
        "CLICKED",
        "REPLIED",
        "BOUNCED",
        "FAILED",
        "UNSUBSCRIBED",
    ),
    "interviewstatus": ("SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"),
    "agenttaskstatus": (
        "PENDING",
        "RUNNING",
        "AWAITING_INPUT",
        "COMPLETED",
        "FAILED",
        "RETRYING",
    ),
    "invitationstatus": ("PENDING", "ACCEPTED", "REVOKED", "EXPIRED"),
    "credittransactiontype": ("CREDIT", "DEBIT", "REFUND"),
}


def upgrade() -> None:
    dialect_name = op.get_context().dialect.name
    is_postgres = dialect_name == "postgresql"

    if is_postgres:
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
        for enum_name, values in _ENUM_TYPES.items():
            literals = ", ".join(f"'{v}'" for v in values)
            op.execute(f"CREATE TYPE {enum_name} AS ENUM ({literals})")

    userrole_enum = postgresql.ENUM(*_ENUM_TYPES["userrole"], name="userrole", create_type=False)
    leadstatus_enum = postgresql.ENUM(*_ENUM_TYPES["leadstatus"], name="leadstatus", create_type=False)
    candidatestatus_enum = postgresql.ENUM(
        *_ENUM_TYPES["candidatestatus"], name="candidatestatus", create_type=False
    )
    emailstatus_enum = postgresql.ENUM(*_ENUM_TYPES["emailstatus"], name="emailstatus", create_type=False)
    interviewstatus_enum = postgresql.ENUM(
        *_ENUM_TYPES["interviewstatus"], name="interviewstatus", create_type=False
    )
    agenttaskstatus_enum = postgresql.ENUM(
        *_ENUM_TYPES["agenttaskstatus"], name="agenttaskstatus", create_type=False
    )
    invitationstatus_enum = postgresql.ENUM(
        *_ENUM_TYPES["invitationstatus"], name="invitationstatus", create_type=False
    )
    credittransactiontype_enum = postgresql.ENUM(
        *_ENUM_TYPES["credittransactiontype"], name="credittransactiontype", create_type=False
    )

    # 1. subscription_plans
    op.create_table(
        "subscription_plans",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("stripe_price_id", sa.String(255), nullable=False),
        sa.Column("credits_per_month", sa.Integer(), nullable=False, server_default="500"),
        sa.Column("features", sa.JSON(), nullable=True),
        sa.Column("price_usd_cents", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_one_time", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("stripe_price_id"),
    )

    # 2. tenants
    op.create_table(
        "tenants",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("settings", sa.JSON(), nullable=True),
        sa.Column("subscription_plan", sa.String(50), nullable=True, server_default="starter"),
        sa.Column("stripe_customer_id", sa.String(255), nullable=True),
        sa.Column("subscription_plan_id", sa.Uuid(), nullable=True),
        sa.Column("credits_balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("credits_last_reset_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("smtp_host", sa.String(255), nullable=True),
        sa.Column("smtp_port", sa.Integer(), nullable=True, server_default="587"),
        sa.Column("smtp_user", sa.String(255), nullable=True),
        sa.Column("smtp_password_encrypted", sa.Text(), nullable=True),
        sa.Column("sender_name", sa.String(255), nullable=True),
        sa.Column("sender_email", sa.String(255), nullable=True),
        sa.Column("sender_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sender_verification_token", sa.String(255), nullable=True),
        sa.Column("onboarded", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("logo_url", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["subscription_plan_id"], ["subscription_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("domain"),
    )
    op.create_index("ix_tenants_name", "tenants", ["name"], unique=False)
    op.create_index("ix_tenants_stripe_customer_id", "tenants", ["stripe_customer_id"], unique=True)

    # 3. teams (fk_teams_manager_id deferred until users exists)
    op.create_table(
        "teams",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("manager_id", sa.Uuid(), nullable=False),
        sa.Column("default_credit_limit", sa.Integer(), nullable=True, server_default="1000"),
        sa.Column("shared_pool_enabled", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teams_tenant_id", "teams", ["tenant_id"], unique=False)

    # 4. users
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("manager_id", sa.Uuid(), nullable=True),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("role", userrole_enum, nullable=False, server_default="RECRUITER"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("is_verified", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("preferences", sa.JSON(), nullable=True),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.Column("provider", sa.String(50), nullable=True),
        sa.Column("provider_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["manager_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], name="fk_users_team_id"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"], unique=False)

    if is_postgres:
        op.create_foreign_key(
            "fk_teams_manager_id", "teams", "users", ["manager_id"], ["id"]
        )

    # 5. team_api_keys
    op.create_table(
        "team_api_keys",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=False),
        sa.Column("openai_key", sa.String(500), nullable=True),
        sa.Column("serper_key", sa.String(500), nullable=True),
        sa.Column("anthropic_key", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_team_api_keys_team_id", "team_api_keys", ["team_id"], unique=False)

    # 6. team_invitations
    op.create_table(
        "team_invitations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("team_id", sa.Uuid(), nullable=True),
        sa.Column("invited_by_user_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", userrole_enum, nullable=False, server_default="RECRUITER"),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("status", invitationstatus_enum, nullable=False, server_default="PENDING"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_user_id", sa.Uuid(), nullable=True),
        sa.Column("email_sent", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("email_error", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_team_invitations_email", "team_invitations", ["email"], unique=False)
    op.create_index("ix_team_invitations_expires_at", "team_invitations", ["expires_at"], unique=False)
    op.create_index("ix_team_invitations_invited_by_user_id", "team_invitations", ["invited_by_user_id"], unique=False)
    op.create_index("ix_team_invitations_status", "team_invitations", ["status"], unique=False)
    op.create_index("ix_team_invitations_team_id", "team_invitations", ["team_id"], unique=False)
    op.create_index("ix_team_invitations_tenant_id", "team_invitations", ["tenant_id"], unique=False)
    op.create_index("ix_team_invitations_token_hash", "team_invitations", ["token_hash"], unique=True)

    # 7. companies
    op.create_table(
        "companies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column("website", sa.String(500), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("size", sa.String(50), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tech_stack", sa.JSON(), nullable=True),
        sa.Column("hiring_signals", sa.JSON(), nullable=True),
        sa.Column("open_roles_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("funding_stage", sa.String(100), nullable=True),
        sa.Column("revenue_range", sa.String(100), nullable=True),
        sa.Column("score", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("is_client", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("last_enriched", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_companies_domain", "companies", ["domain"], unique=False)
    op.create_index("ix_companies_industry", "companies", ["industry"], unique=False)
    op.create_index("ix_companies_name", "companies", ["name"], unique=False)
    op.create_index("ix_companies_score", "companies", ["score"], unique=False)
    op.create_index("ix_companies_tenant_id", "companies", ["tenant_id"], unique=False)
    op.create_index(
        "uq_companies_tenant_domain",
        "companies",
        ["tenant_id", "domain"],
        unique=True,
        postgresql_where=sa.text("tenant_id IS NOT NULL"),
        sqlite_where=sa.text("tenant_id IS NOT NULL"),
    )

    # 8. email_campaigns
    op.create_table(
        "email_campaigns",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("campaign_type", sa.String(50), nullable=True),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("subject_template", sa.Text(), nullable=True),
        sa.Column("body_template", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("send_days", sa.JSON(), nullable=True),
        sa.Column("send_time", sa.String(10), nullable=True),
        sa.Column("total_sent", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("total_opened", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("total_replied", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_email_campaigns_owner_id", "email_campaigns", ["owner_id"], unique=False)

    # 9. contacts
    op.create_table(
        "contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("campaign_id", sa.Uuid(), nullable=False),
        sa.Column("company_name", sa.String(255), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("department", sa.String(100), nullable=True),
        sa.Column("seniority", sa.String(50), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("twitter_url", sa.String(500), nullable=True),
        sa.Column("is_decision_maker", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("email_verified", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("do_not_contact", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["email_campaigns.id"]),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_contacts_campaign_id", "contacts", ["campaign_id"], unique=False)
    op.create_index("ix_contacts_company_id", "contacts", ["company_id"], unique=False)
    op.create_index("ix_contacts_company_name", "contacts", ["company_name"], unique=False)
    op.create_index("ix_contacts_email", "contacts", ["email"], unique=False)
    op.create_index("ix_contacts_tenant_id", "contacts", ["tenant_id"], unique=False)

    # 10. leads
    op.create_table(
        "leads",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("recruiter_id", sa.Uuid(), nullable=True),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("contact_id", sa.Uuid(), nullable=True),
        sa.Column("status", leadstatus_enum, nullable=True, server_default="NEW"),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("score", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_action", sa.String(255), nullable=True),
        sa.Column("next_action_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("value_estimate", sa.Float(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"]),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_leads_company_id", "leads", ["company_id"], unique=False)
    op.create_index("ix_leads_recruiter_id", "leads", ["recruiter_id"], unique=False)
    op.create_index("ix_leads_status", "leads", ["status"], unique=False)
    op.create_index("ix_leads_tenant_id", "leads", ["tenant_id"], unique=False)

    # 11. activities
    op.create_table(
        "activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("lead_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("activity_type", sa.String(50), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["lead_id"], ["leads.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_activities_lead_id", "activities", ["lead_id"], unique=False)

    # 12. jobs
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("company_id", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("requirements", sa.Text(), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("remote", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("skills_required", sa.JSON(), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=True),
        sa.Column("job_type", sa.String(50), nullable=True),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("embedding_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_jobs_company_id", "jobs", ["company_id"], unique=False)
    op.create_index("ix_jobs_tenant_id", "jobs", ["tenant_id"], unique=False)

    # 13. candidates
    op.create_table(
        "candidates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("recruiter_id", sa.Uuid(), nullable=True),
        sa.Column("first_name", sa.String(100), nullable=False),
        sa.Column("last_name", sa.String(100), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("location", sa.String(255), nullable=True),
        sa.Column("linkedin_url", sa.String(500), nullable=True),
        sa.Column("github_url", sa.String(500), nullable=True),
        sa.Column("portfolio_url", sa.String(500), nullable=True),
        sa.Column("skills", sa.JSON(), nullable=True),
        sa.Column("experience_years", sa.Integer(), nullable=True),
        sa.Column("current_company", sa.String(255), nullable=True),
        sa.Column("current_salary", sa.Integer(), nullable=True),
        sa.Column("expected_salary", sa.Integer(), nullable=True),
        sa.Column("availability", sa.String(100), nullable=True),
        sa.Column("status", candidatestatus_enum, nullable=True, server_default="SOURCED"),
        sa.Column("source", sa.String(100), nullable=True),
        sa.Column("score", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("embedding_id", sa.String(255), nullable=True),
        sa.Column("ai_summary", sa.Text(), nullable=True),
        sa.Column("do_not_contact", sa.Boolean(), nullable=True, server_default=sa.false()),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("is_searchable", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("hide_from_companies", sa.JSON(), nullable=True),
        sa.Column("pii_erased", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("pii_erased_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("scoring_reasoning", sa.JSON(), nullable=True),
        sa.Column("integrity_reasoning", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_candidates_email", "candidates", ["email"], unique=False)
    op.create_index("ix_candidates_recruiter_id", "candidates", ["recruiter_id"], unique=False)
    op.create_index("ix_candidates_status", "candidates", ["status"], unique=False)
    op.create_index("ix_candidates_tenant_id", "candidates", ["tenant_id"], unique=False)
    op.create_index("ix_candidates_user_id", "candidates", ["user_id"], unique=False)
    op.create_index(
        "uq_candidate_tenant_email",
        "candidates",
        ["tenant_id", "email"],
        unique=True,
        postgresql_where=sa.text("tenant_id IS NOT NULL"),
        sqlite_where=sa.text("tenant_id IS NOT NULL"),
    )

    # 14. resumes (requires pgvector extension on Postgres, emitted above)
    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("file_name", sa.String(255), nullable=True),
        sa.Column("file_url", sa.String(500), nullable=True),
        sa.Column("raw_text", sa.Text(), nullable=True),
        sa.Column("parsed_data", sa.JSON(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("embedding_id", sa.String(255), nullable=True),
        sa.Column("embedding", VectorColumn(384), nullable=True),
        sa.Column("is_current", sa.Boolean(), nullable=True, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_resumes_candidate_id", "resumes", ["candidate_id"], unique=False)
    op.create_index("ix_resumes_tenant_id", "resumes", ["tenant_id"], unique=False)

    # 15. job_candidates
    op.create_table(
        "job_candidates",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("match_score", sa.Float(), nullable=True, server_default="0.0"),
        sa.Column("status", candidatestatus_enum, nullable=True, server_default="SOURCED"),
        sa.Column("applied_by_candidate", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("career_ops_scoring", sa.JSON(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("ai_reasoning", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_candidates_candidate_id", "job_candidates", ["candidate_id"], unique=False)
    op.create_index("ix_job_candidates_job_id", "job_candidates", ["job_id"], unique=False)
    op.create_index("ix_job_candidates_tenant_id", "job_candidates", ["tenant_id"], unique=False)

    # 16. emails_sent
    op.create_table(
        "emails_sent",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("campaign_id", sa.Uuid(), nullable=True),
        sa.Column("recruiter_id", sa.Uuid(), nullable=True),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("contact_id", sa.Uuid(), nullable=True),
        sa.Column("to_email", sa.String(255), nullable=False),
        sa.Column("subject", sa.Text(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("status", emailstatus_enum, nullable=True, server_default="DRAFT"),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("replied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("microsite_url", sa.String(500), nullable=True),
        sa.Column("clicks_count", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("gmail_message_id", sa.String(255), nullable=True),
        sa.Column("tracking_id", sa.String(255), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["email_campaigns.id"]),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["contact_id"], ["contacts.id"]),
        sa.ForeignKeyConstraint(["recruiter_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tracking_id"),
    )
    op.create_index("ix_emails_sent_campaign_id", "emails_sent", ["campaign_id"], unique=False)
    op.create_index("ix_emails_sent_recruiter_id", "emails_sent", ["recruiter_id"], unique=False)
    op.create_index("ix_emails_sent_status", "emails_sent", ["status"], unique=False)
    op.create_index("ix_emails_sent_tenant_id", "emails_sent", ["tenant_id"], unique=False)

    # 17. interviews
    op.create_table(
        "interviews",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("interviewer_email", sa.String(255), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_minutes", sa.Integer(), nullable=True, server_default="60"),
        sa.Column("meeting_url", sa.String(500), nullable=True),
        sa.Column("status", interviewstatus_enum, nullable=True, server_default="SCHEDULED"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("feedback", sa.JSON(), nullable=True),
        sa.Column("calendar_event_id", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_interviews_candidate_id", "interviews", ["candidate_id"], unique=False)
    op.create_index("ix_interviews_job_id", "interviews", ["job_id"], unique=False)

    # 18. agent_tasks
    op.create_table(
        "agent_tasks",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("agent_name", sa.String(100), nullable=False),
        sa.Column("task_type", sa.String(100), nullable=False),
        sa.Column("status", agenttaskstatus_enum, nullable=True, server_default="PENDING"),
        sa.Column("input_data", sa.JSON(), nullable=True),
        sa.Column("output_data", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("retries", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("celery_task_id", sa.String(255), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("pipeline_mode", sa.String(50), nullable=True, server_default="autonomous"),
        sa.Column("current_checkpoint", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_agent_tasks_agent_name", "agent_tasks", ["agent_name"], unique=False)
    op.create_index("ix_agent_tasks_status", "agent_tasks", ["status"], unique=False)
    op.create_index("ix_agent_tasks_tenant_id", "agent_tasks", ["tenant_id"], unique=False)

    # 19. credit_balances
    op.create_table(
        "credit_balances",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("balance", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("last_recharge", sa.DateTime(timezone=True), nullable=True),
        sa.Column("total_spent", sa.Integer(), nullable=True, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id"),
    )

    # 20. audit_logs
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("severity", sa.String(20), nullable=True, server_default="INFO"),
        sa.Column("status", sa.String(20), nullable=True, server_default="SUCCESS"),
        sa.Column("ip_address", sa.String(50), nullable=True),
        sa.Column("user_agent", sa.String(500), nullable=True),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"], unique=False)

    # 21. analytics_events
    op.create_table(
        "analytics_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=True),
        sa.Column("entity_id", sa.Uuid(), nullable=True),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("properties", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_analytics_events_event_type", "analytics_events", ["event_type"], unique=False)
    op.create_index("ix_analytics_events_type_date", "analytics_events", ["event_type", "created_at"], unique=False)

    # 22. credit_transactions
    op.create_table(
        "credit_transactions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", credittransactiontype_enum, nullable=False),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_credit_transactions_tenant_date", "credit_transactions", ["tenant_id", "created_at"], unique=False)
    op.create_index("ix_credit_transactions_tenant_id", "credit_transactions", ["tenant_id"], unique=False)

    # 23. integration_connections
    op.create_table(
        "integration_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("api_key_encrypted", sa.Text(), nullable=False),
        sa.Column("api_secret_encrypted", sa.Text(), nullable=True),
        sa.Column("base_url", sa.String(500), nullable=True),
        sa.Column("auto_export_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_integration_connections_tenant", "integration_connections", ["tenant_id"], unique=False)
    op.create_index("ix_integration_connections_tenant_id", "integration_connections", ["tenant_id"], unique=False)
    op.create_index("uq_integration_tenant_provider", "integration_connections", ["tenant_id", "provider"], unique=True)

    # 24. ats_export_logs
    op.create_table(
        "ats_export_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("external_candidate_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="pending"),
        sa.Column("response_payload", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ats_export_logs_tenant_id", "ats_export_logs", ["tenant_id"], unique=False)
    op.create_index("ix_ats_export_logs_tenant_provider", "ats_export_logs", ["tenant_id", "provider"], unique=False)

    # 25. ai_decision_ledger
    op.create_table(
        "ai_decision_ledger",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("candidate_id", sa.Uuid(), nullable=True),
        sa.Column("decision_type", sa.String(100), nullable=False, server_default="candidate_evaluation"),
        sa.Column("model_provider", sa.String(50), nullable=False, server_default="Groq"),
        sa.Column("model_name", sa.String(100), nullable=False, server_default="openai/gpt-oss-20b"),
        sa.Column("prompt_version", sa.String(50), nullable=False, server_default="v1.0"),
        sa.Column("input_data_hash", sa.String(255), nullable=True),
        sa.Column("qualification_score", sa.Integer(), nullable=True),
        sa.Column("confidence_level", sa.String(50), nullable=True, server_default="HIGH"),
        sa.Column("evidence_signals", sa.JSON(), nullable=True),
        sa.Column("reasoning_summary", sa.Text(), nullable=True),
        sa.Column("reviewer_user_id", sa.Uuid(), nullable=True),
        sa.Column("human_action", sa.String(50), nullable=True, server_default="PENDING_REVIEW"),
        sa.Column("is_override", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("override_reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["candidates.id"]),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"]),
        sa.ForeignKeyConstraint(["reviewer_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_decision_ledger_job_cand", "ai_decision_ledger", ["job_id", "candidate_id"], unique=False)
    op.create_index("ix_ai_decision_ledger_tenant", "ai_decision_ledger", ["tenant_id"], unique=False)
    op.create_index("ix_ai_decision_ledger_tenant_id", "ai_decision_ledger", ["tenant_id"], unique=False)


def downgrade() -> None:
    dialect_name = op.get_context().dialect.name
    is_postgres = dialect_name == "postgresql"

    op.drop_index("ix_ai_decision_ledger_tenant_id", table_name="ai_decision_ledger")
    op.drop_index("ix_ai_decision_ledger_tenant", table_name="ai_decision_ledger")
    op.drop_index("ix_ai_decision_ledger_job_cand", table_name="ai_decision_ledger")
    op.drop_table("ai_decision_ledger")

    op.drop_index("ix_ats_export_logs_tenant_provider", table_name="ats_export_logs")
    op.drop_index("ix_ats_export_logs_tenant_id", table_name="ats_export_logs")
    op.drop_table("ats_export_logs")

    op.drop_index("uq_integration_tenant_provider", table_name="integration_connections")
    op.drop_index("ix_integration_connections_tenant_id", table_name="integration_connections")
    op.drop_index("ix_integration_connections_tenant", table_name="integration_connections")
    op.drop_table("integration_connections")

    op.drop_index("ix_credit_transactions_tenant_id", table_name="credit_transactions")
    op.drop_index("ix_credit_transactions_tenant_date", table_name="credit_transactions")
    op.drop_table("credit_transactions")

    op.drop_index("ix_analytics_events_type_date", table_name="analytics_events")
    op.drop_index("ix_analytics_events_event_type", table_name="analytics_events")
    op.drop_table("analytics_events")

    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs")
    op.drop_table("audit_logs")

    op.drop_table("credit_balances")

    op.drop_index("ix_agent_tasks_tenant_id", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_status", table_name="agent_tasks")
    op.drop_index("ix_agent_tasks_agent_name", table_name="agent_tasks")
    op.drop_table("agent_tasks")

    op.drop_index("ix_interviews_job_id", table_name="interviews")
    op.drop_index("ix_interviews_candidate_id", table_name="interviews")
    op.drop_table("interviews")

    op.drop_index("ix_emails_sent_tenant_id", table_name="emails_sent")
    op.drop_index("ix_emails_sent_status", table_name="emails_sent")
    op.drop_index("ix_emails_sent_recruiter_id", table_name="emails_sent")
    op.drop_index("ix_emails_sent_campaign_id", table_name="emails_sent")
    op.drop_table("emails_sent")

    op.drop_index("ix_job_candidates_tenant_id", table_name="job_candidates")
    op.drop_index("ix_job_candidates_job_id", table_name="job_candidates")
    op.drop_index("ix_job_candidates_candidate_id", table_name="job_candidates")
    op.drop_table("job_candidates")

    op.drop_index("ix_resumes_tenant_id", table_name="resumes")
    op.drop_index("ix_resumes_candidate_id", table_name="resumes")
    op.drop_table("resumes")

    op.drop_index("uq_candidate_tenant_email", table_name="candidates")
    op.drop_index("ix_candidates_user_id", table_name="candidates")
    op.drop_index("ix_candidates_tenant_id", table_name="candidates")
    op.drop_index("ix_candidates_status", table_name="candidates")
    op.drop_index("ix_candidates_recruiter_id", table_name="candidates")
    op.drop_index("ix_candidates_email", table_name="candidates")
    op.drop_table("candidates")

    op.drop_index("ix_jobs_tenant_id", table_name="jobs")
    op.drop_index("ix_jobs_company_id", table_name="jobs")
    op.drop_table("jobs")

    op.drop_index("ix_activities_lead_id", table_name="activities")
    op.drop_table("activities")

    op.drop_index("ix_leads_tenant_id", table_name="leads")
    op.drop_index("ix_leads_status", table_name="leads")
    op.drop_index("ix_leads_recruiter_id", table_name="leads")
    op.drop_index("ix_leads_company_id", table_name="leads")
    op.drop_table("leads")

    op.drop_index("ix_contacts_tenant_id", table_name="contacts")
    op.drop_index("ix_contacts_email", table_name="contacts")
    op.drop_index("ix_contacts_company_name", table_name="contacts")
    op.drop_index("ix_contacts_company_id", table_name="contacts")
    op.drop_index("ix_contacts_campaign_id", table_name="contacts")
    op.drop_table("contacts")

    op.drop_index("ix_email_campaigns_owner_id", table_name="email_campaigns")
    op.drop_table("email_campaigns")

    op.drop_index("uq_companies_tenant_domain", table_name="companies")
    op.drop_index("ix_companies_tenant_id", table_name="companies")
    op.drop_index("ix_companies_score", table_name="companies")
    op.drop_index("ix_companies_name", table_name="companies")
    op.drop_index("ix_companies_industry", table_name="companies")
    op.drop_index("ix_companies_domain", table_name="companies")
    op.drop_table("companies")

    op.drop_index("ix_team_invitations_token_hash", table_name="team_invitations")
    op.drop_index("ix_team_invitations_tenant_id", table_name="team_invitations")
    op.drop_index("ix_team_invitations_team_id", table_name="team_invitations")
    op.drop_index("ix_team_invitations_status", table_name="team_invitations")
    op.drop_index("ix_team_invitations_invited_by_user_id", table_name="team_invitations")
    op.drop_index("ix_team_invitations_expires_at", table_name="team_invitations")
    op.drop_index("ix_team_invitations_email", table_name="team_invitations")
    op.drop_table("team_invitations")

    op.drop_index("ix_team_api_keys_team_id", table_name="team_api_keys")
    op.drop_table("team_api_keys")

    if is_postgres:
        op.drop_constraint("fk_teams_manager_id", "teams", type_="foreignkey")

    op.drop_index("ix_users_tenant_id", table_name="users")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.drop_index("ix_teams_tenant_id", table_name="teams")
    op.drop_table("teams")

    op.drop_index("ix_tenants_stripe_customer_id", table_name="tenants")
    op.drop_index("ix_tenants_name", table_name="tenants")
    op.drop_table("tenants")

    op.drop_table("subscription_plans")

    if is_postgres:
        for enum_name in reversed(list(_ENUM_TYPES.keys())):
            op.execute(f"DROP TYPE IF EXISTS {enum_name}")
