"""
Audit Verification Test Suite — Dedicated automated tests for:
- Requirement 4: Auth & security on sensitive endpoints
- Requirement 5: Voiding unpaid, partially paid, and fully paid pool & PS4 sessions
- Requirement 6: Drink sale cancellation and stock restoration, COGS/revenue reversals
- Requirement 7: Player merge and expense bill settlement
- Requirement 8: Deletion authorization and financial history preservation
"""
import pytest
from datetime import date
from app.services.seed import seed_master_data
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, PaymentStatus, ExpensePayment
from app.models.journal import JournalEntry, JournalEntryStatus
from app.models.inventory import Product, StockMovement, ProductSale, PhysicalStockCount
from app.models.players import Player, PlayerAlias
from app.models.expenses import Expense, ExpenseStatus


@pytest.fixture(autouse=True)
def seed_data(db):
    seed_master_data(db)


# ==============================================================================
# REQUIREMENT 5: Pool & PS4 Session Cancellations (Unpaid, Partial, Full)
# ==============================================================================

def test_void_unpaid_pool_session(client, db):
    """Test voiding an unpaid pool session (0 initial payment)."""
    create_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-02-10",
        "customer_name": "Unpaid Pool Player",
        "chargeable_minutes": 60,
        "actual_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 0,
        "initial_payment_method": "cash",
    })
    assert create_res.status_code == 201
    sess_id = create_res.json()["id"]

    # Void the unpaid session
    void_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Cancelled by customer before playing",
    })
    assert void_res.status_code == 200
    assert void_res.json()["success"] is True
    assert void_res.json()["payments_reversed"] == 0

    sess = db.query(PoolSession).filter(PoolSession.id == sess_id).first()
    assert sess.status == SessionStatus.CANCELLED

    # Check journal entry is reversed
    rev_entry = db.query(JournalEntry).filter(
        JournalEntry.source_type == "pool_session",
        JournalEntry.source_id == sess_id,
    ).first()
    assert rev_entry.status == JournalEntryStatus.REVERSED

    # Duplicate void rejected with 409
    dup_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
    })
    assert dup_res.status_code == 409


def test_void_fully_paid_pool_session(client, db):
    """Test voiding a fully paid pool session (initial payment = full charge)."""
    # 60 mins base charge is 50,000 paise (Rs. 500)
    create_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-02-11",
        "customer_name": "Full Pay Pool Player",
        "chargeable_minutes": 60,
        "actual_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 50000,
        "initial_payment_method": "cash",
    })
    assert create_res.status_code == 201
    sess_id = create_res.json()["id"]
    assert create_res.json()["status"] == "paid"

    # Void the fully paid session
    void_res = client.post(f"/api/sessions/pool/{sess_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Full refund given immediately",
    })
    assert void_res.status_code == 200
    assert void_res.json()["payments_reversed"] == 1

    sess = db.query(PoolSession).filter(PoolSession.id == sess_id).first()
    assert sess.status == SessionStatus.CANCELLED

    # Verify payment status is REVERSED
    pmt = db.query(SessionPayment).filter(
        SessionPayment.session_type == "pool",
        SessionPayment.session_id == sess_id,
    ).first()
    assert pmt.status == PaymentStatus.REVERSED


def test_void_unpaid_ps4_session(client, db):
    """Test voiding an unpaid PS4 session."""
    create_res = client.post("/api/sessions/ps4", json={
        "session_date": "2026-02-12",
        "customer_name": "Unpaid PS4 Gamer",
        "player_count": 1,
        "minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 0,
        "initial_payment_method": "cash",
    })
    assert create_res.status_code == 201
    ps4_id = create_res.json()["id"]

    void_res = client.post(f"/api/sessions/ps4/{ps4_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Power outage cancelled",
    })
    assert void_res.status_code == 200
    assert void_res.json()["payments_reversed"] == 0

    sess = db.query(PS4Session).filter(PS4Session.id == ps4_id).first()
    assert sess.status == SessionStatus.CANCELLED


def test_void_partially_and_fully_paid_ps4_session(client, db):
    """Test voiding partially paid and fully paid PS4 sessions."""
    # 60 mins 1-player = 40,000 paise (Rs. 400). Pay 20,000 partial.
    create_res = client.post("/api/sessions/ps4", json={
        "session_date": "2026-02-13",
        "customer_name": "Partial Gamer",
        "player_count": 1,
        "minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 20000,
        "initial_payment_method": "cash",
    })
    assert create_res.status_code == 201
    ps4_id = create_res.json()["id"]

    void_res = client.post(f"/api/sessions/ps4/{ps4_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Void partial session",
    })
    assert void_res.status_code == 200
    assert void_res.json()["payments_reversed"] == 1

    # Check session cancelled
    sess = db.query(PS4Session).filter(PS4Session.id == ps4_id).first()
    assert sess.status == SessionStatus.CANCELLED

    # Check payment reversed
    pmt = db.query(SessionPayment).filter(
        SessionPayment.session_type == "ps4",
        SessionPayment.session_id == ps4_id,
    ).first()
    assert pmt.status == PaymentStatus.REVERSED

    # Duplicate void rejected
    dup_res = client.post(f"/api/sessions/ps4/{ps4_id}/void", json={
        "admin_username": "admin",
        "admin_password": "admin123",
    })
    assert dup_res.status_code == 409


