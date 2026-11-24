"""Add mfa_enabled and mfa_secret_encrypted columns to users.

Revision ID: 0005_user_mfa_totp
Revises: 0004_team_job_board_api_keys
Create Date: 2026-11-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_user_mfa_totp"
down_revision: Union[str, Sequence[str], None] = "0004_team_job_board_api_keys"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add admin 2FA (TOTP MFA) state columns to users."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("mfa_enabled", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )
        batch_op.add_column(
            sa.Column("mfa_secret_encrypted", sa.String(length=512), nullable=True)
        )


def downgrade() -> None:
    """Drop admin 2FA (TOTP MFA) state columns from users."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("mfa_secret_encrypted")
        batch_op.drop_column("mfa_enabled")
