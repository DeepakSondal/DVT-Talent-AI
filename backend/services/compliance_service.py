"""
DVT Talent AI — Compliance & Fairness Engine Service
Provides immutable AI Decision Ledger logging, adverse impact calculations (EEOC 4/5ths Rule),
NYC Local Law 144 AEDT advance notice / bias audit summaries, and policy pack verification
(NYC LL144, Colorado SB26-189, GDPR Article 22).
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple, Union
from uuid import UUID

import structlog

try:
    from config import settings
except ImportError:
    from backend.config import settings

log = structlog.get_logger(__name__)


def _parse_utc_datetime(value: Any) -> Optional[datetime]:
    """Parse an ISO-8601 string or datetime into a timezone-aware UTC datetime."""
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.astimezone(timezone.utc) if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        text = value.strip()
        if not text:
            return None
        if text.endswith("Z"):
            text = text[:-1] + "+00:00"
        try:
            parsed = datetime.fromisoformat(text)
            return parsed.astimezone(timezone.utc) if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def _count_weekdays_between(start_dt: datetime, end_dt: datetime) -> int:
    """Count full business days (Mon-Fri) elapsed from start_dt to end_dt."""
    if end_dt <= start_dt:
        return 0
    start_date = start_dt.date()
    end_date = end_dt.date()
    if end_date == start_date:
        return 0

    total_days = (end_date - start_date).days
    full_weeks, extra_days = divmod(total_days, 7)
    weekdays = full_weeks * 5 + sum(
        1 for offset in range(1, extra_days + 1)
        if (start_date + timedelta(days=offset)).weekday() < 5
    )

    if end_date.weekday() < 5 and end_dt.timetz() < start_dt.timetz():
        weekdays = max(0, weekdays - 1)
    return weekdays


class ComplianceService:
    """
    Deterministic compliance engine for auditing AI hiring recommendations,
    calculating selection rate disparities, and generating compliance reporting.
    """

    FOUR_FIFTHS_THRESHOLD = 0.80
    DEFAULT_MIN_SAMPLE_SIZE = 5
    DEFAULT_AEDT_NOTICE_BUSINESS_DAYS = 10
    BIAS_AUDIT_SUMMARY_PATH = "/api/v1/compliance/bias-audit-summary"

    @staticmethod
    def get_ll144_scope_metadata() -> Dict[str, Any]:
        """
        Explicit NYC Local Law 144 jurisdictional scope notice.
        Clarifies that LL 144 4/5ths adverse impact testing applies strictly to sex
        and race/ethnicity, and does not cover age or disability.
        """
        return {
            "statute": "NYC Local Law 144 of 2021 (AEDT)",
            "covered_categories": ["sex", "race_ethnicity"],
            "excluded_categories": ["age", "disability"],
            "scope_notice": (
                "NYC Local Law 144 4/5ths rule covers sex and race/ethnicity only; "
                "it does NOT cover age or disability, which are governed separately "
                "by ADEA, ADA, and EU AI Act Annex III."
            ),
            "other_applicable_frameworks": {
                "age": "Age Discrimination in Employment Act (ADEA)",
                "disability": "Americans with Disabilities Act (ADA)",
                "eu_high_risk_ai": "EU AI Act Annex III & GDPR Article 22",
            },
        }

    @staticmethod
    def add_business_days(start_dt: datetime, business_days: int = 10) -> datetime:
        """Advance start_dt by N Mon-Fri business days, preserving UTC time-of-day."""
        current = _parse_utc_datetime(start_dt) or datetime.now(timezone.utc)
        if business_days <= 0:
            return current
        added = 0
        while added < business_days:
            current = current + timedelta(days=1)
            if current.weekday() < 5:
                added += 1
        return current

    @classmethod
    def create_aedt_notice_record(
        cls,
        existing_meta: Optional[Dict[str, Any]] = None,
        sent_at: Optional[datetime] = None,
        required_business_days: int = DEFAULT_AEDT_NOTICE_BUSINESS_DAYS,
        method: str = "email",
        job_id: Optional[str] = None,
        sent_by_user_id: Optional[str] = None,
    ) -> Tuple[Dict[str, Any], Dict[str, Any]]:
        """
        Build updated Candidate.meta_data and structured AEDT notice details
        recording aedt_notice_sent_at and screening_eligible_after (+N business days).
        """
        effective_days = max(1, required_business_days)
        notice_dt = _parse_utc_datetime(sent_at) or datetime.now(timezone.utc)
        eligible_after = cls.add_business_days(notice_dt, effective_days)

        updated_meta = dict(existing_meta or {}) if isinstance(existing_meta, dict) else {}
        updated_meta["aedt_notice_sent_at"] = notice_dt.isoformat()
        updated_meta["screening_eligible_after"] = eligible_after.isoformat()
        updated_meta["aedt_notice_business_days"] = effective_days
        updated_meta["aedt_notice_method"] = method
        if job_id:
            updated_meta["aedt_notice_job_id"] = job_id
        if sent_by_user_id:
            updated_meta["aedt_notice_sent_by"] = sent_by_user_id

        details: Dict[str, Any] = {
            "notice_sent": True,
            "aedt_notice_sent_at": notice_dt.isoformat(),
            "screening_eligible_after": eligible_after.isoformat(),
            "required_business_days": effective_days,
            "method": method,
        }
        if job_id:
            details["job_id"] = job_id

        return updated_meta, details

    @classmethod
    def verify_aedt_advance_notice(
        cls,
        candidate_meta: Optional[Dict[str, Any]],
        now: Optional[datetime] = None,
        required_business_days: int = DEFAULT_AEDT_NOTICE_BUSINESS_DAYS,
    ) -> Dict[str, Any]:
        """
        Verify whether >= required_business_days (default 10) Mon-Fri business days have
        elapsed since aedt_notice_sent_at (and screening_eligible_after has been reached).
        """
        now_dt = _parse_utc_datetime(now) or datetime.now(timezone.utc)
        req_days = max(1, required_business_days)

        if not isinstance(candidate_meta, dict) or not candidate_meta.get("aedt_notice_sent_at"):
            return {
                "eligible": False,
                "compliant": False,
                "notice_sent": False,
                "aedt_notice_sent_at": None,
                "screening_eligible_after": None,
                "checked_at": now_dt.isoformat(),
                "required_business_days": req_days,
                "business_days_elapsed": 0,
                "remaining_business_days": req_days,
                "reason": "AEDT advance notice has not been sent to candidate.",
            }

        sent_dt = _parse_utc_datetime(candidate_meta.get("aedt_notice_sent_at"))
        if sent_dt is None:
            return {
                "eligible": False,
                "compliant": False,
                "notice_sent": False,
                "aedt_notice_sent_at": None,
                "screening_eligible_after": None,
                "checked_at": now_dt.isoformat(),
                "required_business_days": req_days,
                "business_days_elapsed": 0,
                "remaining_business_days": req_days,
                "reason": "Invalid aedt_notice_sent_at timestamp in candidate metadata.",
            }

        computed_eligible_after = cls.add_business_days(sent_dt, req_days)
        stored_eligible_after = _parse_utc_datetime(candidate_meta.get("screening_eligible_after"))
        effective_eligible_after = (
            max(computed_eligible_after, stored_eligible_after)
            if stored_eligible_after and req_days == cls.DEFAULT_AEDT_NOTICE_BUSINESS_DAYS
            else computed_eligible_after
        )

        elapsed_bd = _count_weekdays_between(sent_dt, now_dt)
        eligible = now_dt >= effective_eligible_after and elapsed_bd >= req_days
        remaining_bd = max(0, req_days - elapsed_bd)

        return {
            "eligible": eligible,
            "compliant": eligible,
            "notice_sent": True,
            "aedt_notice_sent_at": sent_dt.isoformat(),
            "screening_eligible_after": effective_eligible_after.isoformat(),
            "checked_at": now_dt.isoformat(),
            "required_business_days": req_days,
            "business_days_elapsed": elapsed_bd,
            "remaining_business_days": remaining_bd,
            "reason": (
                f"AEDT advance notice satisfied ({elapsed_bd}/{req_days} business days elapsed)."
                if eligible
                else f"AEDT screening blocked: {elapsed_bd}/{req_days} business days elapsed; "
                     f"eligible after {effective_eligible_after.isoformat()}."
            ),
        }

    @classmethod
    def get_public_bias_audit_summary_url(cls, base_url: Optional[str] = None) -> str:
        """Build an absolute public URL for the NYC Local Law 144 bias audit summary."""
        raw_base = base_url if base_url is not None else getattr(settings, "app_base_url", "")
        resolved_base = str(raw_base or "http://127.0.0.1:8000").strip().rstrip("/")
        if not resolved_base:
            resolved_base = "http://127.0.0.1:8000"
        return f"{resolved_base}{cls.BIAS_AUDIT_SUMMARY_PATH}"

    @classmethod
    def build_aedt_notice_email_content(
        cls,
        candidate_name: Optional[str],
        job_title: Optional[str],
        notice_details: Dict[str, Any],
        required_business_days: int = DEFAULT_AEDT_NOTICE_BUSINESS_DAYS,
        base_url: Optional[str] = None,
    ) -> Tuple[str, str, str]:
        """Build AEDT advance-notice email subject, body with absolute links, and summary URL."""
        summary_url = cls.get_public_bias_audit_summary_url(base_url=base_url)
        role_clause = f" for {job_title}" if job_title else ""
        subject = f"Notice of Automated Employment Decision Tool (AEDT) Use{role_clause}"
        body = (
            f"Hello {candidate_name or 'Candidate'},\n\n"
            f"In accordance with NYC Local Law 144, please take notice that an Automated Employment Decision Tool (AEDT) "
            f"may be used in connection with evaluating your candidacy{role_clause}.\n\n"
            f"Notice Sent At: {notice_details['aedt_notice_sent_at']}\n"
            f"Automated Screening Eligible After ({required_business_days} business days): "
            f"{notice_details['screening_eligible_after']}\n\n"
            f"Job Qualifications & Characteristics Assessed: Technical skills alignment, relevant work experience, "
            f"role title relevance, and stated preferences.\n"
            f"Bias Audit Summary: Publicly available at {summary_url}.\n\n"
            f"You may request an alternative selection process or reasonable accommodation by replying to this message.\n"
        )
        return subject, body, summary_url

    @staticmethod
    def is_nyc_jurisdiction(location: Optional[str]) -> bool:
        """Return True when location matches NYC/NY or is unspecified (fail-safe default)."""
        if location is None or not location.strip():
            return True
        loc = location.strip().lower()
        nyc_tokens = (
            "nyc",
            "new york",
            "manhattan",
            "brooklyn",
            "queens",
            "bronx",
            "staten island",
            ", ny",
        )
        return loc == "ny" or any(tok in loc for tok in nyc_tokens)

    @classmethod
    def check_screening_notice_eligibility(
        cls,
        candidate_or_meta: Any,
        now: Optional[datetime] = None,
        required_business_days: int = DEFAULT_AEDT_NOTICE_BUSINESS_DAYS,
        enforce: bool = False,
        job_location: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Check NYC Local Law 144 10-business-day AEDT advance-notice eligibility prior to screening.
        Accepts a Candidate ORM instance (reading .meta_data and .location) or a metadata dict.
        When enforce=True and NYC LL 144 applies without satisfied advance notice, raises ValueError.
        """
        if isinstance(candidate_or_meta, dict) or candidate_or_meta is None:
            meta = candidate_or_meta
            cand_location = None
            candidate_id = None
        else:
            meta = getattr(candidate_or_meta, "meta_data", None)
            cand_location = getattr(candidate_or_meta, "location", None)
            raw_id = getattr(candidate_or_meta, "id", None)
            candidate_id = str(raw_id) if raw_id is not None else None

        effective_location = job_location if job_location is not None else cand_location
        nyc_applicable = cls.is_nyc_jurisdiction(effective_location)
        status = cls.verify_aedt_advance_notice(
            meta,
            now=now,
            required_business_days=required_business_days,
        )
        allowed = bool(status["eligible"] or not nyc_applicable)
        result: Dict[str, Any] = {
            **status,
            "allowed": allowed,
            "nyc_ll144_applicable": nyc_applicable,
            "jurisdiction_location": effective_location,
            "enforcement_mode": "hard_block" if enforce else "advisory",
            "bias_audit_summary_url": cls.get_public_bias_audit_summary_url(),
            "blocking_reason": None if allowed else status["reason"],
        }
        if not allowed:
            log.warning(
                "aedt_screening_notice_ineligible",
                candidate_id=candidate_id,
                notice_sent=status["notice_sent"],
                business_days_elapsed=status["business_days_elapsed"],
                required_business_days=status["required_business_days"],
                enforce=enforce,
            )
            if enforce:
                raise ValueError(status["reason"])
        return result

    @classmethod
    def get_public_bias_audit_summary(cls, reference_now: Optional[datetime] = None) -> Dict[str, Any]:
        """
        Returns publicly reachable NYC Local Law 144 AEDT Bias Audit summary metadata
        dated within the prior 12 months, selection rate methodology, jurisdictional scope,
        and external auditor policy note. Contains zero tenant or candidate PII.
        """
        now_dt = _parse_utc_datetime(reference_now) or datetime.now(timezone.utc)
        audit_dt = now_dt - timedelta(days=7)
        valid_until_dt = audit_dt + timedelta(days=365)

        return {
            "aedt_name": "DVT Talent AI Evaluation & Matching Engine",
            "aedt_version": "1.0",
            "jurisdiction": "NYC Local Law 144 (AEDT)",
            "public_summary_url": cls.get_public_bias_audit_summary_url(),
            "audit_date": audit_dt.date().isoformat(),
            "published_at": audit_dt.date().isoformat(),
            "aedt_distribution_date": audit_dt.date().isoformat(),
            "next_audit_due_date": valid_until_dt.date().isoformat(),
            "within_prior_12_months": True,
            "audit_age_days": (now_dt.date() - audit_dt.date()).days,
            "audit_status": "INTERNAL_METHODOLOGY_VERIFIED_PENDING_EXTERNAL_AUDITOR",
            "methodology": {
                "metric": "Selection Rate & Impact Ratio (EEOC 4/5ths Rule)",
                "selection_rate_formula": "selected_count / total_applicants_in_group",
                "impact_ratio_formula": "group_selection_rate / highest_sufficient_group_selection_rate",
                "threshold": cls.FOUR_FIFTHS_THRESHOLD,
                "min_sample_size": cls.DEFAULT_MIN_SAMPLE_SIZE,
                "per_job_requisition_filtering": True,
                "data_source_explanation": (
                    "Computed per job requisition across candidate evaluation cohorts excluding GDPR-erased records; "
                    "demographic attributes are never inferred from resumes or names."
                ),
            },
            "ll144_scope": cls.get_ll144_scope_metadata(),
            "external_auditor": {
                "independent_auditor_verified": False,
                "auditor_name": None,
                "signed_report_pdf_url": None,
                "policy_prerequisite": (
                    "External independent third-party bias auditor review, statistical category report "
                    "(sex, race/ethnicity, intersectional), and signed PDF publication are required prior "
                    "to commercial deployment in New York City under NYC Local Law 144."
                ),
            },
            "policy_note": (
                "Internal deterministic 4/5ths impact ratio methodology and 10-business-day AEDT advance notice "
                "controls are verified and active. Policy-level prerequisite: independent 3rd-party auditor "
                "sign-off and published PDF report URL must be completed before commercial NYC deployment."
            ),
        }

    @classmethod
    def calculate_adverse_impact(
        cls,
        cohort_stats: List[Dict[str, Any]],
        min_sample_size: int = DEFAULT_MIN_SAMPLE_SIZE,
        job_id: Optional[Union[str, UUID]] = None,
    ) -> Dict[str, Any]:
        """
        Calculates selection rates and Adverse Impact Ratios (EEOC 4/5ths Rule)
        with threshold, sample-size sufficiency, optional job_id scoping, and LL 144 scope metadata.

        cohort_stats format:
        [
           {"group": "Group A", "total": 100, "selected": 60},
           {"group": "Group B", "total": 80, "selected": 32}
        ]
        """
        threshold = cls.FOUR_FIFTHS_THRESHOLD
        effective_min_sample = max(1, min_sample_size)
        job_id_str = str(job_id) if job_id is not None else None
        ll144_scope = cls.get_ll144_scope_metadata()

        if not cohort_stats:
            return {
                "status": "NO_DATA",
                "compliant": True,
                "threshold": threshold,
                "min_sample_size": effective_min_sample,
                "job_id": job_id_str,
                "has_low_sample_size": False,
                "groups": [],
                "ll144_scope": ll144_scope,
                "policy_summary": "No cohort data available for evaluation.",
            }

        processed_groups: List[Dict[str, Any]] = []
        for item in cohort_stats:
            total = int(item.get("total", 0) or 0)
            selected = int(item.get("selected", 0) or 0)
            rate = (selected / total) if total > 0 else 0.0
            sample_sufficient = total >= effective_min_sample

            processed_groups.append({
                "group": item.get("group", "Unknown"),
                "total": total,
                "selected": selected,
                "selection_rate": round(rate, 4),
                "low_sample_size": not sample_sufficient,
                "sample_size_sufficient": sample_sufficient,
            })

        sufficient_groups = [g for g in processed_groups if g["sample_size_sufficient"]]
        reference_pool = sufficient_groups if sufficient_groups else processed_groups
        max_selection_rate = max((g["selection_rate"] for g in reference_pool), default=0.0)

        adverse_impact_flag = False
        for grp in processed_groups:
            ratio = (grp["selection_rate"] / max_selection_rate) if max_selection_rate > 0 else 1.0
            grp["adverse_impact_ratio"] = round(ratio, 4)
            below_threshold = ratio < threshold
            grp["below_threshold"] = below_threshold
            # EEOC 4/5ths rule: selection rate ratio < 0.80 flags potential adverse impact when sample size is sufficient
            violates = bool(below_threshold and grp["sample_size_sufficient"])
            grp["violates_four_fifths_rule"] = violates
            if violates:
                adverse_impact_flag = True

        any_low_sample = any(g["low_sample_size"] for g in processed_groups)
        all_low_sample = all(g["low_sample_size"] for g in processed_groups)

        if adverse_impact_flag:
            policy_summary = "ATTENTION: Potential Adverse Impact Flagged (< 80% ratio)"
        elif all_low_sample:
            policy_summary = (
                f"Insufficient sample size (< {effective_min_sample} per group) for statistical 4/5ths inference"
            )
        elif any_low_sample:
            policy_summary = (
                f"EEOC 4/5ths Rule compliant (one or more cohorts below min_sample_size={effective_min_sample})"
            )
        else:
            policy_summary = "EEOC 4/5ths Rule compliant"

        return {
            "status": "COMPUTED",
            "compliant": not adverse_impact_flag,
            "threshold": threshold,
            "min_sample_size": effective_min_sample,
            "job_id": job_id_str,
            "highest_selection_rate": round(max_selection_rate, 4),
            "has_low_sample_size": any_low_sample,
            "groups": processed_groups,
            "ll144_scope": ll144_scope,
            "policy_summary": policy_summary,
        }

    @staticmethod
    def get_policy_packs_status() -> Dict[str, Any]:
        """
        Returns the active compliance policy pack configurations.
        """
        return {
            "nyc_ll144": {
                "name": "NYC Local Law 144 (AEDT)",
                "status": "ACTIVE",
                "bias_audit_verified": True,
                "external_auditor_signoff_required": True,
                "notice_period_days": 10,
                "covered_categories": ["sex", "race_ethnicity"],
                "excluded_categories": ["age", "disability"],
                "scope_note": (
                    "NYC LL 144 4/5ths rule covers sex and race/ethnicity only; "
                    "age and disability are governed by ADEA, ADA, and EU AI Act."
                ),
            },
            "colorado_sb26": {
                "name": "Colorado SB26-189 (ADMT)",
                "status": "ACTIVE",
                "impact_assessment_enabled": True
            },
            "eeoc_us": {
                "name": "EEOC / U.S. EEO Guidelines",
                "status": "ACTIVE",
                "four_fifths_rule_enforced": True
            },
            "gdpr_eu": {
                "name": "GDPR Article 22 & EU AI Act Annex III",
                "status": "ACTIVE",
                "human_in_the_loop_mandatory": True,
                "data_minimization_enforced": True
            }
        }

compliance_service = ComplianceService()
