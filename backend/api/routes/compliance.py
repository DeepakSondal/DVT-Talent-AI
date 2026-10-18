"""
DVT Talent AI — Compliance & AI Governance API Routes
Exposes policy pack status, adverse impact reports (EEOC 4/5ths Rule),
and immutable AI Decision Ledger entries for human-in-the-loop auditability.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Dict, Any, Optional
import uuid

from backend.db.models import get_db, AIDecisionLedger, User
from backend.api.routes.auth import get_current_user
from backend.services.compliance_service import compliance_service

router = APIRouter(prefix="/compliance", tags=["Compliance & AI Governance"])

@router.get("/policy-packs")
async def get_policy_packs(current_user: User = Depends(get_current_user)):
    """Retrieve current compliance policy pack statuses."""
    return compliance_service.get_policy_packs_status()

@router.get("/adverse-impact")
async def get_adverse_impact_report(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns calculated Adverse Impact ratios (EEOC 4/5ths Rule) across candidate evaluation cohorts.
    """
    mock_cohort = [
        {"group": "Cohort Alpha", "total": 120, "selected": 96},
        {"group": "Cohort Beta", "total": 85, "selected": 61},
        {"group": "Cohort Gamma", "total": 45, "selected": 34}
    ]
    return compliance_service.calculate_adverse_impact(mock_cohort)

@router.get("/decision-ledger")
async def get_decision_ledger(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Retrieve immutable AI Decision Ledger entries for this tenant."""
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
            "model_provider": r.model_provider,
            "model_name": r.model_name,
            "qualification_score": r.qualification_score,
            "confidence_level": r.confidence_level,
            "evidence_signals": r.evidence_signals,
            "reasoning_summary": r.reasoning_summary,
            "human_action": r.human_action,
            "is_override": r.is_override,
            "created_at": r.created_at.isoformat() if r.created_at else None
        }
        for r in records
    ]

@router.post("/decision-ledger/{ledger_id}/override")
async def record_human_override(
    ledger_id: str,
    human_action: str = Query(..., regex="^(APPROVED|REJECTED)$"),
    override_reason: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Records a Human-in-the-Loop decision override in the AI Decision Ledger."""
    try:
        ledger_uuid = uuid.UUID(ledger_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid decision ledger ID")

    stmt = select(AIDecisionLedger).where(
        AIDecisionLedger.id == ledger_uuid,
        AIDecisionLedger.tenant_id == current_user.tenant_id
    )
    res = await db.execute(stmt)
    entry = res.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(status_code=404, detail="Decision ledger record not found")

    entry.human_action = human_action
    entry.is_override = True
    entry.override_reason = override_reason
    entry.reviewer_user_id = current_user.id
    
    await db.commit()
    return {"status": "SUCCESS", "message": f"Human decision recorded as {human_action}"}
