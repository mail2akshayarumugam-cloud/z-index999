# Scam Shield — Complete Project Knowledge

## What This Is
A hackathon UPI fraud prevention system that extends H.I.V.E. (an existing scam detection platform). Two ML models work together: H.I.V.E. (Model 1) detects scams in WhatsApp/email messages, and a Random Forest (Model 2) evaluates every UPI transaction before it goes through.

## DO NOT MODIFY
- `C:\Users\mail2\OneDrive\Desktop\Project` — This is the original H.I.V.E. project. NEVER touch it.
- The H.I.V.E. Chrome extension code — it works, don't change it.

## How to Run (4 terminals)
```powershell
# Terminal 1 — H.I.V.E. Backend (port 8000)
cd "C:\Users\mail2\OneDrive\Desktop\Project\backend"
.\venv\Scripts\activate
uvicorn app.main:app --reload --port 8000

# Terminal 2 — H.I.V.E. Frontend (port 5173)
cd "C:\Users\mail2\OneDrive\Desktop\Project\frontend"
npm run dev

# Terminal 3 — Scam Shield Backend (port 8001)
cd "C:\Users\mail2\OneDrive\Desktop\HACKATHON\backend"
python -m app.seed
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 4 — Scam Shield Frontend (port 5174)
cd "C:\Users\mail2\OneDrive\Desktop\HACKATHON\frontend"
npm run dev
```

## Database
- **PostgreSQL** on localhost:5432
- Scam Shield DB: `scam_shield_db` (user: postgres, password: akshay2006)
- H.I.V.E. DB: `hive_db` (same credentials)
- View DB: `cd backend && python showdb.py`
- Re-seed: `cd backend && python -m app.seed`
- Run tests: `cd backend && python -m pytest tests/ -q` (35 tests, all passing)

## Login Credentials
| User | Email | Password | UPI ID | UPI PIN | Security Answer | Role |
|---|---|---|---|---|---|---|
| Arjun Kumar | arjun.kumar7@gmail.com | arjun@123 | arjun.kumar7@okicici | 1234 | aju | user |
| Neha Gupta | neha.gupta92@gmail.com | neha@123 | neha.gupta92@okhdfcbank | 5678 | nini | user |
| Vikram Reddy | vikram.reddy@proton.me | vikram@123 | vikram.invest@ybl | 9999 | vicky | user (scammer) |
| Rajesh Mehta (CFO) | rajesh.mehta@company.com | admin@123 | — | — | — | authority |

## The 3 Users Story
- **Arjun & Neha** are friends in Bangalore. They have each other as verified beneficiaries and regularly split bills.
- **Vikram** is a scammer posing as a freelance consultant. His account is only 2 months old, he recently changed his email to proton.me, and he sends escalating amounts to money mule partners.
- There are NO pre-seeded H.I.V.E. risk signals. All flags come from live detection (WhatsApp extension, email scanner, or user reports).

## Transaction Data
- 128 transactions seeded across 6 months
- Arjun: 60 txns (rent, electricity, broadband, Swiggy, D-Mart, mom, Neha)
- Neha: 50 txns (rent, Zomato, Netflix, gym, Myntra, dad, Arjun)
- Vikram: 18 txns (hostel, mess, recharge, then escalating mule transfers)
- 15 merchant accounts (Swiggy, Zomato, D-Mart, Netflix, BESCOM, etc.)
- 2 money mule accounts (suresh.mule99@ybl, raju.transfers@paytm)

## Risk Scoring Rules
- **Score 0-39 (LOW):** ALLOW — auto-approve
- **Score 40-69 (MEDIUM):** VERIFY — security question + PIN
- **Score 70-79 (HIGH):** STRONG_VERIFY — security question + PIN + warning
- **Score 80-100 (CRITICAL):** HOLD — blocked, escalated to authority
- **H.I.V.E. flagged UPI:** ALWAYS HOLD (override to 90%+) regardless of amount
- **New unverified beneficiary:** Minimum 50% risk floor (55% if 0 days old, 65% if amount > 2x avg)

