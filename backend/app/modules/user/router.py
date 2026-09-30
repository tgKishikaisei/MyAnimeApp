import asyncio
import html
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api import deps
from app.core.broadcaster import broadcaster
from app.core.logger import get_logger
from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.modules.user import models, schemas, service
from app.utils.webhooks import dispatch_webhooks

router = APIRouter()
logger = get_logger(__name__)


@router.post("/", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit(AUTH_RATE_LIMIT)
async def create_user(
    request: Request,
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: schemas.UserRegisterIn,
) -> Any:
    """
    ## Регистрация пользователя (Sign Up)

    Роль всегда `viewer`. Администратора создаёт только серверный скрипт
    `scripts/admin/create_admin.py` — через API повысить себя нельзя.
    """
    user = await service.user_service.create_user(db, user_in=user_in)

    msg = (
        f"**Новый юзер:** `{html.escape(user.username)}`\n"
        f"**Роль:** `{user.role.value}`"
    )
    await dispatch_webhooks("🎉 Новая Регистрация!", msg)

    asyncio.create_task(
        broadcaster.broadcast(
            event_type="new_user",
            message=f"New user signed up: {user.username}",
            data={"user_id": user.id, "username": user.username},
        )
    )
    return user


@router.get("/me", response_model=schemas.UserResponse)
async def read_user_me(
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Мой профиль (полные данные — только владельцу)."""
    return current_user


@router.put("/me", response_model=schemas.UserResponse)
async def update_user_me(
    *,
    db: AsyncSession = Depends(deps.get_db),
    user_in: schemas.UserSelfUpdateIn,
    current_user: models.User = Depends(deps.get_current_user),
) -> Any:
    """Изменение своего профиля. Роль и статус здесь поменять нельзя (422)."""
    return await service.user_service.update_self(db, user=current_user, user_in=user_in)


@router.get("/{user_id}", response_model=schemas.UserPublicOut)
async def read_user_by_id(
    user_id: int,
    current_user: models.User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Публичная карточка чужого пользователя: без email, прав и информации о банах.
    Полный профиль доступен владельцу через /users/me и админу через /admin/users.
    """
    return await service.user_service.get_user_by_id(db, user_id=user_id)


@router.post("/me/avatar", response_model=schemas.UserResponse)
async def upload_avatar(
    *,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
    file: UploadFile = File(...),
) -> Any:
    """Загрузка аватара: проверка сигнатуры файла и размера — в save_user_avatar."""
    from app.core.file_upload import save_user_avatar

    try:
        avatar_path = await save_user_avatar(file, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Avatar upload failed")
        raise HTTPException(status_code=500, detail="Не удалось загрузить фото")

    return await service.user_service.update_user(
        db,
        user_id=current_user.id,
        user_in=schemas.UserAvatarUpdate(avatar_url=f"/static/{avatar_path}"),
    )
