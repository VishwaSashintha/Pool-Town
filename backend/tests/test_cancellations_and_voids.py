import pytest
from app.services.seed import seed_master_data
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentStatus
from app.models.journal import JournalEntry, JournalEntryStatus
from app.models.inventory import Product, StockMovement, ProductSale


@pytest.fixture(autouse=True)
def seed_data(db):
    seed_master_data(db)


def test_void_pool_session_with_reversals(client, db):

    create_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-02-01",
        "customer_name": "Test Void Player",
        "chargeable_minutes": 60,
        "actual_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 40000,
        "initial_payment_method": "cash",
        "notes": "Accidental duplicate entry",
    })
    assert create_res.status_code == 201
    sess_id = create_res.json()["id"]


    bad_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "wrongpassword",
        "reason": "Test fail",
    })
    assert bad_res.status_code == 403


    void_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Customer cancelled table",
    })
    assert void_res.status_code == 200
    void_data = void_res.json()
    assert void_data["success"] is True
    assert void_data["status"] == "cancelled"
    assert void_data["payments_reversed"] == 1


    session = db.query(PoolSession).filter(PoolSession.id == sess_id).first()
    assert session.status == SessionStatus.CANCELLED
    assert "[VOIDED" in session.notes


    payment = db.query(SessionPayment).filter(
        SessionPayment.session_type == "pool",
        SessionPayment.session_id == sess_id,
    ).first()
    assert payment.status == PaymentStatus.REVERSED


    rev_entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "pool_session",
        JournalEntry.source_id == sess_id,
    ).first()
    assert rev_entry.status == JournalEntryStatus.REVERSED


    pmt_entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "session_payment",
        JournalEntry.source_id == payment.id,
    ).first()
    assert pmt_entry.status == JournalEntryStatus.REVERSED


    dup_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
    })
    assert dup_res.status_code == 409


    pmt_attempt = client.post("/api/payments/session", json={
        "session_type": "pool",
        "session_id": sess_id,
        "collection_date": "2026-02-01",
        "amount_paise": 10000,
        "payment_method": "cash",
    })
    assert pmt_attempt.status_code == 400


    out_res = client.get("/api/payments/outstanding")
    assert out_res.status_code == 200
    out_ids = [item["id"] for item in out_res.json() if item["session_type"] == "pool"]
    assert sess_id not in out_ids


def test_void_ps4_session(client, db):

    create_res = client.post("/api/sessions/ps4", json={
        "session_date": "2026-02-02",
        "customer_name": "Gamer Void",
        "player_count": 1,
        "minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 40000,
        "initial_payment_method": "cash",
    })
    assert create_res.status_code == 201
    ps4_id = create_res.json()["id"]


    void_res = client.post(f"/api/sessions/ps4/{ps4_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Wrong console assigned",
    })
    assert void_res.status_code == 200


    ps4_sess = db.query(PS4Session).filter(PS4Session.id == ps4_id).first()
    assert ps4_sess.status == SessionStatus.CANCELLED


def test_cancel_drink_sale_and_restore_stock(client, db):

    prod_res = client.post("/api/drinks/products", json={
        "name": "Ginger Beer 300ml",
        "purchase_cost_paise": 12000,
        "selling_price_paise": 20000,
        "opening_stock": 10,
        "opening_date": "2026-02-01",
    })
    assert prod_res.status_code == 201
    product_id = prod_res.json()["id"]


    sale_res = client.post("/api/drinks/sales", json={
        "sale_date": "2026-02-03",
        "entries": [{"product_id": product_id, "quantity_sold": 3}],
    })
    assert sale_res.status_code == 201


    prod_check = client.get("/api/drinks/products")
    p_data = next(p for p in prod_check.json() if p["id"] == product_id)
    assert p_data["current_stock"] == 7


    sales_list = client.get("/api/drinks/sales?sale_date=2026-02-03").json()
    sale_item = next(s for s in sales_list if s["product_id"] == product_id)
    sale_id = sale_item["id"]
    assert sale_item["is_cancelled"] is False


    bad_res = client.post(f"/api/drinks/sales/{sale_id}/cancel", json={
        "admin_username": "admin",
        "admin_password": "bad",
    })
    assert bad_res.status_code == 403


    cancel_res = client.post(f"/api/drinks/sales/{sale_id}/cancel", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Customer changed mind before opening bottles",
    })
    assert cancel_res.status_code == 200
    cdata = cancel_res.json()
    assert cdata["success"] is True
    assert cdata["quantity_restored"] == 3


    prod_check2 = client.get("/api/drinks/products")
    p_data2 = next(p for p in prod_check2.json() if p["id"] == product_id)
    assert p_data2["current_stock"] == 10


    sales_list2 = client.get("/api/drinks/sales?sale_date=2026-02-03").json()
    sale_item2 = next(s for s in sales_list2 if s["id"] == sale_id)
    assert sale_item2["is_cancelled"] is True


    sale_obj = db.query(ProductSale).filter(ProductSale.id == sale_id).first()
    rev_entry = db.query(JournalEntry).filter(JournalEntry.id == sale_obj.journal_entry_id).first()
    assert rev_entry.status == JournalEntryStatus.REVERSED


    dup_res = client.post(f"/api/drinks/sales/{sale_id}/cancel", json={
        "admin_username": "admin",
        "admin_password": "admin123",
    })
    assert dup_res.status_code == 409
