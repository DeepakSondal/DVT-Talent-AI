"""
DVT Talent AI — Disaster Recovery Automation & Drill Verification Test Suite
Verifies:
1. Gzip archive integrity validation logic (CRC32, truncation, corrupted header).
2. Tar safety inspection (traversal rejection, absolute path blocks).
3. Phase 02 artifacts existence and configuration sanity (PLAN.md, dvt_backup.cron, backup_db.ps1).
"""
import gzip
import io
import tarfile
from pathlib import Path

from scripts.run_backup_drill import (
    test_gzip_integrity as verify_gzip_integrity,
)
from scripts.run_backup_drill import (
    test_tar_safety as verify_tar_safety,
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent

def test_backup_archive_integrity_check(tmp_path):
    """Test Case 1: Verifies gzip integrity checker accepts valid gzip and rejects truncated/corrupted files."""
    valid_gz = tmp_path / "valid.sql.gz"
    with gzip.open(valid_gz, "wb") as f:
        f.write(b"SELECT * FROM candidates;")
    assert verify_gzip_integrity(valid_gz) is True

    corrupt_gz = tmp_path / "corrupt.sql.gz"
    corrupt_gz.write_bytes(b"\x1f\x8b\x08\x00corrupted_truncated_gzip_payload")
    assert verify_gzip_integrity(corrupt_gz) is False


def test_tar_safety_traversal_detection(tmp_path):
    """Test Case 2: Verifies tar inspection blocks directory traversal and absolute path injection."""
    # 1. Safe archive
    safe_tar = tmp_path / "safe.tar.gz"
    with tarfile.open(safe_tar, "w:gz") as tar:
        data = b"safe ledger line"
        ti = tarfile.TarInfo("storage/erasure_tombstones.jsonl")
        ti.size = len(data)
        tar.addfile(ti, io.BytesIO(data))
    assert verify_tar_safety(safe_tar) is True

    # 2. Forbidden traversal path (../)
    traversal_tar = tmp_path / "traversal.tar.gz"
    with tarfile.open(traversal_tar, "w:gz") as tar:
        data = b"malicious escape"
        ti = tarfile.TarInfo("../../../etc/shadow")
        ti.size = len(data)
        tar.addfile(ti, io.BytesIO(data))
    assert verify_tar_safety(traversal_tar) is False

    # 3. Forbidden absolute path (/etc)
    absolute_tar = tmp_path / "absolute.tar.gz"
    with tarfile.open(absolute_tar, "w:gz") as tar:
        data = b"malicious root escape"
        ti = tarfile.TarInfo("/etc/passwd")
        ti.size = len(data)
        tar.addfile(ti, io.BytesIO(data))
    assert verify_tar_safety(absolute_tar) is False


def test_disaster_recovery_plan_and_cron_artifacts():
    """Test Case 3: Verifies all Phase 02 operational and documentation deliverables are intact."""
    plan_path = PROJECT_ROOT / ".planning" / "phases" / "02-disaster-recovery-remediation" / "PLAN.md"
    assert plan_path.is_file(), "Phase 02 PLAN.md must exist."
    plan_content = plan_path.read_text(encoding="utf-8")
    assert "Disaster Recovery" in plan_content
    assert "Anti-Resurrection" in plan_content

    cron_path = PROJECT_ROOT / "scripts" / "dvt_backup.cron"
    assert cron_path.is_file(), "scripts/dvt_backup.cron must exist."
    cron_content = cron_path.read_text(encoding="utf-8")
    assert "backup_db.sh" in cron_content

    ps1_path = PROJECT_ROOT / "scripts" / "backup_db.ps1"
    assert ps1_path.is_file(), "scripts/backup_db.ps1 must exist."

    systemd_service = PROJECT_ROOT / "scripts" / "systemd" / "dvt-backup.service"
    systemd_timer = PROJECT_ROOT / "scripts" / "systemd" / "dvt-backup.timer"
    assert systemd_service.is_file(), "scripts/systemd/dvt-backup.service must exist."
    assert systemd_timer.is_file(), "scripts/systemd/dvt-backup.timer must exist."
