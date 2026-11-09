"""
DVT Talent AI — Alembic Migration: ATS Integration Tables
Adds: integration_connections, ats_export_logs
Adds: ats columns to jobs table (external_id, source already in meta_data - no change needed)

Revision ID: 004_ats_integrations
Revises: 003_billing_stripe
"""
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = '004_ats_integrations'
down_revision = '003_billing_stripe'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── integration_connections ─────────────────────────────────────────────
    op.create_table(
        'integration_connections',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),          # 'greenhouse', 'ceipal'
        sa.Column('api_key_encrypted', sa.Text(), nullable=False),
        sa.Column('api_secret_encrypted', sa.Text(), nullable=True),
        sa.Column('base_url', sa.String(500), nullable=True),
        sa.Column('auto_export_enabled', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('tenant_id', 'provider', name='uq_integration_tenant_provider'),
    )
    op.create_index('ix_integration_connections_tenant', 'integration_connections', ['tenant_id'])
    op.create_index('ix_integration_connections_provider', 'integration_connections', ['provider'])

    # ── ats_export_logs ────────────────────────────────────────────────────
    op.create_table(
        'ats_export_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('candidate_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('job_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('external_candidate_id', sa.String(255), nullable=True),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('response_payload', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_ats_export_logs_tenant_provider', 'ats_export_logs', ['tenant_id', 'provider'])
    op.create_index('ix_ats_export_logs_created_at', 'ats_export_logs', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_ats_export_logs_created_at', 'ats_export_logs')
    op.drop_index('ix_ats_export_logs_tenant_provider', 'ats_export_logs')
    op.drop_table('ats_export_logs')

    op.drop_index('ix_integration_connections_provider', 'integration_connections')
    op.drop_index('ix_integration_connections_tenant', 'integration_connections')
    op.drop_table('integration_connections')
