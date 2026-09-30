"""
Модуль Управления Контекстом (Async Context Variables).

Используется для хранения глобальных переменных внутри одного конкретного асинхронного потока.
Например: ID текущего HTTP-запроса пользователя.
Обычные глобальные переменные бы перемешались между 1000 пользователями, a ContextVar - нет.
"""
from contextvars import ContextVar
from typing import Optional

# Глобальная переменная для хранения уникального Request ID.
# Изолирована: каждый юзер, запрашивающий сервер, имеет свой личный ящичек `request_id_ctx`.
request_id_ctx: ContextVar[Optional[str]] = ContextVar("request_id", default=None)

def get_request_id() -> Optional[str]:
    """Получает ID запроса текущего потока"""
    return request_id_ctx.get()

def set_request_id(request_id: str):
    """Устанавливает ID запроса текущего потока (Вызывается из middleware.py)"""
    request_id_ctx.set(request_id)
