import hashlib
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.tables import User
from app.models.financial import Account

router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return hash_password(password) == password_hash


class LoginRequest(BaseModel):
    identifier: str
    password: str


@router.post("/login")
async def login(request: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            or_(
                User.email == request.identifier,
                User.phone_number == request.identifier,
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    if not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email/phone or password")

    acct_result = await db.execute(
        select(Account).where(Account.user_id == user.id).limit(1)
    )
    account = acct_result.scalar_one_or_none()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone_number,
        "role": user.role or "user",
        "upi": account.upi_id if account else None,
        "balance": str(account.balance) if account else "0",
    }


class VerifyPinRequest(BaseModel):
    user_id: str
    pin: str


@router.post("/verify-pin")
async def verify_pin(request: VerifyPinRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.upi_pin_hash:
        raise HTTPException(status_code=401, detail="Invalid UPI PIN")
    if not verify_password(request.pin, user.upi_pin_hash):
        raise HTTPException(status_code=401, detail="Invalid UPI PIN")
    return {"verified": True}


@router.get("/security-question/{user_id}")
async def get_security_question(user_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.security_question:
        raise HTTPException(status_code=404, detail="No security question set")
    return {"question": user.security_question}


class VerifySecurityRequest(BaseModel):
    user_id: str
    answer: str


@router.post("/verify-security")
async def verify_security_answer(request: VerifySecurityRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user or not user.security_answer_hash:
        raise HTTPException(status_code=401, detail="Incorrect answer")
    if not verify_password(request.answer.strip().lower(), user.security_answer_hash):
        raise HTTPException(status_code=401, detail="Incorrect answer")
    return {"verified": True}


@router.get("/profile/{user_id}")
async def get_profile(user_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.financial import Account, Device, LoginEvent
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    acct_r = await db.execute(select(Account).where(Account.user_id == user_id).limit(1))
    account = acct_r.scalar_one_or_none()

    dev_r = await db.execute(select(Device).where(Device.user_id == user_id).order_by(Device.last_seen.desc()))
    devices = dev_r.scalars().all()

    login_r = await db.execute(
        select(LoginEvent).where(LoginEvent.user_id == user_id)
        .order_by(LoginEvent.timestamp.desc()).limit(10)
    )
    logins = login_r.scalars().all()

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "phone": user.phone_number,
        "upi": account.upi_id if account else None,
        "balance": str(account.balance) if account else "0",
        "account_type": account.account_type if account else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "devices": [
            {
                "id": d.id,
                "name": d.device_name,
                "platform": d.platform,
                "trusted": d.trusted,
                "first_seen": d.first_seen.isoformat() if d.first_seen else None,
                "last_seen": d.last_seen.isoformat() if d.last_seen else None,
            }
            for d in devices
        ],
        "login_history": [
            {
                "event_type": l.event_type,
                "ip_address": l.ip_address,
                "timestamp": l.timestamp.isoformat() if l.timestamp else None,
                "device_id": l.device_id,
            }
            for l in logins
        ],
    }
