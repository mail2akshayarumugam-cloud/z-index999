"""Orchestrates the full analysis pipeline: H.I.V.E. → DB → Notification → Risk Signal."""
from sqlalchemy.ext.asyncio import AsyncSession

from app.hive.client import analyze_message, AnalysisResult
from app.models.tables import Message, ScamDetection, User
from app.services.notification_service import (
    create_notification,
    create_bank_risk_signal,
    store_threat_entities,
)
from app.services.hive_signal_bridge import bridge_hive_to_risk_signals


async def ensure_user(db: AsyncSession, user_id: str) -> User:
    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        user = User(id=user_id, name=f"User {user_id[:8]}")
        db.add(user)
        await db.flush()
    return user


async def run_analysis(
    db: AsyncSession,
    user_id: str,
    message_text: str,
    sender: str | None = None,
    source: str = "whatsapp",
) -> dict:
    """Run the full H.I.V.E. analysis pipeline and persist results."""
    await ensure_user(db, user_id)

    msg = Message(
        user_id=user_id,
        sender=sender,
        content=message_text,
        source=source,
    )
    db.add(msg)
    await db.flush()

    result: AnalysisResult = await analyze_message(message_text)

    detection = ScamDetection(
        message_id=msg.id,
        is_scam=result.is_scam,
        confidence=result.confidence,
        risk_level=result.risk_level,
        scam_type=result.scam_type,
        explanation=result.explanation,
        key_indicators=result.key_indicators,
        raw_result=result.raw_hive_response,
    )
    db.add(detection)
    await db.flush()

    await store_threat_entities(db, detection.id, result)

    notification = await create_notification(db, user_id, detection, result)

    risk_signal = await create_bank_risk_signal(db, user_id, detection, result)

    v2_signals = await bridge_hive_to_risk_signals(db, detection.id, user_id, result)

    await db.commit()

    return {
        "message_id": msg.id,
        "detection_id": detection.id,
        "is_scam": result.is_scam,
        "confidence": result.confidence,
        "scam_type": result.scam_type,
        "risk_level": result.risk_level,
        "urgency": result.urgency,
        "explanation": result.explanation,
        "key_indicators": result.key_indicators,
        "entities": result.entities.model_dump(),
        "notification": {
            "id": notification.id,
            "title": notification.title,
            "body": notification.body,
            "severity": notification.severity,
            "recommended_action": notification.recommended_action,
        },
        "risk_signal": {
            "id": risk_signal.id,
            "signal_type": risk_signal.signal_type,
            "risk_score": risk_signal.risk_score,
            "status": risk_signal.status,
        },
    }
