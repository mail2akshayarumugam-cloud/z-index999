# Scam Shield — Project Structure

## Overview

```
HACKATHON/
├── backend/                    # Python FastAPI backend (port 8001)
│   ├── app/                    # Application package
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI app entry, CORS, lifespan (starts H.I.V.E. sync)
│   │   ├── config.py           # Environment config (DB URL, ports)
│   │   ├── database.py         # SQLAlchemy async engine + session factory
│   │   ├── seed.py             # Full DB seeder: 3 users + authority + merchants + 128 txns
│   │   │
│   │   ├── hive/               # H.I.V.E. integration layer
│   │   │   ├── __init__.py
│   │   │   └── client.py       # H.I.V.E. scam analyzer + intelligence extraction
│   │   │
│   │   ├── ml/                 # Machine Learning (Model 2)
│   │   │   ├── __init__.py
│   │   │   ├── risk_model.py   # RandomForest inference, H.I.V.E. override, new-ben floor
│   │   │   ├── train_model.py  # Model training script
│   │   │   └── dataset_generator.py  # Synthetic training data generator
│   │   │
│   │   ├── models/             # SQLAlchemy ORM models
│   │   │   ├── __init__.py
│   │   │   ├── tables.py       # All 19 database tables
│   │   │   └── financial.py    # Financial data models
│   │   │
│   │   ├── routers/            # FastAPI route handlers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py         # Login, PIN verify, security Q, profile
│   │   │   ├── authority.py    # CFO approve/reject with role check
│   │   │   ├── transactions.py # Preview + commit, balance, history, beneficiaries
│   │   │   ├── risk.py         # ML risk evaluation, signal lookup, UPI report
│   │   │   ├── risk_signals.py # Risk signal CRUD
│   │   │   ├── email_monitor.py # Email scam scanning
│   │   │   ├── hive.py         # H.I.V.E. analysis endpoint
│   │   │   ├── notifications.py # User notification feed
│   │   │   ├── demo.py         # Demo orchestration endpoints
│   │   │   └── schemas.py      # Pydantic request/response models
│   │   │
│   │   └── services/           # Business logic layer
│   │       ├── __init__.py
│   │       ├── transaction_service.py  # Phone→UPI, UPI validation, preview+commit
│   │       ├── hive_sync.py            # Background asyncio sync from hive_db (every 10s)
│   │       ├── hive_signal_bridge.py   # Detection → risk_signals + intelligence
│   │       ├── risk_engine.py          # Risk calculation engine
│   │       ├── notification_service.py # Notification management
│   │       ├── analysis_service.py     # Analysis utilities
│   │       └── demo_orchestrator.py    # Demo flow orchestration
│   │
│   ├── models/                 # ML model artifacts
│   │   ├── risk_model.pkl      # Trained RandomForest model (30 features)
│   │   ├── model_metadata.json # Model version + training metadata
│   │   └── feature_schema.json # Feature names and types
│   │
│   ├── data/
│   │   └── risk_training.csv   # Training dataset
│   │
│   ├── tests/                  # Test suite (35 tests)
│   │   ├── __init__.py
│   │   ├── conftest.py         # Pytest fixtures (async DB, test client)
│   │   ├── test_api.py         # API endpoint tests
│   │   ├── test_database.py    # Database operation tests
│   │   ├── test_hive_client.py # H.I.V.E. client tests
│   │   ├── test_phase2.py      # Phase 2 feature tests
│   │   └── test_phase3_ml.py   # ML model + risk scoring tests
│   │
│   ├── requirements.txt        # Python dependencies
│   ├── pytest.ini              # Pytest configuration
│   ├── showdb.py               # Quick DB viewer script
│   └── .env                    # Environment variables (DB credentials)
│
├── frontend/                   # React + Vite frontend (port 5174)
│   ├── index.html              # HTML entry point (Inter + JetBrains Mono fonts)
│   ├── package.json            # npm dependencies
│   ├── vite.config.js          # Vite config (API proxy to :8001)
│   │
│   ├── public/
│   │   ├── favicon.svg
│   │   └── icons.svg
│   │
│   └── src/
│       ├── main.jsx            # React entry point
│       ├── App.jsx             # Routes + auth guards + session timeout
│       ├── index.css           # Tailwind + animations + glass utilities + grid background
│       ├── user.js             # User session management (localStorage)
│       │
│       ├── hooks/
│       │   └── useSessionTimeout.js  # 5-min inactivity auto-logout
│       │
│       ├── components/
│       │   ├── WalletPanel.jsx       # Main wallet: balance, tabs, history, beneficiaries
│       │   ├── WhatsAppPanel.jsx     # WhatsApp integration panel
│       │   └── common/
│       │       ├── Badge.jsx         # Reusable badge component
│       │       ├── Button.jsx        # Reusable button component
│       │       ├── Card.jsx          # Reusable card component
│       │       ├── Layout.jsx        # Page layout wrapper
│       │       ├── Loading.jsx       # Loading spinner
│       │       ├── RiskMeter.jsx     # Risk score meter
│       │       ├── StatusIndicator.jsx # Status dot indicator
│       │       └── index.js          # Component exports
│       │
│       ├── pages/
│       │   ├── LoginPage.jsx         # Login with demo account quick-fill
│       │   ├── MainView.jsx          # Main dashboard wrapper (top bar + wallet)
│       │   ├── PayPage.jsx           # Send money form
│       │   ├── ReviewPage.jsx        # Risk analysis + security Q + PIN + receipt
│       │   ├── ProfilePage.jsx       # User profile + devices + security settings
│       │   ├── AuthorityDashboard.jsx # CFO dashboard: approve/reject HOLD txns
│       │   ├── MailMonitor.jsx       # Email scanner + H.I.V.E. status
│       │   ├── HomePage.jsx          # Alternate home page
│       │   ├── DemoPage.jsx          # Demo flow page
│       │   ├── AlertCenterPage.jsx   # Alert management
│       │   ├── BankDashboardPage.jsx # Bank analytics
│       │   ├── SendMoneyPage.jsx     # Alternate send money
│       │   ├── TimelinePage.jsx      # Transaction timeline
│       │   └── TransactionReviewPage.jsx # Alternate review page
│       │
│       └── services/
│           ├── api.js                # Base API client
│           ├── transactionApi.js     # Transaction API calls
│           ├── riskApi.js            # Risk API calls
│           ├── hiveApi.js            # H.I.V.E. API calls
│           └── notificationApi.js    # Notification API calls
│
├── CLAUDE.md                   # Complete project knowledge base
├── PROJECT_STRUCTURE.md        # This file
├── README.md                   # Project documentation
└── .gitignore                  # Git ignore rules
```

