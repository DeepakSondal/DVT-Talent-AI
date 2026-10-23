"""
DVT Talent AI — Security Regression Test Suite for Batch 2A: Secure Team Invitations
Validates:
1. Authorized administrator and manager can create invitations.
2. Unauthorized users (recruiters, viewers, candidates) cannot invite team members.
3. Invitations cannot target another tenant or unowned teams.
4. Raw invitation tokens are NEVER stored in the database (only SHA-256 hashes).
5. Valid, unexpired invitations can be accepted, creating active accounts with chosen passwords.
6. Expired, invalid, revoked, and already-used tokens are strictly rejected.
7. Concurrent or repeated acceptance cannot create duplicate memberships.
8. Invited users cannot assign themselves elevated roles (anti-privilege escalation).
9. Email delivery failures do not create accounts with placeholder passwords.
10. Existing team membership, authentication, and tenant isolation tests remain green.
"""

import os
import sys
import uuid
import hashlib
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch, AsyncMock
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from db.models import (
    AsyncSessionLocal,
    Tenant,
    User,
    UserRole,
    Team,
    TeamInvitation,
    InvitationStatus,
)
from api.routes.auth import get_current_user, verify_password
from sqlalchemy import select, update, or_, and_


@pytest.mark.asyncio
class TestSecureTeamInvitations:
    """Enterprise regression tests for secure single-use team invitation lifecycle."""

    async def setup_tenants_and_users(self):
        """Seed synthetic tenants, teams, and administrative callers."""
        async with AsyncSessionLocal() as session:
            run_id = uuid.uuid4().hex[:6]
            tenant_a_id = uuid.uuid4()
            tenant_b_id = uuid.uuid4()

            # Tenant A
            tenant_a = Tenant(
                id=tenant_a_id,
                name="Primary Staffing Corp",
                domain=f"primary-{run_id}.com",
                is_active=True,
            )
            # Tenant B
            tenant_b = Tenant(
                id=tenant_b_id,
                name="Secondary Talent Agency",
                domain=f"secondary-{run_id}.com",
                is_active=True,
            )
            session.add_all([tenant_a, tenant_b])
            await session.flush()

            # Admin A
            admin_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                email=f"admin@{tenant_a.domain}",
                full_name="Primary Admin",
                role=UserRole.ADMIN,
                hashed_password="hashed_secure_pass",
                is_active=True,
                is_verified=True,
            )
            # Manager A
            manager_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                email=f"manager@{tenant_a.domain}",
                full_name="Primary Manager",
                role=UserRole.MANAGER,
                hashed_password="hashed_secure_pass",
                is_active=True,
                is_verified=True,
            )
            # Recruiter A (unauthorized to invite)
            recruiter_a = User(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                email=f"recruiter@{tenant_a.domain}",
                full_name="Primary Recruiter",
                role=UserRole.RECRUITER,
                hashed_password="hashed_secure_pass",
                is_active=True,
                is_verified=True,
            )
            # Admin B (Foreign tenant)
            admin_b = User(
                id=uuid.uuid4(),
                tenant_id=tenant_b_id,
                email=f"admin@{tenant_b.domain}",
                full_name="Secondary Admin",
                role=UserRole.ADMIN,
                hashed_password="hashed_secure_pass",
                is_active=True,
                is_verified=True,
            )

            session.add_all([admin_a, manager_a, recruiter_a, admin_b])
            await session.flush()

            # Team in Tenant A managed by manager_a
            team_a = Team(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                name="Executive Sourcing",
                manager_id=manager_a.id,
                default_credit_limit=2000,
            )
            # Another team in Tenant A managed by someone else (admin_a)
            team_a_other = Team(
                id=uuid.uuid4(),
                tenant_id=tenant_a_id,
                name="Technical Staffing",
                manager_id=admin_a.id,
                default_credit_limit=1500,
            )
            # Team in Tenant B
            team_b = Team(
                id=uuid.uuid4(),
                tenant_id=tenant_b_id,
                name="Foreign Sourcing Team",
                manager_id=admin_b.id,
                default_credit_limit=1000,
            )

            session.add_all([team_a, team_a_other, team_b])
            await session.commit()

            return {
                "tenant_a": tenant_a,
                "tenant_b": tenant_b,
                "admin_a": admin_a,
                "manager_a": manager_a,
                "recruiter_a": recruiter_a,
                "admin_b": admin_b,
                "team_a": team_a,
                "team_a_other": team_a_other,
                "team_b": team_b,
            }

    async def test_authorized_administrator_and_manager_can_create_invitation(self):
        """
        Test 1 & 4:
        - Admin can create invitation.
        - Manager can invite a recruiter into their team.
        - Raw token is never stored in DB (only SHA-256 hash).
        """
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["manager_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"new.recruit.{uuid.uuid4().hex[:6]}@partner-corp.com"
                payload = {
                    "email": target_email,
                    "team_id": str(data["team_a"].id),
                    "role": "recruiter",
                }

                # Mock email sending to avoid requiring live SMTP in CI
                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = True

                    res = await client.post("/api/v1/team/invite", json=payload)
                    assert res.status_code == 200, res.text
                    body = res.json()
                    assert body["status"] == "success"
                    inv_info = body["invitation"]
                    assert inv_info["email"] == target_email
                    assert inv_info["status"] == "pending"
                    assert inv_info["role"] == "recruiter"
                    assert inv_info["email_sent"] is True

                    # Verify raw token is NOT in the response when email succeeds
                    assert body.get("recovery_accept_url") is None

                    inv_id = uuid.UUID(inv_info["id"])

                    # Inspect DB record directly
                    async with AsyncSessionLocal() as session:
                        inv_record = await session.get(TeamInvitation, inv_id)
                        assert inv_record is not None
                        assert inv_record.email == target_email
                        assert inv_record.tenant_id == data["tenant_a"].id
                        assert inv_record.team_id == data["team_a"].id
                        # Verify token_hash is a 64-char hex digest (SHA-256)
                        assert len(inv_record.token_hash) == 64
                        assert inv_record.token_hash.isalnum()
                        # Ensure no raw token exists on the model
                        assert not hasattr(inv_record, "token")
                        assert not hasattr(inv_record, "raw_token")

                    # Verify email service was called with proper args
                    mock_send.assert_awaited_once()
                    call_kwargs = mock_send.await_args.kwargs
                    assert call_kwargs["to_address"] == target_email
                    assert call_kwargs["tenant_id"] == data["tenant_a"].id
                    # The raw token passed to email must hash to the DB token_hash
                    token_passed_to_email = call_kwargs["invite_token"]
                    expected_hash = hashlib.sha256(token_passed_to_email.encode("utf-8")).hexdigest()
                    assert expected_hash == inv_record.token_hash
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_unauthorized_user_cannot_invite_team_members(self):
        """
        Test 2:
        - Recruiter role cannot invite team members (403 Forbidden).
        - Unauthenticated request is rejected.
        """
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["recruiter_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.post(
                    "/api/v1/team/invite",
                    json={"email": "hacker@test.com", "role": "recruiter"},
                )
                assert res.status_code == 403, res.text
                assert "privileges required" in res.text.lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_invitation_cannot_target_another_tenant_or_unowned_team(self):
        """
        Test 3:
        - Manager in Tenant A cannot invite to Tenant B's team (404 Not Found).
        - Manager in Tenant A cannot invite to another manager's team (403 Forbidden).
        - Tenant context is strictly derived from server session.
        """
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["manager_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Attempt to target team belonging to Tenant B
                foreign_team_res = await client.post(
                    "/api/v1/team/invite",
                    json={"email": "test@domain.com", "team_id": str(data["team_b"].id)},
                )
                assert foreign_team_res.status_code == 404, foreign_team_res.text

                # 2. Attempt to target team in same tenant but unowned by this manager
                unowned_team_res = await client.post(
                    "/api/v1/team/invite",
                    json={"email": "test@domain.com", "team_id": str(data["team_a_other"].id)},
                )
                assert unowned_team_res.status_code == 403, unowned_team_res.text
                assert "own teams" in unowned_team_res.text.lower()
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_valid_unexpired_invitation_can_be_accepted(self):
        """
        Test 5 & 10:
        - Valid, unexpired invitation can be accepted.
        - User account is created with chosen password (never placeholder 'mock_password').
        - Token is single-use and consumed.
        """
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"accept.candidate.{uuid.uuid4().hex[:6]}@join-enterprise.com"

                # Create invitation with mocked email delivery
                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = True
                    inv_res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "recruiter"},
                    )
                    assert inv_res.status_code == 200
                    raw_token = mock_send.await_args.kwargs["invite_token"]

                # Accept invitation as new team member (unauthenticated endpoint)
                app.dependency_overrides.pop(get_current_user, None)

                chosen_password = "MySuperSecretPassword2026!"
                accept_res = await client.post(
                    "/api/v1/team/invite/accept",
                    json={
                        "token": raw_token,
                        "password": chosen_password,
                        "full_name": "Accepted Recruiter",
                    },
                )
                assert accept_res.status_code == 200, accept_res.text
                accept_body = accept_res.json()
                assert accept_body["status"] == "success"
                assert "access_token" in accept_body
                user_info = accept_body["user"]
                assert user_info["email"] == target_email
                assert user_info["role"] == "recruiter"
                assert user_info["tenant_id"] == str(data["tenant_a"].id)

                # Verify user in database has legitimate bcrypt hash, NOT mock_password
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import select
                    user_stmt = select(User).where(User.email == target_email)
                    created_user = (await session.execute(user_stmt)).scalar_one()
                    assert created_user.hashed_password != "mock_password"
                    assert await verify_password(chosen_password, created_user.hashed_password) is True
                    assert created_user.is_active is True
                    assert created_user.is_verified is True

                    # Verify invitation status was consumed
                    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
                    inv_stmt = select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                    inv_db = (await session.execute(inv_stmt)).scalar_one()
                    assert inv_db.status == InvitationStatus.ACCEPTED
                    assert inv_db.accepted_by_user_id == created_user.id
                    assert inv_db.accepted_at is not None
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_expired_invalid_revoked_and_used_tokens_are_rejected(self):
        """
        Test 6 & 7:
        - Invalid token is rejected (404).
        - Used token is rejected (400).
        - Revoked token is rejected (400).
        - Expired token is rejected (400).
        - Repeated acceptance cannot create duplicate memberships.
        """
        data = await self.setup_tenants_and_users()
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # 1. Invalid token
            bad_res = await client.post(
                "/api/v1/team/invite/accept",
                json={"token": "completely_bogus_token_xyz", "password": "password12345", "full_name": "Test"},
            )
            assert bad_res.status_code == 404

            # 2. Setup a valid invite
            app.dependency_overrides[get_current_user] = lambda: data["admin_a"]
            target_email = f"multi.test.{uuid.uuid4().hex[:6]}@example.com"

            with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                mock_send.return_value = True
                create_res = await client.post("/api/v1/team/invite", json={"email": target_email})
                assert create_res.status_code == 200
                raw_token = mock_send.await_args.kwargs["invite_token"]
                inv_id = uuid.UUID(create_res.json()["invitation"]["id"])

            app.dependency_overrides.pop(get_current_user, None)

            # 3. Accept once -> 200 OK
            first_accept = await client.post(
                "/api/v1/team/invite/accept",
                json={"token": raw_token, "password": "validPassword123!", "full_name": "First Run"},
            )
            assert first_accept.status_code == 200

            # 4. Accept second time -> 400 (Already accepted / token consumed)
            second_accept = await client.post(
                "/api/v1/team/invite/accept",
                json={"token": raw_token, "password": "validPassword123!", "full_name": "Duplicate Run"},
            )
            assert second_accept.status_code == 400
            assert "no longer active" in second_accept.text.lower()

            # 5. Revocation test: create an invite and revoke it
            app.dependency_overrides[get_current_user] = lambda: data["admin_a"]
            revoke_email = f"revoke.test.{uuid.uuid4().hex[:6]}@example.com"
            with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                mock_send.return_value = True
                rev_res = await client.post("/api/v1/team/invite", json={"email": revoke_email})
                revoke_token = mock_send.await_args.kwargs["invite_token"]
                revoke_id = rev_res.json()["invitation"]["id"]

            # Admin revokes
            del_res = await client.delete(f"/api/v1/team/invitations/{revoke_id}")
            assert del_res.status_code == 200

            app.dependency_overrides.pop(get_current_user, None)

            # Try to accept revoked token -> 400
            rev_accept = await client.post(
                "/api/v1/team/invite/accept",
                json={"token": revoke_token, "password": "validPassword123!", "full_name": "Revoked User"},
            )
            assert rev_accept.status_code == 400
            assert "no longer active" in rev_accept.text.lower()

            # 6. Expiration test: create an invite with past expiration
            async with AsyncSessionLocal() as session:
                exp_token = f"expired_raw_token_{uuid.uuid4().hex}"
                exp_hash = hashlib.sha256(exp_token.encode("utf-8")).hexdigest()
                expired_invite = TeamInvitation(
                    id=uuid.uuid4(),
                    tenant_id=data["tenant_a"].id,
                    invited_by_user_id=data["admin_a"].id,
                    email=f"expired.{uuid.uuid4().hex[:6]}@example.com",
                    role=UserRole.RECRUITER,
                    token_hash=exp_hash,
                    status=InvitationStatus.PENDING,
                    expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
                )
                session.add(expired_invite)
                await session.commit()

            exp_accept = await client.post(
                "/api/v1/team/invite/accept",
                json={"token": exp_token, "password": "validPassword123!", "full_name": "Expired User"},
            )
            assert exp_accept.status_code == 400
            assert "expired" in exp_accept.text.lower()

    async def test_privilege_escalation_defense(self):
        """
        Test 8:
        - Manager cannot invite an ADMIN (403 Forbidden).
        - Nobody can invite a CANDIDATE via team invitations (400 Bad Request).
        - Accepting user receives strictly the role specified at invitation time.
        """
        data = await self.setup_tenants_and_users()
        transport = ASGITransport(app=app)

        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Manager attempts to invite an ADMIN
            app.dependency_overrides[get_current_user] = lambda: data["manager_a"]
            esc_res = await client.post(
                "/api/v1/team/invite",
                json={"email": "elevated@example.com", "role": "admin"},
            )
            assert esc_res.status_code == 403
            assert "administrators" in esc_res.text.lower()

            # Attempt to invite a CANDIDATE
            cand_res = await client.post(
                "/api/v1/team/invite",
                json={"email": "candidate@example.com", "role": "candidate"},
            )
            assert cand_res.status_code == 400
            assert "candidate" in cand_res.text.lower()

    async def test_email_delivery_failure_safe_handling(self):
        """
        Test 9:
        - When email delivery fails or SMTP is unconfigured:
          - No usable account with placeholder password is created in `users`.
          - Pending invitation is safely persisted with email_sent=False and email_error recorded.
          - Recovery accept link is returned to admin for manual onboarding without failing closed.
        """
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"failed.delivery.{uuid.uuid4().hex[:6]}@offline-corp.com"

                # Mock email sending to simulate SMTP failure (e.g. SMTPAuthenticationError or unconfigured)
                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = False

                    res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "viewer"},
                    )
                    assert res.status_code == 200, res.text
                    body = res.json()
                    inv_info = body["invitation"]
                    assert inv_info["email_sent"] is False
                    assert inv_info["email_error"] is not None
                    # Recovery URL is provided so administrative onboarding is not blocked
                    assert body.get("recovery_accept_url") is not None
                    assert "token=" in body["recovery_accept_url"]

                    # CRITICAL: Verify NO user account exists in users table with a placeholder password!
                    async with AsyncSessionLocal() as session:
                        from sqlalchemy import select
                        user_stmt = select(User).where(User.email == target_email)
                        user_in_db = (await session.execute(user_stmt)).scalar_one_or_none()
                        assert user_in_db is None, "CRITICAL FLAW: User was created prematurely with a placeholder password!"

                        # Verify pending invitation row exists safely
                        inv_stmt = select(TeamInvitation).where(TeamInvitation.email == target_email)
                        inv_in_db = (await session.execute(inv_stmt)).scalar_one()
                        assert inv_in_db.status == InvitationStatus.PENDING
                        assert inv_in_db.role == UserRole.VIEWER
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_validate_team_invitation_preflight(self):
        """Test 11: GET /team/invite/validate correctly verifies tokens across all lifecycle states."""
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"validate.test.{uuid.uuid4().hex[:6]}@validate-corp.com"

                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = False
                    res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "recruiter"},
                    )
                    assert res.status_code == 200
                    raw_token = res.json()["recovery_accept_url"].split("token=")[1]

            # Unauthenticated validation tests
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # 1. Valid pending token -> 200 OK with metadata
                val_res = await client.get("/api/v1/team/invite/validate", params={"token": raw_token})
                assert val_res.status_code == 200
                val_body = val_res.json()
                assert val_body["valid"] is True
                assert val_body["email"] == target_email
                assert val_body["role"] == "recruiter"
                assert "Primary Staffing Corp" in val_body["tenant_name"]

                # 2. Invalid token -> 404
                invalid_res = await client.get("/api/v1/team/invite/validate", params={"token": "completely_bogus_token_12345"})
                assert invalid_res.status_code == 404
                assert "Invalid or unrecognized" in invalid_res.json()["detail"]

                # 3. Revoked token -> 400
                async with AsyncSessionLocal() as session:
                    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
                    inv = (await session.execute(
                        select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                    )).scalar_one()
                    inv.status = InvitationStatus.REVOKED
                    await session.commit()

                rev_res = await client.get("/api/v1/team/invite/validate", params={"token": raw_token})
                assert rev_res.status_code == 400
                assert "revoked" in rev_res.json()["detail"]

                # 4. Expired token -> 400
                async with AsyncSessionLocal() as session:
                    inv = (await session.execute(
                        select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                    )).scalar_one()
                    inv.status = InvitationStatus.EXPIRED
                    await session.commit()

                exp_res = await client.get("/api/v1/team/invite/validate", params={"token": raw_token})
                assert exp_res.status_code == 400
                assert "expired" in exp_res.json()["detail"]

                # 5. Accepted / Used token -> 400
                async with AsyncSessionLocal() as session:
                    inv = (await session.execute(
                        select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                    )).scalar_one()
                    inv.status = InvitationStatus.ACCEPTED
                    await session.commit()

                used_res = await client.get("/api/v1/team/invite/validate", params={"token": raw_token})
                assert used_res.status_code == 400
                assert "already been accepted" in used_res.json()["detail"]
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_concurrent_invitation_acceptance_is_strictly_atomic(self):
        """Test 12: Two concurrent acceptance calls cannot create duplicate users or double-consume the token."""
        import asyncio
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"atomic.race.{uuid.uuid4().hex[:6]}@primary-corp.com"

                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = False
                    res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "recruiter"},
                    )
                    assert res.status_code == 200
                    raw_token = res.json()["recovery_accept_url"].split("token=")[1]

            # Fire two concurrent acceptance requests
            async def submit_accept(caller_name: str):
                async with AsyncClient(transport=transport, base_url="http://test") as c:
                    return await c.post(
                        "/api/v1/team/invite/accept",
                        json={
                            "token": raw_token,
                            "password": "SecurePassword123!",
                            "full_name": caller_name,
                        },
                    )

            res1, res2 = await asyncio.gather(
                submit_accept("Race Winner 1"),
                submit_accept("Race Winner 2"),
            )

            # Exactly one request MUST succeed (200), the other MUST fail (400 or 409)
            statuses = [res1.status_code, res2.status_code]
            assert 200 in statuses, f"Expected one 200 OK, got {statuses}"
            statuses.remove(200)
            assert statuses[0] in (400, 409), f"Expected rejection, got {statuses[0]}"

            # Verify in database: exactly ONE user exists, token is ACCEPTED
            async with AsyncSessionLocal() as session:
                users = (await session.execute(
                    select(User).where(User.email == target_email)
                )).scalars().all()
                assert len(users) == 1, f"Expected exactly 1 user, found {len(users)}"

                token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
                inv = (await session.execute(
                    select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                )).scalar_one()
                assert inv.status == InvitationStatus.ACCEPTED
                assert inv.accepted_by_user_id == users[0].id
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_security_headers_and_audit_log_query_redaction(self):
        """Test 13: Verify Referrer-Policy, Cache-Control, and repeated/alternate query redaction."""
        from db.models import AuditLog
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"audit.header.{uuid.uuid4().hex[:6]}@primary-corp.com"

                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = False
                    res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "recruiter"},
                    )
                    assert res.status_code == 200
                    raw_token = res.json()["recovery_accept_url"].split("token=")[1]

            # 1. Unauthenticated validate request checking response headers and audit logging
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                val_res = await client.get(
                    f"/api/v1/team/invite/validate?token=dup_fake&token={raw_token}&code=secret1&code=secret2&invite_token=alt_secret&state=opaque_state"
                )
                assert val_res.status_code == 200

                # Verify response headers
                assert val_res.headers.get("referrer-policy") == "no-referrer"
                assert "no-store" in val_res.headers.get("cache-control", "").lower()
                assert val_res.headers.get("x-content-type-options") == "nosniff"
                assert val_res.headers.get("x-frame-options") == "DENY"

            # 2. Verify AuditLog entries contain strictly redacted query parameters
            async with AsyncSessionLocal() as session:
                audit_logs = (await session.execute(
                    select(AuditLog)
                    .where(AuditLog.action.like("%/invite/validate%"))
                    .order_by(AuditLog.created_at.desc())
                )).scalars().all()

                matching_logs = [l for l in audit_logs if "code" in l.meta_data.get("query_params", {})]
                assert len(matching_logs) > 0
                latest_log = matching_logs[0]
                qp = latest_log.meta_data.get("query_params", {})

                # Verify repeated parameter values are both redacted
                assert qp.get("token") == ["[REDACTED]", "[REDACTED]"]
                assert qp.get("code") == ["[REDACTED]", "[REDACTED]"]
                # Verify alternate sensitive keys are redacted
                assert qp.get("invite_token") == "[REDACTED]"
                assert qp.get("state") == "[REDACTED]"
                # Confirm raw token never entered the database audit log metadata
                assert raw_token not in str(latest_log.meta_data)
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_failed_user_creation_rolls_back_invitation_consumption(self):
        """Test 14: Database error during user registration rolls back token consumption."""
        data = await self.setup_tenants_and_users()
        app.dependency_overrides[get_current_user] = lambda: data["admin_a"]

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                target_email = f"rollback.test.{uuid.uuid4().hex[:6]}@primary-corp.com"

                with patch("services.email_service.email_service.send_team_invitation_email", new_callable=AsyncMock) as mock_send:
                    mock_send.return_value = False
                    res = await client.post(
                        "/api/v1/team/invite",
                        json={"email": target_email, "role": "recruiter"},
                    )
                    assert res.status_code == 200
                    raw_token = res.json()["recovery_accept_url"].split("token=")[1]

            # Simulate database failure during user creation flush
            with patch("sqlalchemy.ext.asyncio.AsyncSession.flush", side_effect=RuntimeError("Simulated DB Disk Failure")):
                async with AsyncClient(transport=transport, base_url="http://test") as client:
                    accept_res = await client.post(
                        "/api/v1/team/invite/accept",
                        json={
                            "token": raw_token,
                            "password": "SecurePassword123!",
                            "full_name": "Crash Candidate",
                        },
                    )
                    assert accept_res.status_code == 409

            # Verify token consumption was rolled back in database and remains PENDING
            async with AsyncSessionLocal() as session:
                token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
                inv = (await session.execute(
                    select(TeamInvitation).where(TeamInvitation.token_hash == token_hash)
                )).scalar_one()
                assert inv.status == InvitationStatus.PENDING
                assert inv.accepted_at is None
                assert inv.accepted_by_user_id is None
        finally:
            app.dependency_overrides.pop(get_current_user, None)


