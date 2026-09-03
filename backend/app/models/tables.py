import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, Text, DateTime, ForeignKey, JSON, Integer,
)
from sqlalchemy.orm import relationship

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=_uuid)
    phone_number = Column(String(20), unique=True, nullable=True)
    email = Column(String(120), unique=True, nullable=True)
    name = Column(String(100), nullable=True)
    password_hash = Column(String(200), nullable=True)
    upi_pin_hash = Column(String(200), nullable=True)
    security_question = Column(String(300), nullable=True)
    security_answer_hash = Column(String(200), nullable=True)
    role = Column(String(20), default="user")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    messages = relationship("Message", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Message(Base):
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    sender = Column(String(100), nullable=True)
    content = Column(Text, nullable=False)
    source = Column(String(50), default="whatsapp")
    received_at = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", back_populates="messages")
    detection = relationship("ScamDetection", back_populates="message", uselist=False)


class ScamDetection(Base):
    __tablename__ = "scam_detections"

    id = Column(String, primary_key=True, default=_uuid)
    message_id = Column(String, ForeignKey("messages.id"), nullable=False)
    is_scam = Column(Boolean, nullable=False)
    confidence = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    scam_type = Column(String(50), nullable=True)
    explanation = Column(Text, nullable=True)
    key_indicators = Column(JSON, nullable=True)
    raw_result = Column(JSON, nullable=True)
    detected_at = Column(DateTime(timezone=True), default=_utcnow)

    message = relationship("Message", back_populates="detection")
    entities = relationship("ThreatEntity", back_populates="detection")
    notification = relationship("Notification", back_populates="detection", uselist=False)
    risk_signal = relationship("BankRiskSignal", back_populates="detection", uselist=False)


class ThreatEntity(Base):
    __tablename__ = "threat_entities"

    id = Column(String, primary_key=True, default=_uuid)
    detection_id = Column(String, ForeignKey("scam_detections.id"), nullable=False)
    entity_type = Column(String(30), nullable=False)
    value = Column(String(500), nullable=False)
    confidence = Column(Float, default=1.0)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    detection = relationship("ScamDetection", back_populates="entities")


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    detection_id = Column(String, ForeignKey("scam_detections.id"), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    severity = Column(String(20), nullable=False)
    recommended_action = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", back_populates="notifications")
    detection = relationship("ScamDetection", back_populates="notification")


class BankRiskSignal(Base):
    __tablename__ = "bank_risk_signals"

    id = Column(String, primary_key=True, default=_uuid)
    detection_id = Column(String, ForeignKey("scam_detections.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    signal_type = Column(String(50), nullable=False)
    risk_score = Column(Float, nullable=False)
    scam_type = Column(String(50), nullable=True)
    flagged_entities = Column(JSON, nullable=True)
    status = Column(String(20), default="active")
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    detection = relationship("ScamDetection", back_populates="risk_signal")
