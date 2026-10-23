"""
DVT Talent AI — Security Regression Test Suite for Batch 1
Validates:
1. Candidate hiding profile from 'acme.com' is not returned to an acme.com recruiter.
2. Hidden candidate's name, email, phone, and LinkedIn URL do not appear in CSV export.
3. Recruiter from an allowed company can still export an eligible candidate.
4. Tenant boundaries are respected across list, export, and detail endpoints.
5. Pagination totals and returned items reflect the exact same visibility policy (no leaked counts).
6. A valid resume file inside the configured upload directory is accepted.
7. A path containing '../' that escapes the upload directory is rejected.
8. An absolute path to an unrelated file is rejected.
9. A symlink pointing outside the upload directory is rejected where supported by the platform.
"""

import os
import sys
import uuid
import csv
import io
from pathlib import Path
import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, str(Path(__file__).parent.parent))

from main import app
from db.models import AsyncSessionLocal, Tenant, User, Candidate, CandidateStatus, Resume, UserRole
from api.routes.auth import get_current_user
from services.resume_parser import ResumeParserService


@pytest.fixture
def temp_resume_storage(tmp_path):
    """Provides an isolated temporary upload directory for resume security tests."""
    upload_dir = tmp_path / "uploads" / "resumes"
    upload_dir.mkdir(parents=True, exist_ok=True)
    outside_dir = tmp_path / "outside_sensitive"
    outside_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir, outside_dir


# ─── Task C: Resume Path Security Unit Tests ───────────────────────────────────

class TestResumePathSecurity:
    """Verifies strict path canonicalization and directory containment in get_resume_file_path."""

    def test_valid_resume_inside_upload_dir_accepted(self, temp_resume_storage):
        """Test 6: A valid resume file inside the configured upload directory is accepted."""
        upload_dir, _ = temp_resume_storage
        valid_file = upload_dir / "candidate_123_resume.pdf"
        valid_file.write_bytes(b"%PDF-1.4 sample content")

        result = ResumeParserService.get_resume_file_path(str(valid_file), base_dir=upload_dir)
        assert result is not None
        assert result.resolve() == valid_file.resolve()
        assert result.is_file()

        # Also test relative filename inside upload_dir
        result_relative = ResumeParserService.get_resume_file_path("candidate_123_resume.pdf", base_dir=upload_dir)
        assert result_relative is not None
        assert result_relative.resolve() == valid_file.resolve()

    def test_traversal_path_escaping_upload_dir_rejected(self, temp_resume_storage):
        """Test 7: A path containing '../' that escapes the upload directory is rejected."""
        upload_dir, outside_dir = temp_resume_storage
        outside_file = outside_dir / "secret.pdf"
        outside_file.write_bytes(b"%PDF-1.4 confidential data")

        # Attempt to escape upload_dir using relative traversal
        traversal_path = "../../outside_sensitive/secret.pdf"
        result = ResumeParserService.get_resume_file_path(traversal_path, base_dir=upload_dir)
        assert result is None, "Directory traversal path must be rejected!"

        # Multi-level traversal attempt
        deep_traversal = "../../../../../etc/passwd"
        assert ResumeParserService.get_resume_file_path(deep_traversal, base_dir=upload_dir) is None

    def test_absolute_path_outside_upload_dir_rejected(self, temp_resume_storage):
        """Test 8: An absolute path to an unrelated file is rejected."""
        upload_dir, outside_dir = temp_resume_storage
        unrelated_file = outside_dir / "unrelated_resume.docx"
        unrelated_file.write_bytes(b"PK\x03\x04 docx content")

        # Absolute path outside upload_root
        result = ResumeParserService.get_resume_file_path(str(unrelated_file.resolve()), base_dir=upload_dir)
        assert result is None, "Absolute path outside upload directory must be rejected!"

    def test_symlink_pointing_outside_upload_dir_rejected(self, temp_resume_storage):
        """Test 9: A symlink pointing outside the upload directory is rejected where supported by the platform."""
        upload_dir, outside_dir = temp_resume_storage
        outside_target = outside_dir / "target_private.pdf"
        outside_target.write_bytes(b"%PDF-1.4 secret document")

        symlink_file = upload_dir / "escaped_symlink.pdf"
        try:
            os.symlink(str(outside_target.resolve()), str(symlink_file))
        except (OSError, NotImplementedError):
            pytest.skip("Symlink creation not permitted on this platform without elevated privileges.")

        result = ResumeParserService.get_resume_file_path(str(symlink_file), base_dir=upload_dir)
        assert result is None, "Symlink pointing outside upload directory must be rejected!"

    def test_unauthorized_extensions_rejected(self, temp_resume_storage):
        """Disallowed extensions (.exe, .sh, .py, .env) are rejected even inside upload_dir."""
        upload_dir, _ = temp_resume_storage
        malicious_script = upload_dir / "shell.sh"
        malicious_script.write_bytes(b"#!/bin/bash\necho pwned")

        result = ResumeParserService.get_resume_file_path(str(malicious_script), base_dir=upload_dir)
        assert result is None

    def test_null_byte_injection_rejected(self, temp_resume_storage):
        """Null byte injection is rejected."""
        upload_dir, _ = temp_resume_storage
        null_byte_path = "resume.pdf\x00.exe"
        assert ResumeParserService.get_resume_file_path(null_byte_path, base_dir=upload_dir) is None


