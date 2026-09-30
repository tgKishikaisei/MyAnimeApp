from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from app.modules.notifications.models import NotificationType


class NotificationResponse(BaseModel):
    """Схема ответа уведомления"""
    id: int
    user_id: int
    type: NotificationType
    title: str
    message: Optional[str] = None
    data: Optional[dict] = None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NotificationCreate(BaseModel):
    """Схема создания уведомления (для внутреннего использования)"""
    user_id: int
    type: NotificationType = NotificationType.SYSTEM
    title: str
    message: Optional[str] = None
    data: Optional[dict] = None


class MarkReadRequest(BaseModel):
    """Запрос для пометки уведомлений как прочитанных"""
    notification_ids: Optional[list[int]] = None  # None = пометить все
