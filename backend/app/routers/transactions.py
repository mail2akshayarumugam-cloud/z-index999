from decimal import Decimal
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.financial import Account, Transaction
from app.services.transaction_service import preview_transaction, commit_transaction

DAILY_LIMIT = 50000

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.get("/account/{user_id}")
async def get_account(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Account).where(Account.user_id == user_id).limit(1)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return {
        "id": account.id,
        "user_id": account.user_id,
        "balance": str(account.balance),
        "upi_id": account.upi_id,
        "account_type": account.account_type,
    }


@router.get("/daily-spending/{user_id}")
async def get_daily_spending(user_id: str, db: AsyncSession = Depends(get_db)):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.coalesce(func.sum(Transaction.amount), 0))
        .where(
            Transaction.user_id == user_id,
            Transaction.status == "committed",
            Transaction.committed_at >= today_start,
        )
    )
    spent = float(result.scalar() or 0)
    return {
        "spent_today": round(spent, 2),
        "daily_limit": DAILY_LIMIT,
        "remaining": round(max(DAILY_LIMIT - spent, 0), 2),
        "percentage": round(min(spent / DAILY_LIMIT * 100, 100), 1),
    }


class PreviewRequest(BaseModel):
    user_id: str
    beneficiary_upi: str
    amount: float = Field(gt=0)
    description: Optional[str] = None
    device_id: Optional[str] = None
    ip_address: Optional[str] = None
    location: Optional[str] = None


class CommitRequest(BaseModel):
    transaction_id: str
    user_id: str
    override_reason: Optional[str] = None


@router.get("/history/{user_id}")
async def get_transaction_history(
    user_id: str,
    limit: int = 30,
    db: AsyncSession = Depends(get_db),
):
    from app.models.financial import Transaction, RiskAssessment
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == user_id)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    txns = result.scalars().all()
    out = []
    for t in txns:
        ra_result = await db.execute(
            select(RiskAssessment).where(RiskAssessment.transaction_id == t.id)
        )
        ra = ra_result.scalar_one_or_none()
        out.append({
            "id": t.id,
            "beneficiary_upi": t.beneficiary_upi,
            "amount": str(t.amount),
            "description": t.description,
            "status": t.status,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "committed_at": t.committed_at.isoformat() if t.committed_at else None,
            "risk_level": ra.risk_level if ra else None,
            "risk_score": ra.risk_score if ra else None,
            "decision": ra.decision if ra else None,
        })
    return out


@router.get("/beneficiaries/{user_id}")
async def get_beneficiaries(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    from app.models.financial import Beneficiary
    result = await db.execute(
        select(Beneficiary)
        .where(Beneficiary.user_id == user_id)
        .order_by(Beneficiary.added_at.desc())
    )
    bens = result.scalars().all()
    return [
        {
            "id": b.id,
            "name": b.name,
            "upi_id": b.upi_id,
            "verified": b.verified,
            "added_at": b.added_at.isoformat() if b.added_at else None,
        }
        for b in bens
    ]


@router.post("/preview")
async def transaction_preview(
    request: PreviewRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Preview a transaction — creates a pending attempt and runs risk evaluation.
    Does NOT commit the payment.
    """
    try:
        result = await preview_transaction(
            db=db,
            user_id=request.user_id,
            beneficiary_upi=request.beneficiary_upi,
            amount=Decimal(str(request.amount)),
            description=request.description,
            device_id=request.device_id,
            ip_address=request.ip_address,
            location=request.location,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/commit")
async def transaction_commit(
    request: CommitRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Commit a previewed transaction — only succeeds if risk decision allows it.
    HOLD decisions require override_reason (manual approval).
    """
    try:
        result = await commit_transaction(
            db=db,
            transaction_id=request.transaction_id,
            user_id=request.user_id,
            override_reason=request.override_reason,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
