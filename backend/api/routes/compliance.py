"""
DVT Talent AI — Compliance & AI Governance API Routes
Exposes policy pack status, public bias audit summary, AEDT 10-business-day advance notice,
adverse impact reports (EEOC 4/5ths Rule), and immutable AI Decision Ledger entries.
"""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, cast
from uuid import UUID

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import get_current_user
from db.models import (
    AIDecisionLedger,
    Candidate,
    CandidateStatus,
    Job,
    JobCandidate,
    User,
    get_db,
)
from services.compliance_service import compliance_service
from services.email_service import email_service

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/compliance", tags=["Compliance & AI Governance"])


class OverridePayload(BaseModel):
    reviewer_override: Optional[str] = None
    notes: Optional[str] = None


class AEDTNoticePayload(BaseModel):
    job_title: Optional[str] = None
    required_business_days: int = Field(default=10, ge=10, le=90)


def _require_compliance_access(current_user: User, write: bool = False) -> uuid.UUID:
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if not current_user.tenant_id or role_val == "candidate":
        raise HTTPException(status_code=403, detail="Workspace permissions required to access compliance governance.")
    if write and role_val not in ("admin", "recruiter", "manager"):
        raise HTTPException(status_code=403, detail="Recruiter, manager, or admin permissions required to override AI decisions.")
    return cast(uuid.UUID, current_user.tenant_id)


@router.get("/bias-audit-summary")
async def get_public_bias_audit_summary():
    """
    Publicly reachable NYC Local Law 144 AEDT Bias Audit Summary (unauthenticated).
    Returns audit metadata within the prior 12 months, selection rate methodology,
    LL 144 scope disclaimer, and external auditor policy note without tenant/candidate PII.
    """
    return compliance_service.get_public_bias_audit_summary()


@router.get("/policy-packs")
async def get_policy_packs(current_user: User = Depends(get_current_user)):
    """Retrieve current compliance policy pack statuses."""
    _require_compliance_access(current_user, write=False)
    return compliance_service.get_policy_packs_status()


async def _fetch_adverse_impact_cohort(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    job_id: Optional[UUID],
) -> list[dict]:
    """Query candidate evaluation cohorts scoped to tenant and optional job requisition."""
    selected_statuses = [
        CandidateStatus.SCREENED,
        CandidateStatus.CONTACTED,
        CandidateStatus.INTERVIEWING,
        CandidateStatus.OFFERED,
        CandidateStatus.PLACED,
    ]
    if job_id is not None:
        selected_expr = (
            JobCandidate.status.in_(selected_statuses)
            | (
                (JobCandidate.status != CandidateStatus.REJECTED)
                & (Candidate.status != CandidateStatus.REJECTED)
                & ((JobCandidate.match_score >= 80) | (Candidate.score >= 80))
            )
        )
        rows = (
            await db.execute(
                select(
                    func.coalesce(Candidate.source, "Direct / Upload"),
                    func.count(JobCandidate.id),
                    func.count(JobCandidate.id).filter(selected_expr),
                )
                .join(Candidate, JobCandidate.candidate_id == Candidate.id)
                .outerjoin(Job, JobCandidate.job_id == Job.id)
                .where(
                    JobCandidate.job_id == job_id,
                    (JobCandidate.tenant_id == tenant_id) | (Job.tenant_id == tenant_id),
                    (Job.id.is_(None)) | (Job.tenant_id == tenant_id),
                    Candidate.pii_erased.isnot(True),
                )
                .group_by(func.coalesce(Candidate.source, "Direct / Upload"))
            )
        ).all()
    else:
        rows = (
            await db.execute(
                select(
                    Candidate.source,
                    func.count(Candidate.id),
                    func.count(Candidate.id).filter(
                        Candidate.status.in_(selected_statuses)
                        | ((Candidate.status != CandidateStatus.REJECTED) & (Candidate.score >= 80))
                    ),
                )
                .where(
                    Candidate.tenant_id == tenant_id,
                    Candidate.pii_erased.isnot(True),
                )
                .group_by(Candidate.source)
            )
        ).all()

    return [
        {"group": str(src or "Direct / Upload"), "total": int(total), "selected": int(selected)}
        for src, total, selected in rows
        if total and total > 0
    ]


