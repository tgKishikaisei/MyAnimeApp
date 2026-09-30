"""audit_logs — только дописывается: триггер из миграции d4a1f3c9e8b7 запрещает UPDATE/DELETE/TRUNCATE."""
import importlib.util
from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.modules.audit.models import AuditLog

_MIGRATION = Path(__file__).resolve().parent.parent / "alembic" / "versions" / "d4a1f3c9e8b7_audit_logs_append_only.py"


def _load_migration():
    spec = importlib.util.spec_from_file_location("audit_mig", _MIGRATION)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.asyncio
async def test_audit_logs_cannot_be_changed_or_deleted(db_session):
    mig = _load_migration()
    for sql in (mig.CREATE_FUNCTION, mig.CREATE_ROW_TRIGGER, mig.CREATE_TRUNCATE_TRIGGER):
        await db_session.execute(text(sql))
    db_session.add(AuditLog(user_id=1, action="Changed User Role", target="User #2"))
    await db_session.commit()

    for statement in (
        "UPDATE audit_logs SET action = 'nothing happened'",
        "DELETE FROM audit_logs",
        "TRUNCATE audit_logs",
    ):
        with pytest.raises(DBAPIError, match="append-only"):
            await db_session.execute(text(statement))
        await db_session.rollback()

    # Запись осталась нетронутой, а новые по-прежнему добавляются.
    db_session.add(AuditLog(user_id=1, action="Exported Data", target="CSV"))
    await db_session.commit()
    rows = (await db_session.execute(text("SELECT action FROM audit_logs ORDER BY id"))).scalars().all()
    assert rows == ["Changed User Role", "Exported Data"]
