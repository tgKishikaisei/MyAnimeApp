"""
Безопасная загрузка файлов (видео-клипы, аватарки, постеры, картинки для новостей).

Что проверяется:
1. Размер — читаем поток кусками и обрываем на лимите, а не `await file.read()`
   целиком в память (иначе 5 ГБ «видео» положат сервер).
2. Реальный тип по сигнатуре (magic bytes), а не по расширению от клиента.
3. Картинки перекодируются через Pillow: это уничтожает полиглоты
   (например, JPEG со встроенным HTML/JS) и удаляет EXIF с GPS-координатами.
4. Имя файла генерирует сервер (uuid4); расширение берётся из реального типа.
5. `safe_media_path()` — единственный способ превратить путь из БД в путь на
   диске: всё, что выходит за пределы static/, отклоняется (path traversal).
"""
import io
import os
import tempfile
import uuid
from pathlib import Path
from typing import Optional

import filetype
from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.logger import get_logger

logger = get_logger(__name__)

# --- БАЗОВЫЕ НАСТРОЙКИ ПАПОК ---
STATIC_DIR = (Path(__file__).parent.parent.parent / "static").resolve()
VIDEOS_DIR = STATIC_DIR / "videos"
THUMBNAILS_DIR = STATIC_DIR / "thumbnails"

VIDEOS_DIR.mkdir(parents=True, exist_ok=True)
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)

# --- Разрешённые форматы (по реальной сигнатуре) ---
VIDEO_MIME_TO_EXT = {
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "video/x-matroska": ".mkv",
    "video/quicktime": ".mov",
}
IMAGE_MIME_TO_FORMAT = {
    "image/jpeg": ("JPEG", ".jpg"),
    "image/png": ("PNG", ".png"),
    "image/webp": ("WEBP", ".webp"),
}

MAX_VIDEO_SIZE = 500 * 1024 * 1024  # 500 MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024   # 10 MB
# Защита от «декомпрессионной бомбы»: PNG 50000×50000 весит килобайты, но в
# памяти занимает гигабайты. 40 Мп хватает для любой обложки.
Image.MAX_IMAGE_PIXELS = 40_000_000

_CHUNK = 1024 * 1024


class UnsafePath(ValueError):
    """Путь выходит за пределы static/."""


def safe_media_path(relative_path: str) -> Path:
    """
    Превращает путь из БД (`videos/x/clip.mp4`, `/static/videos/...`) в
    абсолютный путь внутри static/. Абсолютные пути, `..`, диски Windows и
    всё, что после resolve() оказалось вне static/, — отклоняются.
    """
    if not relative_path or "\x00" in relative_path:
        raise UnsafePath("Недопустимый путь к файлу")
    rel = relative_path.replace("\\", "/").lstrip("/")
    if rel.startswith("static/"):
        rel = rel[len("static/"):]
    candidate = (STATIC_DIR / rel).resolve()
    if not candidate.is_relative_to(STATIC_DIR) or candidate == STATIC_DIR:
        raise UnsafePath("Недопустимый путь к файлу")
    return candidate


def _relative(path: Path) -> str:
    return str(path.relative_to(STATIC_DIR)).replace("\\", "/")


async def _read_limited(file: UploadFile, limit: int) -> bytes:
    """Читает загрузку в память кусками, обрывая на лимите (для картинок)."""
    buf = io.BytesIO()
    while chunk := await file.read(_CHUNK):
        if buf.tell() + len(chunk) > limit:
            raise ValueError(f"Файл слишком большой (максимум {limit // (1024 * 1024)} MB)")
        buf.write(chunk)
    return buf.getvalue()


def _reencode_image(content: bytes) -> tuple[bytes, str]:
    """
    Декодирует картинку и сохраняет заново без метаданных.
    Возвращает (байты, расширение). Бросает ValueError для не-картинок.
    """
    kind = filetype.guess(content)
    if kind is None or kind.mime not in IMAGE_MIME_TO_FORMAT:
        raise ValueError("Разрешены только изображения JPEG, PNG или WebP")
    fmt, ext = IMAGE_MIME_TO_FORMAT[kind.mime]
    try:
        with Image.open(io.BytesIO(content)) as img:
            img.load()
            img = ImageOps.exif_transpose(img)
            if fmt == "JPEG" and img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            out = io.BytesIO()
            save_kwargs = {"optimize": True}
            if fmt in ("JPEG", "WEBP"):
                save_kwargs["quality"] = 90
            # exif/icc не передаём — метаданные не попадают в новый файл.
            img.save(out, format=fmt, **save_kwargs)
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, ValueError) as exc:
        raise ValueError("Не удалось обработать изображение") from exc
    return out.getvalue(), ext


