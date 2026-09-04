"""
UPI extraction via H.I.V.E.'s live honeypot.

When a scam is detected without a UPI ID (via auto-sync or manual scan),
this service:
  1. Queues it as a pending honeypot (needs user consent)
  2. On consent, starts a honeypot conversation on H.I.V.E. (localhost:8000)
  3. H.I.V.E.'s Chrome extension auto-reads/sends WhatsApp messages
  4. Scam Shield polls the conversation for extracted intelligence
  5. When a UPI ID appears, auto-creates risk signals in Scam Shield
"""
import asyncio
import uuid
import httpx
from datetime import datetime, timezone, timedelta
from dataclasses import dataclass, field

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.financial import RiskSignalV2, ScamIntelligence
from app.services.hive_signal_bridge import _SEVERITY_FROM_RISK
from app.config import settings

HIVE_URL = settings.hive_base_url

_SCAM_TYPE_TO_PERSONA = {
    "investment": "freelancer",
    "crypto": "freelancer",
    "trading": "freelancer",
    "job": "job_seeker_student",
    "lottery": "job_seeker_student",
    "reward": "job_seeker_student",
    "prize": "job_seeker_student",
}


@dataclass
class ExtractionSession:
    id: str
    detection_id: str
    user_id: str
    scam_type: str | None
    risk_level: str
    confidence: float
    original_message: str
    sender: str
    source: str  # "sync" or "manual"
    state: str = "consent_pending"
    hive_conversation_id: str | None = None
    persona_name: str = ""
    messages: list[dict] = field(default_factory=list)
    extracted_upis: list[str] = field(default_factory=list)
    all_intelligence: list[dict] = field(default_factory=list)
    turn: int = 0
    max_turns: int = 5
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


_sessions: dict[str, ExtractionSession] = {}

_pending_queue: list[str] = []


def _pick_persona(scam_type: str | None) -> str:
    if scam_type:
        for key, persona in _SCAM_TYPE_TO_PERSONA.items():
            if key in scam_type.lower():
                return persona
    return "job_seeker_student"


def queue_honeypot(
    detection_id: str,
    user_id: str,
    scam_type: str | None,
    risk_level: str,
    confidence: float,
    original_message: str,
    sender: str = "",
    source: str = "sync",
) -> str:
    """Queue a pending honeypot from auto-sync or manual scan. Returns session_id."""
    for sid in _pending_queue:
        s = _sessions.get(sid)
        if s and s.detection_id == detection_id:
            return sid

    session_id = str(uuid.uuid4())
    session = ExtractionSession(
        id=session_id,
        detection_id=detection_id,
        user_id=user_id or "user-arjun",
        scam_type=scam_type,
        risk_level=risk_level,
        confidence=confidence,
        original_message=original_message,
        sender=sender,
        source=source,
    )
    session.messages.append({
        "role": "system",
        "text": (
            f"Scam detected from **{sender or 'unknown sender'}** "
            f"but no UPI ID found. H.I.V.E. can automatically engage "
            f"the scammer to extract their payment details.\n\n"
            f"**Do you consent to H.I.V.E. running a honeypot?**"
        ),
    })
    _sessions[session_id] = session
    _pending_queue.append(session_id)
    return session_id


def get_pending() -> list[dict]:
    """Get all pending honeypot sessions awaiting consent."""
    result = []
    for sid in list(_pending_queue):
        s = _sessions.get(sid)
        if not s:
            _pending_queue.remove(sid)
            continue
        if s.state != "consent_pending":
            continue
        result.append({
            "session_id": s.id,
            "detection_id": s.detection_id,
            "sender": s.sender,
            "scam_type": s.scam_type,
            "risk_level": s.risk_level,
            "confidence": s.confidence,
            "message_preview": s.original_message[:200],
            "source": s.source,
            "created_at": s.created_at.isoformat(),
        })
    return result


def get_active() -> list[dict]:
    """Get all active honeypot sessions (running conversations)."""
    return [
        _session_response(s)
        for s in _sessions.values()
        if s.state in ("active", "extracted", "exhausted")
    ]


def get_session(session_id: str) -> ExtractionSession | None:
    return _sessions.get(session_id)


def handle_consent(session_id: str, consented: bool) -> dict:
    session = _sessions.get(session_id)
    if not session or session.state != "consent_pending":
        return {"error": "Invalid session or state"}

    if sid_in_queue(session_id):
        _pending_queue.remove(session_id)

    if not consented:
        session.state = "cancelled"
        session.messages.append({
            "role": "system",
            "text": "Conversation cancelled. The scam is still flagged.",
        })
        return _session_response(session)

    session.state = "starting"
    return _session_response(session)


def sid_in_queue(sid: str) -> bool:
    return sid in _pending_queue


