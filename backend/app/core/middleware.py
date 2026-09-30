"""
Промежуточное ПО: Request ID, журнал запросов и телеметрия для админки.

Метрики копятся в памяти и пишутся в БД пачкой в фоне. Запрос не ждёт
INSERT и не занимает лишнее соединение из пула, а сбой записи телеметрии
не превращает рабочий ответ в 500.
"""
import asyncio
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings
from app.core.context import set_request_id
from app.core.logger import get_logger

logger = get_logger("middleware")

_FLUSH_EVERY = 50           # записей
_FLUSH_INTERVAL = 5.0       # секунд
_MAX_BUFFER = 5000          # защита памяти, если БД долго недоступна

_buffer: list[dict] = []
_last_flush = time.monotonic()
_flush_lock = asyncio.Lock()


async def flush_request_logs() -> None:
    """Сбрасывает накопленные метрики в таблицу api_request_logs."""
    global _last_flush
    async with _flush_lock:
        if not _buffer:
            return
        batch = _buffer[:]
        _buffer.clear()
        _last_flush = time.monotonic()
        try:
            from app.core.database import AsyncSessionLocal
            from app.modules.analytics.models import ApiRequestLog

            async with AsyncSessionLocal() as db:
                db.add_all(ApiRequestLog(**row) for row in batch)
                await db.commit()
        except Exception as exc:  # телеметрия не должна ронять сервис
            logger.warning(f"Не удалось записать метрики запросов: {type(exc).__name__}")


def _record(path: str, method: str, status_code: int, response_time_ms: int) -> None:
    if not settings.API_REQUEST_LOG_ENABLED or path.startswith("/static") or method == "OPTIONS":
        return
    if len(_buffer) >= _MAX_BUFFER:
        return
    _buffer.append(
        {
            "endpoint": path[:255],
            "method": method,
            "status_code": status_code,
            "response_time_ms": response_time_ms,
            "is_error": status_code >= 400,
        }
    )
    if len(_buffer) >= _FLUSH_EVERY or time.monotonic() - _last_flush >= _FLUSH_INTERVAL:
        asyncio.create_task(flush_request_logs())


class RequestLogMiddleware(BaseHTTPMiddleware):
    """Назначает Request ID, пишет структурированный лог и копит телеметрию."""

    async def dispatch(self, request: Request, call_next):
        request_id = str(uuid.uuid4())
        set_request_id(request_id)
        start = time.perf_counter()
        path = request.scope.get("path", "")

        logger.info(f"Входящий запрос: {request.method} {path}", extra={
            "method": request.method,
            "path": path,
            "client_ip": request.client.host if request.client else "unknown",
        })

        try:
            response = await call_next(request)
        except Exception:
            elapsed = time.perf_counter() - start
            logger.exception("Сбой выполнения запроса", extra={"duration": round(elapsed, 4)})
            _record(path, request.method, 500, int(elapsed * 1000))
            raise

        elapsed = time.perf_counter() - start
        logger.info(f"Запрос завершён: {response.status_code}", extra={
            "status_code": response.status_code,
            "duration": round(elapsed, 4),
        })
        _record(path, request.method, response.status_code, int(elapsed * 1000))
        response.headers["X-Request-ID"] = request_id
        return response
