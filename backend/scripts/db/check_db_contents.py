"""Check what's in the database for clips"""
import requests

print("=" * 70)
print("CHECKING DATABASE CONTENTS")
print("=" * 70)

# 1. Get all anime
print("\n1. Getting all anime...")
r = requests.get("http://localhost:8000/api/v1/animes/")
if r.status_code == 200:
    animes = r.json()
    print(f"   Found {len(animes)} anime total")
    print("\n   First 5 anime with IDs:")
    for anime in animes[:5]:
        print(f"   - ID {anime['id']}: {anime['title']} (section: {anime['section']})")
else:
    print(f"   Error: {r.status_code}")

# 2. Try to get clips from clips endpoint
print("\n2. Checking clips endpoint...")
try:
    r = requests.get("http://localhost:8000/api/v1/clips/")
    if r.status_code == 200:
        clips = r.json()
        print(f"   Found {len(clips)} clips total")
        if clips:
            print("\n   First 3 clips:")
            for clip in clips[:3]:
                print(f"   - Clip ID {clip['id']}: {clip['title']}")
                print(f"     Anime ID: {clip['anime_id']}, Season: {clip.get('season')}, Episode: {clip.get('episode')}")
    else:
        print(f"   Status: {r.status_code}")
except Exception as e:
    print(f"   Error: {e}")

# 3. Test seasons for first anime that has clips
if 'animes' in locals() and animes:
    print(f"\n3. Testing seasons endpoint for anime ID {animes[0]['id']}...")
    r = requests.get(f"http://localhost:8000/api/v1/animes/{animes[0]['id']}/seasons")
    print(f"   Status: {r.status_code}")
    if r.status_code == 200:
        seasons = r.json()
        print(f"   Seasons: {seasons}")

print("=" * 70)
