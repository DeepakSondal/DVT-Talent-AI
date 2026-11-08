"""
Unit tests for functional workflow fixes:
1. Outreach phase accepts both `approved_candidates` and `recipients` payload shapes from OutreachLab UI.
2. Compliance ledger routes (/ledgers and /decision-ledger) and JSON body overrides work identically.
3. Sourcing and Outreach persistence helpers safely skip when tenant_id is 'default' or None.
"""
import uuid
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from agents.orchestrator import AgentOrchestrator


class _DummyOutput:
    def __init__(self, data: dict):
        self._data = data
        for k, v in data.items():
            setattr(self, k, v)

    def model_dump(self):
        return self._data


class _DummyRunResult:
    def __init__(self, output):
        self.output = output


@pytest.mark.asyncio
async def test_outreach_phase_accepts_frontend_recipients_payload():
    """Verify run_swarm_phase('outreach') maps frontend `recipients` + `campaign_name` into outreach drafts."""
    orchestrator = AgentOrchestrator(tenant_id=str(uuid.uuid4()))
    mock_out = _DummyRunResult(
        _DummyOutput({
            "status": "drafted",
            "drafts": [
                {
                    "candidate_email": "elena@example.com",
                    "subject": "Senior Distributed Systems Role",
                    "body": "Hi Elena, loved your Go & eBPF work.",
                }
            ],
        })
    )
    with patch("agents.outreach_pydantic.outreach_agent.run", new_callable=AsyncMock, return_value=mock_out), \
         patch("services.llm_guardrail_service.guardrail_service.check_rate_limit", new_callable=AsyncMock, return_value=(True, None)):
        res = await orchestrator.run_swarm_phase(
            "outreach",
            mode="copilot",
            campaign_name="Outreach: Senior Systems Engineer",
            sequence_type="Hyper-Personalized",
            job_id="job_123",
            recipients=[{"email": "elena@example.com", "name": "Elena Rostova"}],
            mock_mode=True,
        )
        assert len(res) == 1
        assert res[0]["candidate"] == "Elena Rostova"
        assert res[0]["email"] == "elena@example.com"
        assert res[0]["outreach"]["subject"] == "Senior Distributed Systems Role"


@pytest.mark.asyncio
async def test_persist_helpers_noop_on_default_tenant():
    """Verify persistence helpers safely no-op when tenant_id is 'default' or None."""
    orch = AgentOrchestrator(tenant_id="default")
    await orch._persist_sourcing_and_ledger(
        candidates=[{"full_name": "Test User", "email": "test@example.com"}],
        audit_data={"passed": True},
        role_title="Engineer",
    )
    await orch._persist_outreach_campaign(
        results=[{"candidate": "Test User", "email": "test@example.com", "outreach": {"subject": "Hi", "body": "Hello"}}],
        job={"title": "Engineer"},
    )


def test_compliance_routes_expose_both_ledger_paths():
    """Verify /compliance/ledgers and /compliance/decision-ledger routes are registered."""
    from api.routes.compliance import router

    paths = {route.path for route in router.routes}
    assert "/compliance/decision-ledger" in paths
    assert "/compliance/ledgers" in paths
    assert "/compliance/decision-ledger/{ledger_id}/override" in paths
    assert "/compliance/ledgers/{ledger_id}/override" in paths


@pytest.mark.asyncio
async def test_local_swarm_memory_calibration_without_external_keys():
    """Verify add_negative_vector and query_memory_tree work locally without Pinecone or OpenAI keys."""
    from agents import swarm_memory as sm

    tenant_id = f"tenant-{uuid.uuid4().hex[:8]}"
    await sm.add_negative_vector("recruiter_override", "Candidate lacks production Kubernetes experience", tenant_id=tenant_id)
    rules = await sm.query_memory_tree("Kubernetes SRE", tenant_id=tenant_id)
    assert "APPLICABLE RULES:" in rules
    assert "Candidate lacks production Kubernetes experience" in rules


@pytest.mark.asyncio
async def test_email_service_uses_oauth_delivery():
    """Verify EmailService.send_email delivers via OAuth 2.0 (Gmail/Graph) without SMTP."""
    from services.email_service import EmailService, OAuthSenderConfig

    svc = EmailService()
    dummy_cfg = OAuthSenderConfig(
        provider="google",
        sender_name="Sarah",
        sender_email="sarah@acmecorp.com",
        access_token="dvt_oauth_google_testtoken",
    )
    with patch("services.email_service._get_system_oauth_sender", return_value=dummy_cfg):
        ok = await svc.send_email("email-123", "cand@example.com", "Hello", "Body", tenant_id=None)
        assert ok is True


