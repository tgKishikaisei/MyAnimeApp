"""
Главный файл запуска приложения (Точка входа).
Здесь инициализируется FastAPI, подключаются базы данных, настраивается безопасность (CORS) и подключаются все маршруты (URL).
"""
import hmac

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pathlib import Path

from app.core.config import settings
from app.core.database import engine, Base, get_db

# Импорт независимого функционала безопасности и защиты
from app.core.middleware import RequestLogMiddleware
from app.core.rate_limit import limiter
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.exceptions import add_exception_handlers

# Главный роутер, который объединяет все маршруты системы
from app.api.v1.router import api_router

# Импортируем модели до запуска приложения, чтобы SQLAlchemy "увидел" их 
# и смог создать таблицы в пустой базе данных.

import sentry_sdk
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter

from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend
from redis import asyncio as aioredis

# --- МЕТРИКИ ---
# Счетчик для отслеживания просмотров каталога аниме в Prometheus/Grafana
c_anime_views = Counter(
    "aniflow_anime_catalog_views_total",
    "Сколько раз была загружена сетка каталога аниме"
)

# --- SENTRY (Отслеживание ошибок) ---
if settings.SENTRY_DSN:
    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        # 10% трасс достаточно для картины производительности и не раздувает квоту.
        traces_sample_rate=0.1,
        profiles_sample_rate=0.1,
        send_default_pii=False,
    )

# --- ДОКУМЕНТАЦИЯ (Swagger UI) ---
# Эта информация отображается при переходе на /docs
API_METADATA = {
    "title": "AniFlow API",
    "description": """
    # 🌊 AniFlow API
    
    ## Обзор
    AniFlow — это бэкенд платформы для стриминга аниме, построенный на **FastAPI**.
    
    ## ✨ Механика работы
    *   **Авторизация**: Защита маршрутов с помощью Access JWT токенов. Обновление через Refresh токены.
    *   **База данных**: Асинхронные запросы в PostgreSQL через SQLAlchemy.
    *   **Кэш**: Использование Redis для ускорения отдачи тяжелых данных.
    """,
    "version": "1.0.0",
    "openapi_tags": [
        {"name": "Auth", "description": "Вход, Регистрация, Обновление сессии"},
        {"name": "Users", "description": "Работа с профилями пользователей"},
        {"name": "Anime", "description": "Выдача аниме-каталога и видео"},
    ],
    "contact": {
        "name": "API Support",
        "email": "support@aniflow.example",
    },
}

# Инициализация самого приложения FastAPI
# Swagger/OpenAPI только вне production: схема API — готовая карта для атакующего.
_docs_enabled = settings.ENV != "production"
app = FastAPI(
    **API_METADATA,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)


def _metrics_guard(request: Request) -> None:
    """/metrics: по токену METRICS_TOKEN; в production без токена недоступно."""
    token = settings.METRICS_TOKEN
    if not token:
        if settings.ENV == "production":
            raise HTTPException(status_code=404, detail="Not Found")
        return
    provided = request.headers.get("authorization", "").removeprefix("Bearer ")
    if not hmac.compare_digest(provided, token):
        raise HTTPException(status_code=404, detail="Not Found")


# Включаем сбор метрик производительности сервера (Prometheus)
Instrumentator().instrument(app).expose(app, include_in_schema=False, dependencies=[Depends(_metrics_guard)])

# Подключаем папку `/static`, чтобы nginx или сам сервер могли раздавать
# загруженные аватарки, обложки сериалов и видео по прямым ссылкам.
STATIC_DIR = Path(__file__).parent.parent / "static"
STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.on_event("startup")
async def startup():
    """
    Эта функция запускается ОДИН РАЗ при старте сервера.
    Здесь мы готовим фундамент: создаем таблицы в БД и подключаемся к кэшу.
    """
    # 1. Схема БД: в staging/production — только `alembic upgrade head`
    #    (выполняется перед стартом контейнера). create_all оставлен для
    #    локальной разработки — быстрый старт с пустой БД.
    if settings.ENV == "development":
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
    # 2. Подключаемся к Redis для кэширования ответов сервера
    redis = aioredis.from_url(settings.REDIS_URL, encoding="utf8", decode_responses=True)
    FastAPICache.init(RedisBackend(redis), prefix="aniflow-cache")
    
    # 3. Пишем в лог, что сервер успешно стартовал
    from app.core.logger import get_logger
    startup_logger = get_logger("app.startup")
    startup_logger.info(
        "Сервер запущен",
        extra={"env": settings.ENV, "cors_origins": str(settings.BACKEND_CORS_ORIGINS)}
    )

