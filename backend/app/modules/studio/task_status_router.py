"""
Task Status Polling endpoint.
Позволяет фронтенду отслеживать прогресс Celery задач. Только для вошедших
пользователей; текст исключения задачи наружу не отдаётся.
"""
from fastapi import APIRouter, Depends

from app.api.deps import get_current_user
from app.core.celery_app import celery_app
from app.modules.user.models import User

router = APIRouter()


@router.get("/{task_id}/status")
async def get_task_status(task_id: str, current_user: User = Depends(get_current_user)):
    """PENDING / PROCESSING (progress 0-100) / SUCCESS (result) / FAILURE."""
    result = celery_app.AsyncResult(task_id)
    response = {"task_id": task_id, "status": result.status, "progress": 0, "result": None, "error": None}

    if result.state == "PROCESSING":
        meta = result.info or {}
        response["progress"] = meta.get("progress", 0)
    elif result.state == "SUCCESS":
        response["progress"] = 100
        response["result"] = result.result
    elif result.state == "FAILURE":
        response["error"] = "Задача завершилась с ошибкой"
    return response
