"""Email monitoring — scan emails for scam indicators via H.I.V.E."""
from typing import Optional
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import Message, ScamDetection
from app.services.analysis_service import run_analysis

router = APIRouter(prefix="/api/email", tags=["email"])


class EmailAnalyzeRequest(BaseModel):
    user_id: str
    sender_email: str
    subject: str
    body: str


@router.post("/analyze")
async def analyze_email(request: EmailAnalyzeRequest, db: AsyncSession = Depends(get_db)):
    full_text = f"Subject: {request.subject}\n\n{request.body}"
    result = await run_analysis(
        db=db,
        user_id=request.user_id,
        message_text=full_text,
        sender=request.sender_email,
        source="email",
    )
    return result


@router.get("/inbox/{user_id}")
async def get_email_inbox(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.user_id == user_id, Message.source == "email")
        .order_by(Message.received_at.desc())
        .limit(20)
    )
    messages = result.scalars().all()

    out = []
    for m in messages:
        det_r = await db.execute(
            select(ScamDetection).where(ScamDetection.message_id == m.id)
        )
        det = det_r.scalar_one_or_none()

        lines = (m.content or "").split("\n", 2)
        subject = lines[0].replace("Subject: ", "") if lines and lines[0].startswith("Subject:") else "No Subject"
        body_preview = lines[2][:150] if len(lines) > 2 else (m.content or "")[:150]

        out.append({
            "id": m.id,
            "sender": m.sender,
            "subject": subject,
            "body_preview": body_preview,
            "received_at": m.received_at.isoformat() if m.received_at else None,
            "is_scam": det.is_scam if det else None,
            "confidence": det.confidence if det else None,
            "risk_level": det.risk_level if det else None,
            "scam_type": det.scam_type if det else None,
            "explanation": det.explanation if det else None,
            "key_indicators": det.key_indicators if det else None,
        })
    return out
