"""
Модуль криптографии и безопасности сервера.
Отвечает за хэширование паролей пользователей и выпуск/проверку JWT-токенов.

Почему так:
- PyJWT вместо python-jose: python-jose тянет `ecdsa` с CVE-2024-23342 и
  исторически имел проблемы с algorithm confusion. FastAPI в своей документации
  тоже перешёл на PyJWT.
- pwdlib (Argon2id) вместо passlib: passlib больше не поддерживается.
  BcryptHasher оставлен только для проверки старых хэшей — при следующем
  входе они перехэшируются в Argon2id (см. `verify_and_update`).
- В каждом токене есть `type`, `iat`, `jti`, `iss`, `aud`. Декодер требует их
  все и принимает только явно указанный алгоритм — токен другого типа
  (например, refresh вместо access) не пройдёт.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

# Первый хэшер — основной (им хэшируются новые пароли), остальные только проверяют.
password_hasher = PasswordHash((Argon2Hasher(), BcryptHasher()))

# Хэш-пустышка: проверяем его, когда пользователя не существует, чтобы по
# времени ответа нельзя было понять, есть ли такой логин в базе.
DUMMY_PASSWORD_HASH = password_hasher.hash(secrets.token_urlsafe(16))

ALGORITHM = "HS256"
JWT_ISSUER = "aniflow-api"
JWT_AUDIENCE = "aniflow"

ACCESS_TOKEN_TTL = timedelta(minutes=15)
REFRESH_TOKEN_TTL = timedelta(days=7)
WS_TICKET_TTL = timedelta(seconds=60)

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_WS = "ws"


class InvalidToken(Exception):
    """Токен подделан, просрочен или не того типа."""


def _encode(subject: str | int, token_type: str, ttl: timedelta, extra: dict | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": str(subject),
        "type": token_type,
        "iat": now,
        "nbf": now,
        "exp": now + ttl,
        "jti": uuid.uuid4().hex,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """Проверяет подпись, срок, издателя, аудиторию и тип токена."""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
            leeway=5,
            options={"require": ["exp", "iat", "nbf", "sub", "type", "jti", "iss", "aud"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc
    if payload.get("type") != expected_type:
        raise InvalidToken("wrong token type")
    return payload


def create_access_token(subject: str | int, expires_delta: timedelta | None = None) -> str:
    """Короткоживущий access-токен (15 минут), отправляется в заголовке Authorization."""
    return _encode(subject, TOKEN_TYPE_ACCESS, expires_delta or ACCESS_TOKEN_TTL)


def create_ws_ticket(subject: str | int, channel: str) -> str:
    """
    Билет на подключение к WebSocket (60 секунд, один канал).
    Браузер не умеет слать заголовок Authorization в WebSocket, поэтому в URL
    уходит не access-токен, а этот короткий билет: даже если он попадёт в логи
    прокси, через минуту он бесполезен и не даёт доступа к REST API.
    """
    return _encode(subject, TOKEN_TYPE_WS, WS_TICKET_TTL, {"channel": channel})


def new_refresh_token() -> tuple[str, str]:
    """
    Refresh-токен — случайная непрозрачная строка, не JWT. В базе хранится
    только её SHA-256: утечка таблицы не даёт действующих токенов.
    Возвращает (токен для cookie, хэш для БД).
    """
    token = secrets.token_urlsafe(48)
    return token, hash_refresh_token(token)


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hasher.verify(plain_password, hashed_password)


def verify_and_update_password(plain_password: str, hashed_password: str) -> tuple[bool, str | None]:
    """Проверяет пароль; если хэш устаревший (bcrypt), возвращает новый Argon2id-хэш."""
    return password_hasher.verify_and_update(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return password_hasher.hash(password)
