"""
Train and compare Model 2 risk classifiers.

Compares Logistic Regression, Random Forest, and XGBoost.
Selects best model based on F1-score (weighted toward recall for fraud detection).
Saves model + metadata + feature schema.
"""
import json
import time
from pathlib import Path
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import joblib
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    precision_score, recall_score, f1_score, roc_auc_score,
    confusion_matrix, classification_report,
)

try:
    from xgboost import XGBClassifier
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False

from app.ml.dataset_generator import FEATURES, save_dataset

DATA_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "risk_training.csv"
MODEL_DIR = Path(__file__).resolve().parent.parent.parent / "models"


def load_data():
    if not DATA_PATH.exists():
        save_dataset(DATA_PATH)
    df = pd.read_csv(DATA_PATH)
    X = df[FEATURES]
    y = df["is_fraud"]
    return X, y, df


def train_and_evaluate():
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("MODEL 2 — PRE-TRANSACTION RISK ENGINE TRAINING")
    print("=" * 60)

    X, y, df = load_data()
    print(f"\nDataset: {len(df)} samples, {y.sum()} fraud ({y.mean():.1%})")
    print(f"Features: {len(FEATURES)}")

    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=0.3, random_state=42, stratify=y
    )
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42, stratify=y_temp
    )
    print(f"\nSplit: train={len(X_train)}, val={len(X_val)}, test={len(X_test)}")

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    models = {
        "LogisticRegression": LogisticRegression(
            max_iter=1000, class_weight="balanced", random_state=42
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=200, max_depth=12, class_weight="balanced",
            random_state=42, n_jobs=-1
        ),
    }

    if HAS_XGBOOST:
        fraud_ratio = (y_train == 0).sum() / max((y_train == 1).sum(), 1)
        models["XGBoost"] = XGBClassifier(
            n_estimators=200, max_depth=8, learning_rate=0.1,
            scale_pos_weight=fraud_ratio, random_state=42,
            eval_metric="logloss", use_label_encoder=False,
        )

    results = {}

    for name, model in models.items():
        print(f"\n{'─' * 50}")
        print(f"Training: {name}")
        start = time.time()

        if name == "LogisticRegression":
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_val_scaled)
            y_proba = model.predict_proba(X_val_scaled)[:, 1]
        else:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_val)
            y_proba = model.predict_proba(X_val)[:, 1]

        elapsed = time.time() - start

        precision = precision_score(y_val, y_pred, zero_division=0)
        recall = recall_score(y_val, y_pred, zero_division=0)
        f1 = f1_score(y_val, y_pred, zero_division=0)
        auc = roc_auc_score(y_val, y_proba)
        cm = confusion_matrix(y_val, y_pred)

        results[name] = {
            "model": model,
            "precision": precision,
            "recall": recall,
            "f1": f1,
            "roc_auc": auc,
            "confusion_matrix": cm.tolist(),
            "train_time": elapsed,
            "needs_scaler": name == "LogisticRegression",
        }

        print(f"  Time: {elapsed:.2f}s")
        print(f"  Precision: {precision:.4f}")
        print(f"  Recall:    {recall:.4f}")
        print(f"  F1:        {f1:.4f}")
        print(f"  ROC-AUC:   {auc:.4f}")
        print(f"  Confusion Matrix:")
        print(f"    TN={cm[0][0]}  FP={cm[0][1]}")
        print(f"    FN={cm[1][0]}  TP={cm[1][1]}")

    # Select best model — optimize for F1 with recall tiebreaker
    print(f"\n{'=' * 60}")
    print("MODEL COMPARISON")
    print(f"{'=' * 60}")
    print(f"{'Model':<22} {'Precision':>10} {'Recall':>10} {'F1':>10} {'AUC':>10}")
    print("─" * 62)
    for name, r in results.items():
        print(f"{name:<22} {r['precision']:>10.4f} {r['recall']:>10.4f} {r['f1']:>10.4f} {r['roc_auc']:>10.4f}")

    best_name = max(results, key=lambda n: (results[n]["f1"], results[n]["recall"]))
    best = results[best_name]
    print(f"\nSelected: {best_name} (F1={best['f1']:.4f}, AUC={best['roc_auc']:.4f})")

    # Evaluate on test set
    best_model = best["model"]
    if best["needs_scaler"]:
        y_test_pred = best_model.predict(X_test_scaled)
        y_test_proba = best_model.predict_proba(X_test_scaled)[:, 1]
    else:
        y_test_pred = best_model.predict(X_test)
        y_test_proba = best_model.predict_proba(X_test)[:, 1]

    test_f1 = f1_score(y_test, y_test_pred, zero_division=0)
    test_auc = roc_auc_score(y_test, y_test_proba)
    test_precision = precision_score(y_test, y_test_pred, zero_division=0)
    test_recall = recall_score(y_test, y_test_pred, zero_division=0)
    test_cm = confusion_matrix(y_test, y_test_pred)

    print(f"\nTEST SET RESULTS ({best_name}):")
    print(f"  Precision: {test_precision:.4f}")
    print(f"  Recall:    {test_recall:.4f}")
    print(f"  F1:        {test_f1:.4f}")
    print(f"  ROC-AUC:   {test_auc:.4f}")
    print(f"  CM: TN={test_cm[0][0]} FP={test_cm[0][1]} FN={test_cm[1][0]} TP={test_cm[1][1]}")

    print("\nFP vs FN TRADEOFF:")
    print(f"  False Positives (legit blocked): {test_cm[0][1]}")
    print(f"  False Negatives (fraud missed):  {test_cm[1][0]}")
    print("  For financial protection, missed fraud (FN) is more costly than")
    print("  false positives (FP). The model uses class_weight='balanced' to")
    print("  bias toward catching fraud, accepting some extra FP.")

    # Get feature importances
    if hasattr(best_model, "feature_importances_"):
        importances = best_model.feature_importances_
    elif hasattr(best_model, "coef_"):
        importances = np.abs(best_model.coef_[0])
    else:
        importances = np.zeros(len(FEATURES))

    importance_pairs = sorted(
        zip(FEATURES, importances), key=lambda x: x[1], reverse=True
    )
    print(f"\nTOP 10 FEATURES:")
    for feat, imp in importance_pairs[:10]:
        print(f"  {feat:<40} {imp:.4f}")

    # Save model
    model_path = MODEL_DIR / "risk_model.pkl"
    save_payload = {
        "model": best_model,
        "scaler": scaler if best["needs_scaler"] else None,
        "needs_scaler": best["needs_scaler"],
        "features": FEATURES,
    }
    joblib.dump(save_payload, model_path)
    print(f"\nModel saved: {model_path}")

    # Save feature schema
    schema_path = MODEL_DIR / "feature_schema.json"
    feature_schema = {
        "features": FEATURES,
        "feature_descriptions": {
            "amount": "Transaction amount in INR",
            "amount_to_avg_ratio": "Ratio of txn amount to user's average",
            "amount_to_max_ratio": "Ratio of txn amount to user's historical max",
            "is_new_beneficiary": "1 if beneficiary never transacted with before",
            "beneficiary_age_days": "Days since beneficiary was added (-1 if new)",
            "beneficiary_verified": "1 if beneficiary is verified",
            "txn_hour": "Hour of day (0-23) of the transaction",
            "is_unusual_hour": "1 if outside user's typical hours (1-5 AM)",
            "txn_frequency_24h": "Number of transactions in last 24h",
            "txn_velocity_1h": "Number of transactions in last 1h",
            "user_avg_amount": "User's historical average transaction amount",
            "user_median_amount": "User's historical median transaction amount",
            "user_max_amount": "User's historical max transaction amount",
            "user_total_txns": "User's total transaction count",
            "user_typical_ben_count": "User's typical beneficiary count",
            "user_txn_freq_per_week": "User's typical transactions per week",
            "days_since_last_txn": "Days since user's last transaction",
            "is_new_device": "1 if device not seen before",
            "device_trusted": "1 if device is marked trusted",
            "recent_password_change": "1 if password changed in last 48h",
            "recent_sim_swap": "1 if SIM swapped in last 48h",
            "recent_email_change": "1 if email changed in last 48h",
            "recent_pin_change": "1 if PIN changed in last 48h",
            "account_events_48h": "Count of account events in last 48h",
            "recent_beneficiary_additions_24h": "New beneficiaries added in 24h",
            "hive_recipient_flagged": "1 if recipient UPI flagged by H.I.V.E.",
            "hive_signal_severity": "H.I.V.E. signal severity (0=none, 1-4)",
            "hive_hours_since_alert": "Hours since H.I.V.E. alert (-1 if none)",
            "hive_scam_category_match": "1 if scam category matches txn pattern",
            "recipient_suspicious_neighbor_count": "Suspicious entities linked to recipient",
        },
        "feature_importance": {feat: float(imp) for feat, imp in importance_pairs},
    }
    with open(schema_path, "w") as f:
        json.dump(feature_schema, f, indent=2)
    print(f"Feature schema saved: {schema_path}")

    # Save metadata
    meta_path = MODEL_DIR / "model_metadata.json"
    metadata = {
        "model_type": best_name,
        "model_version": "ml-v1",
        "training_date": datetime.now(timezone.utc).isoformat(),
        "dataset_size": len(df),
        "fraud_ratio": float(y.mean()),
        "features": FEATURES,
        "feature_count": len(FEATURES),
        "train_size": len(X_train),
        "val_size": len(X_val),
        "test_size": len(X_test),
        "val_metrics": {
            "precision": round(best["precision"], 4),
            "recall": round(best["recall"], 4),
            "f1": round(best["f1"], 4),
            "roc_auc": round(best["roc_auc"], 4),
            "confusion_matrix": best["confusion_matrix"],
        },
        "test_metrics": {
            "precision": round(test_precision, 4),
            "recall": round(test_recall, 4),
            "f1": round(test_f1, 4),
            "roc_auc": round(test_auc, 4),
            "confusion_matrix": test_cm.tolist(),
        },
        "all_model_comparison": {
            name: {
                "precision": round(r["precision"], 4),
                "recall": round(r["recall"], 4),
                "f1": round(r["f1"], 4),
                "roc_auc": round(r["roc_auc"], 4),
            }
            for name, r in results.items()
        },
        "decision_thresholds": {
            "LOW": "0-39 → ALLOW",
            "MEDIUM": "40-69 → VERIFY",
            "HIGH": "70-89 → STRONG_VERIFY",
            "CRITICAL": "90-100 → HOLD",
        },
    }
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved: {meta_path}")

    return best_name, results


if __name__ == "__main__":
    train_and_evaluate()