async def start_honeypot(session_id: str) -> dict:
    """Start the honeypot on H.I.V.E. and get the first persona response."""
    session = _sessions.get(session_id)
    if not session or session.state != "starting":
        return {"error": "Invalid session or state"}

    persona_type = _pick_persona(session.scam_type)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{HIVE_URL}/api/v1/honeypot-live/start",
                json={
                    "initial_scammer_message": session.original_message,
                    "persona_type": persona_type,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                session.hive_conversation_id = data["conversation_id"]
                session.persona_name = data["persona_name"]
                session.turn = data["turn_count"]

                session.messages.append({
                    "role": "scammer",
                    "text": session.original_message,
                })
                session.messages.append({
                    "role": "persona",
                    "text": data["ai_response"],
                    "persona": data["persona_name"],
                })

                _process_intelligence(session, data.get("extracted_intelligence", []))
                session.state = "active"
                return _session_response(session)

            session.state = "error"
            session.messages.append({
                "role": "system",
                "text": f"H.I.V.E. honeypot failed (HTTP {resp.status_code}). "
                        "Ensure H.I.V.E. and Ollama are running.",
            })
            return _session_response(session)

    except (httpx.ConnectError, httpx.TimeoutException):
        session.state = "error"
        session.messages.append({
            "role": "system",
            "text": f"Cannot reach H.I.V.E. at {HIVE_URL}. "
                    "Ensure H.I.V.E. backend and Ollama are running.",
        })
        return _session_response(session)


async def poll_conversation(session_id: str, db: AsyncSession) -> dict:
    """Poll H.I.V.E. for conversation updates."""
    session = _sessions.get(session_id)
    if not session or not session.hive_conversation_id:
        return {"error": "Invalid session"}

    if session.state not in ("active",):
        return _session_response(session)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{HIVE_URL}/api/v1/honeypot-live/conversation/{session.hive_conversation_id}",
            )
            if resp.status_code != 200:
                return _session_response(session)

            data = resp.json()
            history = data.get("conversation_history", [])
            intelligence = data.get("extracted_intelligence", [])
            session.turn = data.get("turn_count", session.turn)

            current_msg_count = len([m for m in session.messages if m["role"] in ("scammer", "persona")])
            if len(history) > current_msg_count:
                for msg in history[current_msg_count:]:
                    if msg["role"] == "scammer":
                        session.messages.append({"role": "scammer", "text": msg["content"]})
                    elif msg["role"] == "ai":
                        session.messages.append({
                            "role": "persona",
                            "text": msg["content"],
                            "persona": session.persona_name,
                        })

            new_upis = _process_intelligence(session, intelligence)

            if new_upis:
                session.state = "extracted"
                await _flag_extracted_upis(db, session, new_upis)
                upi_display = ", ".join(new_upis)
                session.messages.append({
                    "role": "system",
                    "text": (
                        f"UPI ID extracted: **{upi_display}**\n"
                        "Flagged in Scam Shield — payments blocked."
                    ),
                })
            elif session.turn >= session.max_turns:
                session.state = "exhausted"
                session.messages.append({
                    "role": "system",
                    "text": "Max turns reached. Scam is still flagged.",
                })

    except (httpx.ConnectError, httpx.TimeoutException):
        pass

    return _session_response(session)


def _process_intelligence(session: ExtractionSession, intelligence: list[dict]) -> list[str]:
    new_upis = []
    for item in intelligence:
        if not any(
            e["type"] == item["type"] and e["value"] == item["value"]
            for e in session.all_intelligence
        ):
            session.all_intelligence.append(item)

        if item["type"] == "upi_id" and item["value"] not in session.extracted_upis:
            session.extracted_upis.append(item["value"])
            new_upis.append(item["value"])

    return new_upis


async def _flag_extracted_upis(
    db: AsyncSession,
    session: ExtractionSession,
    upis: list[str],
) -> None:
    severity = _SEVERITY_FROM_RISK.get(session.risk_level, "medium")
    expires = datetime.now(timezone.utc) + timedelta(hours=72)

    for upi in upis:
        db.add(RiskSignalV2(
            source="hive_honeypot",
            source_id=session.detection_id,
            user_id=session.user_id,
            entity_type="upi_id",
            entity_value=upi,
            severity=severity,
            scam_type=session.scam_type,
            details={
                "extraction_method": "honeypot_live",
                "persona": session.persona_name,
                "confidence": session.confidence,
                "turns": session.turn,
                "hive_conversation_id": session.hive_conversation_id,
            },
            expires_at=expires,
        ))
        db.add(ScamIntelligence(
            detection_id=session.detection_id,
            entity_type="upi_id",
            entity_value=upi,
            scam_type=session.scam_type,
            confidence=session.confidence,
            message_snippet=f"Honeypot ({session.persona_name}), turn {session.turn}",
        ))

    await db.flush()
    await db.commit()


def _session_response(session: ExtractionSession) -> dict:
    return {
        "session_id": session.id,
        "state": session.state,
        "detection_id": session.detection_id,
        "sender": session.sender,
        "persona": session.persona_name,
        "hive_conversation_id": session.hive_conversation_id,
        "messages": session.messages,
        "extracted_upis": session.extracted_upis,
        "intelligence": session.all_intelligence,
        "turn": session.turn,
        "max_turns": session.max_turns,
        "source": session.source,
    }
