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
    OwnerCollection, OwnerCollectionStatus,
)
from app.models.journal import JournalEntry, JournalLine, JournalEntryStatus
from app.schemas.owners import (
    OwnerResponse,
    OwnerTransactionCreate,
    OwnerTransactionResponse,
    PartnerMonthlyDetail,
    PartnerMonthlyDistributionSummary,
    LoanCreate,
    LoanResponse,
    LoanRepaymentCreate,
    LoanTransactionResponse,
    ProfitAllocationPreview,
    ProfitAllocationPost,
    OwnerCollectionCreate,
    OwnerCollectionConfirm,
    OwnerCollectionUpdate,
    OwnerCollectionResponse,
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


@router.get("/monthly-summary", response_model=PartnerMonthlyDistributionSummary)
def get_monthly_distribution_summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
):
    """
    Returns monthly eligible net profit, 40% business savings allocation, and 20% allocation
    for each partner, along with recorded advances, distributions, and remaining payable balances.
    """
    preview = preview_profit_allocation(year=year, month=month, db=db)
    net_profit = preview.net_distributable_profit_paise
    savings_allocation = preview.savings_share_paise

    partner_shares = {
        "akash": preview.akash_share_paise,
        "pasan": preview.pasan_share_paise,
        "vishwa": preview.vishwa_share_paise,
    }

    owners = db.query(Owner).filter(Owner.is_active == True).order_by(Owner.id).all()
    partner_details: list[PartnerMonthlyDetail] = []

    for o in owners:
        name_lower = o.name.strip().lower()
        if "akash" in name_lower:
            alloc_paise = partner_shares.get("akash", 0)
        elif "pasan" in name_lower:
            alloc_paise = partner_shares.get("pasan", 0)
        elif "vishwa" in name_lower:
            alloc_paise = partner_shares.get("vishwa", 0)
        else:
            alloc_paise = int(net_profit * (o.profit_share_bps / 10000))

        capital_code = f"300{o.id}"
        capital_bal = JournalService.get_account_balance(db, capital_code)

        # Query advances for this partner and period
        adv_query = db.query(func.coalesce(func.sum(OwnerTransaction.amount_paise), 0)).filter(
            OwnerTransaction.owner_id == o.id,
            OwnerTransaction.transaction_type == OwnerTransactionType.ADVANCE,
            OwnerTransaction.period_year == year,
            OwnerTransaction.period_month == month,
        )
        advances_paid = adv_query.scalar() or 0

        # Query distributions paid for this partner and period
        dist_query = db.query(func.coalesce(func.sum(OwnerTransaction.amount_paise), 0)).filter(
            OwnerTransaction.owner_id == o.id,
            OwnerTransaction.transaction_type.in_([OwnerTransactionType.DISTRIBUTION, OwnerTransactionType.WITHDRAWAL]),
            OwnerTransaction.period_year == year,
            OwnerTransaction.period_month == month,
        )
        distributions_paid = dist_query.scalar() or 0

        remaining_payable = max(0, alloc_paise - advances_paid - distributions_paid)

        partner_details.append(
            PartnerMonthlyDetail(
                owner_id=o.id,
                owner_name=o.name,
                profit_share_percent=f"{o.profit_share_bps / 100:.1f}%",
                capital_balance_paise=capital_bal,
                monthly_allocation_paise=alloc_paise,
                advances_paid_paise=advances_paid,
                distributions_paid_paise=distributions_paid,
                remaining_payable_paise=remaining_payable,
            )
        )

    return PartnerMonthlyDistributionSummary(
        year=year,
        month=month,
        period_label=f"{year}-{month:02d}",
        net_profit_paise=net_profit,
        savings_allocation_paise=savings_allocation,
        total_partner_allocations_paise=sum(p.monthly_allocation_paise for p in partner_details),
        total_advances_paid_paise=sum(p.advances_paid_paise for p in partner_details),
        total_distributions_paid_paise=sum(p.distributions_paid_paise for p in partner_details),
        total_remaining_payable_paise=sum(p.remaining_payable_paise for p in partner_details),
        partners=partner_details,
    )


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
                period_year=tx.period_year,
                period_month=tx.period_month,
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
        raise HTTPException(status_code=404, detail="Partner not found")

    bank_cash_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
    if not bank_cash_acct or bank_cash_acct.code not in ("1001", "1002", "1003", "1004"):
        raise HTTPException(status_code=400, detail="Must select a valid liquid account (Business Cash, Business Bank, Savings Account, or Savings Cash)")

    date_str = payload.transaction_date.strftime("%Y%m%d")
    count = db.query(OwnerTransaction).filter(OwnerTransaction.reference.like(f"OTX-{date_str}-%")).count()
    reference = f"OTX-{date_str}-{count + 1:04d}"

    # Determine transaction type enum
    try:
        tx_type_enum = OwnerTransactionType(payload.transaction_type.lower())
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid transaction type: {payload.transaction_type}")

    target_year = payload.period_year or payload.transaction_date.year
    target_month = payload.period_month or payload.transaction_date.month

    # If distribution, validate against remaining payable
    if tx_type_enum == OwnerTransactionType.DISTRIBUTION:
        preview = preview_profit_allocation(year=target_year, month=target_month, db=db)
        name_lower = owner.name.strip().lower()
        if "akash" in name_lower:
            alloc = preview.akash_share_paise
        elif "pasan" in name_lower:
            alloc = preview.pasan_share_paise
        elif "vishwa" in name_lower:
            alloc = preview.vishwa_share_paise
        else:
            alloc = int(preview.net_distributable_profit_paise * (owner.profit_share_bps / 10000))

        adv_paid = db.query(func.coalesce(func.sum(OwnerTransaction.amount_paise), 0)).filter(
            OwnerTransaction.owner_id == owner.id,
            OwnerTransaction.transaction_type == OwnerTransactionType.ADVANCE,
            OwnerTransaction.period_year == target_year,
            OwnerTransaction.period_month == target_month,
        ).scalar() or 0

        dist_paid = db.query(func.coalesce(func.sum(OwnerTransaction.amount_paise), 0)).filter(
            OwnerTransaction.owner_id == owner.id,
            OwnerTransaction.transaction_type.in_([OwnerTransactionType.DISTRIBUTION, OwnerTransactionType.WITHDRAWAL]),
            OwnerTransaction.period_year == target_year,
            OwnerTransaction.period_month == target_month,
        ).scalar() or 0

        remaining = max(0, alloc - adv_paid - dist_paid)
        if payload.amount_paise > remaining:
            raise HTTPException(
                status_code=400,
                detail=f"Distribution amount of Rs. {payload.amount_paise / 100:,.2f} exceeds remaining payable allocation (Rs. {remaining / 100:,.2f}) for {target_year}-{target_month:02d}. Overpayments are not allowed.",
            )

    tx = OwnerTransaction(
        reference=reference,
        owner_id=owner.id,
        transaction_date=payload.transaction_date,
        transaction_type=tx_type_enum,
        amount_paise=payload.amount_paise,
        description=payload.description,
        account_id=bank_cash_acct.id,
        period_year=target_year,
        period_month=target_month,
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(tx)
    db.flush()

    capital_code = f"300{owner.id}"
    dist_code = f"700{owner.id}"

    if tx_type_enum in (OwnerTransactionType.INITIAL_CAPITAL, OwnerTransactionType.ADDITIONAL_CAPITAL):
        lines = [
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, True, payload.amount_paise),
            JournalLineInput(capital_code, f"Owner Capital — {owner.name}", False, payload.amount_paise),
        ]
        desc = f"Capital Contribution: {owner.name} via {bank_cash_acct.name}"
    elif tx_type_enum == OwnerTransactionType.ADVANCE:
        lines = [
            JournalLineInput(dist_code, f"Owner Distribution — {owner.name}", True, payload.amount_paise),
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, False, payload.amount_paise),
        ]
        desc = f"Partner Advance: {owner.name} ({target_year}-{target_month:02d}) via {bank_cash_acct.name}"
    elif tx_type_enum in (OwnerTransactionType.WITHDRAWAL, OwnerTransactionType.DISTRIBUTION):
        lines = [
            JournalLineInput(dist_code, f"Owner Distribution — {owner.name}", True, payload.amount_paise),
            JournalLineInput(bank_cash_acct.code, bank_cash_acct.name, False, payload.amount_paise),
        ]
        desc = f"Monthly Distribution: {owner.name} ({target_year}-{target_month:02d}) from {bank_cash_acct.name}"
    else:
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
        period_year=tx.period_year,
        period_month=tx.period_month,
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


