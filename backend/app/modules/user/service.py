"""
Сервисный слой (Service Layer) для пользователей.
Здесь находится вся бизнес-логика: проверка паролей, хэширование,
создание пользователей и работа с транзакциями к базе данных.
Роутеры (API эндпоинты) вызывают эти функции, вместо того чтобы ходить в базу напрямую.
"""
import asyncio
from typing import Optional, List, Union, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    DUMMY_PASSWORD_HASH,
    get_password_hash,
    verify_and_update_password,
    verify_password,
)
from app.core.password_validator import PasswordValidator
from app.modules.user import schemas
from app.modules.user.crud import user_crud
from app.modules.user.exceptions import (
    InvalidPassword,
    ReauthRequired,
    UserAlreadyExists,
    UserNotFound,
)
from app.modules.user.models import User, UserRole
from app.core.logger import get_logger

logger = get_logger(__name__)


class UserService:
    """
    Класс-сервис для работы с пользователями.
    Инкапсулирует в себе паттерн Unit of Work (управление db.commit() / db.rollback()).
    """

    async def get_users(self, db: AsyncSession, skip: int = 0, limit: int = 100) -> List[User]:
        """Получает список пользователей с пагинацией."""
        return await user_crud.get_multi(db, skip=skip, limit=min(limit, 200))

    async def create_user(
        self,
        db: AsyncSession,
        user_in: schemas.UserRegisterIn,
        role: UserRole = UserRole.VIEWER,
    ) -> User:
        """
        Регистрирует нового пользователя. Роль по умолчанию — viewer; другую роль
        может передать только серверный код (например, CLI-скрипт создания админа).
        """
        is_valid, error_msg = PasswordValidator.validate(user_in.password)
        if not is_valid:
            raise InvalidPassword(error_msg)

        if await user_crud.get_by_email(db, email=user_in.email):
            raise UserAlreadyExists("Пользователь с такой почтой или именем уже существует")
        if await user_crud.get_by_username(db, username=user_in.username):
            raise UserAlreadyExists("Пользователь с такой почтой или именем уже существует")

        # Argon2 намеренно медленный (~50–100 мс) — не блокируем event loop.
        hashed_password = await asyncio.to_thread(get_password_hash, user_in.password)

        try:
            user = await user_crud.create(db, obj_in=user_in, hashed_password=hashed_password, role=role)
            await db.commit()
            return user
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка при создании пользователя: {type(e).__name__}")
            raise

    async def authenticate_user(self, db: AsyncSession, username: str, password: str) -> Optional[User]:
        """
        Проверяет логин (username или email) и пароль.
        Если пользователя нет, всё равно проверяем хэш-пустышку: время ответа
        одинаковое, и по нему нельзя перебрать существующие логины.
        """
        user = await user_crud.get_by_username(db, username=username)
        if not user:
            user = await user_crud.get_by_email(db, email=username)

        if not user:
            await asyncio.to_thread(verify_password, password, DUMMY_PASSWORD_HASH)
            return None

        ok, new_hash = await asyncio.to_thread(verify_and_update_password, password, user.hashed_password)
        if not ok:
            return None
        if new_hash:
            # Старый bcrypt-хэш — тихо переводим на Argon2id.
            user.hashed_password = new_hash
            db.add(user)
        return user

    async def get_user_by_id(self, db: AsyncSession, user_id: int) -> User:
        """Получает пользователя по ID. Если не найден — выбрасывает ошибку 404."""
        user = await user_crud.get_by_id(db, user_id=user_id)
        if not user:
            raise UserNotFound(f"Пользователь с ID {user_id} не найден")
        return user

    async def update_self(self, db: AsyncSession, user: User, user_in: schemas.UserSelfUpdateIn) -> User:
        """
        Изменение собственного профиля. Смена email/пароля требует current_password.
        """
        update_data = user_in.model_dump(exclude_unset=True)
        current_password = update_data.pop("current_password", None)

        sensitive = {"email", "password"} & {k for k, v in update_data.items() if v}
        if sensitive:
            if not current_password:
                raise ReauthRequired("Для смены почты или пароля введите текущий пароль")
            ok = await asyncio.to_thread(verify_password, current_password, user.hashed_password)
            if not ok:
                raise ReauthRequired("Текущий пароль неверен")

        new_email = update_data.get("email")
        if new_email and new_email != user.email and await user_crud.get_by_email(db, email=new_email):
            raise UserAlreadyExists("Пользователь с такой почтой или именем уже существует")
        new_username = update_data.get("username")
        if new_username and new_username != user.username and await user_crud.get_by_username(db, username=new_username):
            raise UserAlreadyExists("Пользователь с такой почтой или именем уже существует")

        if update_data.get("password"):
            is_valid, error_msg = PasswordValidator.validate(update_data["password"])
            if not is_valid:
                raise InvalidPassword(error_msg)
            update_data["hashed_password"] = await asyncio.to_thread(get_password_hash, update_data.pop("password"))
        else:
            update_data.pop("password", None)

        return await self._apply(db, user, update_data)

    async def update_user(
        self,
        db: AsyncSession,
        user_id: int,
        user_in: Union[schemas.UserSelfUpdateIn, schemas.UserAvatarUpdate, Dict[str, Any]],
    ) -> User:
        """Внутреннее обновление (например, путь к аватару после загрузки)."""
        user = await self.get_user_by_id(db, user_id)
        update_data = user_in if isinstance(user_in, dict) else user_in.model_dump(exclude_unset=True)
        if update_data.get("password"):
            update_data["hashed_password"] = await asyncio.to_thread(get_password_hash, update_data.pop("password"))
        return await self._apply(db, user, update_data)

    async def _apply(self, db: AsyncSession, user: User, update_data: Dict[str, Any]) -> User:
        try:
            updated_user = await user_crud.update(db, db_obj=user, obj_in=update_data)
            await db.commit()
            return updated_user
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка при обновлении пользователя: {type(e).__name__}")
            raise

    async def delete_user(self, db: AsyncSession, user_id: int) -> User:
        """Удаляет пользователя из системы."""
        user = await self.get_user_by_id(db, user_id)
        try:
            deleted_user = await user_crud.delete(db, user_id=user.id)
            await db.commit()
            return deleted_user
        except Exception as e:
            await db.rollback()
            logger.error(f"Ошибка при удалении пользователя: {type(e).__name__}")
            raise


# Создаем глобальный объект сервиса (Singleton)
user_service = UserService()
