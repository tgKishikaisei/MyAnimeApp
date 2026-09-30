"""
Сервисный слой модуля Плейлистов.
Плейлисты позволяют пользователям собирать коллекции: "Посмотреть позже", "Любимые бои из Наруто" и тд.
Здесь реализована логика создания плейлистов, генерации публичных ссылок (slug) 
и добавления клипов внутрь без дубликатов.
"""
import re
import uuid
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any

from app.modules.playlists.models import Playlist, playlist_clips


def _make_slug(title: str, user_id: int) -> str:
    """
    Генерирует уникальный человекоподобный URL (Slug) для плейлиста.
    Если плейлист называется "Мои любимые бои", ссылка будет выглядеть так:
    /playlists/moi-lubimie-boi-142-a8f3b2
    
    Алгоритм:
    1. Очищает заголовок от спецсимволов.
    2. Добавляет ID пользователя.
    3. Добавляет случайный UUID хвост, чтобы ссылки никогда не конфликтовали.
    """
    base = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80]
    suffix = uuid.uuid4().hex[:6]
    return f"{base}-{user_id}-{suffix}"


class PlaylistService:
    """
    Бизнес-логика Плейлистов. 
    Инкапсулирует SQL запросы, агрегирует данные перед отдачей их роутерам.
    """

    async def get_user_playlists(self, db: AsyncSession, user_id: int) -> List[Dict[str, Any]]:
        """
        Возвращает список всех плейлистов пользователя (например, для Личного Кабинета).
        Каждый плейлист дополнительно подгружает "clip_count" — количество добавленных в него видео.
        """
        result = await db.execute(
            select(Playlist).where(Playlist.user_id == user_id).order_by(Playlist.created_at.desc())
        )
        playlists = result.scalars().all()
        out = []
        
        # Для каждого плейлиста считаем сколько видео лежит внутри него в промежуточной таблице playlist_clips
        for pl in playlists:
            count_q = select(func.count()).select_from(playlist_clips).where(
                playlist_clips.c.playlist_id == pl.id
            )
            count = (await db.execute(count_q)).scalar_one()
            out.append(self._serialize(pl, count))
            
        return out

    async def get_public_playlist(self, db: AsyncSession, slug: str) -> Dict[str, Any] | None:
        """
        Получить плейлист по его Slug-ссылке (для публичного просмотра гостями).
        Отдаёт 404 (None), если плейлист отмечен владельцем как Приватный (is_public=False).
        """
        result = await db.execute(
            select(Playlist).where(Playlist.slug == slug, Playlist.is_public == True)
        )
        pl = result.scalar_one_or_none()
        if not pl:
            return None
            
        # Подтягиваем список самих видеоклипов, привязанных к плейлисту через Many-To-Many связь
        await db.refresh(pl, ["clips"])
        
        # Форматируем ответ + запаковываем клипы
        return {**self._serialize(pl, len(pl.clips)), "clips": [
            {"id": c.id, "title": c.title, "video_path": c.video_path,
             "thumbnail_path": c.thumbnail_path, "duration": c.duration}
            for c in pl.clips
        ]}

    async def get_playlist_detail(self, db: AsyncSession, playlist_id: int, user_id: int) -> Dict[str, Any] | None:
        """
        Получить детальную информацию о плейлисте для его Владельца.
        Игнорирует флаг приватности, если мы пытаемся посмотреть свой собственный плейлист.
        """
        pl = await db.get(Playlist, playlist_id)
        
        # Защита от подсматривания за чужими приватными плейлистами
        if not pl or (pl.user_id != user_id and not pl.is_public):
            return None
            
        await db.refresh(pl, ["clips"])
        
        return {**self._serialize(pl, len(pl.clips)), "clips": [
            {"id": c.id, "title": c.title, "video_path": c.video_path,
             "thumbnail_path": c.thumbnail_path, "duration": c.duration,
             "anime_id": c.anime_id, "season": c.season, "episode": c.episode}
            for c in pl.clips
        ]}

    async def create_playlist(
        self, db: AsyncSession, user_id: int, title: str,
        description: str | None, is_public: bool
    ) -> Playlist:
        """Создает новый плейлист (пустой коробку для видео) в БД."""
        slug = _make_slug(title, user_id)
        pl = Playlist(
            user_id=user_id, 
            title=title, 
            description=description,
            is_public=is_public, 
            slug=slug
        )
        db.add(pl)
        await db.flush()
        return pl

    async def add_clip(self, db: AsyncSession, playlist_id: int, clip_id: int, user_id: int) -> bool:
        """
        Добавляет одно видео(клип) в плейлист. 
        Возвращает False, если юзер пытается добавить видео в ЧУЖОЙ плейлист.
        """
        pl = await db.get(Playlist, playlist_id)
        if not pl or pl.user_id != user_id:
            return False
            
        # 1. Защита от дублей. Проверяем, может юзер уже добавлял это видео сюда?
        exists = await db.execute(
            select(playlist_clips).where(
                playlist_clips.c.playlist_id == playlist_id,
                playlist_clips.c.clip_id == clip_id,
            )
        )
        if exists.first():
            return True  # Видео уже внутри, ничего делать не надо
            
        # 2. Вычисляем порядковый номер клипа (чтобы видео располагались строго друг за другом)
        count = (await db.execute(
            select(func.count()).select_from(playlist_clips).where(playlist_clips.c.playlist_id == playlist_id)
        )).scalar_one()
        
        # 3. Вставляем запись в связующую таблицу (Связь Many-To-Many)
        await db.execute(
            playlist_clips.insert().values(playlist_id=playlist_id, clip_id=clip_id, position=count)
        )
        return True

    async def remove_clip(self, db: AsyncSession, playlist_id: int, clip_id: int, user_id: int) -> bool:
        """Удаляет клип из плейлиста. Функция доступна только владельцу."""
        pl = await db.get(Playlist, playlist_id)
        if not pl or pl.user_id != user_id:
            return False
            
        await db.execute(
            delete(playlist_clips).where(
                playlist_clips.c.playlist_id == playlist_id,
                playlist_clips.c.clip_id == clip_id,
            )
        )
        return True

    async def delete_playlist(self, db: AsyncSession, playlist_id: int, user_id: int) -> bool:
        """Уничтожает сам плейлист целиком (сами видео при этом не удаляются с сервера, удаляется только коллекция)."""
        pl = await db.get(Playlist, playlist_id)
        if not pl or pl.user_id != user_id:
            return False
            
        await db.delete(pl)
        return True

    async def update_playlist(
        self, db: AsyncSession, playlist_id: int, user_id: int,
        title: str | None, description: str | None, is_public: bool | None
    ) -> Playlist | None:
        """Изменяет настройки плейлиста (Например, делает его приватным или меняет название)."""
        pl = await db.get(Playlist, playlist_id)
        if not pl or pl.user_id != user_id:
            return None
            
        if title is not None:
            pl.title = title
        if description is not None:
            pl.description = description
        if is_public is not None:
            pl.is_public = is_public
        return pl

    def _serialize(self, pl: Playlist, clip_count: int) -> Dict[str, Any]:
        """Превращает объект базы данных в удобный JSON-словарь для фронтенда."""
        return {
            "id": pl.id,
            "user_id": pl.user_id,
            "title": pl.title,
            "description": pl.description,
            "is_public": pl.is_public,
            "slug": pl.slug,
            "clip_count": clip_count, # Сколько видео загружено
            "created_at": pl.created_at,
            # Генерируем красивую публичную ссылку, только если плейлист не приватный
            "share_url": f"/playlists/{pl.slug}" if pl.is_public else None,
        }

# Экспортируем глобальный экземпляр класса для использования в роутерах
playlist_service = PlaylistService()
