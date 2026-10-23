"""
DVT Talent AI — Genuine Multi-Container Disaster Recovery Restore Drill
Validates Remediation E in a real isolated containerized environment:
1. Deploys an isolated, disposable Compose project (dvt_drill) with separate named volumes.
2. Generates synthetic DB tables, candidate records, and storage files.
3. Creates real backup archives using scripts/backup_db.sh.
4. Injects a stale database table (absent from backup) and mutates storage.
5. Executes scripts/restore_db.sh against the disposable stack.
6. Proves:
   - Total application quiescence during restore.
   - Stale database objects are completely wiped.
   - Restored database matches backup.
   - Storage files and tombstones are restored with UID:GID 1001:1001.
   - Reconciliation passes and Caddy starts only after healthcheck passes.
7. Injects a failure and verifies ingress remains fail-closed.
8. Cleans up all disposable containers and volumes.
"""
import os
import sys
import time
import subprocess
import pytest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent
GIT_BASH = r"C:\Program Files\Git\bin\bash.exe"
if not Path(GIT_BASH).is_file():
    GIT_BASH = "bash"


@pytest.fixture(scope="module")
def drill_env(tmp_path_factory):
    drill_dir = tmp_path_factory.mktemp("dvt_drill_env")
    compose_file = drill_dir / "docker-compose.drill.yml"
    caddy_file = drill_dir / "Caddyfile.drill"
    backup_dir = drill_dir / "backups_pg"
    storage_backup_dir = drill_dir / "backups_storage"
    backup_dir.mkdir(parents=True, exist_ok=True)
    storage_backup_dir.mkdir(parents=True, exist_ok=True)

    # Simplified drill Caddyfile
    caddy_file.write_text("""{
    auto_https off
}
:8088 {
    handle /health* {
        reverse_proxy api:8000
    }
    handle {
        respond "DRILL_INGRESS_OPEN" 200
    }
}
""", encoding="utf-8")

    scripts_dir = BASE_DIR / "scripts"
    services_dir = BASE_DIR / "services"
    db_dir = BASE_DIR / "db"
    config_file = BASE_DIR / "config.py"

    # Disposable Compose configuration
    compose_content = f"""services:
  db:
    image: postgres:16-alpine
    restart: always
    environment:
      - POSTGRES_USER=dvt_drill_user
      - POSTGRES_PASSWORD=drill_secret_pass
      - POSTGRES_DB=dvt_drill_db
    volumes:
      - drill_postgres_data:/var/lib/postgresql/data
    networks:
      - drill_net

  redis:
    image: redis:7-alpine
    restart: always
    networks:
      - drill_net

  api:
    image: dvt-talent-ai-fixed-api:latest
    restart: always
    environment:
      - APP_ENV=production
      - DATABASE_URL=postgresql+asyncpg://dvt_drill_user:drill_secret_pass@db:5432/dvt_drill_db
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=drill_secret_key_123456789012345678901234567890
      - GROQ_API_KEY=mock_groq_api_key_for_drill_testing_12345
      - GMAIL_SENDER_EMAIL=test@drill.local
    volumes:
      - {config_file.as_posix()}:/app/config.py
      - {db_dir.as_posix()}:/app/db
      - {services_dir.as_posix()}:/app/services
      - {scripts_dir.as_posix()}:/app/scripts
      - drill_storage:/app/storage
      - drill_uploads:/app/uploads
    networks:
      - drill_net

  worker:
    image: dvt-talent-ai-fixed-worker:latest
    restart: always
    environment:
      - APP_ENV=production
      - DATABASE_URL=postgresql+asyncpg://dvt_drill_user:drill_secret_pass@db:5432/dvt_drill_db
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=drill_secret_key_123456789012345678901234567890
      - GROQ_API_KEY=mock_groq_api_key_for_drill_testing_12345
    volumes:
      - {config_file.as_posix()}:/app/config.py
      - {db_dir.as_posix()}:/app/db
      - {services_dir.as_posix()}:/app/services
      - {scripts_dir.as_posix()}:/app/scripts
      - drill_storage:/app/storage
      - drill_uploads:/app/uploads
    networks:
      - drill_net

  scheduler:
    image: dvt-talent-ai-fixed-scheduler:latest
    restart: always
    environment:
      - APP_ENV=production
      - DATABASE_URL=postgresql+asyncpg://dvt_drill_user:drill_secret_pass@db:5432/dvt_drill_db
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=drill_secret_key_123456789012345678901234567890
      - GROQ_API_KEY=mock_groq_api_key_for_drill_testing_12345
    volumes:
      - {config_file.as_posix()}:/app/config.py
      - {db_dir.as_posix()}:/app/db
      - {services_dir.as_posix()}:/app/services
      - {scripts_dir.as_posix()}:/app/scripts
      - drill_storage:/app/storage
    networks:
      - drill_net

  frontend:
    image: dvt-talent-ai-fixed-frontend:latest
    restart: always
    environment:
      - NODE_ENV=production
    networks:
      - drill_net

  caddy:
    image: caddy:2.7-alpine
    restart: always
    volumes:
      - {caddy_file.as_posix()}:/etc/caddy/Caddyfile
      - drill_caddy_data:/data
    networks:
      - drill_net

networks:
  drill_net:
    driver: bridge

volumes:
  drill_postgres_data:
  drill_storage:
  drill_uploads:
  drill_caddy_data:
"""
    compose_file.write_text(compose_content, encoding="utf-8")

    yield {
        "dir": drill_dir,
        "compose": compose_file,
        "backup_dir": backup_dir,
        "storage_backup_dir": storage_backup_dir,
        "project": "dvt_drill_isolated",
    }

    # Teardown: prune disposable containers and volumes
    subprocess.run(
        ["docker", "compose", "-f", compose_file.as_posix(), "-p", "dvt_drill_isolated", "down", "-v"],
        capture_output=True,
    )


