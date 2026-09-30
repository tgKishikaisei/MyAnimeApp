from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.api.deps import get_current_active_superuser
from app.modules.anime.models import Anime
from app.modules.analytics.models import VideoPlaybackSession
from app.modules.user.models import User
from app.core.bi_engine import build_bi_query, BIQueryRequest

router = APIRouter()

@router.get("/funnels/{anime_id}")
async def get_anime_funnel(
    anime_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Calculate Audience Retention Funnel for a specific Anime.
    How many users started Episode 1? How many made it to Episode 2? etc.
    """
    # Verify anime exists
    anime = await db.get(Anime, anime_id)
    if not anime:
        raise HTTPException(status_code=404, detail="Anime not found")

    # Group by episode_number, count the number of UNIQUE users who watched it.
    # Note: If a user isn't logged in, they might not have a user_id, 
    # but we'll try to count by session ID or just IP if anonymous tracking was full.
    # For now, we'll count total distinct users (ignoring nulls) or just raw views as a proxy.
    
    query = (
        select(
            VideoPlaybackSession.episode_number,
            func.count(func.distinct(VideoPlaybackSession.user_id)).label("unique_viewers"),
            func.count(VideoPlaybackSession.id).label("total_views"),
            func.sum(VideoPlaybackSession.bandwidth_mb).label("total_bandwidth_mb")
        )
        .where(VideoPlaybackSession.anime_id == anime_id)
        .group_by(VideoPlaybackSession.episode_number)
        .order_by(VideoPlaybackSession.episode_number)
    )
    
    result = await db.execute(query)
    rows = result.all()
    
    if not rows:
        return {"anime_id": anime_id, "anime_title": anime.title, "funnel": []}
        
    # Calculate retention relative to Episode 1
    # Find base viewers (Episode 1, or the earliest episode available)
    base_viewers = rows[0].unique_viewers if rows[0].unique_viewers > 0 else rows[0].total_views
    if base_viewers == 0:
        base_viewers = 1 # Prevent division by zero if it's all anonymous / zero views
        
    funnel_data = []
    for row in rows:
        viewers = row.unique_viewers if row.unique_viewers > 0 else row.total_views
        retention_pct = round((viewers / base_viewers) * 100, 2)
        
        funnel_data.append({
            "episode": row.episode_number,
            "unique_viewers": row.unique_viewers,
            "total_views": row.total_views,
            "bandwidth_mb": round(row.total_bandwidth_mb or 0, 2),
            "retention_pct": min(retention_pct, 100.0) # Cap at 100% in case someone skips ep1
        })
        
    return {
        "anime_id": anime_id,
        "anime_title": anime.title,
        "total_episodes_tracked": len(funnel_data),
        "funnel": funnel_data
    }


@router.get("/cohorts")
async def get_retention_cohorts(
    days: int = Query(30, description="How many days back to generate cohorts for"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Generate User Retention Cohort Matrix.
    e.g. Users who registered on week X: what % returned in Week 1, Week 2, Week 3?
    """
    
    # In a real heavy-duty system, this would be a materialized view or complex raw SQL.
    # We will compute it using SQLAlchemy raw text for maximum Postgres performance
    
    raw_sql = text("""
        WITH user_cohorts AS (
            SELECT 
                id AS user_id, 
                DATE_TRUNC('week', created_at) AS cohort_week
            FROM users
            WHERE created_at >= CURRENT_DATE - CAST(:days AS INTERVAL)
        ),
        user_activity AS (
            SELECT 
                user_id,
                DATE_TRUNC('week', login_at) AS activity_week
            FROM user_sessions
            WHERE login_at >= CURRENT_DATE - CAST(:days AS INTERVAL)
            GROUP BY user_id, DATE_TRUNC('week', login_at)
        ),
        cohort_sizes AS (
            SELECT 
                cohort_week, 
                COUNT(user_id) AS total_users
            FROM user_cohorts
            GROUP BY cohort_week
        ),
        retention AS (
            SELECT 
                c.cohort_week,
                a.activity_week,
                COUNT(DISTINCT c.user_id) AS active_users
            FROM user_cohorts c
            LEFT JOIN user_activity a ON c.user_id = a.user_id 
                AND a.activity_week >= c.cohort_week
            GROUP BY c.cohort_week, a.activity_week
        )
        
        SELECT 
            TO_CHAR(r.cohort_week, 'YYYY-MM-DD') as cohort_date,
            s.total_users,
            FLOOR(EXTRACT(EPOCH FROM (r.activity_week - r.cohort_week)) / 604800) AS week_offset,
            r.active_users,
            ROUND((r.active_users::numeric / NULLIF(s.total_users, 0)) * 100, 2) AS retention_pct
        FROM retention r
        JOIN cohort_sizes s ON r.cohort_week = s.cohort_week
        ORDER BY r.cohort_week DESC, week_offset ASC;
    """)
    
    # Format Postgres intervals correctly
    interval_str = f"{days} days"
    
    try:
        result = await db.execute(raw_sql, {"days": interval_str})
        rows = result.fetchall()
        
        # Restructure into a matrix friendly for the frontend
        # { "2026-03-01": { total: 100, weeks: { 0: 100, 1: 45, 2: 30 } } }
        cohort_matrix = {}
        for row in rows:
            cohort_date = row.cohort_date
            if cohort_date not in cohort_matrix:
                cohort_matrix[cohort_date] = {
                    "cohort_date": cohort_date,
                    "total_users": row.total_users,
                    "retention_by_week": []
                }
                
            if row.week_offset is not None and row.week_offset >= 0:
                # Ensure array is large enough
                while len(cohort_matrix[cohort_date]["retention_by_week"]) <= row.week_offset:
                    cohort_matrix[cohort_date]["retention_by_week"].append(0)
                    
                cohort_matrix[cohort_date]["retention_by_week"][int(row.week_offset)] = float(row.retention_pct)
                
        # Convert dictionary to a sorted list
        return {
            "period_days": days,
            "cohorts": list(cohort_matrix.values())
        }
    except Exception as e:
        import logging
        logging.error(f"Cohort generation failed: {str(e)}")
        # Return empty on failure (e.g., if SQLite is used locally instead of Postgres)
        return {"period_days": days, "cohorts": [], "error": str(e)}

@router.post("/explorer")
async def build_and_run_explorer_query(
    request: BIQueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_superuser)
):
    """
    Executes a custom built Data Science / BI query safely using the backend SQL compiler.
    """
    try:
        sql_string, params = build_bi_query(request)
        
        # Execute securely
        result = await db.execute(text(sql_string), params)
        rows = result.fetchall()
        
        # Extract column names from the CursorResult
        keys = result.keys()
        
        # Convert to a list of dicts for JSON serialization
        json_rows = [dict(zip(keys, row)) for row in rows]
        
        return {
            "status": "success",
            "query_info": {
                "dimensions_used": request.dimensions,
                "metrics_used": request.metrics,
                "row_count": len(json_rows)
            },
            "data": json_rows
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