async def save_image(file: UploadFile, subdir: str, prefix: str) -> tuple[str, str]:
    """Общий путь сохранения картинок. Возвращает (путь относительно static/, размер)."""
    import asyncio

    content = await _read_limited(file, MAX_IMAGE_SIZE)
    data, ext = await asyncio.to_thread(_reencode_image, content)
    target_dir = STATIC_DIR / subdir
    target_dir.mkdir(parents=True, exist_ok=True)
    path = target_dir / f"{prefix}_{uuid.uuid4().hex}{ext}"
    await asyncio.to_thread(path.write_bytes, data)
    return _relative(path), format_file_size(len(data))


def get_anime_folder(anime_title: str, season: int, episode: int) -> Path:
    """`static/videos/{имя_аниме}/season{N}/episode{N}/` — имя очищено от спецсимволов."""
    safe_title = "".join(c for c in anime_title if c.isalnum() or c in (" ", "-", "_")).strip()
    safe_title = safe_title.replace(" ", "_").lower() or "untitled"
    folder = VIDEOS_DIR / safe_title / f"season{int(season)}" / f"episode{int(episode)}"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


async def save_video_file(
    file: UploadFile,
    anime_title: str,
    season: int,
    episode: int,
    clip_id: Optional[int] = None,
) -> tuple[str, str]:
    """
    Сохраняет видео потоково во временный файл рядом с целевой папкой,
    проверяет сигнатуру по первым байтам и лимит размера, затем атомарно
    переносит на место.
    """
    target_dir = get_anime_folder(anime_title, season, episode)
    fd, tmp_name = tempfile.mkstemp(dir=target_dir, suffix=".part")
    size = 0
    ext = None
    try:
        with os.fdopen(fd, "wb") as out:
            while chunk := await file.read(_CHUNK):
                if ext is None:
                    kind = filetype.guess(chunk[:8192])
                    if kind is None or kind.mime not in VIDEO_MIME_TO_EXT:
                        raise ValueError("Разрешены только видео MP4, WebM, MKV или MOV")
                    ext = VIDEO_MIME_TO_EXT[kind.mime]
                size += len(chunk)
                if size > MAX_VIDEO_SIZE:
                    raise ValueError(f"Видео слишком большое (максимум {MAX_VIDEO_SIZE // (1024 * 1024)} MB)")
                out.write(chunk)
        if ext is None:
            raise ValueError("Пустой файл")
        name = f"clip_{clip_id}{ext}" if clip_id else f"clip_{uuid.uuid4().hex}{ext}"
        final = target_dir / name
        os.replace(tmp_name, final)
    except BaseException:
        Path(tmp_name).unlink(missing_ok=True)
        raise
    return _relative(final), format_file_size(size)


def format_file_size(size_bytes: float) -> str:
    """Переводит байты в «1.0 MB»."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


async def save_thumbnail_file(file: UploadFile, clip_id: Optional[int] = None) -> tuple[str, str]:
    return await save_image(file, "thumbnails", f"thumb_{clip_id}" if clip_id else "thumb")


async def save_anime_image(file: UploadFile, anime_id: Optional[int] = None) -> tuple[str, str]:
    return await save_image(file, "anime_images", f"anime_{anime_id}" if anime_id else "anime")


async def save_user_avatar(file: UploadFile, user_id: int) -> str:
    rel, _ = await save_image(file, "avatars", f"user_{int(user_id)}")
    return rel


def delete_file(relative_path: str) -> bool:
    """Удаляет файл из static/. Пути вне static/ игнорируются."""
    try:
        file_path = safe_media_path(relative_path)
        if file_path.is_file():
            file_path.unlink()
            return True
    except (UnsafePath, OSError) as e:
        logger.warning(f"Не удалось удалить файл: {type(e).__name__}")
    return False
