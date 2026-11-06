from datetime import date
import pytest
from app.services.seed import seed_master_data
from app.models.journal import JournalEntry, JournalLine
from app.models.sessions import PoolSession, PS4Session, SessionStatus


@pytest.fixture(autouse=True)
def seed_data(db):
    seed_master_data(db)


def test_create_pool_session_and_verify_accounting(client, db):


    payload = {
        "session_date": "2026-01-10",
        "customer_name": "Kasun Perera",
        "chargeable_minutes": 90,
        "actual_minutes": 90,
        "discount_paise": 10000,
        "initial_payment_paise": 50000,
        "initial_payment_method": "cash",
        "notes": "Table friendly match",
    }

    res = client.post("/api/sessions/pool", json=payload)
    assert res.status_code == 201
    data = res.json()

    assert data["standard_charge_paise"] == 80000
    assert data["discount_paise"] == 10000
    assert data["final_charge_paise"] == 70000
    assert data["paid_amount_paise"] == 50000
    assert data["outstanding_paise"] == 20000
    assert data["status"] == "partial"
    assert data["reference"].startswith("POOL-20260110-")


    rev_entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "pool_session",
        JournalEntry.source_id == data["id"],
    ).first()
    assert rev_entry is not None
    lines = {l.account_code: (l.is_debit, l.amount_paise) for l in rev_entry.lines}
    assert lines["1010"] == (True, 70000)
    assert lines["4001"] == (False, 70000)


    pay_entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "session_payment"
    ).first()
    assert pay_entry is not None
    pay_lines = {l.account_code: (l.is_debit, l.amount_paise) for l in pay_entry.lines}
    assert pay_lines["1001"] == (True, 50000)
    assert pay_lines["1010"] == (False, 50000)


def test_reject_session_overpayment(client):

    payload = {
        "session_date": "2026-01-11",
        "customer_name": "Overpayer",
        "chargeable_minutes": 60,
        "initial_payment_paise": 60000,
        "initial_payment_method": "cash",
    }
    res = client.post("/api/sessions/pool", json=payload)
    assert res.status_code == 400
    assert "exceeds final charge" in res.json()["detail"]


def test_record_subsequent_payment(client, db):

    create_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-01-12",
        "customer_name": "Credit Customer",
        "chargeable_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 0,
    })
    session_id = create_res.json()["id"]


    pay_res = client.post("/api/payments/session", json={
        "session_type": "pool",
        "session_id": session_id,
        "collection_date": "2026-01-13",
        "amount_paise": 30000,
        "payment_method": "cash",
    })
    assert pay_res.status_code == 201

    session = db.query(PoolSession).filter(PoolSession.id == session_id).first()
    assert session.status == SessionStatus.PARTIAL


    pay2_res = client.post("/api/payments/session", json={
        "session_type": "pool",
        "session_id": session_id,
        "collection_date": "2026-01-14",
        "amount_paise": 20000,
        "payment_method": "cash",
    })
    assert pay2_res.status_code == 201

    db.refresh(session)
    assert session.status == SessionStatus.PAID


    pay_excess = client.post("/api/payments/session", json={
        "session_type": "pool",
        "session_id": session_id,
        "collection_date": "2026-01-15",
        "amount_paise": 1000,
        "payment_method": "cash",
    })
    assert pay_excess.status_code == 400


def test_ps4_session_lifecycle(client):

    res = client.post("/api/sessions/ps4", json={
        "session_date": "2026-01-15",
        "player_count": 2,
        "customer_name": "Gamer One",
        "minutes": 120,
        "discount_paise": 0,
        "initial_payment_paise": 100000,
        "initial_payment_method": "bank_transfer",
    })
    assert res.status_code == 201
    data = res.json()
    assert data["standard_charge_paise"] == 100000
    assert data["final_charge_paise"] == 100000
    assert data["paid_amount_paise"] == 100000
    assert data["outstanding_paise"] == 0
    assert data["status"] == "paid"


def test_inventory_and_expense_lifecycle(client):

    prod_res = client.post("/api/inventory/products", json={
        "name": "Coca Cola 300ml",
        "selling_price_paise": 15000,
        "average_cost_paise": 10000,
        "opening_stock": 24,
        "reorder_level": 5,
        "unit": "bottle",
    })
    assert prod_res.status_code == 201
    assert prod_res.json()["current_stock"] == 24


    cats = client.get("/api/expenses/categories").json()
    assert len(cats) >= 10
    elec_cat = next(c for c in cats if c["name"] == "Electricity")


    exp_res = client.post("/api/expenses", json={
        "expense_date": "2026-01-20",
        "category_id": elec_cat["id"],
        "description": "January Electricity Bill",
        "amount_paise": 1250000,
        "payee": "Ceylon Electricity Board",
    })
    assert exp_res.status_code == 201
    exp_data = exp_res.json()
    assert exp_data["amount_paise"] == 1250000
    assert exp_data["status"] == "unpaid"


def test_accounts_and_trial_balance_api(client):
    accounts = client.get("/api/accounts").json()
    assert len(accounts) >= 25

    tb = client.get("/api/accounts/trial-balance").json()
    assert isinstance(tb, list)
    total_debits = sum(r["total_debit_paise"] for r in tb)
    total_credits = sum(r["total_credit_paise"] for r in tb)
    assert total_debits == total_credits
