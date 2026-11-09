"""
DVT Talent AI — Alembic Migration: Per-Tenant Email Sender Configuration
Adds SMTP configuration fields to tenants table.

Revision ID: 006_tenant_email_sender
Revises: 005_gdpr_pii_erasure
"""
import sqlalchemy as sa

from alembic import op

revision = '006_tenant_email_sender'
down_revision = '005_gdpr_pii_erasure'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('smtp_host', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('smtp_port', sa.Integer(), nullable=True, server_default='587'))
    op.add_column('tenants', sa.Column('smtp_user', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('smtp_password_encrypted', sa.Text(), nullable=True))
    op.add_column('tenants', sa.Column('sender_name', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('sender_email', sa.String(255), nullable=True))
    op.add_column('tenants', sa.Column('sender_verified', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('tenants', sa.Column('sender_verification_token', sa.String(255), nullable=True))


def downgrade() -> None:
    for col in [
        'sender_verification_token', 'sender_verified', 'sender_email',
        'sender_name', 'smtp_password_encrypted', 'smtp_user', 'smtp_port', 'smtp_host'
    ]:
        op.drop_column('tenants', col)
