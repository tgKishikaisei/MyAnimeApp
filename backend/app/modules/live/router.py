"""
WebSocket-каналы админ-дашборда.

- /api/v1/ws/live   — поток событий просмотра для 3D-глобуса.
- /api/v1/admin/ws  — общая лента событий (новые пользователи, комментарии).

Оба канала только для администратора: подключение по WS-билету с каналом
`admin` (см. app/core/ws_auth.py). Без билета соединение закрывается с 4001.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.broadcaster import broadcaster
from app.core.logger import get_logger
from app.core.ws_auth import authenticate_ws
from app.modules.live.manager import manager

logger = get_logger(__name__)
router = APIRouter()
admin_ws_router = APIRouter()


@router.websocket("")
async def live_activity_endpoint(websocket: WebSocket):
    if await authenticate_ws(websocket, "admin") is None:
        return
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {type(e).__name__}")
        manager.disconnect(websocket)


@admin_ws_router.websocket("/ws")
async def admin_websocket_endpoint(websocket: WebSocket):
    if await authenticate_ws(websocket, "admin") is None:
        return
    await broadcaster.connect(websocket, channel="admin")
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {type(e).__name__}")
        broadcaster.disconnect(websocket)