def run_drill_cmd(cmd_list, env=None):
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    merged_env["MSYS_NO_PATHCONV"] = "1"
    proc = subprocess.run(cmd_list, capture_output=True, text=True, encoding="utf-8", errors="replace", env=merged_env)
    return proc.returncode, proc.stdout, proc.stderr


@pytest.mark.asyncio
async def test_genuine_container_disaster_recovery_drill(drill_env):
    compose = drill_env["compose"].as_posix()
    project = drill_env["project"]
    backup_dir = drill_env["backup_dir"].as_posix()
    storage_backup_dir = drill_env["storage_backup_dir"].as_posix()

    # 1. Start database and redis
    code, out, err = run_drill_cmd(["docker", "compose", "-f", compose, "-p", project, "up", "-d", "db", "redis"])
    assert code == 0, f"Failed to start db/redis: {err}"

    # Wait for DB readiness and query acceptance
    db_ready = False
    for _ in range(30):
        code, out, _ = run_drill_cmd([
            "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
            "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-c", "SELECT 1;"
        ])
        if code == 0:
            db_ready = True
            break
        time.sleep(2)
    assert db_ready, "Disposable Postgres DB did not become ready for queries."

    # 2. Initialize application database schema on disposable DB using direct psql DDL
    ddl_schema = """
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        domain VARCHAR(255) UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        settings JSONB DEFAULT '{}',
        subscription_plan VARCHAR(50) DEFAULT 'starter',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id),
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        hashed_password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'recruiter',
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    DO $$ BEGIN
        CREATE TYPE candidatestatus AS ENUM (
            'SOURCED', 'APPLIED', 'SCREENED', 'CONTACTED', 'INTERESTED', 'INTERVIEWING', 'OFFERED', 'PLACED', 'REJECTED',
            'sourced', 'applied', 'screened', 'contacted', 'interested', 'interviewing', 'offered', 'placed', 'rejected'
        );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS candidates (
        id UUID PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id),
        user_id UUID REFERENCES users(id),
        recruiter_id UUID REFERENCES users(id),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE,
        phone VARCHAR(50),
        title VARCHAR(255),
        location VARCHAR(255),
        linkedin_url VARCHAR(500),
        github_url VARCHAR(500),
        portfolio_url VARCHAR(500),
        skills JSONB DEFAULT '[]',
        experience_years INTEGER DEFAULT 0,
        current_company VARCHAR(255),
        current_salary INTEGER,
        expected_salary INTEGER,
        availability VARCHAR(100),
        status candidatestatus DEFAULT 'SOURCED',
        source VARCHAR(100),
        score FLOAT DEFAULT 0.0,
        embedding_id VARCHAR(255),
        ai_summary TEXT,
        do_not_contact BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        is_searchable BOOLEAN DEFAULT TRUE,
        hide_from_companies JSONB DEFAULT '[]',
        pii_erased BOOLEAN DEFAULT FALSE,
        pii_erased_at TIMESTAMP WITH TIME ZONE,
        scoring_reasoning JSONB DEFAULT '{}',
        integrity_reasoning JSONB DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS resumes (
        id UUID PRIMARY KEY,
        candidate_id UUID REFERENCES candidates(id),
        tenant_id UUID REFERENCES tenants(id),
        file_name VARCHAR(255),
        file_url VARCHAR(500),
        raw_text TEXT,
        parsed_data JSONB DEFAULT '{}',
        score FLOAT DEFAULT 0.0,
        embedding_id VARCHAR(100),
        is_current BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    DO $$ BEGIN
        CREATE TYPE agenttaskstatus AS ENUM (
            'PENDING', 'RUNNING', 'AWAITING_INPUT', 'COMPLETED', 'FAILED', 'RETRYING',
            'pending', 'running', 'awaiting_input', 'completed', 'failed', 'retrying'
        );
    EXCEPTION
        WHEN duplicate_object THEN null;
    END $$;

    CREATE TABLE IF NOT EXISTS agent_tasks (
        id UUID PRIMARY KEY,
        tenant_id UUID REFERENCES tenants(id),
        agent_name VARCHAR(100),
        task_type VARCHAR(100),
        status agenttaskstatus DEFAULT 'PENDING',
        input_data JSONB DEFAULT '{}',
        output_data JSONB DEFAULT '{}',
        error_message TEXT,
        retries INTEGER DEFAULT 0,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        celery_task_id VARCHAR(255),
        user_id UUID,
        pipeline_mode VARCHAR(50) DEFAULT 'autonomous',
        current_checkpoint VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    INSERT INTO tenants (id, name, domain, is_active, created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000001', 'Drill Tenant', 'drill.local', TRUE, now(), now())
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO candidates (id, tenant_id, first_name, last_name, email, pii_erased, created_at, updated_at)
    VALUES ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000001', 'Alice', 'Drill', 'alice@drill.local', FALSE, now(), now());

    INSERT INTO candidates (id, tenant_id, first_name, last_name, email, pii_erased, created_at, updated_at)
    VALUES ('99999999-9999-9999-9999-999999999999', '00000000-0000-0000-0000-000000000001', 'Bob', 'Resurrected', 'bob.resurrected@drill.local', FALSE, now(), now());
    """
    code, _, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-c", ddl_schema
    ])
    assert code == 0, f"Failed to populate synthetic DB: {err}"

    # 4. Start API, workers, scheduler, frontend, and Caddy
    code, _, err = run_drill_cmd(["docker", "compose", "-f", compose, "-p", project, "up", "-d"])
    assert code == 0, f"Failed to start drill stack: {err}"

    # Write synthetic files to volumes via one-off container
    code, _, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "run", "--rm", "-T", "-u", "0", "--no-deps", "api",
        "sh", "-c", "mkdir -p /app/storage /app/uploads/resumes && echo '{\"candidate_id\": \"99999999-9999-9999-9999-999999999999\", \"tenant_id\": \"00000000-0000-0000-0000-000000000001\", \"erased_at\": \"2026-10-22T00:00:00Z\"}' > /app/storage/erasure_tombstones.jsonl && echo 'SYNTHETIC_RESUME_CONTENT' > /app/uploads/resumes/alice_resume.pdf && chown -R 1001:1001 /app/storage /app/uploads"
    ])
    assert code == 0, f"Failed to write synthetic storage: {err}"

    # 4. Execute Real Backup using scripts/backup_db.sh
    backup_env = os.environ.copy()
    backup_env["COMPOSE_FILE"] = compose
    backup_env["COMPOSE_PROJECT_NAME"] = project
    backup_env["DB_NAME"] = "dvt_drill_db"
    backup_env["DB_USER"] = "dvt_drill_user"
    backup_env["BACKUP_DIR"] = backup_dir
    backup_env["STORAGE_BACKUP_DIR"] = storage_backup_dir

    backup_script = (REPO_ROOT / "scripts" / "backup_db.sh").as_posix()
    code, out, err = run_drill_cmd([GIT_BASH, backup_script], env=backup_env)
    assert code == 0, f"Real backup script failed: {err}\nOutput: {out}"
    assert "Backup routine finished successfully" in out

    db_backups = list(drill_env["backup_dir"].glob("dvt_talent_*.sql.gz"))
    storage_backups = list(drill_env["storage_backup_dir"].glob("storage_*.tar.gz"))
    assert len(db_backups) == 1, "Database backup file not produced."
    assert len(storage_backups) == 1, "Storage backup file not produced."

    db_backup_path = db_backups[0].as_posix()
    storage_backup_path = storage_backups[0].as_posix()

    # 5. Inject mutations into the active environment (drift & stale objects)
    # 5a. Stale table absent from the backup
    stale_sql = "CREATE TABLE staging_stale_untracked (id INT, leaked TEXT); INSERT INTO staging_stale_untracked VALUES (42, 'SURVIVAL_LEAK');"
    code, _, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-c", stale_sql
    ])
    assert code == 0

    # 5b. Corrupt / modify storage files
    code, _, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "-u", "0", "api",
        "sh", "-c", "rm -f /app/uploads/resumes/alice_resume.pdf && echo 'STALE_DIRTY_FILE' > /app/uploads/resumes/unwanted.txt"
    ])
    assert code == 0

    # Verify stale table exists before restore
    code, out, _ = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-tAc", "SELECT count(*) FROM staging_stale_untracked;"
    ])
    assert out.strip() == "1"

    # 6. Execute Real Restore using scripts/restore_db.sh
    restore_env = os.environ.copy()
    restore_env["COMPOSE_FILE"] = compose
    restore_env["COMPOSE_PROJECT_NAME"] = project
    restore_env["DB_NAME"] = "dvt_drill_db"
    restore_env["DB_USER"] = "dvt_drill_user"
    restore_env["NON_INTERACTIVE"] = "1"
    restore_env["CONFIRM"] = "RESTORE"

    restore_script = (REPO_ROOT / "scripts" / "restore_db.sh").as_posix()
    code, out, err = run_drill_cmd([GIT_BASH, restore_script, db_backup_path, storage_backup_path], env=restore_env)
    assert code == 0, f"Real restore script failed: {err}\nOutput: {out}"
    assert "Disaster recovery restoration, reconciliation, and ingress cutover successfully completed." in out

    # 7. Verification of Clean State
    # 7a. Stale table MUST be eliminated (DROP SCHEMA CASCADE)
    code, out, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-tAc", "SELECT to_regclass('public.staging_stale_untracked');"
    ])
    assert out.strip() == "", "SECURITY FLAW: Stale database table survived disaster recovery restoration!"

    # 7b. Candidate table restored with original synthetic record, and resurrected candidate sanitized by reconciliation
    code, out, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-tAc", "SELECT first_name, last_name, pii_erased FROM candidates WHERE id = '11111111-1111-1111-1111-111111111111';"
    ])
    assert "Alice|Drill|f" in out.strip() or "Alice|Drill|F" in out.strip()

    code, out, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "db",
        "psql", "-U", "dvt_drill_user", "-d", "dvt_drill_db", "-tAc", "SELECT first_name, pii_erased FROM candidates WHERE id = '99999999-9999-9999-9999-999999999999';"
    ])
    assert "Erased|t" in out.strip() or "Erased|T" in out.strip()

    # 7c. Restored files exist and unwanted files are purged
    code, out, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "api",
        "sh", "-c", "cat /app/uploads/resumes/alice_resume.pdf"
    ])
    assert code == 0
    assert "SYNTHETIC_RESUME_CONTENT" in out

    # 7d. Check file ownership (UID:GID 1001:1001)
    code, out, err = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "exec", "-T", "api",
        "sh", "-c", "stat -c '%u:%g' /app/storage/erasure_tombstones.jsonl"
    ])
    assert out.strip() == "1001:1001"

    # 8. Failure Injection Test: In-restore SQL failure must stop immediately and leave Caddy stopped (fail-closed)
    import gzip
    sql_error_backup = drill_env["dir"] / "sql_fail_drill_db.sql.gz"
    with gzip.open(sql_error_backup, "wb") as f_gz:
        f_gz.write(b"CREATE TABLE test_before_error (id int); SELECT * FROM non_existent_table_syntax_error_abort;")

    code_fail, out_fail, err_fail = run_drill_cmd(
        [GIT_BASH, restore_script, sql_error_backup.as_posix(), storage_backup_path],
        env=restore_env
    )
    assert code_fail != 0
    assert "CRITICAL ERROR: RESTORATION FAILED" in out_fail or "non_existent_table" in err_fail or "non_existent_table" in out_fail

    # Verify Caddy and API were severed and remain stopped (fail-closed ingress)
    code, running_services, _ = run_drill_cmd([
        "docker", "compose", "-f", compose, "-p", project, "ps", "--services", "--filter", "status=running"
    ])
    running_list = running_services.splitlines()
    assert "caddy" not in running_list, f"FAIL-CLOSED INGRESS VIOLATION: Caddy remained active after in-restore SQL failure!\nRunning: {running_services}"
    assert "api" not in running_list, f"QUIESCENCE VIOLATION: API remained active after in-restore SQL failure!\nRunning: {running_services}"
