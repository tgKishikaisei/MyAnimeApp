"""
Создание (или повышение до) администратора — единственный способ получить
роль admin. Через API это сделать нельзя.

Запуск из папки backend/:
    python -m scripts.admin.create_admin --email you@example.com --username you

Пароль спрашивается интерактивно (getpass) или берётся из переменной
ADMIN_PASSWORD (для CI/Docker). Флага --password нет специально: пароль в
аргументах командной строки попадает в историю shell и в список процессов.
"""
import argparse
import asyncio
import getpass
import os
import sys

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "..")))

from sqlalchemy import select  # noqa: E402

import app.core.base  # noqa: E402,F401  (регистрирует все модели — иначе связи User→Clip не резолвятся)
from app.core.database import AsyncSessionLocal  # noqa: E402
from app.core.password_validator import PasswordValidator  # noqa: E402
from app.core.security import get_password_hash  # noqa: E402
from app.modules.user.models import User, UserRole  # noqa: E402


def _read_password() -> str:
    password = os.getenv("ADMIN_PASSWORD")
    if not password:
        password = getpass.getpass("Пароль администратора: ")
        if password != getpass.getpass("Повторите пароль: "):
            sys.exit("Пароли не совпадают")
    ok, message = PasswordValidator.validate(password)
    if not ok:
        sys.exit(f"Пароль не подходит: {message}")
    return password


async def create_admin(email: str, username: str) -> None:
    async with AsyncSessionLocal() as db:
        user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
        if user:
            if user.role == UserRole.ADMIN:
                print(f"{email} уже администратор.")
                return
            user.role = UserRole.ADMIN
            await db.commit()
            print(f"{email} повышен до администратора.")
            return

        db.add(
            User(
                email=email,
                username=username,
                hashed_password=get_password_hash(_read_password()),
                role=UserRole.ADMIN,
                is_active=True,
                permissions={},
            )
        )
        await db.commit()
        print(f"Администратор {email} создан.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Создать администратора AniFlow")
    parser.add_argument("--email", required=True)
    parser.add_argument("--username", required=True)
    args = parser.parse_args()
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(create_admin(args.email.strip().lower(), args.username.strip()))


if __name__ == "__main__":
    main()
