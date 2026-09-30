import asyncio
import logging
from app.core.database import AsyncSessionLocal
from app.modules.anime import Anime, Clip, News, BlogPost, AnimeSection
from sqlalchemy import delete

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def seed_data():
    async with AsyncSessionLocal() as db:
        try:
            # 1. Clear existing data
            logger.info("Clearing existing data...")
            # Delete in order of dependencies: Clips -> Anime -> Tags, News, Blog
            await db.execute(delete(Clip))
            await db.execute(delete(Anime))
            await db.execute(delete(News))
            await db.execute(delete(BlogPost))
            await db.commit()
            
            # 2. News
            logger.info("Seeding News...")
            news_items = [
                News(video_id="F6Pm8RPzwmQ", title="News 1"),
                News(video_id="dee-9ogDSD4", title="News 2"),
            ]
            db.add_all(news_items)
            
            # 3. Blog Posts
            logger.info("Seeding Blog Posts...")
            blog_posts = [
                BlogPost(title="HOW TO CUT A CLIP IN THE STUDIO", image="/blog1.jpg", color="text-red-600", link="#"),
                BlogPost(title="BUILDING A PLAYLIST FOR YOUR EDIT", image="/blog2.jpg", color="text-green-500", link="#"),
            ]
            db.add_all(blog_posts)
            
            # 4. Anime - Helper function
            async def create_anime(title, image, section, highlight=None, color=None, rating=0.0):
                anime = Anime(
                    title=title,
                    image=image,
                    section=section,
                    highlight_char=highlight,
                    accent_color=color,
                    rating=rating
                )
                db.add(anime)
                return anime

            # --- MOST POPULAR ---
            logger.info("Seeding Popular Anime...")
            popular_data = [
                {"title": "CHAINSAW MAN", "image": "/chainsaw.jpg", "highlight": "W", "color": "text-red-600"},
                {"title": "BLEACH: TYBW", "image": "/bleach.jpg", "highlight": "B", "color": "text-red-600"},
                {"title": "ATTACK ON TITAN", "image": "/aot.jpg", "highlight": "O", "color": "text-green-500"},
                {"title": "BLUE LOCK", "image": "/bluelock.jpg", "highlight": "L", "color": "text-blue-500"},
                {"title": "JUJUTSU KAISEN", "image": "/jjk.jpg", "highlight": "K", "color": "text-purple-500"},
                {"title": "ONE PIECE", "image": "/onepiece.jpg", "highlight": "E", "color": "text-yellow-500"},
                {"title": "VINLAND SAGA", "image": "/vinland.jpg", "highlight": "V", "color": "text-orange-500"},
                {"title": "CYBERPUNK", "image": "/cyberpunk.jpg", "highlight": "Y", "color": "text-cyan-400"},
            ]
            for item in popular_data:
                await create_anime(item["title"], item["image"], AnimeSection.POPULAR, item.get("highlight"), item.get("color"))

            # --- RECENT ---
            logger.info("Seeding Recent Anime...")
            recent_data = [
                 { "title": "SOLO LEVELING", "image": "/solo_leveling.jpg", "highlight": "V", "color": "text-cyan-400" },
                 { "title": "NINJA KAMUI", "image": "/ninja_kamui.jpg", "highlight": "K", "color": "text-red-600" },
                 { "title": "MASHLE: MAGIC AND MUSCLES", "image": "/mashle_magic_and_muscles.jpg", "highlight": "D", "color": "text-yellow-400" },
                 { "title": "FATE/GRAND ORDER", "image": "/grand_order.jpg", "highlight": "T", "color": "text-green-500" },
                 { "title": "KAIJU NO. 8", "image": "/kaijo_no8.jpg", "highlight": "U", "color": "text-green-400" },
                 { "title": "DEMON SLAYER", "image": "https://images7.alphacoders.com/131/1316688.jpeg", "highlight": "S", "color": "text-orange-500" },
                 { "title": "THE WITCH AND THE BEAST", "image": "/the_witch_and_the_beat.jpg", "highlight": "A", "color": "text-yellow-600" },
                 { "title": "TAKT OP. DESTINY", "image": "/take_op_destiny.jpg", "highlight": "D", "color": "text-red-500" },
                 { "title": "UNDEAD UNLUCK", "image": "https://images5.alphacoders.com/133/1330960.jpeg", "highlight": "L", "color": "text-red-500" },
                 { "title": "FRIEREN: BEYOND JOURNEY'S END", "image": "/friren_beyond_journey.jpg", "highlight": "E", "color": "text-teal-400" },
                 { "title": "SHANGRI-LA FRONTIER", "image": "https://images3.alphacoders.com/133/1334568.jpeg", "highlight": "F", "color": "text-blue-500" },
                 { "title": "OSHI NO KO", "image": "https://images3.alphacoders.com/131/1319760.jpeg", "highlight": "O", "color": "text-pink-500" },
                 { "title": "HELL'S PARADISE", "image": "https://images5.alphacoders.com/131/1312260.jpeg", "highlight": "P", "color": "text-green-600" },
                 { "title": "ZOM 100", "image": "https://images3.alphacoders.com/132/1321173.jpeg", "highlight": "Z", "color": "text-yellow-300" },
            ]
            for item in recent_data:
                await create_anime(item["title"], item["image"], AnimeSection.RECENT, item.get("highlight"), item.get("color"))

            # --- SERIES ---
            logger.info("Seeding Series...")
            series_data = [
              { "title": "SERAPH OF THE END", "image": "https://images3.alphacoders.com/653/653457.jpg", "highlight_char": "O", "accent_color": "text-green-500" },
              { "title": "RUROUNI KENSHIN", "image": "https://images8.alphacoders.com/132/1321743.jpeg" },
              { "title": "NIER:AUTOMATA VER1.1A", "image": "https://images3.alphacoders.com/134/1346389.jpeg" },
              { "title": "HELL'S PARADISE", "image": "https://images5.alphacoders.com/131/1312260.jpeg" }, # Duplicate title, but different section
              { "title": "ZOM 100: BUCKET LIST OF THE DEAD", "image": "https://images3.alphacoders.com/132/1321173.jpeg", "highlight_char": "O", "accent_color": "text-cyan-400" },
              { "title": "HEAVENLY DELUSION", "image": "https://images3.alphacoders.com/131/1315848.jpeg" },
              { "title": "BOCCHI THE ROCK!", "image": "https://images3.alphacoders.com/129/1292070.jpg", "highlight_char": "H", "accent_color": "text-pink-500" },
              { "title": "CHARLOTTE", "image": "https://images4.alphacoders.com/606/606667.jpg" },
              { "title": "DEATH PARADE", "image": "https://images3.alphacoders.com/584/584282.jpg" },
              { "title": "SOUND! EUPHONIUM", "image": "https://images3.alphacoders.com/593/593798.jpg" },
              { "title": "THE GREATEST DEMON LORD IS REBORN", "image": "https://images.alphacoders.com/123/1231804.jpg", "highlight_char": "O", "accent_color": "text-red-500" },
              { "title": "WONDER EGG PRIORITY", "image": "https://images3.alphacoders.com/112/1127027.jpg" },
            ]
            for item in series_data:
                await create_anime(item["title"], item["image"], AnimeSection.SERIES, item.get("highlight_char"), item.get("accent_color"))

            # --- MOVIES ---
            logger.info("Seeding Movies...")
            movies_data = [
              { "title": "SUZUME", "image": "https://images5.alphacoders.com/131/1312046.jpg" },
              { "title": "DRAGON BALL SUPER: SUPER HERO", "image": "https://images8.alphacoders.com/124/1244026.jpg" },
              { "title": "DRAGON BALL Z: RESURRECTION 'F'", "image": "https://images6.alphacoders.com/606/606667.jpg" },
              { "title": "THE GARDEN OF WORDS", "image": "https://images3.alphacoders.com/246/246736.jpg", "highlight_char": "N", "accent_color": "text-green-500" },
              { "title": "A SILENT VOICE", "image": "https://images4.alphacoders.com/839/839722.jpg" },
              { "title": "CHILDREN OF THE SEA", "image": "https://images.alphacoders.com/102/1026943.jpg", "highlight_char": "O", "accent_color": "text-yellow-500" },
              { "title": "WEATHERING WITH YOU", "image": "https://images2.alphacoders.com/100/1004344.jpg" },
              { "title": "YOUR NAME", "image": "https://images.alphacoders.com/722/722020.jpg" },
              { "title": "I WANT TO EAT YOUR PANCREAS", "image": "https://images4.alphacoders.com/936/936662.png" },
            ]
            for item in movies_data:
                await create_anime(item["title"], item["image"], AnimeSection.MOVIES, item.get("highlight_char"), item.get("accent_color"))

            # --- EARLY ACCESS ---
            logger.info("Seeding Early Access...")
            early_access_data = [
              { "title": "VIRAL HIT", "image": "https://images5.alphacoders.com/135/1351586.jpeg", "highlight_char": "L", "accent_color": "text-red-600" },
              { "title": "ANGEL'S EGG", "image": "https://images.alphacoders.com/593/593450.jpg" },
              { "title": "KATSUGEKI/TOUKEN RANBU", "image": "https://images3.alphacoders.com/854/854378.jpg", "highlight_char": "U", "accent_color": "text-blue-400" },
              { "title": "DANMACHI: ARROW OF ORION", "image": "https://images2.alphacoders.com/985/985558.jpg" },
            ]
            for item in early_access_data:
                await create_anime(item["title"], item["image"], AnimeSection.EARLY_ACCESS, item.get("highlight_char"), item.get("accent_color"))
            
            # --- COMING SOON ---
            logger.info("Seeding Coming Soon...")
            coming_soon_data = [
              { "title": "ARCANE SEASON 2", "image": "https://images.alphacoders.com/133/1330727.jpeg", "highlight_char": "A", "accent_color": "text-blue-500" },
              { "title": "SAKAMOTO DAYS", "image": "https://images.alphacoders.com/134/1344446.png", "highlight_char": "A", "accent_color": "text-red-500" },
              { "title": "SOLO LEVELING SEASON 2", "image": "https://images8.alphacoders.com/134/1346387.jpeg", "highlight_char": "L", "accent_color": "text-blue-400" },
              { "title": "VIRGIN PUNK", "image": "https://images.alphacoders.com/135/1352456.jpeg", "highlight_char": "V", "accent_color": "text-pink-500" },
              { "title": "RUROUNI KENSHIN SEASON 2", "image": "https://images8.alphacoders.com/132/1321743.jpeg" },
              { "title": "RE:ZERO SEASON 3", "image": "https://images3.alphacoders.com/132/1328456.png" },
              { "title": "BLUE EXORCIST SEASON 4", "image": "https://images5.alphacoders.com/133/1337466.png" },
              { "title": "DANMACHI SEASON 5", "image": "https://images.alphacoders.com/105/1056569.jpg", "highlight_char": "M", "accent_color": "text-blue-500" },
              { "title": "NEGAPOSI ANGLER", "image": "https://images.alphacoders.com/134/1348393.jpeg" },
              { "title": "RASCAL DOES NOT DREAM...", "image": "https://images4.alphacoders.com/133/1335345.jpeg" },
              { "title": "CHAINSAW MAN: REZE ARC", "image": "https://images.alphacoders.com/128/1286053.jpg", "highlight_char": "Z", "accent_color": "text-red-600" },
              { "title": "PLUTO", "image": "https://images3.alphacoders.com/133/1334568.jpeg", "highlight_char": "L", "accent_color": "text-green-500" },
            ]
            for item in coming_soon_data:
                await create_anime(item["title"], item["image"], AnimeSection.COMING_SOON, item.get("highlight_char"), item.get("accent_color"))

            # --- ACTIVE PACKS ---
            logger.info("Seeding Active Packs...")
            packs_data = [
              { "title": "NARUTO SHIPPUDEN", "image": "https://images.alphacoders.com/605/605592.jpg" },
              { "title": "BLACK CLOVER", "image": "https://images.alphacoders.com/877/877477.jpg" },
              { "title": "DRAGON BALL SUPER", "image": "https://images.alphacoders.com/669/669177.jpg" },
              { "title": "HUNTER X HUNTER", "image": "https://images.alphacoders.com/229/229068.jpg" },
              { "title": "FAIRY TAIL", "image": "https://images.alphacoders.com/694/694939.jpg" },
              { "title": "FIRE FORCE", "image": "https://images5.alphacoders.com/110/1107050.jpg" },
            ]
            for item in packs_data:
                await create_anime(item["title"], item["image"], AnimeSection.ACTIVE_PACKS)
            
            await db.commit()
            logger.info("Seeding completed successfully!")

        except Exception as e:
            logger.error(f"Seeding failed: {e}")
            await db.rollback()
            raise

if __name__ == "__main__":
    asyncio.run(seed_data())
