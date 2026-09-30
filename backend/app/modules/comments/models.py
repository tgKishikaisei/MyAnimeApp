from sqlalchemy import Column, Integer, String, Boolean, Text, Float, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.models import BaseIDModel, TimestampMixin


class Comment(BaseIDModel, TimestampMixin):
    __tablename__ = "comments"

    user_id     = Column(Integer, index=True, nullable=False)           # Кто написал
    target_type = Column(String(50), nullable=False, index=True)        # "anime", "clip", "news"
    target_id   = Column(Integer, nullable=False, index=True)           # ID объекта

    content     = Column(Text, nullable=False)                          # Текст комментария
    is_deleted  = Column(Boolean, default=False, index=True)            # Мягкое удаление

    # Потоковые комментарии (threading)
    parent_id   = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=True, index=True)
    replies     = relationship("Comment", back_populates="parent", cascade="all, delete-orphan",
                               foreign_keys=[parent_id], lazy="select")
    parent      = relationship("Comment", back_populates="replies", remote_side="Comment.id",
                               foreign_keys=[parent_id])

    # Реакции
    reactions   = relationship("CommentReaction", back_populates="comment",
                               cascade="all, delete-orphan", lazy="select")

    # Модерация (Фаза 3)
    toxicity_score = Column(Float, default=0.0, index=True)             # Оценка токсичности 0.0-1.0
    is_spam        = Column(Boolean, default=False, index=True)         # Флаг автоблокировки

    # Таймкод-комментарии (привязка к секунде видео)
    timecode_seconds = Column(Float, nullable=True, index=True)         # Секунда видео, напр. 42.5


# Список допустимых эмодзи-реакций
ALLOWED_EMOJIS = {"👍", "❤️", "🔥", "😂", "😮", "👎"}


class CommentReaction(BaseIDModel, TimestampMixin):
    """Реакция одного пользователя на один комментарий (один эмодзи на пользователя per комментарий)."""
    __tablename__ = "comment_reactions"

    comment_id = Column(Integer, ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id    = Column(Integer, nullable=False, index=True)
    emoji      = Column(String(10), nullable=False)  # "👍", "❤️", "🔥", "😂", "😮", "👎"

    comment    = relationship("Comment", back_populates="reactions")

    __table_args__ = (
        # Один пользователь — одна реакция на один комментарий
        UniqueConstraint("comment_id", "user_id", name="uq_comment_reaction_user"),
    )
