"""
Admin router — database reset for clean client startup.
REQUIRES authentication. Creates an automatic backup before clearing business data.
Only clears transactional/business data; preserves master data (COA, owners, categories, settings).
"""
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

# Tables to clear (business transactional data — ORDER matters for FK constraints)
# Never deletes: financial_accounts, expense_categories, product_categories, suppliers, owners, app_settings, alembic_version
_BUSINESS_TABLES_TO_CLEAR = [
    # Profit allocations
    "profit_allocation_lines",
    "profit_allocations",
    # Stock and inventory
    "stock_purchase_items",
    "stock_purchases",
    "physical_stock_counts",
    "stock_movements",
    "product_sales",
    "products",
    # Damage charges and equipment
    "damage_payments",
    "damage_charges",
    "equipment_purchases",
    # Loans & owner transactions
    "loan_transactions",
    "loans",
    "owner_transactions",
    # Expenses
    "expense_payments",
    "expenses",
    # Sessions & payments
    "session_payments",
    "ps4_sessions",
    "pool_sessions",
    # Players
    "player_aliases",
    "players",
    # Financial transfers & reconciliations
    "cash_counts",
    "bank_reconciliations",
    "account_transfers",
    # Journal entries (all account balances are dynamically computed from journal lines, so clearing zeroes them)
    "journal_lines",
    "journal_entries",
    # Audit logs
    "audit_logs",
]


class ResetRequest(BaseModel):
    confirm_phrase: str  # Must be exactly "RESET ALL BUSINESS DATA" to proceed


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
    """
    IRREVERSIBLE: Clears all business transactional data for clean client startup.

    Requirements:
    - Must be authenticated (X-Auth-Token header required)
    - Must provide confirmation phrase: "RESET ALL BUSINESS DATA"
    - Automatically creates a backup before deletion
    - Preserves: Chart of Accounts, Owners, Expense Categories, App Settings
    - Clears: Players, Sessions, Payments, Expenses, Inventory, Loans, Journal Entries, etc.
    - Resets all account opening balances to zero
    """
    if payload.confirm_phrase != "RESET ALL BUSINESS DATA":
        raise HTTPException(
            status_code=400,
            detail="Confirmation phrase mismatch. Send exactly: RESET ALL BUSINESS DATA"
        )

    # Step 1: Create automatic backup before reset
    backup_filename = None
    try:
        snapshot = BackupService.create_backup(note="AUTO-BACKUP before business data reset")
        backup_filename = snapshot.get("filename", "unknown")
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create safety backup before reset: {str(e)}. Reset aborted."
        )

    # Step 2: Disable foreign key checks temporarily (SQLite)
    db.execute(text("PRAGMA foreign_keys = OFF"))

    cleared_tables = []
    try:
        for table in _BUSINESS_TABLES_TO_CLEAR:
            try:
                result = db.execute(text(f"DELETE FROM {table}"))
                cleared_tables.append(f"{table} ({result.rowcount} rows removed)")
            except Exception:
                # Table may not exist (migration-dependent) — skip silently
                pass

        # Reset sequence counters (SQLite rowid auto-increment reset)
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
        # Re-enable foreign key enforcement
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
