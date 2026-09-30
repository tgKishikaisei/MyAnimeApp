import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from sqlalchemy import text
from app.core.database import engine

async def migrate():
    async with engine.begin() as conn:
        # Add content column
        try:
            await conn.execute(text("ALTER TABLE blog_posts ADD COLUMN content TEXT"))
            print("✅ Added 'content' column to blog_posts")
        except Exception as e:
            print(f"ℹ️  content column: {e}")

        # Make image nullable (SQLite doesn't support DROP NOT NULL directly)
        # For SQLite we recreate, for PostgreSQL we ALTER
        try:
            await conn.execute(text("ALTER TABLE blog_posts ALTER COLUMN image DROP NOT NULL"))
            print("✅ Made 'image' column nullable")
        except Exception as e:
            print(f"ℹ️  image nullable: {e}")

asyncio.run(migrate())
print("Done.")
