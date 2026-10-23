"""
DVT Talent AI — Automated Staging Credential Rotation
Rotates the staging PostgreSQL user password, percent-encodes it in DATABASE_URL,
updates backend/.env, and alters the role in the running dvt-postgres container.
Does NOT print credentials or secrets.
"""
import os
import sys
import secrets
import string
import subprocess
from urllib.parse import quote_plus
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = BASE_DIR / ".env"

def rotate_staging_db_password():
    # Generate high-entropy 24-char password with alphanumeric and reserved characters
    # e.g. includes characters that require percent encoding
    chars = string.ascii_letters + string.digits + "!_#$"
    new_password = "".join(secrets.choice(chars) for _ in range(24))
    # Ensure it starts and ends with alphanumeric
    new_password = "Stg" + new_password + "9A"
    
    encoded_pw = quote_plus(new_password)
    
    # 1. Update PostgreSQL in container via docker exec
    sql = f"ALTER ROLE dvt_user WITH PASSWORD '{new_password}';"
    cmd = ["docker", "exec", "-i", "dvt-postgres", "psql", "-U", "dvt_user", "-d", "dvt_staging", "-c", sql]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error altering PostgreSQL password: {res.stderr.strip()}", file=sys.stderr)
        sys.exit(1)
        
    # 2. Update backend/.env file safely without printing password
    if ENV_PATH.exists():
        content = ENV_PATH.read_text(encoding="utf-8")
        lines = content.splitlines()
        new_lines = []
        for line in lines:
            if line.startswith("POSTGRES_PASSWORD="):
                new_lines.append(f"POSTGRES_PASSWORD={new_password}")
            elif line.startswith("DATABASE_URL="):
                new_lines.append(f"DATABASE_URL=postgresql+asyncpg://dvt_user:{encoded_pw}@127.0.0.1:5432/dvt_staging")
            elif line.startswith("DATABASE_SYNC_URL="):
                new_lines.append(f"DATABASE_SYNC_URL=postgresql+psycopg2://dvt_user:{encoded_pw}@127.0.0.1:5432/dvt_staging")
            else:
                new_lines.append(line)
        ENV_PATH.write_text("\n".join(new_lines) + "\n", encoding="utf-8")
        
    # 3. Write a small helper config for the current shell
    shell_file = BASE_DIR / ".staging_pg_env.ps1"
    shell_content = (
        f'$env:DATABASE_URL="postgresql+asyncpg://dvt_user:{encoded_pw}@127.0.0.1:5432/dvt_staging"\n'
        f'$env:DATABASE_SYNC_URL="postgresql+psycopg2://dvt_user:{encoded_pw}@127.0.0.1:5432/dvt_staging"\n'
    )
    shell_file.write_text(shell_content, encoding="utf-8")
    print("SUCCESS: Staging PostgreSQL password rotated cleanly and percent-encoded in environment configuration.")

if __name__ == "__main__":
    rotate_staging_db_password()
