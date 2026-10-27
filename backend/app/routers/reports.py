"""
Reports router — daily, weekly, monthly summaries with real backend data.
All calculations are backend-authoritative.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from app.services import excel_export

from app.database import get_db
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentStatus, PaymentMethod
from app.models.expenses import Expense, ExpenseStatus, ExpenseCategory
from app.models.inventory import (
    StockMovement, StockMovementType, ProductSale, Product, ProductCategory, PhysicalStockCount
)
from app.models.owners import Loan, LoanStatus, LoanTransaction, LoanTransactionType
from app.services.journal import JournalService
from app.routers.drinks import _get_stock_on_hand

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
        .filter(
            PoolSession.session_date >= start,
            PoolSession.session_date <= end,
            PoolSession.status != SessionStatus.CANCELLED,
        )
        .one()
    )
    ps4 = (
        db.query(func.count(PS4Session.id), func.coalesce(func.sum(PS4Session.final_charge_paise), 0))
        .filter(
            PS4Session.session_date >= start,
            PS4Session.session_date <= end,
            PS4Session.status != SessionStatus.CANCELLED,
        )
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
    """Calculate total outstanding across all active unpaid/partial sessions."""
    total_outstanding = 0

    pool_sessions = db.query(PoolSession).filter(
        PoolSession.status != SessionStatus.PAID,
        PoolSession.status != SessionStatus.CANCELLED,
    ).all()
    for s in pool_sessions:
        paid = db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0)).filter(
            SessionPayment.session_type == "pool",
            SessionPayment.session_id == s.id,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        ).scalar() or 0
        total_outstanding += max(0, s.final_charge_paise - paid)

    ps4_sessions = db.query(PS4Session).filter(
        PS4Session.status != SessionStatus.PAID,
        PS4Session.status != SessionStatus.CANCELLED,
    ).all()
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
    """Sum active soft drink sales in date range, excluding cancelled sales."""
    sales = db.query(ProductSale).filter(
        ProductSale.sale_date >= start,
        ProductSale.sale_date <= end,
    ).all()

    active_sales = [s for s in sales if not (s.notes and "[CANCELLED]" in s.notes)]
    total_bottles = sum(s.quantity for s in active_sales)
    total_revenue = sum(s.total_revenue_paise for s in active_sales)

    return {
        "drinks_bottles_sold": total_bottles,
        "drinks_revenue_paise": total_revenue,
    }


def _account_balances(db: Session, as_of: Optional[date] = None):
    cash = JournalService.get_account_balance(db, "1001", as_of_date=as_of)
    bank = JournalService.get_account_balance(db, "1002", as_of_date=as_of)
    savings_bank = JournalService.get_account_balance(db, "1003", as_of_date=as_of)
    savings_cash = JournalService.get_account_balance(db, "1004", as_of_date=as_of)
    total_savings = savings_cash + savings_bank
    operating_total = cash + bank
    return {
        "cash_balance_paise": cash,
        "bank_balance_paise": bank,
        "operating_total_paise": operating_total,
        "savings_cash_paise": savings_cash,
        "savings_bank_paise": savings_bank,
        "savings_balance_paise": total_savings,
        "total_savings_paise": total_savings,
        "total_liquid_paise": operating_total + total_savings,
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


@router.get("/analytics")
def dashboard_analytics(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Comprehensive analytics endpoint for the modern dashboard.
    Backend-authoritative aggregation across sessions, drinks, payments, expenses, and accounts.
    """
    today = date.today()
    start = start_date or today
    end = end_date or start

    if start > end:
        start, end = end, start

    duration_days = (end - start).days + 1
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=duration_days - 1)

    # 1. Period revenue & sessions
    curr_sessions = _sessions_summary(db, start, end)
    curr_drinks = _drinks_summary(db, start, end)
    curr_payments = _payments_summary(db, start, end)
    curr_expenses = _expenses_summary(db, start, end)

    pool_rev = curr_sessions["pool_revenue_paise"]
    ps4_rev = curr_sessions["ps4_revenue_paise"]
    drinks_rev = curr_drinks["drinks_revenue_paise"]
    total_rev = pool_rev + ps4_rev + drinks_rev

    # In our accounting system, soft drinks are cash sales collected at time of sale
    cash_collected = curr_payments["cash_collected_paise"] + drinks_rev
    bank_collected = curr_payments["bank_collected_paise"]
    total_collected = cash_collected + bank_collected

    total_expenses = curr_expenses["total_expenses_paise"]
    net_profit = total_rev - total_expenses
    total_outstanding = _outstanding_summary(db)

    # 2. Previous period comparisons
    prev_sessions = _sessions_summary(db, prev_start, prev_end)
    prev_drinks = _drinks_summary(db, prev_start, prev_end)
    prev_payments = _payments_summary(db, prev_start, prev_end)
    prev_expenses = _expenses_summary(db, prev_start, prev_end)

    prev_total_rev = prev_sessions["total_session_revenue_paise"] + prev_drinks["drinks_revenue_paise"]
    prev_total_collected = prev_payments["total_collected_paise"] + prev_drinks["drinks_revenue_paise"]
    prev_total_expenses = prev_expenses["total_expenses_paise"]
    prev_net_profit = prev_total_rev - prev_total_expenses

    def _calc_growth(curr: int, prev: int) -> Optional[float]:
        if prev > 0:
            return round(((curr - prev) / prev) * 100, 1)
        elif prev == 0 and curr > 0:
            return 100.0
        elif prev == 0 and curr == 0:
            return 0.0
        return None

    # 3. Daily / interval trend aggregation
    pool_daily = (
        db.query(PoolSession.session_date, func.coalesce(func.sum(PoolSession.final_charge_paise), 0))
        .filter(PoolSession.session_date >= start, PoolSession.session_date <= end, PoolSession.status != SessionStatus.CANCELLED)
        .group_by(PoolSession.session_date)
        .all()
    )
    pool_by_day = {d: amount for d, amount in pool_daily}

    ps4_daily = (
        db.query(PS4Session.session_date, func.coalesce(func.sum(PS4Session.final_charge_paise), 0))
        .filter(PS4Session.session_date >= start, PS4Session.session_date <= end, PS4Session.status != SessionStatus.CANCELLED)
        .group_by(PS4Session.session_date)
        .all()
    )
    ps4_by_day = {d: amount for d, amount in ps4_daily}

    drinks_sales = (
        db.query(ProductSale.sale_date, ProductSale.total_revenue_paise, ProductSale.notes)
        .filter(ProductSale.sale_date >= start, ProductSale.sale_date <= end)
        .all()
    )
    drinks_by_day = {}
    for s in drinks_sales:
        if not (s.notes and "[CANCELLED]" in s.notes):
            drinks_by_day[s.sale_date] = drinks_by_day.get(s.sale_date, 0) + s.total_revenue_paise

    payments_daily = (
        db.query(SessionPayment.collection_date, func.coalesce(func.sum(SessionPayment.amount_paise), 0))
        .filter(SessionPayment.collection_date >= start, SessionPayment.collection_date <= end, SessionPayment.status == PaymentStatus.CONFIRMED)
        .group_by(SessionPayment.collection_date)
        .all()
    )
    payments_by_day = {d: amount for d, amount in payments_daily}
    for d, amount in drinks_by_day.items():
        payments_by_day[d] = payments_by_day.get(d, 0) + amount

    expenses_daily = (
        db.query(Expense.expense_date, func.coalesce(func.sum(Expense.amount_paise), 0))
        .filter(Expense.expense_date >= start, Expense.expense_date <= end, Expense.status != ExpenseStatus.CANCELLED)
        .group_by(Expense.expense_date)
        .all()
    )
    expenses_by_day = {d: amount for d, amount in expenses_daily}

    trend = []
    if duration_days <= 60:
        curr = start
        while curr <= end:
            p_rev = pool_by_day.get(curr, 0)
            ps4_rev = ps4_by_day.get(curr, 0)
            d_rev = drinks_by_day.get(curr, 0)
            t_rev = p_rev + ps4_rev + d_rev
            trend.append({
                "date": curr.isoformat(),
                "label": curr.strftime("%d %b"),
                "pool_revenue_paise": p_rev,
                "ps4_revenue_paise": ps4_rev,
                "drinks_revenue_paise": d_rev,
                "total_revenue_paise": t_rev,
                "collections_paise": payments_by_day.get(curr, 0),
                "expenses_paise": expenses_by_day.get(curr, 0),
            })
            curr += timedelta(days=1)
    else:
        monthly_trend = {}
        curr = start
        while curr <= end:
            key = curr.strftime("%Y-%m")
            if key not in monthly_trend:
                monthly_trend[key] = {
                    "date": f"{key}-01",
                    "label": curr.strftime("%b %Y"),
                    "pool_revenue_paise": 0,
                    "ps4_revenue_paise": 0,
                    "drinks_revenue_paise": 0,
                    "total_revenue_paise": 0,
                    "collections_paise": 0,
                    "expenses_paise": 0,
                }
            p_rev = pool_by_day.get(curr, 0)
            ps4_rev = ps4_by_day.get(curr, 0)
            d_rev = drinks_by_day.get(curr, 0)
            monthly_trend[key]["pool_revenue_paise"] += p_rev
            monthly_trend[key]["ps4_revenue_paise"] += ps4_rev
            monthly_trend[key]["drinks_revenue_paise"] += d_rev
            monthly_trend[key]["total_revenue_paise"] += (p_rev + ps4_rev + d_rev)
            monthly_trend[key]["collections_paise"] += payments_by_day.get(curr, 0)
            monthly_trend[key]["expenses_paise"] += expenses_by_day.get(curr, 0)
            curr += timedelta(days=1)
        trend = list(monthly_trend.values())

    # 4. Collections by service
    pool_collected = (
        db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0))
        .filter(
            SessionPayment.session_type == "pool",
            SessionPayment.collection_date >= start,
            SessionPayment.collection_date <= end,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        )
        .scalar()
        or 0
    )
    ps4_collected = (
        db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0))
        .filter(
            SessionPayment.session_type == "ps4",
            SessionPayment.collection_date >= start,
            SessionPayment.collection_date <= end,
            SessionPayment.status == PaymentStatus.CONFIRMED,
        )
        .scalar()
        or 0
    )
    drinks_collected = drinks_rev

    # Service breakdown for circular doughnut and bar charts
    services_breakdown = [
        {
            "category": "Pool Table",
            "name": "Pool Table",
            "revenue_paise": pool_rev,
            "percentage": round((pool_rev / total_rev) * 100, 2) if total_rev > 0 else 0.0,
            "count": curr_sessions["pool_sessions"],
            "sessions_or_sales_count": curr_sessions["pool_sessions"],
            "collections_paise": pool_collected,
            "color": "#38BDF8",
        },
        {
            "category": "PS4",
            "name": "PS4",
            "revenue_paise": ps4_rev,
            "percentage": round((ps4_rev / total_rev) * 100, 2) if total_rev > 0 else 0.0,
            "count": curr_sessions["ps4_sessions"],
            "sessions_or_sales_count": curr_sessions["ps4_sessions"],
            "collections_paise": ps4_collected,
            "color": "#818CF8",
        },
        {
            "category": "Soft Drinks",
            "name": "Soft Drinks",
            "revenue_paise": drinks_rev,
            "percentage": round((drinks_rev / total_rev) * 100, 2) if total_rev > 0 else 0.0,
            "count": curr_drinks["drinks_bottles_sold"],
            "sessions_or_sales_count": curr_drinks["drinks_bottles_sold"],
            "collections_paise": drinks_collected,
            "color": "#F59E0B",
        },
    ]

    # 5. Payment status breakdown in range
    pool_in_range = (
        db.query(PoolSession)
        .filter(PoolSession.session_date >= start, PoolSession.session_date <= end, PoolSession.status != SessionStatus.CANCELLED)
        .all()
    )
    ps4_in_range = (
        db.query(PS4Session)
        .filter(PS4Session.session_date >= start, PS4Session.session_date <= end, PS4Session.status != SessionStatus.CANCELLED)
        .all()
    )
    status_map = {
        "paid": {"count": 0, "amount_paise": 0, "outstanding_paise": 0},
        "partial": {"count": 0, "amount_paise": 0, "outstanding_paise": 0},
        "pending": {"count": 0, "amount_paise": 0, "outstanding_paise": 0},
    }

    def _get_paid(stype: str, sid: int) -> int:
        return (
            db.query(func.coalesce(func.sum(SessionPayment.amount_paise), 0))
            .filter(
                SessionPayment.session_type == stype,
                SessionPayment.session_id == sid,
                SessionPayment.status == PaymentStatus.CONFIRMED,
            )
            .scalar()
            or 0
        )

    for s in pool_in_range:
        val = s.status.value if hasattr(s.status, "value") else str(s.status).lower()
        paid = _get_paid("pool", s.id)
        outst = max(0, s.final_charge_paise - paid)
        if val in status_map:
            status_map[val]["count"] += 1
            status_map[val]["amount_paise"] += s.final_charge_paise
            status_map[val]["outstanding_paise"] += outst

    for s in ps4_in_range:
        val = s.status.value if hasattr(s.status, "value") else str(s.status).lower()
        paid = _get_paid("ps4", s.id)
        outst = max(0, s.final_charge_paise - paid)
        if val in status_map:
            status_map[val]["count"] += 1
            status_map[val]["amount_paise"] += s.final_charge_paise
            status_map[val]["outstanding_paise"] += outst

    unpaid_sessions_count = status_map["partial"]["count"] + status_map["pending"]["count"]
    unpaid_sessions_outstanding = status_map["partial"]["outstanding_paise"] + status_map["pending"]["outstanding_paise"]

    # 6. Expenses by Category
    exp_cats = (
        db.query(
            ExpenseCategory.id,
            ExpenseCategory.name,
            func.coalesce(func.sum(Expense.amount_paise), 0).label("total_amt"),
            func.count(Expense.id).label("exp_count"),
        )
        .join(ExpenseCategory, Expense.category_id == ExpenseCategory.id)
        .filter(
            Expense.expense_date >= start,
            Expense.expense_date <= end,
            Expense.status != ExpenseStatus.CANCELLED,
        )
        .group_by(ExpenseCategory.id, ExpenseCategory.name)
        .order_by(func.sum(Expense.amount_paise).desc())
        .all()
    )
    expenses_by_category = [
        {
            "category_id": e.id,
            "category_name": e.name,
            "amount_paise": e.total_amt,
            "count": e.exp_count,
            "percentage": round((e.total_amt / total_expenses) * 100, 1) if total_expenses > 0 else 0.0,
        }
        for e in exp_cats
    ]

    # 7. Drinks Stock Overview
    drinks_cat = db.query(ProductCategory).filter(ProductCategory.name == "Soft Drinks").first()
    products_list = []
    total_bottles = 0
    low_stock_count = 0
    if drinks_cat:
        prods = db.query(Product).filter(Product.category_id == drinks_cat.id, Product.is_active == True).all()
        for p in prods:
            stk = _get_stock_on_hand(db, p.id)
            total_bottles += stk
            is_low = stk <= p.min_stock_qty or stk < 5
            if is_low:
                low_stock_count += 1
            products_list.append({
                "id": p.id,
                "name": p.name,
                "current_stock": stk,
                "reorder_level": p.min_stock_qty,
                "selling_price_paise": p.selling_price_paise,
                "is_low": is_low,
            })

    stock_discrepancies = (
        db.query(func.count(PhysicalStockCount.id))
        .filter(
            PhysicalStockCount.discrepancy != 0,
            PhysicalStockCount.count_date >= start,
            PhysicalStockCount.count_date <= end,
        )
        .scalar()
        or 0
    )

    # 8. Account Balances
    balances = _account_balances(db, as_of=end)

    # 9. Recent sessions (latest 8)
    pool_recents = db.query(PoolSession).filter(PoolSession.status != SessionStatus.CANCELLED).order_by(PoolSession.session_date.desc(), PoolSession.id.desc()).limit(8).all()
    ps4_recents = db.query(PS4Session).filter(PS4Session.status != SessionStatus.CANCELLED).order_by(PS4Session.session_date.desc(), PS4Session.id.desc()).limit(8).all()
    recent_sessions = []
    for s in pool_recents:
        cust = s.player.name if s.player else "Walk-in"
        paid = _get_paid("pool", s.id)
        recent_sessions.append({
            "id": s.id,
            "svcType": "Pool",
            "reference": s.reference,
            "session_date": s.session_date.isoformat(),
            "customer_name": cust,
            "duration_minutes": s.chargeable_duration_minutes,
            "final_charge_paise": s.final_charge_paise,
            "paid_amount_paise": paid,
            "outstanding_paise": max(0, s.final_charge_paise - paid),
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        })
    for s in ps4_recents:
        cust = s.player1.name if s.player1 else "Walk-in"
        paid = _get_paid("ps4", s.id)
        recent_sessions.append({
            "id": s.id,
            "svcType": "PS4",
            "reference": s.reference,
            "session_date": s.session_date.isoformat(),
            "customer_name": cust,
            "duration_minutes": s.actual_duration_minutes,
            "final_charge_paise": s.final_charge_paise,
            "paid_amount_paise": paid,
            "outstanding_paise": max(0, s.final_charge_paise - paid),
            "status": s.status.value if hasattr(s.status, "value") else str(s.status),
        })
    recent_sessions.sort(key=lambda x: (x["session_date"], x["id"]), reverse=True)
    recent_sessions = recent_sessions[:8]

    return {
        "period": {
            "start_date": start.isoformat(),
            "end_date": end.isoformat(),
            "duration_days": duration_days,
            "prev_start_date": prev_start.isoformat(),
            "prev_end_date": prev_end.isoformat(),
        },
        "kpis": {
            "total_revenue_paise": total_rev,
            "total_collected_paise": total_collected,
            "total_outstanding_paise": total_outstanding,
            "net_profit_paise": net_profit,
            "total_expenses_paise": total_expenses,
            "prev_total_revenue_paise": prev_total_rev,
            "prev_total_collected_paise": prev_total_collected,
            "prev_total_expenses_paise": prev_total_expenses,
            "prev_net_profit_paise": prev_net_profit,
            "revenue_growth_percent": _calc_growth(total_rev, prev_total_rev),
            "collections_growth_percent": _calc_growth(total_collected, prev_total_collected),
            "profit_growth_percent": _calc_growth(net_profit, prev_net_profit),
        },
        "activity_summary": {
            "pool_sessions_count": curr_sessions["pool_sessions"],
            "pool_revenue_paise": pool_rev,
            "ps4_sessions_count": curr_sessions["ps4_sessions"],
            "ps4_revenue_paise": ps4_rev,
            "drinks_bottles_sold": curr_drinks["drinks_bottles_sold"],
            "drinks_revenue_paise": drinks_rev,
            "total_expenses_count": sum(e["count"] for e in expenses_by_category),
            "total_expenses_paise": total_expenses,
            "unpaid_sessions_count": unpaid_sessions_count,
            "unpaid_sessions_outstanding_paise": unpaid_sessions_outstanding,
            "stock_discrepancies_count": stock_discrepancies,
        },
        "revenue_trend": trend,
        "revenue_distribution": services_breakdown,
        "service_comparison": services_breakdown,
        "payment_status": {
            "paid": status_map["paid"],
            "partial": status_map["partial"],
            "pending": status_map["pending"],
            "total_sessions": status_map["paid"]["count"] + status_map["partial"]["count"] + status_map["pending"]["count"],
            "total_charged_paise": status_map["paid"]["amount_paise"] + status_map["partial"]["amount_paise"] + status_map["pending"]["amount_paise"],
        },
        "collections_by_method": {
            "cash_collected_paise": cash_collected,
            "bank_collected_paise": bank_collected,
            "total_collected_paise": total_collected,
        },
        "expenses_by_category": expenses_by_category,
        "inventory_overview": {
            "total_products_count": len(products_list),
            "total_bottles_in_stock": total_bottles,
            "low_stock_products_count": low_stock_count,
            "discrepancies_count": stock_discrepancies,
            "products": products_list,
        },
        "account_balances": balances,
        "recent_sessions": recent_sessions,
    }


