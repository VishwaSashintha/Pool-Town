from datetime import date
import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.accounts import FinancialAccount
from app.models.journal import AccountingPeriod, JournalEntry
from app.schemas.accounts import (
    CashCountCreate,
    BankReconciliationCreate,
    PeriodCloseRequest,
    PeriodReopenRequest,
    OpeningBalanceCreate,
    OpeningBalanceItem,
)
from app.routers.accounts import (
    get_expected_cash,
    record_cash_count,
    list_cash_counts,
    get_expected_bank,
    record_bank_reconciliation,
    list_bank_reconciliations,
    close_period,
    reopen_period,
    list_periods,
    post_opening_balances,
    get_opening_balances,
)
from app.services.journal import JournalService, JournalLineInput, ClosedPeriodError
from app.services.seed import seed_master_data


@pytest.fixture(autouse=True)
def seed_data(db: Session):
    seed_master_data(db)


def test_cash_reconciliation_workflow(db: Session):
    cash_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()

    # Seed cash of Rs. 15,000 (1,500,000 paise)
    JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 10),
        description="Pool income",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 1500000),
            JournalLineInput("4001", "Pool Table Revenue", False, 1500000),
        ],
        source_type="session",
    )

    # Check expected cash
    exp = get_expected_cash(as_of_date=date(2026, 1, 10), db=db)
    assert exp["expected_paise"] == 1500000

    # Count physical cash: counted Rs. 14,800 (1,480,000 paise) -> Rs. 200 shortage
    count_res = record_cash_count(
        payload=CashCountCreate(
            count_date=date(2026, 1, 10),
            counted_paise=1480000,
            notes="Minor difference in coins register",
            investigated_by="Vishwa",
        ),
        db=db,
    )
    assert count_res.expected_paise == 1500000
    assert count_res.counted_paise == 1480000
    assert count_res.difference_paise == -20000  # Negative = Shortage

    # Verify count listed in history
    counts = list_cash_counts(db=db)
    assert len(counts) >= 1
    assert counts[0].difference_paise == -20000


def test_bank_reconciliation_workflow(db: Session):
    bank_acct = db.query(FinancialAccount).filter(FinancialAccount.code == "1002").first()

    # Seed bank deposit of Rs. 50,000 (5,000,000 paise)
    JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 12),
        description="Bank deposit",
        lines=[
            JournalLineInput("1002", "Main Bank Account", True, 5000000),
            JournalLineInput("3001", "Owner Capital — Akash", False, 5000000),
        ],
        source_type="capital",
    )

    exp = get_expected_bank(account_id=bank_acct.id, as_of_date=date(2026, 1, 12), db=db)
    assert exp["book_balance_paise"] == 5000000

    # Statement shows Rs. 50,000 -> 0 difference (Exact Match)
    rec = record_bank_reconciliation(
        payload=BankReconciliationCreate(
            reconciliation_date=date(2026, 1, 12),
            account_id=bank_acct.id,
            statement_balance_paise=5000000,
            notes="January bank statement verified",
        ),
        db=db,
    )
    assert rec.difference_paise == 0

    recs = list_bank_reconciliations(db=db)
    assert len(recs) >= 1
    assert recs[0].statement_balance_paise == 5000000


def test_accounting_period_closing_and_reopening(db: Session):
    # Close January 2026
    closed_p = close_period(
        year=2026,
        month=1,
        payload=PeriodCloseRequest(closed_by="Akash"),
        db=db,
    )
    assert closed_p.is_closed is True
    assert closed_p.closed_by == "Akash"

    # Verify that JournalService prevents posting into the closed period
    with pytest.raises(ClosedPeriodError):
        JournalService.post_entry(
            db,
            entry_date=date(2026, 1, 15),
            description="Attempt to post in closed January",
            lines=[
                JournalLineInput("1001", "Cash in Hand", True, 100000),
                JournalLineInput("4001", "Pool Table Revenue", False, 100000),
            ],
            source_type="test",
        )

    # Reopen period with required justification
    reopened_p = reopen_period(
        year=2026,
        month=1,
        payload=PeriodReopenRequest(
            reason="Audit adjustment required for supplier invoice",
            reopened_by="Akash & Vishwa",
        ),
        db=db,
    )
    assert reopened_p.is_closed is False
    assert "Audit adjustment" in reopened_p.reopen_reason

    # Now posting succeeds
    entry = JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 15),
        description="Posted after authorized reopen",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 100000),
            JournalLineInput("4001", "Pool Table Revenue", False, 100000),
        ],
        source_type="test",
    )
    assert entry.status.value == "posted"


def test_opening_balances_workflow(db: Session):
    # As of 31 Dec 2025:
    # Assets (DR):
    # - Cash in Hand (1001): Rs. 25,000
    # - Main Bank (1002): Rs. 100,000
    # - Fixed Assets (1030): Rs. 400,000
    # Total Assets = Rs. 525,000 (52,500,000 paise)
    #
    # Liabilities & Equity (CR):
    # - Loan Payable (2010): Rs. 225,000 (22,500,000 paise)
    # - Owner Capital Akash (3001): Rs. 100,000 (10,000,000 paise)
    # - Owner Capital Pasan (3002): Rs. 100,000 (10,000,000 paise)
    # - Owner Capital Vishwa (3003): Rs. 100,000 (10,000,000 paise)
    # Total Liab + Eq = Rs. 525,000 (52,500,000 paise)
    # Balanced!

    res = post_opening_balances(
        payload=OpeningBalanceCreate(
            effective_date=date(2025, 12, 31),
            items=[
                OpeningBalanceItem(account_code="1001", amount_paise=2500000, is_debit=True),
                OpeningBalanceItem(account_code="1002", amount_paise=10000000, is_debit=True),
                OpeningBalanceItem(account_code="1030", amount_paise=40000000, is_debit=True),
                OpeningBalanceItem(account_code="2010", amount_paise=22500000, is_debit=False),
                OpeningBalanceItem(account_code="3001", amount_paise=10000000, is_debit=False),
                OpeningBalanceItem(account_code="3002", amount_paise=10000000, is_debit=False),
                OpeningBalanceItem(account_code="3003", amount_paise=10000000, is_debit=False),
            ],
            notes="Opening position as of 31 Dec 2025 verified by owners",
        ),
        db=db,
    )
    assert res["entry_id"] > 0
    assert "JE-OPENING-20251231" in res["reference"]

    # Verify opening balances reported
    info = get_opening_balances(db=db)
    assert info["posted"] is True
    assert len(info["lines"]) == 7

    # Verify trial balance as of 2025-12-31 balances
    tb = JournalService.get_trial_balance(db, as_of_date=date(2025, 12, 31))
    total_dr = sum(r["total_debit_paise"] for r in tb)
    total_cr = sum(r["total_credit_paise"] for r in tb)
    assert total_dr == total_cr == 52500000
