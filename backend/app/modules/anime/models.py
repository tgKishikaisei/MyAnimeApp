from sqlalchemy import Column, Integer, String, ForeignKey, Table, Text, Float, Boolean, Enum as SqEnum
from sqlalchemy.orm import relationship
from sqlalchemy import event
import re

# Фирменные импорты нашего Ядра
from app.core.database import Base
from app.core.models import BaseIDModel, TimestampMixin
from app.modules.anime.enums import AnimeSection, VideoQuality

# Промежуточная (Связующая) таблица для организации логики "Многие-ко-Многим" (Many-to-Many).
# Одно Аниме может иметь много Тегов, а один Тег (например "Комедия") может принадлежать сотням Аниме.
anime_tags = Table(
    "anime_tags_association",
    Base.metadata,
    Column("anime_id", Integer, ForeignKey("animes.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)
)

class Tag(BaseIDModel):
    """Таблица Жанров/Тегов. Используется для фильтрации и ML рекомендаций."""
    __tablename__ = "tags"
    
    # Ограничиваем длину названия тега для оптимизации индексов БД
    name = Column(String(50), unique=True, index=True, nullable=False)
    
    def __repr__(self):
        return f"<Tag {self.name}>"

class Anime(BaseIDModel, TimestampMixin):
    """
    Главная таблица Аниме (Сериал / Фильм).
    Содержит Мета-данные. Сами видео-файлы привязываются сюда через модель Clip.
    """
    __tablename__ = "animes"

    # Защита на уровне СУБД: Название обязательно, не длиннее 255 символов.
    title = Column(String(255), index=True, nullable=False)
    
    # Slug - текстовый Человекопонятный URL (Например: /anime/naruto-shippuden).
    # Должен быть строго уникальным!
    slug = Column(String(255), unique=True, index=True) 
    
    image = Column(String(500)) # Вертикальная обложка (Постер)
    banner = Column(String(500), nullable=True) # Горизонтальный задний фон (Hero Banner)
    description = Column(Text, nullable=True) # Тип "Текст" снимает жесткие ограничения длины (для длинных синопсисов)
    year = Column(Integer, index=True) # Год выхода
    
    # Средний рейтинг от зрителей
    rating = Column(Float, default=0.0)

    # Категория, в которой Аниме будет отображаться на Главной странице (Новинки, Популярное)
    section = Column(SqEnum(AnimeSection), index=True, nullable=False)
    
    # Техническое поле для ручной расстановки порядка карточек (Drag&Drop в Админ-панели)
    sort_order = Column(Integer, default=0, index=True)

    # Визуал брендирования страницы
    highlight_char = Column(String(20), nullable=True) # Буква-логотип на фоне
    accent_color = Column(String(50), nullable=True)   # Tailwind CSS цвет кнопок (например: text-red-500)

    # === РЕЛЯЦИОННЫЕ СВЯЗИ ===
    # cascade="all, delete-orphan": Очень важная настройка!
    # Если Админ удалит сериал Наруто, база данных АВТОМАТИЧЕСКИ удалит все 500 серий (клипов) и все просмотры,
    # чтобы в базе не осталось "мусорных" сирот.
    clips = relationship("Clip", back_populates="anime", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=anime_tags, backref="animes")
    heatmaps = relationship("app.modules.analytics.models.VideoHeatmap", back_populates="anime", cascade="all, delete-orphan")

class Clip(BaseIDModel, TimestampMixin):
    """
    Таблица Клипов. Это конкретное видео (Эпизод, Фильм, Трейлер, Нарезка).
    Владеет физическим файлом (.mp4) и привязывается к Аниме.
    """
    __tablename__ = "clips"

    title = Column(String(255), nullable=False)
    
    # Универсальная архитектура потоковой передачи:
    video_id = Column(String(100), nullable=True)    # Поддержка встраивания плееров (YouTube / RuTube)
    video_path = Column(String(500), nullable=True)  # Поддержка собственного хостинга (Путь к .mp4 на сервере /static/...)
    thumbnail_path = Column(String(500), nullable=True) # Превью картинка для эпизода
    
    quality = Column(SqEnum(VideoQuality), default=VideoQuality.Q_1080P) # 4K, 1080p, 720p
    fps = Column(Integer, default=24) # Важно для модуля Studio, чтобы не интерполировать то, что уже в 60FPS
    file_size = Column(String(50), nullable=True)
    duration = Column(Integer, nullable=True)  # Реальная длина видео в секундах
    
    # Структура сезонов и серий
    season = Column(Integer, default=1)
    episode = Column(Integer, default=1)
    
    views = Column(Integer, default=0) # Счетчик просмотров
    
    # Привязки: К какому тайтлу относится видео, и Кто из модераторов его залил (uploader_id)
    anime_id = Column(Integer, ForeignKey("animes.id", ondelete="CASCADE"), nullable=False)
    uploader_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    anime = relationship("Anime", back_populates="clips", lazy="select")
    uploader = relationship("app.modules.user.models.User", back_populates="uploaded_clips", foreign_keys=[uploader_id])

    def __repr__(self):
        return f"<Clip(id={self.id}, title='{self.title}', season={self.season}, episode={self.episode})>"

# --- АВТОМАТИЗАЦИЯ БАЗЫ ДАННЫХ (SLUG HOOKS) ---
def generate_slug(target, value, oldvalue, initiator):
    """
    Магический Триггер SQLAlchemy (Hook).
    Срабатывает прямо ПЕРЕД сохранением Аниме. Если пользователь (или парсер) забыл написать красивый URL,
    он берет Название Аниме, переводит его в нижний регистр и заменяет все пробелы на дефисы.
    Пример: "Bleach: Thousand-Year Blood War 2" -> "bleach-thousandyear-blood-war-2"
    """
    if value and (not target.slug or target.slug == "string"):
        slug = value.lower().strip()
        slug = re.sub(r'[^\w\s-]', '', slug)   # Вырезаем всё, кроме букв, цифр и дефисов
        slug = re.sub(r'[\s_-]+', '-', slug)   # Схлопываем лишние дефисы в один
        target.slug = slug

# Подвешиваем наш хук на событие перезаписи (set) колонки title в объекте Anime
event.listen(Anime.title, 'set', generate_slug, retval=False)


# --- ПЕРИФЕРИЯ (БЛОГ, ОТЗЫВЫ) ---
class News(BaseIDModel, TimestampMixin):
    """Модель новостных карточек на главной"""
    __tablename__ = "news"
    
    title = Column(String(255), nullable=True) 
    video_id = Column(String(100), nullable=False) # ID YouTube ролика
    image = Column(String(500), nullable=True) # Превью обложка

class BlogPost(BaseIDModel, TimestampMixin):
    """Информационные текстовые статьи (Блог)"""
    __tablename__ = "blog_posts"
    
    title = Column(String(255), nullable=False)
    image = Column(String(500), nullable=True)
    content = Column(Text, nullable=True)
    color = Column(String(50), nullable=True) # Tailwind цвет текста заголовка
    link = Column(String(500), nullable=True)

class Review(BaseIDModel, TimestampMixin):
    """
    Рецензии Пользователей.
    Отличаются от Комментариев тем, что у них есть Численная Оценка (rating).
    """
    __tablename__ = "reviews"

    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    anime_id = Column(Integer, ForeignKey("animes.id", ondelete="CASCADE"), nullable=False, index=True)

    rating = Column(Integer, nullable=False) # От 1 до 10
    content = Column(Text, nullable=True)
    
    # Предмодерация: по умолчанию отзывы публикуются сразу, но админ может скрыть плохие.
    is_approved = Column(Boolean, default=True, nullable=False) 

    user = relationship("User", backref="reviews")
    anime = relationship("Anime", backref="reviews")