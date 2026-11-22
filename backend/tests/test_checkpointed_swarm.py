"""
Unit tests for Checkpointed Swarm Orchestration:
1. Full pipeline writes discovery_complete -> sourcing_complete -> critic_complete -> post_complete checkpoints.
2. Resuming from saved stages skips already-completed discovery & sourcing LLM calls.
3. enabled_stages honors stage toggles (skipping disabled stages and enabling screening).
4. resume_swarm_pipeline enforces tenant isolation, blocks COMPLETED/RUNNING tasks, and resumes FAILED tasks.
"""
import uuid
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import BackgroundTasks, HTTPException

from agents.orchestrator import AgentOrchestrator
from api.routes.agents import resume_swarm_pipeline
from db.models import AgentTaskStatus, UserRole


def _mock_result(data: Any) -> SimpleNamespace:
    return SimpleNamespace(data=data, output=data)


@pytest.mark.asyncio
async def test_pipeline_writes_checkpoints_in_order():
    """Test 1: Verifies checkpoints are persisted after each stage."""
    orch = AgentOrchestrator(tenant_id=str(uuid.uuid4()))
    checkpoints: list[str] = []

    async def _capture_cp(task_id: Any, checkpoint: str, results: dict[str, Any]) -> None:
        checkpoints.append(checkpoint)
        results["checkpoint"] = checkpoint

    disc = _mock_result({"extracted_jd": {"title": "Backend Engineer"}})
    sourc = _mock_result({"candidates": [{"full_name": "A"}, {"full_name": "B"}, {"full_name": "C"}]})
    crit = _mock_result({"passed": True})
    out = _mock_result({"drafts": []})
    anal = _mock_result({"summary": "ok"})

    with (
        patch.object(orch, "_save_checkpoint", side_effect=_capture_cp),
        patch("agents.orchestrator.broadcast_signal"),
        patch("agents.orchestrator.guardrail_service.check_rate_limit", new=AsyncMock(return_value=(True, None))),
        patch("agents.discovery_pydantic.discovery_agent.run", new=AsyncMock(return_value=disc)),
        patch("agents.sourcing_pydantic.sourcing_agent.run", new=AsyncMock(return_value=sourc)),
        patch("agents.critic_pydantic.critic_agent.run", new=AsyncMock(return_value=crit)),
        patch("agents.outreach_pydantic.outreach_agent.run", new=AsyncMock(return_value=out)),
        patch("agents.analytics_pydantic.analytics_agent.run", new=AsyncMock(return_value=anal)),
    ):
        res = await orch.run_full_pipeline(industry="Python", location="Remote", mock_mode=True, task_id=str(uuid.uuid4()))

    assert "error" not in res
    assert checkpoints == ["discovery_complete", "sourcing_complete", "critic_complete", "post_complete"]
    assert res["checkpoint"] == "post_complete"


@pytest.mark.asyncio
async def test_resume_from_stages_skips_completed_llm_calls():
    """Test 2: Resuming with discovery & sourcing already saved does not re-invoke those agents."""
    orch = AgentOrchestrator(tenant_id=str(uuid.uuid4()))
    crit = _mock_result({"passed": True})
    out = _mock_result({"drafts": [{"subject": "Hi"}]})
    anal = _mock_result({"summary": "resumed"})

    saved_stages = {
        "discovery": {"extracted_jd": {"title": "Staff Go Engineer"}},
        "sourcing": {"candidates": [{"full_name": "Dev 1"}, {"full_name": "Dev 2"}, {"full_name": "Dev 3"}]},
    }

    with (
        patch.object(orch, "_save_checkpoint", new=AsyncMock()),
        patch("agents.orchestrator.broadcast_signal"),
        patch("agents.orchestrator.guardrail_service.check_rate_limit", new=AsyncMock(return_value=(True, None))),
        patch("agents.discovery_pydantic.discovery_agent.run", new=AsyncMock()) as mock_disc,
        patch("agents.sourcing_pydantic.sourcing_agent.run", new=AsyncMock()) as mock_sourc,
        patch("agents.critic_pydantic.critic_agent.run", new=AsyncMock(return_value=crit)) as mock_crit,
        patch("agents.outreach_pydantic.outreach_agent.run", new=AsyncMock(return_value=out)),
        patch("agents.analytics_pydantic.analytics_agent.run", new=AsyncMock(return_value=anal)),
    ):
        res = await orch.run_full_pipeline(
            industry="Go",
            location="Remote",
            mock_mode=True,
            resume_from_stages=saved_stages,
        )

    mock_disc.assert_not_awaited()
    mock_sourc.assert_not_awaited()
    mock_crit.assert_awaited_once()
    assert res["stages"]["analytics"]["summary"] == "resumed"


