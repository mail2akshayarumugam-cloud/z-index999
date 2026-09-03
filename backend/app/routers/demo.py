from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.demo_orchestrator import (
    run_scenario, get_metrics, get_audit_trail, SCENARIOS,
)

router = APIRouter(prefix="/api/demo", tags=["demo"])


@router.get("/scenarios")
async def list_scenarios():
    """List available demo scenarios."""
    return {
        key: {
            "title": s["title"],
            "description": s["description"],
            "expected": s["expected"],
            "has_hive_message": s["hive_message"] is not None,
            "transaction_amount": s["transaction"]["amount"],
            "transaction_upi": s["transaction"]["beneficiary_upi"],
        }
        for key, s in SCENARIOS.items()
    }


@router.post("/run/{scenario_key}")
async def execute_scenario(
    scenario_key: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Execute a complete end-to-end demo scenario.

    Returns full timeline with H.I.V.E. detection, notification, risk signal,
    transaction preview, ML risk evaluation, and decision.

    All values are SIMULATED.
    """
    try:
        result = await run_scenario(db, scenario_key)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scenario failed: {str(e)}")


@router.get("/metrics")
async def demo_metrics(db: AsyncSession = Depends(get_db)):
    """
    Aggregate demo metrics from real database state.

    All monetary values are SIMULATED.
    """
    return await get_metrics(db)


@router.get("/audit-trail")
async def audit_trail(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    """Unified audit trail from all system events."""
    return await get_audit_trail(db, limit)
