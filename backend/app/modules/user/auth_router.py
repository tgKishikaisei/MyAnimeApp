"""
Вход, обновление сессии, выход и билеты для WebSocket.

- access-токен (15 мин) отдаётся в JSON; фронтенд держит его только в памяти.
- refresh-токен (7 дней) — непрозрачная строка в cookie
  `HttpOnly; SameSite=Strict; Path=/api/v1/auth` (+ `Secure` вне development).
  В БД хранится только его SHA-256, каждое обновление ротирует токен,
  повторное использование отзывает всю семью (см. tokens.py).
- /refresh и /logout требуют заголовок `X-Requested-With`: чужой сайт не может
  его выставить без CORS-preflight, а preflight с чужого origin не пройдёт.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from user_agents import parse

from app.api import deps
from app.core import security
from app.core.config import settings
from app.core.rate_limit import AUTH_RATE_LIMIT, limiter
from app.modules.analytics.models import UserSession
from app.modules.user import models, schemas, service, tokens

router = APIRouter()

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = f"{settings.API_V1_STR}/auth"


def _client_ip(request: Request) -> str:
    # Реальный IP подставляет uvicorn (--proxy-headers) только для доверенного
    # прокси. Сырой X-Forwarded-For здесь не читаем: его может подделать клиент.
    return request.client.host if request.client else ""


# Несекретная подсказка для фронтенда «сессия, вероятно, есть» (значение "1").
# JS не видит HttpOnly refresh-cookie, и без подсказки каждый анонимный
# визит начинался бы с заведомо неудачного /auth/refresh (401 в консоли).
SESSION_HINT_COOKIE = "aniflow_session"


def _set_refresh_cookie(response: Response, value: str) -> None:
    secure = settings.ENV != "development"
    max_age = int(security.REFRESH_TOKEN_TTL.total_seconds())
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=value,
        httponly=True,
        secure=secure,
        samesite="strict",
        max_age=max_age,
        path=REFRESH_COOKIE_PATH,
    )
    response.set_cookie(
        key=SESSION_HINT_COOKIE, value="1", httponly=False, secure=secure,
        samesite="strict", max_age=max_age, path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    secure = settings.ENV != "development"
    response.delete_cookie(
        key=REFRESH_COOKIE,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=secure,
        samesite="strict",
    )
    response.delete_cookie(key=SESSION_HINT_COOKIE, path="/", secure=secure, samesite="strict")


def _require_xhr(request: Request) -> None:
    if request.headers.get("x-requested-with", "").lower() != "xmlhttprequest":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="CSRF check failed")


def _token_response(user_id: int) -> dict[str, Any]:
    return {
        "access_token": security.create_access_token(user_id),
        "token_type": "bearer",
        "expires_in": int(security.ACCESS_TOKEN_TTL.total_seconds()),
    }


@router.post("/login", response_model=schemas.Token)
@limiter.limit(AUTH_RATE_LIMIT)
async def login_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
    form_data: OAuth2PasswordRequestForm = Depends(),
) -> Any:
    """Вход по username или email (x-www-form-urlencoded, поле `username`)."""
    user = await service.user_service.authenticate_user(
        db, username=form_data.username, password=form_data.password
    )
    # Одинаковый ответ для «нет такого пользователя», «неверный пароль»,
    # «деактивирован» — по нему нельзя перебирать существующие аккаунты.
    banned = bool(user and user.banned_until and user.banned_until > datetime.now(timezone.utc))
    if not user or not user.is_active or banned:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user.last_login_at = datetime.now(timezone.utc)
    db.add(user)

    user_agent_string = request.headers.get("user-agent", "")[:300]
    parsed_ua = parse(user_agent_string)
    device_type = "mobile" if parsed_ua.is_mobile else "tablet" if parsed_ua.is_tablet else "pc"
    ip = _client_ip(request)

    db.add(
        UserSession(
            user_id=user.id,
            ip_address=ip,
            device_type=device_type,
            os=f"{parsed_ua.os.family} {parsed_ua.os.version_string}".strip(),
            browser=f"{parsed_ua.browser.family} {parsed_ua.browser.version_string}".strip(),
        )
    )
    refresh = await tokens.issue(db, user.id, user_agent=user_agent_string, ip_address=ip)
    await db.commit()

    _set_refresh_cookie(response, refresh)
    return _token_response(user.id)


@router.post("/refresh", response_model=schemas.Token)
async def refresh_access_token(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
):
    """Silent refresh: новый access-токен + ротация refresh-cookie."""
    _require_xhr(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    result, user, new_raw = await tokens.rotate(
        db,
        raw,
        user_agent=request.headers.get("user-agent", "")[:300],
        ip_address=_client_ip(request),
    )
    if result is tokens.RotateResult.RACE:
        # Параллельный refresh из соседней вкладки — клиент просто повторит запрос.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Refresh in progress")
    if result is not tokens.RotateResult.OK or user is None:
        await db.commit()  # фиксируем отзыв семьи при REUSED
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    banned = bool(user.banned_until and user.banned_until > datetime.now(timezone.utc))
    if not user.is_active or banned:
        await tokens.revoke_all_for_user(db, user.id)
        await db.commit()
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия истекла")

    await db.commit()
    _set_refresh_cookie(response, new_raw)
    return _token_response(user.id)


@router.post("/logout")
async def logout(request: Request, response: Response, db: AsyncSession = Depends(deps.get_db)):
    """Выход: отзываем семью refresh-токенов этого устройства и стираем cookie."""
    _require_xhr(request)
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        await tokens.revoke_by_token(db, raw)
        await db.commit()
    _clear_refresh_cookie(response)
    return {"status": "ok"}


@router.post("/logout-all")
async def logout_all(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(deps.get_db),
    current_user: models.User = Depends(deps.get_current_user),
):
    """Выйти на всех устройствах (например, если пароль мог утечь)."""
    _require_xhr(request)
    await tokens.revoke_all_for_user(db, current_user.id)
    await db.commit()
    _clear_refresh_cookie(response)
    return {"status": "ok"}


@router.post("/ws-ticket", response_model=schemas.WsTicket)
async def issue_ws_ticket(
    channel: str = "notifications",
    current_user: models.User = Depends(deps.get_current_user),
):
    """
    Билет на 60 секунд для подключения к WebSocket. Канал `admin` выдаётся
    только администратору.
    """
    if channel not in ("notifications", "admin"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unknown channel")
    if channel == "admin" and not deps.is_admin(current_user):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not Found")
    return {
        "ticket": security.create_ws_ticket(current_user.id, channel),
        "expires_in": int(security.WS_TICKET_TTL.total_seconds()),
    }
