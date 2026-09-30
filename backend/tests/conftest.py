"""
Pytest configuration and fixtures.

Тестовая БД — отдельный PostgreSQL (модель User использует JSONB, SQLite не
подойдёт). Адрес берётся из TEST_DATABASE_URL, по умолчанию — контейнер из
README («Тесты»):

    docker run -d --name aniflow-test-db -e POSTGRES_USER=aniflow \
      -e POSTGRES_PASSWORD=aniflow_test_pw -e POSTGRES_DB=aniflow_test \
      -p 127.0.0.1:55432:5432 --tmpfs /var/lib/postgresql/data postgres:17-alpine
"""
import os

TEST_DATABASE_URL = os.environ.setdefault(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://aniflow:aniflow_test_pw@127.0.0.1:55432/aniflow_test",
)
# Настройки читаются при первом импорте app.* — выставляем окружение заранее.
os.environ["ENV"] = "development"
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("PROJECT_NAME", "AniFlow Test")
os.environ["SECRET_KEY"] = "test-only-" + "k" * 40
os.environ["DB_NULL_POOL"] = "true"
os.environ["API_REQUEST_LOG_ENABLED"] = "false"

from typing import AsyncGenerator  # noqa: E402

import pytest  # noqa: E402
import pytest_asyncio  # noqa: E402
from fastapi_cache import FastAPICache  # noqa: E402
from fastapi_cache.backends.inmemory import InMemoryBackend  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import NullPool  # noqa: E402

import app.core.base  # noqa: E402,F401  (регистрирует все модели в Base.metadata)
from app.core.database import Base, get_db  # noqa: E402
from app.core.rate_limit import limiter  # noqa: E402
from app.core.security import create_access_token, get_password_hash  # noqa: E402
from app.main import app  # noqa: E402
from app.modules.user.models import User, UserRole  # noqa: E402

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False, poolclass=NullPool)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

# Хэш считаем один раз: argon2 намеренно медленный.
TEST_PASSWORD = "TestPass123!"
_TEST_PASSWORD_HASH = get_password_hash(TEST_PASSWORD)

# Lifespan-события ASGITransport не запускает — кэш инициализируем сами.
FastAPICache.init(InMemoryBackend(), prefix="test")


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with TestSessionLocal() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture(scope="function")
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    limiter.reset()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def make_user(db_session: AsyncSession):
    """Создаёт пользователя напрямую в БД (роль ставит тест, а не API)."""
    counter = {"n": 0}

    async def _make(role: UserRole = UserRole.VIEWER, **fields) -> User:
        counter["n"] += 1
        n = counter["n"]
        user = User(
            email=fields.pop("email", f"user{n}@example.com"),
            username=fields.pop("username", f"user{n}"),
            hashed_password=_TEST_PASSWORD_HASH,
            role=role,
            is_active=True,
            permissions=fields.pop("permissions", {}),
            **fields,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    return _make


def auth_headers(user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


@pytest.fixture
def test_user_data():
    return {
        "email": "test@example.com",
        "username": "testuser",
        "password": TEST_PASSWORD,
        "full_name": "Test User",
    }
