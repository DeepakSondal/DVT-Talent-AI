"""Add users.monthly_credit_limit for team recruiter credit quotas.

Revision ID: 0003_user_monthly_credit_limit
Revises: 0002_nullable_oauth_password
Create Date: 2026-11-14
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_user_monthly_credit_limit"
down_revision: Union[str, Sequence[str], None] = "0002_nullable_oauth_password"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable monthly_credit_limit column to users."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(sa.Column("monthly_credit_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    """Drop monthly_credit_limit column from users."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("monthly_credit_limit")
