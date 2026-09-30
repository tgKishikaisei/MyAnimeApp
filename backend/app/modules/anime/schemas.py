import re
from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import List, Optional
from datetime import datetime
from app.modules.anime.enums import AnimeSection, VideoQuality

# Путь к медиа внутри static/: только относительный, без `..`, без схемы и диска.
# Иначе PATCH клипа и скачивание позволили бы прочитать любой файл сервера
# (например, backend/.env).
_MEDIA_PATH_RE = re.compile(r"^/?(static/)?[\w\-./]+$")


def _check_media_path(v: Optional[str]) -> Optional[str]:
    if v is None or v == "":
        return v
    if not _MEDIA_PATH_RE.match(v) or ".." in v.split("/") or "//" in v:
        raise ValueError("Путь к файлу должен быть относительным путём внутри static/")
    return v


def _check_link(v: Optional[str]) -> Optional[str]:
    """Ссылки: только http(s), относительные `/...` или якорь `#`."""
    if v is None or v == "" or v == "#":
        return v
    if v.startswith("/") and not v.startswith("//"):
        return v
    if re.match(r"^https?://", v, re.IGNORECASE):
        return v
    raise ValueError("Разрешены только ссылки http(s) или относительные пути")

# --- ТЕГИ ---
class TagBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)

class Tag(TagBase):
    id: int
    class Config:
        from_attributes = True

# --- КЛИПЫ ---
class ClipBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    video_id: Optional[str] = Field(None, min_length=5, max_length=100)  # YouTube ID (optional)
    video_path: Optional[str] = Field(None, max_length=500)  # Локальный путь
    thumbnail_path: Optional[str] = Field(None, max_length=500)  # Путь к превью
    quality: VideoQuality = VideoQuality.Q_1080P
    fps: int = Field(24, ge=1, le=240) # FPS от 1 до 240
    file_size: Optional[str] = None
    duration: Optional[int] = Field(None, ge=0)  # Длительность в секундах
    season: int = Field(1, ge=1)
    episode: int = Field(1, ge=1)

class ClipCreate(ClipBase):
    # Валидаторы только на входных схемах: старые данные в БД не должны
    # ронять ответы GET.
    @field_validator("video_path", "thumbnail_path")
    @classmethod
    def validate_media_paths(cls, v):
        return _check_media_path(v)

class ClipUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    video_id: Optional[str] = Field(None, max_length=100)
    video_path: Optional[str] = Field(None, max_length=500)
    thumbnail_path: Optional[str] = Field(None, max_length=500)
    quality: Optional[VideoQuality] = None
    fps: Optional[int] = Field(None, ge=1, le=240)
    duration: Optional[int] = Field(None, ge=0)
    season: Optional[int] = Field(None, ge=1)
    episode: Optional[int] = Field(None, ge=1)

    @field_validator("video_path", "thumbnail_path")
    @classmethod
    def validate_media_paths(cls, v):
        return _check_media_path(v)

class Clip(ClipBase):
    id: int
    views: int
    created_at: datetime
    anime_id: int
    class Config:
        from_attributes = True

# --- АНИМЕ ---
class AnimeBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    slug: Optional[str] = None
    image: str = "/placeholder.png" # Default placeholder for imports
    banner: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = Field(None, ge=1900, le=2100) # Год от 1900 до 2100
    
    # Рейтинг от 0 до 10
    rating: Optional[float] = Field(0.0, ge=0.0, le=10.0)
    
    section: AnimeSection
    sort_order: int = 0
    highlight_char: Optional[str] = Field(None, max_length=20)
    accent_color: Optional[str] = Field(None, max_length=50)

class AnimeCreate(AnimeBase):
    pass

class AnimeUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    slug: Optional[str] = None
    image: Optional[str] = None
    banner: Optional[str] = None
    description: Optional[str] = None
    year: Optional[int] = None
    rating: Optional[float] = Field(None, ge=0.0, le=10.0)
    section: Optional[AnimeSection] = None
    sort_order: Optional[int] = None
    highlight_char: Optional[str] = None
    accent_color: Optional[str] = None

class Anime(AnimeBase):
    id: int
    created_at: datetime
    clips: List[Clip] = []
    tags: List[Tag] = []

    class Config:
        from_attributes = True

# --- НОВОСТИ ---
class NewsBase(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    video_id: str = Field(..., max_length=100)
    image: Optional[str] = Field(None, max_length=500)

class NewsCreate(NewsBase):
    pass

class NewsUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    video_id: Optional[str] = None
    image: Optional[str] = None

class News(NewsBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# --- БЛОГ ---
class BlogPostBase(BaseModel):
    title: str = Field(..., max_length=255)
    image: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = None
    color: Optional[str] = Field(None, max_length=50)
    link: Optional[str] = Field(None, max_length=500)

class BlogPostCreate(BlogPostBase):
    @field_validator("link", "image")
    @classmethod
    def validate_links(cls, v):
        return _check_link(v)

class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, max_length=255)
    image: Optional[str] = Field(None, max_length=500)
    content: Optional[str] = Field(None, max_length=100_000)
    color: Optional[str] = Field(None, max_length=50)
    link: Optional[str] = Field(None, max_length=500)

    @field_validator("link", "image")
    @classmethod
    def validate_links(cls, v):
        return _check_link(v)

class BlogPost(BlogPostBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# --- HIERARCHY SCHEMAS ---
class SeasonInfo(BaseModel):
    """Information about a season with clip count"""
    season_number: int
    clip_count: int

class EpisodeInfo(BaseModel):
    """Information about an episode with clip count"""
    episode_number: int
    clip_count: int
