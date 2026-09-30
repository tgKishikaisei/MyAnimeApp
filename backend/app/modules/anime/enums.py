import enum

class AnimeSection(str, enum.Enum):
    """
    Жестко зашитые (Hardcoded) секции, в которых может отображаться Аниме
    на Главной Странице приложения (Секция 'Популярное', Секция 'Новинки').
    """
    POPULAR = "popular"           # Самое Популярное
    RECENT = "recent"             # Вышло Недавно
    SERIES = "series"             # Топ Сериалы
    MOVIES = "movies"             # Полнометражные Фильмы
    EARLY_ACCESS = "early_access" # Ранний Доступ (Премьеры до полного дубляжа)
    COMING_SOON = "coming_soon"   # Скоро Выйдут (Витрина без эпизодов)
    ACTIVE_PACKS = "active_packs" # Готовые Подборки / Паки

class VideoQuality(str, enum.Enum):
    """
    Разрешение видеофайла. 
    Используется в модуле FFmpeg для рендеринга и для значков в плеере.
    """
    Q_1080P = "1080p"
    Q_4K = "4K"
    Q_720P = "720p"