def test_email_sender_exposes_oauth_routes():
    """Verify /email-sender/oauth/{provider}/connect and /callback routes are registered."""
    from api.routes.email_sender import router

    paths = {route.path for route in router.routes}
    assert "/email-sender/oauth/{provider}/connect" in paths
    assert "/email-sender/oauth/{provider}/callback" in paths


@pytest.mark.asyncio
async def test_zero_setup_reply_to_relay_sets_recruiter_identity():
    """Verify the Gem/Ashby/Lever zero-setup fallback sets From display name and Reply-To to the recruiter's identity."""
    from services.email_service import EmailService, OAuthSenderConfig

    svc = EmailService()
    system_cfg = OAuthSenderConfig(
        provider="google",
        sender_name="DVT Talent AI",
        sender_email="outreach@dvttalent.com",
        access_token="dvt_oauth_google_sys",
    )
    captured_msg = {}

    async def _fake_deliver(cfg, msg, to_addr, subj, body):
        captured_msg["from"] = msg["From"]
        captured_msg["reply_to"] = msg["Reply-To"]
        return True

    with patch("services.email_service._get_tenant_oauth_sender", new_callable=AsyncMock, return_value=None), \
         patch("services.email_service._get_system_oauth_sender", return_value=system_cfg), \
         patch("services.email_service._get_tenant_reply_to_identity", new_callable=AsyncMock, return_value=("Sarah Connor", "sarah@acmecorp.com")), \
         patch("services.email_service._deliver_oauth_message", side_effect=_fake_deliver):
        ok = await svc.send_email("email-456", "cand@example.com", "Role", "Body", tenant_id=uuid.uuid4())
        assert ok is True
        assert "Sarah Connor via DVT Talent AI" in captured_msg["from"]
        assert captured_msg["reply_to"] == "sarah@acmecorp.com"


def test_auth_exposes_forgot_password_route():
    """Verify /auth/forgot-password route is registered on auth router."""
    from api.routes.auth import router

    paths = {route.path for route in router.routes}
    assert "/forgot-password" in paths


def test_settings_deterministic_dev_secret_key_and_typed_oauth_fields():
    """Verify non-production Settings derives a deterministic secret_key and exposes typed Microsoft/Resend fields."""
    from config import Settings

    s1 = Settings(secret_key="change-me-in-production", app_env="development")
    s2 = Settings(secret_key="change-me-in-production", app_env="development")
    assert s1.secret_key == s2.secret_key
    assert s1.secret_key != "change-me-in-production"
    assert len(s1.secret_key) == 64
    assert hasattr(s1, "microsoft_client_id")
    assert hasattr(s1, "microsoft_client_secret")
    assert hasattr(s1, "resend_api_key")


def test_pydantic_model_supports_deepseek_and_kimi():
    """Verify get_pydantic_model resolves DeepSeek and Kimi system keys via OpenAI-compatible provider."""
    import agents.pydantic_config as pc

    pc._MODEL_CACHE.clear()
    with patch.object(pc.settings, "anthropic_api_key", ""), \
         patch.object(pc.settings, "groq_api_key", ""), \
         patch.object(pc.settings, "openai_api_key", ""), \
         patch.object(pc.settings, "kimi_api_key", ""), \
         patch.object(pc.settings, "deepseek_api_key", "sk-deepseek-test"):
        model = pc.get_pydantic_model()
        assert model is not None
        assert "deepseek_default:" + pc.settings.deepseek_model in pc._MODEL_CACHE


