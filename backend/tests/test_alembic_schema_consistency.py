"""Consistency tests between SQLAlchemy ORM models and the Alembic migration chain."""

import contextlib
import io
import re
from pathlib import Path

import sqlalchemy as sa
from alembic import command
from alembic.config import Config

from config import settings
from db.models import Base


def _generate_postgres_upgrade_sql() -> str:
    backend_dir = Path(__file__).resolve().parent.parent
    buf = io.StringIO()
    cfg = Config(str(backend_dir / "alembic.ini"), stdout=buf)
    cfg.set_main_option("script_location", str(backend_dir / "migrations"))

    original_url = settings.database_url
    object.__setattr__(settings, "database_url", "postgresql+asyncpg://dummy:dummy@localhost:5432/dummy")
    try:
        with contextlib.redirect_stdout(buf):
            command.upgrade(cfg, "head", sql=True)
    finally:
        object.__setattr__(settings, "database_url", original_url)
    return buf.getvalue()


def test_enum_values_match_between_models_and_migration():
    """Every enum value used by the ORM must match the enum values in 0001_initial_schema.

    A mismatch causes runtime 'invalid input value for enum' on every INSERT/UPDATE.
    """
    sql_text = _generate_postgres_upgrade_sql()

    create_type_matches = re.findall(
        r"CREATE\s+TYPE\s+(\w+)\s+AS\s+ENUM\s*\(([^)]+)\)",
        sql_text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    assert create_type_matches, "No CREATE TYPE ... AS ENUM statements emitted by upgrade head --sql"

    seen_counts: dict[str, int] = {}
    parsed_enums: dict[str, list[str]] = {}
    for type_name, body in create_type_matches:
        seen_counts[type_name] = seen_counts.get(type_name, 0) + 1
        values = re.findall(r"'([^']+)'", body)
        parsed_enums[type_name] = values

    for type_name, count in seen_counts.items():
        assert count == 1, f"Enum {type_name} created {count} times in upgrade head --sql"

    orm_enums: dict[str, list[str]] = {}
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            if isinstance(col.type, sa.Enum):
                assert col.type.name is not None, f"Unnamed Enum on {table.name}.{col.name}"
                orm_enums[col.type.name] = list(col.type.enums)

    assert set(orm_enums.keys()) == set(parsed_enums.keys()), (
        f"Enum type set mismatch: ORM={sorted(orm_enums)} vs Alembic={sorted(parsed_enums)}"
    )
    for type_name, expected_values in orm_enums.items():
        assert parsed_enums[type_name] == expected_values, (
            f"Enum {type_name} values mismatch: ORM={expected_values} vs Alembic={parsed_enums[type_name]}"
        )


def test_all_orm_tables_present_in_alembic_upgrade_sql():
    """Every table in Base.metadata must be created by the Alembic baseline migration."""
    sql_text = _generate_postgres_upgrade_sql()
    created_tables = set(
        re.findall(r"CREATE\s+TABLE\s+(\w+)\s*\(", sql_text, flags=re.IGNORECASE)
    )
    missing = set(Base.metadata.tables.keys()) - created_tables
    assert not missing, f"ORM tables missing from Alembic upgrade head SQL: {sorted(missing)}"


def test_all_orm_models_use_mapped_annotations():
    """Verify every mapped ORM class in Base declares SQLAlchemy 2.0 Mapped[...] annotations."""
    for mapper in Base.registry.mappers:
        cls = mapper.class_
        ann = {}
        for base_cls in cls.__mro__:
            ann.update(getattr(base_cls, "__annotations__", {}))
        col_keys = {prop.key for prop in mapper.column_attrs}
        assert col_keys <= set(ann.keys()), f"{cls.__name__} missing Mapped annotations for {col_keys - set(ann.keys())}"


def test_partial_unique_indexes_preserved_on_companies_and_candidates():
    """Verify partial unique indexes remain intact after SQLAlchemy 2.0 Mapped conversion."""
    companies_ix = {str(ix.name): ix for ix in Base.metadata.tables["companies"].indexes}
    candidates_ix = {str(ix.name): ix for ix in Base.metadata.tables["candidates"].indexes}
    assert companies_ix["uq_companies_tenant_domain"].unique is True
    assert candidates_ix["uq_candidate_tenant_email"].unique is True


def test_timestamp_mixin_columns_non_nullable_across_models():
    """Verify created_at/updated_at on TimestampMixin models remain non-nullable."""
    for table_name in ("tenants", "users", "candidates", "jobs", "agent_tasks"):
        tbl = Base.metadata.tables[table_name]
        assert tbl.c.created_at.nullable is False
        assert tbl.c.updated_at.nullable is False
