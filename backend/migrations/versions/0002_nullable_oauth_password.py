"""Make users.hashed_password nullable for OAuth-only users.

Revision ID: 0002_nullable_oauth_password
Revises: 0001_initial_schema
Create Date: 2026-11-13

Note:
- Live Postgres verification of 0001 + 0002 is deferred to CI (`P0-2-infra`), as Docker Desktop
  is unavailable on the local workstation. Verified locally via SQLite round-trip and
  Postgres `--sql` offline DDL.
- Clean 0001 baseline contains no sentinel password strings, so no data backfill is needed.
- Downgrading requires no NULL `hashed_password` rows in `users`.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_nullable_oauth_password"
down_revision: Union[str, Sequence[str], None] = "0001_initial_schema"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow NULL hashed_password for OAuth-only accounts."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "hashed_password",
            existing_type=sa.String(255),
            nullable=True,
        )


def downgrade() -> None:
    """Restore NOT NULL constraint on users.hashed_password."""
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "hashed_password",
            existing_type=sa.String(255),
            nullable=False,
        )
