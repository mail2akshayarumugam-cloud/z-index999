import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import create_tables
from app.routers import auth, authority, hive, email_monitor, notifications, risk_signals, transactions, risk, demo
from app.services.hive_sync import sync_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_tables()
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
