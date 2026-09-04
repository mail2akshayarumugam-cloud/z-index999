# Scam Shield — UPI Fraud Prevention System

A real-time UPI fraud prevention platform that combines two AI models to protect users from scams before money leaves their account.

**Model 1 (H.I.V.E.)** detects scams in WhatsApp messages and emails via a Chrome extension.
**Model 2 (Random Forest)** evaluates every UPI transaction against 30 risk features before it goes through.

When H.I.V.E. catches a scam, the scammer's UPI ID is flagged in Scam Shield within 10 seconds — any payment to them is automatically blocked.

---

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 17
- H.I.V.E. project at `Desktop\Project` (optional, for live scam detection)

### Setup & Run (4 terminals)

```bash
# Terminal 1 — H.I.V.E. Backend (port 8000)
cd "Desktop\Project\backend"
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — H.I.V.E. Frontend (port 5173)
cd "Desktop\Project\frontend"
npm run dev

# Terminal 3 — Scam Shield Backend (port 8001)
cd "Desktop\HACKATHON\backend"
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 4 — Scam Shield Frontend (port 5174)
cd "Desktop\HACKATHON\frontend"
npm install
npm run dev
```

### Database Setup
```bash
# PostgreSQL (localhost:5432, user: postgres, password: akshay2006)
createdb scam_shield_db
createdb hive_db

# Seed the database
cd backend
python -m app.seed    # Creates users, accounts, 128 transactions, merchants
```

### Run Tests
```bash
cd backend
python -m pytest tests/ -q    # 35 tests, all passing
```

---
<img width="1637" height="961" alt="ChatGPT Image Sep 3, 2026, 09_54_24 PM (1)" src="https://github.com/user-attachments/assets/eb5e8562-7809-4cc0-8e19-d76bdf29ad7e" />


## Demo Credentials

| User | Email | Password | Role |
|---|---|---|---|
| Arjun Kumar | arjun.kumar7@gmail.com | arjun@123 | User |
| Neha Gupta | neha.gupta92@gmail.com | neha@123 | User |
| Vikram Reddy | vikram.reddy@proton.me | vikram@123 | User (Scammer) |
| Rajesh Mehta | rajesh.mehta@company.com | admin@123 | CFO (Authority) |

---

## How It Works

### Payment Flow
```
User enters UPI ID or phone number
    |
    v  (phone -> resolved to UPI via user lookup)
UPI validation (accounts + beneficiaries + risk_signals)
    |
    v
Model 2 evaluates 30 risk features
    |
    +---> ALLOW  (score 0-39)  -> PIN -> commit
    +---> VERIFY (score 40-69) -> Security Q + PIN -> commit
    +---> STRONG_VERIFY (70-79) -> Security Q + PIN + warning -> commit
    +---> HOLD   (score 80-100) -> Blocked -> CFO dashboard -> approve/reject
```

### H.I.V.E. Auto-Sync
- Background task runs every 10 seconds
- Reads `hive_db` directly (same PostgreSQL, different database)
- Extracts UPIs, phones, URLs from full scam message text
- Creates risk signals + scammer intelligence profiles
- H.I.V.E.-flagged UPIs override risk score to 90%+

### Risk Scoring Rules
| Score | Level | Decision | Action |
|---|---|---|---|
| 0-39 | LOW | ALLOW | Auto-approve, PIN only |
| 40-69 | MEDIUM | VERIFY | Security question + PIN |
| 70-79 | HIGH | STRONG_VERIFY | Security Q + PIN + warning |
| 80-100 | CRITICAL | HOLD | Blocked, escalated to CFO |

---

## Frontend Pages

| Route | Page | Description |
|---|---|---|
| `/login` | LoginPage | Login with email/phone, demo account quick-fill |
| `/` | MainView + WalletPanel | Balance, daily limit, action buttons, tabs (history, beneficiaries, scan, notifications) |
| `/pay` | PayPage | Send money form with UPI ID or phone number |
| `/review` | ReviewPage | Circular risk gauge, feature breakdown, security Q, PIN entry, receipt |
| `/profile` | ProfilePage | User details, linked devices, login history, security settings |
| `/mail` | MailMonitor | Email scanner, H.I.V.E. connection status, threat detection |
| `/authority` | AuthorityDashboard | CFO-only: pending HOLD transactions, scammer intelligence, approve/reject |

---

## API Endpoints

