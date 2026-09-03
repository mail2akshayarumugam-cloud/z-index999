# Phase 2 — Financial Data Layer & Pre-Transaction Risk Gate

## ER / Database Diagram

```
users (Phase 1)
 ├── accounts           (1:N)
 ├── devices            (1:N)
 ├── beneficiaries      (1:N)
 ├── transactions       (1:N)
 ├── login_events       (1:N)
 ├── account_events     (1:N)
 ├── beneficiary_events (1:N)
 └── behavioral_profiles (1:1)

transactions
 ├── transaction_attempts  (1:N)
 ├── risk_assessments      (1:1)  ← Model 2 output
 └── decision_logs         (1:1)  ← audit trail

risk_signals_v2  ← H.I.V.E. → Model 2 bridge
 (entity_type: upi_id | phone | url)
```

### Table Summary (18 total)

| Table | Phase | Purpose |
|-------|-------|---------|
| users | 1 | User accounts (extended with email) |
| messages | 1 | Incoming messages for H.I.V.E. analysis |
| scam_detections | 1 | H.I.V.E. detection results |
| threat_entities | 1 | Extracted scam entities |
| notifications | 1 | User notifications |
| bank_risk_signals | 1 | Phase 1 risk signals |
| **accounts** | **2** | **Simulated bank accounts with balance** |
| **devices** | **2** | **User devices with trust status** |
| **beneficiaries** | **2** | **Payment recipients with verification** |
| **transactions** | **2** | **UPI transactions (pending→evaluated→committed/blocked)** |
| **transaction_attempts** | **2** | **Per-attempt metadata (device, IP, location)** |
| **login_events** | **2** | **Login audit trail** |
| **account_events** | **2** | **Account changes (password, SIM, email, PIN)** |
| **beneficiary_events** | **2** | **Beneficiary lifecycle events** |
| **behavioral_profiles** | **2** | **User transaction statistics for anomaly detection** |
| **risk_signals_v2** | **2** | **H.I.V.E. → Model 2 signal bridge** |
| **risk_assessments** | **2** | **Model 2 risk evaluation per transaction** |
| **decision_logs** | **2** | **ALLOW/VERIFY/HOLD audit trail** |

## API Endpoints

### Transaction Flow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/transactions/preview` | Create pending txn + risk evaluation (NO commit) |
| POST | `/api/transactions/commit` | Commit only if risk allows (HOLD requires override) |

### Risk Engine (Model 2)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/risk/evaluate` | Standalone risk evaluation (no txn created) |
| GET | `/api/risk/signals/{user_id}` | Recent H.I.V.E. signals for a user |
| GET | `/api/risk/signals/upi/{upi_id}` | Check if a UPI is H.I.V.E.-flagged |

### Phase 1 (unchanged)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/hive/analyze` | H.I.V.E. scam detection |
| POST | `/api/notifications` | Create notification |
| GET | `/api/notifications/{user_id}` | List notifications |
| GET | `/api/risk-signals/{user_id}` | Phase 1 risk signals |
| GET | `/api/health` | Health check |

## Sample Request/Response

### Transaction Preview (Normal)
```json
POST /api/transactions/preview
{
  "user_id": "user-001",
  "beneficiary_upi": "electricity@oksbi",
  "amount": 500,
  "device_id": "dev-user-001-1"
}

Response:
{
  "transaction_id": "fd03e936-...",
  "status": "evaluated",
  "amount": "500.0",
  "beneficiary_upi": "electricity@oksbi",
  "beneficiary_name": "Electricity Board",
  "is_new_beneficiary": false,
  "risk_evaluation": {
    "risk_score": 0.0,
    "risk_level": "LOW",
    "decision": "ALLOW",
    "reasons": ["No risk indicators detected"],
    "hive_signals_used": [],
    "model_version": "rule-based-v1"
  }
}
```

