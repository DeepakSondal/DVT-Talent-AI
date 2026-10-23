"""
DVT Talent AI — Alembic Migration: Secure Team Invitations Table
Adds team_invitations table for cryptographic single-use invitation lifecycle.

Revision ID: 007_team_invitations
Revises: 006_tenant_email_sender
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '007_team_invitations'
down_revision = '006_tenant_email_sender'
branch_labels = None
depends_on = None


def upgrade() -> None:
    invitation_status_enum = sa.Enum('pending', 'accepted', 'revoked', 'expired', name='invitationstatus')
    user_role_enum = sa.Enum('admin', 'manager', 'recruiter', 'viewer', 'candidate', name='userrole')

    op.create_table(
        'team_invitations',
        sa.Column('id', sa.UUID(), nullable=False, primary_key=True),
        sa.Column('tenant_id', sa.UUID(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('team_id', sa.UUID(), sa.ForeignKey('teams.id', ondelete='SET NULL'), nullable=True),
        sa.Column('invited_by_user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('role', user_role_enum, nullable=False, server_default='recruiter'),
        sa.Column('token_hash', sa.String(64), nullable=False),
        sa.Column('status', invitation_status_enum, nullable=False, server_default='pending'),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_by_user_id', sa.UUID(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('email_sent', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('email_error', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('ix_team_invitations_tenant_id', 'team_invitations', ['tenant_id'])
    op.create_index('ix_team_invitations_team_id', 'team_invitations', ['team_id'])
    op.create_index('ix_team_invitations_invited_by_user_id', 'team_invitations', ['invited_by_user_id'])
    op.create_index('ix_team_invitations_email', 'team_invitations', ['email'])
    op.create_index('ix_team_invitations_token_hash', 'team_invitations', ['token_hash'], unique=True)
    op.create_index('ix_team_invitations_status', 'team_invitations', ['status'])
    op.create_index('ix_team_invitations_expires_at', 'team_invitations', ['expires_at'])


def downgrade() -> None:
    op.drop_index('ix_team_invitations_expires_at', 'team_invitations')
    op.drop_index('ix_team_invitations_status', 'team_invitations')
    op.drop_index('ix_team_invitations_token_hash', 'team_invitations')
    op.drop_index('ix_team_invitations_email', 'team_invitations')
    op.drop_index('ix_team_invitations_invited_by_user_id', 'team_invitations')
    op.drop_index('ix_team_invitations_team_id', 'team_invitations')
    op.drop_index('ix_team_invitations_tenant_id', 'team_invitations')
    op.drop_table('team_invitations')
