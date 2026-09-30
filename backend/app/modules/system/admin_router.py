from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime
import logging
from typing import List, Optional
from pydantic import BaseModel
import os
import csv
import io
import httpx
import psutil
from fastapi.responses import StreamingResponse, FileResponse

from app.core.database import get_db
from app.core.config import settings
from app.api.deps import get_current_active_superuser, require_permission
from redis import asyncio as aioredis

from app.modules.user.models import User, UserRole
from app.modules.user import schemas as user_schemas
from app.modules.anime.models import Anime, Clip, Review
from app.modules.audit.models import AuditLog
from app.modules.system.models import SystemSettings
from app.modules.reports.models import Report, ReportStatus

logger = logging.getLogger(__name__)

router = APIRouter()


def _cell(value):
    """
    Защита от CSV/Formula injection: ячейка, начинающаяся с = + - @ (или
    табуляции), в Excel выполняется как формула. Ник `=HYPERLINK(...)` в
    экспорте пользователей превращался бы в ссылку/команду у администратора.
    """
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + value
    return value


class _SafeCsvWriter:
    def __init__(self, fh):
        self._w = csv.writer(fh)

    def writerow(self, row):
        self._w.writerow([_cell(v) for v in row])

    def writerows(self, rows):
        for row in rows:
            self.writerow(row)

# Вспомогательная функция для создания лога аудита
async def create_audit_log(db: AsyncSession, user_id: int, action: str, target: str, details: dict = None):
    log = AuditLog(user_id=user_id, action=action, target=target, details=details)
    db.add(log)
    await db.commit()

# --- JIKAN API MODELS ---
class JikanSearchResult(BaseModel):
    mal_id: int
    title: str
    image_url: str
    synopsis: Optional[str] = None
    year: Optional[int] = None
    score: Optional[float] = None

class JikanImportRequest(BaseModel):
    mal_id: int
    title: str
    image_url: str
    synopsis: Optional[str] = None
    year: Optional[int] = None

@router.get("/stats")
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    # Требуются привилегии суперпользователя
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает общую статистику, состояние системы и данные для виджетов админ-панели.
    """
    from .admin_service import admin_dashboard_service
    return await admin_dashboard_service.get_dashboard_stats(db)

@router.get("/users", response_model=List[user_schemas.UserResponse])
async def get_all_users(
    skip: int = Query(0, ge=0), limit: int = Query(100, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает список всех пользователей.
    """
    result = await db.execute(select(User).order_by(User.id.desc()).offset(skip).limit(limit))
    return result.scalars().all()

