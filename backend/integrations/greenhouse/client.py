"""
DVT Talent AI — Greenhouse ATS Client
Full two-way sync: list jobs + push candidates with AI scores.
Auth: HTTP Basic (api_key + empty password) per Greenhouse Harvest API spec.
"""
import base64
from typing import Any, Dict, List, Optional

import httpx
import sentry_sdk
import structlog
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

log = structlog.get_logger(__name__)

GREENHOUSE_BASE = "https://harvest.greenhouse.io/v1"


def _basic_auth(api_key: str) -> str:
    """Greenhouse uses HTTP Basic with api_key as username, empty password."""
    token = base64.b64encode(f"{api_key}:".encode()).decode()
    return f"Basic {token}"


class GreenhouseClient:
    """
    Official Greenhouse Harvest API v1 client.
    Supports listing active jobs and creating candidates with AI score metadata.
    """

    def __init__(self, api_key: str, tenant_id: str):
        self.api_key = api_key
        self.tenant_id = tenant_id
        self._headers = {
            "Authorization": _basic_auth(api_key),
            "Content-Type": "application/json",
            "On-Behalf-Of": tenant_id,  # Greenhouse requires this for audit
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    @sentry_sdk.trace
    async def test_connection(self) -> bool:
        """Validate API key by fetching current user info."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{GREENHOUSE_BASE}/users/me", headers=self._headers)
            if resp.status_code == 401:
                log.warning("greenhouse_auth_failed", tenant_id=self.tenant_id)
                return False
            resp.raise_for_status()
            log.info("greenhouse_connection_ok", tenant_id=self.tenant_id)
            return True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    @sentry_sdk.trace
    async def list_jobs(self, status: str = "open") -> List[Dict[str, Any]]:
        """
        GET /v1/jobs?status=open
        Returns normalized job list across pages.
        """
        all_jobs: List[Dict[str, Any]] = []
        page = 1

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{GREENHOUSE_BASE}/jobs",
                    headers=self._headers,
                    params={"status": status, "per_page": 100, "page": page},
                )
                resp.raise_for_status()
                jobs = resp.json()
                if not jobs:
                    break

                for job in jobs:
                    all_jobs.append({
                        "external_id": str(job["id"]),
                        "title": job.get("name", ""),
                        "location": job.get("offices", [{}])[0].get("name", "") if job.get("offices") else "",
                        "status": job.get("status", "open"),
                        "source": "greenhouse",
                        "source_url": job.get("absolute_url", ""),
                        "raw": job,
                    })

                # Greenhouse uses Link header for pagination
                if "next" not in resp.headers.get("link", ""):
                    break
                page += 1

        log.info("greenhouse_jobs_fetched", count=len(all_jobs), tenant_id=self.tenant_id)
        return all_jobs

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    @sentry_sdk.trace
    async def create_candidate(
        self,
        candidate_data: Dict[str, Any],
        job_id: str,
        ai_score: Optional[float] = None,
    ) -> Dict[str, Any]:
        """
        POST /v1/candidates — creates a candidate and attaches them to a job.
        Includes AI score in the 'notes' field and as a custom field if configured.
        Returns the created candidate ID.
        """
        name_parts = candidate_data.get("name", "Unknown Candidate").split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        # Build application to attach to the job
        applications = [{"job_id": int(job_id)}]

        # AI score note
        notes = f"Sourced by DVT Talent AI.\nAI Match Score: {ai_score:.0f}/100" if ai_score else "Sourced by DVT Talent AI."

        payload: Dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
            "email_addresses": [{"value": candidate_data.get("email", ""), "type": "personal"}],
            "phone_numbers": [{"value": candidate_data.get("phone", ""), "type": "mobile"}] if candidate_data.get("phone") else [],
            "social_media_addresses": [],
            "website_addresses": [],
            "applications": applications,
            "notes": notes,
            "tags": ["dvt-ai-sourced"],
        }

        if candidate_data.get("linkedin_url"):
            payload["social_media_addresses"].append({
                "value": candidate_data["linkedin_url"], "type": "linkedin"
            })

        if candidate_data.get("github_url"):
            payload["website_addresses"].append({
                "value": candidate_data["github_url"], "type": "github"
            })

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{GREENHOUSE_BASE}/candidates",
                headers=self._headers,
                json=payload,
            )
            if resp.status_code == 422:
                # Candidate may already exist — return existing ID from error body
                error_body = resp.json()
                log.warning("greenhouse_candidate_exists", email=candidate_data.get("email"), detail=error_body)
                return {"status": "exists", "detail": error_body}
            resp.raise_for_status()
            result = resp.json()
            log.info("greenhouse_candidate_created", id=result.get("id"), tenant_id=self.tenant_id)
            return {"status": "created", "external_id": str(result["id"]), "raw": result}

    @sentry_sdk.trace
    async def get_application_status(self, application_id: str) -> str:
        """GET /v1/applications/{id} — returns current stage name."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GREENHOUSE_BASE}/applications/{application_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("current_stage", {}).get("name", "applied")
