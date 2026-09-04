import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text
from app.config import settings
from app.database import create_tables, engine
from app.routers import auth, authority, hive, email_monitor, notifications, risk_signals, transactions, risk, demo, dashboard
from app.services.hive_sync import sync_loop


async def _migrate_card_columns():
    async with engine.begin() as conn:
        for col in ["card_number VARCHAR(19)", "card_expiry VARCHAR(5)", "card_network VARCHAR(20)"]:
            try:
                await conn.execute(text(f"ALTER TABLE accounts ADD COLUMN IF NOT EXISTS {col}"))
            except Exception:
                pass
        await conn.execute(text("UPDATE accounts SET card_number='4556 5642 0695 5168', card_expiry='09/28', card_network='VISA' WHERE id='acct-arjun' AND card_number IS NULL"))
        await conn.execute(text("UPDATE accounts SET card_number='5425 2334 7810 6291', card_expiry='03/29', card_network='Mastercard' WHERE id='acct-neha' AND card_number IS NULL"))
        await conn.execute(text("UPDATE accounts SET card_number='6011 4912 3456 7890', card_expiry='12/27', card_network='RuPay' WHERE id='acct-vikram' AND card_number IS NULL"))

@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
    await _migrate_card_columns()
    task = asyncio.create_task(sync_loop())
    yield
    task.cancel()


app = FastAPI(
    title="Scam Shield — H.I.V.E. Integration",
    description="Financial protection system powered by H.I.V.E. scam detection",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(authority.router)
app.include_router(hive.router)
app.include_router(email_monitor.router)
app.include_router(notifications.router)
app.include_router(risk_signals.router)
app.include_router(transactions.router)
app.include_router(risk.router)
app.include_router(demo.router)
app.include_router(dashboard.router)


@app.get("/api/health")
async def health():
    import httpx
    hive_ok = False
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"{settings.hive_base_url}/api/health")
            hive_ok = r.status_code == 200
    except Exception:
        pass
    return {
        "status": "healthy",
        "service": "scam-shield",
        "version": "0.1.0",
        "hive_url": settings.hive_base_url,
        "hive_connected": hive_ok,
    }
