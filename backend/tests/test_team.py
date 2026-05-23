import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.main import app
from backend.db.models import User, UserRole, Team, TeamApiKeys

@pytest.mark.asyncio
async def test_create_manager_and_team(db_session: AsyncSession):
    # 1. Create Manager
    manager = User(
        email="manager@enterprise.com",
        full_name="Enterprise Manager",
        role=UserRole.MANAGER,
        hashed_password="mock"
    )
    db_session.add(manager)
    await db_session.commit()

    # 2. Create Team
    team = Team(
        name="Global Sourcing",
        manager_id=manager.id,
        default_credit_limit=5000,
        shared_pool_enabled=True
    )
    db_session.add(team)
    await db_session.commit()

    # 3. Add API Keys
    keys = TeamApiKeys(
        team_id=team.id,
        openai_key="sk-mock-manager-key",
        serper_key="mock-serper"
    )
    db_session.add(keys)
    await db_session.commit()

    assert team.id is not None
    assert keys.openai_key == "sk-mock-manager-key"

@pytest.mark.asyncio
async def test_invite_recruiter_and_inherit_keys(db_session: AsyncSession):
    # Fetch team
    stmt = select(Team).where(Team.name == "Global Sourcing")
    team = (await db_session.execute(stmt)).scalar_one()

    # Create Recruiter
    recruiter = User(
        email="recruiter@enterprise.com",
        full_name="Junior Recruiter",
        role=UserRole.RECRUITER,
        manager_id=team.manager_id,
        team_id=team.id,
        hashed_password="mock"
    )
    db_session.add(recruiter)
    await db_session.commit()

    # Verify inheritance logic simulation
    stmt_keys = select(TeamApiKeys).where(TeamApiKeys.team_id == recruiter.team_id)
    inherited_keys = (await db_session.execute(stmt_keys)).scalar_one()

    assert inherited_keys.openai_key == "sk-mock-manager-key"
    assert recruiter.manager_id == team.manager_id
