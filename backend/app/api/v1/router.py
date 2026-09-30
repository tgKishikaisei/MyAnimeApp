"""
Главный маршрутизатор (Роутер) всего бэкенда.
Его задача — собрать десятки мелких роутеров из папки `modules/` в один большой `api_router`.
Этот `api_router` затем подключается в `main.py` под единым префиксом `/api/v1`.
"""
from fastapi import APIRouter, Depends
from app.api.deps import require_admin, require_staff
from app.modules.live import router as live_router

from app.modules.system import admin_router, seed_router, settings_router, upload_router
from app.modules.analytics import router as analytics_router, ds_router as analytics_ds_router
from app.modules.anime import router as anime_router, clips_router, recommendations_router
from app.modules.announcements import router as announcements_router
from app.modules.user import auth_router, router as users_router
from app.modules.news import router as news_router, blog_router
from app.modules.downloads import router as downloads_router
from app.modules.reports import router as reports_router
from app.modules.studio import router as studio_router
from app.modules.comments import router as comments_router
from app.modules.watchlist import router as watchlist_router
from app.modules.playlists import router as playlists_router
from app.modules.notifications import router as notifications_router


api_router = APIRouter()

# 1. Логин и Авторизация
api_router.include_router(auth_router.router, prefix="/auth", tags=["Auth"])

# 2. Пользователи (Регистрация, Профиль)
api_router.include_router(users_router.router, prefix="/users", tags=["Users"])

# 3. Аниме, Клипы и Студия
api_router.include_router(anime_router.router, prefix="/animes", tags=["Anime"])
api_router.include_router(clips_router.router, prefix="/clips", tags=["Clips"])
api_router.include_router(studio_router.router, prefix="/clips", tags=["Studio"])

# 4. Контент (Новости, Блог)
api_router.include_router(news_router.router, prefix="/news", tags=["News"])
api_router.include_router(blog_router.router, prefix="/blog-posts", tags=["Blog"])

# 5. Наполнение БД (Seed)
api_router.include_router(seed_router.router, prefix="/seed", tags=["Seed"])

# 6. Загрузки
api_router.include_router(downloads_router.router, prefix="/downloads", tags=["Downloads"])

# 8. Настройки (Публичные)
api_router.include_router(settings_router.router, prefix="/settings", tags=["Settings"])

# 9. Жалобы (Публичный POST, Admin GET/PATCH через admin router)
api_router.include_router(reports_router.router, prefix="/reports", tags=["Reports"])

# 9.5 Аналитика (Публичные POST-запросы для отслеживания)
api_router.include_router(analytics_router.router, prefix="/analytics", tags=["Analytics"])

# 10. Объявления и Комментарии
api_router.include_router(announcements_router.router, prefix="/announcements", tags=["Announcements"])
api_router.include_router(comments_router.router, prefix="/comments", tags=["Comments"])
api_router.include_router(watchlist_router.router, prefix="/watchlist", tags=["Watchlist"])
api_router.include_router(playlists_router.router, prefix="/playlists", tags=["Playlists"])

# 10.5 Аналитика Data Science (Админка)
api_router.include_router(analytics_ds_router.router, prefix="/admin/analytics_ds", tags=["Analytics DS"], dependencies=[Depends(require_admin)])
api_router.include_router(recommendations_router.router, prefix="/admin/recommendations", tags=["Recommendation Engine"], dependencies=[Depends(require_admin)])

# 11. Админ-панель
# Одна проверка на весь роутер: обычный зритель получит 404 на ЛЮБОМ /admin/*,
# даже если в новом хендлере забудут Depends. Хендлеры дополнительно требуют
# admin или конкретное право (require_permission).
api_router.include_router(admin_router.router, prefix="/admin", tags=["Admin"], dependencies=[Depends(require_staff)])
# WebSocket админ-ленты: авторизация по WS-билету внутри хендлера.
api_router.include_router(live_router.admin_ws_router, prefix="/admin", tags=["WebSockets"])

# 12. Загрузка файлов
api_router.include_router(upload_router.router, prefix="/upload", tags=["Upload"])

# 13. WebSocket (Живые данные)
api_router.include_router(live_router.router, prefix="/ws/live", tags=["WebSockets"])

# 14. Уведомления
api_router.include_router(notifications_router.router, prefix="/notifications", tags=["Notifications"])

# 15. WebSocket уведомления
from app.modules.notifications import ws_router as notifications_ws_router
api_router.include_router(notifications_ws_router.router, prefix="/ws", tags=["WebSockets"])

# 16. Task Status (Celery)
from app.modules.studio import task_status_router
api_router.include_router(task_status_router.router, prefix="/tasks", tags=["Tasks"])
