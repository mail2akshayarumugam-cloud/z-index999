"""Tests for the API endpoints using TestClient."""
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite+aiosqlite:///./test_api.db"


@pytest.fixture(scope="module")
async def setup_db():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(setup_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["service"] == "scam-shield"


@pytest.mark.asyncio
async def test_analyze_legitimate_message(client):
    resp = await client.post("/api/hive/analyze", json={
        "message": "Hey, want to grab lunch tomorrow at noon?",
        "user_id": "api-test-user-1",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_scam"] is False
    assert data["risk_level"] == "low"
    assert data["notification"]["severity"] == "info"


@pytest.mark.asyncio
async def test_analyze_scam_message(client):
    resp = await client.post("/api/hive/analyze", json={
        "message": (
            "URGENT! Your ICICI account is blocked. Transfer ₹2,000 "
            "to verify@paytm immediately or account will be closed!"
        ),
        "user_id": "api-test-user-2",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_scam"] is True
    assert data["confidence"] >= 0.4
    assert data["risk_level"] in ("medium", "high", "critical")
    assert data["notification"]["severity"] in ("warning", "high", "critical")
    assert data["risk_signal"]["signal_type"] == "scam_detected"
    assert data["risk_signal"]["status"] == "active"


@pytest.mark.asyncio
async def test_get_notifications(client):
    resp = await client.post("/api/hive/analyze", json={
        "message": "Congratulations! You won a free iPhone! Call 9999999999",
        "user_id": "api-test-user-3",
    })
    assert resp.status_code == 200

    resp = await client.get("/api/notifications/api-test-user-3")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["user_id"] if "user_id" in data[0] else True


@pytest.mark.asyncio
async def test_get_risk_signals(client):
    resp = await client.post("/api/hive/analyze", json={
        "message": "Pay ₹5000 to fraud@ybl urgently to verify your account",
        "user_id": "api-test-user-4",
    })
    assert resp.status_code == 200

    resp = await client.get("/api/risk-signals/api-test-user-4")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 1
    assert data[0]["signal_type"] == "scam_detected"


@pytest.mark.asyncio
async def test_create_manual_notification(client):
    resp = await client.post("/api/notifications", json={
        "user_id": "api-test-user-5",
        "title": "Test Alert",
        "body": "This is a test notification",
        "severity": "info",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "created"
