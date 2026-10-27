from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.expenses import Expense, ExpenseCategory, ExpenseStatus
from app.models.payments import ExpensePayment, PaymentMethod, PaymentStatus
from app.models.accounts import FinancialAccount, AccountType
from app.schemas.expenses import (
    ExpenseCreate,
    ExpenseResponse,
    ExpenseCategoryResponse,
)
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])


# ----- Schemas for bill payment -----
class ExpensePaymentCreate(BaseModel):
    payment_date: date
    amount_paise: int = Field(gt=0)
    payment_method: str = "cash"   # cash | bank_transfer | savings
    account_id: Optional[int] = None
    notes: Optional[str] = None


class ExpensePaymentResponse(BaseModel):
    id: int
    reference: str
    expense_id: int
    payment_date: date
    amount_paise: int
    payment_method: str
    account_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# Helper to resolve account for payment
_METHOD_ACCOUNT_CODE = {
    "cash": "1001",
    "bank_transfer": "1002",
    "savings": "1003",
}


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


@router.get("/{expense_id}/payments", response_model=list[ExpensePaymentResponse])
def list_expense_payments(expense_id: int, db: Session = Depends(get_db)):
    """List all payments made against an expense bill."""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    payments = (
        db.query(ExpensePayment)
        .filter(ExpensePayment.expense_id == expense_id, ExpensePayment.status == PaymentStatus.CONFIRMED)
        .order_by(ExpensePayment.payment_date.asc())
        .all()
    )
    return [
        ExpensePaymentResponse(
            id=p.id,
            reference=p.reference,
            expense_id=p.expense_id,
            payment_date=p.payment_date,
            amount_paise=p.amount_paise,
            payment_method=p.payment_method.value,
            account_id=p.account_id,
            notes=p.notes,
            created_at=p.created_at,
        )
        for p in payments
    ]


@router.post("/{expense_id}/payments", response_model=ExpensePaymentResponse, status_code=201)
def pay_expense_bill(expense_id: int, payload: ExpensePaymentCreate, db: Session = Depends(get_db)):
    """
    Settle (partially or fully) an expense bill.
    Journal entry: DR Accounts Payable (2001), CR Cash/Bank (1001/1002/1003).
    Updates expense status to PARTIAL or PAID automatically.
    """
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    if expense.status == ExpenseStatus.PAID:
        raise HTTPException(status_code=400, detail="Expense bill is already fully paid")
    if expense.status == ExpenseStatus.CANCELLED:
        raise HTTPException(status_code=400, detail="Cannot pay a cancelled expense")

    # How much has already been paid?
    already_paid = db.query(
        func.coalesce(func.sum(ExpensePayment.amount_paise), 0)
    ).filter(
        ExpensePayment.expense_id == expense_id,
        ExpensePayment.status == PaymentStatus.CONFIRMED,
    ).scalar() or 0

    remaining = expense.amount_paise - already_paid
    if payload.amount_paise > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Payment amount ({payload.amount_paise} paise) exceeds remaining balance ({remaining} paise). Outstanding: Rs. {remaining / 100:.2f}"
        )

    # Resolve credit account
    method_key = payload.payment_method.lower()
    if method_key not in _METHOD_ACCOUNT_CODE:
        raise HTTPException(status_code=400, detail=f"Invalid payment method. Use: cash, bank_transfer, savings")

    credit_code = _METHOD_ACCOUNT_CODE[method_key]

    # Find financial account for account_id lookup
    credit_account = db.query(FinancialAccount).filter(FinancialAccount.code == credit_code).first()
    credit_name = credit_account.name if credit_account else credit_code

    # Generate payment reference
    date_str = payload.payment_date.strftime("%Y%m%d")
    count = db.query(ExpensePayment).filter(ExpensePayment.reference.like(f"EP-{date_str}-%")).count()
    ref = f"EP-{date_str}-{count + 1:04d}"

    # Post double-entry: DR Accounts Payable (2001) — reduces liability, CR Cash/Bank — reduces asset
    entry = JournalService.post_entry(
        db,
        entry_date=payload.payment_date,
        description=f"Payment for {expense.reference}: {expense.description}",
        lines=[
            JournalLineInput("2001", "Accounts Payable — Suppliers", True, payload.amount_paise),
            JournalLineInput(credit_code, credit_name, False, payload.amount_paise),
        ],
        source_type="expense_payment",
        source_id=expense_id,
        notes=payload.notes,
    )

    # Determine method enum
    method_enum_map = {"cash": PaymentMethod.CASH, "bank_transfer": PaymentMethod.BANK_TRANSFER, "savings": PaymentMethod.OTHER}
    payment = ExpensePayment(
        reference=ref,
        expense_id=expense_id,
        payment_date=payload.payment_date,
        amount_paise=payload.amount_paise,
        payment_method=method_enum_map[method_key],
        account_id=credit_account.id if credit_account else None,
        status=PaymentStatus.CONFIRMED,
        notes=payload.notes,
        journal_entry_id=entry.id,
    )
    db.add(payment)
    db.flush()

    # Update expense status
    new_paid_total = already_paid + payload.amount_paise
    if new_paid_total >= expense.amount_paise:
        expense.status = ExpenseStatus.PAID
    else:
        expense.status = ExpenseStatus.PARTIAL

    db.commit()
    db.refresh(payment)

    return ExpensePaymentResponse(
        id=payment.id,
        reference=payment.reference,
        expense_id=payment.expense_id,
        payment_date=payment.payment_date,
        amount_paise=payment.amount_paise,
        payment_method=payment.payment_method.value,
        account_id=payment.account_id,
        notes=payment.notes,
        created_at=payment.created_at,
    )

