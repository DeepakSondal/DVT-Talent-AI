"""
DVT Talent AI — Automated Regression Tests for Candidate Privacy Shield
Validates:
- Exact domain matching
- Subdomain matching (e.g. aws.amazon.com matches blacklisted amazon.com)
- Protocol and path stripping (https://www.apple.com/jobs -> apple.com)
- Case insensitivity & whitespace normalization
- Inactive / stealth flag (is_searchable == False)
- Invalid, missing, or empty email and domain parameters
"""
import pytest
from types import SimpleNamespace
from services.privacy_service import (
    normalize_domain,
    is_domain_or_company_blocked,
    is_candidate_visible_to_recruiter,
)


class TestDomainNormalization:
    """Validates domain normalization edge cases."""

    def test_strip_protocols_and_www(self):
        assert normalize_domain("https://www.google.com") == "google.com"
        assert normalize_domain("http://apple.com") == "apple.com"
        assert normalize_domain("https://sub.domain.co.uk/") == "sub.domain.co.uk"

    def test_strip_paths_ports_queries(self):
        assert normalize_domain("https://netflix.com/jobs/search?q=engineer") == "netflix.com"
        assert normalize_domain("http://localhost:8000/api") == "localhost"
        assert normalize_domain("stripe.com:443/home#section") == "stripe.com"

    def test_case_and_whitespace(self):
        assert normalize_domain("  GoOgLe.CoM  ") == "google.com"
        assert normalize_domain("\tAmAzOn.cOm\n") == "amazon.com"

    def test_invalid_and_empty_inputs(self):
        assert normalize_domain("") == ""
        assert normalize_domain("   ") == ""
        assert normalize_domain(None) == ""
        assert normalize_domain(12345) == ""


class TestBlacklistDomainMatching:
    """Validates candidate employer-domain blacklist matching."""

    def test_exact_domain_match(self):
        blacklist = ["google.com", "stripe.com"]
        assert is_domain_or_company_blocked(blacklist, employer_domain="google.com") is True
        assert is_domain_or_company_blocked(blacklist, employer_domain="stripe.com") is True
        assert is_domain_or_company_blocked(blacklist, employer_domain="uber.com") is False

    def test_subdomain_matching(self):
        # A recruiter at aws.amazon.com should be blocked if candidate blacklisted amazon.com
        blacklist = ["amazon.com"]
        assert is_domain_or_company_blocked(blacklist, employer_domain="aws.amazon.com") is True
        assert is_domain_or_company_blocked(blacklist, employer_domain="corp.aws.amazon.com") is True
        # Conversely, blacklisting corp.google.com shouldn't block the root google.com
        assert is_domain_or_company_blocked(["corp.google.com"], employer_domain="google.com") is False

    def test_case_insensitive_and_dirty_blacklist_items(self):
        blacklist = ["  https://www.Apple.COM/jobs  ", "GoOgLe.CoM"]
        assert is_domain_or_company_blocked(blacklist, employer_domain="apple.com") is True
        assert is_domain_or_company_blocked(blacklist, employer_domain="GOOGLE.COM") is True

    def test_recruiter_corporate_email_domain_match(self):
        # If tenant domain is blank or generic, match by recruiter email domain
        blacklist = ["netflix.com"]
        assert is_domain_or_company_blocked(
            blacklist, employer_domain="", employer_email="recruiter@netflix.com"
        ) is True
        assert is_domain_or_company_blocked(
            blacklist, employer_domain=None, employer_email="talent@jobs.netflix.com"
        ) is True
        assert is_domain_or_company_blocked(
            blacklist, employer_domain=None, employer_email="recruiter@hiringagency.com"
        ) is False

    def test_company_name_matching(self):
        blacklist = ["Acme", "Meta Platforms"]
        assert is_domain_or_company_blocked(blacklist, employer_name="Acme Corp") is True
        assert is_domain_or_company_blocked(blacklist, employer_name="Meta Platforms Inc") is True
        assert is_domain_or_company_blocked(blacklist, employer_name="Unrelated Startup") is False

    def test_invalid_or_missing_employer_data(self):
        blacklist = ["google.com"]
        assert is_domain_or_company_blocked(blacklist, employer_domain=None, employer_email=None) is False
        assert is_domain_or_company_blocked(blacklist, employer_domain="", employer_email="") is False
        assert is_domain_or_company_blocked([], employer_domain="google.com") is False
        assert is_domain_or_company_blocked([None, ""], employer_domain="google.com") is False


class TestCandidateVisibilityGatekeeper:
    """Validates the end-to-end candidate visibility evaluator."""

    def test_candidate_in_stealth_mode_hidden(self):
        cand = SimpleNamespace(is_searchable=False, hide_from_companies=[])
        assert is_candidate_visible_to_recruiter(cand, recruiter_tenant_domain="any.com") is False

    def test_candidate_searchable_with_blacklist_block(self):
        cand = SimpleNamespace(is_searchable=True, hide_from_companies=["microsoft.com"])
        # Recruiter from Microsoft is blocked
        assert is_candidate_visible_to_recruiter(
            cand, recruiter_tenant_domain="microsoft.com", recruiter_email="hr@microsoft.com"
        ) is False
        # Recruiter from Spotify is allowed
        assert is_candidate_visible_to_recruiter(
            cand, recruiter_tenant_domain="spotify.com", recruiter_email="hr@spotify.com"
        ) is True

    def test_candidate_searchable_with_subdomain_block(self):
        cand = SimpleNamespace(is_searchable=True, hide_from_companies=["apple.com"])
        assert is_candidate_visible_to_recruiter(
            cand, recruiter_tenant_domain="jobs.apple.com"
        ) is False

    def test_default_searchable_without_blacklist(self):
        cand = SimpleNamespace(is_searchable=True, hide_from_companies=[])
        assert is_candidate_visible_to_recruiter(
            cand, recruiter_tenant_domain="anycompany.com"
        ) is True
