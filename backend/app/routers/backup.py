import os
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.backup import BackupService
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/backup", tags=["Database Backup & Restore"])


class BackupCreateRequest(BaseModel):
    note: Optional[str] = "Manual backup from settings"


class BackupRestoreRequest(BaseModel):
    filename: str


@router.post("/create", status_code=201)
def create_backup(
    payload: Optional[BackupCreateRequest] = None,
    current_user: str = Depends(get_current_user),
):
    try:
        note = payload.note if payload else "Manual backup"
        res = BackupService.create_backup(note=note)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
def list_backups(current_user: str = Depends(get_current_user)):
    return BackupService.list_backups()


@router.get("/download/{filename}")
def download_backup(filename: str):
    safe_filename = os.path.basename(filename)
    if not safe_filename.endswith(".db"):
        raise HTTPException(status_code=400, detail="Invalid backup file name")
    backup_dir = BackupService.get_backup_dir()
    filepath = os.path.join(backup_dir, safe_filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Backup file not found")
    return FileResponse(filepath, media_type="application/x-sqlite3", filename=safe_filename)


@router.post("/restore")
def restore_backup(
    payload: BackupRestoreRequest,
    current_user: str = Depends(get_current_user),
):
    try:
        res = BackupService.restore_backup(payload.filename)
        return res
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

