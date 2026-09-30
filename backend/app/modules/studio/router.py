"""
Мини-студия: нарезка клипа, GIF, вертикальное видео, извлечение звука.

Защита от злоупотреблений (рендер FFmpeg нагружает CPU сервера):
- только вошедшие пользователи + rate limit;
- не больше `MAX_PARALLEL_RENDERS` рендеров одновременно на весь процесс;
- путь к исходнику проходит через safe_media_path (только внутри static/);
- временный файл удаляется после отправки ответа;
- в ответах нет путей сервера и текста ошибок FFmpeg (они только в логе).
"""
import asyncio
import os
import re
import tempfile
import uuid

import ffmpeg
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.background import BackgroundTask

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.file_upload import UnsafePath, safe_media_path
from app.core.logger import get_logger
from app.core.rate_limit import limiter
from app.modules.anime.models import Clip
from app.modules.user.models import User

from .schemas import ClipProcessRequest
from .service import extract_audio_async, process_video_async

router = APIRouter()
logger = get_logger(__name__)

MAX_PARALLEL_RENDERS = 2
_render_slots = asyncio.Semaphore(MAX_PARALLEL_RENDERS)
STUDIO_RATE_LIMIT = "10/minute"


def _source_path(clip: Clip) -> str:
    if not clip.video_path:
        raise HTTPException(status_code=404, detail="Клип не найден")
    try:
        path = safe_media_path(clip.video_path)
    except UnsafePath:
        raise HTTPException(status_code=404, detail="Клип не найден")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="Исходный файл клипа отсутствует")
    return str(path)


def _safe_name(value: str) -> str:
    return re.sub(r"[^\w\-. ]", "", value)[:80].strip() or "clip"


def _remove(path: str) -> None:
    try:
        os.remove(path)
    except OSError:
        pass


@router.post("/{clip_id}/studio")
@limiter.limit(STUDIO_RATE_LIMIT)
async def process_clip_in_studio(
    request: Request,
    clip_id: int,
    params: ClipProcessRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обрезает клип (до 15 с) и отдаёт MP4/GIF/вертикальное видео."""
    clip = await db.get(Clip, clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Клип не найден")
    input_filepath = _source_path(clip)

    ext = "mp4" if params.format == "mobile" else params.format
    output_filepath = os.path.join(tempfile.gettempdir(), f"studio_{uuid.uuid4().hex}.{ext}")

    if _render_slots.locked():
        raise HTTPException(status_code=429, detail="Студия занята, попробуйте через минуту")
    try:
        async with _render_slots:
            await process_video_async(
                input_filepath=input_filepath,
                output_filepath=output_filepath,
                start_time=params.start_time,
                duration=params.end_time - params.start_time,
                format=params.format,
                quality=params.quality,
                fps=params.fps,
                speed=params.speed,
                audio_effect=params.audio_effect,
                add_text=params.add_text,
            )
    except ffmpeg.Error as e:
        stderr = e.stderr.decode("utf8", errors="ignore")[-2000:] if e.stderr else ""
        logger.error("FFmpeg studio render failed", extra={"clip_id": clip_id, "stderr": stderr})
        _remove(output_filepath)
        raise HTTPException(status_code=500, detail="Не удалось обработать видео")
    except Exception:
        logger.exception("Studio render failed")
        _remove(output_filepath)
        raise HTTPException(status_code=500, detail="Не удалось обработать видео")

    if not os.path.exists(output_filepath):
        raise HTTPException(status_code=500, detail="Не удалось обработать видео")

    return FileResponse(
        path=output_filepath,
        filename=f"MyAnimeClip_{_safe_name(clip.title)}_{int(params.start_time)}-{int(params.end_time)}.{ext}",
        media_type="image/gif" if params.format == "gif" else "video/mp4",
        background=BackgroundTask(_remove, output_filepath),
    )


@router.get("/{clip_id}/audio")
@limiter.limit(STUDIO_RATE_LIMIT)
async def extract_audio_from_clip(
    request: Request,
    clip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Извлекает звуковую дорожку клипа в MP3."""
    clip = await db.get(Clip, clip_id)
    if not clip:
        raise HTTPException(status_code=404, detail="Клип не найден")
    input_filepath = _source_path(clip)
    output_filepath = os.path.join(tempfile.gettempdir(), f"audio_{uuid.uuid4().hex}.mp3")

    if _render_slots.locked():
        raise HTTPException(status_code=429, detail="Студия занята, попробуйте через минуту")
    try:
        async with _render_slots:
            await extract_audio_async(input_filepath, output_filepath)
    except Exception:
        logger.exception("Audio extraction failed")
        _remove(output_filepath)
        raise HTTPException(status_code=500, detail="Не удалось извлечь звук")

    if not os.path.exists(output_filepath):
        raise HTTPException(status_code=500, detail="Не удалось извлечь звук")

    return FileResponse(
        path=output_filepath,
        filename=f"{_safe_name(clip.title)}_Audio.mp3",
        media_type="audio/mpeg",
        background=BackgroundTask(_remove, output_filepath),
    )
