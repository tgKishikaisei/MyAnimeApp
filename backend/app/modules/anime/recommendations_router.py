"""
Модуль Алгоритмов Рекомендаций (AI / ML Engine).

Позволяет Администратору настраивать веса (множители) алгоритма и 
виртуально тестировать, какие аниме алгоритм порекомендует конкретному юзеру
с математической расшифровкой WHY (почему он это посоветовал).
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.core.database import get_db
from app.api.deps import get_current_active_superuser
from app.modules.anime.recommendation_weights import RecommendationWeight
from app.modules.user.models import User

router = APIRouter()

class WeightUpdate(BaseModel):
    tag_match_weight: float
    year_proximity_weight: float
    rating_weight: float
    popularity_weight: float
    min_rating_threshold: float

@router.get("/config")
async def get_recommendation_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """АДМИН ЭНДПОИНТ: Получить текущие множители (веса) математической формулы рекомендаций."""
    weights = await db.get(RecommendationWeight, 1)
    if not weights:
        # Ленивая инициализация
        weights = RecommendationWeight(id=1)
        db.add(weights)
        await db.commit()
        await db.refresh(weights)
    return weights

@router.post("/config")
async def update_recommendation_config(
    data: WeightUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """АДМИН ЭНДПОИНТ: Обновить коэффициенты алгоритма "На лету" без перезагрузки сервера."""
    weights = await db.get(RecommendationWeight, 1)
    if not weights:
        weights = RecommendationWeight(id=1)
        db.add(weights)
        
    # Защита от дурака: проверяем чтобы в сумме веса не были равны нулю 
    # (иначе алгоритм будет умножать всё на 0)
    total_weight = data.tag_match_weight + data.year_proximity_weight + data.rating_weight + data.popularity_weight
    if total_weight <= 0:
        raise HTTPException(status_code=400, detail="Суммарный вес должен быть больше 0")
        
    weights.tag_match_weight = data.tag_match_weight
    weights.year_proximity_weight = data.year_proximity_weight
    weights.rating_weight = data.rating_weight
    weights.popularity_weight = data.popularity_weight
    weights.min_rating_threshold = data.min_rating_threshold
    
    await db.commit()
    await db.refresh(weights)
    return weights


@router.get("/debug/{user_id}")
async def debug_user_recommendations(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    ПЕСОЧНИЦА АЛГОРИТМА (Debug Endpoint).
    Симулирует работу движка рекомендаций для конкретного пользователя.
    Выводит итоговый скоринг (Баллы) и детальную разбивку каждого фактора.
    
    Формула:
    Балл = (Процент_Совпадения_Жанров * ВесЖанров) + 
           (Оценка_На_Сайте_От_0_До_1 * ВесОценки) + 
           (Свежесть_Года_Выпуска * ВесГода) + 
           (Глобальная_Популярность * ВесПопулярности)
    """
    weights = await db.get(RecommendationWeight, 1)
    if not weights:
        weights = RecommendationWeight(id=1)

    # 1. СОСТАВЛЯЕМ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ НА ОСНОВЕ ЕГО ПРЕДПОЧТЕНИЙ (Tags Affinity)
    # Тяжелый SQL-запрос с CTE (Common Table Expressions).
    # Мы берем статистику просмотров видео, смотрим какие теги у этих видео
    # и вычисляем "Любимые жанры" пользователя на основе времени, которое он потратил на просмотр.
    user_profile_sql = text("""
        WITH user_watched AS (
            SELECT anime_id, SUM(duration_watched) as watch_time
            FROM video_playback_sessions
            WHERE user_id = :user_id
            GROUP BY anime_id
        ),
        user_tags AS (
            SELECT t.id as tag_id, t.name, SUM(uw.watch_time) as tag_score
            FROM user_watched uw
            JOIN anime_tags_association ata ON uw.anime_id = ata.anime_id
            JOIN tags t ON ata.tag_id = t.id
            GROUP BY t.id, t.name
            ORDER BY tag_score DESC
            LIMIT 5
        )
        SELECT tag_id, name, tag_score FROM user_tags;
    """)
    
    profile_result = await db.execute(user_profile_sql, {"user_id": user_id})
    top_tags = profile_result.fetchall()
    
    # Если юзер новый и ничего не смотрел — механизм персонализации ломается,
    # мы возвращаем пустой список (в реальности тут должна сработать выдача Популярного Контента)
    if not top_tags:
        return {
            "user_id": user_id,
            "status": "Нет истории просмотров. Алгоритм будет использовать Глобальную Популярность.",
            "top_user_tags": [],
            "recommendations": []
        }
        
    top_tag_ids = [t.tag_id for t in top_tags]
    max_tag_score = max([t.tag_score for t in top_tags])
    
    # Нормализуем силу любви к жанру от 0.0 (безразлично) до 1.0 (фанат жанра)
    # Для поиска жанров за O(1) переводим это в словарь (Map)
    user_tag_map = {t.name: float(t.tag_score) / max_tag_score for t in top_tags} 

    # 2. ДОСТАЕМ ВСЕ АНИМЕ-КАНДИДАТЫ ИХ И ЖАНРЫ
    # В реальном мире мы бы отсеяли те, что юзер уже смотрел. Но для песочницы скорим вообще всё.
    candidates_sql = text("""
        SELECT a.id, a.title, a.rating, a.year, 
               COALESCE((SELECT SUM(views) FROM clips WHERE anime_id = a.id), 0) as total_views,
               array_agg(t.name) as tags
        FROM animes a
        LEFT JOIN anime_tags_association ata ON a.id = ata.anime_id
        LEFT JOIN tags t ON ata.tag_id = t.id
        WHERE a.rating >= :min_rating
        GROUP BY a.id, a.title, a.rating, a.year
    """)
    
    candidates_result = await db.execute(candidates_sql, {"min_rating": weights.min_rating_threshold})
    candidates = candidates_result.fetchall()
    
    # Ищем самый просматриваемый сериал в базе, чтобы рассчитать "Глобальную Популярность" в %
    max_global_views = max([c.total_views for c in candidates]) if candidates else 1
    if max_global_views == 0:
        max_global_views = 1
        
    CURRENT_YEAR = 2026
    scored_candidates = []
    
    # 3. ОСНОВНОЙ ЦИКЛ СКОРИНГА (РАСЧЕТ МАТЕМАТИКИ)
    for c in candidates:
        anime_tags = c.tags if c.tags and c.tags[0] is not None else []
        
        # 3.1. Жанровое совпадение: Вычисляем пересечение любимых жанров юзера и жанров этого аниме
        tag_match_raw = sum([user_tag_map.get(t, 0.0) for t in anime_tags])
        tag_match_normalized = min(tag_match_raw / len(user_tag_map), 1.0) if user_tag_map else 0.0
        
        # 3.2. Рейтинг сериала (От 0.0 до 1.0)
        rating_normalized = c.rating / 10.0
        
        # 3.3. Свежесть (Чем старее, тем меньше баллов по экспоненте)
        year_diff = abs(CURRENT_YEAR - (c.year or 2000))
        year_normalized = 1.0 / (1.0 + (year_diff / 5.0)) 
        
        # 3.4. Популярность (От 0.0 до 1.0)
        pop_normalized = c.total_views / max_global_views
        
        # 4. ПРИМЕНЕНИЕ ВЕСОВ (УМНОЖЕНИЕ)
        score_tag = tag_match_normalized * weights.tag_match_weight
        score_rating = rating_normalized * weights.rating_weight
        score_year = year_normalized * weights.year_proximity_weight
        score_pop = pop_normalized * weights.popularity_weight
        
        total_score = score_tag + score_rating + score_year + score_pop
        
        # Сохраняем результат с расшифровкой (Explainable AI)
        scored_candidates.append({
            "anime_id": c.id,
            "title": c.title,
            "final_score": round(total_score, 4),
            "breakdown": {
                "tag_match": f"+{round(score_tag, 4)} (Сырое значение: {round(tag_match_normalized*100)}% совпадение с тегами {anime_tags})",
                "rating": f"+{round(score_rating, 4)} (Оценка на сайте: {c.rating}/10)",
                "year_proximity": f"+{round(score_year, 4)} (Год выхода: {c.year})",
                "popularity": f"+{round(score_pop, 4)} (Кол-во просмотров: {c.total_views})"
            }
        })
        
    # Сортируем от большего балла к меньшему
    scored_candidates.sort(key=lambda x: x["final_score"], reverse=True)
    
    return {
        "user_id": user_id,
        "status": "Успех",
        "top_user_tags": [{"name": k, "affinity": v} for k,v in user_tag_map.items()],
        "weights_used": {
            "tags": weights.tag_match_weight,
            "rating": weights.rating_weight,
            "year": weights.year_proximity_weight,
            "popularity": weights.popularity_weight
        },
        "recommendations": scored_candidates[:10] # Возвращаем Топ-10 лучших рекомендаций
    }
