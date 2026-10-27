from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.accounts import FinancialAccount, AccountTransfer, CashCount, BankReconciliation
from app.models.journal import AccountingPeriod, JournalEntry, JournalLine, JournalEntryStatus
from app.schemas.accounts import (
    FinancialAccountResponse,
    AccountTransferCreate,
    AccountTransferResponse,
    TrialBalanceResponse,
    CashCountCreate,
    CashCountResponse,
    BankReconciliationCreate,
    BankReconciliationResponse,
    AccountingPeriodResponse,
    PeriodCloseRequest,
    PeriodReopenRequest,
    OpeningBalanceCreate,
)
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/accounts", tags=["Accounts"])


@router.get("", response_model=list[FinancialAccountResponse])
def list_accounts(
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    accounts = db.query(FinancialAccount).filter(FinancialAccount.is_active == True).order_by(
        FinancialAccount.display_order.asc(), FinancialAccount.code.asc()
    ).all()

    results = []
    for acct in accounts:
        balance = JournalService.get_account_balance(db, acct.code, as_of_date=as_of_date)
        results.append(
            FinancialAccountResponse(
                id=acct.id,
                code=acct.code,
                name=acct.name,
                account_type=acct.account_type.value,
                description=acct.description,
                is_active=acct.is_active,
                current_balance_paise=balance,
            )
        )
    return results


@router.get("/trial-balance", response_model=list[TrialBalanceResponse])
def get_trial_balance(
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    rows = JournalService.get_trial_balance(db, as_of_date=as_of_date)
    return [
        TrialBalanceResponse(
            account_code=r["account_code"],
            account_name=r["account_name"],
            total_debit_paise=r["total_debit_paise"],
            total_credit_paise=r["total_credit_paise"],
            net_balance_paise=r["net_balance_paise"],
        )
        for r in rows
    ]


@router.get("/transfers", response_model=list[AccountTransferResponse])
def list_transfers(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    actual_limit = limit if isinstance(limit, int) else 50
    transfers = db.query(AccountTransfer).order_by(
        desc(AccountTransfer.transfer_date), desc(AccountTransfer.id)
    ).limit(actual_limit).all()


    return [
        AccountTransferResponse(
            id=t.id,
            reference=t.reference,
            transfer_date=t.transfer_date,
            from_account_id=t.from_account_id,
            from_account_code=t.from_account.code,
            from_account_name=t.from_account.name,
            to_account_id=t.to_account_id,
            to_account_code=t.to_account.code,
            to_account_name=t.to_account.name,
            amount_paise=t.amount_paise,
            description=t.description,
            created_at=t.created_at,
        )
        for t in transfers
    ]


@router.post("/transfers", status_code=201)
def create_transfer(payload: AccountTransferCreate, db: Session = Depends(get_db)):
    if payload.from_account_id == payload.to_account_id:
        raise HTTPException(status_code=400, detail="Cannot transfer to the same account")

    from_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.from_account_id).first()
    to_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.to_account_id).first()

    if not from_acct or not to_acct:
        raise HTTPException(status_code=404, detail="One or both accounts not found")

    source_balance = JournalService.get_account_balance(db, from_acct.code)
    if payload.amount_paise > source_balance:
        raise HTTPException(
            status_code=400,
            detail=f"Transfer amount exceeds available balance in {from_acct.name} (Available: Rs. {source_balance / 100:,.2f})",
        )

    date_str = payload.transfer_date.strftime("%Y%m%d")
    count = db.query(AccountTransfer).filter(AccountTransfer.reference.like(f"TRF-{date_str}-%")).count()
    reference = f"TRF-{date_str}-{count + 1:04d}"

    transfer = AccountTransfer(
        reference=reference,
        transfer_date=payload.transfer_date,
        from_account_id=payload.from_account_id,
        to_account_id=payload.to_account_id,
        amount_paise=payload.amount_paise,
        description=payload.description,
    )
    db.add(transfer)
    db.flush()

    # Post balanced transfer journal entry: DR Destination, CR Source
    entry = JournalService.post_entry(
        db,
        entry_date=payload.transfer_date,
        description=f"Transfer {reference}: {from_acct.name} → {to_acct.name}",
        lines=[
            JournalLineInput(to_acct.code, to_acct.name, True, payload.amount_paise),
            JournalLineInput(from_acct.code, from_acct.name, False, payload.amount_paise),
        ],
        source_type="account_transfer",
        source_id=transfer.id,
    )
    transfer.journal_entry_id = entry.id

    db.commit()
    return {"message": "Transfer posted successfully", "reference": reference}


# ==========================================
# CASH & BANK RECONCILIATION
# ==========================================

@router.get("/reconciliation/cash-expected")
def get_expected_cash(
    as_of_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Calculates expected cash in hand balance from posted journal lines."""
    check_date = as_of_date or date.today()
    balance = JournalService.get_account_balance(db, "1001", as_of_date=check_date)
    return {
        "account_code": "1001",
        "account_name": "Cash in Hand",
        "as_of_date": check_date,
        "expected_paise": balance,
    }


@router.post("/reconciliation/cash-count", response_model=CashCountResponse, status_code=201)
def record_cash_count(payload: CashCountCreate, db: Session = Depends(get_db)):
    """Records a physical cash count, calculating discrepancy vs expected book balance."""
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()
    if not cash_acct:
        raise HTTPException(status_code=404, detail="Cash account 1001 not found")

    expected_paise = JournalService.get_account_balance(db, "1001", as_of_date=payload.count_date)
    diff_paise = payload.counted_paise - expected_paise

    count_record = CashCount(
        count_date=payload.count_date,
        account_id=cash_acct.id,
        counted_paise=payload.counted_paise,
        expected_paise=expected_paise,
        difference_paise=diff_paise,
        notes=payload.notes,
        investigated_by=payload.investigated_by,
        created_by="Admin",
    )
    db.add(count_record)
    db.commit()
    db.refresh(count_record)

    return CashCountResponse(
        id=count_record.id,
        count_date=count_record.count_date,
        account_id=cash_acct.id,
        account_code=cash_acct.code,
        account_name=cash_acct.name,
        counted_paise=count_record.counted_paise,
        expected_paise=count_record.expected_paise,
        difference_paise=count_record.difference_paise,
        notes=count_record.notes,
        investigated_by=count_record.investigated_by,
        created_at=count_record.created_at,
    )


@router.get("/reconciliation/cash-counts", response_model=list[CashCountResponse])
def list_cash_counts(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()
    actual_limit = limit if isinstance(limit, int) else 50
    counts = db.query(CashCount).order_by(desc(CashCount.count_date), desc(CashCount.id)).limit(actual_limit).all()

    return [
        CashCountResponse(
            id=c.id,
            count_date=c.count_date,
            account_id=c.account_id,
            account_code=cash_acct.code if cash_acct else "1001",
            account_name=cash_acct.name if cash_acct else "Cash in Hand",
            counted_paise=c.counted_paise,
            expected_paise=c.expected_paise,
            difference_paise=c.difference_paise,
            notes=c.notes,
            investigated_by=c.investigated_by,
            created_at=c.created_at,
        )
        for c in counts
    ]


@router.get("/reconciliation/bank-expected")
def get_expected_bank(
    account_id: int = Query(...),
    as_of_date: Optional[date] = Query(default=None),
    db: Session = Depends(get_db),
):
    acct = db.query(FinancialAccount).filter(FinancialAccount.id == account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    check_date = as_of_date if isinstance(as_of_date, date) else date.today()
    balance = JournalService.get_account_balance(db, acct.code, as_of_date=check_date)
    return {
        "account_id": acct.id,
        "account_code": acct.code,
        "account_name": acct.name,
        "as_of_date": check_date,
        "book_balance_paise": balance,
    }


@router.post("/reconciliation/bank-reconciliation", response_model=BankReconciliationResponse, status_code=201)
def record_bank_reconciliation(payload: BankReconciliationCreate, db: Session = Depends(get_db)):
    acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    book_balance = JournalService.get_account_balance(db, acct.code, as_of_date=payload.reconciliation_date)
    diff = payload.statement_balance_paise - book_balance

    rec = BankReconciliation(
        reconciliation_date=payload.reconciliation_date,
        account_id=acct.id,
        statement_balance_paise=payload.statement_balance_paise,
        book_balance_paise=book_balance,
        difference_paise=diff,
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(rec)
    db.commit()
    db.refresh(rec)

    return BankReconciliationResponse(
        id=rec.id,
        reconciliation_date=rec.reconciliation_date,
        account_id=acct.id,
        account_code=acct.code,
        account_name=acct.name,
        statement_balance_paise=rec.statement_balance_paise,
        book_balance_paise=rec.book_balance_paise,
        difference_paise=rec.difference_paise,
        notes=rec.notes,
        created_at=rec.created_at,
    )


@router.get("/reconciliation/bank-reconciliations", response_model=list[BankReconciliationResponse])
def list_bank_reconciliations(
    account_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(BankReconciliation)
    if isinstance(account_id, int):
        query = query.filter(BankReconciliation.account_id == account_id)
    actual_limit = limit if isinstance(limit, int) else 50
    recs = query.order_by(desc(BankReconciliation.reconciliation_date), desc(BankReconciliation.id)).limit(actual_limit).all()


    results = []
    for r in recs:
        acct = db.query(FinancialAccount).filter(FinancialAccount.id == r.account_id).first()
        results.append(
            BankReconciliationResponse(
                id=r.id,
                reconciliation_date=r.reconciliation_date,
                account_id=r.account_id,
                account_code=acct.code if acct else "",
                account_name=acct.name if acct else "",
                statement_balance_paise=r.statement_balance_paise,
                book_balance_paise=r.book_balance_paise,
                difference_paise=r.difference_paise,
                notes=r.notes,
                created_at=r.created_at,
            )
        )
    return results


# ==========================================
# ACCOUNTING PERIODS
# ==========================================

@router.get("/periods", response_model=list[AccountingPeriodResponse])
def list_periods(db: Session = Depends(get_db)):
    periods = db.query(AccountingPeriod).order_by(
        desc(AccountingPeriod.year), desc(AccountingPeriod.month)
    ).all()
    return periods


@router.post("/periods/{year}/{month}/close", response_model=AccountingPeriodResponse)
def close_period(year: int, month: int, payload: PeriodCloseRequest, db: Session = Depends(get_db)):
    period = db.query(AccountingPeriod).filter(
        AccountingPeriod.year == year,
        AccountingPeriod.month == month,
    ).first()

    if not period:
        period = AccountingPeriod(year=year, month=month, is_closed=False)
        db.add(period)
        db.flush()

    if period.is_closed:
        raise HTTPException(status_code=400, detail=f"Period {year}-{month:02d} is already closed")

    period.is_closed = True
    period.closed_at = datetime.now(timezone.utc)
    period.closed_by = payload.closed_by or "Admin"
    db.commit()
    db.refresh(period)
    return period


@router.post("/periods/{year}/{month}/reopen", response_model=AccountingPeriodResponse)
def reopen_period(year: int, month: int, payload: PeriodReopenRequest, db: Session = Depends(get_db)):
    period = db.query(AccountingPeriod).filter(
        AccountingPeriod.year == year,
        AccountingPeriod.month == month,
    ).first()

    if not period or not period.is_closed:
        raise HTTPException(status_code=400, detail=f"Period {year}-{month:02d} is not closed")

    period.is_closed = False
    period.reopen_reason = payload.reason
    period.reopened_by = payload.reopened_by or "Admin"
    db.commit()
    db.refresh(period)
    return period


# ==========================================
# OPENING BALANCES WORKFLOW
# ==========================================

@router.get("/opening-balances")
def get_opening_balances(db: Session = Depends(get_db)):
    """Check if opening balances have been posted and return the entry."""
    entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "opening_balance",
        JournalEntry.status == JournalEntryStatus.POSTED,
    ).first()

    if not entry:
        return {"posted": False, "entry": None}

    return {
        "posted": True,
        "entry_id": entry.id,
        "reference": entry.reference,
        "entry_date": entry.entry_date,
        "description": entry.description,
        "lines": [
            {
                "account_code": l.account_code,
                "account_name": l.account_name,
                "is_debit": l.is_debit,
                "amount_paise": l.amount_paise,
            }
            for l in entry.lines
        ],
    }


@router.post("/opening-balances", status_code=201)
def post_opening_balances(payload: OpeningBalanceCreate, db: Session = Depends(get_db)):
    """
    Post opening balances journal entry as of 31 Dec 2025.
    Must balance: Sum(Debit Assets) == Sum(Credit Liabilities + Equity).
    """
    existing = db.query(JournalEntry).filter(
        JournalEntry.source_type == "opening_balance",
        JournalEntry.status == JournalEntryStatus.POSTED,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Opening balances are already posted under reference {existing.reference}. To modify, reverse first.",
        )

    lines: list[JournalLineInput] = []
    for item in payload.items:
        acct = db.query(FinancialAccount).filter(FinancialAccount.code == item.account_code).first()
        if not acct:
            raise HTTPException(status_code=404, detail=f"Account code {item.account_code} not found")
        lines.append(
            JournalLineInput(
                account_code=acct.code,
                account_name=acct.name,
                is_debit=item.is_debit,
                amount_paise=item.amount_paise,
                description=f"Opening balance: {acct.name}",
            )
        )

    # Post using JournalService with source_type="opening_balance"
    try:
        entry = JournalService.post_entry(
            db,
            entry_date=payload.effective_date,
            description=f"Opening Balances as of {payload.effective_date}: {payload.notes or ''}".strip(),
            lines=lines,
            source_type="opening_balance",
            source_id=0,
            created_by="Admin",
            reference="JE-OPENING-20251231",
            notes=payload.notes,
        )
        db.commit()
        return {
            "message": "Opening balances posted successfully",
            "reference": entry.reference,
            "entry_id": entry.id,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


# ==========================================
# TRANSACTION HISTORY / GENERAL LEDGER
# ==========================================

@router.get("/transactions")
def list_transactions(
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    account_code: Optional[str] = Query(default=None),
    source_type: Optional[str] = Query(default=None),
    search: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """
    Search and filter general ledger journal entries and debit/credit lines.
    """
    query = db.query(JournalEntry)

    if start_date:
        query = query.filter(JournalEntry.entry_date >= start_date)
    if end_date:
        query = query.filter(JournalEntry.entry_date <= end_date)
    if source_type:
        query = query.filter(JournalEntry.source_type == source_type)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (JournalEntry.reference.ilike(search_filter)) |
            (JournalEntry.description.ilike(search_filter))
        )
    if account_code:
        query = query.join(JournalLine).filter(JournalLine.account_code == account_code)

    total_count = query.distinct().count()
    entries = (
        query.distinct()
        .order_by(desc(JournalEntry.entry_date), desc(JournalEntry.id))
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for e in entries:
        lines = [
            {
                "id": l.id,
                "account_code": l.account_code,
                "account_name": l.account_name,
                "is_debit": l.is_debit,
                "amount_paise": l.amount_paise,
                "debit_paise": l.debit_paise,
                "credit_paise": l.credit_paise,
                "description": l.description,
            }
            for l in e.lines
        ]
        total_debit = sum(l["debit_paise"] for l in lines)
        total_credit = sum(l["credit_paise"] for l in lines)
        results.append({
            "id": e.id,
            "reference": e.reference,
            "entry_date": e.entry_date.isoformat(),
            "description": e.description,
            "source_type": e.source_type,
            "source_id": e.source_id,
            "status": e.status.value if hasattr(e.status, "value") else str(e.status),
            "created_by": e.created_by,
            "notes": e.notes,
            "total_amount_paise": total_debit,
            "is_balanced": total_debit == total_credit,
            "lines": lines,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        })

    return {
        "total": total_count,
        "offset": offset,
        "limit": limit,
        "items": results,
    }

