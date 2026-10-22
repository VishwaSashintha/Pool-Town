from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.expenses import Expense, ExpenseCategory, ExpenseStatus
from app.models.payments import ExpensePayment, PaymentMethod, PaymentStatus
from app.schemas.expenses import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseCategoryResponse,
)
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


@router.get("/categories", response_model=list[ExpenseCategoryResponse])
def list_categories(db: Session = Depends(get_db)):
    return db.query(ExpenseCategory).filter(ExpenseCategory.is_active == True).order_by(ExpenseCategory.name.asc()).all()


@router.get("", response_model=list[ExpenseResponse])
def list_expenses(db: Session = Depends(get_db)):
    expenses = db.query(Expense).order_by(Expense.expense_date.desc(), Expense.id.desc()).all()
    results = []
    for exp in expenses:
        paid = db.query(
            func.coalesce(func.sum(ExpensePayment.amount_paise), 0)
        ).filter(
            ExpensePayment.expense_id == exp.id,
            ExpensePayment.status == PaymentStatus.CONFIRMED,
        ).scalar() or 0

        results.append(
            ExpenseResponse(
                id=exp.id,
                reference=exp.reference,
                expense_date=exp.expense_date,
                category_id=exp.category_id,
                category_name=exp.category.name if exp.category else None,
                description=exp.description,
                amount_paise=exp.amount_paise,
                payee=exp.payee,
                status=exp.status.value,
                paid_amount_paise=paid,
                is_asset=exp.is_asset,
                notes=exp.notes,
                created_at=exp.created_at,
            )
        )
    return results


@router.post("", response_model=ExpenseResponse, status_code=201)
def create_expense(payload: ExpenseCreate, db: Session = Depends(get_db)):
    category = db.query(ExpenseCategory).filter(ExpenseCategory.id == payload.category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Expense category not found")

    date_str = payload.expense_date.strftime("%Y%m%d")
    count = db.query(Expense).filter(Expense.reference.like(f"EXP-{date_str}-%")).count()
    reference = f"EXP-{date_str}-{count + 1:04d}"

    expense = Expense(
        reference=reference,
        expense_date=payload.expense_date,
        category_id=payload.category_id,
        description=payload.description,
        amount_paise=payload.amount_paise,
        payee=payload.payee,
        status=ExpenseStatus.UNPAID,
        is_asset=payload.is_asset,
        asset_account_code=payload.asset_account_code,
        notes=payload.notes,
    )
    db.add(expense)
    db.flush()

    # Determine debit account code: if asset -> asset account, else category account code or 6011 Other
    debit_code = payload.asset_account_code if payload.is_asset else (category.account_code or "6011")
    debit_name = f"Asset {debit_code}" if payload.is_asset else category.name

    # Post bill entry: DR Expense/Asset, CR Accounts Payable (2001)
    entry = JournalService.post_entry(
        db,
        entry_date=payload.expense_date,
        description=f"Expense bill {reference}: {payload.description}",
        lines=[
            JournalLineInput(debit_code, debit_name, True, payload.amount_paise),
            JournalLineInput("2001", "Accounts Payable — Suppliers", False, payload.amount_paise),
        ],
        source_type="expense",
        source_id=expense.id,
    )
    expense.journal_entry_id = entry.id

    db.commit()
    db.refresh(expense)

    return ExpenseResponse(
        id=expense.id,
        reference=expense.reference,
        expense_date=expense.expense_date,
        category_id=expense.category_id,
        category_name=category.name,
        description=expense.description,
        amount_paise=expense.amount_paise,
        payee=expense.payee,
        status=expense.status.value,
        paid_amount_paise=0,
        is_asset=expense.is_asset,
        notes=expense.notes,
        created_at=expense.created_at,
    )
