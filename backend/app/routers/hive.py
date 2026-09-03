from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.analysis_service import run_analysis
from app.routers.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter(prefix="/api/hive", tags=["hive"])


@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_message(
    request: AnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Analyze a message using H.I.V.E. scam detection.

    Pipeline: message → H.I.V.E. detection → DB storage → notification → bank risk signal
    """
    result = await run_analysis(
        db=db,
        user_id=request.user_id,
        message_text=request.message,
        sender=request.sender,
        source=request.source,
    )
    return result
