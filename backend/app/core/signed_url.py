"""
Универсальный криптографический генератор Подписанных Ссылок (Signed URLs).

Проблема: Недобросовестные сайты воруют ссылки на наши видео (.mp4) и встраивают
их к себе на сайты (Хотлинкинг). Это сжигает наш дорогой интернет-трафик.

Решение: Мы отдаём пользователю не просто ссылку, а временный "билет" (Токен).
Сервер выдаёт билет только для одного устройства ровно на 10 минут. 

Формат Токена (Как мини JWT):
- Token = Base64(payload) + "." + Base64(HMAC-SHA256 подпись)
"""

import hmac
import hashlib
import base64
import json
import time
from fastapi import HTTPException

from app.core.config import settings

# Время жизни токена (Билета) по умолчанию (600 секунд = 10 минут)
DEFAULT_TTL = 600


def _b64encode(data: bytes) -> str:
    """Утилита кодирования Base64 (URL-safe, удаляет знаки '=' на конце)."""
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64decode(s: str) -> bytes:
    """Утилита декодирования Base64 (восстанавливает знаки '=' перед чтением)."""
    padding = 4 - len(s) % 4
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s)


def _sign(payload_b64: str) -> str:
    """
    Криптографическая МАГИЯ. 
    Берет открытый текст (payload), и "солит" его секретным ключом сервера (SECRET_KEY).
    Затем смешивает всё это необратимым алгоритмом SHA256. 
    Никто, кроме сервера, не знает SECRET_KEY, поэтому подделать подпись невозможно.
    """
    key = settings.SECRET_KEY.encode()
    msg = payload_b64.encode()
    return _b64encode(hmac.new(key, msg, hashlib.sha256).digest())


def create_download_token(clip_id: int, ttl: int = DEFAULT_TTL) -> str:
    """
    Машина по выдаче "Билетов".
    Формирует строку: `{"clip_id": 42, "exp": 1700000000}`.
    Приклеивает к ней цифровую подпись.
    
    Возвращает строку вида: "eyJjbGlw...HMAC"
    """
    # Штампуем время истечения билета
    exp = int(time.time()) + ttl
    
    # Собираем данные в строку формата JSON
    payload = json.dumps({"clip_id": clip_id, "exp": exp}, separators=(",", ":"))
    
    # Кодируем в Base64
    payload_b64 = _b64encode(payload.encode())
    
    # Вычисляем подпись
    signature = _sign(payload_b64)
    
    return f"{payload_b64}.{signature}"


def verify_download_token(token: str) -> dict:
    """
    Кондуктор проверяющий "Билеты" (Токены).
    Если кто-то попытается скачать видео, передав самопальный билет - кондуктор его отклонит.

    Возвращает:
        Распакованный словарь, например: {"clip_id": 42, "exp": 1700000000}

    Выстреливает HTTPException(403):
        - Если время вышло (прошло 10 минут)
        - Если подпись не сошлась (Хакер попытался изменить clip_id)
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            raise ValueError("Бракованный токен (отсутствует точка-разделитель)")

        payload_b64, provided_sig = parts

        # 1. Защита от подделок (Используем hmac.compare_digest для защиты от Timing-Атак!)
        expected_sig = _sign(payload_b64)
        if not hmac.compare_digest(expected_sig, provided_sig):
            raise ValueError("Фальшивая подпись (Не совпадает с секретным ключом сервера)!")

        # 2. Если подпись сошлась — безопасно читаем, что было зашифровано
        payload = json.loads(_b64decode(payload_b64).decode())

        # 3. Проверка срока годности ("Билет" мог протухнуть)
        if time.time() > payload["exp"]:
            raise ValueError("Токен просрочен (Время скачивания вышло)")

        return payload

    except (ValueError, KeyError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=403, detail=f"Отказ в доступе (Secure Download): {exc}")
