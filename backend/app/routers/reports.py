"""
Reports router — daily, weekly, monthly summaries with real backend data.
All calculations are backend-authoritative.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentStatus, PaymentMethod
from app.models.expenses import Expense, ExpenseStatus
from app.models.inventory import StockMovement, StockMovementType
from app.models.owners import Loan, LoanStatus, LoanTransaction, LoanTransactionType
from app.services.journal import JournalService

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def _date_range_for_day(d: date):
    return d, d


def _date_range_for_week(ref: date):
    # Week starting Monday
    monday = ref - timedelta(days=ref.weekday())
    sunday = monday + timedelta(days=6)
    return monday, sunday


def _date_range_for_month(year: int, month: int):
    from calendar import monthrange
    last_day = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last_day)


def _sessions_summary(db: Session, start: date, end: date):
    pool = (
        db.query(func.count(PoolSession.id), func.coalesce(func.sum(PoolSession.final_charge_paise), 0))
        .filter(PoolSession.session_date >= start, PoolSession.session_date <= end)
        .one()
    )
    ps4 = (
        db.query(func.count(PS4Session.id), func.coalesce(func.sum(PS4Session.final_charge_paise), 0))
        .filter(PS4Session.session_date >= start, PS4Session.session_date <= end)
        .one()
    )
    return {
        "pool_sessions": pool[0],
        "pool_revenue_paise": pool[1],
        "ps4_sessions": ps4[0],
        "ps4_revenue_paise": ps4[1],
        "total_session_revenue_paise": pool[1] + ps4[1],
    }


def _payments_summary(db: Session, start: date, end: date):
    result = (
        db.query(
            func.coalesce(func.sum(SessionPayment.amount_paise), 0),
            SessionPayment.payment_method,
        )
        .filter(
            SessionPayment.collection_date >= start,
            SessionPayment.collection_date <= end,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        )
        .group_by(SessionPayment.payment_method)
        .all()
    )
    cash_collected = 0
    bank_collected = 0
    for amount, method in result:
        if method == PaymentMethod.CASH:
            cash_collected += amount
        else:
            bank_collected += amount
    return {
        "cash_collected_paise": cash_collected,
        "bank_collected_paise": bank_collected,
        "total_collected_paise": cash_collected + bank_collected,
    }


def _outstanding_summary(db: Session):
    """Calculate total outstanding across all unpaid/partial sessions."""
    total_outstanding = 0

    pool_sessions = db.query(PoolSession).filter(PoolSession.status != SessionStatus.PAID).all()
    for s in pool_sessions:
        paid = db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0)).filter(
            SessionPayment.session_type == "pool",
            SessionPayment.session_id == s.id,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        ).scalar() or 0
        total_outstanding += max(0, s.final_charge_paise - paid)

    ps4_sessions = db.query(PS4Session).filter(PS4Session.status != SessionStatus.PAID).all()
    for s in ps4_sessions:
        paid = db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0)).filter(
            SessionPayment.session_type == "ps4",
            SessionPayment.session_id == s.id,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        ).scalar() or 0
        total_outstanding += max(0, s.final_charge_paise - paid)

    return total_outstanding


def _expenses_summary(db: Session, start: date, end: date):
    total = (
        db.query(func.coalesce(func.sum(Expense.amount_paise), 0))
        .filter(Expense.expense_date >= start, Expense.expense_date <= end)
        .scalar()
        or 0
    )
    unpaid = (
        db.query(func.coalesce(func.sum(Expense.amount_paise), 0))
        .filter(
            Expense.expense_date >= start,
            Expense.expense_date <= end,
            Expense.status == ExpenseStatus.UNPAID,
        )
        .scalar()
        or 0
    )
    return {
        "total_expenses_paise": total,
        "unpaid_expenses_paise": unpaid,
        "paid_expenses_paise": total - unpaid,
    }


def _drinks_summary(db: Session, start: date, end: date):
    """Sum sales movements for drinks in date range."""

    movements = (
        db.query(StockMovement)
        .filter(
            StockMovement.movement_type == StockMovementType.SALE,
            StockMovement.event_date >= start,
            StockMovement.event_date <= end,
        )
        .all()
    )
    total_bottles = sum(abs(m.quantity_change) for m in movements)
    total_value = sum(
        abs(m.quantity_change) * (m.unit_cost_paise or 0) for m in movements
    )
    # Try to get selling price from Product for revenue
    from app.models.inventory import Product
    total_revenue = 0
    for m in movements:
        product = db.query(Product).filter(Product.id == m.product_id).first()
        if product:
            total_revenue += abs(m.quantity_change) * product.selling_price_paise
        else:
            total_revenue += abs(m.quantity_change) * (m.unit_cost_paise or 0)
    return {
        "drinks_bottles_sold": total_bottles,
        "drinks_revenue_paise": total_revenue,
    }


def _account_balances(db: Session, as_of: Optional[date] = None):
    cash = JournalService.get_account_balance(db, "1001", as_of_date=as_of)
    bank = JournalService.get_account_balance(db, "1002", as_of_date=as_of)
    savings = JournalService.get_account_balance(db, "1003", as_of_date=as_of)
    return {
        "cash_balance_paise": cash,
        "bank_balance_paise": bank,
        "savings_balance_paise": savings,
        "total_liquid_paise": cash + bank + savings,
    }


def _loan_summary(db: Session):
    loans = db.query(Loan).filter(Loan.status == LoanStatus.ACTIVE).all()
    total_outstanding = 0
    for loan in loans:
        repaid = (
            db.query(func.coalesce(func.sum(LoanTransaction.amount_paise), 0))
            .filter(
                LoanTransaction.loan_id == loan.id,
                LoanTransaction.transaction_type == LoanTransactionType.PRINCIPAL_REPAYMENT,
            )
            .scalar()
            or 0
        )
        total_outstanding += max(0, loan.original_principal_paise - repaid)
    return {
        "active_loans_count": len(loans),
        "total_loan_outstanding_paise": total_outstanding,
    }


# ============================================================
# ENDPOINTS
# ============================================================


@router.get("/daily")
def daily_report(
    report_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    d = report_date or date.today()
    start, end = _date_range_for_day(d)
    sessions = _sessions_summary(db, start, end)
    payments = _payments_summary(db, start, end)
    expenses = _expenses_summary(db, start, end)
    drinks = _drinks_summary(db, start, end)
    balances = _account_balances(db, as_of=end)
    outstanding = _outstanding_summary(db)

    total_revenue = (
        sessions["total_session_revenue_paise"] + drinks["drinks_revenue_paise"]
    )
    return {
        "report_date": d.isoformat(),
        "period": "daily",
        **sessions,
        **payments,
        **expenses,
        **drinks,
        **balances,
        "total_outstanding_ar_paise": outstanding,
        "total_revenue_paise": total_revenue,
        "net_income_paise": max(0, total_revenue - expenses["total_expenses_paise"]),
    }


@router.get("/weekly")
def weekly_report(
    ref_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    d = ref_date or date.today()
    start, end = _date_range_for_week(d)
    sessions = _sessions_summary(db, start, end)
    payments = _payments_summary(db, start, end)
    expenses = _expenses_summary(db, start, end)
    drinks = _drinks_summary(db, start, end)
    balances = _account_balances(db, as_of=end)

    total_revenue = sessions["total_session_revenue_paise"] + drinks["drinks_revenue_paise"]
    return {
        "week_start": start.isoformat(),
        "week_end": end.isoformat(),
        "period": "weekly",
        **sessions,
        **payments,
        **expenses,
        **drinks,
        **balances,
        "total_revenue_paise": total_revenue,
        "net_income_paise": max(0, total_revenue - expenses["total_expenses_paise"]),
    }


@router.get("/monthly")
def monthly_report(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
):
    today = date.today()
    y = year or today.year
    m = month or today.month
    start, end = _date_range_for_month(y, m)

    sessions = _sessions_summary(db, start, end)
    payments = _payments_summary(db, start, end)
    expenses = _expenses_summary(db, start, end)
    drinks = _drinks_summary(db, start, end)
    balances = _account_balances(db, as_of=end)
    loans = _loan_summary(db)

    total_revenue = sessions["total_session_revenue_paise"] + drinks["drinks_revenue_paise"]
    net_income = max(0, total_revenue - expenses["total_expenses_paise"])

    # Profit allocation preview (40% savings, 20% each owner)
    savings_share = round(net_income * 0.4)
    owner_share_each = round(net_income * 0.2)
    vishwa_share = max(0, net_income - savings_share - owner_share_each * 2)

    return {
        "year": y,
        "month": m,
        "month_name": start.strftime("%B %Y"),
        "period_start": start.isoformat(),
        "period_end": end.isoformat(),
        "period": "monthly",
        **sessions,
        **payments,
        **expenses,
        **drinks,
        **balances,
        **loans,
        "total_revenue_paise": total_revenue,
        "net_income_paise": net_income,
        "profit_allocation": {
            "savings_paise": savings_share,
            "akash_paise": owner_share_each,
            "pasan_paise": owner_share_each,
            "vishwa_paise": vishwa_share,
        },
    }


@router.get("/summary")
def dashboard_summary(
    report_date: date = Query(default=None),
    db: Session = Depends(get_db),
):
    """Dashboard-level summary: today's stats + overall balances."""
    d = report_date or date.today()
    start, end = _date_range_for_day(d)

    sessions = _sessions_summary(db, start, end)
    payments = _payments_summary(db, start, end)
    expenses = _expenses_summary(db, start, end)
    drinks = _drinks_summary(db, start, end)
    balances = _account_balances(db)
    loans = _loan_summary(db)
    outstanding = _outstanding_summary(db)

    total_revenue = sessions["total_session_revenue_paise"] + drinks["drinks_revenue_paise"]

    return {
        "report_date": d.isoformat(),
        **sessions,
        **payments,
        **expenses,
        **drinks,
        **balances,
        **loans,
        "total_outstanding_ar_paise": outstanding,
        "total_revenue_paise": total_revenue,
    }