### Authentication
```
POST /api/auth/login                  - Email/phone + password -> user object
POST /api/auth/verify-pin             - UPI PIN verification
GET  /api/auth/security-question/{id} - Get security question text
POST /api/auth/verify-security        - Verify security answer (case insensitive)
GET  /api/auth/profile/{id}           - Full profile with devices + login history
```

### Transactions
```
POST /api/transactions/preview        - Create pending txn + ML risk evaluation
POST /api/transactions/commit         - Commit transaction (HOLD -> awaiting_authorization)
GET  /api/transactions/account/{id}   - Balance + UPI
GET  /api/transactions/history/{id}   - Recent transactions with risk data
GET  /api/transactions/beneficiaries/{id} - User's beneficiaries
GET  /api/transactions/daily-spending/{id} - Spent today vs Rs 50,000 limit
```

### Authority (CFO only)
```
GET  /api/authority/pending           - HOLD txns needing approval (role-gated)
POST /api/authority/{txn_id}/approve  - Approve + commit (role-gated)
POST /api/authority/{txn_id}/reject   - Reject (role-gated)
```

### Risk & Intelligence
```
POST /api/risk/evaluate               - Standalone ML risk check
GET  /api/risk/signals/{user_id}      - H.I.V.E. signals for user
GET  /api/risk/signals/upi/{upi_id}   - Check if UPI is flagged
POST /api/risk/report-upi             - User reports suspicious UPI
GET  /api/risk/intelligence/{entity}  - Scammer profile for entity
```

### H.I.V.E. & Email
```
POST /api/hive/analyze                - H.I.V.E. scam detection
POST /api/email/analyze               - Email scam scan
GET  /api/email/inbox/{user_id}       - Scanned emails
```

### System
```
GET  /api/health                      - Status + hive_connected boolean
GET  /api/notifications/{user_id}     - User notifications
```

---

## Source Code Reference

### Backend — Core Application

#### `backend/app/main.py`
FastAPI application entry point. Configures CORS (allows all origins for dev), mounts all routers, and starts the H.I.V.E. background sync task on startup via lifespan context manager.

#### `backend/app/config.py`
Environment configuration using Pydantic settings. Reads DATABASE_URL from `.env`, defaults to `postgresql+asyncpg://postgres:akshay2006@localhost/scam_shield_db`.

#### `backend/app/database.py`
SQLAlchemy async engine and session factory. Creates `AsyncSession` instances for all database operations. Handles connection pooling and session lifecycle.

#### `backend/app/seed.py`
Complete database seeder. Creates 3 users (Arjun, Neha, Vikram) + 1 authority (Rajesh CFO), their accounts with balances, devices, beneficiary relationships, and 128 realistic transactions across 6 months. Also seeds 15 merchant accounts and 2 money mule accounts.

---

### Backend — ML Model (Model 2)

#### `backend/app/ml/risk_model.py`
The core ML inference engine. Loads the trained RandomForest model from `models/risk_model.pkl`. Evaluates 30 features including: transaction amount patterns, beneficiary trust, device fingerprint, H.I.V.E. signals, behavioral profile, time patterns, network graph, and velocity. Applies H.I.V.E. override (flagged UPI -> 90%+ score) and new-beneficiary floor (minimum 50% risk for unverified recipients).

#### `backend/app/ml/train_model.py`
Training script for the RandomForest classifier. Uses scikit-learn with synthetic data generated by `dataset_generator.py`. Outputs `risk_model.pkl` with metadata.

#### `backend/app/ml/dataset_generator.py`
Generates synthetic training data with realistic feature distributions for UPI fraud detection. Creates balanced datasets of legitimate and fraudulent transactions.

---

### Backend — H.I.V.E. Integration

#### `backend/app/hive/client.py`
H.I.V.E. scam analyzer client. Calls the H.I.V.E. backend API for real-time scam analysis. Also contains the intelligence extraction engine that parses scam messages to extract: scammer alias, impersonated organization (SBI, HDFC, RBI, etc.), threat type, urgency deadlines, promised returns, account numbers, IFSC codes, tactics used, and target victim profile.

#### `backend/app/services/hive_sync.py`
Background asyncio task started in `main.py` lifespan. Every 10 seconds, queries the `hive_db` database directly (not the API, because the API truncates messages to 200 chars). Reads `detections` + `messages` tables, extracts UPIs/phones/URLs from full message text, and creates `risk_signals_v2` entries in `scam_shield_db`.

#### `backend/app/services/hive_signal_bridge.py`
Bridges H.I.V.E. detections to Scam Shield's risk signal system. Converts raw detection data into structured `risk_signals_v2` records and `scam_intelligence` records with full scammer profiles.

