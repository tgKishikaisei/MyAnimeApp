import enum
from sqlalchemy import Column, String, Boolean, Enum as SqEnum, DateTime, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.models import BaseIDModel, TimestampMixin

class UserRole(str, enum.Enum):
    """Глобальные уровни доступа в системе."""
    ADMIN = "admin"       # Бог сервера (Доступно всё)
    CREATOR = "creator"   # Контент-мейкер (Может заливать серии, но не может менять настройки сайта)
    VIEWER = "viewer"     # Обычный зритель (Может ставить лайки, комментировать, качать)

class User(BaseIDModel, TimestampMixin):
    """Главная Таблица Пользователей Системы."""
    __tablename__ = "users"

    # Базовые данные
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    
    # Пароль ни в коем случае нельзя хранить в открытом виде. Здесь хранится Argon2 хэш.
    hashed_password = Column(String(255), nullable=False)
    
    # Жёстко типизированная Роль (PostgreSQL Enum). 
    # В базу нельзя будет записать слово, которого нет в `UserRole`.
    role = Column(
        SqEnum(UserRole), 
        default=UserRole.VIEWER, 
        nullable=False,
        index=True
    )
    
    is_active = Column(Boolean, default=True)
    full_name = Column(String(100), nullable=True)
    bio = Column(String(500), nullable=True) # Раздел "О себе"
    avatar_url = Column(String(255), nullable=True)
    
    # Массив дополнительных конкретных прав (Например: {"can_upload_8k_video": true}). 
    # Хранится в формате JSONB, что позволяет базе PostgreSQL искать прямо внутри JSON'а.
    permissions = Column(JSONB, default=dict, nullable=False) 
    
    # Система блокировок (Бан-Хаммер)
    banned_until = Column(DateTime(timezone=True), nullable=True, index=True) # Дата, КОГДА бан спадет
    ban_reason = Column(String(500), nullable=True) # Причина, КОТОРУЮ увидит юзер ("За спам в комментах")
    last_login_at = Column(DateTime(timezone=True), nullable=True)

    # Двунаправленная связь с загруженными видео
    uploaded_clips = relationship("app.modules.anime.models.Clip", back_populates="uploader", lazy="select")

    def __repr__(self):
        return f"<User {self.username} ({self.role})>"


class RefreshToken(BaseIDModel):
    """
    Выданные refresh-токены. Хранится только SHA-256 хэш токена.

    Ротация с обнаружением повторного использования (OAuth 2.1 / Auth0 pattern):
    каждый refresh выдаёт новый токен в той же «семье» (family_id) и помечает
    старый как использованный. Если использованный токен приходит снова —
    значит, его украли: отзываем всю семью, и обоим (вору и владельцу)
    придётся войти заново.
    """
    __tablename__ = "refresh_tokens"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id = Column(String(32), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    user_agent = Column(String(300), nullable=True)
    ip_address = Column(String(64), nullable=True)