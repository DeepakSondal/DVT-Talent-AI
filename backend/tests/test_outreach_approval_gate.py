"""
Unit tests for the Outreach Human Approval Gate:
1. outreach_agent has no autonomous send tools registered.
2. _persist_outreach_campaign saves DRAFT + PENDING_REVIEW ledger entries and never auto-sends.
3. record_human_override dispatches valid outreach drafts on APPROVED and fails closed on placeholder emails.
4. record_human_override fails closed on GDPR-erased candidates.
"""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from agents.orchestrator import AgentOrchestrator
from agents.outreach_pydantic import outreach_agent
from api.routes.compliance import record_human_override
from db.models import AIDecisionLedger, CandidateStatus, EmailSent, EmailStatus, UserRole
from services.validation_service import validation_service


def test_outreach_agent_has_no_autonomous_send_tools():
    """Test 1: LLM outreach_agent must not expose push_to_smartlead_campaign as a callable tool."""
    toolset = getattr(outreach_agent, "_function_toolset", None)
    tool_names = set(toolset.tools.keys()) if toolset is not None else set()
    assert "push_to_smartlead_campaign" not in tool_names


@pytest.mark.asyncio
async def test_persist_outreach_campaign_saves_draft_and_pending_ledger_without_sending():
    """Test 2: _persist_outreach_campaign creates DRAFT + PENDING_REVIEW ledger rows and never auto-sends."""
    tenant_id = uuid.uuid4()
    owner_id = uuid.uuid4()
    cand_id = uuid.uuid4()
    added_objs = []

    fake_session = AsyncMock()
    fake_session.__aenter__.return_value = fake_session
    fake_session.__aexit__.return_value = None
    fake_session.add = MagicMock(side_effect=added_objs.append)

    def _assign_ids():
        for obj in added_objs:
            if getattr(obj, "id", None) is None:
                obj.id = uuid.uuid4()

    fake_session.flush = AsyncMock(side_effect=_assign_ids)

    owner_res = MagicMock()
    owner_res.scalar_one_or_none.return_value = SimpleNamespace(id=owner_id)
    cand_res = MagicMock()
    cand_res.scalar_one_or_none.return_value = SimpleNamespace(id=cand_id)
    fake_session.execute = AsyncMock(side_effect=[owner_res, cand_res])

    orch = AgentOrchestrator(tenant_id=str(tenant_id))
    with (
        patch("db.models.AsyncSessionLocal", return_value=fake_session),
        patch("services.email_service.EmailService.send_campaign", new=AsyncMock()) as mock_send_campaign,
        patch("services.email_service.EmailService.send_email", new=AsyncMock()) as mock_send_email,
    ):
        await orch._persist_outreach_campaign(
            results=[
                {
                    "candidate": "Maya Lin",
                    "email": "maya.lin@acme-engineering.io",
                    "outreach": {"subject": "Staff Role", "body": "Hi Maya, let's chat."},
                }
            ],
            job={"title": "Staff Engineer"},
        )

    mock_send_campaign.assert_not_awaited()
    mock_send_email.assert_not_awaited()

    drafts = [o for o in added_objs if isinstance(o, EmailSent)]
    ledgers = [o for o in added_objs if isinstance(o, AIDecisionLedger)]
    assert len(drafts) == 1
    assert drafts[0].status == EmailStatus.DRAFT
    assert len(ledgers) == 1
    assert ledgers[0].decision_type == "outreach_approval"
    assert ledgers[0].human_action == "PENDING_REVIEW"
    assert ledgers[0].evidence_signals["email_sent_id"] == str(drafts[0].id)


