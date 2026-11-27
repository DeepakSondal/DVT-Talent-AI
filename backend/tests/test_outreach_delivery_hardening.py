"""Regression tests for outreach draft editing, retryable failures, signed unsubscribe, Resend webhooks, and OAuth refresh."""
import base64
import hashlib
import hmac
import json
import time
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient

from api.routes.auth import create_access_token, hash_password
from config import settings
from db.models import (
    AIDecisionLedger,
    AsyncSessionLocal,
    Candidate,
    CandidateStatus,
    EmailSent,
    EmailStatus,
    Job,
    JobCandidate,
    Tenant,
    User,
    UserRole,
)
from main import app
from services.email_service import (
    EmailService,
    OAuthSenderConfig,
    _deliver_oauth_message,
    create_unsubscribe_token,
    is_email_unsubscribed,
)
from services.security_service import decrypt_pii, encrypt_pii


async def _seed_outreach_fixture():
    pwd = await hash_password("OutreachTest#12345")
    async with AsyncSessionLocal() as db:
        t_a = Tenant(
            id=uuid.uuid4(),
            name="Alpha Recruiting",
            domain=f"alpha-{uuid.uuid4().hex[:5]}.com",
            is_active=True,
            settings={},
        )
        t_b = Tenant(
            id=uuid.uuid4(),
            name="Beta Recruiting",
            domain=f"beta-{uuid.uuid4().hex[:5]}.com",
            is_active=True,
            settings={},
        )
        db.add_all([t_a, t_b])
        await db.flush()

        rec_a = User(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            email=f"rec-{uuid.uuid4().hex[:6]}@{t_a.domain}",
            full_name="Recruiter Alpha",
            hashed_password=pwd,
            role=UserRole.RECRUITER,
            is_active=True,
            is_verified=True,
        )
        job_a = Job(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            title="Principal Platform Engineer",
            location="Remote",
            remote=True,
            is_active=True,
            is_published=True,
        )
        b2c_cand = Candidate(
            id=uuid.uuid4(),
            tenant_id=None,
            first_name="Nadia",
            last_name="Portal",
            email=f"nadia-{uuid.uuid4().hex[:6]}@proton.me",
            title="Staff Distributed Engineer",
            status=CandidateStatus.SOURCED,
        )
        db.add_all([rec_a, job_a, b2c_cand])
        await db.flush()

        jc = JobCandidate(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            job_id=job_a.id,
            candidate_id=b2c_cand.id,
            status=CandidateStatus.SOURCED,
            applied_by_candidate=True,
            match_score=91.0,
        )
        email_row = EmailSent(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            recruiter_id=rec_a.id,
            candidate_id=b2c_cand.id,
            to_email=b2c_cand.email,
            subject="Initial AI Subject",
            body="Initial AI draft body.",
            status=EmailStatus.DRAFT,
        )
        db.add_all([jc, email_row])
        await db.flush()

        ledger = AIDecisionLedger(
            id=uuid.uuid4(),
            tenant_id=t_a.id,
            job_id=job_a.id,
            candidate_id=b2c_cand.id,
            decision_type="outreach_approval",
            qualification_score=91.0,
            confidence_level="high",
            reasoning_summary="Strong systems architecture overlap.",
            evidence_signals={"email_sent_id": str(email_row.id), "role_title": job_a.title},
            human_action="PENDING_REVIEW",
        )
        db.add(ledger)
        await db.commit()

        tok_a = create_access_token({"sub": str(rec_a.id), "role": "recruiter", "tenant_id": str(t_a.id)})
        return {
            "t_a_id": t_a.id,
            "t_b_id": t_b.id,
            "job_a_id": job_a.id,
            "cand_id": b2c_cand.id,
            "cand_email": b2c_cand.email,
            "email_id": email_row.id,
            "ledger_id": ledger.id,
            "jc_id": jc.id,
            "tok_a": tok_a,
        }


