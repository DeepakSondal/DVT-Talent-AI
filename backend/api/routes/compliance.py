"""
DVT Talent AI — Compliance & AI Governance API Routes
Exposes policy pack status, adverse impact reports (EEOC 4/5ths Rule),
and immutable AI Decision Ledger entries for human-in-the-loop auditability.
"""
import uuid
from typing import Optional

import structlog
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from api.routes.auth import get_current_user
from db.models import AIDecisionLedger, Candidate, CandidateStatus, User, get_db
from services.compliance_service import compliance_service

log = structlog.get_logger(__name__)
router = APIRouter(prefix="/compliance", tags=["Compliance & AI Governance"])

class OverridePayload(BaseModel):
    reviewer_override: Optional[str] = None
    notes: Optional[str] = None


def _require_compliance_access(current_user: User, write: bool = False) -> uuid.UUID:
    role_val = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if not current_user.tenant_id or role_val == "candidate":
        raise HTTPException(status_code=403, detail="Workspace permissions required to access compliance governance.")
    if write and role_val not in ("admin", "recruiter", "manager"):
        raise HTTPException(status_code=403, detail="Recruiter, manager, or admin permissions required to override AI decisions.")
    return current_user.tenant_id


@router.get("/policy-packs")
async def get_policy_packs(current_user: User = Depends(get_current_user)):
    """Retrieve current compliance policy pack statuses."""
    _require_compliance_access(current_user, write=False)
    return compliance_service.get_policy_packs_status()

@router.get("/adverse-impact")
@router.post("/adverse-impact/report")
async def get_adverse_impact_report(
    payload: Optional[dict] = Body(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns calculated Adverse Impact ratios (EEOC 4/5ths Rule) across candidate evaluation cohorts.
    Uses live tenant candidate cohorts grouped by source when available.
    """
    _require_compliance_access(current_user, write=False)
    if payload and "pool_a_applied" in payload and "pool_b_applied" in payload:
        cohort = [
            {"group": "Pool A", "total": int(payload.get("pool_a_applied") or 0), "selected": int(payload.get("pool_a_hired") or 0)},
            {"group": "Pool B", "total": int(payload.get("pool_b_applied") or 0), "selected": int(payload.get("pool_b_hired") or 0)},
        ]
        return compliance_service.calculate_adverse_impact([c for c in cohort if c["total"] > 0])

    rows = (
        await db.execute(
            select(
                Candidate.source,
                func.count(Candidate.id),
                func.count(Candidate.id).filter(
                    (Candidate.score >= 80)
                    | Candidate.status.in_([
                        CandidateStatus.SCREENED,
                        CandidateStatus.CONTACTED,
                        CandidateStatus.INTERVIEWING,
                        CandidateStatus.OFFERED,
                        CandidateStatus.PLACED,
                    ])
                ),
            )
            .where(
                Candidate.tenant_id == current_user.tenant_id,
                Candidate.pii_erased.isnot(True),
            )
            .group_by(Candidate.source)
        )
    ).all()

    cohort = [
        {"group": str(src or "Direct / Upload"), "total": int(total), "selected": int(selected)}
        for src, total, selected in rows
        if total and total > 0
    ]
    return compliance_service.calculate_adverse_impact(cohort)

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
            "confidence_score": round(r.qualification_score / 100.0, 2) if r.qualification_score is not None else None,
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
    """Records a Human-in-the-Loop decision override in the AI Decision Ledger."""
    _require_compliance_access(current_user, write=True)
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
        AIDecisionLedger.tenant_id == current_user.tenant_id
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Decision ledger record not found")

    entry.human_action = resolved_action
    entry.is_override = True
    entry.override_reason = resolved_reason
    entry.reviewer_user_id = current_user.id
    
    await db.commit()

    if resolved_action == "REJECTED" and resolved_reason:
        try:
            from agents.swarm_memory import add_negative_vector
            await add_negative_vector(
                "recruiter_override",
                resolved_reason,
                tenant_id=str(current_user.tenant_id),
            )
        except Exception as exc:
            log.warning("swarm_memory_override_sync_failed", error=str(exc), ledger_id=ledger_id)

    return {"status": "SUCCESS", "message": f"Human decision recorded as {resolved_action}"}
