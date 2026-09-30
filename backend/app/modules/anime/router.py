from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date
import httpx

from app.core.logger import get_logger

logger = get_logger(__name__)

# Импортируем базу
from app.core.database import get_db
# Импортируем модели и схемы из МОДУЛЯ
from app.modules.anime import models, schemas
from app.modules.anime.service import anime_service
from app.modules.user.models import User
from app.modules.analytics.models import DailyAnalytics

router = APIRouter()

# 1. Получить аниме
@router.get("/", response_model=List[schemas.Anime])
async def get_animes(
    section: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    from app.main import c_anime_views
    c_anime_views.inc()
    return await anime_service.get_list(db, section=section, q=q, limit=min(limit, 200))


from app.api.deps import get_current_active_superuser, get_current_user, get_current_user_optional

# 2. Создать Аниме
@router.post("/", response_model=schemas.Anime)
async def create_anime(
    anime_in: schemas.AnimeCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    from app.modules.anime.service import create_anime_fn
    return await create_anime_fn(db=db, anime_in=anime_in)

# 3. Добавить Клип
@router.post("/{anime_id}/clips", response_model=schemas.Clip)
async def create_clip(
    anime_id: int, 
    clip: schemas.ClipCreate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    return await anime_service.add_clip(db, anime_id=anime_id, clip_in=clip)

# 3B. СОЗДАТЬ АНИМЕ С ЗАГРУЗКОЙ ИЗОБРАЖЕНИЯ
from fastapi import UploadFile, File, Form
from typing import Optional
from app.core.file_upload import save_anime_image

@router.post("/upload", response_model=schemas.Anime)
async def upload_anime(
    image_file: UploadFile = File(..., description="Anime poster/cover image"),
    title: str = Form(..., description="Anime title"),
    description: str = Form("", description="Anime description"),
    section: str = Form("popular", description="Anime section"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Создает аниме с загрузкой файла изображения.
    Изображение сохраняется в: static/anime_images/
    """
    # Сохраняем файл изображения
    image_path, file_size = await save_anime_image(image_file)
    
    # Создаем полный URL для изображения
    image_url = f"/static/{image_path}"
    
    # Создаем аниме в базе данных
    anime_data = schemas.AnimeCreate(
        title=title,
        description=description if description else None,
        image=image_url,
        section=section
    )
    
    anime = await anime_service.create_anime_logic(db, anime_in=anime_data)
    
    # Обновляем данные с жадной загрузкой (eager loading) для правильной загрузки связей
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    stmt = select(models.Anime).where(models.Anime.id == anime.id).options(
        selectinload(models.Anime.clips),
        selectinload(models.Anime.tags)
    )
    result = await db.execute(stmt)
    anime_with_relationships = result.scalar_one()
    
    return anime_with_relationships


# 4. ПОЛУЧИТЬ ОДНО АНИМЕ (По SLUG)
@router.get("/{slug}", response_model=schemas.Anime)
async def get_anime_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    return await anime_service.get_by_slug(db, slug=slug)

@router.post("/import/jikan", response_model=schemas.AnimeCreate)
async def fetch_jikan_anime(
    mal_id: int,
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Получает данные об аниме из Jikan API (MyAnimeList) и возвращает предварительно сформированную схему AnimeCreate.
    НЕ сохраняет в базу данных автоматически — только заполняет форму на фронтенде.
    """
    url = f"https://api.jikan.moe/v4/anime/{mal_id}"
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(url)
            
        if response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Anime with MAL ID {mal_id} not found on MyAnimeList")
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="Jikan API rate limit reached. Please wait a moment and try again.")
        if response.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Jikan API returned status {response.status_code}")
            
        json_data = response.json()
        data = json_data.get("data", {})
        
        if not data:
            raise HTTPException(status_code=404, detail="No data returned from Jikan API")
        
        # Преобразуем данные Jikan в нашу схему
        title = data.get("title_english") or data.get("title") or "Unknown Title"
        synopsis = data.get("synopsis") or ""
        
        # Получаем изображение наивысшего качества
        images = data.get("images", {})
        jpg_images = images.get("jpg", {})
        image_url = (
            jpg_images.get("large_image_url") or
            jpg_images.get("image_url") or
            "/placeholder.png"
        )
        
        # Определяем раздел на основе статуса выхода (airing)
        status = data.get("status", "")
        airing = data.get("airing", False)
        if airing or status == "Currently Airing":
            section = "ongoing"
        else:
            section = "popular"
        
        # Получаем год из даты выхода
        year = None
        aired = data.get("aired", {})
        if aired and aired.get("from"):
            try:
                year = int(aired["from"][:4])
            except (ValueError, TypeError):
                year = None
        
        return schemas.AnimeCreate(
            title=title[:200],
            description=synopsis[:2000] if synopsis else None,
            image=image_url[:500],
            section=section,
            year=year,
        )

    except HTTPException:
        raise
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Jikan API request timed out. Please try again.")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="Cannot reach Jikan API")
    except Exception:
        logger.exception("Jikan import failed")
        raise HTTPException(status_code=500, detail="Unexpected error during import")


# 5. ОБНОВИТЬ АНИМЕ (PATCH)
@router.patch("/{anime_id}", response_model=schemas.Anime)
async def update_anime(
    anime_id: int, 
    anime_in: schemas.AnimeUpdate, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    return await anime_service.update(db, anime_id=anime_id, anime_in=anime_in)

# REORDER ANIME (Drag & Drop)
class ReorderPayload(BaseModel):
    ordered_ids: List[int]

@router.put("/reorder", status_code=200)
async def reorder_animes(
    payload: ReorderPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Обновляет порядок сортировки аниме на основе переданного массива ID.
    Каждый ID получает sort_order равный его позиции в массиве.
    """
    for index, anime_id in enumerate(payload.ordered_ids):
        anime = await db.get(models.Anime, anime_id)
        if anime:
            anime.sort_order = index
    await db.commit()
    return {"status": "ok", "reordered": len(payload.ordered_ids)}

# 6. УДАЛИТЬ АНИМЕ (DELETE)
@router.delete("/{anime_id}", status_code=204)
async def delete_anime(
    anime_id: int, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    await anime_service.delete(db, anime_id=anime_id)
    return None

# --- HIERARCHY ENDPOINTS ---

# 7. GET ANIME SEASONS
@router.get("/{anime_id}/seasons", response_model=List[schemas.SeasonInfo])
async def get_anime_seasons(anime_id: int, db: AsyncSession = Depends(get_db)):
    """Получить все сезоны для аниме с количеством клипов"""
    from app.modules.anime.clips_hierarchy import get_anime_seasons
    return await get_anime_seasons(db, anime_id)

# 8. GET SEASON EPISODES
@router.get("/{anime_id}/seasons/{season_id}/episodes", response_model=List[schemas.EpisodeInfo])
async def get_season_episodes(
    anime_id: int,
    season_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить все эпизоды для сезона с количеством клипов"""
    from app.modules.anime.clips_hierarchy import get_season_episodes
    return await get_season_episodes(db, anime_id, season_id)

# 9. GET EPISODE CLIPS
@router.get("/{anime_id}/seasons/{season_id}/episodes/{episode_id}/clips", response_model=List[schemas.Clip])
async def get_episode_clips(
    anime_id: int,
    season_id: int,
    episode_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Получить все клипы для конкретного эпизода"""
    from app.modules.anime.clips_hierarchy import get_episode_clips
    return await get_episode_clips(db, anime_id, season_id, episode_id)



# --- VIEW TRACKING ---

@router.post("/{slug}/view")
async def record_anime_view(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """Записать просмотр для аналитики. Каждый вызов увеличивает счетчик на сегодня."""
    anime = await anime_service.get_by_slug(db, slug=slug)
    
    today = date.today()
    
    # Пытаемся найти существующую запись аналитики на сегодня
    existing = await db.scalar(
        select(DailyAnalytics)
        .where(DailyAnalytics.target_type == "anime")
        .where(DailyAnalytics.target_id == anime.id)
        .where(func.date(DailyAnalytics.date) == today)
    )
    
    if existing:
        existing.views += 1
        existing.unique_visitors += 1  # Упрощено — реальная реализация будет проверять IP/пользователя
    else:
        analytics = DailyAnalytics(
            date=today,
            target_type="anime",
            target_id=anime.id,
            views=1,
            unique_visitors=1
        )
        db.add(analytics)
    
    await db.commit()
    return {"status": "ok"}


# --- PUBLIC REVIEWS ---

class ReviewCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    content: Optional[str] = Field(None, max_length=5000)

@router.post("/{slug}/reviews")
async def create_anime_review(
    slug: str,
    review_data: ReviewCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Оставить отзыв (review) для аниме."""
    anime = await anime_service.get_by_slug(db, slug=slug)
    
    # Проверяем, оставлял ли пользователь уже отзыв на это аниме
    existing_review = await db.scalar(
        select(models.Review)
        .where(models.Review.user_id == current_user.id)
        .where(models.Review.anime_id == anime.id)
    )
    
    if existing_review:
        # Обновляем существующий отзыв
        existing_review.rating = review_data.rating
        existing_review.content = review_data.content
        await db.commit()
        return {"message": "Review updated", "id": existing_review.id}
    
    review = models.Review(
        user_id=current_user.id,
        anime_id=anime.id,
        rating=review_data.rating,
        content=review_data.content,
        is_approved=True
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)
    
    return {"message": "Review submitted", "id": review.id}

@router.get("/{slug}/reviews")
async def get_anime_reviews(
    slug: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all approved reviews for an anime."""
    anime = await anime_service.get_by_slug(db, slug=slug)
    
    query = (
        select(models.Review, User.username, User.avatar_url)
        .outerjoin(User, models.Review.user_id == User.id)
        .where(models.Review.anime_id == anime.id)
        .where(models.Review.is_approved == True)
        .order_by(desc(models.Review.created_at))
    )
    result = await db.execute(query)
    rows = result.all()
    
    return [{
        "id": r.Review.id,
        "user_id": r.Review.user_id,
        "username": r.username or "Anonymous",
        "avatar_url": r.avatar_url,
        "rating": r.Review.rating,
        "content": r.Review.content,
    } for r in rows]

# --- PHASE 2 ANALYTICS TRACKING ---

from app.modules.analytics.models import SearchQueryLog, VideoPlaybackSession
# app.api.deps imports moved to top
from app.core.broadcaster import broadcaster
from app.modules.anime.models import Anime
import random
import asyncio

class SearchQueryCreate(BaseModel):
    query: str = Field(..., max_length=200)
    results_count: int

@router.post("/search-log")
async def log_search_query(
    search_data: SearchQueryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Log search queries to track Empty Searches and Search Conversion."""
    log = SearchQueryLog(
        user_id=current_user.id if current_user else None,
        query_string=search_data.query.lower().strip(),
        results_count=search_data.results_count
    )
    db.add(log)
    await db.commit()
    return {"status": "ok"}

class VideoSessionCreate(BaseModel):
    clip_id: int
    anime_id: int
    duration_watched: int
    total_duration: int
    completed: bool
    episode_number: int = Field(default=1)
    bandwidth_mb: float = Field(default=0.0)

@router.post("/video-session")
async def log_video_session(
    request: Request,
    session_data: VideoSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Record how much of a video was watched to calculate Drop Rates and Binge tracking."""
    log = VideoPlaybackSession(
        user_id=current_user.id if current_user else None,
        clip_id=session_data.clip_id,
        anime_id=session_data.anime_id,
        duration_watched=session_data.duration_watched,
        total_duration=session_data.total_duration,
        completed=session_data.completed,
        episode_number=session_data.episode_number,
        bandwidth_mb=session_data.bandwidth_mb
    )
    db.add(log)
    await db.commit()
    # Broadcast to admin
    if current_user:
        anime = await db.get(Anime, session_data.anime_id)
        anime_title = anime.title if anime else f"Anime #{session_data.anime_id}"

        # Координаты для глобуса в админке. IP зрителя не уходит сторонним
        # сервисам: это персональные данные. Пока точка случайная; точную
        # геолокацию даст локальная база GeoLite2.
        lat = random.uniform(30, 50)  # noqa: S311 — декоративные координаты
        lng = random.uniform(-100, 20)  # noqa: S311

        asyncio.create_task(
            broadcaster.broadcast(
                event_type="video_watch_start",
                message=f"User {current_user.username} started watching {anime_title}",
                data={
                    "user_id": current_user.id, 
                    "username": current_user.username, 
                    "anime_id": session_data.anime_id,
                    "anime_title": anime_title,
                    "lat": lat,
                    "lng": lng
                }
            )
        )
        
    return {"status": "ok"}


