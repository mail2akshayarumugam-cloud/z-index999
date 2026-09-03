"""
Transaction lifecycle service.

Flow: preview → risk evaluate → commit/reject
Transactions are NEVER committed before the risk decision.
"""
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import re

from app.models.financial import (
    Account,
    Beneficiary,
    Transaction,
    TransactionAttempt,
    BeneficiaryEvent,
)
from app.models.tables import User
from app.ml.risk_model import (
    evaluate_with_ml,
    persist_ml_assessment,
    persist_ml_decision,
)

_PHONE_RE = re.compile(r'^\+?91?\d{10}$')


async def _resolve_phone_to_upi(db: AsyncSession, phone_or_upi: str) -> str | None:
    """If input looks like a phone number, find the account's UPI ID."""
    digits = re.sub(r'[^0-9]', '', phone_or_upi)
    if len(digits) < 10:
        return None
    if len(digits) > 10:
        digits = digits[-10:]
    phone_variants = [f"+91{digits}", digits, f"91{digits}"]
    for variant in phone_variants:
        result = await db.execute(
            select(User).where(User.phone_number == variant)
        )
        user = result.scalar_one_or_none()
        if user:
            acct_r = await db.execute(
                select(Account).where(Account.user_id == user.id).limit(1)
            )
            acct = acct_r.scalar_one_or_none()
            if acct and acct.upi_id:
                return acct.upi_id
    return None


async def _upi_exists_in_system(db: AsyncSession, upi_id: str) -> bool:
    """Check if a UPI ID exists anywhere in the system (accounts, beneficiaries, or H.I.V.E. signals)."""
    from app.models.financial import RiskSignalV2
    acct = await db.execute(select(Account).where(Account.upi_id == upi_id))
    if acct.scalar_one_or_none():
        return True
    ben = await db.execute(select(Beneficiary).where(Beneficiary.upi_id == upi_id))
    if ben.first():
        return True
    sig = await db.execute(
        select(RiskSignalV2).where(
            RiskSignalV2.entity_type == "upi_id",
            RiskSignalV2.entity_value == upi_id,
        )
    )
    if sig.first():
        return True
    return False