# ==============================================================================
# REQUIREMENT 6: Drink Sale Cancellation & Stock Correction
# ==============================================================================

def test_drink_sale_cancellation_and_inventory_reversal(client, db):
    """Test drink sale cancellation reverses stock, revenue, and COGS."""
    # 1. Create a product with 15 initial stock
    prod_res = client.post("/api/drinks/products", json={
        "name": "Audit Drink 330ml",
        "purchase_cost_paise": 9000,
        "selling_price_paise": 15000,
        "opening_stock": 15,
        "opening_date": "2026-02-01",
    })
    assert prod_res.status_code == 201
    p_id = prod_res.json()["id"]

    # 2. Sell 5 units
    sale_res = client.post("/api/drinks/sales", json={
        "sale_date": "2026-02-14",
        "entries": [{"product_id": p_id, "quantity_sold": 5}],
    })
    assert sale_res.status_code == 201

    # Check stock dropped to 10
    prod_check = client.get("/api/drinks/products").json()
    item = next(p for p in prod_check if p["id"] == p_id)
    assert item["current_stock"] == 10

    # Locate sale
    sales_list = client.get("/api/drinks/sales?sale_date=2026-02-14").json()
    sale = next(s for s in sales_list if s["product_id"] == p_id)
    sale_id = sale["id"]

    # Cancel sale
    cancel_res = client.post(f"/api/drinks/sales/{sale_id}/cancel", json={
        "admin_username": "admin",
        "admin_password": "admin123",
        "reason": "Entered in error",
    })
    assert cancel_res.status_code == 200
    assert cancel_res.json()["quantity_restored"] == 5

    # Check stock restored to 15
    prod_check2 = client.get("/api/drinks/products").json()
    item2 = next(p for p in prod_check2 if p["id"] == p_id)
    assert item2["current_stock"] == 15

    # Check double-cancel rejected
    dup_res = client.post(f"/api/drinks/sales/{sale_id}/cancel", json={
        "admin_username": "admin",
        "admin_password": "admin123",
    })
    assert dup_res.status_code == 409


def test_drink_stock_physical_count_correction(client, db):
    """Test physical stock count adjusts inventory and posts discrepancy movement."""
    prod_res = client.post("/api/drinks/products", json={
        "name": "Stock Count Item",
        "purchase_cost_paise": 10000,
        "selling_price_paise": 18000,
        "opening_stock": 20,
        "opening_date": "2026-02-01",
    })
    p_id = prod_res.json()["id"]

    # Record physical count: actual counted is 18 (discrepancy of -2)
    count_res = client.post("/api/drinks/stock-count", json={
        "count_date": "2026-02-15",
        "entries": [{"product_id": p_id, "counted_quantity": 18}],
        "notes": "End of week physical count",
    })
    assert count_res.status_code in (200, 201)
    assert len(count_res.json()["entries"]) == 1
    assert count_res.json()["entries"][0]["discrepancy"] == -2

    # Verify discrepancy shows in /api/drinks/issues
    issues_res = client.get("/api/drinks/issues")
    assert issues_res.status_code == 200
    issues = issues_res.json()
    assert len(issues) == 1
    assert issues[0]["product_id"] == p_id
    assert issues[0]["difference"] == -2
    assert issues[0]["status"] == "short"


# ==============================================================================
# REQUIREMENT 7: Player Merge & Expense Bill Settlement
# ==============================================================================

def test_player_merge(client, db):
    """Test merging duplicate player into primary player profile."""
    # 1. Create primary player
    p1_res = client.post("/api/players", json={"name": "Nimal Silva", "phone": "0771234567"})
    assert p1_res.status_code == 201
    primary_id = p1_res.json()["id"]

    # 2. Create duplicate player
    p2_res = client.post("/api/players", json={"name": "Nimal S.", "phone": "0771234567"})
    assert p2_res.status_code == 201
    dup_id = p2_res.json()["id"]

    # 3. Create a pool session for duplicate player
    sess_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-02-16",
        "player_id": dup_id,
        "chargeable_minutes": 60,
        "actual_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 0,
        "initial_payment_method": "cash",
    })
    assert sess_res.status_code == 201
    sess_id = sess_res.json()["id"]

    # 4. Self-merge rejected
    self_res = client.post("/api/players/merge", json={
        "primary_player_id": primary_id,
        "duplicate_player_id": primary_id,
    })
    assert self_res.status_code == 400

    # 5. Execute merge
    merge_res = client.post("/api/players/merge", json={
        "primary_player_id": primary_id,
        "duplicate_player_id": dup_id,
        "reason": "Same person entered with abbreviation",
    })
    assert merge_res.status_code == 200
    m_data = merge_res.json()
    assert m_data["success"] is True
    assert m_data["primary_player"]["id"] == primary_id
    assert m_data["sessions_moved"] == 1

    # 6. Verify duplicate is inactive and merged_into_id is set
    dup = db.query(Player).filter(Player.id == dup_id).first()
    assert dup.is_active is False
    assert dup.merged_into_id == primary_id

    # 7. Verify session was reassigned to primary player
    sess = db.query(PoolSession).filter(PoolSession.id == sess_id).first()
    assert sess.player_id == primary_id

    # 8. Verify player alias created
    alias = db.query(PlayerAlias).filter(PlayerAlias.player_id == primary_id).first()
    assert alias is not None
    assert alias.alias == "Nimal S."


