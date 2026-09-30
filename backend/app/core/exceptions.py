"""
Глобальные обработчики ошибок системы (Global Exception Handlers).
Вместо того чтобы в каждом роутере писать try/except и ловить ошибки базы данных,
мы перехватываем их на самом верхнем уровне и отдаем пользователю красивые JSON-ответы.
"""
from fastapi import Request, FastAPI, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError

from app.core.logger import get_logger
from app.core.context import get_request_id

# Импортируем наши собственные (Доменные) ошибки бизнес-логики
from app.modules.user.exceptions import (
    InvalidPassword,
    ReauthRequired,
    UserAlreadyExists,
    UserError,
    UserNotFound,
)
from app.modules.anime.exceptions import AnimeError, AnimeNotFound, ClipNotFound

logger = get_logger("exception_handler")

async def domain_exception_handler(request: Request, exc: Exception):
    """
    Обработчик Доменных ошибок.
    Доменная ошибка — это когда код отработал нормально, но нарушилась бизнес-логика.
    Например: "Аниме не найдено", "Юзер уже существует".
    Мы перехватываем эти питоновские Exception'ы и превращаем в правильные HTTP статусы (404, 400).
    """
    status_code = status.HTTP_400_BAD_REQUEST
    
    if isinstance(exc, (UserNotFound, AnimeNotFound, ClipNotFound)):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, UserAlreadyExists):
        # 409 Conflict - если пытаемся создать то, что уже есть (email занят)
        status_code = status.HTTP_409_CONFLICT
    elif isinstance(exc, InvalidPassword):
        status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    elif isinstance(exc, ReauthRequired):
        status_code = status.HTTP_403_FORBIDDEN

    # Пишем в лог сервера как Warning (предупреждение), так как сервер не упал, 
    # это просто пользователь ошибся (но мы всё равно собираем статистику).
    logger.warning(f"Domain Error: {exc.detail}", extra={"status_code": status_code})
    
    return JSONResponse(
        status_code=status_code,
        content={
            "detail": exc.detail,               # Понятное сообщение для юзера ("Email занят")
            "type": exc.__class__.__name__,     # Имя питоновского класса ошибки (Например: UserAlreadyExists)
            "request_id": get_request_id()      # Уникальный ID запроса (чтобы отследить в Kibana)
        },
    )

async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """
    Обработчик ошибок валидации Pydantic (схем).
    Срабатывает, если фронтенд прислал кривой JSON (например, текст вместо числа, или слишком короткий пароль).
    Вместо падения с ошибкой 500, мы отдаем статус 422 Unprocessable Entity.
    """
    # Pydantic кладёт в ошибку исходное значение (`input`) — это может быть
    # пароль или токен. Ни в лог, ни в ответ его не отдаём.
    errors = [
        {"loc": err.get("loc"), "msg": err.get("msg"), "type": err.get("type")}
        for err in exc.errors()
    ]
    logger.info("Validation Error", extra={"errors": [(e["loc"], e["type"]) for e in errors]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Ошибка валидации данных",
            "errors": errors,
            "request_id": get_request_id()
        },
    )

async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """
    Щит от утечки данных Базы Данных.
    Если внутри PostgreSQL произошел сбой (упала сеть, неверный синтаксис SQL), 
    мы ПРЯЧЕМ от пользователя текст ошибки, чтобы хакер не узнал структуру наших таблиц.
    Пишем полную ошибку в лог, а юзеру отдаем просто "Internal Server Error 500".
    """
    logger.error(f"Database Error: {type(exc).__name__}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Ошибка соединения с базой данных",
            "request_id": get_request_id()
        },
    )

async def global_exception_handler(request: Request, exc: Exception):
    """
    Отлов непредвиденных крашей (Last Resort).
    Если произошла ошибка деления на ноль, выход за границы массива или что-то еще,
    мы ловим её здесь, запрещая серверу "упасть" (выключиться).
    """
    logger.error(f"Unhandled Exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Внутренняя ошибка сервера",
            "request_id": get_request_id()
        },
    )

def add_exception_handlers(app: FastAPI):
    """Монтирует все обработчики в главное приложение FastAPI"""
    
    # Регистрация Доменных (Бизнес) исключений
    app.add_exception_handler(UserError, domain_exception_handler)
    app.add_exception_handler(AnimeError, domain_exception_handler)
    
    # Регистрация Системных исключений
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)