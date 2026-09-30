"""
Роутер загрузки системных картинок (баннеры, картинки в новостях).
Только администратор. Файл проверяется по сигнатуре и перекодируется —
загрузить сюда HTML/SVG/скрипт под видом картинки нельзя.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.deps import get_current_active_superuser
from app.core.file_upload import save_image
from app.core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.post("/image")
async def upload_image(
    file: UploadFile = File(...),
    current_user=Depends(get_current_active_superuser),
):
    try:
        rel, _ = await save_image(file, "uploads", "img")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Image upload failed")
        raise HTTPException(status_code=500, detail="Не удалось сохранить файл")
    return {"url": f"/static/{rel}"}
