import sqlite3
import glob
import os

print("=== CHECKING SQLITE DATABASES ===")
for db in glob.glob("*.db") + glob.glob("backend/*.db"):
    try:
        conn = sqlite3.connect(db)
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [r[0] for r in cur.fetchall()]
        print(f"DB: {db} (size: {os.path.getsize(db)} bytes)")
        if "users" in tables:
            cur.execute("SELECT id, email, full_name, role, is_active, tenant_id FROM users")
            users = cur.fetchall()
            print(f"  Users in {db}:")
            for u in users:
                print(f"    - {u}")
        conn.close()
    except Exception as e:
        print(f"  Error on {db}: {e}")

print("\n=== CHECKING POSTGRESQL ===")
try:
    import psycopg2
    from config import settings
    # Try parsing postgres url
    url = settings.database_sync_url
    print(f"Connecting to Postgres: {url}")
    conn = psycopg2.connect(url)
    cur = conn.cursor()
    cur.execute("SELECT id, email, full_name, role, is_active, tenant_id FROM users")
    users = cur.fetchall()
    print("  Users in PostgreSQL:")
    for u in users:
        print(f"    - {u}")
    conn.close()
except Exception as e:
    print(f"  PostgreSQL check failed: {e}")
