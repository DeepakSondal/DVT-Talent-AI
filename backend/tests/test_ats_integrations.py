"""
DVT Talent AI — ATS Integration Test Suite
Unit tests for Greenhouse and Ceipal clients with mock HTTP responses.
"""
import pytest
import json
import base64
from unittest.mock import AsyncMock, patch, MagicMock
import httpx
from pytest_httpx import HTTPXMock


# ── Greenhouse Tests ──────────────────────────────────────────────────────────

class TestGreenhouseClient:

    def _make_client(self):
        from integrations.greenhouse.client import GreenhouseClient
        return GreenhouseClient(api_key="test_gh_key_123", tenant_id="tenant-uuid-001")

    def test_basic_auth_header(self):
        """Greenhouse auth header must be Basic base64(api_key:)"""
        from integrations.greenhouse.client import _basic_auth
        result = _basic_auth("my_key")
        expected_token = base64.b64encode(b"my_key:").decode()
        assert result == f"Basic {expected_token}"

    @pytest.mark.asyncio
    async def test_list_jobs_success(self, httpx_mock: HTTPXMock):
        """list_jobs() returns normalized jobs from Greenhouse API."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/jobs?status=open&per_page=100&page=1",
            json=[
                {
                    "id": 12345,
                    "name": "Senior Python Engineer",
                    "status": "open",
                    "offices": [{"name": "London"}],
                    "absolute_url": "https://boards.greenhouse.io/dvt/jobs/12345",
                }
            ],
            headers={},  # No 'next' link → single page
        )

        client = self._make_client()
        jobs = await client.list_jobs()

        assert len(jobs) == 1
        assert jobs[0]["external_id"] == "12345"
        assert jobs[0]["title"] == "Senior Python Engineer"
        assert jobs[0]["source"] == "greenhouse"
        assert jobs[0]["location"] == "London"

    @pytest.mark.asyncio
    async def test_list_jobs_empty(self, httpx_mock: HTTPXMock):
        """list_jobs() handles empty API response gracefully."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/jobs?status=open&per_page=100&page=1",
            json=[],
        )
        client = self._make_client()
        jobs = await client.list_jobs()
        assert jobs == []

    @pytest.mark.asyncio
    async def test_create_candidate_success(self, httpx_mock: HTTPXMock):
        """create_candidate() posts correct payload and returns external_id."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/candidates",
            method="POST",
            json={"id": 99001, "first_name": "Jane", "last_name": "Doe"},
            status_code=201,
        )

        client = self._make_client()
        result = await client.create_candidate(
            candidate_data={
                "name": "Jane Doe",
                "email": "jane@example.com",
                "linkedin_url": "https://linkedin.com/in/janedoe",
            },
            job_id="12345",
            ai_score=87.5,
        )

        assert result["status"] == "created"
        assert result["external_id"] == "99001"

    @pytest.mark.asyncio
    async def test_create_candidate_duplicate(self, httpx_mock: HTTPXMock):
        """create_candidate() handles 422 duplicate gracefully."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/candidates",
            method="POST",
            json={"errors": [{"message": "Email already exists"}]},
            status_code=422,
        )

        client = self._make_client()
        result = await client.create_candidate(
            candidate_data={"name": "Jane Doe", "email": "jane@example.com"},
            job_id="12345",
        )
        assert result["status"] == "exists"

    @pytest.mark.asyncio
    async def test_connection_test_invalid_key(self, httpx_mock: HTTPXMock):
        """test_connection() returns False on 401."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/users/me",
            status_code=401,
        )
        client = self._make_client()
        assert await client.test_connection() is False

    @pytest.mark.asyncio
    async def test_connection_test_valid(self, httpx_mock: HTTPXMock):
        """test_connection() returns True on 200."""
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/users/me",
            json={"id": 1, "name": "Admin"},
            status_code=200,
        )
        client = self._make_client()
        assert await client.test_connection() is True


# ── Ceipal Tests ──────────────────────────────────────────────────────────────

class TestCeipalClient:

    def _make_client(self):
        from integrations.ceipal.client import CeipalClient
        return CeipalClient(
            api_key="test_ceipal_key_456",
            base_url="https://api.ceipal.com/v1",
            tenant_id="tenant-uuid-002"
        )

    @pytest.mark.asyncio
    async def test_list_jobs_success(self, httpx_mock: HTTPXMock):
        """list_jobs() returns normalized jobs from Ceipal API."""
        httpx_mock.add_response(
            url="https://api.ceipal.com/v1/jobs?status=open&limit=100&offset=0",
            json={
                "data": [
                    {
                        "id": "JOB-001",
                        "title": "Full Stack Developer",
                        "location": "New York",
                        "status": "open",
                        "job_url": "https://app.ceipal.com/jobs/JOB-001",
                    }
                ]
            }
        )

        client = self._make_client()
        jobs = await client.list_jobs()

        assert len(jobs) == 1
        assert jobs[0]["external_id"] == "JOB-001"
        assert jobs[0]["title"] == "Full Stack Developer"
        assert jobs[0]["source"] == "ceipal"

    @pytest.mark.asyncio
    async def test_create_candidate_success(self, httpx_mock: HTTPXMock):
        """create_candidate() posts correct payload with AI score in metadata."""
        httpx_mock.add_response(
            url="https://api.ceipal.com/v1/applicants",
            method="POST",
            json={"id": "APP-555", "status": "active"},
            status_code=201,
        )

        client = self._make_client()
        result = await client.create_candidate(
            candidate_data={
                "name": "John Smith",
                "email": "john@example.com",
                "linkedin_url": "https://linkedin.com/in/john",
            },
            job_id="JOB-001",
            ai_score=92.3,
        )

        assert result["status"] == "created"
        assert result["external_id"] == "APP-555"

    @pytest.mark.asyncio
    async def test_create_candidate_duplicate(self, httpx_mock: HTTPXMock):
        """create_candidate() handles 409 conflict gracefully."""
        httpx_mock.add_response(
            url="https://api.ceipal.com/v1/applicants",
            method="POST",
            json={"error": "Applicant already exists"},
            status_code=409,
        )

        client = self._make_client()
        result = await client.create_candidate(
            candidate_data={"name": "John Smith", "email": "john@example.com"},
            job_id="JOB-001",
        )
        assert result["status"] == "exists"

    @pytest.mark.asyncio
    async def test_connection_invalid_key(self, httpx_mock: HTTPXMock):
        """test_connection() returns False on 401."""
        httpx_mock.add_response(url="https://api.ceipal.com/v1/users/me", status_code=401)
        client = self._make_client()
        assert await client.test_connection() is False


# ── Integration Tests (Live or Automated Sandbox Fallback) ────────────────────

@pytest.mark.integration
async def test_greenhouse_live_or_sandbox_jobs(httpx_mock: HTTPXMock):
    """Calls the Greenhouse integration and verifies normalized job shape (live API or automated sandbox)."""
    import os
    from integrations.greenhouse.client import GreenhouseClient
    key = os.getenv("GREENHOUSE_API_KEY")
    if not key:
        key = "sandbox_test_gh_key"
        httpx_mock.add_response(
            url="https://harvest.greenhouse.io/v1/jobs?status=open&per_page=100&page=1",
            json=[
                {
                    "id": 888123,
                    "name": "Principal AI Architect",
                    "status": "open",
                    "offices": [{"name": "San Francisco"}],
                    "absolute_url": "https://boards.greenhouse.io/dvt/jobs/888123",
                }
            ],
            headers={},
        )
    client = GreenhouseClient(api_key=key, tenant_id="test")
    jobs = await client.list_jobs()
    assert isinstance(jobs, list)
    assert len(jobs) >= 1
    for job in jobs:
        assert "external_id" in job
        assert "title" in job


@pytest.mark.integration
async def test_ceipal_live_or_sandbox_jobs(httpx_mock: HTTPXMock):
    """Calls the Ceipal integration and verifies normalized job shape (live API or automated sandbox)."""
    import os
    from integrations.ceipal.client import CeipalClient
    key = os.getenv("CEIPAL_API_KEY")
    base_url = os.getenv("CEIPAL_API_BASE_URL", "https://api.ceipal.com/v1").rstrip("/")
    if not key:
        key = "sandbox_test_ceipal_key"
        httpx_mock.add_response(
            url=f"{base_url}/jobs?status=open&limit=100&offset=0",
            json={
                "data": [
                    {
                        "id": "CEI-999",
                        "title": "Lead Platform Engineer",
                        "status": "open",
                        "city": "Austin",
                    }
                ]
            },
        )
    client = CeipalClient(
        api_key=key,
        base_url=base_url,
        tenant_id="test"
    )
    jobs = await client.list_jobs()
    assert isinstance(jobs, list)
    assert len(jobs) >= 1
    for job in jobs:
        assert "external_id" in job
        assert "title" in job
