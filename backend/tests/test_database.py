"""Tests for database model persistence."""
import pytest
from app.models.tables import User, Message, ScamDetection, ThreatEntity, Notification, BankRiskSignal


@pytest.mark.asyncio
async def test_create_user(db):
    user = User(id="test-user-1", name="Test User", phone_number="+919876543210")
    db.add(user)
    await db.flush()
    assert user.id == "test-user-1"
    assert user.created_at is not None


@pytest.mark.asyncio
async def test_create_message_and_detection(db):
    user = User(id="test-user-2", name="Test User 2")
    db.add(user)
    await db.flush()

    msg = Message(user_id=user.id, sender="unknown", content="Send money now!", source="whatsapp")
    db.add(msg)
    await db.flush()

    detection = ScamDetection(
        message_id=msg.id,
        is_scam=True,
        confidence=0.87,
        risk_level="high",
        scam_type="payment_scam",
        explanation="High-risk payment scam detected",
        key_indicators=["urgency", "payment request"],
    )
    db.add(detection)
    await db.flush()

    assert detection.id is not None
    assert detection.is_scam is True
    assert detection.confidence == 0.87


@pytest.mark.asyncio
async def test_create_threat_entity(db):
    user = User(id="test-user-3", name="Test User 3")
    db.add(user)
    await db.flush()

    msg = Message(user_id=user.id, content="Pay to scammer@ybl")
    db.add(msg)
    await db.flush()

    detection = ScamDetection(
        message_id=msg.id, is_scam=True, confidence=0.9, risk_level="high"
    )
    db.add(detection)
    await db.flush()

    entity = ThreatEntity(
        detection_id=detection.id, entity_type="upi_id", value="scammer@ybl"
    )
    db.add(entity)
    await db.flush()

    assert entity.entity_type == "upi_id"
    assert entity.value == "scammer@ybl"


@pytest.mark.asyncio
async def test_create_notification(db):
    user = User(id="test-user-4", name="Test User 4")
    db.add(user)
    await db.flush()

    msg = Message(user_id=user.id, content="You won a prize!")
    db.add(msg)
    await db.flush()

    detection = ScamDetection(
        message_id=msg.id, is_scam=True, confidence=0.75, risk_level="high"
    )
    db.add(detection)
    await db.flush()

    notif = Notification(
        user_id=user.id,
        detection_id=detection.id,
        title="Scam Detected",
        body="A reward scam was detected.",
        severity="high",
        recommended_action="Do not respond.",
    )
    db.add(notif)
    await db.flush()

    assert notif.id is not None
    assert notif.severity == "high"
    assert notif.is_read is False


@pytest.mark.asyncio
async def test_create_bank_risk_signal(db):
    user = User(id="test-user-5", name="Test User 5")
    db.add(user)
    await db.flush()

    msg = Message(user_id=user.id, content="Transfer ₹10000 to xyz@upi")
    db.add(msg)
    await db.flush()

    detection = ScamDetection(
        message_id=msg.id, is_scam=True, confidence=0.92, risk_level="critical"
    )
    db.add(detection)
    await db.flush()

    signal = BankRiskSignal(
        detection_id=detection.id,
        user_id=user.id,
        signal_type="scam_detected",
        risk_score=0.92,
        scam_type="payment_scam",
        flagged_entities={"upi_ids": ["xyz@upi"]},
        status="active",
    )
    db.add(signal)
    await db.flush()

    assert signal.signal_type == "scam_detected"
    assert signal.risk_score == 0.92
    assert signal.flagged_entities["upi_ids"] == ["xyz@upi"]