# ==========================================
# EXCEL (.XLSX) EXPORTS
# ==========================================

XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


@router.get("/export/daily")
def export_daily_excel(
    report_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    d = report_date or date.today()
    buf = excel_export.export_daily_report(db, d)
    filename = f"pool_town_daily_report_{d.isoformat()}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/weekly")
def export_weekly_excel(
    week_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    d = week_date or date.today()
    buf = excel_export.export_weekly_report(db, d)
    filename = f"pool_town_weekly_report_{d.isoformat()}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/monthly")
def export_monthly_excel(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    now = date.today()
    y = year or now.year
    m = month or now.month
    buf = excel_export.export_monthly_report(db, y, m)
    filename = f"pool_town_monthly_report_{y}_{m:02d}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/ledger")
def export_ledger_excel(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    buf = excel_export.export_general_ledger(db, start_date, end_date)
    filename = "pool_town_general_ledger.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/transactions")
def export_transactions_excel(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    account_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    buf = excel_export.export_transactions(db, start_date, end_date, account_id)
    filename = "pool_town_transactions.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/expenses")
def export_expenses_excel(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    buf = excel_export.export_expenses(db, start_date, end_date)
    filename = "pool_town_expenses.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/cash-bank")
def export_cash_bank_excel(db: Session = Depends(get_db)):
    buf = excel_export.export_cash_and_bank(db)
    filename = "pool_town_cash_and_bank.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/savings")
def export_savings_excel(db: Session = Depends(get_db)):
    buf = excel_export.export_savings(db)
    filename = "pool_town_business_savings.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/partners")
def export_partners_excel(
    year: Optional[int] = Query(default=None),
    month: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
):
    now = date.today()
    y = year or now.year
    m = month or now.month
    buf = excel_export.export_partners(db, y, m)
    filename = f"pool_town_partners_distributions_{y}_{m:02d}.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/loans")
def export_loans_excel(db: Session = Depends(get_db)):
    buf = excel_export.export_loans(db)
    filename = "pool_town_loans.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/drinks")
def export_drinks_excel(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    buf = excel_export.export_drinks(db, start_date, end_date)
    filename = "pool_town_soft_drinks.xlsx"
    return Response(
        content=buf.getvalue(),
        media_type=XLSX_MIME,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

