"""Add monster_api_key and dice_api_key columns to team_api_keys.

Revision ID: 0004_team_job_board_api_keys
Revises: 0003_user_monthly_credit_limit
Create Date: 2026-11-22
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_team_job_board_api_keys"
down_revision: Union[str, Sequence[str], None] = "0003_user_monthly_credit_limit"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add nullable encrypted Monster.com and Dice.com API key columns to team_api_keys."""
    with op.batch_alter_table("team_api_keys") as batch_op:
        batch_op.add_column(sa.Column("monster_api_key", sa.String(length=500), nullable=True))
        batch_op.add_column(sa.Column("dice_api_key", sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Drop Monster.com and Dice.com API key columns from team_api_keys."""
    with op.batch_alter_table("team_api_keys") as batch_op:
        batch_op.drop_column("dice_api_key")
        batch_op.drop_column("monster_api_key")
