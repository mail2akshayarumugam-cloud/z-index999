"""
ML-powered pre-transaction risk engine (Model 2).

Loads the trained model and produces:
  - risk_score (0-100)
  - risk_level (LOW/MEDIUM/HIGH/CRITICAL)
  - decision (ALLOW/VERIFY/STRONG_VERIFY/HOLD)
  - risk_velocity (rate of recent risk signal accumulation)
  - reasons[] (human-readable explanations from feature importance)

Thresholds are configurable, NOT hard-coded into the ML model.
"""
import json
from pathlib import Path
from datetime import datetime, timezone, timedelta
from decimal import Decimal

import numpy as np
import joblib
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial import (
    Beneficiary, BehavioralProfile, RiskSignalV2,
    AccountEvent, Device, Transaction, RiskAssessment, DecisionLog,
)
from app.ml.dataset_generator import FEATURES

MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "models"
MODEL_VERSION = "ml-v1"

# Configurable decision thresholds
THRESHOLDS = {
    "LOW": (0, 39),
    "MEDIUM": (40, 69),
    "HIGH": (70, 79),
    "CRITICAL": (80, 100),
}

DECISIONS = {
    "LOW": "ALLOW",
    "MEDIUM": "VERIFY",
    "HIGH": "STRONG_VERIFY",
    "CRITICAL": "HOLD",
}

# Human-readable templates for top features
_REASON_TEMPLATES = {
    "hive_recipient_flagged": "Recipient is associated with a recent H.I.V.E. scam alert",
    "hive_signal_severity": "H.I.V.E. alert severity is {value} (scale 1-4)",
    "hive_hours_since_alert": "H.I.V.E. alert was issued {value:.0f} hours ago",
    "hive_scam_category_match": "Scam category matches the transaction pattern",
    "is_new_beneficiary": "Beneficiary was added recently (first transaction)",
    "beneficiary_age_days": "Beneficiary account is only {value:.0f} days old",
    "beneficiary_verified": "Beneficiary is not verified",
    "amount_to_avg_ratio": "Transaction is {value:.1f}x the user's typical amount",
    "amount_to_max_ratio": "Transaction is {value:.1f}x the user's historical max",
    "amount": "Transaction amount Rs{value:,.0f} is unusually large",
    "is_new_device": "Transaction originated from an unfamiliar device",
    "device_trusted": "Device is not in the user's trusted list",
    "recent_password_change": "Password was changed in the last 48 hours",
    "recent_sim_swap": "SIM swap detected in the last 48 hours",
    "recent_email_change": "Email was changed in the last 48 hours",
    "recent_pin_change": "PIN was changed in the last 48 hours",
    "account_events_48h": "{value:.0f} account changes in the last 48 hours",
    "recent_beneficiary_additions_24h": "{value:.0f} new beneficiaries added in the last 24 hours",
    "txn_frequency_24h": "{value:.0f} transactions in the last 24 hours (high velocity)",
    "txn_velocity_1h": "{value:.0f} transactions in the last hour (rapid burst)",
    "recipient_suspicious_neighbor_count": "Recipient has {value:.0f} connections to suspicious entities",
}

_model_cache = None


def _load_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
    model_path = MODEL_DIR / "risk_model.pkl"
    if not model_path.exists():
        return None
    _model_cache = joblib.load(model_path)
    return _model_cache


def _score_to_level(score: float) -> str:
    for level, (lo, hi) in THRESHOLDS.items():
        if lo <= score <= hi:
            return level
    return "CRITICAL" if score > 100 else "LOW"


def _level_to_decision(level: str) -> str:
    return DECISIONS.get(level, "VERIFY")


