"""Check what's in the database for series section"""
import asyncio
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.modules.anime import models

async def check_db():
    print("=" * 60)
    print("Checking Database - Series Section")
    print("=" * 60)
    
    async with AsyncSessionLocal() as db:
        # Get all anime in 'series' section
        stmt = select(models.Anime).where(models.Anime.section == "series")
        result = await db.execute(stmt)
        animes = result.scalars().all()
        
        print(f"\nFound {len(animes)} anime in 'series' section:\n")
        
        for anime in animes:
            print(f"ID: {anime.id}")
            print(f"Title: {anime.title}")
            print(f"Image: {anime.image}")
            print(f"Section: {anime.section}")
            print("-" * 40)
    
    await AsyncSessionLocal().close()
    print("\n" + "=" * 60)

if __name__ == "__main__":
    asyncio.run(check_db())
