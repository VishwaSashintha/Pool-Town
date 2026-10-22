from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.accounts import FinancialAccount
from app.models.owners import (
    Owner, OwnerTransaction, OwnerTransactionType,
    Loan, LoanTransaction, LoanType, LoanStatus, LoanTransactionType,
    ProfitAllocation, ProfitAllocationLine,
)
from app.models.journal import JournalEntry, JournalLine, JournalEntryStatus
from app.schemas.owners import (
    OwnerResponse,
    OwnerTransactionCreate,
    OwnerTransactionResponse,
    LoanCreate,
    LoanResponse,
    LoanRepaymentCreate,
    LoanTransactionResponse,
    ProfitAllocationPreview,
    ProfitAllocationPost,
)
from app.services.journal import JournalService, JournalLineInput
from app.utils.money import allocate_profit

router = APIRouter(prefix="/api/owners", tags=["Owners & Loans"])


# ==========================================
# OWNERS & CAPITAL ACCOUNTS
# ==========================================

@router.get("", response_model=list[OwnerResponse])
def list_owners(db: Session = Depends(get_db)):
    owners = db.query(Owner).filter(Owner.is_active == True).order_by(Owner.id).all()
    results = []

    for o in owners:
        capital_code = f"300{o.id}"
        dist_code = f"700{o.id}"
        capital_bal = JournalService.get_account_balance(db, capital_code)
        dist_bal = JournalService.get_account_balance(db, dist_code)

        # Calculate active owner loan balance
        owner_loans = db.query(Loan).filter(
            Loan.owner_id == o.id,
            Loan.status == LoanStatus.ACTIVE
        ).all()
        loan_bal = 0
        for loan in owner_loans:
            repaid = db.query(func.coalesce(func.sum(LoanTransaction.amount_paise), 0)).filter(
                LoanTransaction.loan_id == loan.id,
                LoanTransaction.transaction_type == LoanTransactionType.PRINCIPAL_REPAYMENT,
            ).scalar() or 0
            loan_bal += max(0, loan.original_principal_paise - repaid)

        results.append(
            OwnerResponse(
                id=o.id,
                name=o.name,
                profit_share_bps=o.profit_share_bps,
                profit_share_percent=f"{o.profit_share_bps / 100:.1f}%",
                capital_account_code=capital_code,
                capital_balance_paise=capital_bal,
                distribution_account_code=dist_code,
                distributions_total_paise=dist_bal,
                owner_loan_balance_paise=loan_bal,
            )
        )
    return results


