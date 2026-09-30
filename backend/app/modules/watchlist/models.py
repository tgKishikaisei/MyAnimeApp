import enum
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint, Enum as SqEnum
from sqlalchemy.orm import relationship
from app.core.models import BaseIDModel, TimestampMixin


class WatchStatus(str, enum.Enum):
    """
    Перечисление всех возможных статусов просмотра (Enum).
    Выступают в роли тегов-состояний в Личном Кабинете.
    """
    WATCHING = "watching"   # Смотрю
    COMPLETED = "completed" # Просмотрено
    PLANNED = "planned"     # В планах
    ON_HOLD = "on_hold"     # Отложено
    DROPPED = "dropped"     # Брошено


class WatchlistEntry(BaseIDModel, TimestampMixin):
    """
    Модель базы данных (Таблица) для хранения закладок "Списки Просмотра".
    Это связующее звено между Юзером и Аниме с дополнительными метаданными.
    """
    __tablename__ = "watchlist_entries"

    # ID пользователя (OnDelete CASCADE означает, что если удалить юзера, все его закладки исчезнут)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # ID Аниме-тайтла
    anime_id = Column(Integer, ForeignKey("animes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Статус просмотра (по умолчанию ставим "В планах")
    status = Column(SqEnum(WatchStatus), default=WatchStatus.PLANNED, nullable=False)
    
    # Прогресс (Номер последней просмотренной серии)
    progress_episode = Column(Integer, default=0, nullable=False)
    
    # Личная заметка юзера к просмотру (например "Остановился на моменте с драконом")
    note = Column(String(500), nullable=True)

    # Виртуальная связь: позволяет подгрузить саму карточку Аниме (Картинку, Название)
    # lazy="noload" означает, что по умолчанию карточка не загрузится, пока не попросим в JOIN запросе
    anime = relationship("Anime", lazy="noload", foreign_keys=[anime_id])

    __table_args__ = (
        # Важнейший защитный механизм СУБД: составной Уникальный Ключ.
        # Гарантирует, что пользователь не сможет добавить одно и то же аниме в список дважды
        # и сломать счетчики статистики.
        UniqueConstraint("user_id", "anime_id", name="uq_watchlist_user_anime"),
    )

    def __repr__(self):
        return f"<WatchlistEntry user={self.user_id} anime={self.anime_id} status={self.status}>"
