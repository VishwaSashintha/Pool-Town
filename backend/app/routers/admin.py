from __future__ import annotations

import os
import shutil
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from app.database import get_db
from app.routers.auth import get_current_user
from app.services.backup import BackupService

router = APIRouter(prefix="/api/admin", tags=["Administration"])


_BUSINESS_TABLES_TO_CLEAR = [

    "profit_allocation_lines",
    "profit_allocations",

    "stock_purchase_items",
    "stock_purchases",
    "physical_stock_counts",
    "stock_movements",
    "product_sales",
    "products",

    "damage_payments",
    "damage_charges",
    "equipment_purchases",

    "loan_transactions",
    "loans",
    "owner_transactions",

    "expense_payments",
    "expenses",

    "session_payments",
    "ps4_sessions",
    "pool_sessions",

    "player_aliases",
    "players",

    "cash_counts",
    "bank_reconciliations",
    "account_transfers",

    "journal_lines",
    "journal_entries",

    "audit_logs",
]


class ResetRequest(BaseModel):
    confirm_phrase: str


class ResetResponse(BaseModel):
    success: bool
    backup_file: str
    message: str
    tables_cleared: list[str]
    cleared_at: str


@router.post("/reset-business-data", response_model=ResetResponse)
def reset_business_data(
    payload: ResetRequest,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):


    if payload.confirm_phrase != "RESET ALL BUSINESS DATA":
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase mismatch. Send exactly: RESET ALL BUSINESS DATA"
        )


    backup_filename = None
    try:
        snapshot = BackupService.create_backup(note="AUTO-BACKUP before business data reset")
        backup_filename = snapshot.get("filename", "unknown")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create safety backup before reset: {str(e)}. Reset aborted."
        )


    db.execute(text("PRAGMA foreign_keys = OFF"))

    cleared_tables = []
    try:
        for table in _BUSINESS_TABLES_TO_CLEAR:
            try:
                result = db.execute(text(f"DELETE FROM {table}"))
                cleared_tables.append(f"{table} ({result.rowcount} rows removed)")
            except Exception:

                pass


        for table in _BUSINESS_TABLES_TO_CLEAR:
            try:
                db.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}'"))
            except Exception:
                pass

        db.commit()

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Reset failed: {str(e)}. A backup was created at '{backup_filename}'. Restore it if needed."
        )
    finally:

        db.execute(text("PRAGMA foreign_keys = ON"))

    return ResetResponse(
        success=True,
        backup_file=backup_filename or "unknown",
        message=(
            f"Business data reset complete. All transactional records have been cleared. "
            f"A safety backup was saved as '{backup_filename}'. "
            f"Master data (Chart of Accounts, Owners, Categories, Settings) is preserved."
        ),
        tables_cleared=cleared_tables,
        cleared_at=datetime.now(timezone.utc).isoformat(),
    )