@pytest.mark.asyncio
async def test_approvals_draft_editing_and_b2c_applicant_isolation():
    """Approvals resolves B2C applicants, sends edited subject/body, updates JobCandidate only, and leaves Candidate.status untouched."""
    ctx = await _seed_outreach_fixture()
    headers = {"Authorization": f"Bearer {ctx['tok_a']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        ledgers = await client.get(f"/api/v1/compliance/ledgers?job_id={ctx['job_a_id']}", headers=headers)
        assert ledgers.status_code == 200
        rows = ledgers.json()
        assert len(rows) == 1
        assert rows[0]["candidate_name"] == "Nadia Portal"
        assert rows[0]["has_verified_email"] is True
        assert rows[0]["draft_subject"] == "Initial AI Subject"

        captured: dict = {}

        async def _fake_send(self, email_id, to_address, subject, body, tenant_id=None):
            captured.update({"subject": subject, "body": body, "to": to_address})
            return True

        with patch.object(EmailService, "send_email", new=_fake_send):
            res = await client.post(
                f"/api/v1/compliance/ledgers/{ctx['ledger_id']}/override",
                json={
                    "reviewer_override": "APPROVED",
                    "notes": "Edited salary and tone before sending.",
                    "draft_subject": "Updated Subject — Principal Platform",
                    "draft_body": "Hi Nadia, updated body with comp band.",
                },
                headers=headers,
            )
        assert res.status_code == 200
        body = res.json()
        assert body["outreach_dispatch_status"] == "sent"
        assert body["job_candidate_status"] == "contacted"
        assert body["candidate_status"] is None  # B2C shared Candidate.status must NOT be mutated
        assert captured["subject"] == "Updated Subject — Principal Platform"
        assert captured["body"] == "Hi Nadia, updated body with comp band."

    async with AsyncSessionLocal() as db:
        shared_cand = await db.get(Candidate, ctx["cand_id"])
        jc = await db.get(JobCandidate, ctx["jc_id"])
        email_row = await db.get(EmailSent, ctx["email_id"])
        assert shared_cand is not None and shared_cand.status == CandidateStatus.SOURCED
        assert jc is not None and jc.status == CandidateStatus.CONTACTED
        assert email_row is not None and email_row.subject == "Updated Subject — Principal Platform"


@pytest.mark.asyncio
async def test_failed_delivery_keeps_decision_pending_for_retry():
    """When provider delivery fails, ledger stays PENDING_REVIEW so the recruiter can retry and succeed."""
    ctx = await _seed_outreach_fixture()
    headers = {"Authorization": f"Bearer {ctx['tok_a']}"}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        with patch.object(EmailService, "send_email", new=AsyncMock(return_value=False)):
            fail_res = await client.post(
                f"/api/v1/compliance/ledgers/{ctx['ledger_id']}/override",
                json={"reviewer_override": "APPROVED"},
                headers=headers,
            )
        assert fail_res.status_code == 200
        assert fail_res.json()["outreach_dispatch_status"] == "failed"
        assert fail_res.json()["human_action"] == "PENDING_REVIEW"

        # Retry succeeds once provider recovers
        with patch.object(EmailService, "send_email", new=AsyncMock(return_value=True)):
            retry_res = await client.post(
                f"/api/v1/compliance/ledgers/{ctx['ledger_id']}/override",
                json={"reviewer_override": "APPROVED"},
                headers=headers,
            )
        assert retry_res.status_code == 200
        assert retry_res.json()["outreach_dispatch_status"] == "sent"
        assert retry_res.json()["human_action"] == "APPROVED"


@pytest.mark.asyncio
async def test_signed_unsubscribe_and_tenant_scoped_suppression():
    """Signed unsubscribe token suppresses Tenant A outreach without affecting Tenant B, and rejects tampered tokens."""
    ctx = await _seed_outreach_fixture()
    headers = {"Authorization": f"Bearer {ctx['tok_a']}"}
    token = create_unsubscribe_token(ctx["t_a_id"], ctx["cand_email"], str(ctx["email_id"]))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        bad = await client.post("/api/v1/email-sender/unsubscribe", json={"token": "tampered.token.value"})
        assert bad.status_code == 400

        ok = await client.post("/api/v1/email-sender/unsubscribe", json={"token": token})
        assert ok.status_code == 200
        assert ok.json()["status"] == "unsubscribed"

        assert await is_email_unsubscribed(ctx["t_a_id"], ctx["cand_email"]) is True
        assert await is_email_unsubscribed(ctx["t_b_id"], ctx["cand_email"]) is False

        # Approval send for Tenant A is now blocked with 400
        blocked = await client.post(
            f"/api/v1/compliance/ledgers/{ctx['ledger_id']}/override",
            json={"reviewer_override": "APPROVED"},
            headers=headers,
        )
        assert blocked.status_code == 400
        assert "unsubscribed" in blocked.json()["detail"].lower()


@pytest.mark.asyncio
async def test_resend_webhook_signature_verification_and_event_updates():
    """Resend webhook fails closed on bad signature and updates opened_at, clicks_count, and bounce suppression on valid HMAC."""
    ctx = await _seed_outreach_fixture()
    provider_id = f"re_{uuid.uuid4().hex[:12]}"
    async with AsyncSessionLocal() as db:
        email_row = await db.get(EmailSent, ctx["email_id"])
        assert email_row is not None
        setattr(email_row, "gmail_message_id", provider_id)
        setattr(email_row, "status", EmailStatus.SENT)
        await db.commit()

    raw_secret = base64.b64encode(b"super-secret-resend-webhook-key").decode("utf-8")
    wh_secret = f"whsec_{raw_secret}"

    def _sign(payload_bytes: bytes, msg_id: str, ts: str) -> str:
        signed = f"{msg_id}.{ts}.".encode("utf-8") + payload_bytes
        digest = hmac.new(base64.b64decode(raw_secret), signed, hashlib.sha256).digest()
        return f"v1,{base64.b64encode(digest).decode('utf-8')}"

    with patch.object(settings, "resend_webhook_secret", wh_secret):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            ts = str(int(time.time()))
            opened_payload = json.dumps({"type": "email.opened", "data": {"email_id": provider_id}}).encode("utf-8")

            # Invalid signature -> 401
            bad_res = await client.post(
                "/api/v1/email-sender/webhooks/resend",
                content=opened_payload,
                headers={"svix-id": "msg_1", "svix-timestamp": ts, "svix-signature": "v1,invalid"},
            )
            assert bad_res.status_code == 401

            # Valid opened + clicked + bounced events
            for idx, ev_type in enumerate(("email.opened", "email.clicked", "email.bounced")):
                body_bytes = json.dumps({"type": ev_type, "data": {"email_id": provider_id}}).encode("utf-8")
                msg_id = f"msg_ok_{idx}"
                res = await client.post(
                    "/api/v1/email-sender/webhooks/resend",
                    content=body_bytes,
                    headers={
                        "svix-id": msg_id,
                        "svix-timestamp": ts,
                        "svix-signature": _sign(body_bytes, msg_id, ts),
                    },
                )
                assert res.status_code == 200
                assert res.json()["status"] == "processed"

    async with AsyncSessionLocal() as db:
        updated = await db.get(EmailSent, ctx["email_id"])
        assert updated is not None
        assert updated.opened_at is not None
        assert int(updated.clicks_count or 0) == 1
        assert updated.status == EmailStatus.BOUNCED
    assert await is_email_unsubscribed(ctx["t_a_id"], ctx["cand_email"]) is True


@pytest.mark.asyncio
async def test_microsoft_oauth_401_refresh_and_token_persistence():
    """Microsoft Graph 401 triggers refresh-token exchange, retries sendMail, and persists the new encrypted access token."""
    ctx = await _seed_outreach_fixture()
    async with AsyncSessionLocal() as db:
        tenant = await db.get(Tenant, ctx["t_a_id"])
        assert tenant is not None
        setattr(
            tenant,
            "settings",
            {
                "email_oauth": {
                    "provider": "microsoft",
                    "access_token_encrypted": encrypt_pii("expired_ms_token"),
                    "refresh_token_encrypted": encrypt_pii("valid_ms_refresh"),
                }
            },
        )
        await db.commit()

    sender_cfg = OAuthSenderConfig(
        provider="microsoft",
        sender_name="Recruiter Alpha",
        sender_email="rec@alpha.com",
        access_token="expired_ms_token",
        refresh_token="valid_ms_refresh",
        tenant_id=ctx["t_a_id"],
    )

    resp_401 = MagicMock(status_code=401)
    resp_202 = MagicMock(status_code=202)
    mock_client = AsyncMock()
    mock_client.post = AsyncMock(side_effect=[resp_401, resp_202])
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)

    from email.message import EmailMessage

    msg = EmailMessage()
    msg.set_content("Hello")

    with (
        patch.dict("os.environ", {"PYTEST_CURRENT_TEST": ""}),
        patch("services.email_service.httpx.AsyncClient", return_value=mock_client),
        patch("services.email_service._refresh_microsoft_access_token", new=AsyncMock(return_value="fresh_ms_token")),
    ):
        ok = await _deliver_oauth_message(sender_cfg, msg, "cand@example.org", "Hi", "Hello")

    assert ok is True
    assert mock_client.post.call_count == 2
    async with AsyncSessionLocal() as db:
        tenant = await db.get(Tenant, ctx["t_a_id"])
        assert tenant is not None
        stored_enc = (tenant.settings or {}).get("email_oauth", {}).get("access_token_encrypted")
        assert decrypt_pii(stored_enc) == "fresh_ms_token"
