"""
Модуль Аналитики.
Этот роутер не раздает контент, а работает "в тени", получая телеметрию с фронтенда.
Собирает данные в реальном времени: блокировки рекламы, начало просмотра сериала, 
тепловые карты прогресса (какие моменты видео смотрят, а какие проматывают).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import date

from app.core.database import get_db
from app.api.deps import get_current_user_optional
from pydantic import BaseModel
import random

from app.modules.analytics.models import DailyAnalytics, VideoHeatmap, VideoPlaybackSession
from app.modules.live.manager import manager

router = APIRouter()

# --- СХЕМЫ ЗАПРОСОВ (PYDANTIC) ---

class StreamEvent(BaseModel):
    anime_title: str
    anime_id: int

class HeatmapPayload(BaseModel):
    # Массив секунд, которые реально были просмотрены пользователем
    watched_seconds: list[int]


# --- ЭНДПОИНТЫ (МАРШРУТЫ) ---

@router.post("/adblock")
async def report_adblock(db: AsyncSession = Depends(get_db)):
    """
    Сбор статистики по AdBlock. Вызывается React фронтендом в фоне, 
    если скрипт обнаружил, что баннеры были заблокированы браузером юзера.
    Увеличивает ежедневный счетчик `adblock_detected_count`.
    """
    today = date.today()
    # 1. Пытаемся найти сегодняшнюю запись в таблице суточной аналитики (Срезы по дням)
    stmt = select(DailyAnalytics).where(
        DailyAnalytics.date == today,
        DailyAnalytics.target_type == "site_visit" # Запись касающаяся всего сайта
    )
    result = await db.execute(stmt)
    analytics = result.scalar_one_or_none()
    
    if not analytics:
        # Если сегодня сервер еще не получал запросов — создаем новую суточную запись
        analytics = DailyAnalytics(
            date=today,
            target_type="site_visit",
            views=0,
            unique_visitors=0,
            adblock_detected_count=1
        )
        db.add(analytics)
    else:
        # Если запись уже есть — инкрементируем счетчик AdBlock на +1 в базе данных
        analytics.adblock_detected_count += 1
        
    await db.commit()
    return {"status": "ok", "adblock_logged": True}


@router.post("/stream")
async def report_stream_start(event: StreamEvent):
    """
    Система реального времени (Live Viewers).
    Срабатывает в ту долю секунды, когда пользователь нажал кнопку "PLAY" на странице видео.
    
    Цель: Разослать это событие всем Администраторам, сидящим в Админке через WebSockets,
    чтобы у них на интерактивном 3D-Глобусе вспыхнула яркая точка трафика.
    """
    
    # СИМУЛЯЦИЯ ГЛОБАЛЬНОГО ТРАФИКА:
    # В реальном Production мы бы определяли координаты по IP юзера (request.client.host) через базу GeoIP.
    # Так как проект работает на локалхосте, IP всегда 127.0.0.1, поэтому для визуальной красоты 3D Глобуса
    # мы генерируем рандомную точку на карте в одном из крупнейших регионов материков.
    regions = [
        {"lat": random.uniform(30.0, 50.0), "lng": random.uniform(-120.0, -70.0)}, # США
        {"lat": random.uniform(-30.0, 10.0), "lng": random.uniform(-70.0, -40.0)}, # Южная Америка
        {"lat": random.uniform(35.0, 60.0), "lng": random.uniform(-10.0, 30.0)},   # Европа
        {"lat": random.uniform(10.0, 40.0), "lng": random.uniform(70.0, 120.0)},   # Азия
        {"lat": random.uniform(-30.0, -10.0), "lng": random.uniform(110.0, 150.0)},# Австралия
    ]
    location = random.choice(regions)

    payload = {
        "type": "watch",
        "anime_title": event.anime_title,
        "anime_id": event.anime_id,
        "lat": location["lat"],
        "lng": location["lng"],
        "timestamp": date.today().isoformat()
    }
    
    # Делаем массовую рассылку (Broadcast) сигнала на все открытые WebSocket соединения админов
    await manager.broadcast(payload)
    return {"status": "broadcasted"}


@router.patch("/heatmap/{anime_id}")
async def update_video_heatmap(anime_id: int, payload: HeatmapPayload, db: AsyncSession = Depends(get_db)):
    """
    Построение тепловой карты видео (Что пересматривают, а что проматывают опенинги).
    React плеер каждые 10 секунд (или перед паузой) присылает массив "грязных" секунд, 
    которые глаз юзера РЕАЛЬНО смотрел на экране без перемотки.
    
    Данные сохраняются в супер-быструю колонку JSONB в PostgreSQL (формат: { "120": 5, "121": 6 }).
    Ключ - это секунда видео. Значение - сколько раз люди её смотрели.
    """
    if not payload.watched_seconds:
        return {"status": "ignored"}
        
    stmt = select(VideoHeatmap).where(VideoHeatmap.anime_id == anime_id)
    result = await db.execute(stmt)
    heatmap = result.scalar_one_or_none()
    
    if not heatmap:
        # Если плеер запустили впервые — создаем базовый словарь тепловой карты
        # {"секунда_1": 1 просмотр, "секунда_2": 1 просмотр}
        initial_data = {str(sec): 1 for sec in payload.watched_seconds}
        heatmap = VideoHeatmap(anime_id=anime_id, heatmap_data=initial_data)
        db.add(heatmap)
    else:
        # Обновляем существующие данные PostgreSQL JSONB
        # Внимание: SQLAlchemy не отслеживает мутации внутри словаря JSONB. 
        # Поэтому мы обязаны скопировать словарь, изменить его и вставить обратно целиком.
        current_data = heatmap.heatmap_data.copy() if heatmap.heatmap_data else {}
        
        # Проходимся по каждой просмотренной секунде из массива
        for sec in payload.watched_seconds:
            sec_str = str(sec)
            # Увеличиваем счетчик просмотров 1 конкретной секунды (например, на 12-ой минуте битва, там будет пик)
            current_data[sec_str] = current_data.get(sec_str, 0) + 1
            
        # Присваиваем обратно в модель базы данных
        heatmap.heatmap_data = current_data
        
    await db.commit()
    return {"status": "ok", "points_logged": len(payload.watched_seconds)}


@router.get("/resume/{clip_id}")
async def get_resume_position(
    clip_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user_optional),
):
    """
    Менеджер сохранения прогресса (Умная пауза).
    Когда пользователь заходит на страницу видео, фронтенд спрашивает:
    "А он смотрел это раньше? Откуда начать воспроизведение?".
    
    Возвращает позицию видео (в секундах), где пользователь последний раз остановился,
    чтобы нарисовать кнопку "Продолжить с 15:42".
    """
    # Если юзер не авторизован (гость), мы не знаем кто он, стартуем видео с нуля (0 секунда)
    if not current_user:
        return {"position": 0, "has_progress": False}

    stmt = (
        select(VideoPlaybackSession)
        .where(VideoPlaybackSession.clip_id == clip_id)
        .where(VideoPlaybackSession.user_id == current_user.id)
        .where(VideoPlaybackSession.completed == False) # видео не досмотрено до 100% конца
        .where(VideoPlaybackSession.duration_watched > 5)  # игнорируем "случайные клики" (видео смотрели меньше 5 сек)
        .order_by(desc(VideoPlaybackSession.created_at)) # берем самую সর্বশেষнюю попытку просмотра
        .limit(1)
    )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if not session or session.duration_watched <= 5:
        # Если никогда не смотрели, или смотрели 3 секунды и выключили
        return {"position": 0, "has_progress": False}

    return {
        "position": session.duration_watched,
        "has_progress": True,
        "total_duration": session.total_duration,
    }
