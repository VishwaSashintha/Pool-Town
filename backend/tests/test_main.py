"""
Tests for main API endpoints (health check, system info) and database seeding.
"""
import pytest
from app.services.seed import seed_master_data
from app.models.accounts import FinancialAccount
from app.models.owners import Owner
from app.models.expenses import ExpenseCategory


def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "server_time" in data


def test_seed_master_data(db):
    counts = seed_master_data(db)
    assert counts["accounts"] >= 25
    assert counts["categories"] >= 10
    assert counts["owners"] == 3
    assert counts["settings"] >= 8

    # Verify idempotency — running it again should insert 0 new records
    second_counts = seed_master_data(db)
    assert second_counts["accounts"] == 0
    assert second_counts["categories"] == 0
    assert second_counts["owners"] == 0
    assert second_counts["settings"] == 0

    # Verify owners
    owners = db.query(Owner).all()
    owner_names = {o.name: o.profit_share_bps for o in owners}
    assert "Akash" in owner_names
    assert "Pasan" in owner_names
    assert "Vishwa" in owner_names
    assert owner_names["Akash"] == 2000
    assert owner_names["Pasan"] == 2000
    assert owner_names["Vishwa"] == 2000

    # Verify Chart of Accounts presence
    cash = db.query(FinancialAccount).filter(FinancialAccount.code == "1001").first()
    assert cash is not None
    assert cash.name == "Cash in Hand"

    savings = db.query(FinancialAccount).filter(FinancialAccount.code == "1003").first()
    assert savings is not None
    assert savings.name == "Savings Account"


def test_system_info(client, db):
    seed_master_data(db)
    response = client.get("/api/info")
    assert response.status_code == 200
    data = response.json()
    assert data["currency"] == "LKR"
    assert len(data["owners"]) == 3
    assert data["accounts_configured"] >= 25
