"""
DVT Talent AI — Base ATS Integration
Abstract base class for all Applicant Tracking System (ATS) connectors.
Enables 2-way sync with Greenhouse, Lever, Workday, etc.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, List

import httpx


class BaseATS(ABC):
    def __init__(self, api_key: str, base_url: str, tenant_id: str):
        self.api_key = api_key
        self.base_url = base_url
        self.tenant_id = tenant_id

    @abstractmethod
    async def get_jobs(self) -> List[Dict[str, Any]]:
        """Fetch active job postings from the ATS"""
        pass

    @abstractmethod
    async def push_candidate(self, candidate_data: Dict[str, Any], job_id: str) -> bool:
        """Push a sourced/screened candidate back into the ATS pipeline"""
        pass

    @abstractmethod
    async def sync_status(self, candidate_id: str) -> str:
        """Get the current application status from the ATS"""
        pass

class UnifiedATS(BaseATS):
    """
    Implementation using a Unified API (e.g. Merge.dev or Unified.to)
    to support 50+ ATS systems with a single interface.
    """
    async def get_jobs(self) -> List[Dict[str, Any]]:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{self.base_url}/hris/v1/jobs",
                headers={"Authorization": f"Bearer {self.api_key}"}
            )
            resp.raise_for_status()
            return resp.json().get("results", [])

    async def push_candidate(self, candidate_data: Dict[str, Any], job_id: str) -> bool:
        payload = {
            "first_name": candidate_data.get("first_name"),
            "last_name": candidate_data.get("last_name"),
            "email": candidate_data.get("email"),
            "job": job_id,
            "remote_was_sourced": True
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{self.base_url}/hris/v1/candidates",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json=payload
            )
            return resp.status_code in [200, 201]

    async def sync_status(self, candidate_id: str) -> str:
        return "sourced" # Placeholder