@pytest.mark.asyncio
async def test_enabled_stages_honors_toggles_and_screening():
    """Test 3: Disabled stages (discovery, outreach, analytics) are skipped while screening runs when enabled."""
    orch = AgentOrchestrator(tenant_id=str(uuid.uuid4()))
    sourc = _mock_result({"candidates": [{"full_name": "C1"}, {"full_name": "C2"}, {"full_name": "C3"}]})
    scr = _mock_result({"role_title": "Frontend Engineer", "questions": []})

    with (
        patch.object(orch, "_save_checkpoint", new=AsyncMock()),
        patch("agents.orchestrator.broadcast_signal"),
        patch("agents.orchestrator.guardrail_service.check_rate_limit", new=AsyncMock(return_value=(True, None))),
        patch("agents.discovery_pydantic.discovery_agent.run", new=AsyncMock()) as mock_disc,
        patch("agents.sourcing_pydantic.sourcing_agent.run", new=AsyncMock(return_value=sourc)),
        patch("agents.critic_pydantic.critic_agent.run", new=AsyncMock()) as mock_crit,
        patch("agents.outreach_pydantic.outreach_agent.run", new=AsyncMock()) as mock_out,
        patch("agents.analytics_pydantic.analytics_agent.run", new=AsyncMock()) as mock_anal,
        patch("agents.screening_pydantic.screening_agent.run", new=AsyncMock(return_value=scr)) as mock_scr,
    ):
        res = await orch.run_full_pipeline(
            industry="Frontend Engineer",
            location="Remote",
            mock_mode=True,
            enabled_stages=["sourcing", "screening"],
        )

    mock_disc.assert_not_awaited()
    mock_crit.assert_not_awaited()
    mock_out.assert_not_awaited()
    mock_anal.assert_not_awaited()
    mock_scr.assert_awaited_once()
    assert "screening_guide" in res["stages"]
    assert "outreach" not in res["stages"]


@pytest.mark.asyncio
async def test_resume_swarm_endpoint_validation_and_dispatch():
    """Test 4: Resume endpoint rejects completed tasks (400), cross-tenant tasks (404), and resumes failed tasks."""
    tenant_id = uuid.uuid4()
    other_tenant = uuid.uuid4()
    task_id = uuid.uuid4()
    user: Any = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role=UserRole.RECRUITER)

    # Cross-tenant -> 404
    db_404 = AsyncMock()
    db_404.get.return_value = SimpleNamespace(id=task_id, tenant_id=other_tenant, status=AgentTaskStatus.FAILED)
    with patch("api.routes.agents._enforce_agent_rate_limit", new=AsyncMock(return_value=tenant_id)):
        with pytest.raises(HTTPException) as exc_404:
            await resume_swarm_pipeline(task_id, MagicMock(), BackgroundTasks(), db=db_404, current_user=user)
    assert exc_404.value.status_code == 404

    # Completed task -> 400
    db_400 = AsyncMock()
    db_400.get.return_value = SimpleNamespace(id=task_id, tenant_id=tenant_id, status=AgentTaskStatus.COMPLETED)
    with patch("api.routes.agents._enforce_agent_rate_limit", new=AsyncMock(return_value=tenant_id)):
        with pytest.raises(HTTPException) as exc_400:
            await resume_swarm_pipeline(task_id, MagicMock(), BackgroundTasks(), db=db_400, current_user=user)
    assert exc_400.value.status_code == 400

    # Failed task -> resumes cleanly via BackgroundTasks when Celery unavailable
    failed_task = SimpleNamespace(
        id=task_id,
        tenant_id=tenant_id,
        status=AgentTaskStatus.FAILED,
        current_checkpoint="sourcing_complete",
        retries=0,
        input_data={"industry": "Python", "location": "Remote", "enabled_stages": ["sourcing", "screening"]},
        output_data={"stages": {"discovery": {}, "sourcing": {"candidates": []}}},
    )
    db_ok = AsyncMock()
    db_ok.get.return_value = failed_task
    bg = BackgroundTasks()
    with (
        patch("api.routes.agents._enforce_agent_rate_limit", new=AsyncMock(return_value=tenant_id)),
        patch("workers.tasks.is_celery_broker_available", return_value=False),
    ):
        resp = await resume_swarm_pipeline(task_id, MagicMock(), bg, db=db_ok, current_user=user)

    assert resp["status"] == "active"
    assert resp["resumed_from_checkpoint"] == "sourcing_complete"
    assert failed_task.status == AgentTaskStatus.RUNNING
    assert failed_task.retries == 1
    assert len(bg.tasks) == 1
    assert cast(Any, bg.tasks[0]) is not None
