from datetime import date
import pytest
from sqlalchemy.orm import Session

from app.models.accounts import FinancialAccount
from app.models.owners import Owner, Loan, LoanType, LoanStatus, LoanTransactionType
from app.schemas.owners import (
    OwnerTransactionCreate,
    LoanCreate,
    LoanRepaymentCreate,
    ProfitAllocationPost,
)
from app.routers.owners import (
    list_owners,
    record_owner_transaction,
    list_owner_transactions,
    create_loan,
    list_loans,
    record_loan_repayment,
    preview_profit_allocation,
    post_profit_allocation,
)
from app.services.journal import JournalService, JournalLineInput
from app.services.seed import seed_master_data


@pytest.fixture(autouse=True)
def seed_data(db: Session):
    seed_master_data(db)


def test_owner_capital_injection_and_balances(db: Session):
    owners = list_owners(db=db)
    assert len(owners) >= 3
    akash = next(o for o in owners if o.name == "Akash")
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()

    # Record capital contribution of Rs. 100,000 (10,000,000 paise)
    tx = record_owner_transaction(
        payload=OwnerTransactionCreate(
            owner_id=akash.id,
            transaction_date=date(2026, 1, 5),
            transaction_type="initial_capital",
            amount_paise=10000000,
            account_id=cash_acct.id,
            description="Initial capital injection from Akash",
        ),
        db=db,
    )
    assert tx.amount_paise == 10000000

    # Verify capital account balance updated
    updated_owners = list_owners(db=db)
    akash_updated = next(o for o in updated_owners if o.name == "Akash")
    assert akash_updated.capital_balance_paise == 10000000

    # Verify cash account balance increased
    cash_bal = JournalService.get_account_balance(db, "1001")
    assert cash_bal == 10000000


def test_owner_withdrawal(db: Session):
    pasan = db.query(Owner).filter(Owner.name == "Pasan").first()
    bank_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1002").first()

    # Inject some funds to bank first so balance exists
    JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 1),
        description="Fund bank",
        lines=[
            JournalLineInput("1002", "Main Bank Account", True, 5000000),
            JournalLineInput("3002", "Owner Capital — Pasan", False, 5000000),
        ],
        source_type="seed",
    )

    # Pasan withdraws Rs. 10,000 (1,000,000 paise)
    tx = record_owner_transaction(
        payload=OwnerTransactionCreate(
            owner_id=pasan.id,
            transaction_date=date(2026, 1, 15),
            transaction_type="withdrawal",
            amount_paise=1000000,
            account_id=bank_acct.id,
            description="Personal drawing by Pasan",
        ),
        db=db,
    )

    updated_owners = list_owners(db=db)
    pasan_updated = next(o for o in updated_owners if o.name == "Pasan")
    assert pasan_updated.distributions_total_paise == 1000000


def test_loan_lifecycle_and_mixed_repayment(db: Session):
    bank_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1002").first()

    # Create a bank loan of Rs. 500,000 (50,000,000 paise) disbursed to Bank
    loan = create_loan(
        payload=LoanCreate(
            lender_name="Commercial Bank",
            loan_type="bank",
            original_principal_paise=50000000,
            start_date=date(2026, 1, 10),
            interest_rate_bps=1200,
            disburse_to_account_id=bank_acct.id,
            notes="Business development facility",
        ),
        db=db,
    )
    assert loan.original_principal_paise == 50000000
    assert loan.status == "active"

    # Verify liability account 2010 balance
    loan_liability = JournalService.get_account_balance(db, "2010")
    assert loan_liability == 50000000

    # Record mixed repayment: Rs. 10,000 (Rs. 8,000 principal + Rs. 2,000 interest)
    rep_res = record_loan_repayment(
        loan_id=loan.id,
        payload=LoanRepaymentCreate(
            repayment_date=date(2026, 2, 10),
            principal_amount_paise=800000,
            interest_amount_paise=200000,
            account_id=bank_acct.id,
            notes="Month 1 installment",
        ),
        db=db,
    )
    assert "posted successfully" in rep_res["message"]

    # Verify liability reduced by 8,000 rupees
    updated_liability = JournalService.get_account_balance(db, "2010")
    assert updated_liability == 50000000 - 800000

    # Verify interest expense (6020) recorded
    interest_exp = JournalService.get_account_balance(db, "6020")
    assert interest_exp == 200000

    # Verify loan remaining principal
    loans = list_loans(db=db)
    active_loan = next(l for l in loans if l.id == loan.id)
    assert active_loan.current_outstanding_paise == 50000000 - 800000


