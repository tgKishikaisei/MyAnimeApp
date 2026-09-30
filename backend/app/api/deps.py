"""
Зависимости авторизации.

Правила (OWASP A01/A07, API1/API5):
- Невалидный/просроченный токен → 401: фронтенд запускает silent refresh
  только на 401.
- Принимается только токен типа `access`. Refresh-токен вообще не JWT,
  а WS-билет имеет тип `ws`, поэтому подсунуть их вместо access нельзя.
- Не-админ на админском маршруте получает 404, а не 403: мы не подтверждаем
  постороннему, что такой раздел существует.
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.config import settings
from app.core.database import get_db
from app.modules.user import models, service
from app.modules.user.exceptions import UserNotFound

reusable_oauth2 = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
reusable_oauth2_optional = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False
)

_UNAUTHORIZED = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Could not validate credentials",
    headers={"WWW-Authenticate": "Bearer"},
)
_NOT_FOUND = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")


def _is_banned(user: models.User) -> bool:
    return bool(user.banned_until and user.banned_until > datetime.now(timezone.utc))


async def _user_from_access_token(db: AsyncSession, token: str) -> Optional[models.User]:
    try:
        payload = security.decode_token(token, security.TOKEN_TYPE_ACCESS)
        user_id = int(payload["sub"])
    except (security.InvalidToken, ValueError, KeyError):
        return None
    try:
        user = await service.user_service.get_user_by_id(db, user_id=user_id)
    except UserNotFound:
        return None
    if not user.is_active or _is_banned(user):
        return None
    return user


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    token: str = Depends(reusable_oauth2),
) -> models.User:
    """Текущий пользователь по access-токену из заголовка Authorization."""
    user = await _user_from_access_token(db, token)
    if user is None:
        raise _UNAUTHORIZED
    return user


async def get_current_user_optional(
    db: AsyncSession = Depends(get_db),
    token: Optional[str] = Depends(reusable_oauth2_optional),
) -> Optional[models.User]:
    """Как get_current_user, но для анонимных посетителей возвращает None."""
    if not token:
        return None
    return await _user_from_access_token(db, token)


def is_admin(user: models.User) -> bool:
    return user.role == models.UserRole.ADMIN


def is_staff(user: models.User) -> bool:
    """Админ, контент-мейкер или пользователь с выданными гранулярными правами."""
    if user.role in (models.UserRole.ADMIN, models.UserRole.CREATOR):
        return True
    return any((user.permissions or {}).values())


async def get_current_active_superuser(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """Только администратор. Остальным — 404."""
    if not is_admin(current_user):
        raise _NOT_FOUND
    return current_user


# Более говорящее имя для новых роутеров.
require_admin = get_current_active_superuser


async def require_staff(
    current_user: models.User = Depends(get_current_user),
) -> models.User:
    """
    Вешается на весь /admin-роутер целиком: обычный зритель не достучится ни до
    одного админского эндпоинта, даже если кто-то забудет проверку в хендлере.
    Конкретные эндпоинты дополнительно требуют admin или нужное право.
    """
    if not is_staff(current_user):
        raise _NOT_FOUND
    return current_user


def require_permission(permission_key: str):
    """
    Dependency factory to enforce specific granular permissions.
    Admins bypass these checks automatically.
    """
    async def permission_checker(
        current_user: models.User = Depends(get_current_user),
    ) -> models.User:
        if is_admin(current_user):
            return current_user
        if not (current_user.permissions or {}).get(permission_key, False):
            raise _NOT_FOUND
        return current_user

    return permission_checker
