"""
Model 2 — Rule-based pre-transaction risk evaluation engine.

Checks multiple risk dimensions before any payment is committed:
  1. H.I.V.E. scam signals on beneficiary UPI / phone / URL
  2. Beneficiary trust (new vs verified, age)
  3. Amount anomaly vs user behavioral profile
  4. Recent suspicious account events (password change, SIM swap, etc.)
  5. Device trust
  6. Time-of-day anomaly

Returns: risk_score (0-100), risk_level, decision (ALLOW/VERIFY/HOLD), reasons[]
"""
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial import (
    Beneficiary,
    BehavioralProfile,
    RiskSignalV2,
    AccountEvent,
    Device,
    Transaction,
    RiskAssessment,
    DecisionLog,
)

MODEL_VERSION = "rule-based-v1"


def _level_and_decision(score: float) -> tuple[str, str]:
    if score >= 80:
        return "CRITICAL", "HOLD"
    if score >= 60:
        return "HIGH", "VERIFY"
    if score >= 40:
        return "MEDIUM", "VERIFY"
    return "LOW", "ALLOW"


async def _check_hive_signals(
    db: AsyncSession,
    beneficiary_upi: str,
) -> tuple[float, list[str], list[dict]]:
    """Check if H.I.V.E. has flagged this beneficiary UPI (or related entities)."""
    score = 0.0
    reasons: list[str] = []
    signals_used: list[dict] = []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=72)

    result = await db.execute(
        select(RiskSignalV2).where(
            RiskSignalV2.entity_type == "upi_id",
            RiskSignalV2.entity_value == beneficiary_upi,
        )
    )
    all_signals = result.scalars().all()
    upi_signals = []
    for s in all_signals:
        ts = s.created_at
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts and ts >= cutoff:
            upi_signals.append(s)

    if upi_signals:
        worst = max(upi_signals, key=lambda s: {"low": 1, "medium": 2, "high": 3, "critical": 4}.get(s.severity, 0))
        severity_scores = {"low": 15, "medium": 30, "high": 50, "critical": 70}
        score += severity_scores.get(worst.severity, 20)
        reasons.append(
            f"H.I.V.E. scam signal: beneficiary UPI '{beneficiary_upi}' flagged as "
            f"{worst.scam_type or 'suspicious'} (severity: {worst.severity})"
        )
        for s in upi_signals:
            signals_used.append({
                "id": s.id,
                "entity_type": s.entity_type,
                "entity_value": s.entity_value,
                "severity": s.severity,
                "scam_type": s.scam_type,
            })

    return score, reasons, signals_used


async def _check_beneficiary_trust(
    db: AsyncSession,
    user_id: str,
    beneficiary_upi: str,
) -> tuple[float, list[str], str | None]:
    """Check beneficiary familiarity."""
    score = 0.0
    reasons: list[str] = []
    beneficiary_id = None

    result = await db.execute(
        select(Beneficiary).where(
            Beneficiary.user_id == user_id,
            Beneficiary.upi_id == beneficiary_upi,
        )
    )
    ben = result.scalar_one_or_none()

    if ben is None:
        score += 25
        reasons.append("New beneficiary — never transacted before")
    else:
        beneficiary_id = ben.id
        if not ben.verified:
            score += 15
            reasons.append("Beneficiary exists but is unverified")
        if ben.added_at:
            added = ben.added_at if ben.added_at.tzinfo else ben.added_at.replace(tzinfo=timezone.utc)
            age = (datetime.now(timezone.utc) - added).days
        else:
            age = 0
        if age < 1:
            score += 10
            reasons.append("Beneficiary added within the last 24 hours")

    return score, reasons, beneficiary_id