@router.patch("/users/{user_id}/role", response_model=user_schemas.UserResponse)
async def update_user_role(
    user_id: int,
    role: UserRole = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Обновляет роль пользователя.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    await db.commit()
    await db.refresh(user)
    
    await create_audit_log(db, current_user.id, "Changed User Role", f"User #{user_id} -> {role.value}")
    
    return user

@router.patch("/users/{user_id}/permissions", response_model=user_schemas.UserResponse)
async def update_user_permissions(
    user_id: int,
    permissions: dict = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Обновляет детальные разрешения пользователя (JSONB).
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    old_permissions = dict(user.permissions) if user.permissions else {}
    user.permissions = permissions
    await db.commit()
    await db.refresh(user)
    
    details = {
        "old": old_permissions,
        "new": permissions
    }
    await create_audit_log(db, current_user.id, "Updated User Permissions", f"User #{user_id}", details=details)
    return user

@router.post("/users/{user_id}/ban", response_model=user_schemas.UserResponse)
async def ban_user(
    user_id: int,
    banned_until: datetime = Body(..., embed=True),
    ban_reason: str = Body(None, embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Блокирует пользователя временно или навсегда.
    """
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot ban yourself")
        
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Запрет на блокировку суперпользователей, если они являются другим администратором
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot ban another administrator")
        
    user.banned_until = banned_until
    user.ban_reason = ban_reason
    user.is_active = False # Дополнительная мера
    # Бан выкидывает со всех устройств сразу, а не через 7 дней жизни refresh-токена.
    from app.modules.user import tokens as refresh_tokens
    await refresh_tokens.revoke_all_for_user(db, user.id)

    await db.commit()
    await db.refresh(user)
    
    await create_audit_log(db, current_user.id, "Banned User", f"User #{user.id} until {banned_until}")
    
    return user

@router.post("/users/{user_id}/unban", response_model=user_schemas.UserResponse)
async def unban_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Снимает блокировку с пользователя.
    """
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.banned_until = None
    user.ban_reason = None
    user.is_active = True
    
    await db.commit()
    await db.refresh(user)
    
    await create_audit_log(db, current_user.id, "Unbanned User", f"User #{user.id}")
    
    return user

@router.delete("/cache")
async def clear_cache(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Очищает весь кеш Redis.
    """
    if not settings.REDIS_URL:
        raise HTTPException(status_code=400, detail="Redis is not configured")
        
    try:
        redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
        await redis.flushdb()
        await redis.close()
        
        await create_audit_log(db, current_user.id, "Cleared Cache", "Redis")
        
        return {"status": "success", "message": "Cache cleared successfully"}
    except Exception as e:
        logger.error(f"Failed to clear Redis cache: {e}")
        raise HTTPException(status_code=500, detail="Failed to clear cache")

@router.get("/settings")
async def get_system_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает единственную глобальную строку конфигурации для сайта.
    """
    settings_obj = await db.scalar(select(SystemSettings).limit(1))
    if not settings_obj:
        # Создать по умолчанию, если отсутствует
        settings_obj = SystemSettings()
        db.add(settings_obj)
        await db.commit()
        await db.refresh(settings_obj)
        
    return settings_obj

@router.patch("/settings")
async def update_system_settings(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
    _: User = Depends(require_permission("can_manage_settings"))
):
    """
    Обновляет глобальные настройки системы.
    """
    settings_obj = await db.scalar(select(SystemSettings).limit(1))
    if not settings_obj:
        settings_obj = SystemSettings()
        db.add(settings_obj)

    # Допустимые поля, которые могут быть обновлены
    valid_keys = {
        "site_name", "maintenance_mode", "allow_registrations", 
        "hero_banner_url", "seo_description",
        "telegram_bot_token", "telegram_chat_id", "discord_webhook_url"
    }
    
    updated = False
    old_settings = {}
    new_settings = {}
    
    for key, value in payload.items():
        if key in valid_keys:
            old_val = getattr(settings_obj, key, None)
            if old_val != value:
                old_settings[key] = old_val
                new_settings[key] = value
                setattr(settings_obj, key, value)
                updated = True
            
    if updated:
        await db.commit()
        await db.refresh(settings_obj)
        details = {
            "old": old_settings,
            "new": new_settings
        }
        await create_audit_log(db, current_user.id, "Updated System Settings", "Global Configuration", details=details)
        
    return settings_obj

@router.get("/reports")
async def get_reports(
    skip: int = 0,
    limit: int = 100,
    status: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Get all user reports.
    """
    query = select(Report).order_by(desc(Report.created_at)).offset(skip).limit(limit)
    if status is not None:
        query = query.where(Report.status == status)
        
    result = await db.execute(query)
    reports = result.scalars().all()
    
    return reports

@router.patch("/reports/{report_id}/status")
async def update_report_status(
    report_id: int,
    status: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Update report status.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    try:
        report_status = ReportStatus(status)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    report.status = report_status.value
    
    # Phase 3: Track Resolution Time
    if report_status in [ReportStatus.RESOLVED, ReportStatus.DISMISSED]:
        report.resolved_at = func.now()
        
    await db.commit()
    await db.refresh(report)
    
    await create_audit_log(db, current_user.id, "Updated Report Status", f"Report #{report_id} -> {status}")
    
    return report

@router.delete("/reports/{report_id}")
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Delete a report.
    """
    report = await db.get(Report, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    await db.delete(report)
    await db.commit()
    await create_audit_log(db, current_user.id, "Deleted Report", f"Report #{report_id}")
    
    return {"message": "Report deleted successfully"}

@router.get("/export/users")
async def export_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Export all users as CSV.
    """
    query = select(User).order_by(desc(User.created_at))
    result = await db.execute(query)
    users = result.scalars().all()
    
    output = io.StringIO()
    writer = _SafeCsvWriter(output)
    writer.writerow(["ID", "Email", "Username", "Role", "Is Active", "Created At"])
    
    for user in users:
        writer.writerow([
            user.id,
            user.email,
            user.username or "",
            user.role.value if hasattr(user.role, 'value') else user.role,
            user.is_active,
            user.created_at.isoformat() if user.created_at else ""
        ])
        
    output.seek(0)
    
    await create_audit_log(db, current_user.id, "Exported Data", "Users CSV Export")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users_export.csv"}
    )

@router.get("/audit-logs")
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Get a paginated list of all audit logs for the timeline view.
    """
    # Join with User to get username
    query = (
        select(AuditLog, User.username)
        .outerjoin(User, AuditLog.user_id == User.id)
        .order_by(desc(AuditLog.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    
    logs = []
    for log, username in result.all():
        logs.append({
            "id": log.id,
            "user_id": log.user_id,
            "username": username or "System/Unknown",
            "action": log.action,
            "target": log.target,
            "details": log.details,
            "created_at": log.created_at
        })
        
    return logs

@router.get("/export/audit-logs")
async def export_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Export all audit logs as CSV.
    """
    query = select(AuditLog).order_by(desc(AuditLog.created_at))
    result = await db.execute(query)
    logs = result.scalars().all()
    
    output = io.StringIO()
    writer = _SafeCsvWriter(output)
    writer.writerow(["ID", "User ID", "Action", "Target", "Timestamp"])
    
    for log in logs:
        writer.writerow([
            log.id,
            log.user_id or "System",
            log.action,
            log.target,
            log.created_at.isoformat() if log.created_at else ""
        ])
        
    output.seek(0)
    
    await create_audit_log(db, current_user.id, "Exported Data", "Audit Logs CSV Export")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_logs_export.csv"}
    )

from fastapi import UploadFile, File
import codecs

@router.get("/export/anime")
async def export_anime(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Export all anime as a CSV file.
    """
    query = select(Anime).order_by(desc(Anime.created_at))
    result = await db.execute(query)
    animes = result.scalars().all()
    
    output = io.StringIO()
    writer = _SafeCsvWriter(output)
    writer.writerow([
        "ID", "Title", "Slug", "Image", "Banner", "Description", 
        "Year", "Rating", "Section", "Highlight Char"
    ])
    
    for a in animes:
        writer.writerow([
            a.id,
            a.title,
            a.slug or "",
            a.image or "",
            a.banner or "",
            a.description or "",
            a.year or "",
            a.rating or 0.0,
            a.section.value if hasattr(a.section, "value") else a.section,
            a.highlight_char or ""
        ])
        
    output.seek(0)
    
    await create_audit_log(db, current_user.id, "Exported Data", "Anime CSV Export")
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=anime_export.csv"}
    )


# ─────────────────────────────────────────────────────────────────────────────
# XLSX-capable exports (format=csv|xlsx query param)
# ─────────────────────────────────────────────────────────────────────────────

def _make_xlsx(headers: list, rows: list[list]) -> bytes:
    """Создаёт XLSX-файл в памяти. Заголовок — жирный с автошириной колонок."""
    try:
        import openpyxl
        from openpyxl.styles import Font
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl not installed. Run: pip install openpyxl")

    wb = openpyxl.Workbook()
    ws = wb.active

    # Headers
    ws.append([_cell(v) for v in headers])
    for cell in ws[1]:
        cell.font = Font(bold=True)

    # Rows
    for row in rows:
        ws.append([_cell(v) for v in row])

    # Auto column width
    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 60)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.getvalue()


@router.get("/export/users-xlsx")
async def export_users_xlsx(
    fmt: str = "xlsx",   # csv | xlsx
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Экспорт всех пользователей — CSV или XLSX."""
    result = await db.execute(select(User).order_by(desc(User.created_at)))
    users = result.scalars().all()

    headers = ["ID", "Email", "Username", "Role", "Is Active", "Banned Until", "Created At"]
    rows = [[
        u.id, u.email, u.username or "",
        u.role.value if hasattr(u.role, "value") else u.role,
        u.is_active,
        u.banned_until.isoformat() if u.banned_until else "",
        u.created_at.isoformat() if u.created_at else "",
    ] for u in users]

    await create_audit_log(db, current_user.id, "Exported Data", f"Users {fmt.upper()}")

    if fmt == "csv":
        out = io.StringIO()
        w = _SafeCsvWriter(out); w.writerow(headers); w.writerows(rows)
        return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=users.csv"})
    xlsx = _make_xlsx(headers, rows)
    return StreamingResponse(iter([xlsx]),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=users.xlsx"})


@router.get("/export/anime-xlsx")
async def export_anime_xlsx(
    fmt: str = "xlsx",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Экспорт всего аниме — CSV или XLSX."""
    result = await db.execute(select(Anime).order_by(desc(Anime.created_at)))
    animes = result.scalars().all()

    headers = ["ID", "Title", "Slug", "Section", "Year", "Rating", "Clips", "Description"]
    rows = [[
        a.id, a.title, a.slug or "",
        a.section.value if hasattr(a.section, "value") else a.section,
        a.year or "", round(a.rating or 0, 2),
        len(a.clips) if hasattr(a, "clips") and a.clips else 0,
        (a.description or "")[:120],
    ] for a in animes]

    await create_audit_log(db, current_user.id, "Exported Data", f"Anime {fmt.upper()}")

    if fmt == "csv":
        out = io.StringIO()
        w = _SafeCsvWriter(out); w.writerow(headers); w.writerows(rows)
        return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=anime.csv"})
    xlsx = _make_xlsx(headers, rows)
    return StreamingResponse(iter([xlsx]),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=anime.xlsx"})


@router.get("/export/clips")
async def export_clips(
    fmt: str = "xlsx",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser),
):
    """Экспорт всех клипов — CSV или XLSX."""
    result = await db.execute(select(Clip).order_by(desc(Clip.created_at)))
    clips = result.scalars().all()

    headers = ["ID", "Title", "Anime ID", "Season", "Episode", "Quality", "Duration (s)", "Views", "File Size", "Created At"]
    rows = [[
        c.id, c.title, c.anime_id, c.season, c.episode,
        c.quality or "", c.duration or "",
        c.views or 0, c.file_size or "",
        c.created_at.isoformat() if c.created_at else "",
    ] for c in clips]

    await create_audit_log(db, current_user.id, "Exported Data", f"Clips {fmt.upper()}")

    if fmt == "csv":
        out = io.StringIO()
        w = _SafeCsvWriter(out); w.writerow(headers); w.writerows(rows)
        return StreamingResponse(iter([out.getvalue()]), media_type="text/csv",
                                 headers={"Content-Disposition": "attachment; filename=clips.csv"})
    xlsx = _make_xlsx(headers, rows)
    return StreamingResponse(iter([xlsx]),
                             media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                             headers={"Content-Disposition": "attachment; filename=clips.xlsx"})

@router.post("/anime/bulk-import")
async def import_anime_csv(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Import Anime records from a CSV file.
    Expected columns: Title, Slug, Image, Banner, Description, Year, Rating, Section
    """
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are allowed")

    try:
        csv_reader = csv.DictReader(codecs.iterdecode(file.file, 'utf-8'))
        inserted_count = 0
        from app.modules.anime.enums import AnimeSection
        
        for row in csv_reader:
            try:
                # Basic validation
                title = row.get("Title", "").strip()
                if not title:
                    continue
                    
                section_str = row.get("Section", "").strip().upper()
                section_enum = AnimeSection.TV if not section_str else getattr(AnimeSection, section_str, AnimeSection.TV)
                
                year_str = row.get("Year", "").strip()
                year_val = int(year_str) if year_str.isdigit() else None
                
                rating_str = row.get("Rating", "").strip()
                rating_val = float(rating_str) if rating_str else 0.0
                
                new_anime = Anime(
                    title=title,
                    slug=row.get("Slug", "").strip() or None,
                    image=row.get("Image", "").strip() or "/placeholder.png",
                    banner=row.get("Banner", "").strip() or None,
                    description=row.get("Description", "").strip() or None,
                    year=year_val,
                    rating=rating_val,
                    section=section_enum
                )
                
                db.add(new_anime)
                inserted_count += 1
            except Exception as row_exp:
                logger.error(f"Error parsing row {row}: {row_exp}")
                continue
                
        await db.commit()
        await create_audit_log(db, current_user.id, "Bulk Imported Anime", f"Inserted {inserted_count} records")
        
        return {"message": f"Successfully imported {inserted_count} records"}
    except Exception as e:
        logger.error(f"Bulk import error: {e}")
        raise HTTPException(status_code=500, detail="Failed to process CSV file.")

@router.get("/analytics")
async def get_analytics(
    days: int = 30,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Get time-series analytics data for the last X days.
    """
    from app.modules.analytics.service import analytics_service
    return await analytics_service.get_full_analytics(db, days)


from pathlib import Path
from typing import Optional

# Base directory for static files
STATIC_DIR = Path(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))) / "static"

@router.get("/media")
async def list_media(
    folder: str = "",
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает список файлов и директорий в папке статических ассетов.
    """
    target_dir = (STATIC_DIR / folder.strip('/')).resolve()
    
    # Безопасность: Убеждаемся, что цель находится внутри STATIC_DIR
    try:
        if not target_dir.is_relative_to(STATIC_DIR):
            raise HTTPException(status_code=403, detail="Access denied")
    except AttributeError:
        # Резервный вариант для Python < 3.9
        if str(STATIC_DIR) not in str(target_dir):
            raise HTTPException(status_code=403, detail="Access denied")
            
    if not target_dir.exists() or not target_dir.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")
        
    items = []
    for item in target_dir.iterdir():
        stat = item.stat()
        items.append({
            "name": item.name,
            "is_dir": item.is_dir(),
            "size": stat.st_size,
            "path": f"{folder.strip('/')}/{item.name}".strip('/')
        })
        
    # Сортировка: сперва директории, затем по алфавиту
    items.sort(key=lambda x: (not x["is_dir"], x["name"].lower()))
    return items

@router.post("/media")
async def upload_media(
    file: UploadFile = File(...),
    folder: str = Body(""),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Загружает файл в определенную статическую директорию.
    """
    # Только картинки, перекодированные Pillow, в папку внутри static/:
    # произвольный .html в публичном /static дал бы stored XSS на origin API.
    from app.core.file_upload import UnsafePath, safe_media_path, save_image

    subdir = folder.strip().strip("/") or "uploads"
    try:
        safe_media_path(subdir)
    except UnsafePath:
        raise HTTPException(status_code=400, detail="Недопустимая папка")

    try:
        rel, _ = await save_image(file, subdir, "media")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("Failed to upload media")
        raise HTTPException(status_code=500, detail="Could not save file")

    await create_audit_log(db, current_user.id, "Uploaded Media", f"File: {rel}")
    return {"message": "File uploaded successfully", "path": rel}

@router.delete("/media")
async def delete_media(
    path: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Удаляет определенный файл из статической директории.
    """
    if not path:
        raise HTTPException(status_code=400, detail="Path is required")
        
    target_path = (STATIC_DIR / path.strip('/')).resolve()
    
    try:
        if not target_path.is_relative_to(STATIC_DIR):
            raise HTTPException(status_code=403, detail="Access denied")
    except AttributeError:
        if str(STATIC_DIR) not in str(target_path):
            raise HTTPException(status_code=403, detail="Access denied")
            
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
        
    if target_path.is_dir():
        raise HTTPException(status_code=400, detail="Cannot delete directories through this endpoint")
        
    try:
        target_path.unlink()
        await create_audit_log(db, current_user.id, "Deleted Media", f"File: {path}")
        return {"message": "File deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete media: {e}")
        raise HTTPException(status_code=500, detail="Could not delete file")

class AnimeSeoUpdate(BaseModel):
    id: int
    title: Optional[str] = None
    slug: Optional[str] = None
    description: Optional[str] = None

@router.patch("/seo/anime")
async def bulk_update_anime_seo(
    updates: List[AnimeSeoUpdate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Массовое обновление свойств SEO (заголовок, slug, описание) для нескольких записей Аниме.
    """
    updated_count = 0
    try:
        for update in updates:
            anime = await db.get(Anime, update.id)
            if not anime:
                continue
                
            if update.title is not None:
                anime.title = update.title
            if update.slug is not None:
                anime.slug = update.slug if update.slug.strip() else None
            if update.description is not None:
                anime.description = update.description
                
            updated_count += 1
            
        await db.commit()
        await create_audit_log(db, current_user.id, "Bulk Updated SEO", f"Updated {updated_count} Anime records")
        return {"message": f"Successfully updated {updated_count} records"}
    except Exception as e:
        logger.error(f"Failed to bulk update anime SEO: {e}")
        raise HTTPException(status_code=500, detail="Failed to update SEO properties")

# --- УПРАВЛЕНИЕ ОТЗЫВАМИ И РЕЙТИНГАМИ ---

class ReviewUpdate(BaseModel):
    is_approved: bool

@router.get("/reviews")
async def get_all_reviews(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    query = (
        select(Review, User.username, Anime.title)
        .join(User, Review.user_id == User.id)
        .join(Anime, Review.anime_id == Anime.id)
        .order_by(desc(Review.created_at))
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()
    
    return {
        "items": [{
            "id": r.Review.id,
            "user_id": r.Review.user_id,
            "username": r.username,
            "anime_id": r.Review.anime_id,
            "anime_title": r.title,
            "rating": r.Review.rating,
            "content": r.Review.content,
            "is_approved": r.Review.is_approved,
            "created_at": r.Review.created_at
        } for r in rows],
        "total": limit # Stub
    }

@router.patch("/reviews/{review_id}")
async def moderate_review(
    review_id: int,
    update_data: ReviewUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
        
    review.is_approved = update_data.is_approved
    await db.commit()
    await create_audit_log(db, current_user.id, "Moderated Review", f"Review ID: {review_id}")
    return {"message": "Review updated successfully"}

@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    review = await db.get(Review, review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
        
    await db.delete(review)
    await db.commit()
    await create_audit_log(db, current_user.id, "Deleted Review", f"Review ID: {review_id}")
    return {"message": "Review deleted successfully"}

# --- COMMENTS MANAGEMENT ---

from app.modules.comments.models import Comment

@router.get("/comments")
async def get_all_comments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает все комментарии с присоединенной информацией о пользователе.
    """
    query = (
        select(Comment, User.username, User.avatar_url)
        .outerjoin(User, Comment.user_id == User.id)
        .order_by(desc(Comment.created_at))
        .limit(200)
    )
    result = await db.execute(query)
    rows = result.all()
    
    return [{
        "id": r.Comment.id,
        "user_id": r.Comment.user_id,
        "username": r.username or "Unknown",
        "avatar_url": r.avatar_url,
        "target_type": r.Comment.target_type,
        "target_id": r.Comment.target_id,
        "content": r.Comment.content,
        "is_deleted": r.Comment.is_deleted,
        "created_at": r.Comment.created_at
    } for r in rows]

@router.delete("/comments/{comment_id}")
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Мягкое удаление комментария (замена содержимого на заглушку).
    """
    comment = await db.get(Comment, comment_id)
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    comment.content = "[Deleted by Administrator]"
    comment.is_deleted = True
    await db.commit()
    
    await create_audit_log(db, current_user.id, "Deleted Comment", f"Comment #{comment_id}")
    return {"message": "Comment deleted"}

# --- SYSTEM BACKUP ---
import json

@router.get("/system/backup")
async def download_system_backup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Создает полный экспорт всех ключевых таблиц в виде файла резервной копии JSON.
    """
    try:
        backup_data = {}
        
        # Экспорт пользователей
        users_result = await db.execute(select(User))
        users = users_result.scalars().all()
        backup_data["users"] = [{
            "id": u.id, "username": u.username, "email": u.email,
            "role": u.role.value if hasattr(u.role, 'value') else u.role,
            "is_active": u.is_active, "full_name": u.full_name,
            "bio": u.bio, "avatar_url": u.avatar_url,
            "created_at": u.created_at.isoformat() if u.created_at else None
        } for u in users]
        
        # Экспорт аниме
        anime_result = await db.execute(select(Anime))
        animes = anime_result.scalars().all()
        backup_data["anime"] = [{
            "id": a.id, "title": a.title, "slug": a.slug,
            "image": a.image, "banner": a.banner, "description": a.description,
            "year": a.year, "rating": a.rating,
            "section": a.section.value if hasattr(a.section, 'value') else a.section,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in animes]
        
        # Export Clips
        clips_result = await db.execute(select(Clip))
        clips = clips_result.scalars().all()
        backup_data["clips"] = [{
            "id": c.id, "title": c.title, "video_id": c.video_id,
            "video_path": c.video_path, "thumbnail_path": c.thumbnail_path,
            "season": c.season, "episode": c.episode, "views": c.views,
            "anime_id": c.anime_id,
            "created_at": c.created_at.isoformat() if c.created_at else None
        } for c in clips]
        
        # Export Reviews
        reviews_result = await db.execute(select(Review))
        reviews = reviews_result.scalars().all()
        backup_data["reviews"] = [{
            "id": r.id, "user_id": r.user_id, "anime_id": r.anime_id,
            "rating": r.rating, "content": r.content, "is_approved": r.is_approved,
            "created_at": r.created_at.isoformat() if r.created_at else None
        } for r in reviews]
        
        # Export Audit Logs
        logs_result = await db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(500))
        logs = logs_result.scalars().all()
        backup_data["audit_logs"] = [{
            "id": l.id, "user_id": l.user_id, "action": l.action,
            "target": l.target,
            "created_at": l.created_at.isoformat() if l.created_at else None
        } for l in logs]
        
        backup_data["exported_at"] = datetime.utcnow().isoformat()
        
        output = json.dumps(backup_data, indent=2, ensure_ascii=False)
        
        await create_audit_log(db, current_user.id, "Created System Backup", "Full JSON Export")
        
        filename = f"aniflow_backup_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
        
        return StreamingResponse(
            iter([output]),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    except Exception as e:
        logger.error(f"Backup generation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate backup")

# ==========================================
# ФАЗА 7: JIKAN API (АВТО-ПАРСЕР)
# ==========================================

@router.get("/jikan/search", response_model=List[JikanSearchResult])
async def search_jikan_anime(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("manage_anime"))
):
    """
    Проксирует поисковый запрос к публичному API Jikan (MyAnimeList).
    Возвращает упрощенный список результатов для отображения в панели администратора.
    """
    url = f"https://api.jikan.moe/v4/anime?q={q}&limit=8&sfw=true"
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            results = []
            for item in data.get("data", []):
                results.append(JikanSearchResult(
                    mal_id=item.get("mal_id"),
                    title=item.get("title_english") or item.get("title") or "Unknown Title",
                    image_url=item.get("images", {}).get("webp", {}).get("image_url", ""),
                    synopsis=item.get("synopsis", ""),
                    year=item.get("year"),
                    score=item.get("score")
                ))
            return results
        except httpx.HTTPError as e:
            logger.error(f"Jikan API Error: {str(e)}")
            raise HTTPException(status_code=502, detail="Failed to fetch data from MyAnimeList.")

@router.post("/jikan/import")
async def import_jikan_anime(
    payload: JikanImportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("manage_anime"))
):
    """
    Импортирует выбранное аниме из Jikan прямо в нашу базу данных.
    """
    import re
    from app.modules.anime.enums import AnimeSection
    
    # Check if we already imported this (Title might match)
    stmt = select(Anime).where(Anime.title == payload.title)
    existing = await db.scalar(stmt)
    if existing:
        raise HTTPException(status_code=400, detail="Anime with this title already exists in the database.")
        
    # Генерируем slug явно, так как слушатель событий SQLAlchemy может не сработать на аргумент конструктора
    slug = payload.title.lower().strip()
    slug = re.sub(r'[^\w\s-]', '', slug)
    slug = re.sub(r'[\s_-]+', '-', slug)

    # Предотвращаем нарушение БД из-за слишком длинных заголовков
    safe_title = payload.title[:200]
    safe_slug = slug[:200]

    # Create the anime record
    new_anime = Anime(
        title=safe_title,
        slug=safe_slug,
        image=payload.image_url,
        description=payload.synopsis or "No description provided.",
        year=payload.year or datetime.now().year,
        section=AnimeSection.SERIES, # Default
        rating=0.0
    )
    
    db.add(new_anime)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        logger.error(f"Jikan Import Error: {str(e)}")
        raise HTTPException(status_code=400, detail="Failed to import anime. It may already exist or contain invalid characters.")
    await db.refresh(new_anime)
    
    # Лог аудита
    await create_audit_log(db, current_user.id, "jikan_import", f"Imported Anime '{payload.title}' from MAL")
    
    return {"status": "success", "anime_id": new_anime.id, "title": new_anime.title}

# WebSocket админского дашборда переехал в app/modules/live/router.py
# (/api/v1/admin/ws): там он проверяет WS-билет с каналом `admin`.

@router.get("/server-health")
async def get_server_health(
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Возвращает метрики состояния сервера в реальном времени, используя psutil.
    """
    try:
        # CPU Metrics
        # cpu_percent(interval=0.5) блокирует поток на полсекунды — уводим из event loop.
        import asyncio
        cpu_percent = await asyncio.to_thread(psutil.cpu_percent, 0.5)
        cpu_cores = psutil.cpu_count(logical=True)
        
        # RAM Metrics
        vm = psutil.virtual_memory()
        ram_total_gb = vm.total / (1024 ** 3)
        ram_used_gb = vm.used / (1024 ** 3)
        ram_percent = vm.percent
        
        # Disk Metrics
        disk = psutil.disk_usage('/')
        disk_total_gb = disk.total / (1024 ** 3)
        disk_used_gb = disk.used / (1024 ** 3)
        disk_percent = disk.percent
        
        return {
            "status": "online",
            "cpu": {
                "percent": cpu_percent,
                "cores": cpu_cores
            },
            "ram": {
                "total_gb": round(ram_total_gb, 2),
                "used_gb": round(ram_used_gb, 2),
                "percent": ram_percent
            },
            "disk": {
                "total_gb": round(disk_total_gb, 2),
                "used_gb": round(disk_used_gb, 2),
                "percent": disk_percent
            }
        }
    except Exception as e:
        logger.error(f"Failed to fetch server health: {e}")
        raise HTTPException(status_code=500, detail="Could not fetch server diagnostics")

@router.get("/backup-db")
async def execute_db_backup(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    pg_dump базы и выдача файла администратору.

    Пароль БД передаётся через PGPASSWORD, а не аргументом: аргументы видны
    в списке процессов. pg_dump запускается асинхронно и не блокирует
    event loop.
    """
    import asyncio
    import tempfile
    from urllib.parse import unquote, urlparse
    from starlette.background import BackgroundTask

    url = urlparse(settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://"))
    env = {**os.environ, "PGPASSWORD": unquote(url.password or "")}
    fd, path = tempfile.mkstemp(suffix=".sql")
    os.close(fd)

    def _cleanup():
        try:
            os.remove(path)
        except OSError:
            pass

    try:
        proc = await asyncio.create_subprocess_exec(
            "pg_dump",
            "-h", url.hostname or "localhost",
            "-p", str(url.port or 5432),
            "-U", unquote(url.username or "postgres"),
            "-d", url.path.lstrip("/"),
            "-f", path, "-c", "-O",
            env=env,
            stdout=asyncio.subprocess.DEVNULL,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)
    except FileNotFoundError:
        _cleanup()
        raise HTTPException(status_code=500, detail="pg_dump не установлен на сервере")
    except asyncio.TimeoutError:
        _cleanup()
        raise HTTPException(status_code=504, detail="Резервное копирование заняло слишком много времени")

    if proc.returncode != 0:
        logger.error("pg_dump failed: %s", (stderr or b"").decode(errors="ignore")[-1000:])
        _cleanup()
        raise HTTPException(status_code=500, detail="Не удалось создать резервную копию")

    await create_audit_log(db, current_user.id, "database_backup", "Full DB SQL dump downloaded")
    filename = f"aniflow_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sql"
    return FileResponse(path, media_type="application/sql", filename=filename, background=BackgroundTask(_cleanup))
