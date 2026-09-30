import asyncio
import json
from typing import Dict, List, Optional
from fastapi import WebSocket

from app.core.logger import get_logger

logger = get_logger(__name__)


class LiveEventBroadcaster:
    """
    Диспетчер WebSocket-соединений.

    Два независимых канала:
    - admin: живые события для админ-дашборда (новые пользователи, просмотры,
      комментарии). Они уходят только в админские сокеты: в них есть логины
      и геолокация зрителей.
    - user: персональные уведомления (send_to_user).
    """

    def __init__(self):
        self.admin_connections: List[WebSocket] = []
        self.user_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None, channel: str = "user"):
        await websocket.accept()
        if channel == "admin":
            self.admin_connections.append(websocket)
            return
        if user_id is None:
            raise ValueError("user channel requires user_id")
        self.user_connections.setdefault(user_id, []).append(websocket)
        logger.info(f"WS подключён: user_id={user_id}, вкладок={len(self.user_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        if websocket in self.admin_connections:
            self.admin_connections.remove(websocket)
        if user_id is not None and user_id in self.user_connections:
            conns = self.user_connections[user_id]
            if websocket in conns:
                conns.remove(websocket)
            if not conns:
                del self.user_connections[user_id]

    async def broadcast(self, event_type: str, message: str, data: dict = None):
        """Событие для админ-дашборда. Обычные пользователи его не получают."""
        if not self.admin_connections:
            return
        payload = json.dumps({"type": event_type, "message": message, "data": data or {}})
        await asyncio.gather(
            *(conn.send_text(payload) for conn in list(self.admin_connections)),
            return_exceptions=True,
        )

    async def send_to_user(self, user_id: int, event_type: str, title: str, data: dict = None):
        """Персональное уведомление на все устройства пользователя."""
        conns = self.user_connections.get(user_id, [])
        if not conns:
            return
        payload = json.dumps({"type": event_type, "title": title, "data": data or {}})
        await asyncio.gather(*(conn.send_text(payload) for conn in list(conns)), return_exceptions=True)


broadcaster = LiveEventBroadcaster()
