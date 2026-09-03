"""Authority dashboard endpoints — approve/reject high-risk transactions."""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import User
from app.models.financial import (
    Transaction, RiskAssessment, DecisionLog, Account, Beneficiary,
    BeneficiaryEvent, ScamIntelligence,
)

router = APIRouter(prefix="/api/authority", tags=["authority"])


async def _require_authority(user_id: str, db: AsyncSession):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or user.role != "authority":
        raise HTTPException(status_code=403, detail="Authority role required")
    return user


@router.get("/pending")
async def get_pending_transactions(
    authority_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _require_authority(authority_id, db)
    result = await db.execute(
        select(Transaction)
        .where(Transaction.status == "awaiting_authorization")
        .order_by(Transaction.created_at.desc())
    )
    txns = result.scalars().all()

    out = []
    for t in txns:
        ra_r = await db.execute(
            select(RiskAssessment).where(RiskAssessment.transaction_id == t.id)
        )
        ra = ra_r.scalar_one_or_none()

        user_r = await db.execute(select(User).where(User.id == t.user_id))
        sender = user_r.scalar_one_or_none()

        ben_r = await db.execute(
            select(Beneficiary).where(Beneficiary.id == t.beneficiary_id)
        ) if t.beneficiary_id else None
        ben = ben_r.scalar_one_or_none() if ben_r else None

        intel_r = await db.execute(
            select(ScamIntelligence)
            .where(ScamIntelligence.entity_value == t.beneficiary_upi)
            .order_by(ScamIntelligence.created_at.desc())
            .limit(1)
        )
        intel = intel_r.scalar_one_or_none()

        out.append({
            "transaction_id": t.id,
            "sender_id": t.user_id,
            "sender_name": sender.name if sender else t.user_id,
            "receiver_upi": t.beneficiary_upi,
            "receiver_name": ben.name if ben else None,
            "amount": str(t.amount),
            "description": t.description,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "risk_score": ra.risk_score if ra else None,
            "risk_level": ra.risk_level if ra else None,
            "decision": ra.decision if ra else None,
            "reasons": ra.reasons if ra else [],
            "hive_signals": ra.hive_signals_used if ra else [],
            "model_version": ra.model_version if ra else None,
            "intelligence": {
                "scammer_alias": intel.scammer_alias,
                "impersonated_org": intel.impersonated_org,
                "threat_type": intel.threat_type,
                "urgency_deadline": intel.urgency_deadline,
                "promised_returns": intel.promised_returns,
                "account_numbers": intel.account_numbers,
                "tactics": intel.tactics,
                "target_victim_profile": intel.target_victim_profile,
                "message_snippet": intel.message_snippet,
            } if intel else None,
        })
    return out


class AuthorityActionRequest(BaseModel):
    authority_id: str
    reason: Optional[str] = None


@router.post("/{transaction_id}/approve")
async def approve_transaction(
    transaction_id: str,
    request: AuthorityActionRequest,
    db: AsyncSession = Depends(get_db),
):
    authority = await _require_authority(request.authority_id, db)

    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != "awaiting_authorization":
        raise HTTPException(status_code=400, detail=f"Transaction is '{txn.status}', not awaiting authorization")

    log = DecisionLog(
        transaction_id=transaction_id,
        decision="AUTHORITY_APPROVED",
        reason=request.reason or "Approved by authority",
        acted_by=authority.name,
    )
    db.add(log)

    acct_r = await db.execute(select(Account).where(Account.id == txn.account_id))
    account = acct_r.scalar_one()
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
        db.add(BeneficiaryEvent(
            user_id=txn.user_id,
            beneficiary_id=ben.id,
            event_type="added_via_authority_approval",
        ))

    await db.commit()

    return {
        "transaction_id": txn.id,
        "status": "committed",
        "decision": "AUTHORITY_APPROVED",
        "approved_by": authority.name,
        "amount": str(txn.amount),
        "balance_remaining": str(account.balance),
        "committed_at": txn.committed_at.isoformat(),
    }


@router.post("/{transaction_id}/reject")
async def reject_transaction(
    transaction_id: str,
    request: AuthorityActionRequest,
    db: AsyncSession = Depends(get_db),
):
    authority = await _require_authority(request.authority_id, db)

    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    txn = result.scalar_one_or_none()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.status != "awaiting_authorization":
        raise HTTPException(status_code=400, detail=f"Transaction is '{txn.status}', not awaiting authorization")

    log = DecisionLog(
        transaction_id=transaction_id,
        decision="AUTHORITY_REJECTED",
        reason=request.reason or "Rejected by authority",
        acted_by=authority.name,
    )
    db.add(log)

    txn.status = "rejected"
    await db.commit()

    return {
        "transaction_id": txn.id,
        "status": "rejected",
        "decision": "AUTHORITY_REJECTED",
        "rejected_by": authority.name,
    }