def test_profit_allocation_workflow(db: Session):
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()

    # Post revenue of Rs. 100,000 in January 2026
    JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 20),
        description="Pool and drinks revenue",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 10000000),
            JournalLineInput("4001", "Pool Table Revenue", False, 10000000),
        ],
        source_type="revenue",
    )

    # Post expense of Rs. 30,000
    JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 25),
        description="Electricity bill",
        lines=[
            JournalLineInput("6001", "Electricity", True, 3000000),
            JournalLineInput("1001", "Cash in Hand", False, 3000000),
        ],
        source_type="expense",
    )

    # Net profit = Rs. 70,000 (7,000,000 paise)
    preview = preview_profit_allocation(year=2026, month=1, db=db)
    assert preview.revenue_paise == 10000000
    assert preview.expenses_paise == 3000000
    assert preview.net_distributable_profit_paise == 7000000

    # 40% Savings = Rs. 28,000
    # 20% Akash = Rs. 14,000
    # 20% Pasan = Rs. 14,000
    # 20% Vishwa = Rs. 14,000
    assert preview.savings_share_paise == 2800000
    assert preview.akash_share_paise == 1400000
    assert preview.pasan_share_paise == 1400000
    assert preview.vishwa_share_paise == 1400000

    # Post formal allocation
    res = post_profit_allocation(
        payload=ProfitAllocationPost(
            year=2026,
            month=1,
            approved_by="Akash, Pasan, Vishwa",
            notes="Formal January close",
        ),
        db=db,
    )
    assert "posted and approved" in res["message"]

    # Verify equity accounts credited
    savings_alloc = JournalService.get_account_balance(db, "3011")
    assert savings_alloc == 2800000


def test_monthly_summary_and_advances_deduction(db: Session):
    from app.routers.owners import get_monthly_distribution_summary
    from fastapi import HTTPException

    # Post revenue of Rs. 35,000 in October 2026
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()
    akash = db.query(Owner).filter(Owner.name == "Akash").first()

    JournalService.post_entry(
        db,
        entry_date=date(2026, 10, 10),
        description="October billiard revenue",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 3500000),
            JournalLineInput("4001", "Pool Table Revenue", False, 3500000),
        ],
        source_type="revenue",
    )

    # Check summary before any advance
    summary = get_monthly_distribution_summary(year=2026, month=10, db=db)
    assert summary.net_profit_paise == 3500000
    assert summary.savings_allocation_paise == 1400000
    assert summary.total_partner_allocations_paise == 2100000

    akash_detail = next(p for p in summary.partners if p.owner_name == "Akash")
    assert akash_detail.monthly_allocation_paise == 700000
    assert akash_detail.advances_paid_paise == 0
    assert akash_detail.remaining_payable_paise == 700000

    # Record Advance of Rs. 2,000 on 15 October 2026
    adv_tx = record_owner_transaction(
        payload=OwnerTransactionCreate(
            owner_id=akash.id,
            transaction_date=date(2026, 10, 15),
            transaction_type="advance",
            amount_paise=200000,
            account_id=cash_acct.id,
            period_year=2026,
            period_month=10,
            description="Advance payment to Akash for October",
        ),
        db=db,
    )
    assert adv_tx.amount_paise == 200000

    # Check updated summary: remaining payable must be Rs. 5,000
    summary_after_adv = get_monthly_distribution_summary(year=2026, month=10, db=db)
    akash_after = next(p for p in summary_after_adv.partners if p.owner_name == "Akash")
    assert akash_after.monthly_allocation_paise == 700000
    assert akash_after.advances_paid_paise == 200000
    assert akash_after.remaining_payable_paise == 500000

    # Attempting to record distribution of Rs. 6,000 (exceeding Rs. 5,000) must raise 400
    with pytest.raises(HTTPException) as exc_info:
        record_owner_transaction(
            payload=OwnerTransactionCreate(
                owner_id=akash.id,
                transaction_date=date(2026, 10, 31),
                transaction_type="distribution",
                amount_paise=600000,
                account_id=cash_acct.id,
                period_year=2026,
                period_month=10,
                description="Final October distribution attempt",
            ),
            db=db,
        )
    assert "exceeds remaining payable allocation" in exc_info.value.detail

    # Record exact remaining distribution of Rs. 5,000
    dist_tx = record_owner_transaction(
        payload=OwnerTransactionCreate(
            owner_id=akash.id,
            transaction_date=date(2026, 10, 31),
            transaction_type="distribution",
            amount_paise=500000,
            account_id=cash_acct.id,
            period_year=2026,
            period_month=10,
            description="Final October distribution to Akash",
        ),
        db=db,
    )
    assert dist_tx.amount_paise == 500000

    # Remaining payable is now 0; total paid is 7,000 (no double-counting)
    summary_final = get_monthly_distribution_summary(year=2026, month=10, db=db)
    akash_final = next(p for p in summary_final.partners if p.owner_name == "Akash")
    assert akash_final.advances_paid_paise == 200000
    assert akash_final.distributions_paid_paise == 500000
    assert akash_final.remaining_payable_paise == 0

