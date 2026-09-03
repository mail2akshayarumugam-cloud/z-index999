"""
Phase 2 tests — pre-transaction risk gate.

Scenarios:
1. NORMAL:     Rs500 to existing verified beneficiary          → ALLOW
2. SUSPICIOUS: Rs50,000 to new beneficiary                     → VERIFY
3. HIGH RISK:  Rs50,000 to H.I.V.E.-flagged beneficiary       → HOLD
               after unusual account events

Also verifies that transactions are NOT committed before the decision.
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
    Transaction, RiskSignalV2, AccountEvent, RiskAssessment,
)
from app.services.transaction_service import preview_transaction, commit_transaction
from app.ml.risk_model import evaluate_with_ml

TEST_DB_URL = "sqlite+aiosqlite:///./test_phase2.db"


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
async def seeded_engine(engine):
    """Seed all three test scenarios into the database."""
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as db:
        # --- User A: normal user with history ---
        db.add(User(id="user-A", name="Normal User", phone_number="+910000000001"))
        await db.flush()
        db.add(Account(id="acct-A", user_id="user-A", balance=Decimal("50000"), upi_id="normal@oksbi"))
        db.add(Device(id="dev-A", user_id="user-A", device_fingerprint="fp-A", trusted=True))
        db.add(Beneficiary(
            id="ben-A-1", user_id="user-A", name="Electricity Board",
            upi_id="electricity@oksbi", verified=True, added_at=datetime.now(timezone.utc) - timedelta(days=60),
        ))
        db.add(BehavioralProfile(
            user_id="user-A", avg_transaction_amount=500, median_transaction_amount=450,
            max_transaction_amount=1200, typical_frequency_per_week=3, total_transactions=20,
        ))
        await db.flush()

        # --- User B: will send to new beneficiary ---
        db.add(User(id="user-B", name="Suspicious User", phone_number="+910000000002"))
        await db.flush()
        db.add(Account(id="acct-B", user_id="user-B", balance=Decimal("100000"), upi_id="sususer@oksbi"))
        db.add(Device(id="dev-B", user_id="user-B", device_fingerprint="fp-B", trusted=True))
        db.add(BehavioralProfile(
            user_id="user-B", avg_transaction_amount=600, median_transaction_amount=500,
            max_transaction_amount=2000, typical_frequency_per_week=2, total_transactions=15,
        ))
        await db.flush()

        # --- User C: high risk — H.I.V.E. signals + account events ---
        db.add(User(id="user-C", name="High Risk User", phone_number="+910000000003"))
        await db.flush()
        db.add(Account(id="acct-C", user_id="user-C", balance=Decimal("100000"), upi_id="highrisk@oksbi"))
        db.add(Device(id="dev-C", user_id="user-C", device_fingerprint="fp-C", trusted=False))
        db.add(BehavioralProfile(
            user_id="user-C", avg_transaction_amount=500, median_transaction_amount=400,
            max_transaction_amount=1500, typical_frequency_per_week=2, total_transactions=10,
        ))

        # H.I.V.E. scam signal on the target UPI
        db.add(RiskSignalV2(
            source="hive", source_id="det-test-C",
            entity_type="upi_id", entity_value="scammer99@ybl",
            severity="critical", scam_type="payment_scam",
            details={"confidence": 0.94},
            created_at=datetime.now(timezone.utc) - timedelta(hours=2),
            expires_at=datetime.now(timezone.utc) + timedelta(hours=70),
        ))

        # Recent suspicious account events
        db.add(AccountEvent(
            user_id="user-C", event_type="password_change",
            timestamp=datetime.now(timezone.utc) - timedelta(hours=3),
        ))
        db.add(AccountEvent(
            user_id="user-C", event_type="sim_swap",
            timestamp=datetime.now(timezone.utc) - timedelta(hours=1),
        ))

        # UPI entities that tests pay to (needed for UPI validation)
        db.add(User(id="test-elec", name="Electricity Board"))
        db.add(Account(id="acct-test-elec", user_id="test-elec", balance=0, upi_id="electricity@oksbi"))
        db.add(User(id="test-unknown", name="Unknown Person"))
        db.add(Account(id="acct-test-unknown", user_id="test-unknown", balance=0, upi_id="unknownperson@ybl"))
        db.add(User(id="test-scammer", name="Scammer"))
        db.add(Account(id="acct-test-scammer", user_id="test-scammer", balance=0, upi_id="scammer99@ybl"))

        await db.commit()
    yield engine


@pytest.fixture
async def db(seeded_engine):
    factory = async_sessionmaker(seeded_engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        yield session


# ============================================================================
# SCENARIO 1: Normal — Rs500 to existing verified beneficiary → ALLOW
# ============================================================================

@pytest.mark.asyncio
async def test_normal_transaction_allow(db):
    """Rs500 to existing verified beneficiary should be ALLOW."""
    result = await preview_transaction(
        db=db, user_id="user-A", beneficiary_upi="electricity@oksbi",
        amount=Decimal("500"), device_id="dev-A",
    )
    assert result["status"] == "evaluated"
    assert result["is_new_beneficiary"] is False

    risk = result["risk_evaluation"]
    assert risk["decision"] == "ALLOW"
    assert risk["risk_level"] == "LOW"
    assert risk["risk_score"] < 40


@pytest.mark.asyncio
async def test_normal_transaction_commits(db):
    """Normal ALLOW transaction can be committed."""
    preview = await preview_transaction(
        db=db, user_id="user-A", beneficiary_upi="electricity@oksbi",
        amount=Decimal("300"), device_id="dev-A",
    )
    result = await commit_transaction(
        db=db, transaction_id=preview["transaction_id"], user_id="user-A",
    )
    assert result["status"] == "committed"
    assert result["decision"] == "ALLOW"


# ============================================================================
# SCENARIO 2: Suspicious — Rs50,000 to new beneficiary → VERIFY
# ============================================================================

@pytest.mark.asyncio
async def test_suspicious_new_beneficiary_verify(db):
    """Rs50,000 to unknown beneficiary should be VERIFY or higher."""
    result = await preview_transaction(
        db=db, user_id="user-B", beneficiary_upi="unknownperson@ybl",
        amount=Decimal("50000"), device_id="dev-B",
    )
    assert result["status"] == "evaluated"
    assert result["is_new_beneficiary"] is True

    risk = result["risk_evaluation"]
    assert risk["decision"] in ("VERIFY", "STRONG_VERIFY", "HOLD")
    assert risk["risk_score"] >= 40
    reasons_text = " ".join(risk["reasons"]).lower()
    assert "beneficiary" in reasons_text or "amount" in reasons_text or "typical" in reasons_text


# ============================================================================
# SCENARIO 3: High risk — Rs50,000 to HIVE-flagged UPI + account events → HOLD
# ============================================================================

@pytest.mark.asyncio
async def test_high_risk_hive_flagged_hold(db):
    """Rs50,000 to H.I.V.E.-flagged UPI + suspicious account events → HOLD."""
    result = await preview_transaction(
        db=db, user_id="user-C", beneficiary_upi="scammer99@ybl",
        amount=Decimal("50000"), device_id="dev-C",
    )
    assert result["status"] == "evaluated"

    risk = result["risk_evaluation"]
    assert risk["decision"] == "HOLD"
    assert risk["risk_level"] == "CRITICAL"
    assert risk["risk_score"] >= 80
    assert any("h.i.v.e." in r.lower() or "hive" in r.lower() for r in risk["reasons"])
    assert len(risk["hive_signals_used"]) > 0


@pytest.mark.asyncio
async def test_hold_blocks_without_override(db):
    """HOLD transaction without override_reason should be blocked."""
    preview = await preview_transaction(
        db=db, user_id="user-C", beneficiary_upi="scammer99@ybl",
        amount=Decimal("50000"), device_id="dev-C",
    )
    result = await commit_transaction(
        db=db, transaction_id=preview["transaction_id"], user_id="user-C",
    )
    assert result["status"] == "awaiting_authorization"
    assert result["decision"] == "HOLD"


@pytest.mark.asyncio
async def test_hold_allows_with_override(db):
    """HOLD transaction WITH override_reason should commit (manual approval)."""
    preview = await preview_transaction(
        db=db, user_id="user-C", beneficiary_upi="scammer99@ybl",
        amount=Decimal("10000"), device_id="dev-C",
    )
    result = await commit_transaction(
        db=db,
        transaction_id=preview["transaction_id"],
        user_id="user-C",
        override_reason="Verified by supervisor — known vendor",
    )
    assert result["status"] == "committed"


# ============================================================================
# INVARIANT: Transaction is never committed before the risk decision
# ============================================================================

@pytest.mark.asyncio
async def test_transaction_not_committed_before_decision(db):
    """After preview, the transaction MUST be 'evaluated', not 'committed'."""
    preview = await preview_transaction(
        db=db, user_id="user-A", beneficiary_upi="electricity@oksbi",
        amount=Decimal("100"), device_id="dev-A",
    )
    txn_result = await db.execute(
        select(Transaction).where(Transaction.id == preview["transaction_id"])
    )
    txn = txn_result.scalar_one()
    assert txn.status == "evaluated"
    assert txn.committed_at is None


@pytest.mark.asyncio
async def test_risk_evaluation_standalone(db):
    """Standalone risk evaluation without creating a transaction."""
    result = await evaluate_with_ml(
        db=db, user_id="user-C", beneficiary_upi="scammer99@ybl",
        amount=Decimal("50000"), device_id="dev-C",
    )
    assert result["risk_score"] >= 60
    assert result["decision"] in ("VERIFY", "STRONG_VERIFY", "HOLD")
    assert result["model_version"] in ("ml-v1", "rule-based-fallback")
