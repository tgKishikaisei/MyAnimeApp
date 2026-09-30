"""
Модуль для построения Иерархии: Аниме -> Сезон -> Эпизоды -> Клипы (Кадры).

Навигационная структура, позволяющая вывести правильное меню выбора серий
в видеоплеере (Например: Выбрать Сезон 2, затем Серию 15, затем клипы внутри неё).
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
from pydantic import BaseModel

from app.modules.anime import models

class SeasonInfo(BaseModel):
    """Схема (DTO) информации о сезоне"""
    season_number: int # Номер сезона (Например: 1)
    clip_count: int    # Количество загруженных видео (эпизодов) внутри этого сезона

class EpisodeInfo(BaseModel):
    """Схема (DTO) информации об эпизоде (серии)"""
    episode_number: int # Номер серии
    clip_count: int     # Количество загруженных клипов/нарезок внутри серии

async def get_anime_seasons(db: AsyncSession, anime_id: int) -> List[SeasonInfo]:
    """
    Шаг 1: Извлекает уникальные сезоны для конкретного Аниме.
    Вместо того чтобы тянуть 1000 видео в память Python и считать их там,
    используется агрегация на стороне SQL базы (GROUP BY season).
    Возвращает список доступных сезонов.
    """
    query = (
        select(
            models.Clip.season,
            func.count(models.Clip.id).label('clip_count')
        )
        .filter(models.Clip.anime_id == anime_id)
        .group_by(models.Clip.season)
        .order_by(models.Clip.season) # Сортируем от 1-го сезона ко 2-ому
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        SeasonInfo(season_number=row[0], clip_count=row[1])
        for row in rows
    ]


async def get_season_episodes(
    db: AsyncSession, 
    anime_id: int, 
    season: int
) -> List[EpisodeInfo]:
    """
    Шаг 2: Аналогично первому, но извлекает количество клипов внутри каждой серии
    одного конкретно выбранного сезона.
    """
    query = (
        select(
            models.Clip.episode,
            func.count(models.Clip.id).label('clip_count')
        )
        .filter(
            models.Clip.anime_id == anime_id,
            models.Clip.season == season
        )
        .group_by(models.Clip.episode)
        .order_by(models.Clip.episode)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        EpisodeInfo(episode_number=row[0], clip_count=row[1])
        for row in rows
    ]


async def get_episode_clips(
    db: AsyncSession,
    anime_id: int,
    season: int,
    episode: int
) -> List[models.Clip]:
    """
    Шаг 3: Финальное извлечение самих физических файлов видео (Клипов),
    которые принадлежат к конкретной серии конкретного сезона.
    """
    from sqlalchemy import desc
    
    query = (
        select(models.Clip)
        .filter(
            models.Clip.anime_id == anime_id,
            models.Clip.season == season,
            models.Clip.episode == episode
        )
        # Сначала показываем самые свежие (недавно залитые) клипы
        .order_by(desc(models.Clip.created_at)) 
    )
    
    result = await db.execute(query)
    return result.scalars().all()
