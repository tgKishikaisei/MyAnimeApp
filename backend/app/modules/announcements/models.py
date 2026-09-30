from sqlalchemy import Column, Integer, String, Boolean
import enum
from app.core.models import BaseIDModel, TimestampMixin

class AnnouncementType(enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"

class Announcement(BaseIDModel, TimestampMixin):
    __tablename__ = "announcements"

    title = Column(String(200), nullable=False)
    message = Column(String(2000), nullable=False)
    type = Column(String(20), default=AnnouncementType.INFO.value, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    author_id = Column(Integer, index=True, nullable=True) # Admin who wrote it