---

### Backend — Routers (API Endpoints)

#### `backend/app/routers/auth.py`
Authentication endpoints. Login accepts email or phone + password, returns user object with role. PIN verification checks 4-digit UPI PIN. Security question retrieval and answer verification (SHA-256 hashed, case-insensitive comparison). Profile endpoint returns user details with devices and login history.

#### `backend/app/routers/transactions.py`
Transaction lifecycle. `preview` creates a pending transaction and runs ML risk evaluation, returning the risk assessment with score, level, decision, reasons, and feature breakdown. `commit` finalizes the transaction (deducts balance) or escalates to `awaiting_authorization` for HOLD decisions. Also provides balance, history, beneficiaries, and daily spending endpoints.

#### `backend/app/routers/authority.py`
CFO-only endpoints with server-side role enforcement. Lists pending `awaiting_authorization` transactions with full risk data and scammer intelligence. Approve deducts balance and commits. Reject sets status to rejected (funds safe). Both require `authority_id` matching a user with role=authority.

#### `backend/app/routers/risk.py`
Risk evaluation and signal management. Standalone ML risk check endpoint. Signal lookup by user ID or UPI ID. User-initiated UPI reporting (flags suspicious UPIs). Intelligence lookup returns scammer profile for any entity.

#### `backend/app/routers/email_monitor.py`
Email scanning endpoint. Accepts sender, subject, body — runs through H.I.V.E. analysis. Stores results and extracted UPIs are auto-flagged. Inbox endpoint returns all scanned emails for a user with scam/safe classification.

#### `backend/app/routers/schemas.py`
Pydantic models for all API request/response schemas. Defines LoginRequest, TransactionPreview, RiskEvaluation, AuthorityAction, EmailAnalysis, etc.

#### `backend/app/routers/notifications.py`
User notification feed. Returns notifications ordered by severity and recency. Notifications are created by the system when H.I.V.E. flags entities or transactions are blocked.

#### `backend/app/routers/demo.py`
Demo orchestration endpoints for hackathon presentation. Provides scripted demo flows that trigger H.I.V.E. scam detection followed by payment attempts.

#### `backend/app/routers/hive.py`
Direct H.I.V.E. analysis endpoint. Accepts message text and returns scam detection results with indicators.

---

### Backend — Services (Business Logic)

#### `backend/app/services/transaction_service.py`
Core transaction logic. Phone-to-UPI resolution strips formatting and checks last 10 digits. UPI validation checks accounts, beneficiaries, AND risk_signals (so H.I.V.E.-flagged UPIs pass validation but get caught by risk engine). Preview creates pending transaction + risk assessment. Commit verifies balance, checks daily limit (Rs 50,000), deducts funds.

#### `backend/app/services/risk_engine.py`
Risk calculation engine. Aggregates signals from multiple sources (ML model, H.I.V.E., behavioral profile, device trust) into a unified risk score. Applies business rules for score thresholds and decision logic.

#### `backend/app/services/notification_service.py`
Creates and manages user notifications. Auto-generates notifications for H.I.V.E. detections, blocked transactions, and authority decisions.

#### `backend/app/services/analysis_service.py`
Analysis utilities for risk feature computation and signal aggregation.

#### `backend/app/services/demo_orchestrator.py`
Orchestrates demo scenarios. Scripts multi-step flows combining H.I.V.E. detection with payment attempts for hackathon presentation.

---

### Backend — Models (Database)

#### `backend/app/models/tables.py`
SQLAlchemy ORM models for all 19 database tables. Defines Users, Accounts, Devices, Beneficiaries, Transactions, TransactionAttempts, RiskAssessments, DecisionLogs, LoginEvents, AccountEvents, BeneficiaryEvents, BehavioralProfiles, Messages, ScamDetections, ThreatEntities, Notifications, BankRiskSignals, RiskSignalsV2, and ScamIntelligence.

#### `backend/app/models/financial.py`
Financial data models and enums. Defines transaction statuses (pending, evaluated, committed, blocked, awaiting_authorization, rejected), risk levels, and decision types.

---

### Backend — Tests

#### `backend/tests/conftest.py`
Pytest fixtures. Sets up async test database (SQLite in-memory), creates test client with dependency overrides, and provides test data factories.

#### `backend/tests/test_api.py`
API endpoint integration tests. Tests login flow (success + failure), PIN verification, transaction preview, and health check.

#### `backend/tests/test_database.py`
Database operation tests. Verifies table creation, user CRUD, account operations, and relationship integrity.

