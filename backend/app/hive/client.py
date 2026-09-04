"""
Enhanced H.I.V.E. scam detection with deep intelligence extraction.

Calls H.I.V.E.'s API at localhost:8000 to analyze messages.
Falls back to a local heuristic analyzer if H.I.V.E. is unreachable.

Intelligence extracted:
  - UPI IDs, phone numbers, URLs, bank names, amounts
  - Scammer alias / claimed name
  - Impersonated organization
  - Threat type (account termination, legal, arrest, etc.)
  - Urgency deadline ("tonight", "24 hours", etc.)
  - Promised returns (for investment scams)
  - Account numbers / IFSC codes
  - Scam tactics used
"""
import re
import httpx
from typing import Optional
from pydantic import BaseModel, Field

from app.config import settings


class ExtractedEntities(BaseModel):
    upi_ids: list[str] = Field(default_factory=list)
    phone_numbers: list[str] = Field(default_factory=list)
    urls: list[str] = Field(default_factory=list)
    bank_names: list[str] = Field(default_factory=list)
    amounts: list[str] = Field(default_factory=list)


class ScammerIntelligence(BaseModel):
    scammer_alias: Optional[str] = None
    impersonated_org: Optional[str] = None
    threat_type: Optional[str] = None
    urgency_deadline: Optional[str] = None
    promised_returns: Optional[str] = None
    account_numbers: list[str] = Field(default_factory=list)
    ifsc_codes: list[str] = Field(default_factory=list)
    tactics: list[str] = Field(default_factory=list)
    target_victim_profile: Optional[str] = None
    communication_channel: str = "whatsapp"


class AnalysisResult(BaseModel):
    is_scam: bool
    confidence: float = Field(ge=0.0, le=1.0)
    scam_type: Optional[str] = None
    risk_level: str = "low"
    urgency: str = "low"
    entities: ExtractedEntities = Field(default_factory=ExtractedEntities)
    intelligence: ScammerIntelligence = Field(default_factory=ScammerIntelligence)
    reasons: list[str] = Field(default_factory=list)
    explanation: str = ""
    key_indicators: list[str] = Field(default_factory=list)
    raw_hive_response: Optional[dict] = None


_UPI_PATTERN = re.compile(r"[a-zA-Z0-9.\-_]+@[a-zA-Z][a-zA-Z0-9.]{1,}")
_PHONE_PATTERN = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}")
_URL_PATTERN = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+")
_AMOUNT_PATTERN = re.compile(r"(?:₹|Rs\.?|INR)\s?[\d,]+(?:\.\d{2})?")
_ACCOUNT_PATTERN = re.compile(r"\b\d{9,18}\b")
_IFSC_PATTERN = re.compile(r"\b[A-Z]{4}0[A-Z0-9]{6}\b")
_RETURNS_PATTERN = re.compile(r"(\d+(?:\.\d+)?)\s*%\s*(?:return|interest|profit|monthly|daily|weekly|guaranteed)", re.I)
_DEADLINE_PATTERN = re.compile(r"(?:within|before|by|till|until)\s+(today|tonight|tomorrow|\d+\s*(?:hour|hr|min|day)s?|midnight|\d{1,2}[:.]\d{2}\s*(?:am|pm)?)", re.I)

_BANK_NAMES = [
    "sbi", "hdfc", "icici", "axis", "kotak", "pnb", "bob", "canara",
    "union bank", "idbi", "yes bank", "indusind", "federal bank", "rbl",
    "paytm", "phonepe", "gpay", "google pay", "bhim",
]

_NAME_PATTERNS = [
    re.compile(r"(?:this is|i am|i'm|myself|my name is|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)", re.I),
    re.compile(r"(?:call me|contact)\s+([A-Z][a-z]+)", re.I),
    re.compile(r"(?:—|–|-)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*$", re.M),
]

