"""
Tests for JournalService and core accounting invariants.
Enforces:
1. Every journal entry must balance (Sum DR == Sum CR).
2. Closed periods reject new postings.
3. Posted entries are immutable and only reversible.
4. Correct normal-balance calculations for Assets, Liabilities, Equity, Revenue, and Expenses.
5. Trial balance total debits equal total credits.
"""
from datetime import date
import pytest

from app.services.journal import (
    JournalService,
    JournalLineInput,
    UnbalancedJournalEntryError,
    ClosedPeriodError,
    AccountingError,
)
from app.models.journal import JournalEntryStatus, AccountingPeriod


def test_post_balanced_entry(db):
    entry = JournalService.post_entry(
        db,
        entry_date=date(2026, 1, 15),
        description="Cash payment for pool session",
        lines=[
            JournalLineInput(
                account_code="1001",
                account_name="Cash in Hand",
                is_debit=True,
                amount_paise=50000,
            ),
            JournalLineInput(
                account_code="4001",
                account_name="Pool Table Revenue",
                is_debit=False,
                amount_paise=50000,
            ),
        ],
    )
    assert entry.id is not None
    assert entry.status == JournalEntryStatus.POSTED
    assert len(entry.lines) == 2
    assert entry.reference.startswith("JE-202601-")


def test_reject_unbalanced_entry(db):
    with pytest.raises(UnbalancedJournalEntryError) as exc_info:
        JournalService.post_entry(
            db,
            entry_date=date(2026, 1, 15),
            description="Unbalanced entry test",
            lines=[
                JournalLineInput(
                    account_code="1001",
                    account_name="Cash in Hand",
                    is_debit=True,
                    amount_paise=50000,
                ),
                JournalLineInput(
                    account_code="4001",
                    account_name="Pool Table Revenue",
                    is_debit=False,
                    amount_paise=40000,  # 10000 paise out of balance
                ),
            ],
        )
    assert "out of balance by 10000 paise" in str(exc_info.value)


def test_reject_negative_or_zero_line_amount(db):
    with pytest.raises(AccountingError):
        JournalService.post_entry(
            db,
            entry_date=date(2026, 1, 15),
            description="Zero amount test",
            lines=[
                JournalLineInput("1001", "Cash", True, 0),
                JournalLineInput("4001", "Revenue", False, 0),
            ],
        )


def test_reject_fewer_than_two_lines(db):
    with pytest.raises(AccountingError):
        JournalService.post_entry(
            db,
            entry_date=date(2026, 1, 15),
            description="Single line test",
            lines=[
                JournalLineInput("1001", "Cash", True, 50000),
            ],
        )


def test_closed_period_prevents_posting(db):
    # Create and close period for January 2026
    period = JournalService.get_or_create_period(db, date(2026, 1, 1))
    period.is_closed = True
    db.flush()

    with pytest.raises(ClosedPeriodError) as exc_info:
        JournalService.post_entry(
            db,
            entry_date=date(2026, 1, 20),
            description="Post to closed period",
            lines=[
                JournalLineInput("1001", "Cash in Hand", True, 50000),
                JournalLineInput("4001", "Pool Table Revenue", False, 50000),
            ],
        )
    assert "is CLOSED" in str(exc_info.value)


def test_journal_entry_reversal(db):
    original = JournalService.post_entry(
        db,
        entry_date=date(2026, 2, 1),
        description="Erroneous charge entry",
        lines=[
            JournalLineInput("1010", "Accounts Receivable — Pool", True, 80000),
            JournalLineInput("4001", "Pool Table Revenue", False, 80000),
        ],
    )
    assert original.status == JournalEntryStatus.POSTED

    # Reverse it
    reversal = JournalService.reverse_entry(
        db,
        original.id,
        reversal_date=date(2026, 2, 2),
        reason="Entered wrong duration",
        created_by="Akash",
    )

    assert reversal.status == JournalEntryStatus.POSTED
    assert reversal.reverses_entry_id == original.id
    assert original.status == JournalEntryStatus.REVERSED

    # Check reversed lines: AR should now be Credit, Revenue should be Debit
    rev_lines = {l.account_code: (l.is_debit, l.amount_paise) for l in reversal.lines}
    assert rev_lines["1010"] == (False, 80000)  # CR AR
    assert rev_lines["4001"] == (True, 80000)   # DR Revenue

    # Cannot reverse twice
    with pytest.raises(AccountingError):
        JournalService.reverse_entry(
            db,
            original.id,
            reversal_date=date(2026, 2, 3),
            reason="Second reversal attempt",
        )


def test_account_balances_and_trial_balance(db):
    entry_date = date(2026, 3, 1)

    # 1. Partner Vishwa introduces Rs. 100,000 capital (Cash DR 100,000, Vishwa Capital CR 100,000)
    JournalService.post_entry(
        db,
        entry_date=entry_date,
        description="Initial capital from Vishwa",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 10000000),
            JournalLineInput("3003", "Owner Capital — Vishwa", False, 10000000),
        ],
    )

    # 2. Rent paid Rs. 25,000 cash (Rent DR 25,000, Cash CR 25,000)
    JournalService.post_entry(
        db,
        entry_date=entry_date,
        description="Premises rent payment",
        lines=[
            JournalLineInput("6003", "Rent", True, 2500000),
            JournalLineInput("1001", "Cash in Hand", False, 2500000),
        ],
    )

    # 3. Pool session revenue cash Rs. 5,000 (Cash DR 5,000, Revenue CR 5,000)
    JournalService.post_entry(
        db,
        entry_date=entry_date,
        description="Daily pool sessions collection",
        lines=[
            JournalLineInput("1001", "Cash in Hand", True, 500000),
            JournalLineInput("4001", "Pool Table Revenue", False, 500000),
        ],
    )

    # Balances:
    # Cash (1001): 10,000,000 - 2,500,000 + 500,000 = 8,000,000 paise (Rs. 80,000)
    cash_bal = JournalService.get_account_balance(db, "1001")
    assert cash_bal == 8000000

    # Rent (6003): 2,500,000 paise (Rs. 25,000)
    rent_bal = JournalService.get_account_balance(db, "6003")
    assert rent_bal == 2500000

    # Revenue (4001): 500,000 paise (Rs. 5,000)
    rev_bal = JournalService.get_account_balance(db, "4001")
    assert rev_bal == 500000

    # Capital (3003): 10,000,000 paise (Rs. 100,000)
    cap_bal = JournalService.get_account_balance(db, "3003")
    assert cap_bal == 10000000

    # Trial Balance: Total Debits must equal Total Credits
    tb = JournalService.get_trial_balance(db)
    total_debits = sum(row["total_debit_paise"] for row in tb)
    total_credits = sum(row["total_credit_paise"] for row in tb)

    assert total_debits == total_credits
    assert total_debits == 13000000  # 10M + 2.5M + 0.5M
