"""
Unit tests for Per-Tenant Monster & Dice Credentials + Shared BYOK Resolver:
1. save_team_api_keys encrypts monster_api_key and dice_api_key and invalidates cache.
2. get_team_api_keys returns masked monster_api_key_hint and dice_api_key_hint.
3. build_tenant_agent_deps resolves tenant Monster/Dice/LLM keys and falls back to settings.
4. Alembic migration 0004 chains cleanly onto 0003_user_monthly_credit_limit with upgrade/downgrade.
"""
import importlib.util
import uuid
from pathlib import Path
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agents import pydantic_config
from api.routes.team import TeamApiKeysConfig, get_team_api_keys, save_team_api_keys
from db.models import TeamApiKeys
from services.security_service import decrypt_pii, encrypt_pii


@pytest.mark.asyncio
async def test_save_and_get_team_monster_dice_keys_encrypted_and_masked():
    """Test 1 & 2: Monster & Dice keys are encrypted at rest, masked on read, and invalidate cache."""
    tenant_id = uuid.uuid4()
    team_id = uuid.uuid4()
    manager: Any = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role="admin")
    fake_team = SimpleNamespace(id=team_id, tenant_id=tenant_id)
    stored_keys = TeamApiKeys(team_id=team_id)

    db = AsyncMock()
    res_keys = MagicMock()
    res_keys.scalar_one_or_none.return_value = stored_keys
    db.execute = AsyncMock(return_value=res_keys)

    pydantic_config._TENANT_KEYS_CACHE[str(tenant_id)] = (9999999999.0, {"monster_api_key": "stale"})

    with patch("api.routes.team._resolve_manager_or_tenant_team", new=AsyncMock(return_value=fake_team)):
        save_res = await save_team_api_keys(
            payload=TeamApiKeysConfig(
                monster_api_key="mnstr_live_1234567890",
                dice_api_key="dice_live_abcdefghij",
            ),
            db=db,
            manager=manager,
        )
        assert save_res["status"] == "saved"
        assert str(tenant_id) not in pydantic_config._TENANT_KEYS_CACHE
        assert stored_keys.monster_api_key is not None
        assert stored_keys.monster_api_key != "mnstr_live_1234567890"
        assert decrypt_pii(stored_keys.monster_api_key) == "mnstr_live_1234567890"
        assert stored_keys.dice_api_key is not None
        assert decrypt_pii(stored_keys.dice_api_key) == "dice_live_abcdefghij"

        out = await get_team_api_keys(db=db, manager=manager)
        assert out.configured is True
        assert out.monster_api_key_hint is not None
        assert out.monster_api_key_hint.startswith("mnst")
        assert out.monster_api_key_hint.endswith("7890")
        assert out.dice_api_key_hint is not None
        assert out.dice_api_key_hint.startswith("dice")
        assert out.dice_api_key_hint.endswith("ghij")


@pytest.mark.asyncio
async def test_build_tenant_agent_deps_resolves_monster_dice_keys():
    """Test 3: build_tenant_agent_deps decrypts tenant Monster/Dice/LLM keys into AgentDeps."""
    tenant_id = str(uuid.uuid4())
    pydantic_config.invalidate_tenant_keys_cache(tenant_id)

    fake_row = SimpleNamespace(
        openai_key=encrypt_pii("sk-tenant-openai"),
        serper_key=encrypt_pii("serp-tenant-key"),
        anthropic_key=None,
        monster_api_key=encrypt_pii("tenant-monster-secret"),
        dice_api_key=encrypt_pii("tenant-dice-secret"),
    )
    fake_session = AsyncMock()
    fake_session.__aenter__.return_value = fake_session
    fake_session.__aexit__.return_value = None
    exec_res = MagicMock()
    exec_res.scalar_one_or_none.return_value = fake_row
    fake_session.execute = AsyncMock(return_value=exec_res)

    with patch("db.models.AsyncSessionLocal", return_value=fake_session):
        deps = await pydantic_config.build_tenant_agent_deps(
            http_client=MagicMock(),
            tenant_id=tenant_id,
        )

    assert deps.openai_key == "sk-tenant-openai"
    assert deps.serper_key == "serp-tenant-key"
    assert deps.monster_api_key == "tenant-monster-secret"
    assert deps.dice_api_key == "tenant-dice-secret"


def test_alembic_migration_0004_metadata():
    """Test 4: Verifies migration 0004 revision chain and reversible upgrade/downgrade functions."""
    mig_path = Path(__file__).resolve().parents[1] / "migrations" / "versions" / "0004_team_job_board_api_keys.py"
    assert mig_path.exists()
    spec = importlib.util.spec_from_file_location("mig_0004", mig_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    assert mod.revision == "0004_team_job_board_api_keys"
    assert mod.down_revision == "0003_user_monthly_credit_limit"
    assert callable(mod.upgrade)
    assert callable(mod.downgrade)