_ORG_PATTERNS = [
    re.compile(r"(?:from|of)\s+((?:SBI|HDFC|ICICI|Axis|Kotak|PNB|RBI|Paytm|PhonePe|Google Pay|BHIM|NPCI)\s*(?:Bank)?(?:\s+(?:Premium|Investment|Customer|Support|Desk|Team|Service|Care|Department))*)", re.I),
    re.compile(r"((?:Income Tax|IT|CBI|Police|Customs|RBI|TRAI|SEBI|Government|Ministry)\s*(?:Department|Office|Authority|of India)?)", re.I),
]

_THREAT_KEYWORDS = {
    "account_termination": ["terminate", "termination", "close your account", "deactivate", "suspend", "block your", "freeze"],
    "legal_action": ["legal action", "court", "lawsuit", "police complaint", "fir", "arrest", "warrant", "case filed"],
    "financial_loss": ["0 balance", "zero balance", "lost all", "account hacked", "unauthorized", "debited"],
    "service_cutoff": ["disconnect", "cut off", "stop service", "cancel your", "subscription cancel"],
    "identity_theft": ["aadhaar", "pan card", "identity", "kyc expired", "documents expired"],
}

_SCAM_INDICATORS = {
    "urgency": [
        "urgent", "immediately", "now", "hurry", "expire", "limited",
        "last chance", "act now", "asap", "within 24",
    ],
    "payment": [
        "pay", "payment", "transfer", "send money", "deposit", "refund",
        "verification fee", "processing fee", "registration fee",
    ],
    "reward": [
        "congratulations", "winner", "won", "prize", "lottery", "reward",
        "selected", "lucky", "jackpot", "free", "gift",
    ],
    "impersonation": [
        "bank manager", "government", "official", "authority", "police",
        "customs", "customer care", "technical support", "whatsapp support",
    ],
    "verification": [
        "verify", "verification", "confirm your", "update kyc", "kyc",
        "authenticate", "security check", "account verification",
    ],
    "investment": [
        "invest", "investment", "returns", "profit", "guaranteed",
        "scheme", "mutual fund", "stock", "trading", "crypto", "bitcoin",
    ],
    "otp_phishing": [
        "otp", "one time password", "share otp", "send otp", "tell otp",
        "verification code", "pin number", "share pin",
    ],
}


def _extract_entities(text: str) -> ExtractedEntities:
    clean = re.sub(r'[*_~`]', '', text)
    lower = clean.lower()
    return ExtractedEntities(
        upi_ids=_UPI_PATTERN.findall(clean),
        phone_numbers=_PHONE_PATTERN.findall(clean),
        urls=_URL_PATTERN.findall(clean),
        bank_names=[b for b in _BANK_NAMES if b in lower],
        amounts=_AMOUNT_PATTERN.findall(clean),
    )


def _extract_intelligence(text: str, entities: ExtractedEntities, scam_type: str | None) -> ScammerIntelligence:
    lower = text.lower()
    intel = ScammerIntelligence()

    for pat in _NAME_PATTERNS:
        m = pat.search(text)
        if m:
            name = m.group(1).strip()
            skip = {"urgent", "dear", "dear customer", "sir", "madam", "hello", "hi"}
            if name.lower() not in skip and len(name) > 2:
                intel.scammer_alias = name
                break

    for pat in _ORG_PATTERNS:
        m = pat.search(text)
        if m:
            intel.impersonated_org = m.group(1).strip()
            break

    for threat_type, keywords in _THREAT_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            intel.threat_type = threat_type
            break

    deadline_m = _DEADLINE_PATTERN.search(text)
    if deadline_m:
        intel.urgency_deadline = deadline_m.group(1).strip()
    elif any(w in lower for w in ["tonight", "today", "right now"]):
        intel.urgency_deadline = "today"

    returns_m = _RETURNS_PATTERN.search(text)
    if returns_m:
        intel.promised_returns = f"{returns_m.group(1)}% returns"

    acct_nums = _ACCOUNT_PATTERN.findall(text)
    phones_set = set(entities.phone_numbers)
    intel.account_numbers = [a for a in acct_nums if a not in phones_set and len(a) >= 10][:3]

    intel.ifsc_codes = _IFSC_PATTERN.findall(text)[:3]

    tactics = []
    for category, keywords in _SCAM_INDICATORS.items():
        if any(kw in lower for kw in keywords):
            tactics.append(category)
    intel.tactics = tactics

    if "otp" in lower or "pin" in lower or "password" in lower:
        intel.target_victim_profile = "credential_harvest"
    elif any(w in lower for w in ["elderly", "senior", "retired"]):
        intel.target_victim_profile = "elderly_targeting"
    elif intel.promised_returns:
        intel.target_victim_profile = "investment_naive"

    return intel


