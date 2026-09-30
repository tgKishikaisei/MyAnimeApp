"""
Модуль Глобальных Уведомлений (Announcements).
Позволяет администрации создавать важные объявления (Баннеры на главной странице),
например: "Сервер уйдет на тех работы в 20:00" или "Скидки на премиум!".
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.api.deps import get_current_active_superuser
from app.modules.user.models import User
from app.modules.announcements.models import Announcement, AnnouncementType
from app.modules.system.admin_router import create_audit_log

router = APIRouter()

# --- PYDANTIC СХЕМЫ ---

class AnnouncementBase(BaseModel):
    title: str            # Заголовок (Например: Внимание!)
    message: str          # Текст объявления
    type: str = "info"    # Тип цвета баннера: info (голубой), warning (желтый), error (красный)
    is_active: bool = True# Показывать ли баннер на сайте прямо сейчас?

class AnnouncementCreate(AnnouncementBase):
    pass

class AnnouncementUpdate(AnnouncementBase):
    title: Optional[str] = None
    message: Optional[str] = None
    type: Optional[str] = None
    is_active: Optional[bool] = None

class AnnouncementResponse(AnnouncementBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime]
    author_id: Optional[int]

    class Config:
        from_attributes = True


# --- МАРШРУТЫ (РОУТЕРЫ) ---

@router.get("/active", response_model=List[AnnouncementResponse])
async def get_active_announcements(
    db: AsyncSession = Depends(get_db)
):
    """
    Получение списка активных объявлений.
    ПУБЛИЧНЫЙ ЭНДПОИНТ (виден всем без авторизации).
    React запрашивает его каждые пару минут, чтобы рисовать баннеры в верху сайта.
    """
    query = select(Announcement).where(Announcement.is_active == True).order_by(desc(Announcement.created_at))
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/all", response_model=List[AnnouncementResponse])
async def get_all_announcements(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser) # Защита админки
):
    """
    АДМИН ЭНДПОИНТ. Возвращает вообще все объявления, включая выключенные (история).
    Срабатывает, когда админ заходит в панель управления.
    """
    query = select(Announcement).order_by(desc(Announcement.created_at)).offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=AnnouncementResponse)
async def create_announcement(
    announcement_in: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser) # Защищено
):
    """
    АДМИН ЭНДПОИНТ. Публикует новое глобальное объявление.
    """
    # Валидация: Проверяем, существует ли такой тип (цвет) баннера в нашем Enum
    try:
        ann_type = AnnouncementType(announcement_in.type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный тип объявления (ожидалось: info/warning/success/error)")

    # Создаем запись в базе
    new_announcement = Announcement(
        title=announcement_in.title,
        message=announcement_in.message,
        type=ann_type.value,
        is_active=announcement_in.is_active,
        author_id=current_user.id
    )
    db.add(new_announcement)
    await db.commit()
    await db.refresh(new_announcement)
    
    # Секьюрити лог: Записываем действие админа в журнал аудита, чтобы отслеживать, 
    # кто из модераторов опубликовал этот баннер
    await create_audit_log(db, current_user.id, "Created Announcement", f"Баннер: {new_announcement.title}")
    
    return new_announcement


@router.patch("/{ann_id}", response_model=AnnouncementResponse)
async def update_announcement(
    ann_id: int,
    announcement_in: AnnouncementUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser) # Защищено
):
    """
    АДМИН ЭНДПОИНТ. Изменение объявления (Например, чтобы скрыть его, поставив is_active=False).
    """
    ann = await db.get(Announcement, ann_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
        
    update_data = announcement_in.dict(exclude_unset=True)
    
    # Дополнительная валидация
    if 'type' in update_data:
        try:
            AnnouncementType(update_data['type'])
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный тип объявления")
            
    # Применяем изменения
    for field, value in update_data.items():
        setattr(ann, field, value)
        
    await db.commit()
    await db.refresh(ann)
    
    await create_audit_log(db, current_user.id, "Updated Announcement", f"Баннер #{ann.id}")
    return ann


@router.delete("/{ann_id}")
async def delete_announcement(
    ann_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser) # Защищено
):
    """
    АДМИН ЭНДПОИНТ. Полное уничтожение (удаление) объявления из базы.
    """
    ann = await db.get(Announcement, ann_id)
    if not ann:
        raise HTTPException(status_code=404, detail="Объявление не найдено")
        
    await db.delete(ann)
    await db.commit()
    
    await create_audit_log(db, current_user.id, "Deleted Announcement", f"Баннер #{ann_id}")
    return {"message": "Объявление успешно удалено"}
