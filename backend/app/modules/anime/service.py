"""
Сервисный слой модуля Аниме.
Отвечает за бизнес-логику: выдача каталога сериалов, обработка слагов (slugs),
привязка видео-клипов (сезоны/эпизоды) к аниме и управление базой данных.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import re
from datetime import datetime

from app.modules.anime import crud
from app.modules.anime import schemas
from app.modules.anime import models
from app.modules.anime.enums import AnimeSection
from app.modules.anime.exceptions import AnimeNotFound, ClipNotFound

from app.core.logger import get_logger

logger = get_logger(__name__)

class AnimeService:
    """
    Класс-сервис для работы с аниме-каталогом.
    Скрывает внутри себя прямые SQL-запросы (CRUD), чтобы API Роутеры были чистыми.
    """

    # --- РАБОТА С АНИМЕ (СЕРИАЛАМИ) ---

    async def get_list(
        self, 
        db: AsyncSession, 
        section: Optional[AnimeSection] = None, 
        skip: int = 0, 
        limit: int = 100,
        q: Optional[str] = None,
    ) -> List[models.Anime]:
        """
        Получает список аниме (каталог).
        - Поддерживает фильтрацию по секциям (например: только онгоинги или только популярное).
        - Поддерживает пагинацию (skip/limit).
        - Поддерживает текстовый поиск (q).
        """
        return await crud.get_multi(db, section=section, skip=skip, limit=limit, q=q)


    async def get_by_slug(self, db: AsyncSession, slug: str) -> models.Anime:
        """
        Ищет аниме по слагу (человекопонятному URL, например: `attack-on-titan`).
        """
        anime = await crud.get_by_slug(db, slug)
        if not anime:
            # Fallback: Если фронтенд случайно прислал ID вместо слага (например /anime/123)
            # Пытаемся найти по числовому ID для обратной совместимости.
            if slug.isdigit():
                 anime = await crud.get(db, int(slug))
            
            # Если всё равно не найдено — выбрасываем 404
            if not anime:
                raise AnimeNotFound(f"Аниме со слагом '{slug}' не найдено")
        return anime
    
    async def get_by_id(self, db: AsyncSession, anime_id: int) -> models.Anime:
        """Ищет аниме строго по внутреннему ID базы данных."""
        anime = await crud.get(db, anime_id)
        if not anime:
            raise AnimeNotFound(f"Аниме с ID {anime_id} не найдено")
        return anime

    async def create_anime_logic(self, db: AsyncSession, anime_in: schemas.AnimeCreate):
        """
        Бизнес-логика создания нового аниме администратором.
        Умеет автоматически генерировать красивый URL (slug) из названия.
        """
        # 1. Если slug не передан, делаем его из title (Например: "Bleach: Thousand-Year" -> "bleach-thousand-year")
        if not anime_in.slug or anime_in.slug == "string":
             text = anime_in.title.lower()
             anime_in.slug = re.sub(r'[\W_]+', '-', text).strip('-')

        # 2. Проверяем, нет ли уже аниме с таким URL. Если есть — добавляем таймстемп, чтобы избежать конфликтов БД.
        existing = await crud.get_by_slug(db, anime_in.slug)
        if existing:
             anime_in.slug = f"{anime_in.slug}-{int(datetime.timestamp(datetime.now()))}"
             
        # 3. Сохраняем в базу данных
        try:
            anime = await crud.create(db, anime_in)
            await db.commit() # Фиксируем транзакцию
            logger.info(f"Создано аниме: {anime.title} (ID: {anime.id})")
            return anime
        except Exception as e:
            await db.rollback() # Отмена в случае ошибки
            logger.error(f"Ошибка создания аниме: {e}")
            raise e

    async def update(self, db: AsyncSession, anime_id: int, anime_in: schemas.AnimeUpdate) -> models.Anime:
        """Обновление данных об аниме."""
        anime = await self.get_by_id(db, anime_id)
        try:
            updated_anime = await crud.update(db, db_obj=anime, obj_in=anime_in)
            await db.commit()
            logger.info(f"Обновлено аниме: {updated_anime.title} (ID: {updated_anime.id})")
            return updated_anime
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка обновления аниме: {e}")
            raise e

    async def delete(self, db: AsyncSession, anime_id: int) -> models.Anime:
        """Удаление аниме из каталога."""
        anime = await self.get_by_id(db, anime_id)
        try:
            await crud.delete(db, db_obj=anime)
            await db.commit()
            logger.info(f"Удалено аниме: {anime.title} (ID: {anime_id})")
            return anime
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка удаления аниме: {e}")
            raise e

    # --- РАБОТА С КЛИПАМИ (ЭПИЗОДАМИ) ---
    
    async def get_clips(self, db: AsyncSession, skip: int = 0, limit: int = 50) -> List[models.Clip]:
        """Получить общий список загруженных видео-эпизодов."""
        return await crud.get_multi_clips(db, skip=skip, limit=limit)

    async def get_clip_by_id(self, db: AsyncSession, clip_id: int) -> models.Clip:
        """Найти конкретное видео по его ID."""
        clip = await crud.get_clip(db, clip_id)
        if not clip:
            raise ClipNotFound(f"Клип с ID {clip_id} не найден")
        return clip

    async def add_clip(self, db: AsyncSession, anime_id: int, clip_in: schemas.ClipCreate) -> models.Clip:
        """Добавить новый видео-эпизод и привязать его к конкретному сериалу (anime_id)."""
        # Сначала проверяем, существует ли указанный сериал
        await self.get_by_id(db, anime_id) 
        
        try:
            clip = await crud.create_clip(db, clip_in, anime_id)
            await db.commit()
            logger.info(f"Добавлен клип '{clip.title}' к аниме с ID {anime_id}")
            return clip
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка добавления клипа: {e}")
            raise e

    async def update_clip(self, db: AsyncSession, clip_id: int, clip_in: schemas.ClipUpdate) -> models.Clip:
        """Обновить метаданные эпизода (название, номер серии)."""
        clip = await self.get_clip_by_id(db, clip_id)
        try:
            updated_clip = await crud.update_clip(db, db_clip=clip, clip_in=clip_in)
            await db.commit()
            logger.info(f"Обновлен клип с ID: {updated_clip.id}")
            return updated_clip
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка обновления клипа: {e}")
            raise e

    async def delete_clip(self, db: AsyncSession, clip_id: int) -> models.Clip:
        """Полное удаление видео."""
        clip = await self.get_clip_by_id(db, clip_id)
        try:
            await crud.delete_clip(db, db_clip=clip)
            await db.commit()
            logger.info(f"Удален клип: {clip_id}")
            return clip
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка удаления клипа: {e}")
            raise e

# Экспорт глобального объекта-сервиса (Паттерн Singleton)
anime_service = AnimeService()

async def create_anime_fn(db: AsyncSession, anime_in: schemas.AnimeCreate) -> models.Anime:
    """Одиночная функция для создания аниме (Используется для решения проблемы с цикличными импортами)"""
    if not anime_in.slug or anime_in.slug == "string":
            text = anime_in.title.lower()
            anime_in.slug = re.sub(r'[\W_]+', '-', text).strip('-')

    existing = await crud.get_by_slug(db, anime_in.slug)
    if existing:
            anime_in.slug = f"{anime_in.slug}-{int(datetime.timestamp(datetime.now()))}"
            
    try:
        anime = await crud.create(db, anime_in)
        await db.commit()
        logger.info(f"Создано аниме: {anime.title} (ID: {anime.id})")
        # Выполняем повторную жадную загрузку (Eager Loading), чтобы подгрузить связанные таблицы (теги, сезоны)
        # Это защищает от ошибки "MissingGreenlet" в асинхронном SQLAlchemy.
        result = await db.execute(
            select(models.Anime)
            .options(selectinload(models.Anime.clips), selectinload(models.Anime.tags))
            .where(models.Anime.id == anime.id)
        )
        return result.scalar_one()
    except Exception as e:
        await db.rollback()
        logger.error(f"Ошибка создания аниме: {e}")
        raise e