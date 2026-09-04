from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.analysis_service import run_analysis
from app.services.upi_extraction import (
    queue_honeypot,
    get_pending,
    get_active,
    get_session,
    handle_consent,
    start_honeypot,
    poll_conversation,
)
from app.routers.schemas import AnalyzeRequest

router = APIRouter(prefix="/api/hive", tags=["hive"])


@router.post("/analyze")
async def analyze_message(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await run_analysis(
        db=db,
        user_id=request.user_id,
        message_text=request.message,
        sender=request.sender,
        source=request.source,
    )
    upi_ids = result.get("entities", {}).get("upi_ids", [])
    result["needs_upi_extraction"] = result.get("is_scam", False) and not upi_ids

    if result["needs_upi_extraction"]:
        session_id = queue_honeypot(
            detection_id=result.get("detection_id", ""),
            user_id=request.user_id,
            scam_type=result.get("scam_type"),
            risk_level=result.get("risk_level", "medium"),
            confidence=result.get("confidence", 0.5),
            original_message=request.message,
            sender=request.sender or "",
            source="manual",
        )
        result["honeypot_session_id"] = session_id

    return result


@router.get("/honeypots/pending")
async def honeypots_pending():
    return get_pending()


@router.get("/honeypots/active")
async def honeypots_active():
    return get_active()


class ConsentRequest(BaseModel):
    session_id: str
    consented: bool


@router.post("/extract-upi/consent")
async def extraction_consent(req: ConsentRequest):
    result = handle_consent(req.session_id, req.consented)
    if result.get("state") == "starting":
        return await start_honeypot(req.session_id)
    return result


@router.post("/extract-upi/poll/{session_id}")
async def extraction_poll(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await poll_conversation(session_id, db)


@router.get("/extract-upi/{session_id}")
async def get_extraction(session_id: str):
    session = get_session(session_id)
    if not session:
        return {"error": "Session not found"}
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
