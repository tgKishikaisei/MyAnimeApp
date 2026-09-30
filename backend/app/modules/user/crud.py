from typing import Any, Dict, Optional, Union, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.modules.user.models import User, UserRole
from app.modules.user.schemas import UserRegisterIn, UserSelfUpdateIn
from app.core.logger import get_logger

# Поля, которые можно менять через общий update(). Права (role, is_active,
# permissions, banned_until) сюда не входят — их меняет только админ-роутер.
_UPDATABLE_FIELDS = frozenset({"username", "full_name", "bio", "email", "avatar_url", "hashed_password"})

logger = get_logger(__name__)

class UserCRUD:
    """
    Объект Доступа к Данным (Data Access Object / DAO) для модели Пользователей.
    
    Архитектурное Правило:
    Этот слой ТОЛЬКО выполняет сырые SQL-запросы к PostgreSQL через SQLAlchemy.
    Здесь НЕ должно быть проверки паролей, запретов банов, или логики бизнес-процессов.
    Также CRUD слой НЕ делает `db.commit()` - это обязанность Сервиса (чтобы в случае ошибки
    можно было откатить транзакцию целиком).
    """

    async def get_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Точечный поиск по ID."""
        result = await db.execute(select(User).filter(User.id == user_id))
        return result.scalars().first()

    async def get_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Поиск при регистрации (Не занята ли почта)."""
        result = await db.execute(select(User).filter(User.email == email))
        return result.scalars().first()

    async def get_by_username(self, db: AsyncSession, username: str) -> Optional[User]:
        """Поиск при логине (Проверка никнейма)."""
        result = await db.execute(select(User).filter(User.username == username))
        return result.scalars().first()

    async def get_multi(self, db: AsyncSession, *, skip: int = 0, limit: int = 100) -> List[User]:
        """
        Массовая выборка для Админ-Панели.
        Реализована пагинация через OFFSET (skip) и LIMIT.
        """
        result = await db.execute(select(User).offset(skip).limit(limit))
        return result.scalars().all()

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: UserRegisterIn,
        hashed_password: str,
        role: UserRole = UserRole.VIEWER,
    ) -> User:
        """
        [УРОВЕНЬ ЗАПИСИ]: Создать новую строку в таблице Users.
        Роль передаёт только серверный код (скрипт создания админа), не клиент.
        """
        db_obj = User(
            email=obj_in.email,
            username=obj_in.username,
            hashed_password=hashed_password,
            full_name=obj_in.full_name,
            role=role,
            is_active=True,
            permissions={},
        )
        # Добавляем в оперативную память (Сессию)
        db.add(db_obj)
        # Отправляем данные в СУБД, чтобы PostgreSQL мгновенно сгенерировал авто-ID (Primary Key).
        # Но сама транзакция еще не закреплена (commit() будет в service файле).
        await db.flush() 
        await db.refresh(db_obj)
        
        logger.info(f"Сгенерирован новый профиль пользователя: {db_obj.username} (ID: {db_obj.id})")
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: User,
        obj_in: Union[UserSelfUpdateIn, Dict[str, Any]]
    ) -> User:
        """
        [УРОВЕНЬ ЗАПИСИ]: Динамическое обновление профиля.
        Меняет только поля из белого списка `_UPDATABLE_FIELDS`.
        """
        # Поддержка как Pydantic схем, так и сырых JSON-словарей
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            # exclude_unset=True исключает поля, которые фронтенд не передавал (оставил пустыми)
            update_data = obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            if field in _UPDATABLE_FIELDS:
                setattr(db_obj, field, value)
            else:
                logger.warning(f"Попытка обновить защищённое поле '{field}' профиля отклонена.")

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        
        logger.info(f"Профиль обновлен: {db_obj.username} (ID: {db_obj.id})")
        return db_obj

    async def delete(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """
        [УРОВЕНЬ ЗАПИСИ]: Жесткое уничтожение (DROP) юзера по ID.
        (Обычно лучше использовать Soft-Delete - `is_active=False`, 
        но этот метод нужен для очистки тестового мусора).
        """
        result = await db.execute(select(User).filter(User.id == user_id))
        obj = result.scalars().first()
        if obj:
            await db.delete(obj)
            await db.flush()
            logger.info(f"Аккаунт полностью стерт из базы (ID {user_id})")
            return obj
        return None

# Глобальный Singleton Паттерн
user_crud = UserCRUD()
