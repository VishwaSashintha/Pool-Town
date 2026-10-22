import os
import sqlite3
import tempfile
import pytest
from app.services.backup import BackupService


@pytest.fixture
def temp_db():
    fd, path = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    # Initialize basic sqlite tables
    conn = sqlite3.connect(path)
    conn.execute("CREATE TABLE test_data (id INTEGER PRIMARY KEY, note TEXT)")
    conn.execute("INSERT INTO test_data (note) VALUES ('test entry 1')")
    conn.commit()
    conn.close()

    yield path

    if os.path.exists(path):
        os.remove(path)


def test_backup_creation_and_integrity(temp_db):
    res = BackupService.create_backup(note="Pytest automated backup", db_path=temp_db)
    assert res["is_valid"] is True
    assert os.path.exists(res["path"])
    assert res["size_bytes"] > 0
    assert res["filename"].startswith("backup_")

    # Verify backup is in list
    backups = BackupService.list_backups()
    assert any(b["filename"] == res["filename"] for b in backups)


def test_backup_restore_and_safeguard(temp_db):
    # Create an initial backup from temp_db
    b1 = BackupService.create_backup(note="Pre-restore test", db_path=temp_db)
    
    # Create another temp destination path to restore into
    fd, restore_target = tempfile.mkstemp(suffix=".db")
    os.close(fd)
    try:
        restore_res = BackupService.restore_backup(b1["filename"], target_db_path=restore_target)
        assert restore_res["status"] == "success"
        assert restore_res["restored_from"] == b1["filename"]
        # Verify restored DB integrity
        assert BackupService.verify_integrity(restore_target) is True
    finally:
        if os.path.exists(restore_target):
            os.remove(restore_target)

