# H.I.V.E. Current Architecture — Audit Report

## System Overview

H.I.V.E. (Heuristic Intelligence & Virtual Entrapment) is an active cyber-defense platform at `C:\Users\mail2\OneDrive\Desktop\Project`. It detects, investigates, and collects intelligence from scam attempts targeting users via WhatsApp Web.

## Components

### 1. Chrome Extension (Manifest V3)
- **Content Script** (`extension/src/content/content.ts`): Injected into WhatsApp Web, observes message DOM, shows risk overlays and threat warnings.
- **Background Worker** (`extension/src/background/background.ts`): Coordinates with backend API, manages message queues, orchestrates investigation lifecycle.
- **Popup UI** (`extension/src/popup/popup.ts`): User control panel to enable/disable H.I.V.E.
- **Adapters**: `WhatsAppWebAdapter.ts`, `WhatsAppWebAdapterV2.ts` — extract messages from WhatsApp DOM.
- **Services**: `consentService.ts`, `honeypotService.ts` — manage user consent and honeypot interactions.

### 2. Backend (FastAPI, port 8000)

#### Entry Point
- `backend/app/__init__.py` — package init, version 0.1.0
- `backend/app/config.py` — Settings via pydantic-settings, loads from `.env`

#### Preprocessing Pipeline (`backend/app/preprocessing/`)
- `service.py` → `PreprocessingService.preprocess(text)` — main entry point
- `normalizers.py` → `TextNormalizer.normalize_all(text)` — handles leetspeak, zero-width chars, unicode variants, inserted spaces, RTL overrides
- `entity_extractors.py` → `EntityExtractor.extract_all(text)` — extracts URLs, UPI IDs, phone numbers, emails, money amounts
- `language_detector.py` → detects message language
- `models.py` → `ProcessedMessage`, `ExtractedEntity`, `NormalizationFlags`, `EntityType`

#### ML Classifiers (`backend/app/ml/`)
- `base.py` → `BaseScamClassifier` (abstract), `ClassificationResult`, `ScamCategory` enum (LEGITIMATE, SCAM, JOB_SCAM, INVESTMENT_SCAM, PHISHING, KYC_SCAM, PAYMENT_SCAM, REWARD_SCAM, IMPERSONATION, OTHER_SCAM)
- `tfidf_rf.py` → `TfidfRandomForestClassifier` — TF-IDF + Random Forest baseline, loads from pickle files (vectorizer.pkl, classifier.pkl, label_encoder.pkl)
- `semantic.py` → Semantic model classifier
- `ensemble.py` → `ClassifierEnsemble` — combines multiple classifiers with voting/averaging/weighted averaging
- `train_model.py`, `training/trainer.py` — training pipeline

#### Risk Engine (`backend/app/risk_engine/`)
- `engine.py` → `RiskEngine.assess_risk(processed, ml_result, semantic_result, context)` — combines all signals
- `heuristics.py` → `HeuristicSignalGenerator` — 200+ heuristic indicators across urgency, payment, reward, verification, impersonation, obfuscation
- `models.py` → `RiskAssessment`, `RiskLevel` (LOW/MEDIUM/HIGH/CRITICAL), `DetectionSignal`, `SignalType`, `SignalSource`, `RiskThresholds`

#### API Routers (`backend/app/routers/v1/`)
- `health.py` — Health check
- `cases.py` — Case management
- `conversations.py` — Conversation endpoints
- `consent.py` — User consent management
- `evidence.py` — Evidence preservation
- `honeypot.py` — Honeypot investigation
- `intelligence.py` — Intelligence extraction
- `reports.py` — Report generation
- `multimodal.py` — OCR, QR, speech-to-text
- `correlation.py` — Correlation graph
- `integration.py` → `POST /integration/process` — complete end-to-end message processing

#### Services
- `integration_service.py` — Orchestrates full pipeline (preprocess → detect → evidence → intelligence → risk)
- `evidence_service.py` — Cryptographic evidence preservation
- `correlation_service.py` — Cross-case correlation
- `report_service.py` — Report generation
- `ocr_service.py`, `qr_service.py`, `stt_service.py` — Multimodal processing

#### Honeypot System (`backend/app/honeypot/`)
- `persona_manager.py` — 3 personas (Raj, Priya, Amit)
- `objective_manager.py` — Investigation goals
- `investigation_controller.py` — Stateful honeypot conversation

#### AI Guardrails (`backend/app/guardrails/`)
- `output_validator.py`, `prompt_builder.py`, `safety_checker.py`

#### Intelligence (`backend/app/intelligence/`)
- `ai_extractors.py` — Structured intelligence extraction from conversations

### 3. Database (PostgreSQL, port 5432)
- Database: `hive_db`, user: `postgres`, password in .env
- ORM: SQLAlchemy (async)
- Migrations: Alembic (5 migration files)
- 26 tables across: users, consent, conversations, messages, media, detections, cases, investigations, evidence, intelligence, reports, audit logs

### 4. Frontend Dashboard (React + Vite, port 5173)
- `Dashboard.tsx` — Main dashboard
- `DetectionView.tsx` — Detection results display
- `InvestigationDetail.tsx` — Investigation tracking
- `IntelligenceView.tsx` — Extracted intelligence
- `EvidenceView.tsx` — Evidence browser
- `ReportView.tsx` — Generated reports
- `CorrelationGraph.tsx` — Intelligence relationship graph
- `HiveActivation.tsx` — H.I.V.E. activation control
- UI components: Button, Card, Modal, Badge, EmptyState, LoadingState, StatusIndicator

### 5. External Dependencies
- Redis — Message queues, caching, rate limiting
- Ollama (llama3.2:3b, port 11434) — LLM for honeypot conversations

## Key Interfaces for Integration

### PreprocessingService.preprocess(text) → ProcessedMessage
Input: raw message text
Output: normalized text, entities (URLs, UPI IDs, phones, money), normalization flags, language

### RiskEngine.assess_risk(processed, ml_result, semantic_result, context) → RiskAssessment
Input: ProcessedMessage + optional ML/semantic results
Output: risk_score (0-1), risk_level (LOW/MEDIUM/HIGH/CRITICAL), is_suspicious, scam_category, confidence, signals[], explanation, key_indicators[]

### TfidfRandomForestClassifier.predict(text) → ClassificationResult
Input: message text
Output: label (ScamCategory), probability, top_signals, all_probabilities

### Integration API: POST /api/v1/integration/process
Input: { message_text, conversation_id, message_id, metadata }
Output: { case_id, detection_id, risk_level, risk_score, is_suspicious, scam_category, explanation, key_indicators, recommended_action }

## What This Hackathon Project Builds

This hackathon project (Scam Shield) extends H.I.V.E. by:
1. Wrapping H.I.V.E.'s detection into a clean `analyze_message()` interface
2. Adding user notifications when scams are detected
3. Sending bank risk signals to a financial risk system (Model 2)
4. Storing all data in PostgreSQL for Model 2 consumption
5. Building a GPay-like payment interface with pre-transaction risk gate

The hackathon project runs on **port 8001 (backend) / 5174 (frontend)** and does NOT modify the original H.I.V.E. codebase.
