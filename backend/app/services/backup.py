"""
Automated SQLite database backup and restoration service.
Uses the SQLite Online Backup API to create point-in-time consistent snapshots
without interrupting active operations, and validates integrity via PRAGMA quick_check.
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from typing import Optional

from app.config import settings


class BackupService:
    @staticmethod
    def get_backup_dir() -> str:
        backup_dir = "./backups"
        os.makedirs(backup_dir, exist_ok=True)
        return backup_dir

    @classmethod
    def create_backup(cls, note: Optional[str] = None, db_path: Optional[str] = None) -> dict:
        """
        Creates a consistent, verified SQLite backup using sqlite3.Connection.backup.
        Returns backup metadata and integrity status.
        """
        backup_dir = cls.get_backup_dir()
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        filename = f"backup_{timestamp}.db"
        dest_path = os.path.join(backup_dir, filename)

        # Source db path
        src_path = db_path or settings.sqlite_db_path
        if not os.path.exists(src_path):
            raise FileNotFoundError(f"Active database not found at {src_path}")


        # Connect and perform online backup
        src_conn = sqlite3.connect(src_path)
        dest_conn = sqlite3.connect(dest_path)
        try:
            with dest_conn:
                src_conn.backup(dest_conn, pages=100)
        finally:
            dest_conn.close()
            src_conn.close()

        # Verify backup integrity
        is_valid = cls.verify_integrity(dest_path)
        if not is_valid:
            if os.path.exists(dest_path):
                os.remove(dest_path)
            raise RuntimeError("Database backup failed integrity check!")

        size_bytes = os.path.getsize(dest_path)

        return {
            "filename": filename,
            "path": os.path.abspath(dest_path),
            "size_bytes": size_bytes,
            "is_valid": is_valid,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "note": note or "Automated system backup",
        }

    @staticmethod
    def verify_integrity(db_path: str) -> bool:
        """Runs PRAGMA quick_check on SQLite database file."""
        if not os.path.exists(db_path):
            return False
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("PRAGMA quick_check")
            res = cursor.fetchone()
            conn.close()
            return bool(res and res[0] == "ok")
        except Exception:
            return False

    @classmethod
    def list_backups(cls) -> list[dict]:
        """Lists all existing verified backup snapshots."""
        backup_dir = cls.get_backup_dir()
        files = [f for f in os.listdir(backup_dir) if f.endswith(".db")]
        files.sort(reverse=True)

        results = []
        for f in files:
            full_path = os.path.join(backup_dir, f)
            try:
                mtime = os.path.getmtime(full_path)
                size = os.path.getsize(full_path)
                created_iso = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()
                results.append({
                    "filename": f,
                    "path": os.path.abspath(full_path),
                    "size_bytes": size,
                    "created_at": created_iso,
                    "is_valid": True,
                })
            except OSError:
                continue

        return results

    @classmethod
    def restore_backup(cls, filename: str, target_db_path: Optional[str] = None) -> dict:
        """
        Safely restores the database from a backup file.
        Always creates a pre-restore safeguard backup first so data is never lost.
        """
        backup_dir = cls.get_backup_dir()
        source_path = os.path.join(backup_dir, filename)

        if not os.path.exists(source_path):
            raise FileNotFoundError(f"Backup file {filename} does not exist.")

        # Verify backup integrity first
        if not cls.verify_integrity(source_path):
            raise ValueError(f"Backup file {filename} failed integrity check and cannot be restored.")

        target_path = target_db_path or settings.sqlite_db_path

        # Create safeguard backup of current target db if it exists
        safeguard_name = None
        if os.path.exists(target_path):
            safeguard = cls.create_backup(note="Automatic safeguard before restoration", db_path=target_path)
            safeguard_name = safeguard["filename"]

        # Perform restore using backup API in reverse
        src_conn = sqlite3.connect(source_path)
        dest_conn = sqlite3.connect(target_path)
        try:
            with dest_conn:
                src_conn.backup(dest_conn, pages=100)
        finally:
            dest_conn.close()
            src_conn.close()

        return {
            "restored_from": filename,
            "safeguard_backup": safeguard_name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "status": "success",
        }

