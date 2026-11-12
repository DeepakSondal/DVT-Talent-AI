<#
.SYNOPSIS
    Verify Alembic migration chain against an ephemeral local pgvector Postgres container.

.DESCRIPTION
    Starts pgvector/pgvector:pg16 in Docker on port 55432, runs `alembic upgrade head`,
    verifies pgvector extension, UPPERCASE Postgres enum labels, nullable users.hashed_password,
    all ORM tables, `alembic downgrade base`, and re-upgrade to `head`.
#>
[CmdletBinding()]
param(
    [int]$Port = 55432,
    [string]$Image = "pgvector/pgvector:pg16"
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$BackendDir = Join-Path $RepoRoot "backend"
$PythonExe = Join-Path $BackendDir "venv\Scripts\python.exe"
$AlembicExe = Join-Path $BackendDir "venv\Scripts\alembic.exe"

if (-not (Test-Path $PythonExe)) {
    throw "Backend virtualenv Python not found at $PythonExe"
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw "Docker daemon is not running. Start Docker Desktop and re-run this script."
}

$ContainerName = "dvt-pg-mig-verify-$PID"
$DbUser = "dvt_verify"
$DbPass = "dvt_verify_local_pw"
$DbName = "dvt_verify_db"
$AsyncUrl = "postgresql+asyncpg://${DbUser}:${DbPass}@localhost:${Port}/${DbName}"
$SyncUrl = "postgresql://${DbUser}:${DbPass}@localhost:${Port}/${DbName}"

$OriginalDatabaseUrl = $env:DATABASE_URL
$OriginalSyncUrl = $env:DATABASE_SYNC_URL

try {
    Write-Host "Starting $Image on localhost:$Port ($ContainerName)..."
    docker run --rm -d `
        --name $ContainerName `
        -e POSTGRES_USER=$DbUser `
        -e POSTGRES_PASSWORD=$DbPass `
        -e POSTGRES_DB=$DbName `
        -p "${Port}:5432" `
        $Image | Out-Null

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to start Docker container $ContainerName"
    }

    $Ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        docker exec $ContainerName pg_isready -U $DbUser -d $DbName *> $null
        if ($LASTEXITCODE -eq 0) {
            $Ready = $true
            break
        }
        Start-Sleep -Seconds 1
    }
    if (-not $Ready) {
        throw "Postgres container $ContainerName did not become ready within 30s."
    }

    $env:DATABASE_URL = $AsyncUrl
    $env:DATABASE_SYNC_URL = $SyncUrl

    Push-Location $BackendDir
    try {
        Write-Host "Running alembic upgrade head..."
        & $AlembicExe upgrade head
        if ($LASTEXITCODE -ne 0) { throw "alembic upgrade head failed" }

        Write-Host "Verifying pgvector extension, enums, nullable hashed_password, and ORM tables..."
        & $PythonExe -c @"
import os, uuid
import psycopg2
from db.models import Base

conn = psycopg2.connect(os.environ['DATABASE_SYNC_URL'])
cur = conn.cursor()

cur.execute("SELECT extname FROM pg_extension WHERE extname = 'vector';")
assert cur.fetchone() == ('vector',), 'pgvector extension missing'

cur.execute("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'userrole' ORDER BY e.enumsortorder;")
userroles = [r[0] for r in cur.fetchall()]
assert userroles == ['ADMIN', 'MANAGER', 'RECRUITER', 'CANDIDATE'], f'userrole mismatch: {userroles}'

cur.execute("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'candidatestatus' ORDER BY e.enumsortorder;")
cstatuses = [r[0] for r in cur.fetchall()]
assert cstatuses == ['SOURCED', 'SCREENED', 'INTERVIEWING', 'OFFERED', 'HIRED', 'REJECTED'], f'candidatestatus mismatch: {cstatuses}'

cur.execute("SELECT is_nullable FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'hashed_password';")
assert cur.fetchone() == ('YES',), 'users.hashed_password must be nullable at head'

cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
pg_tables = {r[0] for r in cur.fetchall()}
missing = set(Base.metadata.tables.keys()) - pg_tables
assert not missing, f'Missing ORM tables: {sorted(missing)}'

cur.execute(
    "INSERT INTO users (id, email, full_name, hashed_password, role, is_active, is_verified) VALUES (%s, %s, %s, NULL, 'RECRUITER', true, true);",
    (str(uuid.uuid4()), 'pg_verify_null@example.com', 'PG Verify User'),
)
conn.rollback()
cur.close()
conn.close()
print('OK: PG schema, pgvector, enums, and nullable hashed_password verified.')
"@
        if ($LASTEXITCODE -ne 0) { throw "Postgres schema inspection failed" }

        Write-Host "Running alembic downgrade base..."
        & $AlembicExe downgrade base
        if ($LASTEXITCODE -ne 0) { throw "alembic downgrade base failed" }

        Write-Host "Running alembic upgrade head again..."
        & $AlembicExe upgrade head
        if ($LASTEXITCODE -ne 0) { throw "alembic re-upgrade head failed" }
    }
    finally {
        Pop-Location
    }

    Write-Host "SUCCESS: Live Postgres migration round-trip passed."
}
finally {
    if ($null -eq $OriginalDatabaseUrl) { Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_URL = $OriginalDatabaseUrl }
    if ($null -eq $OriginalSyncUrl) { Remove-Item Env:\DATABASE_SYNC_URL -ErrorAction SilentlyContinue } else { $env:DATABASE_SYNC_URL = $OriginalSyncUrl }
    docker rm -f $ContainerName *> $null
}
