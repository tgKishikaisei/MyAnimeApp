from typing import List, Optional
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.modules.watchlist.models import WatchlistEntry, WatchStatus


class WatchlistService:
    """
    Сервисный слой модуля Список Просмотра.
    Инкапсулирует SQL-запросы в методы, чтобы роутер оставался "чистым" и красивым.
    """

    async def get_user_list(self, db: AsyncSession, user_id: int) -> List[WatchlistEntry]:
        """
        Извлекает полный список "Мои Аниме" пользователя для Личного Кабинета.
        Автоматически подтягивает картинки и названия (.joinedload(anime)).
        """
        result = await db.execute(
            select(WatchlistEntry)
            .options(joinedload(WatchlistEntry.anime)) # JOIN запрос (Объединение таблиц за доли секунды)
            .where(WatchlistEntry.user_id == user_id)
            # Сортируем так, чтобы недавно обновленные (сегодня смотрел) были наверху списка
            .order_by(WatchlistEntry.updated_at.desc().nullslast())
        )
        return result.scalars().all()

    async def get_entry(self, db: AsyncSession, user_id: int, anime_id: int) -> Optional[WatchlistEntry]:
        """
        Точечный запрос: Проверяем, есть ли конкретное Аниме в закладках пользователя.
        Используется для покраски кнопки 'Добавить в список' на фронтенде в нужный цвет.
        """
        result = await db.execute(
            select(WatchlistEntry)
            .options(joinedload(WatchlistEntry.anime))
            .where(WatchlistEntry.user_id == user_id)
            .where(WatchlistEntry.anime_id == anime_id)
        )
        return result.scalar_one_or_none()

    async def upsert(
        self,
        db: AsyncSession,
        user_id: int,
        anime_id: int,
        status: WatchStatus,
        progress_episode: int = 0,
        note: Optional[str] = None,
    ) -> WatchlistEntry:
        """
        Алгоритм UPSERT (Update OR Insert).
        Очень умная функция: если Аниме ЕЩЁ НЕТ в списке — она делает CREATE.
        Если Аниме УЖЕ в списке — она делает UPDATE (перезаписывает прогресс серий и статус).
        """
        entry = await self.get_entry(db, user_id, anime_id)

        if entry:
            # Аниме уже в списке — просто обновляем данные
            entry.status = status
            entry.progress_episode = progress_episode
            if note is not None:
                entry.note = note
        else:
            # Аниме нет в списке — создаем с нуля
            entry = WatchlistEntry(
                user_id=user_id,
                anime_id=anime_id,
                status=status,
                progress_episode=progress_episode,
                note=note,
            )
            db.add(entry)

        await db.commit()
        await db.refresh(entry)
        return entry

    async def remove(self, db: AsyncSession, user_id: int, anime_id: int) -> bool:
        """
        Удаление Аниме из списка закладок (Например, очистка папки 'Смотрю').
        """
        result = await db.execute(
            delete(WatchlistEntry)
            .where(WatchlistEntry.user_id == user_id)
            .where(WatchlistEntry.anime_id == anime_id)
        )
        await db.commit()
        # Возвращаем True, если БД отрапортовала об удалении хоть 1 строки
        return result.rowcount > 0

    async def get_by_status(
        self, db: AsyncSession, user_id: int, status: WatchStatus
    ) -> List[WatchlistEntry]:
        """
        Фильтрация (Например: показать только те, что юзер пометил как 'Брошено' (Dropped)).
        """
        result = await db.execute(
            select(WatchlistEntry)
            .options(joinedload(WatchlistEntry.anime))
            .where(WatchlistEntry.user_id == user_id)
            .where(WatchlistEntry.status == status)
            .order_by(WatchlistEntry.updated_at.desc().nullslast())
        )
        return result.scalars().all()


# Глобальный Синглтон
watchlist_service = WatchlistService()