# ─── Tasks A & B: Candidate Privacy, Listing, Pagination & CSV Export ─────────

@pytest.mark.asyncio
class TestCandidatePrivacyAndExport:
    """Verifies privacy enforcement on candidate listing, pagination, and CSV export."""

    async def setup_test_data(self):
        """Seed synthetic tenants and candidates for testing."""
        async with AsyncSessionLocal() as session:
            run_id = uuid.uuid4().hex[:6]
            acme_domain = f"acme-{run_id}.com"
            allowed_domain = f"allowed-{run_id}.com"
            foreign_domain = f"foreign-{run_id}.com"

            # 1. Tenant Acme
            acme_tenant_id = uuid.uuid4()
            acme_tenant = Tenant(
                id=acme_tenant_id,
                name="Acme Corporation",
                domain=acme_domain,
                is_active=True,
            )

            # 2. Tenant Allowed
            allowed_tenant_id = uuid.uuid4()
            allowed_tenant = Tenant(
                id=allowed_tenant_id,
                name="Allowed Partners",
                domain=allowed_domain,
                is_active=True,
            )

            # 3. Tenant Foreign for tenant isolation
            foreign_tenant_id = uuid.uuid4()
            foreign_tenant = Tenant(
                id=foreign_tenant_id,
                name="Foreign Enterprises",
                domain=foreign_domain,
                is_active=True,
            )

            session.add_all([acme_tenant, allowed_tenant, foreign_tenant])
            await session.flush()

            # Candidate 1: Hiding from Acme specifically
            cand_hidden_from_acme = Candidate(
                id=uuid.uuid4(),
                tenant_id=acme_tenant_id,
                first_name="Alice",
                last_name="Secret",
                email=f"alice.secret.{uuid.uuid4().hex[:6]}@privacy.test",
                phone="+1 555-0101",
                linkedin_url="https://linkedin.com/in/alice-secret-profile",
                title="Stealth Architect",
                current_company="Current Employer Inc",
                score=95.0,
                is_searchable=True,
                hide_from_companies=[acme_domain],
            )

            # Candidate 2: In Stealth mode (is_searchable=False)
            cand_stealth = Candidate(
                id=uuid.uuid4(),
                tenant_id=acme_tenant_id,
                first_name="Bob",
                last_name="Ghost",
                email=f"bob.ghost.{uuid.uuid4().hex[:6]}@privacy.test",
                phone="+1 555-0102",
                linkedin_url="https://linkedin.com/in/bob-ghost",
                title="Ghost Developer",
                current_company="Stealth Startup",
                score=92.0,
                is_searchable=False,
                hide_from_companies=[],
            )

            # Candidate 3: Open / eligible for Acme
            cand_open_1 = Candidate(
                id=uuid.uuid4(),
                tenant_id=acme_tenant_id,
                first_name="Carol",
                last_name="Visible",
                email=f"carol.visible.{uuid.uuid4().hex[:6]}@allowed.test",
                phone="+1 555-0103",
                linkedin_url="https://linkedin.com/in/carol-visible",
                title="Senior Backend Lead",
                current_company="Open Corp",
                score=88.0,
                is_searchable=True,
                hide_from_companies=["othercompany.com"],
            )

            # Candidate 4: Open / eligible for Acme
            cand_open_2 = Candidate(
                id=uuid.uuid4(),
                tenant_id=acme_tenant_id,
                first_name="Dan",
                last_name="Visible",
                email=f"dan.visible.{uuid.uuid4().hex[:6]}@allowed.test",
                phone="+1 555-0104",
                linkedin_url="https://linkedin.com/in/dan-visible",
                title="Frontend Architect",
                current_company="Open Corp",
                score=80.0,
                is_searchable=True,
                hide_from_companies=[],
            )

            # Candidate 5: Foreign Tenant candidate (Tenant boundary)
            cand_foreign = Candidate(
                id=uuid.uuid4(),
                tenant_id=foreign_tenant_id,
                first_name="Eve",
                last_name="Foreign",
                email=f"eve.foreign.{uuid.uuid4().hex[:6]}@foreign.test",
                phone="+1 555-0105",
                linkedin_url="https://linkedin.com/in/eve-foreign",
                title="Foreign Engineer",
                current_company="Foreign Corp",
                score=85.0,
                is_searchable=True,
                hide_from_companies=[],
            )

            # Candidate 6: Sourced under Allowed Tenant
            cand_allowed_tenant_cand = Candidate(
                id=uuid.uuid4(),
                tenant_id=allowed_tenant_id,
                first_name="Frank",
                last_name="Allowed",
                email=f"frank.allowed.{uuid.uuid4().hex[:6]}@partner.test",
                phone="+1 555-0106",
                linkedin_url="https://linkedin.com/in/frank-allowed",
                title="Cloud Specialist",
                current_company="Partner Corp",
                score=87.0,
                is_searchable=True,
                hide_from_companies=[],
            )

            session.add_all([
                cand_hidden_from_acme,
                cand_stealth,
                cand_open_1,
                cand_open_2,
                cand_foreign,
                cand_allowed_tenant_cand,
            ])
            await session.commit()

            return {
                "acme_tenant_id": acme_tenant_id,
                "acme_domain": acme_domain,
                "allowed_tenant_id": allowed_tenant_id,
                "allowed_domain": allowed_domain,
                "foreign_tenant_id": foreign_tenant_id,
                "foreign_domain": foreign_domain,
                "cand_hidden_from_acme": cand_hidden_from_acme,
                "cand_stealth": cand_stealth,
                "cand_open_1": cand_open_1,
                "cand_open_2": cand_open_2,
                "cand_foreign": cand_foreign,
                "cand_allowed_tenant_cand": cand_allowed_tenant_cand,
            }

    async def test_candidate_listing_hides_blacklisted_and_stealth_and_syncs_pagination(self):
        """
        Test 1 & 5:
        - Candidate hiding from acme.com is not returned to acme.com recruiter.
        - Stealth candidate is not returned.
        - Pagination totals and returned items match visible set exactly.
        """
        data = await self.setup_test_data()
        acme_recruiter = User(
            id=uuid.uuid4(),
            email=f"recruiter@{data['acme_domain']}",
            role=UserRole.RECRUITER,
            tenant_id=data["acme_tenant_id"],
            full_name="Acme Talent Scout",
        )

        app.dependency_overrides[get_current_user] = lambda: acme_recruiter

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/candidates?page=1&page_size=20")
                assert res.status_code == 200, res.text
                body = res.json()

                returned_ids = [item["id"] for item in body["items"]]
                returned_emails = [item["email"] for item in body["items"]]

                # 1. Alice (hides from acme.com) must NOT be returned
                assert str(data["cand_hidden_from_acme"].id) not in returned_ids
                assert data["cand_hidden_from_acme"].email not in returned_emails

                # 2. Bob (stealth mode) must NOT be returned
                assert str(data["cand_stealth"].id) not in returned_ids

                # 3. Foreign tenant candidate must NOT be returned
                assert str(data["cand_foreign"].id) not in returned_ids

                # 4. Open candidates Carol and Dan MUST be returned
                assert str(data["cand_open_1"].id) in returned_ids
                assert str(data["cand_open_2"].id) in returned_ids

                # 5. Total count MUST equal 2 (only visible candidates, no leaked total!)
                assert body["total"] == 2
                assert len(body["items"]) == 2

                # 6. Verify page size slicing consistency
                paged_res = await client.get("/api/v1/candidates?page=1&page_size=1")
                assert paged_res.status_code == 200
                paged_body = paged_res.json()
                assert len(paged_body["items"]) == 1
                assert paged_body["total"] == 2
                assert paged_body["page"] == 1
                assert paged_body["page_size"] == 1
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_csv_export_does_not_expose_hidden_candidate_pii(self):
        """
        Test 2:
        - The hidden candidate's name, email, phone, and LinkedIn URL do not appear in CSV export.
        - Stealth candidate is excluded from CSV.
        """
        data = await self.setup_test_data()
        acme_recruiter = User(
            id=uuid.uuid4(),
            email=f"talent.director@{data['acme_domain']}",
            role=UserRole.RECRUITER,
            tenant_id=data["acme_tenant_id"],
            full_name="Acme Talent Director",
        )

        app.dependency_overrides[get_current_user] = lambda: acme_recruiter

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/candidates/export")
                assert res.status_code == 200, res.text
                assert "text/csv" in res.headers.get("content-type", "")

                csv_text = res.text
                reader = list(csv.reader(io.StringIO(csv_text)))
                assert len(reader) >= 2  # Header + rows

                # Check that hidden candidate's PII is completely absent from CSV
                hidden_cand = data["cand_hidden_from_acme"]
                assert hidden_cand.first_name not in csv_text
                assert hidden_cand.last_name not in csv_text
                assert hidden_cand.email not in csv_text
                assert hidden_cand.phone not in csv_text
                assert hidden_cand.linkedin_url not in csv_text

                # Check stealth candidate is absent
                stealth_cand = data["cand_stealth"]
                assert stealth_cand.first_name not in csv_text
                assert stealth_cand.email not in csv_text

                # Check authorized candidates ARE present
                assert data["cand_open_1"].email in csv_text
                assert data["cand_open_2"].email in csv_text
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_allowed_company_can_export_eligible_candidate(self):
        """
        Test 3: A recruiter from an allowed company can still export an eligible candidate.
        """
        data = await self.setup_test_data()
        allowed_recruiter = User(
            id=uuid.uuid4(),
            email=f"scout@{data['allowed_domain']}",
            role=UserRole.RECRUITER,
            tenant_id=data["allowed_tenant_id"],
            full_name="Allowed Recruiter",
        )

        app.dependency_overrides[get_current_user] = lambda: allowed_recruiter

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                res = await client.get("/api/v1/candidates/export")
                assert res.status_code == 200
                csv_text = res.text
                # Candidate belonging to Allowed Tenant is exported
                assert data["cand_allowed_tenant_cand"].email in csv_text
        finally:
            app.dependency_overrides.pop(get_current_user, None)

    async def test_tenant_boundaries_and_direct_id_access(self):
        """
        Test 4: Tenant boundaries are respected.
        - Foreign tenant candidates are never returned to another tenant.
        - Blocked or hidden candidates return 404 on direct ID lookup and resume download.
        """
        data = await self.setup_test_data()
        acme_recruiter = User(
            id=uuid.uuid4(),
            email=f"recruiter@{data['acme_domain']}",
            role=UserRole.RECRUITER,
            tenant_id=data["acme_tenant_id"],
            full_name="Acme Recruiter",
        )

        app.dependency_overrides[get_current_user] = lambda: acme_recruiter

        try:
            transport = ASGITransport(app=app)
            async with AsyncClient(transport=transport, base_url="http://test") as client:
                # Direct lookup of foreign candidate -> 404 Not Found
                foreign_res = await client.get(f"/api/v1/candidates/{data['cand_foreign'].id}")
                assert foreign_res.status_code == 404

                # Direct lookup of hidden candidate (blacklisted acme.com) -> 404 Not Found
                hidden_res = await client.get(f"/api/v1/candidates/{data['cand_hidden_from_acme'].id}")
                assert hidden_res.status_code == 404

                # Direct lookup of visible candidate -> 200 OK
                visible_res = await client.get(f"/api/v1/candidates/{data['cand_open_1'].id}")
                assert visible_res.status_code == 200
                assert visible_res.json()["email"] == data["cand_open_1"].email

                # Resume download of hidden candidate -> 404 Not Found
                resume_dl = await client.get(f"/api/v1/candidates/{data['cand_hidden_from_acme'].id}/resume/download")
                assert resume_dl.status_code == 404
        finally:
            app.dependency_overrides.pop(get_current_user, None)
