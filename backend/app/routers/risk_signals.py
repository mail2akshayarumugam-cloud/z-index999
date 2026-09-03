from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.tables import BankRiskSignal
from app.routers.schemas import BankRiskSignalItem

router = APIRouter(prefix="/api/risk-signals", tags=["risk-signals"])


@router.get("/{user_id}", response_model=list[BankRiskSignalItem])
async def get_risk_signals(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all bank risk signals for a user, newest first."""
    result = await db.execute(
        select(BankRiskSignal)
        .where(BankRiskSignal.user_id == user_id)
        .order_by(BankRiskSignal.created_at.desc())
    )
    signals = result.scalars().all()
    return [
        BankRiskSignalItem(
            id=s.id,
            signal_type=s.signal_type,
            risk_score=s.risk_score,
            scam_type=s.scam_type,
            flagged_entities=s.flagged_entities,
            status=s.status,
            created_at=s.created_at.isoformat() if s.created_at else "",
            expires_at=s.expires_at.isoformat() if s.expires_at else None,
            detection_id=s.detection_id,
        )
        for s in signals
    ]
