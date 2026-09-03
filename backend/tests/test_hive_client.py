"""Tests for the H.I.V.E. analysis wrapper (local fallback)."""
import pytest
from app.hive.client import _local_analyze


def test_legitimate_message():
    result = _local_analyze("Hey, are we still meeting for coffee at 3pm?")
    assert result.is_scam is False
    assert result.confidence < 0.4
    assert result.risk_level == "low"


def test_scam_message_urgency_payment():
    result = _local_analyze(
        "URGENT! Your SBI account will be blocked. Pay ₹5,000 immediately "
        "to verify@paytm. Act now or lose access!"
    )
    assert result.is_scam is True
    assert result.confidence >= 0.4
    assert result.risk_level in ("medium", "high", "critical")
    assert len(result.reasons) > 0
    assert any("urgency" in r.lower() or "payment" in r.lower() for r in result.reasons)


def test_scam_message_reward():
    result = _local_analyze(
        "Congratulations! You have WON ₹10,00,000 in the Lucky Draw! "
        "Send ₹500 processing fee to claim@upi. Hurry, limited time!"
    )
    assert result.is_scam is True
    assert result.confidence >= 0.5
    assert result.entities.amounts
    assert result.entities.upi_ids


def test_scam_message_impersonation():
    result = _local_analyze(
        "This is your bank manager from HDFC. Your KYC is expired. "
        "Please verify your account immediately at http://hdfc-verify.tk"
    )
    assert result.is_scam is True
    assert any("impersonation" in r.lower() or "verification" in r.lower() for r in result.reasons)


def test_entity_extraction_upi():
    result = _local_analyze("Send money to scammer@ybl for processing")
    assert "scammer@ybl" in result.entities.upi_ids


def test_entity_extraction_phone():
    result = _local_analyze("Call me urgently at 9876543210 to claim your prize")
    assert "9876543210" in result.entities.phone_numbers


def test_entity_extraction_url():
    result = _local_analyze("Click here: http://malicious-site.com/verify")
    assert any("malicious-site.com" in u for u in result.entities.urls)


def test_empty_message_is_safe():
    result = _local_analyze("")
    assert result.is_scam is False
    assert result.confidence == 0.0
