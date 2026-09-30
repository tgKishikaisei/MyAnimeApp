import asyncio
from app.core.database import AsyncSessionLocal
from app.modules.anime.models import Anime, News, BlogPost
from sqlalchemy import select, func

async def check_data():
    async with AsyncSessionLocal() as db:
        anime_count = await db.scalar(select(func.count()).select_from(Anime))
        news_count = await db.scalar(select(func.count()).select_from(News))
        blog_count = await db.scalar(select(func.count()).select_from(BlogPost))
        
        print(f"Anime count: {anime_count}")
        print(f"News count: {news_count}")
        print(f"Blog count: {blog_count}")

if __name__ == "__main__":
    asyncio.run(check_data())
