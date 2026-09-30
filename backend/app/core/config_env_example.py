"""
Пример (Шаблон) настройки окружений (Environments).
Этот файл показывает, как правильно переключаться между разработкой на Ноутбуке и Продакшн сервером.

Использование:
    export ENV=production
    python -m uvicorn app.main:app
"""

from typing import List
import os
from pydantic import validator

# Допустим, Settings импортируется из config.py
# from app.core.config import Settings

# ЗАГЛУШКА ДЛЯ ПРИМЕРА (чтобы код работал)
class Settings:
    pass

class DevelopmentSettings(Settings):
    """
    Настройки локальной разработки (У себя на ПК).
    Максимально расслабленные правила.
    """
    DEBUG: bool = True
    ALLOWED_HOSTS: List[str] = ["localhost", "127.0.0.1"]
    
    # Разрешаем запросы (CORS) с локальных портов React и Vite (3000, 5173)
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

class ProductionSettings(Settings):
    """
    Настройки Боевого сервера (Production).
    Максимальная безопасность (Уровень паранойи).
    """
    DEBUG: bool = False
    
    # В продакшене мы обязаны жестко прописать домен, например ['https://myanimeapp.com']
    @validator("BACKEND_CORS_ORIGINS", check_fields=False)
    def validate_prod_cors(cls, v):
        if not v:
            raise ValueError("Для Production необходимо явно указать CORS домены!")
        return v

class StagingSettings(ProductionSettings):
    """
    Предрелизный сервер (Staging). 
    Наследует защиту от Продакшена, но с включенными логами (Debug=True).
    """
    DEBUG: bool = True 

def get_settings() -> Settings:
    """Фабрика: Выбирает класс настроек в зависимости от переменной окружения ENV"""
    env = os.getenv("ENV", "development").lower()
    
    if env == "production":
        return ProductionSettings()
    elif env == "staging":
        return StagingSettings()
    else:
        return DevelopmentSettings()
