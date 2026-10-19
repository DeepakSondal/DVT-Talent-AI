"""
DVT Talent AI — Candidate Privacy & Employer Blacklist Service
Enforces strict candidate privacy shields across all search, sourcing, and job-matching paths.
"""
import re
from typing import List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select


def normalize_domain(raw: Optional[str]) -> str:
    """
    Normalizes a domain or URL to a clean, lowercase FQDN.
    Handles protocols (http/https), www prefix, trailing paths, query strings, and whitespace.
    """
    if not raw or not isinstance(raw, str):
        return ""
    
    cleaned = raw.strip().lower()
    # Strip protocol
    cleaned = re.sub(r"^https?://", "", cleaned)
    # Strip www prefix
    cleaned = re.sub(r"^www\.", "", cleaned)
    # Strip path, ports, query params, fragments
    cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0].split(":")[0].strip()
    return cleaned


def is_domain_or_company_blocked(
    hide_from_companies: List[str],
    employer_domain: Optional[str] = None,
    employer_name: Optional[str] = None,
    employer_email: Optional[str] = None,
) -> bool:
    """
    Evaluates whether an employer/recruiter matches any item in the candidate's blacklist.
    Checks:
    1. Exact domain match (e.g. google.com == google.com)
    2. Subdomain match (e.g. recruiter at aws.amazon.com matches blacklisted amazon.com)
    3. Recruiter email domain match (e.g. recruiter@uber.com matches uber.com)
    4. Exact or clean company name match (e.g. "Acme Corp" matches "Acme")
    """
    if not hide_from_companies:
        return False

    clean_emp_domain = normalize_domain(employer_domain)
    
    # Extract domain from email if available
    email_domain = ""
    if employer_email and "@" in employer_email:
        email_domain = normalize_domain(employer_email.split("@")[-1])

    clean_emp_name = (employer_name or "").strip().lower()

    for item in hide_from_companies:
        if not item or not isinstance(item, str) or not item.strip():
            continue
        
        clean_item = normalize_domain(item)
        raw_item_lower = item.strip().lower()

        # Check domain matches
        if clean_item:
            # 1. Exact match with employer domain
            if clean_emp_domain and clean_item == clean_emp_domain:
                return True
            
            # 2. Subdomain match: employer is a subdomain of blacklisted item (e.g. aws.amazon.com matches amazon.com)
            if clean_emp_domain and clean_emp_domain.endswith("." + clean_item):
                return True

            # 3. Match against recruiter's corporate email domain
            if email_domain and clean_item == email_domain:
                return True
            if email_domain and email_domain.endswith("." + clean_item):
                return True

        # 4. Company name text matching (case-insensitive substring/equality)
        if clean_emp_name:
            if raw_item_lower == clean_emp_name:
                return True
            # Match word boundary if item is a recognized company token (e.g. "google" in "Google Inc")
            if len(raw_item_lower) >= 3 and raw_item_lower in clean_emp_name:
                return True
            if len(clean_emp_name) >= 3 and clean_emp_name in raw_item_lower:
                return True

    return False


def is_candidate_visible_to_recruiter(
    candidate: Any,
    recruiter_tenant_domain: Optional[str] = None,
    recruiter_tenant_name: Optional[str] = None,
    recruiter_email: Optional[str] = None,
) -> bool:
    """
    Unified gatekeeper for candidate profile visibility.
    Returns False if:
    1. Candidate has set is_searchable = False (Stealth Mode)
    2. Recruiter or their organization matches candidate's hide_from_companies blacklist.
    """
    # 1. Check stealth / consent flag
    is_searchable = getattr(candidate, "is_searchable", True)
    if is_searchable is False:
        return False

    # 2. Check blacklist
    hide_list = getattr(candidate, "hide_from_companies", []) or []
    if isinstance(hide_list, list) and hide_list:
        if is_domain_or_company_blocked(
            hide_from_companies=hide_list,
            employer_domain=recruiter_tenant_domain,
            employer_name=recruiter_tenant_name,
            employer_email=recruiter_email,
        ):
            return False

    return True
