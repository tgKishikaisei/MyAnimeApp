"""Check clips table columns using sync approach"""
from sqlalchemy import create_engine, text, inspect
import os
from dotenv import load_dotenv

load_dotenv()

# Get async URL and convert to sync
DATABASE_URL = os.getenv("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")

try:
    engine = create_engine(DATABASE_URL, echo=False)
    inspector = inspect(engine)
    
    columns = inspector.get_columns('clips')
    
    print("\nColumns in 'clips' table:")
    print("-" * 60)
    for col in columns:
        print(f"  {col['name']:20} {str(col['type']):20} nullable={col['nullable']}")
    
    print(f"\nTotal columns: {len(columns)}")
    
    # Check which columns are missing
    required = {'video_path', 'thumbnail_path', 'duration', 'season', 'episode'}
    existing = {col['name'] for col in columns}
    missing = required - existing
    
    if missing:
        print(f"\nMissing columns: {', '.join(missing)}")
    else:
        print("\nAll required columns exist!")
        
except Exception as e:
    print(f"Error: {e}")
