"""Phase 2 — Financial / UPI simulation models for Model 2 risk engine."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Boolean, Text, DateTime, ForeignKey, JSON, Integer, Numeric,
)
from sqlalchemy.orm import relationship
from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _uuid():
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Accounts
# ---------------------------------------------------------------------------
class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    balance = Column(Numeric(12, 2), default=10000.00)
    account_type = Column(String(30), default="savings")
    upi_id = Column(String(100), unique=True, nullable=True)
    card_number = Column(String(19), nullable=True)
    card_expiry = Column(String(5), nullable=True)
    card_network = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", backref="accounts")
    transactions = relationship("Transaction", back_populates="account", foreign_keys="Transaction.account_id")


# ---------------------------------------------------------------------------
# Devices
# ---------------------------------------------------------------------------
class Device(Base):
    __tablename__ = "devices"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    device_fingerprint = Column(String(200), nullable=False)
    device_name = Column(String(100), nullable=True)
    platform = Column(String(30), nullable=True)
    first_seen = Column(DateTime(timezone=True), default=_utcnow)
    last_seen = Column(DateTime(timezone=True), default=_utcnow)
    trusted = Column(Boolean, default=False)

    user = relationship("User", backref="devices")


# ---------------------------------------------------------------------------
# Beneficiaries
# ---------------------------------------------------------------------------
class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    name = Column(String(100), nullable=False)
    upi_id = Column(String(100), nullable=False)
    added_at = Column(DateTime(timezone=True), default=_utcnow)
    verified = Column(Boolean, default=False)
    status = Column(String(20), default="active")

    user = relationship("User", backref="beneficiaries")


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=False)
    beneficiary_id = Column(String, ForeignKey("beneficiaries.id"), nullable=True)
    beneficiary_upi = Column(String(100), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(5), default="INR")
    description = Column(String(200), nullable=True)
    status = Column(String(30), default="pending")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    committed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="transactions")
    account = relationship("Account", back_populates="transactions")
    attempts = relationship("TransactionAttempt", back_populates="transaction")
    risk_assessment = relationship("RiskAssessment", back_populates="transaction", uselist=False)
    decision_log = relationship("DecisionLog", back_populates="transaction", uselist=False)


class TransactionAttempt(Base):
    __tablename__ = "transaction_attempts"

    id = Column(String, primary_key=True, default=_uuid)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=True)
    ip_address = Column(String(45), nullable=True)
    location = Column(String(100), nullable=True)
    attempt_time = Column(DateTime(timezone=True), default=_utcnow)
    source = Column(String(30), default="app")

    transaction = relationship("Transaction", back_populates="attempts")


# ---------------------------------------------------------------------------
# Event logs
# ---------------------------------------------------------------------------
class LoginEvent(Base):
    __tablename__ = "login_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    device_id = Column(String, ForeignKey("devices.id"), nullable=True)
    event_type = Column(String(30), nullable=False)
    ip_address = Column(String(45), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", backref="login_events")


class AccountEvent(Base):
    __tablename__ = "account_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", backref="account_events")


class BeneficiaryEvent(Base):
    __tablename__ = "beneficiary_events"

    id = Column(String, primary_key=True, default=_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    beneficiary_id = Column(String, ForeignKey("beneficiaries.id"), nullable=False)
    event_type = Column(String(50), nullable=False)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", backref="beneficiary_events")


# ---------------------------------------------------------------------------
# Behavioral profile (aggregated stats for Model 2)
# ---------------------------------------------------------------------------
class BehavioralProfile(Base):
    __tablename__ = "behavioral_profiles"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)
    avg_transaction_amount = Column(Float, default=0.0)
    median_transaction_amount = Column(Float, default=0.0)
    max_transaction_amount = Column(Float, default=0.0)
    common_transaction_hours = Column(JSON, nullable=True)
    common_beneficiaries = Column(JSON, nullable=True)
    typical_frequency_per_week = Column(Float, default=0.0)
    total_transactions = Column(Integer, default=0)
    last_updated = Column(DateTime(timezone=True), default=_utcnow)

    user = relationship("User", backref="behavioral_profile")


# ---------------------------------------------------------------------------
# Scam intelligence (structured scammer profiles from H.I.V.E.)
# ---------------------------------------------------------------------------
class ScamIntelligence(Base):
    __tablename__ = "scam_intelligence"

    id = Column(String, primary_key=True, default=_uuid)
    detection_id = Column(String, nullable=True)
    entity_type = Column(String(30), nullable=False)
    entity_value = Column(String(500), nullable=False)
    scammer_alias = Column(String(200), nullable=True)
    impersonated_org = Column(String(200), nullable=True)
    threat_type = Column(String(50), nullable=True)
    urgency_deadline = Column(String(100), nullable=True)
    promised_returns = Column(String(100), nullable=True)
    account_numbers = Column(JSON, nullable=True)
    ifsc_codes = Column(JSON, nullable=True)
    tactics = Column(JSON, nullable=True)
    target_victim_profile = Column(String(50), nullable=True)
    scam_type = Column(String(50), nullable=True)
    confidence = Column(Float, nullable=True)
    message_snippet = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)


# ---------------------------------------------------------------------------
# Risk signals (from H.I.V.E. and other sources, consumed by Model 2)
# ---------------------------------------------------------------------------
class RiskSignalV2(Base):
    __tablename__ = "risk_signals_v2"

    id = Column(String, primary_key=True, default=_uuid)
    source = Column(String(30), nullable=False)
    source_id = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    entity_type = Column(String(30), nullable=False)
    entity_value = Column(String(500), nullable=False)
    severity = Column(String(20), nullable=False)
    scam_type = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    expires_at = Column(DateTime(timezone=True), nullable=True)


# ---------------------------------------------------------------------------
# Risk assessments (Model 2 output per transaction)
# ---------------------------------------------------------------------------
class RiskAssessment(Base):
    __tablename__ = "risk_assessments"

    id = Column(String, primary_key=True, default=_uuid)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)
    decision = Column(String(20), nullable=False)
    reasons = Column(JSON, nullable=True)
    hive_signals_used = Column(JSON, nullable=True)
    model_version = Column(String(30), default="rule-based-v1")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    transaction = relationship("Transaction", back_populates="risk_assessment")


# ---------------------------------------------------------------------------
# Decision logs (audit trail)
# ---------------------------------------------------------------------------
class DecisionLog(Base):
    __tablename__ = "decision_logs"

    id = Column(String, primary_key=True, default=_uuid)
    transaction_id = Column(String, ForeignKey("transactions.id"), nullable=False)
    decision = Column(String(50), nullable=False)
    reason = Column(Text, nullable=True)
    acted_by = Column(String(100), default="system")
    created_at = Column(DateTime(timezone=True), default=_utcnow)

    transaction = relationship("Transaction", back_populates="decision_log")
