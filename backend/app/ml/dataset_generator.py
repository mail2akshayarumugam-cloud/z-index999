"""
Synthetic training dataset generator for Model 2.

Generates ~5000 labeled transaction samples with 30 features across
5 categories: transaction, behavioral, account/device, H.I.V.E. intelligence,
and network features.

Label distribution target: ~75% legitimate, ~25% fraud (reflects real-world
imbalance while keeping enough positive examples for training).

IMPORTANT: Avoids trivial labels like "high amount = fraud". Fraud labels
come from COMBINATIONS of signals, not any single feature.
"""
import random
import csv
import math
from pathlib import Path

import numpy as np

SEED = 42
N_SAMPLES = 5000
OUTPUT_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "risk_training.csv"

FEATURES = [
    # A. Transaction features
    "amount",
    "amount_to_avg_ratio",
    "amount_to_max_ratio",
    "is_new_beneficiary",
    "beneficiary_age_days",
    "beneficiary_verified",
    "txn_hour",
    "is_unusual_hour",
    "txn_frequency_24h",
    "txn_velocity_1h",
    # B. User behavioral features
    "user_avg_amount",
    "user_median_amount",
    "user_max_amount",
    "user_total_txns",
    "user_typical_ben_count",
    "user_txn_freq_per_week",
    "days_since_last_txn",
    # C. Account/device context
    "is_new_device",
    "device_trusted",
    "recent_password_change",
    "recent_sim_swap",
    "recent_email_change",
    "recent_pin_change",
    "account_events_48h",
    "recent_beneficiary_additions_24h",
    # D. H.I.V.E. intelligence
    "hive_recipient_flagged",
    "hive_signal_severity",
    "hive_hours_since_alert",
    "hive_scam_category_match",
    # E. Network features
    "recipient_suspicious_neighbor_count",
]


def _base_row(is_fraud: int) -> dict:
    """Shared random base — every field randomized, then scenarios override."""
    amount = random.lognormvariate(7.5, 1.5)
    amount = max(50, min(amount, 200000))
    user_avg = random.lognormvariate(6.5, 0.8)
    user_avg = max(200, min(user_avg, 30000))
    user_max = user_avg * random.uniform(2, 6)
    return {
        "amount": round(amount, 2),
        "amount_to_avg_ratio": round(amount / user_avg, 2),
        "amount_to_max_ratio": round(amount / max(user_max, 1), 2),
        "is_new_beneficiary": random.choice([0, 0, 0, 1]),
        "beneficiary_age_days": random.randint(0, 400),
        "beneficiary_verified": random.choice([0, 1, 1, 1]),
        "txn_hour": random.randint(0, 23),
        "is_unusual_hour": 1 if random.random() < 0.1 else 0,
        "txn_frequency_24h": random.randint(0, 5),
        "txn_velocity_1h": random.randint(0, 3),
        "user_avg_amount": round(user_avg, 2),
        "user_median_amount": round(user_avg * random.uniform(0.7, 0.95), 2),
        "user_max_amount": round(user_max, 2),
        "user_total_txns": random.randint(3, 250),
        "user_typical_ben_count": random.randint(2, 20),
        "user_txn_freq_per_week": round(random.uniform(0.5, 8), 1),
        "days_since_last_txn": random.randint(0, 14),
        "is_new_device": random.choice([0, 0, 0, 1]),
        "device_trusted": random.choice([0, 1, 1]),
        "recent_password_change": 1 if random.random() < 0.08 else 0,
        "recent_sim_swap": 1 if random.random() < 0.03 else 0,
        "recent_email_change": 1 if random.random() < 0.06 else 0,
        "recent_pin_change": 1 if random.random() < 0.07 else 0,
        "account_events_48h": random.randint(0, 2),
        "recent_beneficiary_additions_24h": random.randint(0, 2),
        "hive_recipient_flagged": 1 if random.random() < 0.05 else 0,
        "hive_signal_severity": 0,
        "hive_hours_since_alert": -1,
        "hive_scam_category_match": 0,
        "recipient_suspicious_neighbor_count": random.randint(0, 2),
        "is_fraud": is_fraud,
    }


def _generate_legitimate_normal():
    """Normal everyday transaction."""
    r = _base_row(0)
    r["amount"] = round(random.lognormvariate(6.2, 0.8), 2)
    r["amount"] = max(50, min(r["amount"], 8000))
    avg = random.uniform(300, 2000)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(avg * random.uniform(2, 5), 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / r["user_max_amount"], 2)
    r["is_new_beneficiary"] = 0 if random.random() < 0.8 else 1
    r["beneficiary_age_days"] = random.randint(5, 365)
    r["beneficiary_verified"] = 1 if random.random() < 0.85 else 0
    r["hive_recipient_flagged"] = 0
    r["hive_signal_severity"] = 0
    return r


def _generate_legitimate_large():
    """Legitimate large payment — to long-term verified beneficiary."""
    r = _base_row(0)
    r["amount"] = round(random.uniform(10000, 150000), 2)
    avg = random.uniform(5000, 25000)
    mx = max(r["amount"] * 0.9, avg * 3)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(mx, 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / mx, 2)
    r["is_new_beneficiary"] = 0
    r["beneficiary_age_days"] = random.randint(60, 730)
    r["beneficiary_verified"] = 1
    r["user_total_txns"] = random.randint(40, 300)
    r["hive_recipient_flagged"] = 0
    return r


