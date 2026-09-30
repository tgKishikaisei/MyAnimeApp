"""
Модуль новостей и блогов.
Маршрутизатор API (API Router) для работы со статьями.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.core.database import get_db
from app.modules.anime import schemas, models

router = APIRouter()

@router.get("/", response_model=List[schemas.News])
async def get_news(skip: int = 0, limit: int = 10, db: AsyncSession = Depends(get_db)):
    """
    Получение списка новостей (Публичный эндпоинт).
    Отображает ленту новостей на странице `/news` от самых свежих к старым.
    """
    from sqlalchemy import select
    # Достаем новости из БД, сдвигаем на `skip` для пагинации, 
    # ограничиваем `limit` штук на страницу и сортируем по дате (самые новые сверху)
    query = (
        select(models.News)
        .offset(skip)
        .limit(limit)
        .order_by(models.News.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()


from app.api.deps import get_current_active_superuser

@router.post("/", response_model=schemas.News)
async def create_news(
    news_in: schemas.NewsCreate, 
    db: AsyncSession = Depends(get_db),
    # Секретный замок: только супер-юзер (АДМИН) может постить новости
    current_user = Depends(get_current_active_superuser)
):
    """
    Создание новой статьи в блоге или новости.
    Защищенный маршрут: доступен только администраторам.
    """
    # Распаковываем входные данные Pydantic-схемы прямо в модель базы данных SQLAlchemy
    db_obj = models.News(**news_in.model_dump())
    db.add(db_obj)
    await db.commit()        # Сохраняем статью в базу
    await db.refresh(db_obj) # Обновляем объект, чтобы подтянуть его сгенерированный ID
    return db_obj


@router.delete("/{news_id}", status_code=204)
async def delete_news(
    news_id: int,
    db: AsyncSession = Depends(get_db),
    # Секретный замок: только АДМИН может удалять новости
    current_user = Depends(get_current_active_superuser)
):
    """
    Удаление новости по её идентификатору.
    Возвращает 204 No Content при успешном удалении.
    """
    from sqlalchemy import select
    # Находим новость
    result = await db.execute(select(models.News).where(models.News.id == news_id))
    news = result.scalar_one_or_none()
    
    # Если новости с таким ID нет, возвращаем 404 ошибку
    if not news:
         from fastapi import HTTPException
         raise HTTPException(status_code=404, detail="Новость не найдена")
    
    # Удаляем запись из базы данных
    await db.delete(news)
    await db.commit()
    return None
