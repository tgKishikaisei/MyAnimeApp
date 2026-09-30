from sqlalchemy import Column, Integer, String, Boolean, Text, ForeignKey, Table
from sqlalchemy.orm import relationship
from app.core.models import BaseIDModel, TimestampMixin


# Связующая таблица: клипы в плейлисте (many-to-many)
playlist_clips = Table(
    "playlist_clips",
    BaseIDModel.metadata,
    Column("playlist_id", Integer, ForeignKey("playlists.id", ondelete="CASCADE"), primary_key=True),
    Column("clip_id",     Integer, ForeignKey("clips.id",     ondelete="CASCADE"), primary_key=True),
    Column("position",    Integer, default=0),  # Порядок клипа в плейлисте
)


class Playlist(BaseIDModel, TimestampMixin):
    """
    Пользовательская коллекция клипов.
    Может быть публичной (виден другим по slug) или приватной.
    """
    __tablename__ = "playlists"

    user_id     = Column(Integer, nullable=False, index=True)
    title       = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_public   = Column(Boolean, default=True, nullable=False)
    slug        = Column(String(160), unique=True, nullable=False, index=True)  # для шаринга

    # Связь с клипами (через промежуточную таблицу)
    clips = relationship(
        "Clip",
        secondary=playlist_clips,
        lazy="select",
    )