#### `backend/tests/test_hive_client.py`
H.I.V.E. client tests. Tests scam analysis, intelligence extraction (alias, org, tactics), and UPI/phone/URL extraction from message text.

#### `backend/tests/test_phase2.py`
Phase 2 feature tests. Tests beneficiary verification, daily spending limits, device trust, notification creation, and security question flow.

#### `backend/tests/test_phase3_ml.py`
ML model and risk scoring tests. Tests RandomForest inference, feature computation, H.I.V.E. override logic, new-beneficiary risk floor, and risk velocity calculation.

---

### Frontend — Core

#### `frontend/src/main.jsx`
React entry point. Renders the App component into the root DOM element.

#### `frontend/src/App.jsx`
React Router configuration with auth guards. Defines all routes: `/login` (public), `/` (user, redirects authority to `/authority`), `/pay`, `/review`, `/profile`, `/mail` (all require user), `/authority` (requires authority role). Wraps protected routes in `SessionWrapper` for auto-logout.

#### `frontend/src/index.css`
Tailwind CSS 4 with custom theme tokens (risk colors, surface colors), 12+ CSS animations (fadeIn, fadeInUp, scaleUp, slideInRight, shimmer, pulseGlow, riskPulse, float, gridMove), glassmorphism utilities (.glass, .glass-strong), grid background pattern (.bg-grid), radial glow effects (.bg-glow-indigo, .bg-glow-red, .bg-glow-emerald), gradient text (.text-gradient), and card hover effects (.card-hover).

#### `frontend/src/user.js`
User session management using localStorage. Provides `loginUser()`, `logoutUser()`, `getUser()` functions. Stores user ID, name, email, phone, role, UPI, deviceId, and avatar.

#### `frontend/src/hooks/useSessionTimeout.js`
Auto-logout hook. Tracks mouse/keyboard/touch activity. After 5 minutes of inactivity, logs out the user and redirects to login with "Session expired" message.

---

### Frontend — Pages

#### `frontend/src/pages/LoginPage.jsx`
Login page with dark cybersecurity aesthetic. Features: animated grid background with radial indigo glow, floating orbs for atmosphere, glassmorphic login form, gradient "Scam Shield" title, input fields with icons, 4 demo account cards with staggered fade-in animations, "Powered by H.I.V.E. Intelligence + Model 2" branding.

#### `frontend/src/pages/MainView.jsx`
Main dashboard wrapper. Glass-effect top navigation bar with: Scam Shield brand icon, H.I.V.E. live status indicator (animated ping dot), Model 2 badge, signal sync count, mail shortcut, threat count badge, user avatar, logout. Renders WalletPanel as the main content area over a grid pattern background.

#### `frontend/src/pages/PayPage.jsx`
Send money form. Grid background, icon-prefixed input fields for UPI ID/phone and amount (large mono font with rupee symbol), optional note field. Gradient "Pay Securely" button with shield icon. Shows "Model 2 Pre-Check" badge in header. Footer: "Verified by Model 2 against 30 risk signals + H.I.V.E. intelligence".

#### `frontend/src/pages/ReviewPage.jsx`
Transaction security review — the most complex page. Three phases:
1. **Analyzing**: Triple concentric spinning rings with pulse glow, animated feature tags (H.I.V.E. Intelligence, Behavioral Profile, Device Trust, etc.)
2. **Result**: Circular SVG risk gauge (animated stroke-dasharray), risk level badge (pulses on HIGH/CRITICAL), score bar with tick marks at 40/70/90, bullet-point reasons, H.I.V.E. intelligence panel with red accent border, 8 feature breakdown bars with percentages. Action section adapts per decision: ALLOW (green PIN button), VERIFY (amber security Q + PIN), STRONG_VERIFY (red warning + security Q + PIN), HOLD (amber "Awaiting Authorization" with pulsing border).
3. **Complete**: Success receipt with animated checkmark (drawCheck SVG animation) or block indicator, dashed-line receipt rows (To, Name, Ref No, Date, Status, Balance, Risk Check).

Glass-effect modals for security question and 4-digit PIN entry.

#### `frontend/src/pages/ProfilePage.jsx`
User profile with glass card sections: hero card (avatar, name, UPI, balance, member since), account details grid with icons, linked devices list (trusted/untrusted badges), recent login activity (success/failure dots with IP and timestamp), security settings (UPI PIN, H.I.V.E. Protection, Model 2 Risk Gate, Session Timeout — all shown as toggle switches). Staggered fade-in animations on each section.

