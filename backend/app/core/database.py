"""
Модуль подключения к базе данных.
Использует SQLAlchemy для создания асинхронного соединения с PostgreSQL.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool
from app.core.config import settings

# 1. Создаем "асинхронный движок" (AsyncEngine)
# Это главный объект, который управляет пулом соединений с базой данных PostgreSQL.
# echo=False отключает вывод каждого SQL запроса в консоль (в продакшене это заспамит логи).
if settings.DB_NULL_POOL:
    engine = create_async_engine(settings.DATABASE_URL, echo=False, poolclass=NullPool)
else:
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        pool_size=settings.DB_POOL_SIZE,
        max_overflow=settings.DB_MAX_OVERFLOW,
        pool_pre_ping=True,   # переживаем рестарт PostgreSQL без 500-х
        pool_recycle=1800,
    )

# 2. Создаем фабрику асинхронных сессий
# Сессия (Session) — это кэш транзакции. Все изменения сначала накапливаются в сессии, 
# а потом отправляются в базу данных через `session.commit()`.
# expire_on_commit=False обязательно для асинхронной работы, иначе SQLAlchemy 
# попытается сделать синхронный ленивый запрос после коммита, что вызовет крэш.
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False
)

# 3. Базовый класс для моделей
# Все наши классы таблиц (User, Anime, и т.д.) будут наследоваться от этого Base.
# SQLAlchemy использует его для того, чтобы понимать, какие таблицы вообще существуют.
Base = declarative_base()

# 4. Функция-генератор (Dependency) для получения сессии базы данных
# Эта функция внедряется в роутеры через `Depends(get_db)`.
# Для каждого HTTP запроса она открывает новое соединение с БД и, что самое главное,
# ГАРАНТИРОВАННО закрывает его в блоке `finally` после завершения запроса.
# Это спасает сервер от "утечки соединений" (connection leaks).
async def get_db():
    async with AsyncSessionLocal() as db:
        try:
            # Отдаем сессию роутеру для работы
            yield db
        finally:
            # Закрываем сессию возвращая соединение обратно в пул движка.
            await db.close()