@pytest.mark.asyncio
async def test_approval_override_dispatches_valid_email_and_blocks_placeholder():
    """Test 3: Approving a valid outreach draft sends it; approving a placeholder domain fails closed (400)."""
    tenant_id = uuid.uuid4()
    reviewer = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role=UserRole.RECRUITER)
    email_id = uuid.uuid4()
    cand_id = uuid.uuid4()

    # Case A: Valid email dispatches cleanly
    ledger_ok = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        candidate_id=cand_id,
        job_id=None,
        decision_type="outreach_approval",
        evidence_signals={"email_sent_id": str(email_id), "candidate_email": "real.dev@company.io"},
        human_action="PENDING_REVIEW",
    )
    cand_ok = SimpleNamespace(id=cand_id, tenant_id=tenant_id, pii_erased=False, status=CandidateStatus.SOURCED, candidate_metadata={})
    email_ok = SimpleNamespace(
        id=email_id,
        tenant_id=tenant_id,
        to_email="real.dev@company.io",
        subject="Backend Role",
        body="Hi there",
        status=EmailStatus.DRAFT,
        sent_at=None,
    )

    fake_db = AsyncMock()
    res_entry = MagicMock()
    res_entry.scalar_one_or_none.return_value = ledger_ok
    res_cand = MagicMock()
    res_cand.scalar_one_or_none.return_value = cand_ok
    res_email = MagicMock()
    res_email.scalar_one_or_none.return_value = email_ok
    res_not_erased = MagicMock()
    res_not_erased.scalar_one_or_none.return_value = None
    fake_db.execute = AsyncMock(side_effect=[res_entry, res_cand, res_email, res_not_erased])

    with (
        patch("services.email_service.EmailService.send_email", new=AsyncMock(return_value=True)) as mock_send,
        patch("api.routes.compliance.compliance_service.check_screening_notice_eligibility", return_value=None),
    ):
        out = await record_human_override(
            ledger_id=str(ledger_ok.id),
            human_action="APPROVED",
            override_reason="Looks great",
            payload=None,
            current_user=reviewer,
            db=fake_db,
        )

    mock_send.assert_awaited_once()
    assert out["outreach_dispatch_status"] == "sent"
    assert email_ok.status == EmailStatus.SENT
    assert cand_ok.status == CandidateStatus.CONTACTED

    # Re-approving an already SENT draft must be idempotent (no duplicate send)
    fake_db_dup = AsyncMock()
    d1, d2, d3, d4 = MagicMock(), MagicMock(), MagicMock(), MagicMock()
    d1.scalar_one_or_none.return_value = ledger_ok
    d2.scalar_one_or_none.return_value = cand_ok
    d3.scalar_one_or_none.return_value = email_ok
    d4.scalar_one_or_none.return_value = None
    fake_db_dup.execute = AsyncMock(side_effect=[d1, d2, d3, d4])
    with (
        patch("services.email_service.EmailService.send_email", new=AsyncMock()) as mock_send_dup,
        patch("api.routes.compliance.compliance_service.check_screening_notice_eligibility", return_value=None),
    ):
        out_dup = await record_human_override(
            ledger_id=str(ledger_ok.id),
            human_action="APPROVED",
            override_reason=None,
            payload=None,
            current_user=reviewer,
            db=fake_db_dup,
        )
    mock_send_dup.assert_not_awaited()
    assert out_dup["outreach_dispatch_status"] == "already_sent"

    # Case B: Synthetic placeholder domain fails closed with HTTP 400
    assert validation_service.is_placeholder_email("alex.1234abcd@sourced.dvt-talent.io") is True
    email_bad = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        to_email="alex.1234abcd@sourced.dvt-talent.io",
        subject="Backend Role",
        body="Hi",
        status=EmailStatus.DRAFT,
    )
    ledger_bad = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        candidate_id=cand_id,
        job_id=None,
        decision_type="outreach_approval",
        evidence_signals={"email_sent_id": str(email_bad.id)},
        human_action="PENDING_REVIEW",
    )
    fake_db_bad = AsyncMock()
    r1, r2, r3, r4 = MagicMock(), MagicMock(), MagicMock(), MagicMock()
    r1.scalar_one_or_none.return_value = ledger_bad
    r2.scalar_one_or_none.return_value = cand_ok
    r3.scalar_one_or_none.return_value = email_bad
    r4.scalar_one_or_none.return_value = None
    fake_db_bad.execute = AsyncMock(side_effect=[r1, r2, r3, r4])

    with patch("services.email_service.EmailService.send_email", new=AsyncMock()) as mock_send_bad:
        with pytest.raises(HTTPException) as exc_info:
            await record_human_override(
                ledger_id=str(ledger_bad.id),
                human_action="APPROVED",
                override_reason=None,
                payload=None,
                current_user=reviewer,
                db=fake_db_bad,
            )
    assert exc_info.value.status_code == 400
    mock_send_bad.assert_not_awaited()
    assert email_bad.status == EmailStatus.FAILED
    assert ledger_bad.human_action == "REJECTED"


