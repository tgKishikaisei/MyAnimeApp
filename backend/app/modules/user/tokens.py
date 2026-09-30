"""
Хранилище refresh-токенов: выдача, ротация, обнаружение повторного использования.

Схема (Auth0 «refresh token rotation» / OAuth 2.1):
1. При входе создаётся семья (family_id) и первый токен.
2. Каждый /auth/refresh помечает текущий токен использованным и выдаёт новый
   в той же семье.
3. Если использованный токен приходит снова — его кто-то скопировал. Отзываем
   всю семью: и у вора, и у владельца сессия заканчивается.
4. Окно `REUSE_GRACE` защищает от ложных срабатываний, когда две вкладки
   одновременно обновляют токен: вторая получает 409 и просто повторяет запрос
   (к этому моменту в браузере уже лежит новая cookie от первой).
"""
import uuid
from datetime import datetime, timedelta, timezone
from enum import Enum

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import security
from app.core.logger import get_logger
from app.modules.user.models import RefreshToken, User

logger = get_logger(__name__)

REUSE_GRACE = timedelta(seconds=10)


class RotateResult(str, Enum):
    OK = "ok"
    INVALID = "invalid"
    RACE = "race"
    REUSED = "reused"


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def issue(
    db: AsyncSession,
    user_id: int,
    *,
    family_id: str | None = None,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> str:
    raw, digest = security.new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id or uuid.uuid4().hex,
            token_hash=digest,
            expires_at=_now() + security.REFRESH_TOKEN_TTL,
            user_agent=(user_agent or "")[:300] or None,
            ip_address=ip_address,
        )
    )
    await db.flush()
    return raw


async def rotate(
    db: AsyncSession,
    raw_token: str,
    *,
    user_agent: str | None = None,
    ip_address: str | None = None,
) -> tuple[RotateResult, User | None, str | None]:
    """Возвращает (результат, пользователь, новый refresh-токен)."""
    digest = security.hash_refresh_token(raw_token)
    row = (
        await db.execute(
            select(RefreshToken).where(RefreshToken.token_hash == digest).with_for_update()
        )
    ).scalar_one_or_none()
    now = _now()

    if row is None or row.revoked_at is not None or row.expires_at <= now:
        return RotateResult.INVALID, None, None

    if row.used_at is not None:
        if now - row.used_at <= REUSE_GRACE:
            return RotateResult.RACE, None, None
        await revoke_family(db, row.family_id)
        logger.warning(
            "Refresh token reuse detected — family revoked",
            extra={"user_id": row.user_id, "family_id": row.family_id, "ip": ip_address},
        )
        return RotateResult.REUSED, None, None

    user = await db.get(User, row.user_id)
    if user is None:
        return RotateResult.INVALID, None, None

    row.used_at = now
    new_raw = await issue(
        db, row.user_id, family_id=row.family_id, user_agent=user_agent, ip_address=ip_address
    )
    return RotateResult.OK, user, new_raw


async def revoke_family(db: AsyncSession, family_id: str) -> None:
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )


async def revoke_by_token(db: AsyncSession, raw_token: str) -> None:
    digest = security.hash_refresh_token(raw_token)
    row = (await db.execute(select(RefreshToken).where(RefreshToken.token_hash == digest))).scalar_one_or_none()
    if row is not None:
        await revoke_family(db, row.family_id)


async def revoke_all_for_user(db: AsyncSession, user_id: int) -> None:
    """Выход на всех устройствах (kill-switch для своего аккаунта или по решению админа)."""
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=_now())
    )
