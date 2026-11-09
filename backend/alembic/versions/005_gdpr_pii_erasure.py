"""
DVT Talent AI — Migration: GDPR PII Erasure Fields
Adds pii_erased + pii_erased_at to candidates table.

Revision ID: 005_gdpr_pii_erasure
Revises: 004_ats_integrations
"""
import sqlalchemy as sa

from alembic import op

revision = '005_gdpr_pii_erasure'
down_revision = '004_ats_integrations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('candidates',
        sa.Column('pii_erased', sa.Boolean(), nullable=False, server_default=sa.false())
    )
    op.add_column('candidates',
        sa.Column('pii_erased_at', sa.DateTime(timezone=True), nullable=True)
    )
    op.create_index('ix_candidates_pii_erased', 'candidates', ['pii_erased'])


def downgrade() -> None:
    op.drop_index('ix_candidates_pii_erased', 'candidates')
    op.drop_column('candidates', 'pii_erased_at')
    op.drop_column('candidates', 'pii_erased')
