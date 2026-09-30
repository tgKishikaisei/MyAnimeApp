class AnimeError(Exception):
    """
    Базовый класс ошибки для модуля Аниме.
    Наследуется от стандартного `Exception`.
    Позволяет глобальному обработчику ошибок в `core/exceptions.py` 
    ловить все проблемы, связанные с базой аниме, одной строчкой.
    """
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)

class AnimeNotFound(AnimeError):
    """Выбрасывается, когда запрашиваемый тайтл не найден в базе (Вернёт 404 Not Found)"""
    pass

class ClipNotFound(AnimeError):
    """Выбрасывается, когда конкретное видео или серия удалены/скрыты"""
    pass

class AnimeAlreadyExists(AnimeError):
    """Защита от дублей: выбрасывается, если админ пытается создать сериал с таким же названием/ссылкой"""
    pass
