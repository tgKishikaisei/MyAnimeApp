"""
Роутер системных настроек сайта.
Отвечает за выдачу глобальных параметров приложения на фронтенд.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.modules.system.models import SystemSettings

router = APIRouter()

@router.get("")
async def get_public_settings(db: AsyncSession = Depends(get_db)):
    """
    Возвращает системные настройки сайта.
    Это ПУБЛИЧНЫЙ эндпоинт, который React запрашивает при самом первом рендере страницы,
    чтобы понять:
    1. Какое имя у сайта (site_name).
    2. Включен ли режим Тех. Работ (maintenance_mode). Если да - фронт показывает заглушку.
    3. Разрешены ли новые регистрации.
    4. Какую картинку поставить на главный фон (Hero Banner).
    """
    # Запрашиваем 1 единственную строку настроек из базы
    settings_obj = await db.scalar(select(SystemSettings).limit(1))
    
    if not settings_obj:
        # Паттерн "Ленивая инициализация": 
        # Если база данных чистая и админ еще не сохранял настройки,
        # мы автоматически создаем дефолтную (пустую) запись.
        settings_obj = SystemSettings()
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)
        
    return {
        "site_name": settings_obj.site_name,
        "maintenance_mode": settings_obj.maintenance_mode,
        "allow_registrations": settings_obj.allow_registrations,
        "hero_banner_url": settings_obj.hero_banner_url,
        "seo_description": settings_obj.seo_description
    }
