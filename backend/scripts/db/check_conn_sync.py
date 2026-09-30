import psycopg2
import os
import sys

# Hardcoded for reliability during test
DB_HOST = "127.0.0.1"
DB_NAME = "aniflow"
DB_USER = "postgres"
DB_PASS = "testpass123"

print(f"Connecting to {DB_HOST}...", flush=True)

try:
    conn = psycopg2.connect(
        host=DB_HOST,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASS
    )
    cur = conn.cursor()
    cur.execute("SELECT 1")
    result = cur.fetchone()
    print(f"Success! Result: {result}", flush=True)
    conn.close()
except Exception as e:
    print(f"Error: {e}", flush=True)