@pytest.mark.asyncio
async def test_approval_override_blocks_gdpr_erased_candidate():
    """Test 4: Approving outreach for a GDPR-erased candidate fails closed with HTTP 400."""
    tenant_id = uuid.uuid4()
    reviewer = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role=UserRole.ADMIN)
    cand_id = uuid.uuid4()
    email_id = uuid.uuid4()

    ledger_entry = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        candidate_id=cand_id,
        job_id=None,
        decision_type="outreach_approval",
        evidence_signals={"email_sent_id": str(email_id), "candidate_email": "erased@company.io"},
        human_action="PENDING_REVIEW",
    )
    cand_erased = SimpleNamespace(id=cand_id, tenant_id=tenant_id, pii_erased=True, status=CandidateStatus.SOURCED)
    email_row = SimpleNamespace(id=email_id, tenant_id=tenant_id, to_email="erased@company.io", status=EmailStatus.DRAFT)

    fake_db = AsyncMock()
    r1, r2, r3 = MagicMock(), MagicMock(), MagicMock()
    r1.scalar_one_or_none.return_value = ledger_entry
    r2.scalar_one_or_none.return_value = cand_erased
    r3.scalar_one_or_none.return_value = email_row
    fake_db.execute = AsyncMock(side_effect=[r1, r2, r3])

    with patch("services.email_service.EmailService.send_email", new=AsyncMock()) as mock_send:
        with pytest.raises(HTTPException) as exc_info:
            await record_human_override(
                ledger_id=str(ledger_entry.id),
                human_action="APPROVED",
                override_reason=None,
                payload=None,
                current_user=reviewer,
                db=fake_db,
            )

    assert exc_info.value.status_code == 400
    assert "GDPR" in exc_info.value.detail
    mock_send.assert_not_awaited()
    assert email_row.status == EmailStatus.FAILED


@pytest.mark.asyncio
async def test_rejecting_outreach_draft_preserves_candidate_status():
    """Test 5: Cancelling an outreach draft must not overwrite the candidate's existing pipeline status."""
    tenant_id = uuid.uuid4()
    reviewer = SimpleNamespace(id=uuid.uuid4(), tenant_id=tenant_id, role=UserRole.RECRUITER)
    cand_id = uuid.uuid4()
    email_id = uuid.uuid4()

    ledger_entry = SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        candidate_id=cand_id,
        job_id=None,
        decision_type="outreach_approval",
        evidence_signals={"email_sent_id": str(email_id), "candidate_email": "keep@company.io"},
        human_action="PENDING_REVIEW",
    )
    cand_existing = SimpleNamespace(id=cand_id, tenant_id=tenant_id, pii_erased=False, status=CandidateStatus.SCREENED)
    email_row = SimpleNamespace(id=email_id, tenant_id=tenant_id, to_email="keep@company.io", status=EmailStatus.DRAFT)

    fake_db = AsyncMock()
    r1, r2, r3 = MagicMock(), MagicMock(), MagicMock()
    r1.scalar_one_or_none.return_value = ledger_entry
    r2.scalar_one_or_none.return_value = cand_existing
    r3.scalar_one_or_none.return_value = email_row
    fake_db.execute = AsyncMock(side_effect=[r1, r2, r3])

    out = await record_human_override(
        ledger_id=str(ledger_entry.id),
        human_action="REJECTED",
        override_reason=None,
        payload=None,
        current_user=reviewer,
        db=fake_db,
    )

    assert out["outreach_dispatch_status"] == "cancelled"
    assert out["candidate_status"] is None
    assert cand_existing.status == CandidateStatus.SCREENED
    assert email_row.status == EmailStatus.FAILED
