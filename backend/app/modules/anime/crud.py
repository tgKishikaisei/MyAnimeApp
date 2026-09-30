from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import desc
from typing import List, Optional

from app.modules.anime import models, schemas
from app.modules.anime.enums import AnimeSection

# =======================
# 🟢 ANIME CRUD (Data Access Object)
# =======================

async def get_multi(
    db: AsyncSession, 
    section: Optional[AnimeSection] = None, 
    skip: int = 0, 
    limit: int = 100,
    q: Optional[str] = None,
) -> List[models.Anime]:
    """
    Главный движок поиска и вывода Аниме-карточек (Для главной страницы и каталога).
    - `skip`/`limit` = отвечает за Подгрузку при скролле (Пагинация).
    - `?q=Naruto` = выполняет нечувствительный к регистру поиск (ILIKE) по названию.
    - `options(selectinload)` = Решает проблему 'N+1 Запросов'. Мы просим SQL сразу 
      подтянуть и клипы, и теги внутри одного быстрого запроса, а не долбить базу по циклу.
    """
    query = select(models.Anime).options(
        selectinload(models.Anime.clips),
        selectinload(models.Anime.tags)
    )
    
    # Если фронтенд просит конкретную секцию (Например: Секция "Популярное" на Главной)
    if section:
        query = query.filter(models.Anime.section == section)

    # Если ввели в строку поиска на сайте
    if q:
        query = query.filter(models.Anime.title.ilike(f"%{q}%"))
    
    # Сверхбыстрая Сортировка: 
    # Сначала учитываем ручной порядок Админа (sort_order), затем новые (по Дате Создания)
    result = await db.execute(query.order_by(models.Anime.sort_order.asc(), desc(models.Anime.id)).offset(skip).limit(limit))
    return result.scalars().all()


async def get_by_slug(db: AsyncSession, slug: str) -> Optional[models.Anime]:
    """
    Поиск для страницы конкретного Аниме.
    Ищет по красивому ЧПУ-url (Например: /anime/solo-leveling)
    """
    query = select(models.Anime).options(
        selectinload(models.Anime.clips),
        selectinload(models.Anime.tags)
    ).filter(models.Anime.slug == slug)
    result = await db.execute(query)
    return result.scalars().first()

async def get(db: AsyncSession, anime_id: int) -> Optional[models.Anime]:
    """Поиск по строгому системному ID (Обычно используется Админкой)."""
    query = select(models.Anime).options(
        selectinload(models.Anime.clips),
        selectinload(models.Anime.tags)
    ).filter(models.Anime.id == anime_id)
    result = await db.execute(query)
    return result.scalars().first()

async def create(db: AsyncSession, anime_in: schemas.AnimeCreate) -> models.Anime:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Создание новой пустой карточки (Без видеофайлов)."""
    db_anime = models.Anime(**anime_in.model_dump())
    db.add(db_anime)
    await db.flush() # Подготовка к записи, чтобы сгенерировался ID
    await db.refresh(db_anime)
    return db_anime

async def update(
    db: AsyncSession, 
    *, 
    db_obj: models.Anime, 
    obj_in: schemas.AnimeUpdate
) -> models.Anime:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Частичное редактирование полей (Например, смена превью-картинки)."""
    update_data = obj_in.model_dump(exclude_unset=True)
    
    for key, value in update_data.items():
        setattr(db_obj, key, value)

    db.add(db_obj)
    await db.flush()
    await db.refresh(db_obj)
    return db_obj

async def delete(db: AsyncSession, db_obj: models.Anime) -> models.Anime:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Удаление карточки (Cascade-Delete автоматически уничтожит и все клипы)."""
    await db.delete(db_obj)
    await db.flush()
    return db_obj


# =======================
# 🔵 CLIP CRUD (Управление Загруженными Видео)
# =======================

async def get_multi_clips(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 50
) -> List[models.Clip]:
    """Список последних загруженных видеофайлов на сервер."""
    result = await db.execute(select(models.Clip).order_by(desc(models.Clip.created_at)).offset(skip).limit(limit))
    return result.scalars().all()

async def get_clip(db: AsyncSession, clip_id: int) -> Optional[models.Clip]:
    """Поиск конкретного видео для инициализации плеера."""
    result = await db.execute(select(models.Clip).filter(models.Clip.id == clip_id))
    return result.scalars().first()

async def create_clip(db: AsyncSession, clip_in: schemas.ClipCreate, anime_id: int) -> models.Clip:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Привязать новое видео (Например: Эпизод 5) к Сериалу (anime_id)."""
    db_clip = models.Clip(**clip_in.model_dump(), anime_id=anime_id)
    db.add(db_clip)
    await db.flush()
    await db.refresh(db_clip)
    return db_clip

async def update_clip(
    db: AsyncSession, 
    *, 
    db_clip: models.Clip, 
    clip_in: schemas.ClipUpdate
) -> models.Clip:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Изменить описание серии."""
    update_data = clip_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_clip, key, value)

    db.add(db_clip)
    await db.flush()
    await db.refresh(db_clip)
    return db_clip

async def delete_clip(db: AsyncSession, db_clip: models.Clip) -> models.Clip:
    """[ЗАНЕСЕНИЕ В БАЗУ]: Удалить серию (видео). Сам физический mp4 файл удаляется в сервисе."""
    await db.delete(db_clip)
    await db.flush() 
    return db_clip
