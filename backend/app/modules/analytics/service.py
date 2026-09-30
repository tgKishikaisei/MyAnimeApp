from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, text, cast, Float, Integer
from datetime import date, timedelta
from typing import Dict, Any
import logging

from app.modules.user.models import User
from app.modules.anime.models import Anime
from app.modules.comments.models import Comment
from app.modules.reports.models import Report, ReportStatus
from app.modules.analytics.models import DailyAnalytics, UserSession, SearchQueryLog, VideoPlaybackSession, ApiRequestLog

logger = logging.getLogger(__name__)

class AnalyticsService:
    @staticmethod
    async def get_full_analytics(db: AsyncSession, days: int = 30) -> Dict[str, Any]:
        start_date = date.today() - timedelta(days=days)
        
        # Base chart data
        query = (
            select(
                DailyAnalytics.date,
                func.sum(DailyAnalytics.views).label('views'),
                func.sum(DailyAnalytics.unique_visitors).label('visitors')
            )
            .where(DailyAnalytics.date >= start_date)
            .group_by(DailyAnalytics.date)
            .order_by(DailyAnalytics.date)
        )
        result = await db.execute(query)
        rows = result.all()
        
        chart_data = [
            {"date": row.date.strftime("%b %d"), "views": row.views or 0, "visitors": row.visitors or 0} for row in rows
        ]
        total_views = sum(r["views"] for r in chart_data)
        total_visitors = sum(r["visitors"] for r in chart_data)
        
        # Audience Analytics
        audience_data = {"device_split": [], "heatmap": [], "retention": {}}
        try:
            device_query = select(UserSession.device_type, func.count(UserSession.id)).where(UserSession.login_at >= start_date).group_by(UserSession.device_type)
            device_result = await db.execute(device_query)
            audience_data["device_split"] = [{"name": dt or "Unknown", "value": count} for dt, count in device_result.all()]
            
            heatmap_query = select(func.extract('isodow', UserSession.login_at).label("day"), func.extract('hour', UserSession.login_at).label("hour"), func.count(UserSession.id).label("count")).where(UserSession.login_at >= start_date).group_by("day", "hour")
            heatmap_result = await db.execute(heatmap_query)
            audience_data["heatmap"] = [{"day": int(r.day), "hour": int(r.hour), "value": r.count} for r in heatmap_result.all()]

            returning_query = select(func.count(func.distinct(UserSession.user_id))).join(User, UserSession.user_id == User.id).where(UserSession.login_at >= start_date).where(User.created_at < start_date)
            new_query = select(func.count(func.distinct(UserSession.user_id))).join(User, UserSession.user_id == User.id).where(UserSession.login_at >= start_date).where(User.created_at >= start_date)
            
            returning_count = await db.scalar(returning_query) or 0
            new_count = await db.scalar(new_query) or 0
            audience_data["retention"] = {
                "returning_users": returning_count, "new_users": new_count, 
                "retention_rate": round(returning_count / (returning_count + new_count) * 100, 1) if (returning_count + new_count) > 0 else 0
            }
        except Exception as e:
            logger.error(f"Failed to fetch audience analytics: {e}")
            
        # Content Metrics
        content_data = {"drop_rates": [], "empty_searches": [], "hype_tracker": []}
        try:
            empty_res = await db.execute(select(SearchQueryLog.query_string, func.count(SearchQueryLog.id).label("count")).where(SearchQueryLog.results_count == 0).where(SearchQueryLog.created_at >= start_date).group_by(SearchQueryLog.query_string).order_by(desc("count")).limit(5))
            content_data["empty_searches"] = [{"query": r.query_string, "count": r.count} for r in empty_res.all()]
            
            hype_res = await db.execute(select(Anime.title, func.count(Comment.id).label("comments_count")).join(Comment, (Comment.target_id == Anime.id) & (Comment.target_type == "anime")).where(Comment.created_at >= start_date).group_by(Anime.id, Anime.title).order_by(desc("comments_count")).limit(5))
            content_data["hype_tracker"] = [{"title": r.title, "comments": r.comments_count} for r in hype_res.all()]
            
            drop_res = await db.execute(select(Anime.title, func.count(VideoPlaybackSession.id).label("drops")).join(VideoPlaybackSession, VideoPlaybackSession.anime_id == Anime.id).where(VideoPlaybackSession.completed == False).where((cast(VideoPlaybackSession.duration_watched, Float) / func.nullif(cast(VideoPlaybackSession.total_duration, Float), 0)) < 0.3).where(VideoPlaybackSession.created_at >= start_date).group_by(Anime.id, Anime.title).order_by(desc("drops")).limit(5))
            content_data["drop_rates"] = [{"title": r.title, "drops": r.drops} for r in drop_res.all()]
        except Exception as e:
            logger.error(f"Failed to fetch content analytics: {e}")
            
        # Trust & Safety
        trust_data = {"avg_toxicity": 0.0, "spam_block_rate": 0.0, "avg_resolution_hours": 0.0, "repeat_offenders": []}
        try:
            tox_row = (await db.execute(select(func.avg(Comment.toxicity_score).label("avg_tox"), func.count(Comment.id).label("total_comments"), func.sum(cast(Comment.is_spam, Integer)).label("spam_count")).where(Comment.created_at >= start_date))).first()
            if tox_row and tox_row.total_comments and tox_row.total_comments > 0:
                trust_data["avg_toxicity"] = round(tox_row.avg_tox or 0, 2)
                trust_data["spam_block_rate"] = round((tox_row.spam_count / tox_row.total_comments) * 100, 1)

            time_scalar = (await db.execute(select(func.avg(func.extract('epoch', Report.resolved_at - Report.created_at)).label("avg_seconds")).where(Report.status.in_([ReportStatus.RESOLVED.value, ReportStatus.DISMISSED.value])).where(Report.resolved_at >= start_date))).scalar()
            if time_scalar:
                trust_data["avg_resolution_hours"] = round(time_scalar / 3600, 1)

            offenders_res = await db.execute(select(User.username, func.count(Report.id).label("report_count")).join(Comment, (Report.target_type == "comment") & (Report.target_id == Comment.id)).join(User, Comment.user_id == User.id).where(Report.created_at >= start_date).group_by(User.id, User.username).order_by(desc("report_count")).limit(5))
            trust_data["repeat_offenders"] = [{"username": r.username, "reports": r.report_count} for r in offenders_res.all()]
        except Exception as e:
            logger.error(f"Failed to fetch trust analytics: {e}")
            
        # Server Data
        server_data = {"slowest_endpoints": [], "error_rates": {"4xx": 0, "5xx": 0, "ok": 0}, "storage_mb": [], "redis_metrics": {"hit_rate": 0.0, "used_memory_mb": 0.0}}
        try:
            slow_res = await db.execute(select(ApiRequestLog.endpoint, func.avg(ApiRequestLog.response_time_ms).label("avg_time")).where(ApiRequestLog.created_at >= start_date).group_by(ApiRequestLog.endpoint).order_by(desc("avg_time")).limit(5))
            server_data["slowest_endpoints"] = [{"endpoint": r.endpoint, "avg_time_ms": round(r.avg_time, 1)} for r in slow_res.all()]
            
            logs_res = await db.execute(select(ApiRequestLog.status_code, func.count(ApiRequestLog.id)).where(ApiRequestLog.created_at >= start_date).group_by(ApiRequestLog.status_code))
            ok_count, err4xx, err5xx = 0, 0, 0
            for status_code, count in logs_res.all():
                if status_code >= 500: err5xx += count
                elif status_code >= 400: err4xx += count
                else: ok_count += count
            server_data["error_rates"] = {"4xx": err4xx, "5xx": err5xx, "ok": ok_count}
            
            try:
                storage_res = await db.execute(text("SELECT relname AS table_name, pg_total_relation_size(C.oid) / 1024 / 1024 AS size_mb FROM pg_class C LEFT JOIN pg_namespace N ON (N.oid = C.relnamespace) WHERE nspname NOT IN ('pg_catalog', 'information_schema') AND C.relkind <> 'i' AND nspname !~ '^pg_toast' ORDER BY pg_total_relation_size(C.oid) DESC LIMIT 5;"))
                server_data["storage_mb"] = [{"table": r.table_name, "size_mb": round(float(r.size_mb), 2)} for r in storage_res.all()]
            except Exception as pg_err:
                pass
                
            try:
                from redis import asyncio as aioredis
                from app.core.config import settings
                redis_client = aioredis.from_url(settings.REDIS_URL, encoding="utf8", decode_responses=True)
                stats_info = await redis_client.info("stats")
                memory_info = await redis_client.info("memory")
                await redis_client.close()
                hits = int(stats_info.get("keyspace_hits", 0))
                misses = int(stats_info.get("keyspace_misses", 0))
                total_requests = hits + misses
                hit_rate = (hits / total_requests * 100) if total_requests > 0 else 0.0
                used_memory_bytes = int(memory_info.get("used_memory", 0))
                server_data["redis_metrics"] = {"hit_rate": round(hit_rate, 1), "used_memory_mb": round(used_memory_bytes / 1024 / 1024, 2)}
            except Exception as redis_err:
                pass
        except Exception as e:
            logger.error(f"Failed to fetch server analytics: {e}")
            
        # Economics Data
        economics_data = {"seo_score": 100, "adblock_rate": 0.0, "seo_warnings": []}
        try:
            adblock_row = (await db.execute(select(func.sum(DailyAnalytics.adblock_detected_count).label("total_adblock"), func.sum(DailyAnalytics.unique_visitors).label("total_visitors")).where(DailyAnalytics.date >= start_date, DailyAnalytics.target_type == "site_visit"))).first()
            if adblock_row and adblock_row.total_visitors and adblock_row.total_visitors > 0:
                economics_data["adblock_rate"] = round((int(adblock_row.total_adblock or 0) / adblock_row.total_visitors) * 100, 1)

            anime_row = (await db.execute(select(func.count(Anime.id).label("total_anime"), func.sum(cast(Anime.description == None, Integer)).label("missing_desc"), func.sum(cast(Anime.banner_image_url == None, Integer)).label("missing_banner")))).first()
            
            if anime_row and anime_row.total_anime and anime_row.total_anime > 0:
                total = anime_row.total_anime
                missing_desc = int(anime_row.missing_desc or 0)
                missing_banner = int(anime_row.missing_banner or 0)
                penalty = 0
                if missing_desc > 0:
                    penalty += (missing_desc / total) * 50
                    economics_data["seo_warnings"].append(f"{missing_desc} Anime are missing descriptions.")
                if missing_banner > 0:
                    penalty += (missing_banner / total) * 50
                    economics_data["seo_warnings"].append(f"{missing_banner} Anime are missing banner images.")
                    
                economics_data["seo_score"] = max(0, int(100 - penalty))
                if len(economics_data["seo_warnings"]) == 0:
                    economics_data["seo_warnings"].append("Catalog is fully optimized for SEO.")
        except Exception as e:
            logger.error(f"Failed to fetch economics analytics: {e}")

        return {
            "timeline": chart_data,
            "totals": {"views": total_views, "visitors": total_visitors},
            "audience": audience_data,
            "content": content_data,
            "trust": trust_data,
            "server": server_data,
            "economics": economics_data
        }

analytics_service = AnalyticsService()