### Transaction Preview (High Risk — H.I.V.E.-flagged)
```json
POST /api/transactions/preview
{
  "user_id": "user-008",
  "beneficiary_upi": "scammer99@ybl",
  "amount": 25000,
  "device_id": "dev-user-008-2"
}

Response:
{
  "transaction_id": "681de927-...",
  "status": "evaluated",
  "risk_evaluation": {
    "risk_score": 100,
    "risk_level": "CRITICAL",
    "decision": "HOLD",
    "reasons": [
      "H.I.V.E. scam signal: beneficiary UPI 'scammer99@ybl' flagged as payment_scam (severity: high)",
      "Beneficiary exists but is unverified",
      "Beneficiary added within the last 24 hours",
      "Transaction amount Rs25000 is 43.5x the user's average (Rs575)",
      "Amount exceeds 1.5x user's historical max (Rs1200)",
      "Recent account event: password change",
      "Recent account event: sim swap",
      "Untrusted device"
    ],
    "hive_signals_used": [{
      "entity_type": "upi_id",
      "entity_value": "scammer99@ybl",
      "severity": "high",
      "scam_type": "payment_scam"
    }],
    "model_version": "rule-based-v1"
  }
}
```

### Transaction Commit (HOLD → blocked)
```json
POST /api/transactions/commit
{ "transaction_id": "681de927-...", "user_id": "user-008" }

Response:
{
  "transaction_id": "681de927-...",
  "status": "blocked",
  "decision": "HOLD",
  "message": "Transaction blocked by risk engine. Provide override_reason for manual approval."
}
```

## Transaction Lifecycle

```
User initiates payment
        ↓
POST /api/transactions/preview
        ↓
┌─────────────────────────────┐
│  1. Create Transaction      │  status = "pending"
│  2. Create Attempt          │  (device, IP, location)
│  3. Run Risk Evaluation     │  6 checks below
│  4. Store RiskAssessment    │
│  5. Update status           │  status = "evaluated"
└─────────────────────────────┘
        ↓
   Risk Decision
        ↓
  ┌─────┼──────┐
  ↓     ↓      ↓
ALLOW VERIFY  HOLD
  ↓     ↓      ↓
POST /api/transactions/commit
  ↓     ↓      ↓
auto  user   blocked
commit verify (needs override_reason)
  ↓     ↓      ↓
committed  committed  blocked
```

### Risk Evaluation Checks (6 dimensions)

1. **H.I.V.E. signals** — Is the beneficiary UPI flagged by H.I.V.E.? (up to +70)
2. **Beneficiary trust** — New/unverified/recently added? (up to +35)
3. **Amount anomaly** — vs behavioral profile avg/max? (up to +40)
4. **Account events** — Recent password/SIM/email/PIN change? (up to +60)
5. **Device trust** — Trusted/untrusted/unknown? (up to +15)
6. **Time-of-day** — Unusual hours (1-5 UTC)? (up to +10)

Score 0-100 → LOW (<40) / MEDIUM (40-59) / HIGH (60-79) / CRITICAL (80+)

## Seed Data

Run: `python -m app.seed`

Creates:
- 10 users (Aarav, Priya, Rohan, Sneha, Vikram, Ananya, Karthik, Meera, Arjun, Divya)
- 10 savings accounts (Rs10,000–Rs55,000)
- 20 devices (2 per user: trusted Android + untrusted browser)
- 30 legitimate beneficiaries (Electricity Board, Grocery Mart, Rent)
- 9 suspicious beneficiaries (scammer99@ybl, fakeprize@axl, kycfraud@oksbi)
- 80 committed transactions (normal history)
- 10 behavioral profiles (avg Rs575, max Rs1,200)
- 50 login events
- 5 H.I.V.E. risk signals (3 UPI, 1 phone, 1 URL)
- 4 suspicious account events (password_change, sim_swap, email_change, pin_change)

## Tests (27 total — all passing)

### Phase 1 (19 tests)
- H.I.V.E. client: 8 tests (legitimate, scam types, entity extraction)
- Database persistence: 5 tests (all 6 Phase 1 tables)
- API endpoints: 6 tests (health, analyze, notifications, risk signals)

### Phase 2 (8 tests)
- `test_normal_transaction_allow` — Rs500 to verified beneficiary → ALLOW
- `test_normal_transaction_commits` — ALLOW can be committed
- `test_suspicious_new_beneficiary_verify` — Rs50,000 to unknown UPI → VERIFY
- `test_high_risk_hive_flagged_hold` — Rs50,000 to H.I.V.E.-flagged + account events → HOLD
- `test_hold_blocks_without_override` — HOLD blocks without override_reason
- `test_hold_allows_with_override` — HOLD commits with override_reason
- `test_transaction_not_committed_before_decision` — invariant: never committed pre-evaluation
- `test_risk_evaluation_standalone` — standalone risk check without transaction