## Database Tables (19 total)

| Table | Purpose |
|---|---|
| users | User accounts (Arjun, Neha, Vikram, Rajesh) |
| accounts | Bank accounts with balances |
| devices | Linked devices per user |
| beneficiaries | Verified payment recipients |
| transactions | All UPI transactions |
| transaction_attempts | Transaction attempt log |
| risk_assessments | ML risk evaluation results |
| decision_logs | Decision audit trail |
| login_events | Login attempt history |
| account_events | Account activity events |
| beneficiary_events | Beneficiary change events |
| behavioral_profiles | User behavior patterns |
| messages | Scanned message content |
| scam_detections | H.I.V.E. scam detection results |
| threat_entities | Known threat entities |
| notifications | User notification feed |
| bank_risk_signals | Bank-level risk signals |
| risk_signals_v2 | H.I.V.E. synced risk signals |
| scam_intelligence | Extracted scammer profiles |

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy async, asyncpg |
| Database | PostgreSQL 17 (localhost:5432) |
| ML Model | scikit-learn RandomForest (30 features), joblib |
| Frontend | React 19, Vite 8, Tailwind CSS 4, react-router-dom 7 |
| Fonts | Inter (UI), JetBrains Mono (data/monospace) |
| H.I.V.E. | Separate project (Desktop\Project) — FastAPI + React + Chrome Extension |
