"""
Модуль уведомлений в реальном времени (WebSocket).

Клиент подключается по URL: ws(s)://<host>/api/v1/ws/notifications?ticket=<ws-билет>
Билет выдаёт `POST /api/v1/auth/ws-ticket?channel=notifications` (живёт 60 секунд).
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.broadcaster import broadcaster
from app.core.logger import get_logger
from app.core.ws_auth import authenticate_ws

logger = get_logger(__name__)
router = APIRouter()


@router.websocket("/notifications")
async def ws_notifications(websocket: WebSocket):
    user_id = await authenticate_ws(websocket, "notifications")
    if user_id is None:
        return

    await broadcaster.connect(websocket, user_id=user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Heartbeat, чтобы прокси не рвали «тихое» соединение.
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket, user_id=user_id)