@router.get("/adverse-impact")
@router.post("/adverse-impact/report")
async def get_adverse_impact_report(
    job_id: Optional[UUID] = Query(None),
    min_sample_size: int = Query(5, ge=1, le=1000),
    payload: Optional[dict] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns calculated Adverse Impact ratios (EEOC 4/5ths Rule) across candidate evaluation cohorts.
    Optionally filters cohorts to a specific job requisition via JobCandidate.job_id == job_id.
    """
    tenant_id = _require_compliance_access(current_user, write=False)

    effective_job_id = job_id
    if effective_job_id is None and payload and payload.get("job_id"):
        try:
            effective_job_id = UUID(str(payload["job_id"]))
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="Invalid job_id") from exc

    effective_min_sample = min_sample_size
    if payload and payload.get("min_sample_size") is not None:
        try:
            effective_min_sample = max(1, int(payload["min_sample_size"]))
        except (ValueError, TypeError) as exc:
            raise HTTPException(status_code=400, detail="Invalid min_sample_size") from exc

    if payload and "pool_a_applied" in payload and "pool_b_applied" in payload:
        cohort: List[Dict[str, Any]] = [
            {"group": "Pool A", "total": int(payload.get("pool_a_applied") or 0), "selected": int(payload.get("pool_a_hired") or 0)},
            {"group": "Pool B", "total": int(payload.get("pool_b_applied") or 0), "selected": int(payload.get("pool_b_hired") or 0)},
        ]
        return compliance_service.calculate_adverse_impact(
            [c for c in cohort if c["total"] > 0],
            min_sample_size=effective_min_sample,
            job_id=effective_job_id,
        )

    cohort = await _fetch_adverse_impact_cohort(db, tenant_id, effective_job_id)
    return compliance_service.calculate_adverse_impact(
        cohort,
        min_sample_size=effective_min_sample,
        job_id=effective_job_id,
    )


async def _resolve_tenant_candidate(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    candidate_id: str,
) -> Candidate:
    """Resolve an active non-erased candidate owned by or portal-applied to tenant_id."""
    try:
        cand_uuid = uuid.UUID(candidate_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid candidate ID") from exc

    cand_res = await db.execute(
        select(Candidate).where(
            Candidate.id == cand_uuid,
            Candidate.tenant_id == tenant_id,
            Candidate.pii_erased.isnot(True),
        )
    )
    candidate = cand_res.scalar_one_or_none()
    if not candidate:
        portal_cand_res = await db.execute(
            select(Candidate)
            .join(JobCandidate, JobCandidate.candidate_id == Candidate.id)
            .where(
                Candidate.id == cand_uuid,
                Candidate.tenant_id.is_(None),
                Candidate.pii_erased.isnot(True),
                JobCandidate.tenant_id == tenant_id,
            )
            .limit(1)
        )
        candidate = portal_cand_res.scalar_one_or_none()

    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate


@router.post("/aedt-notice/{candidate_id}")
async def send_aedt_advance_notice(
    candidate_id: str,
    payload: Optional[AEDTNoticePayload] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Send NYC LL 144 AEDT advance notice (>= 10 business days) via email_service
    and record aedt_notice_sent_at & screening_eligible_after in Candidate.meta_data.
    """
    tenant_id = _require_compliance_access(current_user, write=True)
    candidate = await _resolve_tenant_candidate(db, tenant_id, candidate_id)

    required_days = payload.required_business_days if payload else 10
    sent_at = datetime.now(timezone.utc)
    updated_meta, notice_details = compliance_service.create_aedt_notice_record(
        existing_meta=cast(Optional[Dict[str, Any]], candidate.meta_data),
        sent_at=sent_at,
        required_business_days=required_days,
        method="email",
        sent_by_user_id=str(current_user.id),
    )

    subject, body, bias_audit_summary_url = compliance_service.build_aedt_notice_email_content(
        candidate_name=cast(Optional[str], candidate.first_name),
        job_title=payload.job_title if payload else None,
        notice_details=notice_details,
        required_business_days=required_days,
    )

    email_sent = False
    if candidate.email:
        try:
            email_sent = await email_service.send_email(
                email_id=str(uuid.uuid4()),
                to_address=str(candidate.email),
                subject=subject,
                body=body,
                tenant_id=tenant_id,
            )
        except Exception as exc:
            log.warning("aedt_notice_email_failed", error=str(exc), candidate_id=str(candidate.id))
            email_sent = False

    updated_meta["aedt_notice_delivery_status"] = "sent" if email_sent else "failed"
    setattr(candidate, "meta_data", updated_meta)
    await db.commit()

    return {
        "status": "SUCCESS",
        "candidate_id": str(candidate.id),
        "email": candidate.email,
        "notification_sent": email_sent,
        "aedt_notice_sent_at": notice_details["aedt_notice_sent_at"],
        "screening_eligible_after": notice_details["screening_eligible_after"],
        "required_business_days": required_days,
        "bias_audit_summary_url": bias_audit_summary_url,
        "aedt_notice": compliance_service.check_screening_notice_eligibility(
            candidate,
            now=sent_at,
            required_business_days=required_days,
        ),
    }


@router.get("/aedt-eligibility/{candidate_id}")
async def check_candidate_aedt_eligibility(
    candidate_id: str,
    job_id: Optional[UUID] = Query(None),
    enforce: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify whether a candidate satisfies NYC LL 144 10-business-day AEDT advance notice."""
    tenant_id = _require_compliance_access(current_user, write=False)
    candidate = await _resolve_tenant_candidate(db, tenant_id, candidate_id)

    job_location: Optional[str] = None
    if job_id is not None:
        job_res = await db.execute(
            select(Job.location).where(Job.id == job_id, Job.tenant_id == tenant_id)
        )
        job_row = job_res.first()
        if not job_row:
            raise HTTPException(status_code=404, detail="Job not found")
        job_location = job_row[0]

    try:
        eligibility = compliance_service.check_screening_notice_eligibility(
            candidate,
            enforce=enforce,
            job_location=job_location,
        )
    except ValueError as exc:
        raise HTTPException(status_code=412, detail=str(exc)) from exc

    return {
        "candidate_id": str(candidate.id),
        "job_id": str(job_id) if job_id else None,
        **eligibility,
    }


@router.get("/decision-ledger")
@router.get("/ledgers")
async def get_decision_ledger(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve immutable AI Decision Ledger entries for this tenant."""
    _require_compliance_access(current_user, write=False)
    stmt = (
        select(AIDecisionLedger)
        .where(AIDecisionLedger.tenant_id == current_user.tenant_id)
        .order_by(desc(AIDecisionLedger.created_at))
        .limit(limit)
    )
    res = await db.execute(stmt)
    records = res.scalars().all()
    
    return [
        {
            "id": str(r.id),
            "job_id": str(r.job_id) if r.job_id else None,
            "candidate_id": str(r.candidate_id) if r.candidate_id else None,
            "decision_type": r.decision_type,
            "action_type": r.decision_type,
            "model_provider": r.model_provider,
            "model_name": r.model_name,
            "qualification_score": r.qualification_score,
            "confidence_score": round(float(cast(Any, r.qualification_score)) / 100.0, 2) if r.qualification_score is not None else None,
            "confidence_level": r.confidence_level,
            "evidence_signals": {
                k: v for k, v in (r.evidence_signals.items() if isinstance(r.evidence_signals, dict) else [])
                if k not in ("candidate_name", "candidate_email")
            },
            "evidence_hash": r.input_data_hash,
            "reasoning_summary": r.reasoning_summary,
            "reasoning": r.reasoning_summary,
            "human_action": r.human_action,
            "reviewer_override": "PENDING" if r.human_action == "PENDING_REVIEW" else r.human_action,
            "is_override": r.is_override,
            "sanitized": (
                bool(r.evidence_signals.get("pii_erased"))
                or not any(k in r.evidence_signals for k in ("candidate_name", "candidate_email"))
            ) if isinstance(r.evidence_signals, dict) else True,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]


@router.post("/decision-ledger/{ledger_id}/override")
@router.post("/ledgers/{ledger_id}/override")
async def record_human_override(
    ledger_id: str,
    human_action: Optional[str] = Query(None, pattern="^(APPROVED|REJECTED)$"),
    override_reason: Optional[str] = Query(None),
    payload: Optional[OverridePayload] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Records a Human-in-the-Loop decision override in the AI Decision Ledger and syncs candidate status."""
    tenant_id = _require_compliance_access(current_user, write=True)
    resolved_action = human_action or (payload.reviewer_override if payload else None)
    if resolved_action not in ("APPROVED", "REJECTED"):
        raise HTTPException(status_code=400, detail="human_action must be APPROVED or REJECTED")
    resolved_reason = override_reason or (payload.notes if payload else None)

    try:
        ledger_uuid = uuid.UUID(ledger_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid decision ledger ID") from exc

    stmt = select(AIDecisionLedger).where(
        AIDecisionLedger.id == ledger_uuid,
        AIDecisionLedger.tenant_id == tenant_id
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Decision ledger record not found")

    setattr(entry, "human_action", resolved_action)
    setattr(entry, "is_override", True)
    setattr(entry, "override_reason", resolved_reason)
    setattr(entry, "reviewer_user_id", current_user.id)

    target_status = CandidateStatus.REJECTED if resolved_action == "REJECTED" else CandidateStatus.SCREENED
    updated_candidate_status = None
    updated_job_candidate_status = None
    aedt_notice_eligibility = None

    if entry.candidate_id:
        cand_res = await db.execute(
            select(Candidate).where(
                Candidate.id == entry.candidate_id,
                Candidate.tenant_id == tenant_id,
            )
        )
        cand = cand_res.scalar_one_or_none()
        if cand:
            if resolved_action == "APPROVED":
                aedt_notice_eligibility = compliance_service.check_screening_notice_eligibility(
                    cand,
                    enforce=False,
                )
            setattr(cand, "status", target_status)
            updated_candidate_status = target_status.value

        if entry.job_id:
            jc_res = await db.execute(
                select(JobCandidate)
                .outerjoin(Job, JobCandidate.job_id == Job.id)
                .where(
                    JobCandidate.job_id == entry.job_id,
                    JobCandidate.candidate_id == entry.candidate_id,
                    (JobCandidate.tenant_id == tenant_id) | (Job.tenant_id == tenant_id),
                )
            )
            jc = jc_res.scalar_one_or_none()
            if jc:
                setattr(jc, "status", target_status)
                updated_job_candidate_status = target_status.value

    await db.commit()

    if resolved_action == "REJECTED" and resolved_reason:
        try:
            from agents.swarm_memory import add_negative_vector
            await add_negative_vector(
                "recruiter_override",
                resolved_reason,
                tenant_id=str(tenant_id),
            )
        except Exception as exc:
            log.warning("swarm_memory_override_sync_failed", error=str(exc), ledger_id=ledger_id)

    return {
        "status": "SUCCESS",
        "message": f"Human decision recorded as {resolved_action}",
        "human_action": resolved_action,
        "candidate_status": updated_candidate_status,
        "job_candidate_status": updated_job_candidate_status,
        "aedt_notice_eligibility": aedt_notice_eligibility,
    }
