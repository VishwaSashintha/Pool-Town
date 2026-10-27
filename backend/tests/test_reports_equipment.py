"""
Unit and integration tests for reports, equipment purchases, damage charges,
transaction history, and backup downloads.
"""
from datetime import date
from fastapi.testclient import TestClient

from app.models.equipment import EquipmentCategory, EquipmentPaymentStatus


def test_equipment_purchases_crud(client: TestClient):
    # 1. Create equipment purchase
    res = client.post(
        "/api/equipment/purchases",
        json={
            "purchase_date": date.today().isoformat(),
            "category": EquipmentCategory.CUE_STICK.value,
            "item_name": "Pro Maple Cue Stick 58 inch",
            "description": "2x Maple cue sticks for table 1",
            "quantity": 2,
            "amount_paise": 1500000,  # Rs. 15,000
            "supplier": "Billiards Lanka",
            "payment_status": EquipmentPaymentStatus.PAID.value,
            "notes": "Good quality sticks",
        },
    )
    assert res.status_code == 201, res.text
    data = res.json()
    assert "EQP-" in data["reference"]
    purchase_id = data["id"]

    # 2. List purchases
    list_res = client.get("/api/equipment/purchases")
    assert list_res.status_code == 200
    items = list_res.json()
    assert any(p["id"] == purchase_id for p in items)


def test_damage_charges_flow(client: TestClient):
    # Setup player via API
    p_res = client.post(
        "/api/players",
        json={"name": "Kasun Perera Damage", "phone": "0771234567"},
    )
    assert p_res.status_code == 201
    player = p_res.json()

    # 1. Create damage charge
    res = client.post(
        "/api/equipment/damage-charges",
        json={
            "damage_date": date.today().isoformat(),
            "player_id": player["id"],
            "damaged_item": "Cue Stick Tip Broken",
            "description": "Broke tip during break shot",
            "charge_amount_paise": 250000,  # Rs. 2,500
            "notes": "Agreed to pay next week",
        },
    )
    assert res.status_code == 201, res.text
    dmg = res.json()
    assert "DMG-" in dmg["reference"]
    dmg_id = dmg["id"]

    # 2. Record partial payment
    pay_res = client.post(
        f"/api/equipment/damage-charges/{dmg_id}/payments",
        json={
            "payment_date": date.today().isoformat(),
            "amount_paise": 100000,  # Rs. 1,000 paid
            "payment_method": "cash",
            "notes": "Paid cash Rs. 1000",
        },
    )
    assert pay_res.status_code == 201, pay_res.text
    pay_data = pay_res.json()
    assert "reference" in pay_data

    # 3. List damage charges
    list_res = client.get("/api/equipment/damage-charges")
    assert list_res.status_code == 200
    all_dmg = list_res.json()
    matched = next((d for d in all_dmg if d["id"] == dmg_id), None)
    assert matched is not None
    assert matched["collected_paise"] == 100000
    assert matched["outstanding_paise"] == 150000


def test_reports_endpoints(client: TestClient):
    today_iso = date.today().isoformat()
    s_res = client.post(
        "/api/sessions/pool",
        json={
            "session_date": today_iso,
            "customer_name": "Nimal Silva Reports",
            "chargeable_minutes": 60,
            "actual_minutes": 60,
            "discount_paise": 0,
            "initial_payment_paise": 50000,
            "initial_payment_method": "cash",
            "notes": "Report test session",
        },
    )
    assert s_res.status_code == 201, s_res.text

    # 1. Daily Report
    d_res = client.get(f"/api/reports/daily?report_date={today_iso}")
    assert d_res.status_code == 200, d_res.text
    daily = d_res.json()
    assert daily["pool_sessions"] >= 1
    assert daily["pool_revenue_paise"] >= 50000

    # 2. Weekly Report
    w_res = client.get(f"/api/reports/weekly?ref_date={today_iso}")
    assert w_res.status_code == 200, w_res.text
    weekly = w_res.json()
    assert weekly["period"] == "weekly"

    # 3. Monthly Report
    today = date.today()
    m_res = client.get(f"/api/reports/monthly?year={today.year}&month={today.month}")
    assert m_res.status_code == 200, m_res.text
    monthly = m_res.json()
    assert monthly["period"] == "monthly"
    assert "profit_allocation" in monthly

    # 4. Summary Report
    s_res = client.get(f"/api/reports/summary?report_date={today_iso}")
    assert s_res.status_code == 200, s_res.text
    summary = s_res.json()
    assert "total_revenue_paise" in summary


def test_transactions_history_api(client: TestClient):
    res = client.get("/api/accounts/transactions")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "total" in data
    assert "items" in data
    assert isinstance(data["items"], list)


def test_dashboard_analytics_endpoint(client: TestClient):
    today_iso = date.today().isoformat()
    res = client.get(f"/api/reports/analytics?start_date={today_iso}&end_date={today_iso}")
    assert res.status_code == 200, res.text
    data = res.json()
    assert "kpis" in data
    assert "total_revenue_paise" in data["kpis"]
    assert "total_collected_paise" in data["kpis"]
    assert "total_outstanding_paise" in data["kpis"]
    assert "net_profit_paise" in data["kpis"]
    assert "revenue_trend" in data
    assert isinstance(data["revenue_trend"], list)
    assert "revenue_distribution" in data
    assert len(data["revenue_distribution"]) == 3
    assert "service_comparison" in data
    assert "activity_summary" in data
    assert "payment_status" in data
    assert "collections_by_method" in data
    assert "expenses_by_category" in data
    assert "inventory_overview" in data
    assert "account_balances" in data
    assert "recent_sessions" in data
