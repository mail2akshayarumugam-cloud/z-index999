# Financial Guardian — Complete System Documentation

> All monetary values, user data, and transactions are SIMULATED.
> No real UPI integration, real money, or real financial credentials.

---

## 1. Complete Architecture

```
                    WhatsApp / SMS Simulator
                            |
                     +------v------+
                     |  H.I.V.E.   |  Model 1 — Scam Detection
                     | (200+ rules |  Heuristics + ML ensemble
                     |  + ML)      |  Preprocessing + Entity Extraction
                     +------+------+
                            |
                    Scam detected?
                     /           \
                   NO            YES
                                  |
                    +-------------v--------------+
                    | 1. Notify user              |
                    | 2. Create bank risk signal  |
                    | 3. Store threat entities    |
                    | 4. Bridge to Model 2        |
                    +-------------+--------------+
                                  |
                          DATABASE (PostgreSQL)
                          18 tables, 30+ features
                                  |
                    User attempts UPI payment
                                  |
                     +------------v-----------+
                     | PRE-TRANSACTION GATE   |
                     | (NEVER commit first)   |
                     +------------+-----------+
                                  |
                     +------------v-----------+
                     |   RISK MODEL 2 (ML)    |
                     | RandomForest, 30 feat  |
                     | + Risk Velocity        |
                     | + Explainability       |
                     +------------+-----------+
                                  |
                          RISK LEVEL
                    /      |        |       \
                ALLOW   VERIFY   STRONG    HOLD
                  |       |     VERIFY      |
               commit   OTP/     video    blocked
                       PIN      KYC     (manual)
```

## 2. Data Flow

```
Message Text
  -> PreprocessingService.preprocess()
    -> TextNormalizer (leetspeak, zero-width, unicode)
    -> EntityExtractor (UPI, phone, URL, amounts)
    -> LanguageDetector
  -> RiskEngine.assess_risk() / ML classifier
  -> AnalysisResult {is_scam, confidence, scam_type, entities}
  -> Database: messages, scam_detections, threat_entities
  -> NotificationService -> notifications table
  -> HiveSignalBridge -> risk_signals_v2 table (Model 2 input)

Transaction Preview
  -> transactions table (status=pending)
  -> transaction_attempts table
  -> ML Feature Extraction (30 features from 5 categories)
  -> RandomForest predict_proba() -> risk_score 0-100
  -> Decision Policy (configurable thresholds)
  -> risk_assessments table
  -> transactions.status = "evaluated"
  -> NEVER committed before evaluation

Transaction Commit
  -> Check risk_assessments.decision
  -> ALLOW: auto-commit, deduct balance
  -> VERIFY: commit after user confirms
  -> HOLD: block, require manual override
  -> decision_logs table (audit trail)
```

## 3. API Flow

| Method | Endpoint | Purpose |
|--------|----------|---------|
| **Demo** |
| GET | `/api/demo/scenarios` | List 5 demo scenarios |
| POST | `/api/demo/run/{key}` | Execute full E2E scenario |
| GET | `/api/demo/metrics` | Aggregate dashboard metrics |
| GET | `/api/demo/audit-trail` | Unified event audit trail |
| **H.I.V.E. (Model 1)** |
| POST | `/api/hive/analyze` | Scan message for scam |
| **Transactions** |
| POST | `/api/transactions/preview` | Create pending txn + risk eval |
| POST | `/api/transactions/commit` | Commit if decision allows |
| **Risk (Model 2)** |
| POST | `/api/risk/evaluate` | Standalone ML risk evaluation |
| GET | `/api/risk/signals/{user_id}` | User's H.I.V.E. signals |
| GET | `/api/risk/signals/upi/{upi}` | Check UPI flagged status |
| **Notifications** |
| GET | `/api/notifications/{user_id}` | User notifications |
| POST | `/api/notifications` | Create manual notification |
| **System** |
| GET | `/api/health` | Health check |

## 4. ML Flow

```
Training Pipeline:
  dataset_generator.py -> data/risk_training.csv (5000 samples, 75/25 split)
  train_model.py -> compare LogReg, RF, XGBoost
  -> Save best: models/risk_model.pkl + feature_schema.json + model_metadata.json

Inference Pipeline:
  Transaction -> _extract_features() from live DB state
  -> 30 features across 5 categories:
     A. Transaction (amount, ratios, velocity, frequency)
     B. Behavioral (avg/median/max, typical patterns)
     C. Account/Device (new device, trust, recent events)
     D. H.I.V.E. Intelligence (flagged, severity, recency)
     E. Network (suspicious neighbor count)
  -> RandomForest.predict_proba() -> fraud probability
  -> * 100 -> risk_score (0-100)
  -> Decision Policy (configurable thresholds, not in model)
  -> _generate_reasons() from feature importance
  -> _compute_risk_velocity() from signal accumulation rate

Model Metrics (RandomForest):
  Precision: 1.0000 | Recall: 1.0000 | F1: 1.0000 | AUC: 1.0000
  (on synthetic data — real-world would differ)
```

## 5. H.I.V.E. Flow

