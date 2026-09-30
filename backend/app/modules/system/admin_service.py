from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text
from typing import Dict, Any

from app.modules.user.models import User
from app.modules.anime.models import Anime, Clip, News, BlogPost
from app.modules.audit.models import AuditLog
from app.core.config import settings

import shutil
import logging
from redis import asyncio as aioredis

logger = logging.getLogger(__name__)

class AdminDashboardService:
    @staticmethod
    async def get_dashboard_stats(db: AsyncSession) -> Dict[str, Any]:
        stats = {
            "users": 0,
            "anime": 0,
            "clips": 0,
            "news": 0,
            "blog": 0,
            "system": {
                "postgres": "offline",
                "redis": "offline"
            },
            "storage": {
                "total_gb": 0,
                "used_gb": 0,
                "free_gb": 0,
                "percent": 0
            },
            "recent_users": [],
            "top_clips": [],
            "recent_logs": []
        }

        # 1. Counts and Recents
        try:
            stats["users"] = await db.scalar(select(func.count()).select_from(User)) or 0
            stats["anime"] = await db.scalar(select(func.count()).select_from(Anime)) or 0
            stats["clips"] = await db.scalar(select(func.count()).select_from(Clip)) or 0
            stats["news"] = await db.scalar(select(func.count()).select_from(News)) or 0
            stats["blog"] = await db.scalar(select(func.count()).select_from(BlogPost)) or 0

            # Last 5 users
            recent_users_q = await db.execute(select(User).order_by(desc(User.created_at)).limit(5))
            stats["recent_users"] = [{"id": u.id, "username": u.username, "email": u.email, "created_at": u.created_at, "avatar_url": u.avatar_url} for u in recent_users_q.scalars().all()]

            # Top 5 clips
            top_clips_q = await db.execute(select(Clip).order_by(desc(Clip.views)).limit(5))
            stats["top_clips"] = [{"id": c.id, "title": c.title, "views": c.views, "thumbnail": c.thumbnail_path} for c in top_clips_q.scalars().all()]

            # Last 5 logs
            logs_q = await db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(5))
            stats["recent_logs"] = [{"id": l.id, "user_id": l.user_id, "action": l.action, "target": l.target, "created_at": l.created_at} for l in logs_q.scalars().all()]

        except Exception as e:
            logger.error(f"Failed to fetch DB stats: {e}")

        # 2. Postgres Health
        try:
            await db.execute(text("SELECT 1"))
            stats["system"]["postgres"] = "online"
        except Exception as e:
            logger.error(f"Postgres health check failed: {e}")

        # 3. Redis Health
        if settings.REDIS_URL:
            try:
                redis = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
                ping_res = await redis.ping()
                if ping_res:
                    stats["system"]["redis"] = "online"
                await redis.close()
            except Exception as e:
                logger.error(f"Redis health check failed: {e}")
                
        # 4. Storage 
        try:
            total, used, free = shutil.disk_usage("/")
            gb = 2**30
            stats["storage"] = {
                "total_gb": round(total / gb, 2),
                "used_gb": round(used / gb, 2),
                "free_gb": round(free / gb, 2),
                "percent": round((used / total) * 100, 1)
            }
        except Exception as e:
            logger.error(f"Failed to get storage stats: {e}")
        
        return stats

admin_dashboard_service = AdminDashboardService()
