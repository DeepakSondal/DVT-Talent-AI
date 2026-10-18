"""
DVT Talent AI — Unified ATS & Hub Integrations Unit Tests
"""
import pytest
from integrations.unified_ats import SUPPORTED_PROVIDERS, sync_jobs, export_candidate

@pytest.mark.asyncio
async def test_unified_ats_supported_providers():
    """Verify supported ATS providers"""
    assert "greenhouse" in SUPPORTED_PROVIDERS
    assert "ceipal" in SUPPORTED_PROVIDERS
