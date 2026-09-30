import sys
import os
import asyncio
from sqlalchemy.future import select
from sqlalchemy import text

# Магия путей
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), ".")))

from app.core.database import AsyncSessionLocal, engine, Base
from app.modules.anime import models
from app.modules.user.models import User 

# --- DATA ---

NEWS_ITEMS = [
    {"video_id": "F6Pm8RPzwmQ", "title": "New Release 1", "image": "https://img.youtube.com/vi/F6Pm8RPzwmQ/maxresdefault.jpg"},
    {"video_id": "dee-9ogDSD4", "title": "New Release 2", "image": "https://img.youtube.com/vi/dee-9ogDSD4/maxresdefault.jpg"}
]

BLOG_POSTS = [
    {"title": "WHERE TO DOWNLOAD", "image": "/blog1.jpg", "color": "text-red-600", "link": "/blog/1"},
    {"title": "HOW TO MAKE MONEY", "image": "/blog2.jpg", "color": "text-green-500", "link": "/blog/2"}
]

POPULAR_ANIME = [
    {"title": "CHAINSAW MAN", "image": "/chainsaw.jpg", "h_char": "W", "a_color": "text-red-600", "section": "popular", "rating": 9.5},
    {"title": "BLEACH: TYBW", "image": "/bleach.jpg", "h_char": "B", "a_color": "text-red-600", "section": "popular", "rating": 9.8},
    {"title": "ATTACK ON TITAN", "image": "/aot.jpg", "h_char": "O", "a_color": "text-green-500", "section": "popular", "rating": 9.9},
    {"title": "BLUE LOCK", "image": "/bluelock.jpg", "h_char": "L", "a_color": "text-blue-500", "section": "popular", "rating": 9.2},
    {"title": "JUJUTSU KAISEN", "image": "/jjk.jpg", "h_char": "K", "a_color": "text-purple-500", "section": "popular", "rating": 9.7},
    {"title": "ONE PIECE", "image": "/onepiece.jpg", "h_char": "E", "a_color": "text-yellow-500", "section": "popular", "rating": 9.9},
    {"title": "VINLAND SAGA", "image": "/vinland.jpg", "h_char": "V", "a_color": "text-orange-500", "section": "popular", "rating": 9.4},
    {"title": "CYBERPUNK", "image": "/cyberpunk.jpg", "h_char": "Y", "a_color": "text-cyan-400", "section": "popular", "rating": 9.0},
]

RECENT_ANIME = [
    {"title": "SOLO LEVELING", "image": "https://images8.alphacoders.com/134/1346387.jpeg", "h_char": "V", "a_color": "text-cyan-400", "section": "recent", "rating": 9.6},
    {"title": "NINJA KAMUI", "image": "https://images3.alphacoders.com/135/1351239.jpeg", "h_char": "K", "a_color": "text-red-600", "section": "recent", "rating": 8.8},
    {"title": "MASHLE: MAGIC AND MUSCLES", "image": "https://images5.alphacoders.com/131/1310935.jpg", "h_char": "D", "a_color": "text-yellow-400", "section": "recent", "rating": 8.5},
    {"title": "FATE/GRAND ORDER", "image": "https://images.alphacoders.com/116/1165438.jpg", "h_char": "T", "a_color": "text-green-500", "section": "recent", "rating": 9.0},
    {"title": "KAIJU NO. 8", "image": "/kaijo_no8.jpg", "h_char": "U", "a_color": "text-green-400", "section": "recent", "rating": 8.9},
    {"title": "DEMON SLAYER", "image": "https://images7.alphacoders.com/131/1316688.jpeg", "h_char": "S", "a_color": "text-orange-500", "section": "recent", "rating": 9.5},
    {"title": "THE WITCH AND THE BEAST", "image": "/the_witch_and_the_beat.jpg", "h_char": "A", "a_color": "text-yellow-600", "section": "recent", "rating": 8.2},
    {"title": "TAKT OP. DESTINY", "image": "/take_op_destiny.jpg", "h_char": "D", "a_color": "text-red-500", "section": "recent", "rating": 8.4},
    {"title": "UNDEAD UNLUCK", "image": "https://images5.alphacoders.com/133/1330960.jpeg", "h_char": "L", "a_color": "text-red-500", "section": "recent", "rating": 8.7},
    {"title": "FRIEREN: BEYOND JOURNEY'S END", "image": "/friren_beyond_journey.jpg", "h_char": "E", "a_color": "text-teal-400", "section": "recent", "rating": 9.8},
    {"title": "SHANGRI-LA FRONTIER", "image": "https://images3.alphacoders.com/133/1334568.jpeg", "h_char": "F", "a_color": "text-blue-500", "section": "recent", "rating": 8.6},
    {"title": "OSHI NO KO", "image": "https://images3.alphacoders.com/131/1319760.jpeg", "h_char": "O", "a_color": "text-pink-500", "section": "recent", "rating": 9.3},
    {"title": "HELL'S PARADISE", "image": "https://images5.alphacoders.com/131/1312260.jpeg", "h_char": "P", "a_color": "text-green-600", "section": "recent", "rating": 8.9},
    {"title": "ZOM 100", "image": "https://images3.alphacoders.com/132/1321173.jpeg", "h_char": "Z", "a_color": "text-yellow-300", "section": "recent", "rating": 8.5},
]

