import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid


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

@pytest.mark.asyncio
async def test_team_api_keys_encryption(db_session: AsyncSession):
    from services.security_service import encrypt_pii, decrypt_pii
    
    # 1. Create a dummy team
    team = Team(
        name="Security Test Team",
        manager_id=uuid.uuid4(), # mock ID
        default_credit_limit=1000
    )
    db_session.add(team)
    await db_session.commit()

    # 2. Encrypt & Save Keys
    raw_openai_key = "sk-proj-super-secret-openai-key-value-12345"
    raw_serper_key = "serper-secret-api-key-9999"
    
    encrypted_keys = TeamApiKeys(
        team_id=team.id,
        openai_key=encrypt_pii(raw_openai_key),
        serper_key=encrypt_pii(raw_serper_key)
    )
    db_session.add(encrypted_keys)
    await db_session.commit()

    # 3. Retrieve keys and verify they are encrypted in the database
    stmt = select(TeamApiKeys).where(TeamApiKeys.team_id == team.id)
    db_keys = (await db_session.execute(stmt)).scalar_one()

    assert db_keys.openai_key != raw_openai_key
    assert db_keys.serper_key != raw_serper_key
    assert "sk-proj" not in db_keys.openai_key  # Must be encrypted/gibberish

    # 4. Decrypt and verify they match raw values
    assert decrypt_pii(db_keys.openai_key) == raw_openai_key
    assert decrypt_pii(db_keys.serper_key) == raw_serper_key

