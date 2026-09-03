from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models.tables import Notification
from app.routers.schemas import (
    NotificationListItem,
    CreateNotificationRequest,
)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.post("", status_code=201)
async def create_notification(
    request: CreateNotificationRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a manual notification (for testing or admin use)."""
    notif = Notification(
        user_id=request.user_id,
        detection_id="manual",
        title=request.title,
        body=request.body,
        severity=request.severity,
        recommended_action=request.recommended_action,
    )
    db.add(notif)
    await db.commit()
    return {"id": notif.id, "status": "created"}


@router.get("/{user_id}", response_model=list[NotificationListItem])
async def get_notifications(
    user_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Get all notifications for a user, newest first."""
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [
        NotificationListItem(
            id=n.id,
            title=n.title,
            body=n.body,
            severity=n.severity,
            recommended_action=n.recommended_action,
            is_read=n.is_read,
            created_at=n.created_at.isoformat() if n.created_at else "",
            detection_id=n.detection_id,
        )
        for n in notifications
    ]