@app.on_event("shutdown")
async def shutdown():
    """Дописываем накопленную телеметрию запросов перед остановкой."""
    from app.core.middleware import flush_request_logs
    await flush_request_logs()


# --- ГЛОБАЛЬНЫЕ ОБРАБОТЧИКИ ОШИБОК ---
# Перехватывает системные ошибки и отдает их фронтенду в красивом JSON формате
add_exception_handlers(app)

# --- НАСТРОЙКИ CORS ---
# Механизм, который разрешает браузеру отправлять запросы с фронтенда (localhost:5173)
# на бэкенд (localhost:8000). Защищает от выполнения сторонних скриптов.
cors_kwargs = {
    # AnyHttpUrl в pydantic v2 превращает "https://site.com" в "https://site.com/",
    # а заголовок Origin приходит без слэша — без rstrip CORS в проде не совпадал бы.
    "allow_origins": [str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS],
    "allow_credentials": True, # Разрешаем отправлять HTTP-Only куки (нужно для Refresh токена)
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": ["Authorization", "Content-Type", "X-Requested-With", "X-Request-ID"],
}

if settings.ENV == "development":
    # В режиме разработки разрешаем запросы с любого локального IP (например для тестов с телефона)
    cors_kwargs["allow_origin_regex"] = r"^http://(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}):\d+$"

app.add_middleware(CORSMiddleware, **cors_kwargs)

@app.middleware("http")
async def add_security_headers(request, call_next):
    """
    Промежуточное ПО (Middleware). Вызывается при КАЖДОМ запросе.
    Добавляет жесткие заголовки безопасности в ответ сервера, чтобы браузер защищал юзера:
    - X-Content-Type-Options: Запрещает браузеру "угадывать" тип файла (защита от маскировки вирусов).
    - X-Frame-Options: DENY - Запрещает встраивать наш сайт в iframe на чужих сайтах (защита от Clickjacking).
    - Strict-Transport-Security: Заставляет браузер всегда использовать HTTPS.
    """
    response = await call_next(request)
    path = request.scope.get("path", "")
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    # JSON API не должен исполнять ничего; /static раздаёт медиа, /docs — Swagger.
    if not path.startswith(("/static/", "/docs", "/redoc")):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    if path.startswith("/static/"):
        response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; media-src 'self'; sandbox"
    # Ответы с личными данными не должны оседать в кэше браузера/прокси.
    if path.startswith((f"{settings.API_V1_STR}/users", f"{settings.API_V1_STR}/auth", f"{settings.API_V1_STR}/admin")):
        response.headers["Cache-Control"] = "no-store"
    if settings.ENV == "production":
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # X-XSS-Protection удалён: устарел и в старых браузерах сам создавал уязвимости.
    return response

# --- ЗАЩИТА ОТ СПАМА (Rate Limiting) ---
# Ограничивает кол-во запросов (например не больше 100 запросов в минуту с одного IP)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# Без этого middleware `default_limits` не применялись ни к одному маршруту —
# ограничения работали только там, где стоял явный декоратор.
from slowapi.middleware import SlowAPIMiddleware
app.add_middleware(SlowAPIMiddleware)

# --- ЛОГИРОВАНИЕ ---
# Пишет каждый HTTP запрос в консоль в формате JSON (удобно собирать логи в Kibana/Datadog)
app.add_middleware(RequestLogMiddleware)

# --- ПОДКЛЮЧЕНИЕ РОУТЕРОВ ---
# Навешиваем все наши API ссылки из папки api/v1/router.py на префикс `/api/v1`
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
async def health_check():
    """Эндпоинт для Docker/Kubernetes. Узнать, жив ли процесс сервера."""
    return {"status": "healthy", "service": "aniflow-api"}

@app.get("/health/ready")
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Эндпоинт для оркестраторов. Проверяет не только сервер, но и жива ли База Данных."""
    try:
        await db.execute(text("SELECT 1"))
    except Exception:
        from app.core.logger import get_logger
        get_logger("app.health").exception("Readiness check failed")
        raise HTTPException(status_code=503, detail="Database not ready")
    return {"status": "ready", "database": "connected"}

@app.get("/")
def root():
    """Тестовая главная страница API"""
    return {"message": "AniFlow API (Clean Architecture + Observability) is running! 🚀"}