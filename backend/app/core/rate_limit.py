"""
Защита от перебора паролей, спама и скрейпинга (Rate Limiting, slowapi).

- Ключ — IP клиента из `request.client.host`. Его выставляет uvicorn с
  `--proxy-headers --forwarded-allow-ips=<IP прокси>` только для доверенного
  прокси, поэтому подделать IP заголовком X-Forwarded-For нельзя.
- Хранилище счётчиков — RATE_LIMIT_STORAGE_URI (например, redis://redis:6379/1).
  По умолчанию память процесса: при нескольких воркерах лимит считается
  на каждый воркер отдельно, поэтому в production задайте Redis.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request

from app.core.config import settings


def _rate_limit_key(request: Request) -> str:
    # CORS preflight считаем в отдельной корзине на каждый IP: с одной общей
    # корзиной на всех middleware заблокировал бы preflight для всего сайта.
    ip = get_remote_address(request)
    return f"preflight:{ip}" if request.method == "OPTIONS" else ip


limiter = Limiter(
    key_func=_rate_limit_key,
    default_limits=["300/minute"],
    storage_uri=settings.RATE_LIMIT_STORAGE_URI,
    in_memory_fallback_enabled=True,
    enabled=settings.RATE_LIMIT_ENABLED,
)

AUTH_RATE_LIMIT = "5/minute"    # Логин/регистрация
WRITE_RATE_LIMIT = "30/minute"  # Комментарии, загрузки
READ_RATE_LIMIT = "100/minute"  # Чтение