SERIES_ANIME = [
  { "title": "SERAPH OF THE END", "image": "https://images3.alphacoders.com/653/653457.jpg", "h_char": "O", "a_color": "text-green-500", "section": "series" },
  { "title": "RUROUNI KENSHIN", "image": "https://images8.alphacoders.com/132/1321743.jpeg", "section": "series" },
  { "title": "NIER:AUTOMATA VER1.1A", "image": "https://images3.alphacoders.com/134/1346389.jpeg", "section": "series" },
  { "title": "HELL'S PARADISE", "image": "https://images5.alphacoders.com/131/1312260.jpeg", "section": "series" },
  { "title": "ZOM 100: BUCKET LIST OF THE DEAD", "image": "https://images3.alphacoders.com/132/1321173.jpeg", "h_char": "O", "a_color": "text-cyan-400", "section": "series" },
  { "title": "HEAVENLY DELUSION", "image": "https://images3.alphacoders.com/131/1315848.jpeg", "section": "series" },
  { "title": "BOCCHI THE ROCK!", "image": "https://images3.alphacoders.com/129/1292070.jpg", "h_char": "H", "a_color": "text-pink-500", "section": "series" },
  { "title": "CHARLOTTE", "image": "https://images4.alphacoders.com/606/606667.jpg", "section": "series" },
  { "title": "DEATH PARADE", "image": "https://images3.alphacoders.com/584/584282.jpg", "section": "series" },
  { "title": "SOUND! EUPHONIUM", "image": "https://images3.alphacoders.com/593/593798.jpg", "section": "series" },
  { "title": "THE GREATEST DEMON LORD IS REBORN", "image": "https://images.alphacoders.com/123/1231804.jpg", "h_char": "O", "a_color": "text-red-500", "section": "series" },
  { "title": "WONDER EGG PRIORITY", "image": "https://images3.alphacoders.com/112/1127027.jpg", "section": "series" },
]

MOVIES_ANIME = [
  { "title": "SUZUME", "image": "https://images5.alphacoders.com/131/1312046.jpg", "section": "movies" },
  { "title": "DRAGON BALL SUPER: SUPER HERO", "image": "https://images8.alphacoders.com/124/1244026.jpg", "section": "movies" },
  { "title": "DRAGON BALL Z: RESURRECTION 'F'", "image": "https://images6.alphacoders.com/606/606667.jpg", "section": "movies" },
  { "title": "THE GARDEN OF WORDS", "image": "https://images3.alphacoders.com/246/246736.jpg", "h_char": "N", "a_color": "text-green-500", "section": "movies" },
  { "title": "A SILENT VOICE", "image": "https://images4.alphacoders.com/839/839722.jpg", "section": "movies" },
  { "title": "CHILDREN OF THE SEA", "image": "https://images.alphacoders.com/102/1026943.jpg", "h_char": "O", "a_color": "text-yellow-500", "section": "movies" },
  { "title": "WEATHERING WITH YOU", "image": "https://images2.alphacoders.com/100/1004344.jpg", "section": "movies" },
  { "title": "YOUR NAME", "image": "https://images.alphacoders.com/722/722020.jpg", "section": "movies" },
  { "title": "I WANT TO EAT YOUR PANCREAS", "image": "https://images4.alphacoders.com/936/936662.png", "section": "movies" },
]

EARLY_ACCESS_ANIME = [
  { "title": "VIRAL HIT", "image": "https://images5.alphacoders.com/135/1351586.jpeg", "h_char": "L", "a_color": "text-red-600", "section": "early_access" },
  { "title": "ANGEL'S EGG", "image": "https://images.alphacoders.com/593/593450.jpg", "section": "early_access" },
  { "title": "KATSUGEKI/TOUKEN RANBU", "image": "https://images3.alphacoders.com/854/854378.jpg", "h_char": "U", "a_color": "text-blue-400", "section": "early_access" },
  { "title": "DANMACHI: ARROW OF ORION", "image": "https://images2.alphacoders.com/985/985558.jpg", "section": "early_access" },
]