def _generate_legitimate_noisy():
    """Legitimate but with individual risk factors (new device, slightly high amount).
    Overlaps with fraud feature space — the model must learn NOT to block these."""
    r = _base_row(0)
    r["amount"] = round(random.uniform(2000, 30000), 2)
    avg = random.uniform(800, 5000)
    mx = avg * random.uniform(2, 5)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(mx, 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / mx, 2)
    r["is_new_beneficiary"] = random.choice([0, 0, 1])
    r["beneficiary_age_days"] = random.randint(0, 90)
    r["beneficiary_verified"] = random.choice([0, 1])
    r["is_new_device"] = random.choice([0, 1])
    r["device_trusted"] = random.choice([0, 1])
    r["recent_password_change"] = 1 if random.random() < 0.15 else 0
    r["recent_pin_change"] = 1 if random.random() < 0.12 else 0
    r["account_events_48h"] = random.randint(0, 2)
    r["recent_beneficiary_additions_24h"] = random.randint(0, 2)
    r["recipient_suspicious_neighbor_count"] = random.randint(0, 1)
    r["hive_recipient_flagged"] = 0
    return r


def _generate_fraud_new_ben_large():
    """Suspicious: new beneficiary + unusual amount. Some overlap with legit noisy."""
    r = _base_row(1)
    r["amount"] = round(random.uniform(8000, 80000), 2)
    avg = random.uniform(400, 2500)
    mx = avg * random.uniform(1.8, 3)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(mx, 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / mx, 2)
    r["is_new_beneficiary"] = 1
    r["beneficiary_age_days"] = 0
    r["beneficiary_verified"] = 0
    r["txn_frequency_24h"] = random.randint(1, 5)
    r["recent_beneficiary_additions_24h"] = random.randint(1, 4)
    r["is_new_device"] = random.choice([0, 0, 1])
    r["device_trusted"] = random.choice([0, 1])
    r["recent_password_change"] = 1 if random.random() < 0.25 else 0
    r["recipient_suspicious_neighbor_count"] = random.randint(0, 3)
    return r


def _generate_fraud_hive_flagged():
    """H.I.V.E. scam signal on recipient + unusual transaction."""
    r = _base_row(1)
    r["amount"] = round(random.uniform(3000, 100000), 2)
    avg = random.uniform(400, 4000)
    mx = avg * random.uniform(2, 4)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(mx, 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / mx, 2)
    r["beneficiary_age_days"] = random.randint(0, 14)
    r["beneficiary_verified"] = 0
    r["hive_recipient_flagged"] = 1
    r["hive_signal_severity"] = random.choice([2, 3, 3, 4])
    r["hive_hours_since_alert"] = random.randint(0, 60)
    r["hive_scam_category_match"] = random.choice([0, 1, 1])
    r["recipient_suspicious_neighbor_count"] = random.randint(1, 6)
    r["recent_beneficiary_additions_24h"] = random.randint(0, 3)
    return r


def _generate_fraud_account_takeover():
    """Account takeover: new device + credential changes + rapid transactions."""
    r = _base_row(1)
    r["amount"] = round(random.uniform(5000, 60000), 2)
    avg = random.uniform(500, 3000)
    mx = avg * random.uniform(2, 3)
    r["user_avg_amount"] = round(avg, 2)
    r["user_max_amount"] = round(mx, 2)
    r["amount_to_avg_ratio"] = round(r["amount"] / avg, 2)
    r["amount_to_max_ratio"] = round(r["amount"] / mx, 2)
    r["is_new_beneficiary"] = 1
    r["beneficiary_age_days"] = 0
    r["beneficiary_verified"] = 0
    r["is_new_device"] = 1
    r["device_trusted"] = 0
    r["recent_password_change"] = 1
    r["recent_sim_swap"] = random.choice([0, 1])
    r["recent_email_change"] = random.choice([0, 1])
    r["account_events_48h"] = random.randint(2, 5)
    r["recent_beneficiary_additions_24h"] = random.randint(1, 5)
    r["txn_frequency_24h"] = random.randint(3, 8)
    r["txn_velocity_1h"] = random.randint(2, 5)
    return r


def generate_dataset(n_samples: int = N_SAMPLES, seed: int = SEED) -> list[dict]:
    random.seed(seed)
    np.random.seed(seed)

    generators = [
        (_generate_legitimate_normal, 0.40),
        (_generate_legitimate_large, 0.15),
        (_generate_legitimate_noisy, 0.20),
        (_generate_fraud_new_ben_large, 0.08),
        (_generate_fraud_hive_flagged, 0.10),
        (_generate_fraud_account_takeover, 0.07),
    ]

    data = []
    for gen_fn, ratio in generators:
        count = int(n_samples * ratio)
        for _ in range(count):
            data.append(gen_fn())

    while len(data) < n_samples:
        gen_fn = random.choice([g for g, _ in generators])
        data.append(gen_fn())

    random.shuffle(data)
    return data


def save_dataset(path: Path | None = None):
    path = path or OUTPUT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)

    data = generate_dataset()
    fieldnames = FEATURES + ["is_fraud"]

    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(data)

    fraud_count = sum(1 for d in data if d["is_fraud"] == 1)
    legit_count = len(data) - fraud_count
    print(f"Dataset saved to {path}")
    print(f"  Total: {len(data)} samples")
    print(f"  Legitimate: {legit_count} ({legit_count/len(data):.1%})")
    print(f"  Fraud: {fraud_count} ({fraud_count/len(data):.1%})")
    return path


if __name__ == "__main__":
    save_dataset()
