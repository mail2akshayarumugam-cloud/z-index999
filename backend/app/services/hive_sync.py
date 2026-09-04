"""
Background sync: reads H.I.V.E.'s database directly for scam detections
and imports flagged entities into Scam Shield's risk_signals_v2 table.

Runs every 10 seconds. Read-only access to H.I.V.E.'s DB — does NOT modify it.
"""
import asyncio
import httpx
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.database import async_session
from app.models.financial import RiskSignalV2, ScamIntelligence
from app.hive.client import _extract_entities, _extract_intelligence, ExtractedEntities
from app.services.upi_extraction import queue_honeypot

_seen_ids = set()
_running = False

HIVE_DB_URL = settings.database_url.replace("scam_shield_db", "hive_db")
_hive_engine = None


def _get_hive_engine():
    global _hive_engine
    if _hive_engine is None:
        try:
            _hive_engine = create_async_engine(HIVE_DB_URL, echo=False)
        except Exception:
            return None
    return _hive_engine


async def _fetch_hive_detections() -> list[dict]:
    engine = _get_hive_engine()
    if engine:
        try:
            async with engine.connect() as conn:
                rows = await conn.execute(text(
                    "SELECT d.id::text, m.text, d.risk_score, d.is_suspicious, "
                    "d.explanation, d.detected_at, m.sender "
                    "FROM detections d JOIN messages m ON d.message_pk = m.id "
                    "WHERE d.is_suspicious = true "
                    "ORDER BY d.detected_at DESC LIMIT 20"
                ))
                results = []
                for r in rows:
                    score = float(r[2]) if r[2] else 0.5
                    level = "critical" if score >= 0.8 else "high" if score >= 0.6 else "medium"
                    results.append({
                        "detection_id": str(r[0]),
                        "message_text": r[1] or "",
                        "risk_score": score,
                        "risk_level": level,
                        "is_suspicious": bool(r[3]),
                        "explanation": r[4] or "",
                        "detected_at": str(r[5]) if r[5] else "",
                        "sender": r[6] or "",
                    })
                return results
        except Exception:
            pass

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.hive_base_url}/api/v1/dashboard-real/recent-detections",
                params={"limit": 20},
            )
            if resp.status_code == 200:
                data = resp.json()
                return data.get("detections", []) if isinstance(data, dict) else data
    except Exception:
        pass
    return []


async def _sync_once():
    detections = await _fetch_hive_detections()
    if not detections:
        return 0

    imported = 0
    async with async_session() as db:
        for det in detections:
            det_id = det.get("id") or det.get("detection_id") or str(det.get("timestamp", ""))
            if det_id in _seen_ids:
                continue
            _seen_ids.add(det_id)

            is_scam = det.get("is_suspicious") or det.get("is_scam", False)
            if not is_scam:
                continue

            risk_level = det.get("risk_level", "medium")
            scam_type = det.get("scam_category") or det.get("scam_type")
            confidence = det.get("risk_score") or det.get("confidence", 0.5)
            message_text = det.get("message_text") or det.get("content", "")
            explanation = det.get("explanation", "")

            severity = "critical" if risk_level == "critical" else "high" if risk_level == "high" else "medium"
            expires = datetime.now(timezone.utc) + timedelta(hours=72)

            entities = _extract_entities(message_text) if message_text else ExtractedEntities()

            raw_entities = det.get("entities", {})
            if isinstance(raw_entities, dict):
                for upi in raw_entities.get("upi_ids", []):
                    if upi not in [e for e in entities.upi_ids]:
                        entities.upi_ids.append(upi)
                for phone in raw_entities.get("phone_numbers", []):
                    if phone not in entities.phone_numbers:
                        entities.phone_numbers.append(phone)
                for url in raw_entities.get("urls", []):
                    if url not in entities.urls:
                        entities.urls.append(url)

            intel = _extract_intelligence(message_text, entities, scam_type) if message_text else None

            if not entities.upi_ids and message_text:
                queue_honeypot(
                    detection_id=det_id,
                    user_id="user-arjun",
                    scam_type=scam_type,
                    risk_level=risk_level,
                    confidence=confidence,
                    original_message=message_text,
                    sender=det.get("sender", ""),
                    source="sync",
                )

            for upi in entities.upi_ids:
                existing = await db.execute(
                    select(RiskSignalV2).where(
                        RiskSignalV2.entity_type == "upi_id",
                        RiskSignalV2.entity_value == upi,
                        RiskSignalV2.source == "hive_live",
                    )
                )
                if existing.first():
                    continue

                db.add(RiskSignalV2(
                    source="hive_live",
                    source_id=det_id,
                    entity_type="upi_id",
                    entity_value=upi,
                    severity=severity,
                    scam_type=scam_type,
                    details={
                        "confidence": confidence,
                        "explanation": explanation[:300],
                        "synced_from": "hive_extension",
                    },
                    expires_at=expires,
                ))

                if intel:
                    db.add(ScamIntelligence(
                        detection_id=det_id,
                        entity_type="upi_id",
                        entity_value=upi,
                        scammer_alias=intel.scammer_alias,
                        impersonated_org=intel.impersonated_org,
                        threat_type=intel.threat_type,
                        urgency_deadline=intel.urgency_deadline,
                        promised_returns=intel.promised_returns,
                        tactics=intel.tactics or None,
                        target_victim_profile=intel.target_victim_profile,
                        scam_type=scam_type,
                        confidence=confidence,
                        message_snippet=message_text[:500] if message_text else None,
                    ))
                imported += 1

            for phone in entities.phone_numbers:
                existing = await db.execute(
                    select(RiskSignalV2).where(
                        RiskSignalV2.entity_type == "phone",
                        RiskSignalV2.entity_value == phone,
                        RiskSignalV2.source == "hive_live",
                    )
                )
                if existing.first():
                    continue
                db.add(RiskSignalV2(
                    source="hive_live",
                    source_id=det_id,
                    entity_type="phone",
                    entity_value=phone,
                    severity=severity,
                    scam_type=scam_type,
                    details={"confidence": confidence, "synced_from": "hive_extension"},
                    expires_at=expires,
                ))
                imported += 1

            for url in entities.urls:
                existing = await db.execute(
                    select(RiskSignalV2).where(
                        RiskSignalV2.entity_type == "url",
                        RiskSignalV2.entity_value == url,
                        RiskSignalV2.source == "hive_live",
                    )
                )
                if existing.first():
                    continue
                db.add(RiskSignalV2(
                    source="hive_live",
                    source_id=det_id,
                    entity_type="url",
                    entity_value=url,
                    severity=severity,
                    scam_type=scam_type,
                    details={"confidence": confidence, "synced_from": "hive_extension"},
                    expires_at=expires,
                ))
                imported += 1

        if imported > 0:
            await db.commit()

    return imported


async def sync_loop():
    global _running
    if _running:
        return
    _running = True
    while True:
        try:
            count = await _sync_once()
            if count > 0:
                print(f"[HIVE SYNC] Imported {count} new risk signal(s) from H.I.V.E.")
        except Exception as e:
            print(f"[HIVE SYNC] Error: {e}")
        await asyncio.sleep(10)