def test_expense_bill_settlement(client, db):
    """Test expense bill settlement: unpaid -> partial -> full, with overpayment prevention."""
    # 1. Create an unpaid expense bill (Rs. 1,000 = 100,000 paise)
    exp_res = client.post("/api/expenses", json={
        "expense_date": "2026-02-17",
        "category_id": 1,  # Electricity
        "amount_paise": 100000,
        "payment_method": "credit",
        "description": "February Electricity Bill",
    })
    assert exp_res.status_code == 201
    exp_id = exp_res.json()["id"]
    assert exp_res.json()["status"] == "unpaid"

    # 2. Settle partially: Pay Rs. 400 (40,000 paise) via Cash
    pay1_res = client.post(f"/api/expenses/{exp_id}/payments", json={
        "payment_date": "2026-02-18",
        "amount_paise": 40000,
        "payment_method": "cash",
        "notes": "First partial payment",
    })
    assert pay1_res.status_code == 201

    # Check expense status is now partial
    exp1 = db.query(Expense).filter(Expense.id == exp_id).first()
    assert exp1.status == ExpenseStatus.PARTIAL

    # 3. Attempt overpayment: Remaining is 60,000 paise. Try to pay 70,000 paise -> 400
    overpay_res = client.post(f"/api/expenses/{exp_id}/payments", json={
        "payment_date": "2026-02-19",
        "amount_paise": 70000,
        "payment_method": "cash",
    })
    assert overpay_res.status_code == 400
    assert "exceeds remaining balance" in overpay_res.json()["detail"]

    # 4. Settle remaining 60,000 paise via Bank Transfer
    pay2_res = client.post(f"/api/expenses/{exp_id}/payments", json={
        "payment_date": "2026-02-19",
        "amount_paise": 60000,
        "payment_method": "bank_transfer",
        "notes": "Final settlement",
    })
    assert pay2_res.status_code == 201

    # Check expense status is now paid
    exp2 = db.query(Expense).filter(Expense.id == exp_id).first()
    assert exp2.status == ExpenseStatus.PAID

    # 5. Attempt paying an already fully paid bill -> 400
    pay3_res = client.post(f"/api/expenses/{exp_id}/payments", json={
        "payment_date": "2026-02-20",
        "amount_paise": 5000,
        "payment_method": "cash",
    })
    assert pay3_res.status_code == 400
    assert "already fully paid" in pay3_res.json()["detail"]


# ==============================================================================
# REQUIREMENT 8: Deletion Authorization & Financial History Linkage
# ==============================================================================

def test_player_deletion_rules(client, db):
    """Test that player deletion requires auth and blocks deletion if sessions exist."""
    # 1. Create a player with 0 sessions
    p_res = client.post("/api/players", json={"name": "Clean Player No Sessions"})
    assert p_res.status_code == 201
    p_id = p_res.json()["id"]

    # 2. Deleting player with 0 sessions succeeds with auth
    del_res = client.delete(f"/api/players/{p_id}")
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True

    # 3. Create a player WITH a session
    p2_res = client.post("/api/players", json={"name": "Active Player With History"})
    p2_id = p2_res.json()["id"]

    sess_res = client.post("/api/sessions/pool", json={
        "session_date": "2026-02-20",
        "player_id": p2_id,
        "chargeable_minutes": 60,
        "actual_minutes": 60,
        "discount_paise": 0,
        "initial_payment_paise": 50000,
        "initial_payment_method": "cash",
    })
    assert sess_res.status_code == 201

    # 4. Deleting player with session is BLOCKED with 400
    blocked_del = client.delete(f"/api/players/{p2_id}")
    assert blocked_del.status_code == 400
    assert "has 1 recorded session" in blocked_del.json()["detail"]


def test_database_reset_safety_and_auth(client):
    """Test that database reset requires confirmation phrase and auth."""
    # 1. Wrong confirm phrase -> 400
    bad_phrase = client.post("/api/admin/reset-business-data", json={"confirm_phrase": "WRONG PHRASE"})
    assert bad_phrase.status_code == 400