@router.get("/transactions", response_model=list[OwnerTransactionResponse])
def list_owner_transactions(
    owner_id: Optional[int] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    query = db.query(OwnerTransaction)
    if isinstance(owner_id, int):
        query = query.filter(OwnerTransaction.owner_id == owner_id)
    actual_limit = limit if isinstance(limit, int) else 50
    txs = query.order_by(desc(OwnerTransaction.transaction_date), desc(OwnerTransaction.id)).limit(actual_limit).all()

    results = []
    for tx in txs:
        owner = db.query(Owner).filter(Owner.id == tx.owner_id).first()
        acct = db.query(FinancialAccount).filter(FinancialAccount.id == tx.account_id).first() if tx.account_id else None
        results.append(
            OwnerTransactionResponse(
                id=tx.id,
                reference=tx.reference,
                owner_id=tx.owner_id,
                owner_name=owner.name if owner else "Unknown",
                transaction_date=tx.transaction_date,
                transaction_type=tx.transaction_type.value if hasattr(tx.transaction_type, "value") else str(tx.transaction_type),
                amount_paise=tx.amount_paise,
                account_id=tx.account_id,
                account_name=acct.name if acct else None,
                description=tx.description,
                notes=tx.notes,
                created_at=tx.created_at,
            )
        )
    return results


@router.post("/transactions", response_model=OwnerTransactionResponse, status_code=201)
def record_owner_transaction(payload: OwnerTransactionCreate, db: Session = Depends(get_db)):
    owner = db.query(Owner).filter(Owner.id == payload.owner_id).first()
    if not owner:
        raise HTTPException(status_code=404, detail="Owner not found")

    bank_cash_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not bank_cash_acct or bank_cash_acct.code not in ("1001", "1002", "1003"):
        raise HTTPException(status_code=400, detail="Must select a valid liquid treasury account (Cash, Bank, or Savings)")

    date_str = payload.transaction_date.strftime("%Y%m%d")
    count = db.query(OwnerTransaction).filter(OwnerTransaction.reference.like(f"OTX-{date_str}-%")).count()
    reference = f"OTX-{date_str}-{count + 1:04d}"

    # Determine transaction type enum
    try:
        tx_type_enum = OwnerTransactionType(payload.transaction_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid transaction type: {payload.transaction_type}")

    tx = OwnerTransaction(
        reference=reference,
        owner_id=owner.id,
        transaction_date=payload.transaction_date,
        transaction_type=tx_type_enum,
        amount_paise=payload.amount_paise,
        description=payload.description,
        account_id=bank_cash_acct.id,
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(tx)
    db.flush()

    # Determine journal lines based on transaction type:
    capital_code = f"300{owner.id}"
    dist_code = f"700{owner.id}"

    if tx_type_enum in (OwnerTransactionType.INITIAL_CAPITAL, OwnerTransactionType.ADDITIONAL_CAPITAL):
        # DR Cash/Bank (1001/1002), CR Owner Capital (3001/3002/3003)
        lines = [
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, True, payload.amount_paise),
            JournalLineInput(capital_code, f"Owner Capital — {owner.name}", False, payload.amount_paise),
        ]
        desc = f"Capital Injection: {owner.name} via {bank_cash_acct.name}"
    elif tx_type_enum in (OwnerTransactionType.WITHDRAWAL, OwnerTransactionType.DISTRIBUTION):
        # DR Owner Distribution (7001/7002/7003), CR Cash/Bank (1001/1002)
        lines = [
            JournalLineInput(dist_code, f"Owner Distribution — {owner.name}", True, payload.amount_paise),
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, False, payload.amount_paise),
        ]
        desc = f"Owner Drawing/Distribution: {owner.name} from {bank_cash_acct.name}"
    else:
        # Default capital adjustment
        lines = [
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, True, payload.amount_paise),
            JournalLineInput(capital_code, f"Owner Capital — {owner.name}", False, payload.amount_paise),
        ]
        desc = f"Capital Adjustment: {owner.name}"

    entry = JournalService.post_entry(
        db,
        entry_date=payload.transaction_date,
        description=desc,
        lines=lines,
        source_type="owner_transaction",
        source_id=tx.id,
        notes=payload.notes,
    )
    tx.journal_entry_id = entry.id
    db.commit()
    db.refresh(tx)

    return OwnerTransactionResponse(
        id=tx.id,
        reference=tx.reference,
        owner_id=owner.id,
        owner_name=owner.name,
        transaction_date=tx.transaction_date,
        transaction_type=tx.transaction_type.value,
        amount_paise=tx.amount_paise,
        account_id=bank_cash_acct.id,
        account_name=bank_cash_acct.name,
        description=tx.description,
        notes=tx.notes,
        created_at=tx.created_at,
    )


# ==========================================
# LOAN MANAGEMENT
# ==========================================

