"""
Модуль Жалоб (Reports).
Позволяет пользователям жаловаться на битые видео, спам, токсичные комментарии.
Отправляет уведомления напрямую администраторам в систему (через Webhooks - например, в Discord или Slack).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel

from app.core.database import get_db
from app.modules.user.models import User
from app.api.deps import get_current_user
from app.modules.reports.models import Report, ReportStatus
from app.utils.webhooks import dispatch_webhooks

router = APIRouter()

class ReportCreate(BaseModel):
    """Схема запроса для отправки жалобы"""
    target_type: str  # На что жалуемся (video, comment, bug)
    target_id: int    # ID объекта, на который жалоба (Например: ID комментария)
    reason: str       # Текст жалобы от юзера

@router.post("")
async def create_report(
    report_in: ReportCreate,
    db: AsyncSession = Depends(get_db),
    # Обратите внимание: Мы используем get_current_user (Не get_current_ACTIVE_user).
    # И мы допускаем Optional (То есть жаловаться могут в том числе и ГОСТИ без аккаунта).
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Создание тикета/жалобы в систему.
    Помимо записи в базу, сервер автоматически отправит запрос-вебхук (Webhook)
    в Discord/Telegram администраторам для быстрого реагирования.
    """
    # 1. Запоминаем кто жалуется (Если гость - user_id будет NULL)
    user_id = current_user.id if current_user else None
    
    # 2. Создаем запись в базе
    new_report = Report(
        user_id=user_id,
        target_type=report_in.target_type,
        target_id=report_in.target_id,
        reason=report_in.reason,
        status=ReportStatus.PENDING.value # Статус: "В ожидании"
    )
    db.add(new_report)
    await db.commit()
    await db.refresh(new_report)
    
    # 3. Интеграция: Отправляем Push-уведомление (Webhook) админам в их мессенджер
    user_identifier = current_user.username if current_user else "Анонимный гость"
    msg = f"**Тип жалобы:** `{report_in.target_type}`\n**ID Объекта:** `{report_in.target_id}`\n**Стукач:** `{user_identifier}`\n\n**Причина жалобы:**\n> {report_in.reason}"
    
    # Фоновя отправка вебхука (не блокириует ответ юзеру)
    await dispatch_webhooks("🚨 ПОСТУПИЛА НОВАЯ ЖАЛОБА", msg)
    
    return new_report
