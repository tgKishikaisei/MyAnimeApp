"""
Аутентификация WebSocket-подключений по короткому билету.

Клиент сначала делает `POST /api/v1/auth/ws-ticket?channel=...` с обычным
access-токеном и получает билет на 60 секунд, затем подключается к
`...?ticket=<билет>`. Access-токен в URL не попадает, а значит не оседает
в логах прокси и истории браузера.
"""
from typing import Optional

from fastapi import WebSocket

from app.core import security
from app.core.database import AsyncSessionLocal
from app.modules.user.models import User, UserRole

WS_POLICY_VIOLATION = 4001


async def authenticate_ws(websocket: WebSocket, channel: str) -> Optional[int]:
    """Возвращает user_id или None (тогда соединение уже закрыто)."""
    ticket = websocket.query_params.get("ticket")
    user_id: Optional[int] = None
    if ticket:
        try:
            payload = security.decode_token(ticket, security.TOKEN_TYPE_WS)
            if payload.get("channel") == channel:
                user_id = int(payload["sub"])
        except (security.InvalidToken, ValueError, KeyError):
            user_id = None

    if user_id is not None:
        async with AsyncSessionLocal() as db:
            user = await db.get(User, user_id)
        if user is None or not user.is_active:
            user_id = None
        elif channel == "admin" and user.role != UserRole.ADMIN:
            user_id = None

    if user_id is None:
        await websocket.close(code=WS_POLICY_VIOLATION)
    return user_id