@router.get("/loans", response_model=list[LoanResponse])
def list_loans(
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    query = db.query(Loan)
    if isinstance(status, str) and status:
        try:
            status_enum = LoanStatus(status.lower())
            query = query.filter(Loan.status == status_enum)
        except ValueError:
            query = query.filter(Loan.status == status)
    loans = query.order_by(desc(Loan.start_date), desc(Loan.id)).all()

    results = []
    for loan in loans:
        # Calculate current outstanding principal = original - sum(principal repayments)
        principal_repaid = db.query(
            func.coalesce(func.sum(LoanTransaction.amount_paise), 0)
        ).filter(
            LoanTransaction.loan_id == loan.id,
            LoanTransaction.transaction_type == LoanTransactionType.PRINCIPAL_REPAYMENT,
        ).scalar() or 0

        current_outstanding = max(0, loan.original_principal_paise - principal_repaid)

        owner = db.query(Owner).filter(Owner.id == loan.owner_id).first() if loan.owner_id else None

        results.append(
            LoanResponse(
                id=loan.id,
                reference=loan.reference,
                lender_name=loan.lender_name,
                loan_type=loan.loan_type.value if hasattr(loan.loan_type, "value") else str(loan.loan_type),
                original_principal_paise=loan.original_principal_paise,
                current_outstanding_paise=current_outstanding,
                start_date=loan.start_date,
                interest_rate_bps=loan.interest_rate_bps,
                repayment_terms=loan.repayment_terms,
                status=loan.status.value if hasattr(loan.status, "value") else str(loan.status),
                owner_id=loan.owner_id,
                owner_name=owner.name if owner else None,
                created_at=loan.created_at,
            )
        )
    return results


@router.post("/loans", response_model=LoanResponse, status_code=201)
def create_loan(payload: LoanCreate, db: Session = Depends(get_db)):
    try:
        loan_type_enum = LoanType(payload.loan_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid loan type: {payload.loan_type}")

    date_str = payload.start_date.strftime("%Y%m%d")
    count = db.query(Loan).filter(Loan.reference.like(f"LN-{date_str}-%")).count()
    reference = f"LN-{date_str}-{count + 1:04d}"

    loan = Loan(
        reference=reference,
        lender_name=payload.lender_name,
        loan_type=loan_type_enum,
        original_principal_paise=payload.original_principal_paise,
        opening_outstanding_paise=payload.original_principal_paise,
        start_date=payload.start_date,
        interest_rate_bps=payload.interest_rate_bps,
        repayment_terms=payload.repayment_terms,
        status=LoanStatus.ACTIVE,
        notes=payload.notes,
        owner_id=payload.owner_id if loan_type_enum == LoanType.OWNER else None,
        created_by="Admin",
    )
    db.add(loan)
    db.flush()

    # Optional: Disburse loan funds into Cash/Bank
    if payload.disburse_to_account_id:
        target_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.disburse_to_account_id).first()
        if target_acct:
            liability_code = "2030" if loan_type_enum == LoanType.OWNER else "2010"
            liability_name = "Owner Loans Payable" if loan_type_enum == LoanType.OWNER else "Loan Payable"

            entry = JournalService.post_entry(
                db,
                entry_date=payload.start_date,
                description=f"Loan Proceeds Received: {loan.reference} ({loan.lender_name}) into {target_acct.name}",
                lines=[
                    JournalLineInput(target_acct.code, target_acct.name, True, payload.original_principal_paise),
                    JournalLineInput(liability_code, liability_name, False, payload.original_principal_paise),
                ],
                source_type="loan",
                source_id=loan.id,
            )

            # Record receipt transaction
            receipt_tx = LoanTransaction(
                reference=f"{reference}-REC",
                loan_id=loan.id,
                transaction_date=payload.start_date,
                transaction_type=LoanTransactionType.RECEIPT,
                amount_paise=payload.original_principal_paise,
                account_id=target_acct.id,
                notes=f"Disbursed to {target_acct.name}",
                created_by="Admin",
                journal_entry_id=entry.id,
            )
            db.add(receipt_tx)

    db.commit()
    db.refresh(loan)

    owner = db.query(Owner).filter(Owner.id == loan.owner_id).first() if loan.owner_id else None
    return LoanResponse(
        id=loan.id,
        reference=loan.reference,
        lender_name=loan.lender_name,
        loan_type=loan.loan_type.value,
        original_principal_paise=loan.original_principal_paise,
        current_outstanding_paise=loan.original_principal_paise,
        start_date=loan.start_date,
        interest_rate_bps=loan.interest_rate_bps,
        repayment_terms=loan.repayment_terms,
        status=loan.status.value,
        owner_id=loan.owner_id,
        owner_name=owner.name if owner else None,
        created_at=loan.created_at,
    )


@router.get("/loans/{loan_id}/transactions", response_model=list[LoanTransactionResponse])
def list_loan_transactions(loan_id: int, db: Session = Depends(get_db)):
    loan = db.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    txs = db.query(LoanTransaction).filter(
        LoanTransaction.loan_id == loan_id
    ).order_by(desc(LoanTransaction.transaction_date), desc(LoanTransaction.id)).all()

    return [
        LoanTransactionResponse(
            id=t.id,
            reference=t.reference,
            loan_id=t.loan_id,
            transaction_date=t.transaction_date,
            transaction_type=t.transaction_type.value if hasattr(t.transaction_type, "value") else str(t.transaction_type),
            amount_paise=t.amount_paise,
            account_id=t.account_id,
            notes=t.notes,
            created_at=t.created_at,
        )
        for t in txs
    ]


@router.post("/loans/{loan_id}/repayments", status_code=201)
def record_loan_repayment(loan_id: int, payload: LoanRepaymentCreate, db: Session = Depends(get_db)):
    loan = db.query(Loan).filter(Loan.id == loan_id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    total_payment = payload.principal_amount_paise + payload.interest_amount_paise
    if total_payment <= 0:
        raise HTTPException(status_code=400, detail="Total payment (principal + interest) must be greater than zero")

    bank_cash_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not bank_cash_acct:
        raise HTTPException(status_code=404, detail="Payment account not found")

    liability_code = "2030" if loan.loan_type == LoanType.OWNER else "2010"
    liability_name = "Owner Loans Payable" if loan.loan_type == LoanType.OWNER else "Loan Payable"

    date_str = payload.repayment_date.strftime("%Y%m%d")
    count = db.query(LoanTransaction).filter(LoanTransaction.reference.like(f"LR-{date_str}-%")).count()

    # Build balanced journal lines: DR Loan Liability (principal) + DR Interest Expense (interest) == CR Cash/Bank (total)
    jlines: list[JournalLineInput] = []
    if payload.principal_amount_paise > 0:
        jlines.append(
            JournalLineInput(liability_code, liability_name, True, payload.principal_amount_paise, "Loan Principal Repayment")
        )
    if payload.interest_amount_paise > 0:
        jlines.append(
            JournalLineInput("6020", "Interest Expense", True, payload.interest_amount_paise, "Loan Interest Expense")
        )
    jlines.append(
        JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, False, total_payment, f"Payment for loan {loan.reference}")
    )

    entry = JournalService.post_entry(
        db,
        entry_date=payload.repayment_date,
        description=f"Loan Repayment: {loan.reference} ({loan.lender_name}) via {bank_cash_acct.name}",
        lines=jlines,
        source_type="loan_repayment",
        source_id=loan.id,
        notes=payload.notes,
    )

    # Record individual loan transactions
    if payload.principal_amount_paise > 0:
        ref_prin = f"LR-{date_str}-{count + 1:04d}-PRIN"
        prin_tx = LoanTransaction(
            reference=ref_prin,
            loan_id=loan.id,
            transaction_date=payload.repayment_date,
            transaction_type=LoanTransactionType.PRINCIPAL_REPAYMENT,
            amount_paise=payload.principal_amount_paise,
            account_id=bank_cash_acct.id,
            notes=payload.notes,
            created_by="Admin",
            journal_entry_id=entry.id,
        )
        db.add(prin_tx)

    if payload.interest_amount_paise > 0:
        ref_int = f"LR-{date_str}-{count + 2:04d}-INT"
        int_tx = LoanTransaction(
            reference=ref_int,
            loan_id=loan.id,
            transaction_date=payload.repayment_date,
            transaction_type=LoanTransactionType.INTEREST_PAYMENT,
            amount_paise=payload.interest_amount_paise,
            account_id=bank_cash_acct.id,
            notes=payload.notes,
            created_by="Admin",
            journal_entry_id=entry.id,
        )
        db.add(int_tx)

    # Check if settled
    db.flush()
    total_repaid = db.query(func.coalesce(func.sum(LoanTransaction.amount_paise), 0)).filter(
        LoanTransaction.loan_id == loan.id,
        LoanTransaction.transaction_type == LoanTransactionType.PRINCIPAL_REPAYMENT,
    ).scalar() or 0

    if total_repaid >= loan.original_principal_paise:
        loan.status = LoanStatus.SETTLED

    db.commit()
    return {"message": "Loan payment posted successfully", "journal_reference": entry.reference}


# ==========================================
# PROFIT ALLOCATION (PERIOD CLOSE APPROVAL)
# ==========================================

@router.get("/profit-allocation/preview", response_model=ProfitAllocationPreview)
def preview_profit_allocation(
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
):
    """Calculates distributable net operating profit and proposed 40% Savings, 20% Akash, 20% Pasan, 20% Vishwa split."""
    # Check if already posted
    existing = db.query(ProfitAllocation).filter(
        ProfitAllocation.period_year == year,
        ProfitAllocation.period_month == month,
    ).first()

    # Calculate month date range
    from calendar import monthrange
    days_in_month = monthrange(year, month)[1]
    start_date = date(year, month, 1)
    end_date = date(year, month, days_in_month)

    # Sum revenues (4xxx)
    rev_lines = db.query(func.coalesce(func.sum(JournalLine.amount_paise), 0)).join(JournalEntry).filter(
        JournalEntry.entry_date >= start_date,
        JournalEntry.entry_date <= end_date,
        JournalEntry.status == JournalEntryStatus.POSTED,
        JournalLine.account_code.like("4%"),
        JournalLine.is_debit == False,  # Credits to revenue
    ).scalar() or 0

    # Sum COGS (5xxx)
    cogs_lines = db.query(func.coalesce(func.sum(JournalLine.amount_paise), 0)).join(JournalEntry).filter(
        JournalEntry.entry_date >= start_date,
        JournalEntry.entry_date <= end_date,
        JournalEntry.status == JournalEntryStatus.POSTED,
        JournalLine.account_code.like("5%"),
        JournalLine.is_debit == True,  # Debits to COGS
    ).scalar() or 0

    # Sum Operating Expenses (6xxx)
    exp_lines = db.query(func.coalesce(func.sum(JournalLine.amount_paise), 0)).join(JournalEntry).filter(
        JournalEntry.entry_date >= start_date,
        JournalEntry.entry_date <= end_date,
        JournalEntry.status == JournalEntryStatus.POSTED,
        JournalLine.account_code.like("6%"),
        JournalLine.is_debit == True,  # Debits to expense
    ).scalar() or 0

    net_profit = max(0, rev_lines - cogs_lines - exp_lines)

    # Split: 40% savings, 20% akash, 20% pasan, remainder to vishwa (per D-009)
    shares = allocate_profit(
        net_profit,
        {"savings": 4000, "akash": 2000, "pasan": 2000, "vishwa": 2000}
    )

    return ProfitAllocationPreview(
        year=year,
        month=month,
        period_label=f"{year}-{month:02d}",
        revenue_paise=rev_lines,
        cogs_paise=cogs_lines,
        expenses_paise=exp_lines,
        net_distributable_profit_paise=net_profit,
        savings_share_paise=shares["savings"],
        akash_share_paise=shares["akash"],
        pasan_share_paise=shares["pasan"],
        vishwa_share_paise=shares["vishwa"],
        is_already_posted=existing is not None,
    )



@router.post("/profit-allocation/post", status_code=201)
def post_profit_allocation(payload: ProfitAllocationPost, db: Session = Depends(get_db)):
    """Posts formal balanced journal entry allocating profit into equity accounts with explicit owner approval."""
    existing = db.query(ProfitAllocation).filter(
        ProfitAllocation.period_year == payload.year,
        ProfitAllocation.period_month == payload.month,
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Profit allocation for {payload.year}-{payload.month:02d} has already been approved and posted ({existing.reference}).",
        )

    preview = preview_profit_allocation(year=payload.year, month=payload.month, db=db)
    if preview.net_distributable_profit_paise <= 0:
        raise HTTPException(status_code=400, detail="Cannot allocate profit when net profit is zero or negative")

    from calendar import monthrange
    days = monthrange(payload.year, payload.month)[1]
    alloc_date = date(payload.year, payload.month, days)

    reference = f"PALLOC-{payload.year}{payload.month:02d}-0001"

    palloc = ProfitAllocation(
        reference=reference,
        allocation_date=alloc_date,
        period_year=payload.year,
        period_month=payload.month,
        allocation_basis_paise=preview.net_distributable_profit_paise,
        approved_by=payload.approved_by,
        notes=payload.notes,
    )
    db.add(palloc)
    db.flush()

    # Lines:
    # ProfitAllocationLine items
    recipients = [
        ("savings", 4000, preview.savings_share_paise),
        ("akash", 2000, preview.akash_share_paise),
        ("pasan", 2000, preview.pasan_share_paise),
        ("vishwa", 2000, preview.vishwa_share_paise),
    ]
    for r_name, bps, amt in recipients:
        line_rec = ProfitAllocationLine(
            allocation_id=palloc.id,
            recipient=r_name,
            share_bps=bps,
            amount_paise=amt,
        )
        db.add(line_rec)

    # Post balanced journal entry:
    # DR Retained Earnings (3010) for net profit
    # CR Profit Allocation — Savings (3011)
    # CR Profit Allocation — Akash (3012)
    # CR Profit Allocation — Pasan (3013)
    # CR Profit Allocation — Vishwa (3014)
    jlines = [
        JournalLineInput("3010", "Retained Earnings", True, preview.net_distributable_profit_paise, "Profit allocation debit"),
        JournalLineInput("3011", "Profit Allocation — Savings", False, preview.savings_share_paise, "40% Savings Reserve"),
        JournalLineInput("3012", "Profit Allocation — Akash", False, preview.akash_share_paise, "20% Akash Share"),
        JournalLineInput("3013", "Profit Allocation — Pasan", False, preview.pasan_share_paise, "20% Pasan Share"),
        JournalLineInput("3014", "Profit Allocation — Vishwa", False, preview.vishwa_share_paise, "20% Vishwa Share (+rem)"),
    ]

    entry = JournalService.post_entry(
        db,
        entry_date=alloc_date,
        description=f"Formal Profit Allocation for {payload.year}-{payload.month:02d}: Approved by {payload.approved_by}",
        lines=jlines,
        source_type="profit_allocation",
        source_id=palloc.id,
        notes=payload.notes,
    )
    palloc.journal_entry_id = entry.id

    db.commit()
    return {
        "message": "Profit allocation posted and approved successfully",
        "reference": reference,
        "journal_reference": entry.reference,
    }