```
Input: Raw message text
  |
  v
PreprocessingService:
  - Normalize (leetspeak, zero-width chars, unicode variants)
  - Extract entities (UPI IDs, phone numbers, URLs, amounts)
  - Detect language
  |
  v
Heuristic Analysis (200+ indicators):
  - Urgency keywords ("urgent", "immediately", "expire")
  - Payment keywords ("send money", "transfer", "verify")
  - Reward keywords ("winner", "prize", "congratulations")
  - Impersonation ("bank manager", "government", "official")
  - Verification ("KYC", "confirm", "authenticate")
  - Obfuscation (leetspeak, inserted spaces, zero-width)
  |
  v
Risk Engine (score 0-1):
  - Weighted signal aggregation
  - Threshold: LOW/MEDIUM/HIGH/CRITICAL
  |
  v
Output: AnalysisResult
  {is_scam, confidence, scam_type, entities, reasons, explanation}
  |
  v
Side Effects:
  - Store: messages, scam_detections, threat_entities
  - Create: notification (user alert)
  - Create: bank_risk_signals (Phase 1 signal)
  - Bridge: risk_signals_v2 (Model 2 input)
```

## 6. Database Diagram

```
users ─────────┬── accounts
  |            ├── devices
  |            ├── beneficiaries
  |            ├── transactions ──┬── transaction_attempts
  |            |                  ├── risk_assessments
  |            |                  └── decision_logs
  |            ├── login_events
  |            ├── account_events
  |            ├── beneficiary_events
  |            └── behavioral_profiles (1:1)
  |
  ├── messages ── scam_detections ──┬── threat_entities
  |                                 ├── notifications
  |                                 └── bank_risk_signals
  |
  └── risk_signals_v2 (H.I.V.E. -> Model 2 bridge)

18 tables total across 3 phases.
```

## 7. Frontend Page Map

| Route | Page | Purpose |
|-------|------|---------|
| `/` | **Demo Mode** | Scenario selector, auto-run, timeline, risk breakdown |
| `/home` | **Wallet Home** | Balance, quick actions, security status, alerts |
| `/send` | **Send Money** | UPI form, demo scenarios, beneficiaries |
| `/review` | **Transaction Review** | Security analysis, risk result, decision UI |
| `/alerts` | **H.I.V.E. Alert Center** | Message scanner, notifications, signal bridge |
| `/timeline` | **Security Timeline** | Visual attack-to-protection chronological flow |
| `/dashboard` | **Bank Ops Dashboard** | Flagged UPIs, txn simulator, audit trail |

## 8. Demo Scenarios

| # | Scenario | H.I.V.E. | Expected | Actual |
|---|----------|----------|----------|--------|
| A | Normal Payment (Rs1,500 to verified) | - | LOW / ALLOW | ALLOW (0.0) |
| B | H.I.V.E. Scam -> Payment (Rs5,000 to flagged UPI) | Scam=True 99% | CRITICAL / HOLD | HOLD (97.5) |
| C | Account Takeover (new device + SIM swap + Rs35,000) | - | HIGH/CRITICAL / HOLD | HOLD (100.0) |
| D | New Beneficiary + Unusual (Rs12,000 to unknown) | - | MEDIUM / VERIFY | VERIFY (65.0) |
| E | High-Risk Network (scam msg + network UPI + Rs5,000) | Scam=True | CRITICAL / HOLD | HOLD (95.5) |

## 9. Commands to Run Entire System

```bash
# Step 1: Database setup (one time)
# Ensure PostgreSQL is running on port 5432
# Credentials: postgres / akshay2006

# Step 2: Seed database
cd C:\Users\mail2\OneDrive\Desktop\HACKATHON\backend
pip install -r requirements.txt
python -m app.seed

# Step 3: Start backend (port 8001)
cd C:\Users\mail2\OneDrive\Desktop\HACKATHON\backend
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Step 4: Start frontend (port 5174)
cd C:\Users\mail2\OneDrive\Desktop\HACKATHON\frontend
npm install
npm run dev

# Step 5: Open browser
# http://localhost:5174
# Demo Mode is the default landing page
```

To reset and reseed:
```bash
# PowerShell
$env:PGPASSWORD = 'akshay2006'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "DROP DATABASE IF EXISTS scam_shield_db;"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE scam_shield_db;"
cd C:\Users\mail2\OneDrive\Desktop\HACKATHON\backend
python -m app.seed
```

To retrain ML model:
```bash
cd C:\Users\mail2\OneDrive\Desktop\HACKATHON\backend
python -m app.ml.dataset_generator
python -m app.ml.train_model
```

## 10. Test Results

### Backend Tests: 35/35 PASSED

| Suite | Tests | Status |
|-------|-------|--------|
| Phase 1: H.I.V.E. client | 8 | PASS |
| Phase 1: Database | 5 | PASS |
| Phase 1: API endpoints | 6 | PASS |
| Phase 2: Transaction gate | 8 | PASS |
| Phase 3: ML risk engine | 8 | PASS |

### Demo Scenarios: 5/5 PASSED

All scenarios execute the complete pipeline:
H.I.V.E. scan -> notification -> risk signal -> transaction preview -> ML evaluation -> decision

### Frontend Build: 0 errors, 32 modules

### API Proxy: All endpoints tested through Vite proxy (port 5174 -> 8001)