def _generate_reasons(
    feature_values: dict,
    feature_importances: dict,
    top_n: int = 6,
) -> list[str]:
    """Generate human-readable reasons from the features that contributed most."""
    scored = []
    for feat, imp in feature_importances.items():
        val = feature_values.get(feat, 0)
        is_risk = False
        if feat == "hive_recipient_flagged" and val >= 1:
            is_risk = True
        elif feat == "hive_signal_severity" and val >= 1:
            is_risk = True
        elif feat == "hive_hours_since_alert" and val >= 0:
            is_risk = True
        elif feat == "hive_scam_category_match" and val >= 1:
            is_risk = True
        elif feat == "is_new_beneficiary" and val >= 1:
            is_risk = True
        elif feat == "beneficiary_age_days" and val < 7:
            is_risk = True
        elif feat == "beneficiary_verified" and val == 0:
            is_risk = True
        elif feat == "amount_to_avg_ratio" and val > 3:
            is_risk = True
        elif feat == "amount_to_max_ratio" and val > 1.2:
            is_risk = True
        elif feat == "amount" and val > 10000:
            is_risk = True
        elif feat == "is_new_device" and val >= 1:
            is_risk = True
        elif feat == "device_trusted" and val == 0:
            is_risk = True
        elif feat in ("recent_password_change", "recent_sim_swap", "recent_email_change", "recent_pin_change") and val >= 1:
            is_risk = True
        elif feat == "account_events_48h" and val >= 2:
            is_risk = True
        elif feat == "recent_beneficiary_additions_24h" and val >= 2:
            is_risk = True
        elif feat == "txn_frequency_24h" and val >= 4:
            is_risk = True
        elif feat == "txn_velocity_1h" and val >= 2:
            is_risk = True
        elif feat == "recipient_suspicious_neighbor_count" and val >= 1:
            is_risk = True

        if is_risk:
            scored.append((feat, imp, val))

    # H.I.V.E. signals are always top-priority when present
    hive_feats = {"hive_recipient_flagged", "hive_signal_severity", "hive_scam_category_match"}
    priority = [(f, i, v) for f, i, v in scored if f in hive_feats]
    rest = [(f, i, v) for f, i, v in scored if f not in hive_feats]
    rest.sort(key=lambda x: x[1], reverse=True)
    ordered = priority + rest

    reasons = []
    for feat, imp, val in ordered[:top_n]:
        template = _REASON_TEMPLATES.get(feat)
        if template:
            try:
                reasons.append(template.format(value=val))
            except (KeyError, ValueError):
                reasons.append(template)
    return reasons


