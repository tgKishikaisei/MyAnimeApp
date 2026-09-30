"""
API-Роутер модуля Отслеживания Аниме (Watchlists).
Эндпоинты для добавления аниме в "Смотрю", "Буду смотреть", "Брошено".
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.user.models import User
from app.modules.watchlist.schemas import WatchlistUpsert, WatchlistEntryOut, WatchlistStatusOut
from app.modules.watchlist.service import watchlist_service
from app.modules.watchlist.models import WatchStatus

router = APIRouter()


@router.get("/", response_model=List[WatchlistEntryOut])
async def get_my_watchlist(
    status: Optional[WatchStatus] = None,
    db: AsyncSession = Depends(get_db),
    # Обратите внимание: Только авторизованный юзер может просматривать свои списки.
    current_user: User = Depends(get_current_user),
):
    """
    Личный Кабинет: Получить свой список аниме.
    Если передать query параметр ?status=watching, вернет только вкладку "Смотрю сейчас".
    """
    if status:
        return await watchlist_service.get_by_status(db, current_user.id, status)
    return await watchlist_service.get_user_list(db, current_user.id)


@router.get("/{anime_id}/status", response_model=WatchlistStatusOut)
async def get_anime_status(
    anime_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Пульс-чекер для карточки Аниме.
    Когда мы открываем страницу "/anime/123", фронтенд быстро стреляет сюда,
    чтобы проверить: "А добавлено ли это Аниме в мои списки?".
    Если да — кнопка светится статусом (Например: В планах).
    """
    entry = await watchlist_service.get_entry(db, current_user.id, anime_id)
    if not entry:
        return WatchlistStatusOut(in_list=False)
    return WatchlistStatusOut(in_list=True, status=entry.status, entry_id=entry.id)


@router.put("/{anime_id}", response_model=WatchlistEntryOut, status_code=status.HTTP_200_OK)
async def upsert_watchlist_entry(
    anime_id: int,
    body: WatchlistUpsert,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Метод UPSERT для управления списками (PUT запрос).
    Фронтенд может вызывать этот роутер сколько угодно раз. 
    Если аниме уже есть, он просто обновит прогресс (Например: посмотрел 5-ую серию) или статус.
    """
    return await watchlist_service.upsert(
        db,
        user_id=current_user.id,
        anime_id=anime_id,
        status=body.status,
        progress_episode=body.progress_episode or 0,
        note=body.note,
    )


@router.delete("/{anime_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_watchlist(
    anime_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Полное удаление аниме из списков.
    Использует статус 204 No Content (Стандарт REST API при удалении без возврата данных).
    """
    removed = await watchlist_service.remove(db, current_user.id, anime_id)
    if not removed:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Аниме не найдено в вашем списке закладок")
