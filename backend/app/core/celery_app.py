"""
Настройка и инициализация Celery (Асинхронные фоновые задачи).
Используется для тяжелых операций, таких как нарезка видео через FFmpeg или отправка писем,
чтобы не блокировать основной поток сервера (FastAPI).
Брокером сообщений и хранилищем результатов выступает Redis.

Локальный запуск воркера:
    celery -A app.core.celery_app worker --loglevel=info
"""
from celery import Celery
from app.core.config import settings

# 1. Создаем объект Celery
celery_app = Celery(
    "aniflow",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

# 2. Тонкая настройка очередей (Тюнинг производительности)
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    
    # Трекинг: Позволяет узнать, когда задача начала выполняться (перешла из PENDING в STARTED)
    task_track_started=True,
    
    # Хард-лимит: Если задача висит 5 минут, процесс воркера будет убит жестко (SIGKILL)
    task_time_limit=300,          
    # Софт-лимит: Если задача висит 4 минуты, она выбросит SoftTimeLimitExceeded, что позволяет ей завершиться корректно (graceful shutdown)
    task_soft_time_limit=240,     
    
    # ОЧЕНЬ ВАЖНАЯ НАСТРОЙКА: Запрещаем воркеру хватать сразу несколько тяжелых задач авансом.
    # Так как задачи - это нарезка видео (FFmpeg), они сжигают 100% CPU. Воркер берет строго 1 видео за раз.
    worker_prefetch_multiplier=1, 
    
    # Очистка базы: Результат задачи (Success/Failure) удаляется из Redis через 1 час, чтобы не забивать память
    result_expires=3600,          
)

# 3. Автопоиск задач: Celery сам найдет файлы tasks.py в указанных папках и зарегистрирует их
celery_app.autodiscover_tasks(["app.modules.studio"])
