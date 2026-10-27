# ============================================================
# DVT Talent AI — Windows / PowerShell Database & Storage Backup Script
# Usage: .\scripts\backup_db.ps1
# Supports Dockerized PostgreSQL and local development backups
# ============================================================
[CmdletBinding()]
param(
    [string]$ComposeFile = "docker-compose.prod.yml",
    [string]$BackupDir = "backups/postgres",
    [string]$StorageBackupDir = "backups/storage",
    [string]$DbName = "dvt_talent",
    [string]$DbUser = "dvt_user",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$Timestamp = (Get-Date).ToString("yyyyMMdd_HHmmss")
$BackupFile = Join-Path $BackupDir "dvt_talent_${Timestamp}.sql.gz"
$TmpBackupFile = Join-Path $BackupDir ".dvt_talent_${Timestamp}.sql.gz.tmp"

$StorageBackupFile = Join-Path $StorageBackupDir "storage_${Timestamp}.tar.gz"
$TmpStorageBackupFile = Join-Path $StorageBackupDir ".storage_${Timestamp}.tar.gz.tmp"

# Ensure backup directories exist
New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null
New-Item -ItemType Directory -Path $StorageBackupDir -Force | Out-Null

function Cleanup-TempFiles {
    if (Test-Path $TmpBackupFile) {
        Remove-Item $TmpBackupFile -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $TmpStorageBackupFile) {
        Remove-Item $TmpStorageBackupFile -Force -ErrorAction SilentlyContinue
    }
}

try {
    # ------------------------------------------------------------
    # Step 1: Database Backup
    # ------------------------------------------------------------
    Write-Host "📦 [1/2] Creating database backup ($DbName)..." -ForegroundColor Cyan

    $dockerDbRunning = $false
    try {
        $containers = docker compose -f $ComposeFile ps -q db 2>$null
        if ($containers) { $dockerDbRunning = $true }
    } catch {}

    if ($dockerDbRunning) {
        Write-Host "   Using Dockerized PostgreSQL container..." -ForegroundColor Gray
        $dumpCmd = "docker compose -f $ComposeFile exec -T db pg_dump -U $DbUser -d $DbName --clean --if-exists"
        
        # Pipe to gzip
        $psi = New-Object System.Diagnostics.ProcessStartInfo
        $psi.FileName = "cmd.exe"
        $psi.Arguments = "/c `"$dumpCmd`""
        $psi.RedirectStandardOutput = $true
        $psi.UseShellExecute = $false
        $proc = [System.Diagnostics.Process]::Start($psi)

        $outFileStream = [System.IO.File]::Create($TmpBackupFile)
        $gzipStream = New-Object System.IO.Compression.GZipStream($outFileStream, [System.IO.Compression.CompressionMode]::Compress)
        $proc.StandardOutput.BaseStream.CopyTo($gzipStream)
        $gzipStream.Close()
        $outFileStream.Close()
        $proc.WaitForExit()
        
        if ($proc.ExitCode -ne 0) {
            throw "pg_dump failed with exit code $($proc.ExitCode)"
        }
    } else {
        # Local SQLite fallback for developer workstations
        if (Test-Path "dvt_talent.db") {
            Write-Host "   Local SQLite database detected (dvt_talent.db)..." -ForegroundColor Gray
            $inFileStream = [System.IO.File]::OpenRead("dvt_talent.db")
            $outFileStream = [System.IO.File]::Create($TmpBackupFile)
            $gzipStream = New-Object System.IO.Compression.GZipStream($outFileStream, [System.IO.Compression.CompressionMode]::Compress)
            $inFileStream.CopyTo($gzipStream)
            $gzipStream.Close()
            $outFileStream.Close()
            $inFileStream.Close()
        } else {
            throw "Neither Docker PostgreSQL nor local dvt_talent.db found."
        }
    }

    # Verify gzip integrity
    $testStream = [System.IO.File]::OpenRead($TmpBackupFile)
    $verifyGzip = New-Object System.IO.Compression.GZipStream($testStream, [System.IO.Compression.CompressionMode]::Decompress)
    $buffer = New-Object byte[] 4096
    while ($verifyGzip.Read($buffer, 0, $buffer.Length) -gt 0) {}
    $verifyGzip.Close()
    $testStream.Close()

    # ------------------------------------------------------------
    # Step 2: Storage Backup (Tombstones & Uploads)
    # ------------------------------------------------------------
    Write-Host "📦 [2/2] Creating storage archive..." -ForegroundColor Cyan
    
    # Use tar (native on Windows 10/11)
    $tarAvailable = (Get-Command tar -ErrorAction SilentlyContinue)
    if ($tarAvailable) {
        $storageItems = @()
        if (Test-Path "storage") { $storageItems += "storage" }
        if (Test-Path "uploads") { $storageItems += "uploads" }
        if (Test-Path "backend/storage") { $storageItems += "backend/storage" }
        if (Test-Path "backend/uploads") { $storageItems += "backend/uploads" }

        if ($storageItems.Count -gt 0) {
            tar -czf "$TmpStorageBackupFile" $storageItems
        } else {
            # Minimal empty archive
            New-Item -ItemType Directory -Path "$BackupDir/.empty_store" -Force | Out-Null
            tar -czf "$TmpStorageBackupFile" -C "$BackupDir" ".empty_store"
            Remove-Item "$BackupDir/.empty_store" -Force -Recurse
        }
    } else {
        # Fallback zip archive
        Compress-Archive -Path @("storage", "uploads") -DestinationPath $TmpStorageBackupFile -Force
    }

    # ------------------------------------------------------------
    # Step 3: Atomic Promotion
    # ------------------------------------------------------------
    Move-Item -Path $TmpBackupFile -Destination $BackupFile -Force
    Move-Item -Path $TmpStorageBackupFile -Destination $StorageBackupFile -Force

    Write-Host "✅ Database backup created: $BackupFile" -ForegroundColor Green
    Write-Host "✅ Storage backup created:  $StorageBackupFile" -ForegroundColor Green

    # ------------------------------------------------------------
    # Step 4: Prune Old Backups
    # ------------------------------------------------------------
    $cutoff = (Get-Date).AddDays(-$RetentionDays)
    Get-ChildItem -Path $BackupDir -Filter "*.gz" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force
    Get-ChildItem -Path $StorageBackupDir -Filter "*.gz" | Where-Object { $_.LastWriteTime -lt $cutoff } | Remove-Item -Force

    Write-Host "🧹 Pruned backups older than $RetentionDays days." -ForegroundColor Gray
} catch {
    Write-Host "🚨 Backup failed: $_" -ForegroundColor Red
    Cleanup-TempFiles
    exit 1
}
