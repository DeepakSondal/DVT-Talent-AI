"""
Unit tests for Sourcing Agent upgrades:
1. Pure-Python PDF dossier generation & pypdf round-trip readability.
2. Monster.com / Dice.com source selection in prefetch_all_sourcing_signals.
3. GitHub profile enrichment in _query_github_talent.
4. Unified Monster & Dice inbound webhook resume attachment.
"""
import io
import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pypdf
import pytest

from agents.pydantic_config import AgentDeps
from agents.sourcing_pydantic import _query_github_talent, prefetch_all_sourcing_signals
from services.resume_parser import ResumeParserService


def test_generate_candidate_pdf_dossier_is_valid_pdf():
    """Test 1: Generated PDF dossier is valid PDF 1.4 and readable by pypdf."""
    pdf_bytes, raw_text = ResumeParserService.generate_candidate_pdf_dossier(
        {
            "full_name": "Priya Sharma",
            "title": "Senior Backend Engineer",
            "location": "Remote",
            "email": "priya@example.org",
            "skills": ["Python", "FastAPI", "PostgreSQL"],
            "experience_years": 7,
            "github_url": "https://github.com/priyasharma",
            "source_platform": "GitHub",
            "ai_reasoning": {"alignment": "Strong distributed Python systems background."},
        },
        role_title="Backend Engineer",
    )

    assert pdf_bytes.startswith(b"%PDF-1.4")
    assert "Priya Sharma" in raw_text
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    assert len(reader.pages) == 1
    extracted = reader.pages[0].extract_text() or ""
    assert "Priya Sharma" in extracted
    assert "Python, FastAPI, PostgreSQL" in extracted


@pytest.mark.asyncio
async def test_prefetch_supports_monster_or_dice_selection():
    """Test 2: Selecting monster or dice targets only the requested board channel."""
    mock_client = AsyncMock()
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = json.dumps([{"name": "Board Candidate", "skills": ["Python"]}])
    mock_client.get.return_value = mock_resp

    deps = AgentDeps(
        http_client=mock_client,
        tenant_id=str(uuid.uuid4()),
        monster_api_key="m_key",
        dice_api_key="d_key",
    )

    with (
        patch("agents.sourcing_pydantic.settings.monster_api_url", "https://api.monster.example/search"),
        patch("agents.sourcing_pydantic.settings.dice_api_url", "https://api.dice.example/search"),
    ):
        monster_only = await prefetch_all_sourcing_signals(deps, "Python Developer", sources=["monster"])
        assert "[PREFETCHED_MONSTER_SIGNALS]:" in monster_only
        assert "[PREFETCHED_DICE_SIGNALS]:" not in monster_only

        dice_only = await prefetch_all_sourcing_signals(deps, "Python Developer", sources=["dice"])
        assert "[PREFETCHED_DICE_SIGNALS]:" in dice_only
        assert "[PREFETCHED_MONSTER_SIGNALS]:" not in dice_only


@pytest.mark.asyncio
async def test_query_github_talent_enriches_top_profiles():
    """Test 3: _query_github_talent enriches search results with /users/{login} profile metadata."""
    search_resp = MagicMock()
    search_resp.status_code = 200
    search_resp.json.return_value = {
        "items": [{"login": "octodev", "html_url": "https://github.com/octodev"}]
    }
    profile_resp = MagicMock()
    profile_resp.status_code = 200
    profile_resp.json.return_value = {
        "name": "Octo Dev",
        "bio": "FastAPI maintainer",
        "company": "OpenCorp",
        "location": "Berlin",
        "email": None,
        "blog": "https://octo.dev",
        "public_repos": 42,
        "followers": 300,
        "html_url": "https://github.com/octodev",
    }

    mock_client = AsyncMock()
    mock_client.get.side_effect = [search_resp, profile_resp]
    deps = AgentDeps(http_client=mock_client, tenant_id=str(uuid.uuid4()), github_token="gh_tok")

    out = await _query_github_talent(deps, "Python FastAPI")
    parsed = json.loads(out)
    assert parsed[0]["name"] == "Octo Dev"
    assert parsed[0]["bio"] == "FastAPI maintainer"
    assert parsed[0]["company"] == "OpenCorp"


@pytest.mark.asyncio
async def test_monster_and_dice_webhooks_share_intake_and_attach_resume(tmp_path, monkeypatch):
    """Test 4: Both Monster and Dice webhooks create a Candidate + Resume via shared handler."""
    from fastapi import Request

    from api.routes.webhooks import dice_application_webhook, monster_application_webhook
    from config import settings

    monkeypatch.setattr(settings, "monster_webhook_secret", "")
    monkeypatch.setattr(settings, "dice_webhook_secret", "")
    monkeypatch.setattr(ResumeParserService, "ensure_upload_dir", classmethod(lambda cls: tmp_path))

    for idx, (fn, board) in enumerate([(monster_application_webhook, "monster"), (dice_application_webhook, "dice")]):
        payload = json.dumps(
            {
                "jobId": "ext-123",
                "applicant": {
                    "email": f"applicant{idx}@{board}.example.com",
                    "firstName": "Sam",
                    "lastName": "Lee",
                    "jobTitle": "Backend Engineer",
                    "resumeText": "7 years Python and PostgreSQL experience.",
                },
            }
        ).encode("utf-8")

        async def _receive(body=payload):
            return {"type": "http.request", "body": body, "more_body": False}

        scope = {
            "type": "http",
            "method": "POST",
            "path": f"/api/v1/webhooks/{board}/applications",
            "headers": [(b"content-type", b"application/json")],
            "client": ("127.0.0.1", 12345),
        }
        req = Request(scope, _receive)

        fake_result_cand = MagicMock()
        fake_result_cand.scalars.return_value.first.return_value = None
        fake_result_resume = MagicMock()
        fake_result_resume.scalar_one_or_none.return_value = None

        fake_db = AsyncMock()
        fake_db.execute.side_effect = [fake_result_cand, fake_result_resume]
        fake_db.add = MagicMock()

        with patch("api.routes.webhooks.enforce_endpoint_rate_limit", new=AsyncMock()):
            res = await fn(req, db=fake_db)

        assert res["status"] == "success"
        assert res["source"] == board
        assert fake_db.add.call_count == 2  # Candidate + Resume
