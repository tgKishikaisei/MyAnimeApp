from sqlalchemy import Column, Integer, String, DateTime, Boolean, Float, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import date
from app.core.models import BaseIDModel

class DailyAnalytics(BaseIDModel):
    __tablename__ = "daily_analytics"
    
    date = Column(DateTime, default=date.today, index=True, nullable=False)
    target_type = Column(String(50), nullable=False, index=True) # "anime", "clip", "site_visit"
    target_id = Column(Integer, nullable=True, index=True)       # ID of anime/clip if applicable
    views = Column(Integer, default=0)
    unique_visitors = Column(Integer, default=0, nullable=True)
    
    # Phase 5: Economics
    adblock_detected_count = Column(Integer, default=0, nullable=False, server_default='0')

class VideoHeatmap(BaseIDModel):
    __tablename__ = "video_heatmaps"

    anime_id = Column(Integer, ForeignKey("animes.id", ondelete="CASCADE"), nullable=False, index=True)
    heatmap_data = Column(JSONB, nullable=False, default=dict)
    
    # Optional relationship
    anime = relationship("app.modules.anime.models.Anime", back_populates="heatmaps", lazy="noload")

class UserSession(BaseIDModel):
    __tablename__ = "user_sessions"
    
    user_id = Column(Integer, index=True, nullable=False)
    ip_address = Column(String(50), nullable=True)
    device_type = Column(String(50), nullable=True) # "mobile", "tablet", "pc"
    os = Column(String(50), nullable=True) # "Windows", "iOS", "Android"
    browser = Column(String(50), nullable=True) # "Chrome", "Safari"
    
    # Store when they logged in
    login_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

class VideoPlaybackSession(BaseIDModel):
    __tablename__ = "video_playback_sessions"
    
    user_id = Column(Integer, index=True, nullable=True) # Optional for anonymous
    clip_id = Column(Integer, index=True, nullable=False)
    anime_id = Column(Integer, index=True, nullable=False)
    
    duration_watched = Column(Integer, nullable=False, default=0) # In seconds
    total_duration = Column(Integer, nullable=False, default=1)   # In seconds
    
    # Phase 11 & 13: Funnels and Traffic
    episode_number = Column(Integer, nullable=False, default=1)
    bandwidth_mb = Column(Float, nullable=False, default=0.0)

    completed = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)

# Phase 3: Moderation & Trust Metrics
class SecurityLog(BaseIDModel): # Assuming TimestampMixin is not defined in this file or needs to be imported
    __tablename__ = "security_logs"
    
    event_type = Column(String(50), nullable=False, index=True) # e.g., "spam_blocked", "user_banned"
    user_id = Column(Integer, nullable=True, index=True)        # The user who triggered it (if authenticated)
    ip_address = Column(String(50), nullable=True)              # Track origin of attack/spam
    details = Column(String(1000), nullable=True)               # Extra context (e.g., "Toxicity score 0.95")
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)

class SearchQueryLog(BaseIDModel):
    __tablename__ = "search_query_logs"
    
    user_id = Column(Integer, index=True, nullable=True)
    query_string = Column(String(200), index=True, nullable=False)
    results_count = Column(Integer, nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)

# Phase 4: Hardcore Server Data
class ApiRequestLog(BaseIDModel):
    __tablename__ = "api_request_logs"
    
    endpoint = Column(String(255), index=True, nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, index=True, nullable=False)
    response_time_ms = Column(Integer, nullable=False)  # For Slow Query profiler
    is_error = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)

class SystemMetricsLog(BaseIDModel):
    __tablename__ = "system_metrics_logs"
    
    cpu_usage = Column(Float, nullable=False) # percentage (0.0 to 100.0)
    memory_usage = Column(Float, nullable=False) # percentage
    
    created_at = Column(DateTime(timezone=True), default=func.now(), index=True, nullable=False)