## Payment Flow
```
User enters UPI ID or phone number
    ↓ (phone → resolved to UPI via user lookup)
UPI validation (must exist in accounts, beneficiaries, or risk_signals)
    ↓
Model 2 evaluates 30 features
    ↓
ALLOW → PIN → commit
VERIFY → security question → PIN → commit
STRONG_VERIFY → security question → PIN → commit
HOLD → "Awaiting Authorization" → CFO dashboard → approve/reject
```

## Authority Workflow
When Model 2 returns HOLD, the transaction goes to `awaiting_authorization` status. The CFO (Rajesh Mehta) sees it on `/authority` dashboard with full details: risk score, reasons, H.I.V.E. signals, scammer intelligence (alias, impersonated org, tactics). CFO clicks APPROVE (deducts balance, commits) or REJECT (status=rejected, funds safe). Normal users CANNOT approve — role check enforced server-side.

## H.I.V.E. Auto-Sync
`hive_sync.py` runs as a background asyncio task (started in main.py lifespan). Every 10 seconds it:
1. Queries `hive_db` directly (same PostgreSQL, different database)
2. Reads `detections` + `messages` tables for scam detections with full message text
3. Extracts UPIs, phones, URLs from the full text
4. Creates `risk_signals_v2` entries in `scam_shield_db`
5. Creates `scam_intelligence` records with extracted details

This means: if H.I.V.E.'s Chrome extension catches a scam on WhatsApp Web, within 10 seconds the scammer's UPI is flagged in Scam Shield and any payment to it will be HOLD.

## H.I.V.E. Intelligence Extraction
From a single scam message, the client extracts:
- Scammer alias (regex: "this is X", "I am X", "— X")
- Impersonated org (SBI, HDFC, ICICI, RBI, Police, etc.)
- Threat type (account_termination, legal_action, financial_loss, identity_theft)
- Urgency deadline ("tonight", "24 hours", "today")
- Promised returns ("15% returns")
- Account numbers (9-18 digit numbers)
- IFSC codes (pattern: XXXX0XXXXXX)
- Tactics used (urgency, payment, reward, investment, otp_phishing, etc.)
- Target victim profile (credential_harvest, investment_naive, elderly_targeting)

## Email Monitor
`/mail` page and `/api/email/analyze` endpoint. Users can scan suspicious emails. H.I.V.E. analyzes the content, flags UPIs. Seeded with 4 demo emails (2 scam from fake SBI/Paytm, 2 legit from HDFC/Swiggy). Shows H.I.V.E. connection status (live/offline) via `/api/health` which checks H.I.V.E. backend.

## Backend API Endpoints
```
POST /api/auth/login                    — email/phone + password → user object with role
POST /api/auth/verify-pin               — UPI PIN check
GET  /api/auth/security-question/{id}   — get security question text
POST /api/auth/verify-security          — verify security answer (case insensitive)
GET  /api/auth/profile/{id}             — full profile with devices + login history

POST /api/transactions/preview          — create pending txn + ML risk evaluation
POST /api/transactions/commit           — commit (HOLD → awaiting_authorization)
GET  /api/transactions/account/{id}     — balance + UPI
GET  /api/transactions/history/{id}     — recent txns with risk data
GET  /api/transactions/beneficiaries/{id} — user's beneficiaries
GET  /api/transactions/daily-spending/{id} — spent today vs Rs 50,000 limit

GET  /api/authority/pending?authority_id= — HOLD txns needing approval (role-gated)
POST /api/authority/{txn_id}/approve     — approve + commit (role-gated)
POST /api/authority/{txn_id}/reject      — reject (role-gated)

POST /api/risk/evaluate                 — standalone ML risk check
GET  /api/risk/signals/{user_id}        — H.I.V.E. signals for user
GET  /api/risk/signals/upi/{upi_id}     — check if UPI flagged
POST /api/risk/report-upi              — user reports suspicious UPI
GET  /api/risk/intelligence/{entity}    — scammer profile for entity

POST /api/hive/analyze                  — H.I.V.E. scam detection
POST /api/email/analyze                 — email scam scan
GET  /api/email/inbox/{user_id}         — scanned emails

GET  /api/health                        — includes hive_connected boolean
GET  /api/notifications/{user_id}
```