def _local_analyze(message: str) -> AnalysisResult:
    """Fallback heuristic analysis when H.I.V.E. API is unavailable."""
    lower = message.lower()
    entities = _extract_entities(message)

    reasons = []
    score = 0.0

    for category, keywords in _SCAM_INDICATORS.items():
        matched = [kw for kw in keywords if kw in lower]
        if matched:
            reasons.append(f"{category}: {', '.join(matched[:3])}")
            score += 0.2 * len(matched)

    if entities.upi_ids:
        score += 0.15
        reasons.append(f"UPI ID found: {', '.join(entities.upi_ids[:2])}")
    if entities.amounts:
        score += 0.1
        reasons.append(f"Money amount: {', '.join(entities.amounts[:2])}")
    if entities.urls:
        score += 0.1
        reasons.append(f"URL found: {', '.join(entities.urls[:2])}")

    confidence = min(score, 0.99)
    is_scam = confidence >= 0.4

    if confidence >= 0.85:
        risk_level, urgency = "critical", "critical"
    elif confidence >= 0.7:
        risk_level, urgency = "high", "high"
    elif confidence >= 0.5:
        risk_level, urgency = "medium", "medium"
    else:
        risk_level, urgency = "low", "low"

    scam_type = None
    if is_scam and reasons:
        scam_type = reasons[0].split(":")[0]

    intelligence = _extract_intelligence(message, entities, scam_type) if is_scam else ScammerIntelligence()

    explanation = (
        f"{'Scam detected' if is_scam else 'No scam detected'} "
        f"(confidence: {confidence:.0%}). "
        + (f"Indicators: {'; '.join(reasons[:3])}." if reasons else "")
    )

    return AnalysisResult(
        is_scam=is_scam,
        confidence=round(confidence, 3),
        scam_type=scam_type,
        risk_level=risk_level,
        urgency=urgency,
        entities=entities,
        intelligence=intelligence,
        reasons=reasons,
        explanation=explanation,
        key_indicators=reasons[:7],
    )


def _parse_hive_response(data: dict) -> AnalysisResult:
    """Parse H.I.V.E. integration API response into our AnalysisResult."""
    risk_level = data.get("risk_level", "low")
    risk_score = data.get("risk_score", 0.0)
    is_suspicious = data.get("is_suspicious", False)

    urgency = risk_level
    if risk_level == "critical":
        urgency = "critical"

    return AnalysisResult(
        is_scam=is_suspicious,
        confidence=round(risk_score, 3),
        scam_type=data.get("scam_category"),
        risk_level=risk_level,
        urgency=urgency,
        entities=ExtractedEntities(),
        intelligence=ScammerIntelligence(),
        reasons=data.get("key_indicators", []),
        explanation=data.get("explanation", ""),
        key_indicators=data.get("key_indicators", []),
        raw_hive_response=data,
    )


async def analyze_message(message: str) -> AnalysisResult:
    """
    Analyze a message for scam indicators.

    Tries the live H.I.V.E. API first. Falls back to local heuristics
    if H.I.V.E. is unreachable (e.g. during development/testing).
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{settings.hive_base_url}/api/v1/integration/process",
                json={
                    "message_text": message,
                    "conversation_id": "scam-shield-session",
                    "message_id": "inline-analysis",
                },
            )
            if resp.status_code == 200:
                return _parse_hive_response(resp.json())
    except (httpx.ConnectError, httpx.TimeoutException, httpx.HTTPError):
        pass

    return _local_analyze(message)
