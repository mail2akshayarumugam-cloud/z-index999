# Phase 3 — ML-Powered Pre-Transaction Risk Engine (Model 2)

## Model Metrics

### Comparison (Validation Set, n=750)

| Model | Precision | Recall | F1 | ROC-AUC |
|-------|-----------|--------|-----|---------|
| LogisticRegression | 0.9947 | 0.9894 | 0.9920 | 0.9999 |
| **RandomForest** | **1.0000** | **1.0000** | **1.0000** | **1.0000** |
| XGBoost | 1.0000 | 1.0000 | 1.0000 | 1.0000 |

**Selected: RandomForest** (best F1 + recall for fraud detection)

### Test Set (n=750)
- Precision: 1.0000
- Recall: 1.0000
- F1: 1.0000
- ROC-AUC: 1.0000
- Confusion Matrix: TN=563, FP=0, FN=0, TP=187

### FP vs FN Tradeoff
For financial fraud prevention, missed fraud (false negatives) is far more costly than false positives (legitimate transactions incorrectly flagged). The model uses `class_weight='balanced'` to bias toward catching fraud. In production with real-world noise, we'd expect some FP and would tune thresholds to balance user friction vs fraud loss.

## Feature List (30 features across 5 categories)

### A. Transaction Features
| Feature | Description |
|---------|------------|
| `amount` | Transaction amount in INR |
| `amount_to_avg_ratio` | Ratio of txn amount to user's average |
| `amount_to_max_ratio` | Ratio to user's historical max |
| `is_new_beneficiary` | 1 if first transaction to this recipient |
| `beneficiary_age_days` | Days since beneficiary was added |
| `beneficiary_verified` | 1 if beneficiary is verified |
| `txn_hour` | Hour of day (0-23) |
| `is_unusual_hour` | 1 if 1-5 AM |
| `txn_frequency_24h` | Transactions in last 24h |
| `txn_velocity_1h` | Transactions in last 1h |

### B. Behavioral Features
| Feature | Description |
|---------|------------|
| `user_avg_amount` | User's average transaction amount |
| `user_median_amount` | User's median transaction amount |
| `user_max_amount` | User's historical max |
| `user_total_txns` | Lifetime transaction count |
| `user_typical_ben_count` | Typical beneficiary count |
| `user_txn_freq_per_week` | Typical weekly frequency |
| `days_since_last_txn` | Days since last transaction |

### C. Account/Device Context
| Feature | Description |
|---------|------------|
| `is_new_device` | 1 if device first seen < 2 days ago |
| `device_trusted` | 1 if device in trusted list |
| `recent_password_change` | Password changed in 48h |
| `recent_sim_swap` | SIM swapped in 48h |
| `recent_email_change` | Email changed in 48h |
| `recent_pin_change` | PIN changed in 48h |
| `account_events_48h` | Count of account events in 48h |
| `recent_beneficiary_additions_24h` | New beneficiaries in 24h |

### D. H.I.V.E. Intelligence
| Feature | Description |
|---------|------------|
| `hive_recipient_flagged` | 1 if recipient UPI flagged by H.I.V.E. |
| `hive_signal_severity` | Severity: 0=none, 1=low, 2=med, 3=high, 4=critical |
| `hive_hours_since_alert` | Hours since H.I.V.E. alert (-1 if none) |
| `hive_scam_category_match` | 1 if scam category matches txn pattern |

### E. Network Features
| Feature | Description |
|---------|------------|
| `recipient_suspicious_neighbor_count` | Suspicious entities linked to recipient |

### Top 10 Feature Importances (RandomForest)
1. `beneficiary_age_days` — 0.2717
2. `amount_to_max_ratio` — 0.1604
3. `beneficiary_verified` — 0.1183
4. `amount_to_avg_ratio` — 0.1051
5. `amount` — 0.0623
6. `is_new_beneficiary` — 0.0483
7. `hive_recipient_flagged` — 0.0429
8. `recent_beneficiary_additions_24h` — 0.0359
9. `hive_hours_since_alert` — 0.0335
10. `hive_signal_severity` — 0.0256

## Sample Predictions

### Normal Rs500 to verified beneficiary
```json
{
  "risk_score": 0.0,
  "risk_level": "LOW",
  "decision": "ALLOW",
  "risk_velocity": {"velocity_score": 0, "trend": "stable"},
  "reasons": ["No significant risk indicators detected"]
}
```

### Rs50,000 to H.I.V.E.-flagged scammer UPI
```json
{
  "risk_score": 99.5,
  "risk_level": "CRITICAL",
  "decision": "HOLD",
  "risk_velocity": {"velocity_score": 75, "trend": "rapid_accumulation", "signal_count": 6},
  "reasons": [
    "Recipient is associated with a recent H.I.V.E. scam alert",
    "Scam category matches the transaction pattern",
    "Beneficiary account is only 0 days old",
    "Transaction is 20.8x the user's historical max",
    "Beneficiary is not verified",
    "Transaction is 43.5x the user's typical amount"
  ]
}
```

## Decision Thresholds (Configurable)

| Score | Level | Decision | UX |
|-------|-------|----------|-----|
| 0-39 | LOW | ALLOW | Auto-approve |
| 40-69 | MEDIUM | VERIFY | Require PIN/OTP |
| 70-89 | HIGH | STRONG_VERIFY | Video KYC / manual |
| 90-100 | CRITICAL | HOLD | Block + human review |

Thresholds are in `app/ml/risk_model.py:THRESHOLDS` — NOT baked into the ML model.

## Risk Velocity

Measures how rapidly risk signals have accumulated in a recent window:

| Signals | Velocity Score | Trend |
|---------|---------------|-------|
| 0 | 0 | stable |
| 1-2 | 25 | low_accumulation |
| 3-4 | 55 | moderate_accumulation |
| 5-6 | 75 | rapid_accumulation |
| 7+ | 95 | critical_surge |

Signals counted: H.I.V.E. alerts + account events (48h) + new beneficiaries (24h).

## Explainability

Reasons are generated from feature importance × feature risk state:
1. H.I.V.E. signals are always top-priority when present
2. Remaining features ranked by RandomForest importance
3. Only features in a "risk state" are included (e.g., `is_new_beneficiary=1`, not `=0`)
4. All reasons are human-readable sentences, never raw feature names

## Limitations

1. **Synthetic data**: Model trained on generated data, not real-world distributions
2. **No real inter-bank data**: Cannot access actual UPI transaction networks
3. **Network features simplified**: Using signal counts as proxy for NetworkX graph analysis
4. **No time-series**: Risk velocity is a simple count, not a proper time-series model
5. **Perfect test metrics**: Expected on synthetic data — real-world performance would differ

## How to Retrain

```bash
cd backend

# 1. Regenerate dataset (modify dataset_generator.py for new patterns)
python -m app.ml.dataset_generator

# 2. Train and compare models (saves best to models/)
python -m app.ml.train_model

# Files produced:
#   models/risk_model.pkl          — serialized model + scaler
#   models/feature_schema.json     — feature names + importances
#   models/model_metadata.json     — training date, metrics, comparison
```

## How the API Loads the Model

1. On first `/api/risk/evaluate` or `/api/transactions/preview` call
2. `_load_model()` reads `models/risk_model.pkl` via joblib
3. Model is cached in `_model_cache` for subsequent requests
4. If `risk_model.pkl` is missing, falls back to rule-based engine
5. Feature extraction queries live database state (beneficiaries, profiles, events, signals)