## Frontend Routes
| Route | Component | Access |
|---|---|---|
| /login | LoginPage | public |
| / | MainView (WalletPanel) | user (authority redirects to /authority) |
| /pay | PayPage | user |
| /review | ReviewPage | user |
| /profile | ProfilePage | user |
| /mail | MailMonitor | user |
| /authority | AuthorityDashboard | authority only |

## Key Files
```
backend/
├── app/main.py              — FastAPI + CORS + lifespan (starts hive_sync)
├── app/seed.py              — Full seed: 3 users + authority + merchants + 128 txns
├── app/hive/client.py       — H.I.V.E. analyzer + intelligence extraction
├── app/ml/risk_model.py     — ML inference, H.I.V.E. override, new-ben floor
├── app/services/
│   ├── transaction_service.py — phone→UPI, UPI validation, preview+commit
│   ├── hive_sync.py           — background sync from hive_db
│   └── hive_signal_bridge.py  — detection → risk_signals + intelligence
├── app/routers/authority.py — approve/reject with role check
├── models/risk_model.pkl    — trained RandomForest
├── showdb.py                — quick DB viewer script
└── tests/ (35 tests)

frontend/src/
├── App.jsx                  — all routes + session timeout wrapper
├── pages/ReviewPage.jsx     — risk analysis + security Q + PIN + receipt
├── pages/AuthorityDashboard.jsx — scammer intelligence + approve/reject
├── pages/MailMonitor.jsx    — email scanner + H.I.V.E. status
├── components/WalletPanel.jsx — balance, daily limit, alerts, tabs
└── hooks/useSessionTimeout.js — 5 min inactivity logout
```

## Database Tables (19 total)
users, accounts, devices, beneficiaries, transactions, transaction_attempts, risk_assessments, decision_logs, login_events, account_events, beneficiary_events, behavioral_profiles, messages, scam_detections, threat_entities, notifications, bank_risk_signals, risk_signals_v2, scam_intelligence

## Tech Stack
- **Backend:** Python 3.12, FastAPI, SQLAlchemy async, asyncpg, PostgreSQL
- **ML:** scikit-learn RandomForest, joblib, numpy, pandas
- **Frontend:** React 19, Vite 8, Tailwind CSS 4, react-router-dom 7
- **H.I.V.E.:** Separate project at Desktop\Project (FastAPI + React + Chrome Extension)

## Stitch MCP
Google Stitch MCP is configured at project scope (HACKATHON directory). Tools are available but screen generation times out frequently. The design system "Scam Shield Dark Ops" (asset ID: assets/16337314180426181138) was created in project 8453424867507539485. Frontend was built directly in React instead of using Stitch-generated HTML.

## Important Design Decisions
1. UPI validation checks accounts + beneficiaries + risk_signals (so H.I.V.E.-flagged UPIs pass validation but get caught by risk engine)
2. Phone-to-UPI resolution strips formatting, checks last 10 digits against users.phone_number
3. HOLD creates `awaiting_authorization` status (not `blocked`) — enables authority workflow
4. Security question answer is hashed with SHA-256 and compared case-insensitively
5. The `scam_intelligence` table stores structured data alongside `risk_signals_v2` for richer authority reviews
6. H.I.V.E. sync reads directly from hive_db via SQLAlchemy (not the API, because API truncates message text to 200 chars)
7. Decision column widths: DecisionLog.decision=50, Transaction.status=30 (widened for AWAITING_AUTHORIZATION)