#### `frontend/src/pages/AuthorityDashboard.jsx`
CFO command center. Red glow background + grid pattern. Header with pending count badge. Three glass stat cards (Awaiting Authorization count, Total Amount at Risk, Model 2 status) with colored top borders. Transaction cards with red left accent border, expandable detail. MiniGauge SVG circles for risk scores. Expanded view shows: transaction info grid, AI Risk Analysis panel (gauge + score bar + reasons + H.I.V.E. signals), Scammer Intelligence dossier (alias, impersonated org, threat type, deadline, tactics pills, linked accounts, original message), status banner, reject reason input, APPROVE (green with glow) and REJECT (red with glow) buttons. Empty state: green shield icon with "All Clear" message.

#### `frontend/src/pages/MailMonitor.jsx`
Email scanner. Glass header with H.I.V.E. connection status (green dot with glow shadow when connected). Three stat cards (Total Scanned, Threats Detected, Safe Emails). Compose form for scanning new emails (glass-strong card). Email list with staggered animations — scam emails highlighted red with risk level and scam type badges, safe emails with green shield. Expandable detail shows AI explanation, detection indicators, and UPI flagging notice.

---

### Frontend — Components

#### `frontend/src/components/WalletPanel.jsx`
The core wallet experience. Glass balance card with "Updated HH:MM" timestamp and skeleton loading state. Daily spending progress bar with gradient colors and glow shadow. H.I.V.E. alert section with risk-pulse animation and prominent report buttons. Four action buttons (Send, Scan, Bills, History) with staggered fade-in and hover scale effects. Tab content:
- **Home**: Notification feed with severity-colored cards
- **Scan**: QR code display with scale-up animation
- **Bills**: Beneficiary list with verified/unverified badges
- **History**: Searchable/filterable transaction list with risk level badges

#### `frontend/src/components/WhatsAppPanel.jsx`
WhatsApp integration panel for H.I.V.E. Chrome extension interaction.

#### `frontend/src/components/common/`
Reusable UI components: Badge, Button, Card, Layout, Loading, RiskMeter, StatusIndicator.

---

### Frontend — Services

#### `frontend/src/services/api.js`
Base API client with fetch wrapper. Handles JSON serialization, error responses, and base URL configuration.

#### `frontend/src/services/transactionApi.js`
Transaction-related API calls: preview, commit, balance, history, beneficiaries, daily spending.

#### `frontend/src/services/riskApi.js`
Risk-related API calls: evaluate, signals lookup, UPI report, intelligence lookup.

#### `frontend/src/services/hiveApi.js`
H.I.V.E.-related API calls: analyze message, scan email.

#### `frontend/src/services/notificationApi.js`
Notification API calls: fetch user notifications.

---

## Architecture Diagram

```
+------------------+     +-------------------+     +------------------+
|   WhatsApp Web   |     |   Scam Shield     |     |   Authority      |
|   (Chrome Ext)   |     |   Frontend        |     |   Dashboard      |
|                  |     |   :5174           |     |   (CFO View)     |
+--------+---------+     +--------+----------+     +--------+---------+
         |                         |                          |
         v                         v                          v
+--------+---------+     +--------+----------+     +------------------+
|   H.I.V.E.       |     |   Scam Shield     |     |                  |
|   Backend         |     |   Backend         +<----+ Role-gated API   |
|   :8000           |     |   :8001           |     |                  |
+--------+---------+     +---+----+----+------+     +------------------+
         |                    |    |    |
         v                    |    |    v
+--------+---------+          |    |  +-+----------------+
|   hive_db         |          |    |  | ML Model 2       |
|   (PostgreSQL)    +<---------+    |  | (RandomForest)   |
+------------------+  sync     |    |  | 30 features      |
                      every    |    |  +------------------+
                      10s      |    |
                               v    v
                     +---------+----+------+
                     |   scam_shield_db     |
                     |   (PostgreSQL)       |
                     |   19 tables          |
                     +---------------------+
```

---

## Design System

- **Theme**: Dark cybersecurity command center (bg #0b1120)
- **Fonts**: Inter (UI), JetBrains Mono (data/amounts/UPI IDs)
- **Colors**: Indigo-600 primary, Emerald-500 safe, Amber-500 warning, Red-500 danger
- **Effects**: Glassmorphism cards, grid backgrounds, radial glows, staggered animations
- **Components**: Circular SVG risk gauges, animated progress bars, glass modals

---

## License

Hackathon project. Built for educational and demonstration purposes.
