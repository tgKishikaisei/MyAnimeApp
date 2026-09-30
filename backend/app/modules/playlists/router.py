from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_user
from app.modules.user.models import User
from app.modules.playlists.service import playlist_service

router = APIRouter()


# ── Pydantic schemas ────────────────────────────────────────────────────────

class PlaylistCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    is_public: bool = True


class PlaylistUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=120)
    description: Optional[str] = Field(None, max_length=500)
    is_public: Optional[bool] = None


class ClipAction(BaseModel):
    clip_id: int


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/")
async def list_my_playlists(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить все плейлисты текущего пользователя."""
    return await playlist_service.get_user_playlists(db, current_user.id)


@router.get("/public/{slug}")
async def get_public_playlist(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Получить публичный плейлист по slug (без авторизации)."""
    playlist = await playlist_service.get_public_playlist(db, slug)
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден или приватный")
    return playlist


@router.get("/{playlist_id}")
async def get_playlist(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Получить детали конкретного плейлиста (владелец или публичный)."""
    playlist = await playlist_service.get_playlist_detail(db, playlist_id, current_user.id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден")
    return playlist


@router.post("/")
async def create_playlist(
    data: PlaylistCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Создать новый плейлист."""
    playlist = await playlist_service.create_playlist(
        db, current_user.id, data.title, data.description, data.is_public
    )
    await db.commit()
    await db.refresh(playlist)
    return playlist_service._serialize(playlist, 0)


@router.patch("/{playlist_id}")
async def update_playlist(
    playlist_id: int,
    data: PlaylistUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновить название / описание / видимость плейлиста."""
    playlist = await playlist_service.update_playlist(
        db, playlist_id, current_user.id, data.title, data.description, data.is_public
    )
    if not playlist:
        raise HTTPException(status_code=404, detail="Плейлист не найден или нет доступа")
    await db.commit()
    await db.refresh(playlist)
    return {"message": "Обновлено", "id": playlist.id}


@router.post("/{playlist_id}/clips")
async def add_clip_to_playlist(
    playlist_id: int,
    body: ClipAction,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Добавить клип в плейлист."""
    ok = await playlist_service.add_clip(db, playlist_id, body.clip_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=403, detail="Нет доступа к плейлисту")
    await db.commit()
    return {"message": "Клип добавлен"}


@router.delete("/{playlist_id}/clips/{clip_id}")
async def remove_clip_from_playlist(
    playlist_id: int,
    clip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Убрать клип из плейлиста."""
    ok = await playlist_service.remove_clip(db, playlist_id, clip_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=403, detail="Нет доступа к плейлисту")
    await db.commit()
    return {"message": "Клип удалён"}


@router.delete("/{playlist_id}")
async def delete_playlist(
    playlist_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Удалить плейлист полностью."""
    ok = await playlist_service.delete_playlist(db, playlist_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=404, detail="Плейлист не найден или нет доступа")
    await db.commit()
    return {"message": "Плейлист удалён"}
