from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.core.database import get_db
from app.modules.anime import schemas
from app.modules.anime.service import anime_service

router = APIRouter()

# 1. ПОЛУЧИТЬ ВСЕ КЛИПЫ (ПАГИНАЦИЯ)
@router.get("/", response_model=List[schemas.Clip])
async def get_all_clips(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Извлекает список загруженных видео (Для построения бесконечной ленты / feed)."""
    return await anime_service.get_clips(db, skip=skip, limit=limit)

# 2. ПОЛУЧИТЬ ОДИН КЛИП (ДЕТАЛИЗАЦИЯ)
@router.get("/{clip_id}", response_model=schemas.Clip)
async def get_clip(clip_id: int, db: AsyncSession = Depends(get_db)):
    """Получение информации по 1 конкретному плееру (видео)."""
    return await anime_service.get_clip_by_id(db, clip_id=clip_id)

from fastapi import UploadFile, File, Form
from typing import Optional
from app.api.deps import get_current_active_superuser
from app.modules.user.models import User
from app.core.file_upload import save_video_file, save_thumbnail_file


# 3. УДАЛИТЬ КЛИП — только администратор
@router.delete("/{clip_id}", status_code=204)
async def delete_clip(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Безвозвратное удаление видеофайла."""
    await anime_service.delete_clip(db, clip_id=clip_id)
    return None

# 4. ОБНОВИТЬ КЛИП — только администратор
@router.patch("/{clip_id}", response_model=schemas.Clip)
async def update_clip(
    clip_id: int,
    clip_in: schemas.ClipUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Изменение метаданных. video_path проверяется схемой (только внутри static/)."""
    return await anime_service.update_clip(db, clip_id=clip_id, clip_in=clip_in)

# 5. ЗАГРУЗИТЬ КЛИП С ФАЙЛАМИ НА СЕРВЕР (UPLOAD)

@router.post("/upload", response_model=schemas.Clip)
async def upload_clip(
    video_file: UploadFile = File(..., description="Сам видеофайл в формате .mp4"),
    thumbnail_file: Optional[UploadFile] = File(None, description="Картинка-превью (если нет, движок сгенерирует сам)"),
    title: str = Form(..., description="Название серии/клипа"),
    anime_id: int = Form(..., description="К какому сериалу относится"),
    season: int = Form(1, description="Номер сезона"),
    episode: int = Form(1, description="Номер серии"),
    db: AsyncSession = Depends(get_db),
    # Ограничитель: Только Админ (Контент-мейкер) может вызывать этот энпоинт
    current_user: User = Depends(get_current_active_superuser) 
):
    """
    Эндпоинт для загрузки тяжелых видеофайлов.
    
    Алгоритм:
    1. Ищет Сериал, чтобы понять, в какую физическую папку на сервере сохранять видео.
    2. Пытается сохранить видеофайл на диск по пути `/static/videos/{anime_name}/season{N}/episode{N}/`.
    3. Опционально сохраняет превью картинку.
    4. Записывает этот физический путь в Базу Данных, чтобы потом отдавать плееру.
    """
    
    # Получаем аниме, чтобы использовать его название (slug/title) для структуры файловых директорий
    anime = await anime_service.get_by_id(db, anime_id)
    
    # 1-2. Сохраняем видео и (опционально) превью. Ошибки проверки файла → 400.
    try:
        video_path, file_size = await save_video_file(video_file, anime.title, season, episode)
        thumbnail_path = None
        if thumbnail_file:
            thumbnail_path, _ = await save_thumbnail_file(thumbnail_file)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    # 3. Фиксируем информацию в PostgreSQL
    clip_data = schemas.ClipCreate(
        title=title,
        video_path=video_path,
        thumbnail_path=thumbnail_path,
        season=season,
        episode=episode,
        file_size=file_size,
        quality="1080p"  # Заглушка. В идеале FFmpeg модуль должен сначала распарсить файл
    )
    
    clip = await anime_service.add_clip(db, anime_id=anime_id, clip_in=clip_data)
    return clip