async def _extract_features(
    db: AsyncSession,
    user_id: str,
    beneficiary_upi: str,
    amount: Decimal,
    device_id: str | None = None,
) -> dict:
    """Extract the 30 features from database state for a given transaction."""
    features = {f: 0 for f in FEATURES}
    features["amount"] = float(amount)
    now = datetime.now(timezone.utc)

    # Behavioral profile
    result = await db.execute(
        select(BehavioralProfile).where(BehavioralProfile.user_id == user_id)
    )
    profile = result.scalar_one_or_none()
    if profile:
        avg = profile.avg_transaction_amount or 500
        med = profile.median_transaction_amount or 400
        mx = profile.max_transaction_amount or 1000
        features["user_avg_amount"] = avg
        features["user_median_amount"] = med
        features["user_max_amount"] = mx
        features["user_total_txns"] = profile.total_transactions or 0
        features["user_typical_ben_count"] = len(profile.common_beneficiaries or [])
        features["user_txn_freq_per_week"] = profile.typical_frequency_per_week or 0
        features["amount_to_avg_ratio"] = round(float(amount) / max(avg, 1), 2)
        features["amount_to_max_ratio"] = round(float(amount) / max(mx, 1), 2)
    else:
        features["user_avg_amount"] = 500
        features["user_max_amount"] = 1000
        features["amount_to_avg_ratio"] = round(float(amount) / 500, 2)
        features["amount_to_max_ratio"] = round(float(amount) / 1000, 2)

    # Beneficiary
    result = await db.execute(
        select(Beneficiary).where(
            Beneficiary.user_id == user_id,
            Beneficiary.upi_id == beneficiary_upi,
        )
    )
    ben = result.scalar_one_or_none()
    if ben is None:
        features["is_new_beneficiary"] = 1
        features["beneficiary_age_days"] = 0
        features["beneficiary_verified"] = 0
    else:
        features["is_new_beneficiary"] = 0
        if ben.added_at:
            added = ben.added_at if ben.added_at.tzinfo else ben.added_at.replace(tzinfo=timezone.utc)
            features["beneficiary_age_days"] = (now - added).days
        features["beneficiary_verified"] = 1 if ben.verified else 0

    # Time
    features["txn_hour"] = now.hour
    features["is_unusual_hour"] = 1 if 1 <= now.hour <= 5 else 0

    # Transaction velocity
    result = await db.execute(select(Transaction).where(Transaction.user_id == user_id))
    all_txns = result.scalars().all()
    cutoff_24h = now - timedelta(hours=24)
    cutoff_1h = now - timedelta(hours=1)
    recent_24h = 0
    recent_1h = 0
    last_txn_days = 999
    for t in all_txns:
        ts = t.created_at
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts:
            days_ago = (now - ts).days
            if days_ago < last_txn_days:
                last_txn_days = days_ago
            if ts >= cutoff_24h:
                recent_24h += 1
            if ts >= cutoff_1h:
                recent_1h += 1
    features["txn_frequency_24h"] = recent_24h
    features["txn_velocity_1h"] = recent_1h
    features["days_since_last_txn"] = min(last_txn_days, 30)

    # Device
    if device_id:
        result = await db.execute(select(Device).where(Device.id == device_id))
        device = result.scalar_one_or_none()
        if device is None:
            features["is_new_device"] = 1
            features["device_trusted"] = 0
        else:
            fs = device.first_seen
            if fs and not fs.tzinfo:
                fs = fs.replace(tzinfo=timezone.utc)
            features["is_new_device"] = 1 if fs and (now - fs).days < 2 else 0
            features["device_trusted"] = 1 if device.trusted else 0
    else:
        features["is_new_device"] = 1
        features["device_trusted"] = 0

    # Account events
    result = await db.execute(select(AccountEvent).where(AccountEvent.user_id == user_id))
    events = result.scalars().all()
    cutoff_48h = now - timedelta(hours=48)
    event_count = 0
    for ev in events:
        ts = ev.timestamp
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts and ts >= cutoff_48h:
            event_count += 1
            if ev.event_type == "password_change":
                features["recent_password_change"] = 1
            elif ev.event_type == "sim_swap":
                features["recent_sim_swap"] = 1
            elif ev.event_type == "email_change":
                features["recent_email_change"] = 1
            elif ev.event_type == "pin_change":
                features["recent_pin_change"] = 1
    features["account_events_48h"] = event_count

    # Recent beneficiary additions
    result = await db.execute(
        select(Beneficiary).where(Beneficiary.user_id == user_id)
    )
    all_bens = result.scalars().all()
    cutoff_ben = now - timedelta(hours=24)
    recent_bens = 0
    for b in all_bens:
        a = b.added_at
        if a and not a.tzinfo:
            a = a.replace(tzinfo=timezone.utc)
        if a and a >= cutoff_ben:
            recent_bens += 1
    features["recent_beneficiary_additions_24h"] = recent_bens

    # H.I.V.E. signals
    result = await db.execute(
        select(RiskSignalV2).where(
            RiskSignalV2.entity_type == "upi_id",
            RiskSignalV2.entity_value == beneficiary_upi,
        )
    )
    signals = result.scalars().all()
    cutoff_72h = now - timedelta(hours=72)
    hive_signals = []
    for s in signals:
        ts = s.created_at
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts and ts >= cutoff_72h:
            hive_signals.append(s)

    if hive_signals:
        features["hive_recipient_flagged"] = 1
        sev_map = {"low": 1, "medium": 2, "high": 3, "critical": 4}
        worst = max(hive_signals, key=lambda s: sev_map.get(s.severity, 0))
        features["hive_signal_severity"] = sev_map.get(worst.severity, 2)
        ts = worst.created_at
        if ts and not ts.tzinfo:
            ts = ts.replace(tzinfo=timezone.utc)
        features["hive_hours_since_alert"] = (now - ts).total_seconds() / 3600 if ts else -1
        features["hive_scam_category_match"] = 1 if worst.scam_type and "payment" in (worst.scam_type or "") else 0
    else:
        features["hive_hours_since_alert"] = -1

    # Network — count other signals linked to this UPI
    features["recipient_suspicious_neighbor_count"] = len(hive_signals)

    return features


def _compute_risk_velocity(
    hive_signals: list,
    account_events_48h: int,
    recent_ben_24h: int,
) -> dict:
    """
    Risk velocity: how rapidly risk signals have accumulated.
    Returns velocity score (0-100) and trend description.
    """
    signal_count = len(hive_signals) + account_events_48h + recent_ben_24h

    if signal_count == 0:
        return {"velocity_score": 0, "trend": "stable", "signal_count": 0}
    elif signal_count <= 2:
        return {"velocity_score": 25, "trend": "low_accumulation", "signal_count": signal_count}
    elif signal_count <= 4:
        return {"velocity_score": 55, "trend": "moderate_accumulation", "signal_count": signal_count}
    elif signal_count <= 6:
        return {"velocity_score": 75, "trend": "rapid_accumulation", "signal_count": signal_count}
    else:
        return {"velocity_score": 95, "trend": "critical_surge", "signal_count": signal_count}


