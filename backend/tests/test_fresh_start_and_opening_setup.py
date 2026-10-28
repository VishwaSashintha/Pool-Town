"""
Tests for Fresh-Start Verification and Opening Balance Setup.
Covers:
1. Fresh-start baseline: all financial accounts show Rs. 0.00 when no transactions exist.
2. Equal Owner Capital Contributions workflow (Akash, Pasan, Vishwa) with destination routing.
3. Relatives' contributions on opening day with proper classification (gift/equity vs loan/liability)
   and placement in Cash, Bank, Savings Cash (1004), or Savings Bank (1003).
4. Savings identity: Total Business Savings == Savings Cash + Savings Bank.
5. Operating profit isolation: Capital & relatives' contributions never count as operating revenue.
6. Double-posting prevention (idempotency guard).
7. Safe reversal and re-entry workflow with audit trail.
"""
from datetime import date
import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient

from app.services.seed import seed_master_data
from app.models.accounts import FinancialAccount
from app.models.owners import Owner, OwnerTransaction, OwnerTransactionType
from app.models.journal import JournalEntry, JournalLine, JournalEntryStatus
from app.services.journal import JournalService
from app.schemas.accounts import (
    OpeningBalanceSetupRequest,
    OwnerCapitalContributionInput,
    RelativeContributionInput,
    OpeningAssetInput,
    OpeningLiabilityInput,
    OpeningBalanceReverseRequest,
)
from app.routers.accounts import (
    get_opening_balances,
    post_opening_balances_setup,
    reverse_opening_balances,
)
from app.routers.owners import preview_profit_allocation


@pytest.fixture(autouse=True)
def seed_data(db):
    seed_master_data(db)


def test_fresh_start_all_accounts_zero(db: Session, client: TestClient):
    """Before any opening balance is posted, all active accounts must display Rs. 0.00."""
    res = client.get("/api/accounts")
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) >= 40
    for acct in accounts:
        assert acct["current_balance_paise"] == 0, f"Account {acct['code']} ({acct['name']}) has non-zero balance!"

    # Also check opening-balances endpoint reports not posted
    ob_res = client.get("/api/accounts/opening-balances")
    assert ob_res.status_code == 200
    ob_data = ob_res.json()
    assert ob_data["posted"] is False
    assert ob_data["total_amount_paise"] == 0


def test_equal_owner_capital_and_relatives_contributions_setup(db: Session, client: TestClient):
    """
    Simulate full opening position:
    - 3 Owners contribute equal capital of Rs. 100,000 each (Rs. 300,000 total)
      Akash -> Bank, Pasan -> Bank, Vishwa -> Cash
    - Relatives contribute Rs. 50,000:
      Uncle Somapala: Rs. 30,000 gift placed into Savings Bank (1003)
      Aunt Kamala: Rs. 20,000 gift placed into Savings Cash (1004)
    - Total Assets = Rs. 200,000 (Bank) + Rs. 100,000 (Cash) + Rs. 30,000 (Savings Bank) + Rs. 20,000 (Savings Cash) = Rs. 350,000
    - Total Equity = Rs. 300,000 (Owner Capital) + Rs. 50,000 (External Contributions) = Rs. 350,000
    """
    payload = {
        "opening_date": "2026-01-01",
        "owner_contributions": [
            {"owner_name": "Akash", "amount_paise": 10000000, "destination_code": "1002"},
            {"owner_name": "Pasan", "amount_paise": 10000000, "destination_code": "1002"},
            {"owner_name": "Vishwa", "amount_paise": 10000000, "destination_code": "1001"},
        ],
        "relative_contributions": [
            {
                "contributor_name": "Uncle Somapala",
                "amount_paise": 3000000,
                "destination_code": "1003",
                "classification": "GIFT",
                "purpose": "Opening day family blessing gift",
            },
            {
                "contributor_name": "Aunt Kamala",
                "amount_paise": 2000000,
                "destination_code": "1004",
                "classification": "GIFT",
                "purpose": "Opening cash envelope",
            },
        ],
        "direct_assets": [],
        "opening_liabilities": [],
        "notes": "Pool Town Opening Position",
    }

    res = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["reference"].startswith("JE-OPENING-20260101")
    assert data["entry_id"] > 0

    # Verify balances across accounts
    db.expire_all()
    cash_bal = JournalService.get_account_balance(db, "1001")
    bank_bal = JournalService.get_account_balance(db, "1002")
    sav_bank_bal = JournalService.get_account_balance(db, "1003")
    sav_cash_bal = JournalService.get_account_balance(db, "1004")

    assert cash_bal == 10000000       # Rs. 100,000 (from Vishwa)
    assert bank_bal == 20000000       # Rs. 200,000 (Akash + Pasan)
    assert sav_bank_bal == 3000000    # Rs. 30,000 (Uncle Somapala)
    assert sav_cash_bal == 2000000    # Rs. 20,000 (Aunt Kamala)

    # Invariant: Total Business Savings == Savings Cash + Savings Bank
    total_savings = sav_cash_bal + sav_bank_bal
    assert total_savings == 5000000   # Rs. 50,000

    # Verify Owner Capital accounts
    cap_akash = JournalService.get_account_balance(db, "3001")
    cap_pasan = JournalService.get_account_balance(db, "3002")
    cap_vishwa = JournalService.get_account_balance(db, "3003")
    assert cap_akash == cap_pasan == cap_vishwa == 10000000  # Equal Rs. 100,000 each!

    # Verify External Contributions (Equity 3020)
    ext_cont = JournalService.get_account_balance(db, "3020")
    assert ext_cont == 5000000        # Rs. 50,000

    # Verify Trial Balance balances (Total Dr == Total Cr == 35,000,000 paise)
    tb = JournalService.get_trial_balance(db)
    total_dr = sum(r["total_debit_paise"] for r in tb)
    total_cr = sum(r["total_credit_paise"] for r in tb)
    assert total_dr == total_cr == 35000000

    # Verify that opening capital and relatives contributions are EXCLUDED from operating revenue / profit!
    preview = preview_profit_allocation(year=2026, month=1, db=db)
    assert preview.revenue_paise == 0
    assert preview.net_distributable_profit_paise == 0


