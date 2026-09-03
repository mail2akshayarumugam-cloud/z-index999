"""Notification + Bank Risk Signal creation service."""
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tables import (
    Notification,
    BankRiskSignal,
    ThreatEntity,
    ScamDetection,
)
from app.hive.client import AnalysisResult


_SEVERITY_MAP = {
    "critical": "critical",
    "high": "high",
    "medium": "warning",
    "low": "info",
}

_ACTION_MAP = {
    "critical": (
        "Do NOT send money or share OTPs. Block this sender immediately "
        "and report to your bank's fraud helpline."
    ),
    "high": (
        "Avoid responding to this message. Verify the sender's identity "
        "through an independent channel before taking action."
    ),
    "medium": (
        "Exercise caution. Independently verify any claims made in this "
        "message before responding."
    ),
    "low": "No immediate action needed. Message appears legitimate.",
}


def _build_notification_title(result: AnalysisResult) -> str:
    scam_label = result.scam_type or "Suspicious Activity"
    scam_label = scam_label.replace("_", " ").title()
    return f"⚠ {scam_label} Detected" if result.is_scam else "Message Scanned — No Threat"


def _build_notification_body(result: AnalysisResult) -> str:
    if not result.is_scam:
        return "This message was analyzed and no scam indicators were found."

    parts = [result.explanation]

    ent = result.entities
    entity_summaries = []
    if ent.upi_ids:
        entity_summaries.append(f"UPI IDs: {', '.join(ent.upi_ids[:3])}")
    if ent.phone_numbers:
        entity_summaries.append(f"Phone numbers: {', '.join(ent.phone_numbers[:3])}")
    if ent.urls:
        entity_summaries.append(f"URLs: {', '.join(ent.urls[:2])}")
    if ent.amounts:
        entity_summaries.append(f"Amounts: {', '.join(ent.amounts[:3])}")

    if entity_summaries:
        parts.append("Extracted entities: " + "; ".join(entity_summaries) + ".")

    return " ".join(parts)


async def create_notification(
    db: AsyncSession,
    user_id: str,
    detection: ScamDetection,
    result: AnalysisResult,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        detection_id=detection.id,
        title=_build_notification_title(result),
        body=_build_notification_body(result),
        severity=_SEVERITY_MAP.get(result.risk_level, "info"),
        recommended_action=_ACTION_MAP.get(result.risk_level, _ACTION_MAP["low"]),
    )
    db.add(notification)
    await db.flush()
    return notification


async def create_bank_risk_signal(
    db: AsyncSession,
    user_id: str,
    detection: ScamDetection,
    result: AnalysisResult,
) -> BankRiskSignal:
    flagged = {}
    ent = result.entities
    if ent.upi_ids:
        flagged["upi_ids"] = ent.upi_ids
    if ent.phone_numbers:
        flagged["phone_numbers"] = ent.phone_numbers
    if ent.urls:
        flagged["urls"] = ent.urls
    if ent.amounts:
        flagged["amounts"] = ent.amounts

    signal = BankRiskSignal(
        detection_id=detection.id,
        user_id=user_id,
        signal_type="scam_detected" if result.is_scam else "clean",
        risk_score=result.confidence,
        scam_type=result.scam_type,
        flagged_entities=flagged if flagged else None,
        status="active" if result.is_scam else "inactive",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=72) if result.is_scam else None,
    )
    db.add(signal)
    await db.flush()
    return signal


async def store_threat_entities(
    db: AsyncSession,
    detection_id: str,
    result: AnalysisResult,
) -> list[ThreatEntity]:
    entities_to_store = []
    ent = result.entities
    for upi in ent.upi_ids:
        entities_to_store.append(ThreatEntity(detection_id=detection_id, entity_type="upi_id", value=upi))
    for phone in ent.phone_numbers:
        entities_to_store.append(ThreatEntity(detection_id=detection_id, entity_type="phone", value=phone))
    for url in ent.urls:
        entities_to_store.append(ThreatEntity(detection_id=detection_id, entity_type="url", value=url))
    for amount in ent.amounts:
        entities_to_store.append(ThreatEntity(detection_id=detection_id, entity_type="amount", value=amount))

    for e in entities_to_store:
        db.add(e)
    if entities_to_store:
        await db.flush()
    return entities_to_store
