"""
DVT Talent AI — Ceipal ATS Client
Full two-way sync: list open jobs + push candidates with AI scores.
Auth: X-API-Key header per Ceipal REST API spec.
"""
from typing import Any, Dict, List, Optional

import httpx
import sentry_sdk
import structlog
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

log = structlog.get_logger(__name__)


class CeipalClient:
    """
    Ceipal TalentHire REST API client.
    Supports listing open requisitions and creating applicants with AI score metadata.
    """

    def __init__(self, api_key: str, base_url: str, tenant_id: str):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.tenant_id = tenant_id
        self._headers = {
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    @sentry_sdk.trace
    async def test_connection(self) -> bool:
        """Validate API key by calling a lightweight info endpoint."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{self.base_url}/users/me", headers=self._headers)
            if resp.status_code in [401, 403]:
                log.warning("ceipal_auth_failed", tenant_id=self.tenant_id, status=resp.status_code)
                return False
            # Some Ceipal versions return 404 for /me but 200 for /jobs
            if resp.status_code == 404:
                # Fall back to a jobs listing call
                resp2 = await client.get(
                    f"{self.base_url}/jobs", headers=self._headers, params={"status": "open", "limit": 1}
                )
                if resp2.status_code in [401, 403]:
                    return False
            log.info("ceipal_connection_ok", tenant_id=self.tenant_id)
            return True

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=15),
        retry=retry_if_exception_type(httpx.TransportError),
    )
    @sentry_sdk.trace
    async def list_jobs(self, status: str = "open") -> List[Dict[str, Any]]:
        """
        GET {base_url}/jobs?status=open
        Returns normalized job list with cursor-based pagination.
        """
        all_jobs: List[Dict[str, Any]] = []
        offset = 0
        limit = 100

        async with httpx.AsyncClient(timeout=30) as client:
            while True:
                resp = await client.get(
                    f"{self.base_url}/jobs",
                    headers=self._headers,
                    params={"status": status, "limit": limit, "offset": offset},
                )
                resp.raise_for_status()
                data = resp.json()

                # Ceipal wraps results in 'data' or returns an array directly
                jobs = data.get("data", data) if isinstance(data, dict) else data
                if not jobs:
                    break

                for job in jobs:
                    all_jobs.append({
                        "external_id": str(job.get("id", job.get("job_id", ""))),
                        "title": job.get("title", job.get("job_title", "")),
                        "location": job.get("location", job.get("city", "")),
                        "status": job.get("status", "open"),
                        "source": "ceipal",
                        "source_url": job.get("job_url", ""),
                        "skills_required": job.get("skills", []),
                        "raw": job,
                    })

                if len(jobs) < limit:
                    break
                offset += limit

        log.info("ceipal_jobs_fetched", count=len(all_jobs), tenant_id=self.tenant_id)
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
        POST {base_url}/applicants — creates an applicant and links them to a job.
        AI score is embedded in metadata for recruiter visibility.
        """
        name_parts = candidate_data.get("name", "Unknown").split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        payload: Dict[str, Any] = {
            "first_name": first_name,
            "last_name": last_name,
            "email": candidate_data.get("email", ""),
            "phone": candidate_data.get("phone", ""),
            "job_id": job_id,
            "source": "DVT Talent AI (Autonomous Sourcing)",
            "resume_url": candidate_data.get("resume_url", ""),
            "linkedin_url": candidate_data.get("linkedin_url", ""),
            "github_url": candidate_data.get("github_url", ""),
            "metadata": {
                "dvt_ai_score": ai_score,
                "dvt_sourced": True,
                "dvt_source_channel": candidate_data.get("source", "web_search"),
            },
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{self.base_url}/applicants",
                headers=self._headers,
                json=payload,
            )
            if resp.status_code == 409:
                log.warning("ceipal_candidate_duplicate", email=candidate_data.get("email"))
                return {"status": "exists"}
            resp.raise_for_status()
            result = resp.json()
            ext_id = str(result.get("id", result.get("applicant_id", "")))
            log.info("ceipal_candidate_created", id=ext_id, tenant_id=self.tenant_id)
            return {"status": "created", "external_id": ext_id, "raw": result}

    @sentry_sdk.trace
    async def get_application_status(self, applicant_id: str) -> str:
        """GET {base_url}/applicants/{id} — returns current stage."""
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self.base_url}/applicants/{applicant_id}",
                headers=self._headers,
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("status", data.get("stage", "applied"))