async def _check_amount_anomaly(
    db: AsyncSession,
    user_id: str,
    amount: Decimal,
) -> tuple[float, list[str]]:
    """Compare transaction amount against user's behavioral profile."""
    score = 0.0
    reasons: list[str] = []

    result = await db.execute(
        select(BehavioralProfile).where(BehavioralProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()

    if profile is None:
        if float(amount) > 5000:
            score += 15
            reasons.append(f"No transaction history — amount Rs{amount} is above default threshold")
        return score, reasons

    avg = profile.avg_transaction_amount or 0
    max_amt = profile.max_transaction_amount or 0

    if avg > 0 and float(amount) > avg * 5:
        score += 30
        reasons.append(
            f"Transaction amount Rs{amount} is {float(amount)/avg:.1f}x the user's "
            f"average (Rs{avg:.0f})"
        )
    elif avg > 0 and float(amount) > avg * 3:
        score += 15
        reasons.append(
            f"Transaction amount Rs{amount} is {float(amount)/avg:.1f}x the user's average"
        )

    if max_amt > 0 and float(amount) > max_amt * 1.5:
        score += 10
        reasons.append(f"Amount exceeds 1.5x user's historical max (Rs{max_amt:.0f})")

    return score, reasons


async def _check_account_events(
    db: AsyncSession,
    user_id: str,
) -> tuple[float, list[str]]:
    """Check for recent suspicious account events."""
    score = 0.0
    reasons: list[str] = []

    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    result = await db.execute(
        select(AccountEvent).where(AccountEvent.user_id == user_id)
    )
    all_events = result.scalars().all()

    suspicious_types = {
        "password_change": 15,
        "sim_swap": 25,
        "email_change": 15,
        "phone_change": 20,
        "pin_change": 10,
        "recovery_attempt": 20,
    }

    for ev in all_events:
        ts = ev.timestamp
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts and ts < cutoff:
            continue
        if ev.event_type in suspicious_types:
            score += suspicious_types[ev.event_type]
            reasons.append(
                f"Recent account event: {ev.event_type.replace('_', ' ')} "
                f"({ts.strftime('%Y-%m-%d %H:%M') if ts else 'unknown time'})"
            )

    return score, reasons


async def _check_device_trust(
    db: AsyncSession,
    device_id: str | None,
) -> tuple[float, list[str]]:
    """Check if payment is from a trusted device."""
    if not device_id:
        return 10, ["Device information missing"]

    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if device is None:
        return 15, ["Unknown device"]
    if not device.trusted:
        return 10, [f"Untrusted device: {device.device_name or device.device_fingerprint}"]
    return 0, []


def _check_time_anomaly() -> tuple[float, list[str]]:
    """Flag transactions at unusual hours."""
    hour = datetime.now(timezone.utc).hour
    if 1 <= hour <= 5:
        return 10, [f"Transaction initiated at unusual hour ({hour}:00 UTC)"]
    return 0, []


async def evaluate_transaction_risk(
    db: AsyncSession,
    user_id: str,
    beneficiary_upi: str,
    amount: Decimal,
    device_id: str | None = None,
) -> dict:
    """
    Full pre-transaction risk evaluation.

    Returns dict with risk_score, risk_level, decision, reasons, hive_signals_used.
    """
    total_score = 0.0
    all_reasons: list[str] = []
    hive_signals: list[dict] = []

    hive_score, hive_reasons, hive_sigs = await _check_hive_signals(db, beneficiary_upi)
    total_score += hive_score
    all_reasons.extend(hive_reasons)
    hive_signals.extend(hive_sigs)

    ben_score, ben_reasons, _ = await _check_beneficiary_trust(db, user_id, beneficiary_upi)
    total_score += ben_score
    all_reasons.extend(ben_reasons)

    amt_score, amt_reasons = await _check_amount_anomaly(db, user_id, amount)
    total_score += amt_score
    all_reasons.extend(amt_reasons)

    acct_score, acct_reasons = await _check_account_events(db, user_id)
    total_score += acct_score
    all_reasons.extend(acct_reasons)

    dev_score, dev_reasons = await _check_device_trust(db, device_id)
    total_score += dev_score
    all_reasons.extend(dev_reasons)

    time_score, time_reasons = _check_time_anomaly()
    total_score += time_score
    all_reasons.extend(time_reasons)

    total_score = min(total_score, 100)
    risk_level, decision = _level_and_decision(total_score)

    if not all_reasons:
        all_reasons.append("No risk indicators detected")

    return {
        "risk_score": round(total_score, 1),
        "risk_level": risk_level,
        "decision": decision,
        "reasons": all_reasons,
        "hive_signals_used": hive_signals,
        "model_version": MODEL_VERSION,
    }


async def persist_assessment(
    db: AsyncSession,
    transaction_id: str,
    evaluation: dict,
) -> RiskAssessment:
    """Store the risk assessment result in the database."""
    assessment = RiskAssessment(
        transaction_id=transaction_id,
        risk_score=evaluation["risk_score"],
        risk_level=evaluation["risk_level"],
        decision=evaluation["decision"],
        reasons=evaluation["reasons"],
        hive_signals_used=evaluation["hive_signals_used"],
        model_version=evaluation["model_version"],
    )
    db.add(assessment)
    await db.flush()
    return assessment


async def persist_decision(
    db: AsyncSession,
    transaction_id: str,
    decision: str,
    reason: str,
) -> DecisionLog:
    """Store an audit decision log entry."""
    log = DecisionLog(
        transaction_id=transaction_id,
        decision=decision,
        reason=reason,
    )
    db.add(log)
    await db.flush()
    return log
