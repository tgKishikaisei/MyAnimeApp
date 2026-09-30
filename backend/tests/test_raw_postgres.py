import psycopg2

try:
    # Hardcoded credentials from .env to test raw connection
    conn = psycopg2.connect(
        dbname="aniflow",
        user="postgres",
        password="testpass123",
        host="localhost"
    )
    print("SUCCESS: Connected to PostgreSQL via raw psycopg2")
    
    cur = conn.cursor()
    cur.execute("SELECT version()")
    print(f"PostgreSQL version: {cur.fetchone()}")
    
    cur.close()
    conn.close()
except Exception as e:
    print(f"ERROR: Raw connection failed - {e}")
