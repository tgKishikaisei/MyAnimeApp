"""
Скачивание серий: один клип или ZIP (выбранные клипы, сезон, эпизод).

Защита:
- Подписанные ссылки (HMAC, 10 минут) против хотлинкинга. Токен одиночного
  клипа привязан к clip_id, токен архива — к anime_id (отрицательный id).
- Путь к файлу из БД проходит через safe_media_path, поэтому
  `video_path="../../.env"` не выведет за пределы static/.
- ZIP собирается в отдельном потоке (не блокирует event loop), с лимитом на
  количество клипов и суммарный объём; POST /zip требует входа.
"""
import asyncio
import os
import re
import tempfile
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.core.file_upload import UnsafePath, safe_media_path
from app.core.logger import get_logger
from app.core.signed_url import create_download_token, verify_download_token
from app.modules.anime import models
from app.modules.user.models import User

router = APIRouter()
logger = get_logger(__name__)

MAX_ZIP_CLIPS = 50
MAX_ZIP_BYTES = 4 * 1024 * 1024 * 1024  # 4 GB


def _sanitize(name: str) -> str:
    return re.sub(r"[^\w\-. ]", "", name or "")[:120].strip() or "clip"


def _clip_file(clip: models.Clip) -> Path | None:
    if not clip.video_path:
        return None
    try:
        path = safe_media_path(clip.video_path)
    except UnsafePath:
        logger.warning("Clip has unsafe video_path", extra={"clip_id": clip.id})
        return None
    return path if path.is_file() else None