COMING_SOON_ANIME = [
  { "title": "ARCANE SEASON 2", "image": "https://images.alphacoders.com/133/1330727.jpeg", "h_char": "A", "a_color": "text-blue-500", "section": "coming_soon" },
  { "title": "SAKAMOTO DAYS", "image": "https://images.alphacoders.com/134/1344446.png", "h_char": "A", "a_color": "text-red-500", "section": "coming_soon" },
  { "title": "SOLO LEVELING SEASON 2", "image": "https://images8.alphacoders.com/134/1346387.jpeg", "h_char": "L", "a_color": "text-blue-400", "section": "coming_soon" },
  { "title": "VIRGIN PUNK", "image": "https://images.alphacoders.com/135/1352456.jpeg", "h_char": "V", "a_color": "text-pink-500", "section": "coming_soon" },
  { "title": "RUROUNI KENSHIN SEASON 2", "image": "https://images8.alphacoders.com/132/1321743.jpeg", "section": "coming_soon" },
  { "title": "RE:ZERO SEASON 3", "image": "https://images3.alphacoders.com/132/1328456.png", "section": "coming_soon" },
  { "title": "BLUE EXORCIST SEASON 4", "image": "https://images5.alphacoders.com/133/1337466.png", "section": "coming_soon" },
  { "title": "DANMACHI SEASON 5", "image": "https://images.alphacoders.com/105/1056569.jpg", "h_char": "M", "a_color": "text-blue-500", "section": "coming_soon" },
  { "title": "NEGAPOSI ANGLER", "image": "https://images.alphacoders.com/134/1348393.jpeg", "section": "coming_soon" },
  { "title": "RASCAL DOES NOT DREAM...", "image": "https://images4.alphacoders.com/133/1335345.jpeg", "section": "coming_soon" },
  { "title": "CHAINSAW MAN: REZE ARC", "image": "https://images.alphacoders.com/128/1286053.jpg", "h_char": "Z", "a_color": "text-red-600", "section": "coming_soon" },
  { "title": "PLUTO", "image": "https://images3.alphacoders.com/133/1334568.jpeg", "h_char": "L", "a_color": "text-green-500", "section": "coming_soon" },
]

ACTIVE_PACKS_ANIME = [
  { "title": "NARUTO SHIPPUDEN", "image": "https://images.alphacoders.com/605/605592.jpg", "section": "active_packs" },
  { "title": "BLACK CLOVER", "image": "https://images.alphacoders.com/877/877477.jpg", "section": "active_packs" },
  { "title": "DRAGON BALL SUPER", "image": "https://images.alphacoders.com/669/669177.jpg", "section": "active_packs" },
  { "title": "HUNTER X HUNTER", "image": "https://images.alphacoders.com/229/229068.jpg", "section": "active_packs" },
  { "title": "FAIRY TAIL", "image": "https://images.alphacoders.com/694/694939.jpg", "section": "active_packs" },
  { "title": "FIRE FORCE", "image": "https://images5.alphacoders.com/110/1107050.jpg", "section": "active_packs" },
]

async def seed_db():
    print("⏳ Начинаю наполнение базы данных...")
    
    # Создаем таблицы если их нет
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        try:
            # Очистка
            print("Cleaning old data...")
            await db.execute(models.Clip.__table__.delete())
            await db.execute(models.Anime.__table__.delete())
            await db.execute(models.News.__table__.delete())
            await db.execute(models.BlogPost.__table__.delete())
            await db.commit()
            
            # --- SEED ANIME ---
            all_anime = POPULAR_ANIME + RECENT_ANIME + SERIES_ANIME + MOVIES_ANIME + EARLY_ACCESS_ANIME + COMING_SOON_ANIME + ACTIVE_PACKS_ANIME
            
            seen_slugs = set()
            import re

            def make_slug(text):
                slug = text.lower().strip()
                slug = re.sub(r'[^\w\s-]', '', slug)
                slug = re.sub(r'[\s_-]+', '-', slug)
                return slug

            for item in all_anime:
                base_slug = make_slug(item["title"])
                slug = base_slug
                counter = 1
                while slug in seen_slugs:
                    counter += 1
                    slug = f"{base_slug}-{counter}"
                seen_slugs.add(slug)

                anime = models.Anime(
                    title=item["title"],
                    slug=slug,  # Explicitly set unique slug
                    image=item["image"],
                    highlight_char=item.get("h_char"),
                    accent_color=item.get("a_color"),
                    section=item["section"],
                    rating=item.get("rating", 0.0)
                )
                db.add(anime)
            
            # --- SEED NEWS ---
            for item in NEWS_ITEMS:
                news = models.News(
                    video_id=item["video_id"],
                    title=item["title"],
                    image=item["image"]
                )
                db.add(news)

            # --- SEED BLOG ---
            for item in BLOG_POSTS:
                blog = models.BlogPost(
                    title=item["title"],
                    image=item["image"],
                    color=item["color"],
                    link=item["link"]
                )
                db.add(blog)

            await db.commit()
            print(f"✅ Успех! Добавлено {len(all_anime)} аниме, {len(NEWS_ITEMS)} новостей, {len(BLOG_POSTS)} постов.")
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            await db.rollback()
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(seed_db())