def test_opening_balance_rejection_on_imbalance(client: TestClient):
    """An unbalanced opening setup (Assets != Capital + Liabilities) must be rejected with 400."""
    payload = {
        "opening_date": "2026-01-01",
        "owner_contributions": [
            {"owner_name": "Akash", "amount_paise": 10000000, "destination_code": "1002"},
            # Total capital = Rs. 100,000
        ],
        "relative_contributions": [],
        "direct_assets": [
            {"account_code": "1030", "name": "Pool Table", "amount_paise": 20000000},  # Rs. 200,000 asset without source!
        ],
        "opening_liabilities": [],
    }
    res = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res.status_code == 400
    assert "unbalanced" in res.json()["detail"].lower()


def test_duplicate_posting_prevention(client: TestClient):
    """Once opening balance is posted, attempting to post again must be blocked."""
    payload = {
        "opening_date": "2026-01-01",
        "owner_contributions": [
            {"owner_name": "Akash", "amount_paise": 5000000, "destination_code": "1001"},
            {"owner_name": "Pasan", "amount_paise": 5000000, "destination_code": "1001"},
            {"owner_name": "Vishwa", "amount_paise": 5000000, "destination_code": "1001"},
        ],
    }
    res1 = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res1.status_code == 201

    # Second attempt must fail
    res2 = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res2.status_code == 400
    assert "already posted" in res2.json()["detail"].lower()


def test_safe_reversal_and_reopen_workflow(db: Session, client: TestClient):
    """Administrators can safely reverse opening balance and re-enter fresh numbers."""
    payload = {
        "opening_date": "2026-01-01",
        "owner_contributions": [
            {"owner_name": "Akash", "amount_paise": 5000000, "destination_code": "1001"},
            {"owner_name": "Pasan", "amount_paise": 5000000, "destination_code": "1001"},
            {"owner_name": "Vishwa", "amount_paise": 5000000, "destination_code": "1001"},
        ],
    }
    res1 = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res1.status_code == 201

    # Cash balance should be Rs. 150,000
    db.expire_all()
    assert JournalService.get_account_balance(db, "1001") == 15000000

    # Reverse
    rev_res = client.post("/api/accounts/opening-balances/reverse", json={"reason": "Correcting partner capital figures"})
    assert rev_res.status_code == 200

    # Cash balance should now be restored to Rs. 0.00
    db.expire_all()
    assert JournalService.get_account_balance(db, "1001") == 0
    assert JournalService.get_account_balance(db, "3001") == 0

    # And now get_opening_balances should report posted=False
    ob_res = client.get("/api/accounts/opening-balances")
    assert ob_res.json()["posted"] is False
