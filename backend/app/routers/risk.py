from decimal import Decimal
from typing import Optional
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.financial import RiskSignalV2
from app.ml.risk_model import evaluate_with_ml

router = APIRouter(prefix="/api/risk", tags=["risk"])


class EvaluateRequest(BaseModel):
    user_id: str
    beneficiary_upi: str
    amount: float = Field(gt=0)
    device_id: Optional[str] = None


@router.post("/evaluate")
async def evaluate_risk(
    request: EvaluateRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    ML-powered pre-transaction risk evaluation.

    Returns risk_score, risk_level, risk_velocity, decision, reasons[],
    hive_signals_used, and model_version.
    """
    result = await evaluate_with_ml(
        db=db,
        user_id=request.user_id,
        beneficiary_upi=request.beneficiary_upi,
        amount=Decimal(str(request.amount)),
        device_id=request.device_id,
    )
    result.pop("features_used", None)
    return result


@router.get("/signals/{user_id}")
async def get_hive_signals(
    user_id: str,
    hours: int = 72,
    db: AsyncSession = Depends(get_db),
):
    """Query recent H.I.V.E. risk signals for a user."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
    result = await db.execute(
        select(RiskSignalV2).where(
            RiskSignalV2.user_id == user_id,
            RiskSignalV2.created_at >= cutoff,
        ).order_by(RiskSignalV2.created_at.desc())
    )
    signals = result.scalars().all()
    return [
        {
            "id": s.id,
            "source": s.source,
            "entity_type": s.entity_type,
            "entity_value": s.entity_value,
            "severity": s.severity,
            "scam_type": s.scam_type,
            "details": s.details,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
        }
        for s in signals
    ]


@router.get("/signals/upi/{upi_id}")
async def check_upi_signals(
    upi_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Check if a specific UPI ID has been flagged by H.I.V.E."""
    cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
    result = await db.execute(
        select(RiskSignalV2).where(
            RiskSignalV2.entity_type == "upi_id",
            RiskSignalV2.entity_value == upi_id,
            RiskSignalV2.created_at >= cutoff,
        ).order_by(RiskSignalV2.created_at.desc())
    )
    signals = result.scalars().all()
    return {
        "upi_id": upi_id,
        "is_flagged": len(signals) > 0,
        "signal_count": len(signals),
        "signals": [
            {
                "id": s.id,
                "severity": s.severity,
                "scam_type": s.scam_type,
                "source": s.source,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in signals
        ],
    }


class ReportUpiRequest(BaseModel):
    upi_id: str
    user_id: str
    reason: str = "Reported by user"
    scam_type: Optional[str] = None


@router.post("/report-upi")
async def report_upi(request: ReportUpiRequest, db: AsyncSession = Depends(get_db)):
    signal = RiskSignalV2(
        source="user_report",
        source_id=f"report-{request.user_id}",
        user_id=request.user_id,
        entity_type="upi_id",
        entity_value=request.upi_id,
        severity="high",
        scam_type=request.scam_type or "user_reported",
        details={"reason": request.reason, "reported_by": request.user_id},
        created_at=datetime.now(timezone.utc),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
    )
    db.add(signal)
    await db.commit()
    return {"status": "reported", "upi_id": request.upi_id, "signal_id": signal.id}


@router.get("/intelligence/{entity_value}")
async def get_intelligence(
    entity_value: str,
    db: AsyncSession = Depends(get_db),
):
    from app.models.financial import ScamIntelligence
    result = await db.execute(
        select(ScamIntelligence)
        .where(ScamIntelligence.entity_value == entity_value)
        .order_by(ScamIntelligence.created_at.desc())
    )
    records = result.scalars().all()
    if not records:
        return {"entity": entity_value, "intelligence": [], "total_reports": 0}
    return {
        "entity": entity_value,
        "total_reports": len(records),
        "intelligence": [
            {
                "id": r.id,
                "entity_type": r.entity_type,
                "scammer_alias": r.scammer_alias,
                "impersonated_org": r.impersonated_org,
                "threat_type": r.threat_type,
                "urgency_deadline": r.urgency_deadline,
                "promised_returns": r.promised_returns,
                "account_numbers": r.account_numbers,
                "ifsc_codes": r.ifsc_codes,
                "tactics": r.tactics,
                "target_victim_profile": r.target_victim_profile,
                "scam_type": r.scam_type,
                "confidence": r.confidence,
                "message_snippet": r.message_snippet,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ],
    }
