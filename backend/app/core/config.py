"""
Модуль конфигурации приложения.
Загружает переменные окружения (.env) и валидирует их с помощью Pydantic.
Обеспечивает разные уровни безопасности для разработки (Development) и продакшена (Production).
"""
from typing import Annotated, List, Optional
import json
import os
from pydantic_settings import BaseSettings, NoDecode
from pydantic import AnyHttpUrl, validator


_PLACEHOLDER_MARKERS = ("change", "replace", "placeholder", "example", "secret-key", "your-", "xxx")


def _validate_secret(v: str) -> str:
    lowered = v.lower()
    if len(v) < 32:
        raise ValueError("SECRET_KEY должен содержать минимум 32 символа")
    if any(marker in lowered for marker in _PLACEHOLDER_MARKERS) or len(set(v)) < 16:
        raise ValueError("SECRET_KEY похож на заглушку — сгенерируйте случайный ключ")
    return v


def _env_from_dotenv() -> Optional[str]:
    """ENV из файла .env (get_settings выбирает класс ДО того, как pydantic прочитает .env)."""
    try:
        with open(".env", encoding="utf-8") as fh:
            for line in fh:
                key, _, value = line.strip().partition("=")
                if key.strip() == "ENV" and value:
                    return value.strip().strip("\"'")
    except OSError:
        return None
    return None


class Settings(BaseSettings):
    """
    Базовый класс настроек. Все поля будут автоматически заполняться из файла `.env`
    или из системных переменных окружения сервера.
    """
    # 1. Текущая среда
    ENV: str = "development"  # Варианты: development, staging, production
    
    # 2. Основные настройки API
    PROJECT_NAME: str
    API_V1_STR: str = "/api/v1"  # Префикс для всех маршрутов API
    
    SECRET_KEY: str  # Супер-секретный ключ для шифрования JWT токенов
    
    # 2.1 Мониторинг (Sentry)
    SENTRY_DSN: Optional[str] = None
    
    # URL для CORS проверок (устаревшие поля, оставлены для совместимости)
    FRONTEND: Optional[str] = None
    BACKEND: Optional[str] = None

    # 2.2 Кэширование
    REDIS_URL: str = "redis://localhost:6379/0"

    # 2.3 Rate limiting и метрики
    RATE_LIMIT_STORAGE_URI: str = "memory://"
    RATE_LIMIT_ENABLED: bool = True
    METRICS_TOKEN: Optional[str] = None
    API_REQUEST_LOG_ENABLED: bool = True

    # 2.4 Пул соединений БД (явно, а не «по умолчанию на всякий случай»)
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 10
    DB_NULL_POOL: bool = False  # для тестов: каждый тест — свой event loop

    # 3. База данных
    DATABASE_URL: str

    @validator("DATABASE_URL", pre=True)
    def assemble_db_connection(cls, v: Optional[str]) -> str:
        """
        Адаптер для БД Возвращает SQLAlchemy асинхронную ссылку.
        Многие хостинги выдают URL в виде postgresql://, но для асинхронности 
        нам нужен драйвер asyncpg, поэтому мы автоматически заменяем префикс.
        """
        if isinstance(v, str):
            if v.startswith("postgresql://"):
                return v.replace("postgresql://", "postgresql+asyncpg://")
        return v

    # 4. Безопасность (CORS - Cross-Origin Resource Sharing)
    # Список URL адресов, которым разрешено делать запросы к нашему API с фронтенда.
    # NoDecode: pydantic-settings иначе требует JSON и падает на https://a,https://b.
    BACKEND_CORS_ORIGINS: Annotated[List[AnyHttpUrl], NoDecode] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str]:
        """
        Парсер для списка разрешенных CORS адресов.
        Умеет читать данные из .env файла как в формате массивов JSON `["http://..."]`, 
        так и просто строкой через запятую `http://...,http://...`.
        """
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            # Пробуем распарсить JSON
            if v.startswith("["):
                try:
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return parsed
                except json.JSONDecodeError:
                    pass
            # Резервный вариант: парсим просто через запятую
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        raise ValueError(f"Недопустимый формат CORS origins: {v}")
    
    # 5. Дебаг режим
    DEBUG: bool = False

    class Config:
        case_sensitive = True
        env_file = ".env"


class DevelopmentSettings(Settings):
    """
    Настройки для локальной РАЗРАБОТКИ.
    Отличается послаблениями: например, жестко прописан CORS для локальных React/Vue серверов.
    """
    DEBUG: bool = True
    ENV: str = "development"
    
    # Жестко прописанные CORS порты для удобства разработчика (Vite 5173, CRA 3000)
    BACKEND_CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000"
    ]


class StagingSettings(Settings):
    """Настройки для тестирования (Staging). Похоже на Production, но с включенным DEBUG."""
    DEBUG: bool = True
    ENV: str = "staging"

    @validator("SECRET_KEY")
    def validate_staging_secret(cls, v):
        return _validate_secret(v)


class ProductionSettings(Settings):
    """
    Настройки для БОЕВОГО СЕРВЕРА (Production).
    Требует строгих мер безопасности, отключает дебаггер.
    """
    DEBUG: bool = False
    ENV: str = "production"
    
    @validator("BACKEND_CORS_ORIGINS")
    def validate_prod_cors(cls, v):
        """В продакшене CORS должен быть явно указан в файле окружения, иначе сервер не запустится."""
        if not v:
            raise ValueError("В Production среде CORS origins должны быть явно указаны в конфигурации!")
        return v
    
    @validator("SECRET_KEY")
    def validate_prod_secret(cls, v):
        """
        В продакшене ключ должен быть длинным и случайным: длины мало, поэтому
        заглушки вида «change-me…» тоже отклоняются. Сгенерировать ключ:
            python -c "import secrets; print(secrets.token_urlsafe(48))"
        """
        return _validate_secret(v)


def get_settings() -> Settings:
    """
    Фабричная функция. Определяет, какой класс настроек загрузить
    в зависимости от системной переменной `ENV`.
    
    Использование в терминале:
        export ENV=production
        uvicorn app.main:app
    """
    env = (os.getenv("ENV") or _env_from_dotenv() or "development").lower()
    
    if env == "production":
        return ProductionSettings()
    elif env == "staging":
        return StagingSettings()
    else:
        return DevelopmentSettings()


# Глобальный объект настроек, который импортируется во всем остальном приложении `from app.core.config import settings`
settings = get_settings()
