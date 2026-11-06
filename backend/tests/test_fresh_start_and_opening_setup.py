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

    res = client.get("/api/accounts")
    assert res.status_code == 200
    accounts = res.json()
    assert len(accounts) >= 40
    for acct in accounts:
        assert acct["current_balance_paise"] == 0, f"Account {acct['code']} ({acct['name']}) has non-zero balance!"


    ob_res = client.get("/api/accounts/opening-balances")
    assert ob_res.status_code == 200
    ob_data = ob_res.json()
    assert ob_data["posted"] is False
    assert ob_data["total_amount_paise"] == 0


def test_equal_owner_capital_and_relatives_contributions_setup(db: Session, client: TestClient):


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


    db.expire_all()
    cash_bal = JournalService.get_account_balance(db, "1001")
    bank_bal = JournalService.get_account_balance(db, "1002")
    sav_bank_bal = JournalService.get_account_balance(db, "1003")
    sav_cash_bal = JournalService.get_account_balance(db, "1004")

    assert cash_bal == 10000000
    assert bank_bal == 20000000
    assert sav_bank_bal == 3000000
    assert sav_cash_bal == 2000000


    total_savings = sav_cash_bal + sav_bank_bal
    assert total_savings == 5000000


    cap_akash = JournalService.get_account_balance(db, "3001")
    cap_pasan = JournalService.get_account_balance(db, "3002")
    cap_vishwa = JournalService.get_account_balance(db, "3003")
    assert cap_akash == cap_pasan == cap_vishwa == 10000000


    ext_cont = JournalService.get_account_balance(db, "3020")
    assert ext_cont == 5000000


    tb = JournalService.get_trial_balance(db)
    total_dr = sum(r["total_debit_paise"] for r in tb)
    total_cr = sum(r["total_credit_paise"] for r in tb)
    assert total_dr == total_cr == 35000000


    preview = preview_profit_allocation(year=2026, month=1, db=db)
    assert preview.revenue_paise == 0
    assert preview.net_distributable_profit_paise == 0


def test_opening_balance_rejection_on_imbalance(client: TestClient):

    payload = {
        "opening_date": "2026-01-01",
        "owner_contributions": [
            {"owner_name": "Akash", "amount_paise": 10000000, "destination_code": "1002"},

        ],
        "relative_contributions": [],
        "direct_assets": [
            {"account_code": "1030", "name": "Pool Table", "amount_paise": 20000000},
        ],
        "opening_liabilities": [],
    }
    res = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res.status_code == 400
    assert "unbalanced" in res.json()["detail"].lower()


def test_duplicate_posting_prevention(client: TestClient):

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


    res2 = client.post("/api/accounts/opening-balances/setup", json=payload)
    assert res2.status_code == 400
    assert "already posted" in res2.json()["detail"].lower()


def test_safe_reversal_and_reopen_workflow(db: Session, client: TestClient):

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


    db.expire_all()
    assert JournalService.get_account_balance(db, "1001") == 15000000


    rev_res = client.post("/api/accounts/opening-balances/reverse", json={"reason": "Correcting partner capital figures"})
    assert rev_res.status_code == 200


    db.expire_all()
    assert JournalService.get_account_balance(db, "1001") == 0
    assert JournalService.get_account_balance(db, "3001") == 0


    ob_res = client.get("/api/accounts/opening-balances")
    assert ob_res.json()["posted"] is False
