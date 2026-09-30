from sqlalchemy import Column, String, Boolean
from app.core.models import BaseIDModel, TimestampMixin

class SystemSettings(BaseIDModel, TimestampMixin):
    __tablename__ = "system_settings"

    # Enforce a single row architecture
    site_name = Column(String(255), default="AniFlow", nullable=False)
    maintenance_mode = Column(Boolean, default=False, nullable=False)
    allow_registrations = Column(Boolean, default=True, nullable=False)
    hero_banner_url = Column(String(500), nullable=True)
    seo_description = Column(String(1000), nullable=True)
    
    # Webhook integrations
    telegram_bot_token = Column(String(255), nullable=True)
    telegram_chat_id = Column(String(255), nullable=True)
    discord_webhook_url = Column(String(500), nullable=True)
