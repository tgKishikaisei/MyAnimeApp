import sys
import os
import asyncio
from dotenv import load_dotenv

# Load env
load_dotenv()

# Setup path
sys.path.insert(0, os.getcwd())

from app.core.database import AsyncSessionLocal
from app.modules.user.models import User, UserRole
from sqlalchemy import select

async def make_admin():
    """Сделать пользователя администратором по email"""
    email = input("Введите email пользователя: ").strip()
    
    try:
        async with AsyncSessionLocal() as db:
            # Найти пользователя
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            
            if not user:
                print(f"❌ Пользователь с email '{email}' не найден!")
                return
            
            # Проверить текущую роль
            if user.role == UserRole.ADMIN:
                print(f"✅ Пользователь {user.username} уже администратор!")
                return
            
            # Обновить роль
            print(f"Пользователь найден: {user.username} (текущая роль: {user.role})")
            user.role = UserRole.ADMIN
            await db.commit()
            
            print(f"✅ Успешно! {user.username} теперь ADMIN!")
            print(f"Email: {user.email}")
            print(f"Username: {user.username}")
            
    except Exception as e:
        print(f"❌ Ошибка: {e}")

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(make_admin())
