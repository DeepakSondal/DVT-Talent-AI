"""
DVT Talent AI — Database Migration Guidance
Schema lifecycle is managed exclusively by Alembic (`backend/migrations/`).
Run from `backend/`: `python -m alembic upgrade head`
"""

MIGRATION_COMMANDS = """
# Schema lifecycle is managed exclusively via Alembic (backend/migrations/):
#   python -m alembic upgrade head
#   python -m alembic revision --autogenerate -m "<description>"
"""
