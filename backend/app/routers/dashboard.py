from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, case, cast, Date, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.tables import Notification, ScamDetection
from app.models.financial import (
    Transaction, RiskAssessment, RiskSignalV2, DecisionLog,
)

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    six_months_ago = now - timedelta(days=180)

    # Transaction counts by status
    status_q = await db.execute(
        select(
            Transaction.status,
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total_amount"),
        ).group_by(Transaction.status)
    )
    status_rows = status_q.all()
    txn_by_status = {
        r.status: {"count": r.count, "total_amount": float(r.total_amount)}
        for r in status_rows
    }
    total_txns = sum(v["count"] for v in txn_by_status.values())

    # Risk level distribution from risk_assessments
    risk_q = await db.execute(
        select(
            RiskAssessment.risk_level,
            func.count(RiskAssessment.id).label("count"),
        ).group_by(RiskAssessment.risk_level)
    )
    risk_level_dist = {r.risk_level: r.count for r in risk_q.all()}

    # Decision distribution
    decision_q = await db.execute(
        select(
            RiskAssessment.decision,
            func.count(RiskAssessment.id).label("count"),
        ).group_by(RiskAssessment.decision)
    )
    decision_dist = {r.decision: r.count for r in decision_q.all()}

    # Average risk score
    avg_q = await db.execute(
        select(func.avg(RiskAssessment.risk_score))
    )
    avg_risk = avg_q.scalar() or 0

    # Transaction volume by day (last 180 days)
    vol_q = await db.execute(
        select(
            cast(Transaction.created_at, Date).label("day"),
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("total"),
        )
        .where(Transaction.created_at >= six_months_ago)
        .group_by(text("1"))
        .order_by(text("1"))
    )
    daily_volume = [
        {
            "date": r.day.isoformat() if r.day else None,
            "count": r.count,
            "amount": float(r.total),
        }
        for r in vol_q.all()
    ]

    # Fraud prevented (blocked + awaiting_auth + rejected)
    fraud_q = await db.execute(
        select(
            func.count(Transaction.id).label("count"),
            func.coalesce(func.sum(Transaction.amount), 0).label("amount"),
        ).where(
            Transaction.status.in_(["blocked", "awaiting_authorization", "rejected"])
        )
    )
    fraud_row = fraud_q.one()

    # Scam type distribution from risk signals
    scam_q = await db.execute(
        select(
            RiskSignalV2.scam_type,
            func.count(RiskSignalV2.id).label("count"),
        )
        .where(RiskSignalV2.scam_type.isnot(None))
        .group_by(RiskSignalV2.scam_type)
    )
    scam_type_dist = {r.scam_type: r.count for r in scam_q.all()}

    # Alert severity distribution
    alert_q = await db.execute(
        select(
            Notification.severity,
            func.count(Notification.id).label("count"),
        ).group_by(Notification.severity)
    )
    alert_severity = {r.severity: r.count for r in alert_q.all()}

    return {
        "total_transactions": total_txns,
        "txn_by_status": txn_by_status,
        "risk_level_distribution": risk_level_dist,
        "decision_distribution": decision_dist,
        "avg_risk_score": round(float(avg_risk), 1),
        "daily_volume": daily_volume,
        "fraud_prevented": {
            "count": fraud_row.count,
            "amount": float(fraud_row.amount),
        },
        "scam_type_distribution": scam_type_dist,
        "alert_severity": alert_severity,
    }
