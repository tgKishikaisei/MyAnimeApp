"""audit_logs: append-only на уровне БД

Журнал аудита только дописывается: UPDATE, DELETE и TRUNCATE запрещены триггером.
Даже с доступом к БД через приложение (или SQL-инъекцией) злоумышленник не сотрёт
следы своих действий в админке.

Revision ID: d4a1f3c9e8b7
Revises: c7e1a9d4f2b0
Create Date: 2026-09-26 12:00:00

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd4a1f3c9e8b7'
down_revision: Union[str, Sequence[str], None] = 'c7e1a9d4f2b0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CREATE_FUNCTION = """
CREATE OR REPLACE FUNCTION audit_logs_append_only() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit_logs is append-only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;
"""
CREATE_ROW_TRIGGER = """
CREATE TRIGGER audit_logs_no_change
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION audit_logs_append_only();
"""
CREATE_TRUNCATE_TRIGGER = """
CREATE TRIGGER audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_append_only();
"""
DROP_ALL = [
    "DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs",
    "DROP TRIGGER IF EXISTS audit_logs_no_change ON audit_logs",
    "DROP FUNCTION IF EXISTS audit_logs_append_only()",
]


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    op.execute(CREATE_FUNCTION)
    op.execute(CREATE_ROW_TRIGGER)
    op.execute(CREATE_TRUNCATE_TRIGGER)


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for statement in DROP_ALL:
        op.execute(statement)
