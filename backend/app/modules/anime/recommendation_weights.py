from sqlalchemy import Column, Float, DateTime
from sqlalchemy.sql import func
from app.core.models import BaseIDModel

class RecommendationWeight(BaseIDModel):
    """
    Матрица Весов для AI Системы Рекомендаций (Tuning Hub).
    
    Это специальная таблица, в которой существует только 1 строка (id=1). 
    В ней хранятся чувствительные множители для математической формулы алгоритма рекомендаций.
    Администратор может через сайт "подкрутить" веса, например, чтобы система начала 
    больше рекомендовать Аниме по тегам (Жанрам), или наоборот - по новизне (году выпуска).
    """
    __tablename__ = "recommendation_weights"

    # Процентные веса, участвующие в уравнении (от 0.0 до 1.0)
    # Насколько важны жанровые совпадения (Кровь, Вампиры, Школа)? Дефолт = 60%.
    tag_match_weight = Column(Float, nullable=False, default=0.6)
    
    # Насколько важна близость по году выпуска? (Чтобы любителям старых аниме 1999 года советовать старые). Дефолт = 10%.
    year_proximity_weight = Column(Float, nullable=False, default=0.1)
    
    # Репутация: учитывать ли среднюю оценку на сайте? Дефолт = 20%.
    rating_weight = Column(Float, nullable=False, default=0.2)
    
    # Популярность: советовать то, что смотрит большинство? Дефолт = 10%.
    popularity_weight = Column(Float, nullable=False, default=0.1)
    
    # Дополнительные настройки отсечения
    # Не советовать аниме, если у него рейтинг ниже этого порога (Защита от треша).
    min_rating_threshold = Column(Float, nullable=False, default=5.0)
    
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)
