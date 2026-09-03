from typing import Optional
from pydantic import BaseModel, Field


class AnalyzeRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Message text to analyze")
    user_id: str = Field(default="user-arjun", description="User ID")
    sender: Optional[str] = Field(default=None, description="Sender identifier")
    source: str = Field(default="whatsapp", description="Message source (whatsapp/sms)")


class EntitiesResponse(BaseModel):
    upi_ids: list[str] = []
    phone_numbers: list[str] = []
    urls: list[str] = []
    bank_names: list[str] = []
    amounts: list[str] = []


class NotificationResponse(BaseModel):
    id: str
    title: str
    body: str
    severity: str
    recommended_action: Optional[str] = None


class RiskSignalResponse(BaseModel):
    id: str
    signal_type: str
    risk_score: float
    status: str


class AnalyzeResponse(BaseModel):
    message_id: str
    detection_id: str
    is_scam: bool
    confidence: float
    scam_type: Optional[str]
    risk_level: str
    urgency: str
    explanation: str
    key_indicators: list[str]
    entities: EntitiesResponse
    notification: NotificationResponse
    risk_signal: RiskSignalResponse


class NotificationListItem(BaseModel):
    id: str
    title: str
    body: str
    severity: str
    recommended_action: Optional[str]
    is_read: bool
    created_at: str
    detection_id: str


class BankRiskSignalItem(BaseModel):
    id: str
    signal_type: str
    risk_score: float
    scam_type: Optional[str]
    flagged_entities: Optional[dict]
    status: str
    created_at: str
    expires_at: Optional[str]
    detection_id: str


class CreateNotificationRequest(BaseModel):
    user_id: str
    title: str
    body: str
    severity: str = "info"
    recommended_action: Optional[str] = None