async def preview_transaction(
    db: AsyncSession,
    user_id: str,
    beneficiary_upi: str,
    amount: Decimal,
    description: str | None = None,
    device_id: str | None = None,
    ip_address: str | None = None,
    location: str | None = None,
) -> dict:
    """
    Create a pending transaction + attempt WITHOUT committing payment.
    Accepts UPI ID or mobile number (resolved to UPI).

    Returns transaction_id and preliminary data for the risk engine.
    """
    resolved_from_phone = None
    if '@' not in beneficiary_upi:
        resolved = await _resolve_phone_to_upi(db, beneficiary_upi)
        if resolved:
            resolved_from_phone = beneficiary_upi
            beneficiary_upi = resolved
        else:
            raise ValueError(
                f"No account linked to mobile number '{beneficiary_upi}'. "
                "Please check the number or use a UPI ID instead."
            )

    result = await db.execute(
        select(Account).where(Account.user_id == user_id).limit(1)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise ValueError(f"No account found for user {user_id}")

    if float(amount) > float(account.balance):
        raise ValueError(
            f"Insufficient balance: Rs{account.balance} available, Rs{amount} requested"
        )

    if not await _upi_exists_in_system(db, beneficiary_upi):
        raise ValueError(
            f"UPI ID '{beneficiary_upi}' not found. Please verify the UPI ID and try again."
        )

    result = await db.execute(
        select(Beneficiary).where(
            Beneficiary.user_id == user_id,
            Beneficiary.upi_id == beneficiary_upi,
        )
    )
    beneficiary = result.scalar_one_or_none()

    txn = Transaction(
        user_id=user_id,
        account_id=account.id,
        beneficiary_id=beneficiary.id if beneficiary else None,
        beneficiary_upi=beneficiary_upi,
        amount=amount,
        description=description,
        status="pending",
    )
    db.add(txn)
    await db.flush()

    attempt = TransactionAttempt(
        transaction_id=txn.id,
        device_id=device_id,
        ip_address=ip_address,
        location=location,
        source="app",
    )
    db.add(attempt)
    await db.flush()

    evaluation = await evaluate_with_ml(
        db, user_id, beneficiary_upi, amount, device_id
    )

    assessment = await persist_ml_assessment(db, txn.id, evaluation)

    txn.status = "evaluated"
    await db.flush()
    await db.commit()

    resp = {
        "transaction_id": txn.id,
        "status": txn.status,
        "amount": str(txn.amount),
        "beneficiary_upi": txn.beneficiary_upi,
        "beneficiary_name": beneficiary.name if beneficiary else None,
        "is_new_beneficiary": beneficiary is None,
        "risk_evaluation": evaluation,
    }
    if resolved_from_phone:
        resp["resolved_from_phone"] = resolved_from_phone
    return resp


async def commit_transaction(
    db: AsyncSession,
    transaction_id: str,
    user_id: str,
    override_reason: str | None = None,
) -> dict:
    """
    Commit a transaction ONLY if the risk decision allows it.

    HOLD transactions require override_reason (human approval).
    """
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise ValueError("Transaction not found")

    if txn.status == "committed":
        raise ValueError("Transaction already committed")
    if txn.status not in ("evaluated", "pending"):
        raise ValueError(f"Transaction cannot be committed from status '{txn.status}'")

    from app.models.financial import RiskAssessment
    result = await db.execute(
        select(RiskAssessment).where(RiskAssessment.transaction_id == transaction_id)
    )
    assessment = result.scalar_one_or_none()

    if not assessment:
        raise ValueError("Transaction has no risk assessment — run preview first")

    if assessment.decision == "HOLD" and not override_reason:
        await persist_ml_decision(db, transaction_id, "AWAITING_AUTHORIZATION", "HOLD — escalated to authority")
        txn.status = "awaiting_authorization"
        await db.commit()
        return {
            "transaction_id": txn.id,
            "status": "awaiting_authorization",
            "decision": "HOLD",
            "message": "Transaction held for review. A higher authority has been notified and must approve or reject.",
        }

    if assessment.decision == "HOLD" and override_reason:
        await persist_ml_decision(db, transaction_id, "OVERRIDE_APPROVED", override_reason)

    if assessment.decision in ("VERIFY", "STRONG_VERIFY"):
        await persist_ml_decision(db, transaction_id, "VERIFIED_COMMIT", override_reason or "User verified")

    if assessment.decision == "ALLOW":
        await persist_ml_decision(db, transaction_id, "AUTO_APPROVED", "Low risk — auto-approved")

    account_result = await db.execute(
        select(Account).where(Account.id == txn.account_id)
    )
    account = account_result.scalar_one()
    account.balance = account.balance - txn.amount

    txn.status = "committed"
    txn.committed_at = datetime.now(timezone.utc)

    if txn.beneficiary_id is None:
        ben = Beneficiary(
            user_id=txn.user_id,
            name=f"UPI: {txn.beneficiary_upi}",
            upi_id=txn.beneficiary_upi,
            verified=False,
            status="active",
        )
        db.add(ben)
        await db.flush()
        txn.beneficiary_id = ben.id

        ev = BeneficiaryEvent(
            user_id=txn.user_id,
            beneficiary_id=ben.id,
            event_type="added_via_transaction",
        )
        db.add(ev)

    await db.commit()

    return {
        "transaction_id": txn.id,
        "status": "committed",
        "amount": str(txn.amount),
        "beneficiary_upi": txn.beneficiary_upi,
        "committed_at": txn.committed_at.isoformat(),
        "balance_remaining": str(account.balance),
        "decision": assessment.decision,
    }
