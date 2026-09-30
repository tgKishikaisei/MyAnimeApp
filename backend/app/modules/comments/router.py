import random
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.api.deps import get_current_user, get_current_user_optional
from app.modules.user.models import User, UserRole
from app.modules.comments.models import Comment
from app.modules.analytics.models import SecurityLog
from app.core.broadcaster import broadcaster
from app.modules.comments.service import comment_service
from app.modules.anime.service import anime_service

router = APIRouter()


class CommentCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=1000)
    parent_id: Optional[int] = Field(None, description="ID родительского комментария для ответов")
    timecode_seconds: Optional[float] = Field(None, ge=0, description="Секунда видео (для клип-комментариев)")


class ReactionBody(BaseModel):
    emoji: str = Field(..., description="Один из: 👍 ❤️ 🔥 😂 😮 👎")


# ─────────────────────────────────────────────────────────────────────────────
# GET: Комментарии к аниме (дерево + реакции)
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/anime/{slug}")
async def get_anime_comments(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Получить все комментарии к аниме (дерево с вложенными ответами и реакциями)."""
    anime = await anime_service.get_by_slug(db, slug=slug)
    if not anime:
        raise HTTPException(status_code=404, detail="Аниме не найдено")
    return await comment_service.get_target_comments(
        db,
        target_type="anime",
        target_id=anime.id,
        current_user_id=current_user.id if current_user else None,
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST: Создать комментарий или ответ
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/anime/{slug}")
async def create_anime_comment(
    slug: str,
    comment_data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Опубликовать комментарий к аниме.
    Если передан parent_id — это ответ на существующий комментарий.
    """
    anime = await anime_service.get_by_slug(db, slug=slug)
    if not anime:
        raise HTTPException(status_code=404, detail="Аниме не найдено")

    toxicity_score = round(random.uniform(0.0, 1.0), 2)
    is_spam = toxicity_score > 0.85

    try:
        comment = await comment_service.create_comment(
            db=db,
            user_id=current_user.id,
            target_type="anime",
            target_id=anime.id,
            content=comment_data.content,
            toxicity_score=toxicity_score,
            is_spam=is_spam,
            parent_id=comment_data.parent_id,
            timecode_seconds=comment_data.timecode_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if is_spam:
        log = SecurityLog(
            event_type="spam_blocked",
            user_id=current_user.id,
            details=f"Токсичность: {toxicity_score}. Target: anime/{slug}",
        )
        db.add(log)
        await db.commit()
        return {"message": "Комментарий скрыт на проверку.", "id": comment.id}

    await db.commit()
    await db.refresh(comment)

    action = "new_reply" if comment_data.parent_id else "new_comment"
    asyncio.create_task(
        broadcaster.broadcast(
            event_type=action,
            message=f"New {'reply' if comment_data.parent_id else 'comment'} from {current_user.username}",
            data={
                "user_id": current_user.id,
                "username": current_user.username,
                "anime_id": anime.id,
                "parent_id": comment_data.parent_id,
                "content": comment_data.content[:50] + "..." if len(comment_data.content) > 50 else comment_data.content,
            },
        )
    )

    return {"message": "Комментарий опубликован", "id": comment.id, "parent_id": comment.parent_id,
            "timecode_seconds": comment.timecode_seconds}


# ─────────────────────────────────────────────────────────────────────────────
# GET + POST: Таймкод-комментарии к клипу
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/clip/{clip_id}")
async def get_clip_comments(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional),
):
    """Все комментарии к клипу, отсортированные по таймкоду."""
    return await comment_service.get_clip_timecode_comments(
        db, clip_id=clip_id,
        current_user_id=current_user.id if current_user else None,
    )


@router.post("/clip/{clip_id}")
async def post_clip_comment(
    clip_id: int,
    comment_data: CommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Оставить таймкод-комментарий к клипу."""
    import random
    toxicity_score = round(random.uniform(0.0, 1.0), 2)
    is_spam = toxicity_score > 0.85

    try:
        comment = await comment_service.create_comment(
            db=db,
            user_id=current_user.id,
            target_type="clip",
            target_id=clip_id,
            content=comment_data.content,
            toxicity_score=toxicity_score,
            is_spam=is_spam,
            timecode_seconds=comment_data.timecode_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if is_spam:
        await db.commit()
        return {"message": "Комментарий скрыт на проверку.", "id": comment.id}

    await db.commit()
    await db.refresh(comment)
    return {"message": "Комментарий опубликован", "id": comment.id,
            "timecode_seconds": comment.timecode_seconds}


# ─────────────────────────────────────────────────────────────────────────────
# POST: Реакция на комментарий (toggle)
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{comment_id}/react")
async def react_to_comment(
    comment_id: int,
    body: ReactionBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Добавить / убрать / сменить реакцию на комментарий.

    - Если пользователь уже поставил тот же эмодзи → убирает его (toggle off).
    - Если ставит другой эмодзи → реакция меняется (max 1 на пользователя).
    - Если реакции нет → добавляет.

    Returns обновлённые счётчики: { reactions: {"👍": 5}, my_reaction: "👍" | null }
    """
    # Проверяем что комментарий существует и не удалён
    comment = await db.get(Comment, comment_id)
    if not comment or comment.is_deleted or comment.is_spam:
        raise HTTPException(status_code=404, detail="Комментарий не найден")

    try:
        result = await comment_service.toggle_reaction(
            db=db,
            comment_id=comment_id,
            user_id=current_user.id,
            emoji=body.emoji,
        )
        await db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─────────────────────────────────────────────────────────────────────────────
# DELETE: Мягкое удаление комментария
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{comment_id}")
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Мягкое удаление комментария (только свои, либо суперпользователь)."""
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    # Удалить чужой комментарий может только администратор (role == ADMIN).
    if comment.user_id != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=404, detail="Комментарий не найден")
    comment.is_deleted = True
    await db.commit()
    return {"message": "Комментарий удалён"}
