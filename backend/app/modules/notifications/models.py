from sqlalchemy import Column, Integer, String, Text, Boolean, ForeignKey, Enum as SqEnum, JSON
from app.core.models import BaseIDModel, TimestampMixin
import enum


class NotificationType(str, enum.Enum):
    """Тип уведомления"""
    COMMENT_REPLY = "comment_reply"
    FFMPEG_DONE = "ffmpeg_done"
    SYSTEM = "system"
    NEW_EPISODE = "new_episode"


class Notification(BaseIDModel, TimestampMixin):
    """Модель уведомления для пользователя"""
    __tablename__ = "notifications"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(SqEnum(NotificationType), nullable=False, default=NotificationType.SYSTEM)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=True)
    data = Column(JSON, nullable=True)  # Дополнительные данные (anime_id, comment_id и т.д.)
    is_read = Column(Boolean, default=False, index=True)
