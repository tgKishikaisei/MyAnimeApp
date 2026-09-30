import sys
import os
from sqlalchemy.orm import Session
import random

# Магия путей, чтобы видеть папку app
sys.path.insert(0, os.path.realpath(os.path.join(os.path.dirname(__file__), ".")))

from app.core.database import SessionLocal, engine, Base
from app.modules.anime import models
from app.modules.anime.enums import AnimeSection, VideoQuality

# Создаем таблицы (на случай, если миграции не отработали)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

def seed_db():
    print("🚀 Начинаю полную очистку и наполнение базы...")
    
    # 1. Очистка старых данных
    db.query(models.Clip).delete()
    db.query(models.Anime).delete()
    db.query(models.Tag).delete()
    db.commit()

    # 2. Создаем ТЕГИ
    tags_list = ["Action", "Shonen", "Fantasy", "Drama", "Sci-Fi", "Adventure", "Horror", "Romance", "Music", "Sports"]
    tags_db = {}
    for t_name in tags_list:
        tag = models.Tag(name=t_name)
        db.add(tag)
        tags_db[t_name] = tag # Запоминаем, чтобы потом привязывать к аниме
    db.commit()

    print(f"✅ Создано {len(tags_list)} тегов.")

    # 3. Данные АНИМЕ (Все секции)
    animes_data = [
        # === MOST POPULAR ===
        {"title": "CHAINSAW MAN", "image": "/chainsaw.jpg", "h_char": "W", "color": "text-red-600", "sec": AnimeSection.POPULAR, "year": 2022, "rating": 8.8, "tags": ["Action", "Horror"]},
        {"title": "BLEACH: TYBW", "image": "/bleach.jpg", "h_char": "B", "color": "text-red-600", "sec": AnimeSection.POPULAR, "year": 2023, "rating": 9.1, "tags": ["Action", "Shonen"]},
        {"title": "ATTACK ON TITAN", "image": "/aot.jpg", "h_char": "O", "color": "text-green-500", "sec": AnimeSection.POPULAR, "year": 2013, "rating": 9.9, "tags": ["Action", "Drama"]},
        {"title": "BLUE LOCK", "image": "/bluelock.jpg", "h_char": "L", "color": "text-blue-500", "sec": AnimeSection.POPULAR, "year": 2023, "rating": 8.5, "tags": ["Sports"]},
        
        # === RECENTLY ADDED ===
        {"title": "SOLO LEVELING", "image": "https://images8.alphacoders.com/134/1346387.jpeg", "h_char": "V", "color": "text-cyan-400", "sec": AnimeSection.RECENT, "year": 2024, "rating": 9.5, "tags": ["Action", "Fantasy"]},
        {"title": "NINJA KAMUI", "image": "https://images3.alphacoders.com/135/1351239.jpeg", "h_char": "K", "color": "text-red-600", "sec": AnimeSection.RECENT, "year": 2024, "rating": 8.7, "tags": ["Action", "Sci-Fi"]},
        {"title": "MASHLE", "image": "https://images5.alphacoders.com/131/1310935.jpg", "h_char": "D", "color": "text-yellow-400", "sec": AnimeSection.RECENT, "year": 2023, "rating": 8.2, "tags": ["Comedy", "Fantasy"]},
        {"title": "FATE/GO", "image": "https://images.alphacoders.com/116/1165438.jpg", "h_char": "T", "color": "text-green-500", "sec": AnimeSection.RECENT, "year": 2020, "rating": 8.0, "tags": ["Fantasy"]},
        
        # === SERIES ===
        {"title": "SERAPH OF THE END", "image": "https://images3.alphacoders.com/653/653457.jpg", "h_char": "O", "color": "text-green-500", "sec": AnimeSection.SERIES, "year": 2015, "rating": 8.4, "tags": ["Action", "Vampire"]},
        {"title": "RUROUNI KENSHIN", "image": "https://images8.alphacoders.com/132/1321743.jpeg", "sec": AnimeSection.SERIES, "year": 2023, "rating": 8.1, "tags": ["Action", "Historical"]},
        {"title": "NIER:AUTOMATA VER1.1A", "image": "https://images3.alphacoders.com/134/1346389.jpeg", "sec": AnimeSection.SERIES, "year": 2023, "rating": 8.6, "tags": ["Sci-Fi"]},
        
        # === MOVIES ===
        {"title": "SUZUME", "image": "https://images5.alphacoders.com/131/1312046.jpg", "sec": AnimeSection.MOVIES, "year": 2022, "rating": 9.2, "tags": ["Drama", "Fantasy"]},
        {"title": "A SILENT VOICE", "image": "https://images4.alphacoders.com/839/839722.jpg", "sec": AnimeSection.MOVIES, "year": 2016, "rating": 9.8, "tags": ["Drama", "Romance"]},
        
        # === COMING SOON ===
        {"title": "ARCANE SEASON 2", "image": "https://images.alphacoders.com/133/1330727.jpeg", "h_char": "A", "color": "text-blue-500", "sec": AnimeSection.COMING_SOON, "year": 2025, "rating": 0.0, "tags": ["Sci-Fi"]},
        {"title": "SAKAMOTO DAYS", "image": "https://images.alphacoders.com/134/1344446.png", "h_char": "A", "color": "text-red-500", "sec": AnimeSection.COMING_SOON, "year": 2025, "rating": 0.0, "tags": ["Action", "Comedy"]},
        
        # === ACTIVE PACKS ===
        {"title": "Dragon Ball DAIMA", "image": "", "sec": AnimeSection.ACTIVE_PACKS, "year": 2024, "rating": 0.0},
        {"title": "Re:Zero Season 3", "image": "", "sec": AnimeSection.ACTIVE_PACKS, "year": 2024, "rating": 0.0},
    ]

    for item in animes_data:
        # Создаем Аниме
        anime = models.Anime(
            title=item["title"],
            image=item["image"],
            section=item["sec"],
            year=item.get("year"),
            rating=item.get("rating", 0.0),
            highlight_char=item.get("h_char"),
            accent_color=item.get("color"),
            # Описание заглушка
            description=f"This is a description for {item['title']}. High quality clips available in 4K and 1080p."
        )
        
        # Привязываем теги (если есть в списке)
        if "tags" in item:
            for tag_name in item["tags"]:
                if tag_name in tags_db:
                    anime.tags.append(tags_db[tag_name])

        db.add(anime)
        db.commit() # Чтобы получить ID аниме для клипов
        
        # 4. Создаем КЛИПЫ (по 2-3 штуки на каждое аниме, если это не Active Pack)
        if item["sec"] != AnimeSection.ACTIVE_PACKS and item["sec"] != AnimeSection.COMING_SOON:
            clip1 = models.Clip(
                title=f"{item['title']} - Epic Fight Scene",
                video_id="MGBG0nJ6N4c", # Тестовый ID
                quality=VideoQuality.Q_1080P,
                fps=24,
                anime_id=anime.id
            )
            clip2 = models.Clip(
                title=f"{item['title']} - Emotional Moment",
                video_id="Non8Z92C7hY", # Тестовый ID
                quality=VideoQuality.Q_4K,
                fps=60,
                anime_id=anime.id
            )
            db.add(clip1)
            db.add(clip2)
            db.commit()

    print(f"✅ Успешно добавлено {len(animes_data)} аниме с клипами и тегами!")
    db.close()

if __name__ == "__main__":
    seed_db()