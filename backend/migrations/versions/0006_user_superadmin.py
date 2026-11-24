"""Add is_superadmin column and single-superadmin partial unique index on users.

Revision ID: 0006_user_superadmin
Revises: 0005_user_mfa_totp
Create Date: 2026-11-24
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_user_superadmin"
down_revision: Union[str, Sequence[str], None] = "0005_user_mfa_totp"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_superadmin flag and guarantee at most one active platform superadmin."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("is_superadmin", sa.Boolean(), nullable=False, server_default=sa.text("false"))
        )

    op.create_index(
        "uq_users_single_superadmin",
        "users",
        ["is_superadmin"],
        unique=True,
        postgresql_where=sa.text("is_superadmin = true"),
        sqlite_where=sa.text("is_superadmin = 1"),
    )


def downgrade() -> None:
    """Drop single-superadmin index and is_superadmin column."""
    op.drop_index("uq_users_single_superadmin", table_name="users")
    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("is_superadmin")
