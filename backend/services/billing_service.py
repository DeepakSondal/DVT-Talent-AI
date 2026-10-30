"""
DVT Talent AI — Credit Deduction Helper
Used by BaseAgent to deduct credits per agent task.
"""
import structlog
from typing import Optional

log = structlog.get_logger(__name__)


class InsufficientCreditsError(Exception):
    """Raised when a tenant does not have enough credits to run an agent."""
    pass


async def deduct_credits(
    tenant_id: str,
    amount: int = 1,
    description: str = "Agent task",
) -> bool:
    """
    Deducts `amount` credits from the tenant's balance.
    Logs the transaction in CreditTransaction.
    Raises InsufficientCreditsError if balance is insufficient.

    Args:
        tenant_id: UUID string of the tenant.
        amount: Number of credits to deduct (default: 1 per agent call).
        description: Human-readable label for the deduction.

    Returns:
        True if deduction was successful.

    Raises:
        InsufficientCreditsError: if the tenant does not have enough credits.
    """
    try:
        from db.models import Tenant, CreditTransaction, CreditTransactionType, AsyncSessionLocal
        from sqlalchemy import select
        import uuid

        async with AsyncSessionLocal() as session:
            t_uuid = uuid.UUID(str(tenant_id))
            result = await session.execute(
                select(Tenant).where(Tenant.id == t_uuid).with_for_update()
            )
            tenant: Optional[Tenant] = result.scalar_one_or_none()

            if not tenant:
                log.warning("credit_deduction_tenant_not_found", tenant_id=tenant_id)
                return True  # Fail open — don't block if tenant isn't found

            if (tenant.credits_balance or 0) < amount:
                log.warning(
                    "insufficient_credits",
                    tenant_id=tenant_id,
                    balance=tenant.credits_balance,
                    required=amount,
                )
                raise InsufficientCreditsError(
                    f"Insufficient credits: {tenant.credits_balance} available, {amount} required."
                )

            # Deduct and log
            tenant.credits_balance -= amount
            tx = CreditTransaction(
                tenant_id=tenant.id,
                amount=-amount,  # Negative = debit
                type=CreditTransactionType.DEBIT,
                description=description,
            )
            session.add(tx)
            await session.commit()

            log.info(
                "credits_deducted",
                tenant_id=tenant_id,
                amount=amount,
                new_balance=tenant.credits_balance,
                description=description,
            )
            return True

    except InsufficientCreditsError:
        raise
    except Exception as e:
        # Never block agent execution on billing DB errors — fail open
        log.error("credit_deduction_db_error", error=str(e), tenant_id=tenant_id)
        return True