# ==========================================
# OWNER / PARTNER COLLECTION RECORDING
# ==========================================

@router.get("/collections", response_model=list[OwnerCollectionResponse])
def list_owner_collections(
    collector_name: Optional[str] = Query(default=None),
    owner_id: Optional[int] = Query(default=None),
    status: Optional[str] = Query(default=None),
    start_date: Optional[date] = Query(default=None),
    end_date: Optional[date] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    query = db.query(OwnerCollection)
    if collector_name:
        query = query.filter(OwnerCollection.collector_name.ilike(f"%{collector_name.strip()}%"))
    if owner_id:
        query = query.filter(OwnerCollection.owner_id == owner_id)
    if status:
        query = query.filter(OwnerCollection.status == status)
    if start_date:
        query = query.filter(OwnerCollection.collection_date >= start_date)
    if end_date:
        query = query.filter(OwnerCollection.collection_date <= end_date)

    collections = query.order_by(
        desc(OwnerCollection.collection_date),
        desc(OwnerCollection.id)
    ).limit(limit).all()

    results = []
    for c in collections:
        acct = db.query(FinancialAccount).filter(FinancialAccount.id == c.destination_account_id).first()
        results.append(
            OwnerCollectionResponse(
                id=c.id,
                reference=c.reference,
                collector_name=c.collector_name,
                owner_id=c.owner_id,
                collection_date=c.collection_date,
                amount_paise=c.amount_paise,
                status=c.status.value if hasattr(c.status, "value") else str(c.status),
                destination_account_id=c.destination_account_id,
                destination_account_name=acct.name if acct else "Unknown Account",
                source_category=c.source_category,
                notes=c.notes,
                created_by=c.created_by,
                confirmed_at=c.confirmed_at,
                confirmed_by=c.confirmed_by,
                journal_entry_id=c.journal_entry_id,
                created_at=c.created_at,
            )
        )
    return results


@router.post("/collections", response_model=OwnerCollectionResponse, status_code=201)
def record_owner_collection(
    payload: OwnerCollectionCreate,
    db: Session = Depends(get_db),
):
    """
    Record business money collected by an owner/partner (Akash, Pasan, Vishwa).
    If amount is not known, sets status to PENDING_CONFIRMATION and does NOT modify financial balances.
    If amount is known and confirmed, posts accounting entries appropriately without duplicating income.
    """
    dest_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.destination_account_id).first()
    if not dest_acct:
        raise HTTPException(status_code=400, detail="Invalid destination financial account")

    # Match owner if collector is one of the partners
    owner_id = payload.owner_id
    if not owner_id:
        c_match = db.query(Owner).filter(Owner.name.ilike(f"%{payload.collector_name.strip()}%")).first()
        if c_match:
            owner_id = c_match.id

    date_str = payload.collection_date.strftime("%Y%m%d")
    count = db.query(OwnerCollection).filter(OwnerCollection.reference.like(f"COL-{date_str}-%")).count()
    reference = f"COL-{date_str}-{count + 1:04d}"

    is_unknown = payload.is_unknown_amount or (payload.amount_paise is None or payload.amount_paise <= 0)
    status = OwnerCollectionStatus.PENDING_CONFIRMATION if is_unknown else OwnerCollectionStatus.CONFIRMED
    amount_paise = None if is_unknown else payload.amount_paise

    collection = OwnerCollection(
        reference=reference,
        collector_name=payload.collector_name.strip(),
        owner_id=owner_id,
        collection_date=payload.collection_date,
        amount_paise=amount_paise,
        status=status,
        destination_account_id=dest_acct.id,
        source_category=payload.source_category.strip(),
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(collection)
    db.flush()

    # If confirmed with an amount, post appropriate accounting entry
    journal_id = None
    if status == OwnerCollectionStatus.CONFIRMED and amount_paise:
        source_cat = payload.source_category.strip()
        if source_cat == "Other Business Income":
            lines = [
                JournalLineInput(dest_acct.code, dest_acct.name, True, amount_paise),
                JournalLineInput("4004", "Other Income", False, amount_paise),
            ]
            desc = f"Business Income Collected: {collection.collector_name} ({source_cat})"
            entry = JournalService.post_entry(
                db,
                entry_date=payload.collection_date,
                description=desc,
                lines=lines,
                source_type="owner_collection",
                source_id=collection.id,
                notes=payload.notes,
            )
            journal_id = entry.id
        elif dest_acct.code == "1002" and source_cat in ("Existing Business Funds", "Pool Table Payments", "PS4 Payments", "Soft Drink Sales", "Other"):
            # Cash collected and deposited into Main Bank account
            lines = [
                JournalLineInput("1002", "Main Bank Account", True, amount_paise),
                JournalLineInput("1001", "Cash in Hand", False, amount_paise),
            ]
            desc = f"Partner Handover: {collection.collector_name} deposited {source_cat} funds to Bank"
            entry = JournalService.post_entry(
                db,
                entry_date=payload.collection_date,
                description=desc,
                lines=lines,
                source_type="owner_collection",
                source_id=collection.id,
                notes=payload.notes,
            )
            journal_id = entry.id
        # When funds remain in Cash in Hand (1001) for session/drinks, no second revenue entry is posted!

    collection.journal_entry_id = journal_id
    db.commit()
    db.refresh(collection)

    return OwnerCollectionResponse(
        id=collection.id,
        reference=collection.reference,
        collector_name=collection.collector_name,
        owner_id=collection.owner_id,
        collection_date=collection.collection_date,
        amount_paise=collection.amount_paise,
        status=collection.status.value,
        destination_account_id=collection.destination_account_id,
        destination_account_name=dest_acct.name,
        source_category=collection.source_category,
        notes=collection.notes,
        created_by=collection.created_by,
        confirmed_at=collection.confirmed_at,
        confirmed_by=collection.confirmed_by,
        journal_entry_id=collection.journal_entry_id,
        created_at=collection.created_at,
    )


@router.post("/collections/{collection_id}/confirm", response_model=OwnerCollectionResponse)
def confirm_owner_collection(
    collection_id: int,
    payload: OwnerCollectionConfirm,
    db: Session = Depends(get_db),
):
    """
    Confirm a pending collection with the exact amount discovered/counted.
    Once confirmed, posts the accounting entry exactly once and updates financial balances.
    """
    collection = db.query(OwnerCollection).filter(OwnerCollection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection record not found")

    if collection.status == OwnerCollectionStatus.CONFIRMED:
        raise HTTPException(status_code=400, detail="Collection is already confirmed")

    if payload.amount_paise <= 0:
        raise HTTPException(status_code=400, detail="Confirmed amount must be greater than zero")

    dest_acct = db.query(FinancialAccount).filter(FinancialAccount.id == collection.destination_account_id).first()
    if not dest_acct:
        raise HTTPException(status_code=400, detail="Destination account not found")

    collection.amount_paise = payload.amount_paise
    collection.status = OwnerCollectionStatus.CONFIRMED
    collection.confirmed_at = datetime.now(timezone.utc)
    collection.confirmed_by = "Admin"
    if payload.notes:
        existing = collection.notes or ""
        collection.notes = f"{existing} | Confirmed: {payload.notes}".strip(" | ")

    # Post accounting entry once
    journal_id = None
    source_cat = collection.source_category.strip()
    c_date = payload.confirmed_date or collection.collection_date

    if source_cat == "Other Business Income":
        lines = [
            JournalLineInput(dest_acct.code, dest_acct.name, True, payload.amount_paise),
            JournalLineInput("4004", "Other Income", False, payload.amount_paise),
        ]
        desc = f"Business Income Confirmed: {collection.collector_name} ({source_cat})"
        entry = JournalService.post_entry(
            db,
            entry_date=c_date,
            description=desc,
            lines=lines,
            source_type="owner_collection",
            source_id=collection.id,
            notes=collection.notes,
        )
        journal_id = entry.id
    elif dest_acct.code == "1002" and source_cat in ("Existing Business Funds", "Pool Table Payments", "PS4 Payments", "Soft Drink Sales", "Other"):
        lines = [
            JournalLineInput("1002", "Main Bank Account", True, payload.amount_paise),
            JournalLineInput("1001", "Cash in Hand", False, payload.amount_paise),
        ]
        desc = f"Partner Handover Confirmed: {collection.collector_name} deposited {source_cat} funds to Bank"
        entry = JournalService.post_entry(
            db,
            entry_date=c_date,
            description=desc,
            lines=lines,
            source_type="owner_collection",
            source_id=collection.id,
            notes=collection.notes,
        )
        journal_id = entry.id

    collection.journal_entry_id = journal_id
    db.commit()
    db.refresh(collection)

    return OwnerCollectionResponse(
        id=collection.id,
        reference=collection.reference,
        collector_name=collection.collector_name,
        owner_id=collection.owner_id,
        collection_date=collection.collection_date,
        amount_paise=collection.amount_paise,
        status=collection.status.value,
        destination_account_id=collection.destination_account_id,
        destination_account_name=dest_acct.name,
        source_category=collection.source_category,
        notes=collection.notes,
        created_by=collection.created_by,
        confirmed_at=collection.confirmed_at,
        confirmed_by=collection.confirmed_by,
        journal_entry_id=collection.journal_entry_id,
        created_at=collection.created_at,
    )


@router.put("/collections/{collection_id}", response_model=OwnerCollectionResponse)
def update_owner_collection(
    collection_id: int,
    payload: OwnerCollectionUpdate,
    db: Session = Depends(get_db),
):
    collection = db.query(OwnerCollection).filter(OwnerCollection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection record not found")

    if payload.notes is not None:
        collection.notes = payload.notes
    if payload.source_category:
        collection.source_category = payload.source_category.strip()
    if payload.destination_account_id:
        dest_acct = db.query(FinancialAccount).filter(FinancialAccount.id == payload.destination_account_id).first()
        if not dest_acct:
            raise HTTPException(status_code=400, detail="Invalid destination account")
        collection.destination_account_id = dest_acct.id

    db.commit()
    db.refresh(collection)
    dest_acct = db.query(FinancialAccount).filter(FinancialAccount.id == collection.destination_account_id).first()

    return OwnerCollectionResponse(
        id=collection.id,
        reference=collection.reference,
        collector_name=collection.collector_name,
        owner_id=collection.owner_id,
        collection_date=collection.collection_date,
        amount_paise=collection.amount_paise,
        status=collection.status.value if hasattr(collection.status, "value") else str(collection.status),
        destination_account_id=collection.destination_account_id,
        destination_account_name=dest_acct.name if dest_acct else "Unknown Account",
        source_category=collection.source_category,
        notes=collection.notes,
        created_by=collection.created_by,
        confirmed_at=collection.confirmed_at,
        confirmed_by=collection.confirmed_by,
        journal_entry_id=collection.journal_entry_id,
        created_at=collection.created_at,
    )

