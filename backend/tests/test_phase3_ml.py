"""
Phase 3 tests — ML-powered pre-transaction risk engine.

Scenarios:
1. Normal Rs500 to verified beneficiary → LOW → ALLOW
2. New beneficiary + unusually large amount → MEDIUM/HIGH
3. New device + new ben + account changes + large → HIGH
4. H.I.V.E. flagged recipient + large → HIGH/CRITICAL
5. Large legitimate to long-term verified beneficiary → NOT blocked solely by amount

Also tests risk_velocity and explainability output.
"""
import pytest
from decimal import Decimal
from datetime import datetime, timezone, timedelta

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import select

from app.database import Base
from app.models.tables import User
from app.models.financial import (
    Account, Device, Beneficiary, BehavioralProfile,
    Transaction, RiskSignalV2, AccountEvent,
)
from app.ml.risk_model import evaluate_with_ml
from app.services.transaction_service import preview_transaction

TEST_DB_URL = "sqlite+aiosqlite:///./test_phase3.db"


@pytest.fixture(scope="module")
async def engine():
    eng = create_async_engine(TEST_DB_URL, echo=False)
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest.fixture(scope="module")
async def seeded(engine):
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        # User A: normal user with history
        db.add(User(id="ml-A", name="Normal User", phone_number="+910000100001"))
        await db.flush()
        db.add(Account(id="acct-ml-A", user_id="ml-A", balance=Decimal("100000"), upi_id="normalml@oksbi"))
        db.add(Device(id="dev-ml-A", user_id="ml-A", device_fingerprint="fp-ml-A",
                       trusted=True, first_seen=datetime.now(timezone.utc) - timedelta(days=90)))
        db.add(Beneficiary(
            id="ben-ml-A-1", user_id="ml-A", name="Electric Co",
            upi_id="electric@oksbi", verified=True,
            added_at=datetime.now(timezone.utc) - timedelta(days=120),
        ))
        db.add(BehavioralProfile(
            user_id="ml-A", avg_transaction_amount=600, median_transaction_amount=500,
            max_transaction_amount=2000, typical_frequency_per_week=3, total_transactions=50,
            common_beneficiaries=["electric@oksbi", "grocery@paytm", "rent@ybl"],
        ))
        await db.flush()

        # User B: will send to new beneficiary (no H.I.V.E. signals)
        db.add(User(id="ml-B", name="New Ben User", phone_number="+910000100002"))
        await db.flush()
        db.add(Account(id="acct-ml-B", user_id="ml-B", balance=Decimal("200000"), upi_id="newbenml@oksbi"))
        db.add(Device(id="dev-ml-B", user_id="ml-B", device_fingerprint="fp-ml-B",
                       trusted=True, first_seen=datetime.now(timezone.utc) - timedelta(days=60)))
        db.add(BehavioralProfile(
            user_id="ml-B", avg_transaction_amount=800, median_transaction_amount=600,
            max_transaction_amount=3000, typical_frequency_per_week=2, total_transactions=30,
            common_beneficiaries=["shop@oksbi"],
        ))
        await db.flush()

        # User C: new device + account changes + new ben + large
        db.add(User(id="ml-C", name="Compromised User", phone_number="+910000100003"))
        await db.flush()
        db.add(Account(id="acct-ml-C", user_id="ml-C", balance=Decimal("200000"), upi_id="compml@oksbi"))
        db.add(Device(id="dev-ml-C", user_id="ml-C", device_fingerprint="fp-ml-C-new",
                       trusted=False, first_seen=datetime.now(timezone.utc) - timedelta(hours=1)))
        db.add(BehavioralProfile(
            user_id="ml-C", avg_transaction_amount=500, median_transaction_amount=400,
            max_transaction_amount=1500, typical_frequency_per_week=2, total_transactions=20,
            common_beneficiaries=["friend@oksbi"],
        ))
        db.add(AccountEvent(user_id="ml-C", event_type="password_change",
                            timestamp=datetime.now(timezone.utc) - timedelta(hours=3)))
        db.add(AccountEvent(user_id="ml-C", event_type="sim_swap",
                            timestamp=datetime.now(timezone.utc) - timedelta(hours=2)))
        db.add(AccountEvent(user_id="ml-C", event_type="email_change",
                            timestamp=datetime.now(timezone.utc) - timedelta(hours=1)))
        await db.flush()

        # User D: H.I.V.E.-flagged recipient
        db.add(User(id="ml-D", name="Scam Target", phone_number="+910000100004"))
        await db.flush()
        db.add(Account(id="acct-ml-D", user_id="ml-D", balance=Decimal("200000"), upi_id="targetml@oksbi"))
        db.add(Device(id="dev-ml-D", user_id="ml-D", device_fingerprint="fp-ml-D",
                       trusted=True, first_seen=datetime.now(timezone.utc) - timedelta(days=30)))
        db.add(BehavioralProfile(
            user_id="ml-D", avg_transaction_amount=600, median_transaction_amount=500,
            max_transaction_amount=2000, typical_frequency_per_week=2, total_transactions=25,
            common_beneficiaries=["shop@oksbi"],
        ))
        db.add(RiskSignalV2(
            source="hive", source_id="det-ml-test",
            entity_type="upi_id", entity_value="scammer-ml@ybl",
            severity="critical", scam_type="payment_scam",
            details={"confidence": 0.95},
            created_at=datetime.now(timezone.utc) - timedelta(hours=4),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=68),
        ))
        await db.flush()

        # User E: legitimate high-value user
        db.add(User(id="ml-E", name="Business User", phone_number="+910000100005"))
        await db.flush()
        db.add(Account(id="acct-ml-E", user_id="ml-E", balance=Decimal("500000"), upi_id="bizml@oksbi"))
        db.add(Device(id="dev-ml-E", user_id="ml-E", device_fingerprint="fp-ml-E",
                       trusted=True, first_seen=datetime.now(timezone.utc) - timedelta(days=180)))
        db.add(Beneficiary(
            id="ben-ml-E-1", user_id="ml-E", name="Supplier Corp",
            upi_id="supplier@oksbi", verified=True,
            added_at=datetime.now(timezone.utc) - timedelta(days=200),
        ))
        db.add(BehavioralProfile(
            user_id="ml-E", avg_transaction_amount=25000, median_transaction_amount=20000,
            max_transaction_amount=100000, typical_frequency_per_week=5, total_transactions=200,
            common_beneficiaries=["supplier@oksbi", "vendor@paytm", "office@ybl"],
        ))
        await db.flush()

        await db.commit()
    yield engine


