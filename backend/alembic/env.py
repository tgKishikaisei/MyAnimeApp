import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), "..")))

# Все модели регистрируются в Base.metadata через агрегатор.
from app.core.base import Base  # noqa: E402

target_metadata = Base.metadata

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)


def _database_url() -> str:
    """
    URL только из окружения (DATABASE_URL), а не из alembic.ini — пароль не
    должен лежать в репозитории. Миграции выполняются синхронно, поэтому
    asyncpg-драйвер заменяется на psycopg2.
    """
    url = os.getenv("DATABASE_URL") or config.get_main_option("sqlalchemy.url")
    if not url:
        raise RuntimeError("Задайте DATABASE_URL для запуска миграций")
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def run_migrations_offline() -> None:
    context.configure(
        url=_database_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


_EXCLUDE = set(filter(None, os.getenv("ALEMBIC_EXCLUDE_TABLES", "").split(",")))


def _include_object(obj, name, type_, reflected, compare_to):
    return not (type_ == "table" and name in _EXCLUDE)


def run_migrations_online() -> None:
    section = config.get_section(config.config_ini_section, {})
    section["sqlalchemy.url"] = _database_url()
    connectable = engine_from_config(section, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            include_object=_include_object,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
