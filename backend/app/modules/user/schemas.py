from typing import Optional, Dict
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, field_validator
from app.modules.user.models import UserRole

# -----------------------------------------------------------------------------
# Входные схемы.
#
# Правило: схема, которую заполняет сам пользователь, НЕ содержит полей,
# влияющих на права (role, is_active, permissions, banned_until), иначе
# любой сделал бы себя админом (OWASP API3:2023, Broken Object Property
# Level Authorization). `extra='forbid'` превращает попытку передать
# лишнее поле в 422, а не в молчаливое игнорирование.
# -----------------------------------------------------------------------------

class StrictInput(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class UserRegisterIn(StrictInput):
    """Регистрация. Роль всегда назначает сервер (viewer)."""
    email: EmailStr = Field(..., description="Электронная почта пользователя")
    username: str = Field(..., min_length=3, max_length=50, pattern=r"^[\w.\-]+$")
    password: str = Field(..., min_length=8, max_length=128, description="Пароль пользователя")
    full_name: Optional[str] = Field(None, max_length=100)


# Старое имя оставлено для совместимости импортов (тесты, скрипты).
UserCreate = UserRegisterIn


class UserSelfUpdateIn(StrictInput):
    """
    Изменение своего профиля. Смена email или пароля требует текущий пароль:
    украденный access-токен не должен позволять угнать аккаунт.
    """
    username: Optional[str] = Field(None, min_length=3, max_length=50, pattern=r"^[\w.\-]+$")
    full_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)
    current_password: Optional[str] = Field(None, max_length=128)


class UserAvatarUpdate(BaseModel):
    """Внутренняя схема: аватар ставит только сервер после проверки файла."""
    avatar_url: str = Field(..., max_length=255)


# Старое имя для совместимости.
UserUpdate = UserSelfUpdateIn


class UserAdminUpdateIn(StrictInput):
    """Поля, которые может менять только администратор."""
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    permissions: Optional[Dict[str, bool]] = None


# -----------------------------------------------------------------------------
# Выходные схемы.
# -----------------------------------------------------------------------------

class UserPublicOut(BaseModel):
    """Что видит любой посетитель о чужом профиле — без email, прав и банов."""
    id: int
    username: str
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    """Полный профиль: только для владельца и администратора."""
    id: int
    # Выходная схема не валидирует email повторно: одна «нестандартная» запись
    # в БД (например, созданная скриптом) иначе роняла весь список /admin/users (500).
    email: str
    username: str
    role: UserRole
    is_active: bool
    full_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    banned_until: Optional[datetime] = None
    ban_reason: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("permissions", mode="before")
    @classmethod
    def _none_to_empty(cls, v):
        return v or {}


# Alias for backward compatibility or cleaner imports
User = UserResponse

# -----------------------------------------------------------------------------
# Auth Schemas
# -----------------------------------------------------------------------------

class Token(BaseModel):
    access_token: str
    token_type: str
    expires_in: int = 900


class WsTicket(BaseModel):
    ticket: str
    expires_in: int = 60


class TokenData(BaseModel):
    username: Optional[str] = None