def _remove_file(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


def _build_zip(entries: list[tuple[Path, str]]) -> str:
    fd, temp_path = tempfile.mkstemp(suffix=".zip")
    os.close(fd)
    try:
        # Видео уже сжато — ZIP_STORED не тратит CPU на бесполезное сжатие.
        with zipfile.ZipFile(temp_path, "w", zipfile.ZIP_STORED, allowZip64=True) as zipf:
            for path, arc_name in entries:
                zipf.write(path, arc_name)
    except BaseException:
        _remove_file(temp_path)
        raise
    return temp_path


async def _zip_response(clips: list[models.Clip], filename: str, background_tasks: BackgroundTasks):
    if not clips:
        raise HTTPException(status_code=404, detail="Клипы не найдены")
    if len(clips) > MAX_ZIP_CLIPS:
        raise HTTPException(status_code=413, detail=f"Не больше {MAX_ZIP_CLIPS} клипов в одном архиве")

    entries: list[tuple[Path, str]] = []
    total = 0
    for clip in clips:
        path = _clip_file(clip)
        if path is None:
            continue
        total += path.stat().st_size
        if total > MAX_ZIP_BYTES:
            raise HTTPException(status_code=413, detail="Архив получается слишком большим")
        anime_title = _sanitize(clip.anime.title) if clip.anime else "Anime"
        arc_name = f"{anime_title}/Сезон {clip.season}/Эпизод {clip.episode}/{_sanitize(clip.title)}_{clip.id}.mp4"
        entries.append((path, arc_name))

    if not entries:
        raise HTTPException(status_code=404, detail="Файлы клипов отсутствуют")

    try:
        temp_path = await asyncio.to_thread(_build_zip, entries)
    except Exception:
        logger.exception("ZIP build failed")
        raise HTTPException(status_code=500, detail="Не удалось собрать архив")

    background_tasks.add_task(_remove_file, temp_path)
    return FileResponse(path=temp_path, filename=filename, media_type="application/zip")


def _check_anime_token(token: str, anime_id: int) -> None:
    payload = verify_download_token(token)
    if payload.get("clip_id") != -anime_id:
        raise HTTPException(status_code=403, detail="Токен не подходит к этому аниме")


async def _anime_clips(db: AsyncSession, anime_id: int, season: int, episodes: list[int] | None = None):
    query = (
        select(models.Clip)
        .options(selectinload(models.Clip.anime))
        .where(models.Clip.anime_id == anime_id, models.Clip.season == season)
        .order_by(models.Clip.episode, models.Clip.id)
        .limit(MAX_ZIP_CLIPS + 1)
    )
    if episodes is not None:
        query = query.where(models.Clip.episode.in_(episodes))
    return list((await db.execute(query)).scalars().all())


# ─── 1. Подписанные ссылки ───────────────────────────────────────────────────

@router.get("/sign/{clip_id}")
async def get_signed_download_url(clip_id: int, db: AsyncSession = Depends(get_db)):
    clip = await db.get(models.Clip, clip_id)
    if not clip or not clip.video_path:
        raise HTTPException(status_code=404, detail="Клип не найден")
    token = create_download_token(clip_id=clip_id)
    return {"token": token, "url": f"{settings.API_V1_STR}/downloads/clip/{clip_id}?token={token}"}


@router.get("/sign/zip/anime/{anime_id}")
async def get_signed_zip_url(anime_id: int, db: AsyncSession = Depends(get_db)):
    if not await db.get(models.Anime, anime_id):
        raise HTTPException(status_code=404, detail="Аниме не найдено")
    token = create_download_token(clip_id=-anime_id)
    return {"token": token}


# ─── 2. Выдача файлов ────────────────────────────────────────────────────────

@router.get("/clip/{clip_id}")
async def download_clip(
    clip_id: int,
    token: str = Query(..., max_length=512),
    db: AsyncSession = Depends(get_db),
):
    payload = verify_download_token(token)
    if payload.get("clip_id") != clip_id:
        raise HTTPException(status_code=403, detail="Токен скачивания не подходит к этому клипу")

    clip = await db.get(models.Clip, clip_id)
    path = _clip_file(clip) if clip else None
    if path is None:
        raise HTTPException(status_code=404, detail="Файл клипа отсутствует")
    return FileResponse(path=path, filename=f"{_sanitize(clip.title)}.mp4", media_type="video/mp4")


@router.post("/zip")
async def download_zip(
    background_tasks: BackgroundTasks,
    clip_ids: List[int] = Body(..., max_length=MAX_ZIP_CLIPS),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """ZIP из выбранных клипов (только для вошедших, до 50 клипов)."""
    if not clip_ids:
        raise HTTPException(status_code=400, detail="Не переданы ID серий")
    query = select(models.Clip).options(selectinload(models.Clip.anime)).where(models.Clip.id.in_(set(clip_ids)))
    clips = list((await db.execute(query)).scalars().all())
    return await _zip_response(clips, "anime_clips_download.zip", background_tasks)


@router.get("/zip/anime/{anime_id}/season/{season}")
async def download_season(
    anime_id: int,
    season: int,
    background_tasks: BackgroundTasks,
    token: str = Query(..., max_length=512),
    db: AsyncSession = Depends(get_db),
):
    _check_anime_token(token, anime_id)
    clips = await _anime_clips(db, anime_id, season)
    return await _zip_response(clips, f"Anime_{anime_id}_S{season}.zip", background_tasks)


@router.get("/zip/anime/{anime_id}/season/{season}/episode/{episode}")
async def download_episode(
    anime_id: int,
    season: int,
    episode: int,
    background_tasks: BackgroundTasks,
    token: str = Query(..., max_length=512),
    db: AsyncSession = Depends(get_db),
):
    _check_anime_token(token, anime_id)
    clips = await _anime_clips(db, anime_id, season, [episode])
    return await _zip_response(clips, f"Anime_{anime_id}_S{season}_E{episode}.zip", background_tasks)


@router.post("/zip/anime/{anime_id}/season/{season}/episodes")
async def download_selected_episodes(
    anime_id: int,
    season: int,
    background_tasks: BackgroundTasks,
    episodes: List[int] = Body(..., max_length=200),
    token: str = Query(..., max_length=512),
    db: AsyncSession = Depends(get_db),
):
    _check_anime_token(token, anime_id)
    clips = await _anime_clips(db, anime_id, season, episodes)
    return await _zip_response(clips, f"Anime_{anime_id}_S{season}_Selected_Episodes.zip", background_tasks)
