"""
Bridge between H.I.V.E. scam detections (Phase 1) and Model 2 risk signals (Phase 2).

When H.I.V.E. detects a scam, this module:
  1. Creates RiskSignalV2 records for each flagged entity (UPI, phone, URL)
  2. Stores structured scammer intelligence in the scam_intelligence table
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.hive.client import AnalysisResult
from app.models.financial import RiskSignalV2, ScamIntelligence


_SEVERITY_FROM_RISK = {
    "critical": "critical",
    "high": "high",
    "medium": "medium",
    "low": "low",
}


async def bridge_hive_to_risk_signals(
    db: AsyncSession,
    detection_id: str,
    user_id: str,
    result: AnalysisResult,
) -> list[RiskSignalV2]:
    if not result.is_scam:
        return []

    signals: list[RiskSignalV2] = []
    severity = _SEVERITY_FROM_RISK.get(result.risk_level, "medium")
    expires = datetime.now(timezone.utc) + timedelta(hours=72)
    ent = result.entities
    intel = result.intelligence

    intel_details = {
        "reasons": result.reasons[:5],
        "confidence": result.confidence,
    }
    if intel.scammer_alias:
        intel_details["scammer_alias"] = intel.scammer_alias
    if intel.impersonated_org:
        intel_details["impersonated_org"] = intel.impersonated_org
    if intel.threat_type:
        intel_details["threat_type"] = intel.threat_type
    if intel.tactics:
        intel_details["tactics"] = intel.tactics

    for upi in ent.upi_ids:
        signals.append(RiskSignalV2(
            source="hive",
            source_id=detection_id,
            user_id=user_id,
            entity_type="upi_id",
            entity_value=upi,
            severity=severity,
            scam_type=result.scam_type,
            details=intel_details,
            expires_at=expires,
        ))
        db.add(ScamIntelligence(
            detection_id=detection_id,
            entity_type="upi_id",
            entity_value=upi,
            scammer_alias=intel.scammer_alias,
            impersonated_org=intel.impersonated_org,
            threat_type=intel.threat_type,
            urgency_deadline=intel.urgency_deadline,
            promised_returns=intel.promised_returns,
            account_numbers=intel.account_numbers or None,
            ifsc_codes=intel.ifsc_codes or None,
            tactics=intel.tactics or None,
            target_victim_profile=intel.target_victim_profile,
            scam_type=result.scam_type,
            confidence=result.confidence,
            message_snippet=result.explanation[:500] if result.explanation else None,
        ))

    for phone in ent.phone_numbers:
        signals.append(RiskSignalV2(
            source="hive",
            source_id=detection_id,
            user_id=user_id,
            entity_type="phone",
            entity_value=phone,
            severity=severity,
            scam_type=result.scam_type,
            details=intel_details,
            expires_at=expires,
        ))
        db.add(ScamIntelligence(
            detection_id=detection_id,
            entity_type="phone",
            entity_value=phone,
            scammer_alias=intel.scammer_alias,
            impersonated_org=intel.impersonated_org,
            threat_type=intel.threat_type,
            tactics=intel.tactics or None,
            scam_type=result.scam_type,
            confidence=result.confidence,
        ))

    for url in ent.urls:
        signals.append(RiskSignalV2(
            source="hive",
            source_id=detection_id,
            user_id=user_id,
            entity_type="url",
            entity_value=url,
            severity=severity,
            scam_type=result.scam_type,
            details=intel_details,
            expires_at=expires,
        ))

    for sig in signals:
        db.add(sig)
    if signals:
        await db.flush()

    return signals