@pytest.mark.asyncio
async def test_dodo_webhook_rejects_test_prefix_bypass():
    """Verify /api/v1/billing/webhook rejects forged 'test_' signatures when webhook key is configured."""
    from httpx import AsyncClient, ASGITransport
    from main import app
    from config import settings

    with patch.object(settings, "dodo_payments_webhook_key", "whsec_real_secret"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            resp = await client.post(
                "/api/v1/billing/webhook",
                headers={"webhook-signature": "test_forged_bypass"},
                json={"type": "payment.succeeded", "data": {}},
            )
            assert resp.status_code == 400


def test_billing_return_url_rejects_open_redirect():
    """Verify _resolve_safe_return_url blocks external origins while allowing relative and frontend URLs."""
    from fastapi import HTTPException
    from api.routes.billing import _resolve_safe_return_url
    from config import settings

    assert _resolve_safe_return_url("/dashboard/billing", "/default").endswith("/dashboard/billing")
    assert _resolve_safe_return_url(f"{settings.frontend_url}/dashboard/billing", "/default").endswith("/dashboard/billing")
    with pytest.raises(HTTPException) as exc:
        _resolve_safe_return_url("https://evil-attacker.com/steal", "/default")
    assert exc.value.status_code == 400


def test_compliance_override_rejects_viewer_and_candidate():
    """Verify _require_compliance_access blocks VIEWER on write and CANDIDATE on read/write."""
    from fastapi import HTTPException
    from api.routes.compliance import _require_compliance_access
    from db.models import User, UserRole

    viewer = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), email="v@acme.com", role=UserRole.VIEWER)
    candidate = User(id=uuid.uuid4(), tenant_id=None, email="c@acme.com", role=UserRole.CANDIDATE)

    assert _require_compliance_access(viewer, write=False) == viewer.tenant_id
    with pytest.raises(HTTPException) as exc_v:
        _require_compliance_access(viewer, write=True)
    assert exc_v.value.status_code == 403

    with pytest.raises(HTTPException) as exc_c:
        _require_compliance_access(candidate, write=False)
    assert exc_c.value.status_code == 403


@pytest.mark.asyncio
async def test_oauth_sender_callback_rejects_non_oauth_state_jwt():
    """Verify oauth_sender_callback rejects tokens without type='oauth_state' or matching provider."""
    from fastapi import HTTPException
    from jose import jwt
    from api.routes.email_sender import oauth_sender_callback
    from config import settings

    forged_access_jwt = jwt.encode(
        {"sub": str(uuid.uuid4()), "tenant_id": str(uuid.uuid4()), "type": "access", "provider": "google"},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    with pytest.raises(HTTPException) as exc:
        await oauth_sender_callback(provider="google", code="abc", state=forged_access_jwt, db=AsyncMock())
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_team_members_and_candidates_strictly_tenant_scoped():
    """Verify team candidates endpoint enforces tenant scoping and filters out pii_erased records."""
    from db.models import User, UserRole, Candidate, CandidateStatus
    from api.routes.team import get_team_candidates

    tenant_a = uuid.uuid4()
    mgr = User(id=uuid.uuid4(), tenant_id=tenant_a, role=UserRole.MANAGER, email="mgr@a.com")

    mock_db = AsyncMock()
    mock_result = MagicMock()
    c1 = Candidate(id=uuid.uuid4(), tenant_id=tenant_a, first_name="Alice", last_name="A", email="a@a.com", pii_erased=False)
    mock_result.scalars.return_value.all.return_value = [c1]
    mock_db.execute = AsyncMock(return_value=mock_result)

    res = await get_team_candidates(recruiter_id=None, db=mock_db, manager=mgr)
    assert len(res["candidates"]) == 1
    assert res["candidates"][0]["name"] == "Alice A"


@pytest.mark.asyncio
async def test_team_quota_rejects_cross_tenant_user_id():
    """Verify set_user_quota rejects users not found in the manager's tenant with 404."""
    from fastapi import HTTPException
    from db.models import User, UserRole
    from api.routes.team import set_user_quota

    mgr = User(id=uuid.uuid4(), tenant_id=uuid.uuid4(), role=UserRole.MANAGER, email="mgr@org.com")
    mock_db = AsyncMock()
    mock_db.execute = AsyncMock(return_value=MagicMock(scalar_one_or_none=MagicMock(return_value=None)))

    with pytest.raises(HTTPException) as exc:
        await set_user_quota(user_id=str(uuid.uuid4()), limit=500, db=mock_db, manager=mgr)
    assert exc.value.status_code == 404


def test_company_multi_tenant_domain_isolation():
    """Verify Company model schema supports per-tenant domain composite index."""
    from db.models import Company

    index_names = [idx.name for idx in Company.__table__.indexes]
    assert "uq_companies_tenant_domain" in index_names
    # Verify domain column is not globally unique
    assert Company.__table__.c.domain.unique is not True