@pytest.fixture
async def db(seeded):
    factory = async_sessionmaker(seeded, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


# ===========================================================================
# SCENARIO 1: Normal Rs500 → LOW → ALLOW
# ===========================================================================
@pytest.mark.asyncio
async def test_normal_payment_allow(db):
    result = await evaluate_with_ml(
        db=db, user_id="ml-A", beneficiary_upi="electric@oksbi",
        amount=Decimal("500"), device_id="dev-ml-A",
    )
    assert result["risk_score"] < 40
    assert result["risk_level"] == "LOW"
    assert result["decision"] == "ALLOW"
    assert result["model_version"] == "ml-v1"
    assert "risk_velocity" in result
    assert isinstance(result["reasons"], list)


# ===========================================================================
# SCENARIO 2: New beneficiary + unusually large → MEDIUM/HIGH
# ===========================================================================
@pytest.mark.asyncio
async def test_new_ben_large_amount_elevated(db):
    result = await evaluate_with_ml(
        db=db, user_id="ml-B", beneficiary_upi="unknown-new@ybl",
        amount=Decimal("50000"), device_id="dev-ml-B",
    )
    assert result["risk_score"] >= 40
    assert result["risk_level"] in ("MEDIUM", "HIGH", "CRITICAL")
    assert result["decision"] in ("VERIFY", "STRONG_VERIFY", "HOLD")
    assert any("beneficiary" in r.lower() or "amount" in r.lower() or "typical" in r.lower()
               for r in result["reasons"])


# ===========================================================================
# SCENARIO 3: New device + new ben + account changes + large → HIGH
# ===========================================================================
@pytest.mark.asyncio
async def test_account_takeover_high(db):
    result = await evaluate_with_ml(
        db=db, user_id="ml-C", beneficiary_upi="suspicion@ybl",
        amount=Decimal("40000"), device_id="dev-ml-C",
    )
    assert result["risk_score"] >= 60
    assert result["risk_level"] in ("HIGH", "CRITICAL")
    assert result["decision"] in ("STRONG_VERIFY", "HOLD")


# ===========================================================================
# SCENARIO 4: H.I.V.E. flagged recipient + large → HIGH/CRITICAL
# ===========================================================================
@pytest.mark.asyncio
async def test_hive_flagged_critical(db):
    result = await evaluate_with_ml(
        db=db, user_id="ml-D", beneficiary_upi="scammer-ml@ybl",
        amount=Decimal("50000"), device_id="dev-ml-D",
    )
    assert result["risk_score"] >= 70
    assert result["risk_level"] in ("HIGH", "CRITICAL")
    assert result["decision"] in ("STRONG_VERIFY", "HOLD")
    reasons_text = " ".join(result["reasons"]).lower()
    assert "hive" in reasons_text or "scam" in reasons_text or "recipient" in reasons_text, (
        f"Expected HIVE/scam mention in reasons: {result['reasons']}"
    )
    assert len(result["hive_signals_used"]) > 0
    assert result["risk_velocity"]["signal_count"] >= 1


# ===========================================================================
# SCENARIO 5: Large legitimate to long-term verified → NOT blocked
# ===========================================================================
@pytest.mark.asyncio
async def test_large_legit_not_blocked(db):
    """Rs50,000 to long-term verified beneficiary by high-value user → should NOT be HOLD."""
    result = await evaluate_with_ml(
        db=db, user_id="ml-E", beneficiary_upi="supplier@oksbi",
        amount=Decimal("50000"), device_id="dev-ml-E",
    )
    assert result["decision"] != "HOLD", (
        f"Legitimate large payment was incorrectly blocked. "
        f"Score: {result['risk_score']}, Reasons: {result['reasons']}"
    )
    assert result["risk_level"] in ("LOW", "MEDIUM")


# ===========================================================================
# SCENARIO 5b: Transaction preview lifecycle works with ML
# ===========================================================================
@pytest.mark.asyncio
async def test_preview_uses_ml_model(db):
    """preview_transaction should use ML model and return risk_velocity."""
    result = await preview_transaction(
        db=db, user_id="ml-A", beneficiary_upi="electric@oksbi",
        amount=Decimal("300"), device_id="dev-ml-A",
    )
    assert result["status"] == "evaluated"
    ev = result["risk_evaluation"]
    assert ev["model_version"] == "ml-v1"
    assert "risk_velocity" in ev
    assert ev["decision"] == "ALLOW"


# ===========================================================================
# Risk velocity test
# ===========================================================================
@pytest.mark.asyncio
async def test_risk_velocity_increases_with_signals(db):
    """User C has 3 account events + new ben — velocity should be elevated."""
    result = await evaluate_with_ml(
        db=db, user_id="ml-C", beneficiary_upi="suspicion@ybl",
        amount=Decimal("20000"), device_id="dev-ml-C",
    )
    vel = result["risk_velocity"]
    assert vel["velocity_score"] > 0
    assert vel["signal_count"] >= 3
    assert vel["trend"] in ("moderate_accumulation", "rapid_accumulation", "critical_surge")


# ===========================================================================
# Explainability test
# ===========================================================================
@pytest.mark.asyncio
async def test_reasons_are_human_readable(db):
    """Reasons should be complete English sentences, not feature names."""
    result = await evaluate_with_ml(
        db=db, user_id="ml-D", beneficiary_upi="scammer-ml@ybl",
        amount=Decimal("30000"), device_id="dev-ml-D",
    )
    for reason in result["reasons"]:
        assert len(reason) > 10, f"Reason too short: '{reason}'"
        assert "_" not in reason or "H.I.V.E." in reason, f"Feature name leaked into reason: '{reason}'"
