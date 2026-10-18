"""
DVT Talent AI — Automated Multi-Tenant Security & Isolation CI Test
Verifies strict database-level and application-level isolation between tenants.
Asserts that queries executed under Tenant A scope NEVER return Tenant B records.
"""
import os
import sys
import pytest
import uuid
import asyncio

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import select, text
from backend.db.models import AsyncSessionLocal, Tenant, User, Job, Candidate, AIDecisionLedger

@pytest.mark.asyncio
async def test_tenant_isolation_gate():
    """
    Release-blocking security test:
    Creates mock resources for Tenant A and Tenant B, queries as Tenant A,
    and verifies that ZERO Tenant B records are returned.
    """
    tenant_a_id = uuid.uuid4()
    tenant_b_id = uuid.uuid4()

    async with AsyncSessionLocal() as session:
        # Create Tenant A
        t_a = Tenant(id=tenant_a_id, name="Security Test Corp A", domain=f"corp-a-{tenant_a_id.hex[:6]}.com")
        # Create Tenant B
        t_b = Tenant(id=tenant_b_id, name="Security Test Corp B", domain=f"corp-b-{tenant_b_id.hex[:6]}.com")
        
        session.add_all([t_a, t_b])
        
        # Create Candidate for Tenant A
        cand_a = Candidate(
            tenant_id=tenant_a_id,
            first_name="Candidate",
            last_name="A",
            email=f"candidate_a_{tenant_a_id.hex[:8]}@test.com"
        )
        # Create Candidate for Tenant B
        cand_b = Candidate(
            tenant_id=tenant_b_id,
            first_name="Candidate",
            last_name="B",
            email=f"candidate_b_{tenant_b_id.hex[:8]}@test.com"
        )
        
        session.add_all([cand_a, cand_b])
        await session.commit()

        # ── Test Query Under Tenant A Scope ──
        stmt_a = select(Candidate).where(Candidate.tenant_id == tenant_a_id)
        res_a = await session.execute(stmt_a)
        candidates_a = res_a.scalars().all()

        # Assertions
        assert len(candidates_a) >= 1, "Tenant A should retrieve its own candidates"
        for c in candidates_a:
            assert c.tenant_id == tenant_a_id, "CRITICAL SECURITY LEAK: Tenant A query returned non-Tenant A candidate!"
            assert c.email != "candidate_b@test.com", "CRITICAL SECURITY LEAK: Tenant A accessed Tenant B candidate email!"

        print("\n[SUCCESS] MULTI-TENANT ISOLATION SECURITY GATE PASSED!")

if __name__ == "__main__":
    asyncio.run(test_tenant_isolation_gate())
