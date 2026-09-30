from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.modules.watchlist.models import WatchStatus


class WatchlistUpsert(BaseModel):
    """Создание или обновление записи в списке просмотра."""
    status: WatchStatus = WatchStatus.PLANNED
    progress_episode: Optional[int] = 0
    note: Optional[str] = None


class AnimeShort(BaseModel):
    """Краткая информация об аниме для вставки в watchlist."""
    id: int
    title: str
    slug: Optional[str] = None
    image: Optional[str] = None

    class Config:
        from_attributes = True


class WatchlistEntryOut(BaseModel):
    """Ответ с данными записи из списка просмотра."""
    id: int
    anime_id: int
    status: WatchStatus
    progress_episode: int
    note: Optional[str]
    created_at: datetime
    updated_at: Optional[datetime]
    anime: Optional[AnimeShort] = None

    class Config:
        from_attributes = True


class WatchlistStatusOut(BaseModel):
    """Только текущий статус — для быстрого отображения на странице аниме."""
    status: Optional[WatchStatus] = None
    in_list: bool = False
    entry_id: Optional[int] = None

