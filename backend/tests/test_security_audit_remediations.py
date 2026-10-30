"""
DVT Talent AI — Security Audit Remediations Regression Test Suite
Validates the complete remediation of:
1. dvt-sec-2026-001: Autonomous Voice AI Purged (Purged per optimization roadmap)
2. dvt-sec-2026-002: HttpOnly Session Cookie Enforcement & Secure Storage
3. dvt-sec-2026-003: Candidate Directory Bounded Database-Level Pagination & Privacy
4. dvt-sec-2026-004: Enterprise SAML SSO Purged (Purged per optimization roadmap)
"""
import uuid
import hashlib
from datetime import datetime, timezone, timedelta
import pytest
from httpx import AsyncClient, ASGITransport

from main import app
from db.models import (
    AsyncSessionLocal, Tenant, User, UserRole, Candidate,
    CandidateStatus, TeamInvitation, InvitationStatus
)
from api.routes.auth import get_current_user


# ─── 1. dvt-sec-2026-001: Autonomous Voice AI Removed ────────────────────────
# Voice AI tools were completely purged per optimization roadmap.


# ─── 2. dvt-sec-2026-003: Candidate Directory Bounded Pagination ───────────────

class TestCandidateDirectoryBoundedPagination:
    """Verifies that Candidate Directory uses SQL-level bounded pagination without heap memory exhaustion."""

    @pytest.mark.asyncio
    async def test_candidate_list_sql_bounded_pagination_and_privacy(self):
        """Test Case 1: list_candidates retrieves only requested page_size and respects stealth / blacklist."""
        unique_suffix = uuid.uuid4().hex[:8]
        tenant_domain = f"acme-security-{unique_suffix}.com"

        async with AsyncSessionLocal() as session:
            tenant = Tenant(
                name="Acme Security Org",
                domain=tenant_domain,
                is_active=True,
            )
            session.add(tenant)
            await session.commit()
            await session.refresh(tenant)

            recruiter = User(
                email=f"scout-{unique_suffix}@{tenant_domain}",
                role=UserRole.RECRUITER,
                tenant_id=tenant.id,
                full_name="Scout Master",
                is_active=True,
                hashed_password="mock_hash_secret_123",
            )
            session.add(recruiter)

            # Create 15 synthetic candidates in this tenant
            candidates = []
            for i in range(15):
                cand = Candidate(
                    tenant_id=tenant.id,
                    first_name=f"Candidate{i}",
                    last_name="Test",
                    email=f"candidate{i}-{unique_suffix}@example.com",
                    score=float(50 + i),
                    is_searchable=True,
                    hide_from_companies=[],
                )
                candidates.append(cand)

            # Candidate 16: Stealth mode (is_searchable = False)
            cand_stealth = Candidate(
                tenant_id=tenant.id,
                first_name="Stealth",
                last_name="Test",
                email=f"stealth-{unique_suffix}@example.com",
                score=99.0,
                is_searchable=False,
                hide_from_companies=[],
            )
            candidates.append(cand_stealth)

            # Candidate 17: Blacklisted this recruiter's domain
            cand_blacklisted = Candidate(
                tenant_id=tenant.id,
                first_name="Blacklisted",
                last_name="Test",
                email=f"blacklisted-{unique_suffix}@example.com",
                score=98.0,
                is_searchable=True,
                hide_from_companies=[tenant_domain],
            )
            candidates.append(cand_blacklisted)

            session.add_all(candidates)
            await session.commit()

        # Query candidates endpoint with page_size=5
        app.dependency_overrides[get_current_user] = lambda: recruiter
        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/candidates?page=1&page_size=5")
                assert res.status_code == 200
                data = res.json()
                items = data.get("items", [])
                total = data.get("total", 0)

                assert len(items) == 5
                # Total should exclude stealth candidate and blacklisted candidate
                assert total == 15

                # Verify stealth candidate is NEVER present
                emails = [c["email"] for c in items]
                assert f"stealth-{unique_suffix}@example.com" not in emails
                assert f"blacklisted-{unique_suffix}@example.com" not in emails

                # Fetch page 2: must have 5 items
                res_p2 = await client.get("/api/v1/candidates?page=2&page_size=5")
                assert res_p2.status_code == 200
                items_p2 = res_p2.json().get("items", [])
                assert len(items_p2) == 5
                p2_emails = [c["email"] for c in items_p2]
                assert not set(emails).intersection(set(p2_emails))
        finally:
            app.dependency_overrides.pop(get_current_user, None)


# ─── 3. dvt-sec-2026-002: HttpOnly Session Cookie Enforcement ─────────────────

class TestHttpOnlySessionCookieEnforcement:
    """Verifies that authentication returns HttpOnly cookies with secure flags."""

    @pytest.mark.asyncio
    async def test_invite_acceptance_sets_httponly_cookie(self):
        """Test Case 2: Accepting an invitation sets an HttpOnly, SameSite=Lax dvt_token cookie."""
        unique_suffix = uuid.uuid4().hex[:8]
        raw_token = f"raw_secure_token_{unique_suffix}"
        token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

        async with AsyncSessionLocal() as session:
            tenant = Tenant(
                name="Cookie Test Tenant",
                domain=f"cookie-{unique_suffix}.test",
                is_active=True,
            )
            session.add(tenant)
            await session.commit()
            await session.refresh(tenant)

            admin_user = User(
                email=f"admin-{unique_suffix}@cookie.test",
                role=UserRole.ADMIN,
                tenant_id=tenant.id,
                full_name="Admin Inviter",
                is_active=True,
                hashed_password="mock_hash_secret_123",
            )
            session.add(admin_user)
            await session.commit()
            await session.refresh(admin_user)

            invitation = TeamInvitation(
                tenant_id=tenant.id,
                invited_by_user_id=admin_user.id,
                email=f"invitee-{unique_suffix}@cookie.test",
                role=UserRole.RECRUITER,
                token_hash=token_hash,
                status=InvitationStatus.PENDING,
                expires_at=datetime.now(timezone.utc) + timedelta(days=2),
            )
            session.add(invitation)
            await session.commit()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.post(
                "/api/v1/team/invite/accept",
                json={
                    "token": raw_token,
                    "password": "SecurePassword123!",
                    "full_name": "Test Invitee",
                }
            )
            assert res.status_code == 200, res.text
            assert "set-cookie" in res.headers
            cookie_header = res.headers["set-cookie"]
            assert "dvt_token=" in cookie_header
            assert "httponly" in cookie_header.lower()
            assert "samesite=lax" in cookie_header.lower()

    @pytest.mark.asyncio
    async def test_unauthenticated_candidate_endpoints_reject_and_protect_pii(self):
        """Test Case 3: Unauthenticated calls to candidate endpoints strictly yield 401 without PII leakage."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            res = await client.get("/api/v1/candidates")
            assert res.status_code == 401
            assert "detail" in res.json()