async def evaluate_with_ml(
    db: AsyncSession,
    user_id: str,
    beneficiary_upi: str,
    amount: Decimal,
    device_id: str | None = None,
) -> dict:
    """Full ML-based pre-transaction risk evaluation."""
    payload = _load_model()

    features = await _extract_features(db, user_id, beneficiary_upi, amount, device_id)

    if payload is None:
        from app.services.risk_engine import evaluate_transaction_risk
        result = await evaluate_transaction_risk(db, user_id, beneficiary_upi, amount, device_id)
        result["model_version"] = "rule-based-fallback"
        result["risk_velocity"] = {"velocity_score": 0, "trend": "unknown", "signal_count": 0}
        return result

    model = payload["model"]
    scaler = payload.get("scaler")
    needs_scaler = payload.get("needs_scaler", False)

    feature_vector = np.array([[features[f] for f in FEATURES]])
    if needs_scaler and scaler:
        feature_vector = scaler.transform(feature_vector)

    proba = model.predict_proba(feature_vector)[0]
    fraud_proba = float(proba[1]) if len(proba) > 1 else float(proba[0])

    risk_score = round(fraud_proba * 100, 1)
    risk_level = _score_to_level(risk_score)
    decision = _level_to_decision(risk_level)

    # Feature importances for explainability
    schema_path = MODEL_DIR / "feature_schema.json"
    if schema_path.exists():
        with open(schema_path) as f:
            schema = json.load(f)
        importances = schema.get("feature_importance", {})
    elif hasattr(model, "feature_importances_"):
        importances = dict(zip(FEATURES, model.feature_importances_))
    else:
        importances = {f: 0 for f in FEATURES}

    reasons = _generate_reasons(features, importances)
    if not reasons:
        if risk_score < 40:
            reasons = ["No significant risk indicators detected"]
        else:
            reasons = ["Multiple minor risk factors combined"]

    # H.I.V.E. signals used
    hive_signals_used = []
    if features["hive_recipient_flagged"]:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=72)
        result = await db.execute(
            select(RiskSignalV2).where(
                RiskSignalV2.entity_type == "upi_id",
                RiskSignalV2.entity_value == beneficiary_upi,
            )
        )
        for s in result.scalars().all():
            ts = s.created_at
            if ts and not ts.tzinfo:
                ts = ts.replace(tzinfo=timezone.utc)
            if ts and ts >= cutoff:
                hive_signals_used.append({
                    "id": s.id,
                    "entity_type": s.entity_type,
                    "entity_value": s.entity_value,
                    "severity": s.severity,
                    "scam_type": s.scam_type,
                })

    velocity = _compute_risk_velocity(
        hive_signals_used,
        features["account_events_48h"],
        features["recent_beneficiary_additions_24h"],
    )

    if features["is_new_beneficiary"] and not features["beneficiary_verified"]:
        min_score = 50.0
        if features["beneficiary_age_days"] < 1:
            min_score = 55.0
        if features["amount_to_avg_ratio"] > 2:
            min_score = 65.0
        if risk_score < min_score:
            risk_score = min_score
            risk_level = _score_to_level(risk_score)
            decision = _level_to_decision(risk_level)
            if "New unverified beneficiary — elevated risk" not in reasons:
                reasons.insert(0, "New unverified beneficiary — elevated risk")

    if hive_signals_used:
        decision = "HOLD"
        risk_level = "CRITICAL"
        risk_score = max(risk_score, 90.0)
        if "H.I.V.E. flagged — transaction requires authority approval" not in reasons:
            reasons.insert(0, "H.I.V.E. flagged — transaction requires authority approval")

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "decision": decision,
        "risk_velocity": velocity,
        "reasons": reasons,
        "hive_signals_used": hive_signals_used,
        "model_version": MODEL_VERSION,
        "features_used": features,
    }


async def persist_ml_assessment(
    db: AsyncSession,
    transaction_id: str,
    evaluation: dict,
) -> RiskAssessment:
    assessment = RiskAssessment(
        transaction_id=transaction_id,
        risk_score=evaluation["risk_score"],
        risk_level=evaluation["risk_level"],
        decision=evaluation["decision"],
        reasons=evaluation["reasons"],
        hive_signals_used=evaluation.get("hive_signals_used"),
        model_version=evaluation["model_version"],
    )
    db.add(assessment)
    await db.flush()
    return assessment


async def persist_ml_decision(
    db: AsyncSession,
    transaction_id: str,
    decision: str,
    reason: str,
) -> DecisionLog:
    log = DecisionLog(
        transaction_id=transaction_id,
        decision=decision,
        reason=reason,
    )
    db.add(log)
    await db.flush()
    return log
