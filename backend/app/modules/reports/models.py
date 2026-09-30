from sqlalchemy import Column, Integer, String, DateTime
import enum
from app.core.models import BaseIDModel, TimestampMixin

class ReportStatus(enum.Enum):
    PENDING = "pending"
    RESOLVED = "resolved"
    DISMISSED = "dismissed"

class Report(BaseIDModel, TimestampMixin):
    __tablename__ = "reports"

    user_id = Column(Integer, index=True, nullable=True) # Who reported it
    target_type = Column(String(50), nullable=False, index=True) # e.g. "clip", "news", "comment"
    target_id = Column(Integer, nullable=False, index=True)      # ID of the reported item
    reason = Column(String(1000), nullable=False)                # Why it was reported
    status = Column(String(20), default=ReportStatus.PENDING.value, nullable=False, index=True)
    
    # Phase 3 Moderation Metrics
    resolved_at = Column(DateTime(timezone=True), nullable=True) # Used to calculate Report Resolution Time
