"""
Initial seed data for Chart of Accounts, Expense Categories, Owners, and App Settings.
IMPORTANT: Never seeds fabricated financial transactions or fake business operations.
Only seeds structural metadata needed for day 1 operation.
"""
from __future__ import annotations

import json
from sqlalchemy.orm import Session
from app.models.accounts import FinancialAccount, AccountType
from app.models.expenses import ExpenseCategory
from app.models.owners import Owner
from app.models.audit import AppSetting


CHART_OF_ACCOUNTS = [
    # Assets (1xxx)
    ("1001", "Cash in Hand", AccountType.CASH, "Physical cash on premises", 1),
    ("1002", "Main Bank Account", AccountType.BANK, "Primary operational checking/current account", 2),
    ("1003", "Savings Account", AccountType.SAVINGS, "Business savings reserve account held in bank", 3),
    ("1004", "Savings Cash", AccountType.SAVINGS, "Business savings reserve held in physical cash", 4),
    ("1010", "Accounts Receivable — Pool", AccountType.OTHER, "Unpaid balances for Pool sessions", 5),
    ("1011", "Accounts Receivable — PS4", AccountType.OTHER, "Unpaid balances for PS4 sessions", 6),
    ("1020", "Inventory — Drinks", AccountType.OTHER, "Drinks and inventory stock asset value", 7),
    ("1030", "Fixed Assets", AccountType.OTHER, "Pool tables, PS4 consoles, furniture, AC, etc.", 8),
    ("1031", "Accumulated Depreciation", AccountType.OTHER, "Contra asset for accumulated depreciation", 9),

    # Liabilities (2xxx)
    ("2001", "Accounts Payable — Suppliers", AccountType.OTHER, "Unpaid supplier bills for inventory", 10),
    ("2010", "Loan Payable", AccountType.OTHER, "External commercial or private business loans", 11),
    ("2020", "Customer Advances", AccountType.OTHER, "Customer deposits / prepaid balances", 12),
    ("2030", "Owner Loans Payable", AccountType.OTHER, "Funds loaned by owners to the business", 13),

    # Equity (3xxx)
    ("3001", "Owner Capital — Akash", AccountType.OTHER, "Akash's contributed capital balance", 20),
    ("3002", "Owner Capital — Pasan", AccountType.OTHER, "Pasan's contributed capital balance", 21),
    ("3003", "Owner Capital — Vishwa", AccountType.OTHER, "Vishwa's contributed capital balance", 22),
    ("3010", "Retained Earnings", AccountType.OTHER, "Accumulated unallocated net profit/loss", 23),
    ("3011", "Profit Allocation — Savings", AccountType.OTHER, "40% retained business savings allocation", 24),
    ("3012", "Profit Allocation — Akash", AccountType.OTHER, "20% profit allocated to Akash", 25),
    ("3013", "Profit Allocation — Pasan", AccountType.OTHER, "20% profit allocated to Pasan", 26),
    ("3014", "Profit Allocation — Vishwa", AccountType.OTHER, "20% profit allocated to Vishwa", 27),

    # Revenue (4xxx)
    ("4001", "Pool Table Revenue", AccountType.OTHER, "Table rental income from pool sessions", 30),
    ("4002", "PS4 Revenue", AccountType.OTHER, "Gaming station rental income from PS4 sessions", 31),
    ("4003", "Product Sales Revenue", AccountType.OTHER, "Drinks and snack sales income", 32),
    ("4004", "Other Income", AccountType.OTHER, "Miscellaneous operating income", 33),

    # Cost of Sales (5xxx)
    ("5001", "Cost of Goods Sold — Drinks", AccountType.OTHER, "Weighted-average cost of sold inventory", 40),

    # Expenses (6xxx)
    ("6001", "Electricity", AccountType.OTHER, "CEB electricity bill payments", 50),
    ("6002", "Water", AccountType.OTHER, "Water utility payments", 51),
    ("6003", "Rent", AccountType.OTHER, "Premises lease/rental payments", 52),
    ("6004", "Pool Equipment & Maintenance", AccountType.OTHER, "Cue repairs, chalk, table felt, balls", 53),
    ("6005", "Building Maintenance & Repairs", AccountType.OTHER, "General building repairs and fittings", 54),
    ("6006", "PS4 Games & Equipment", AccountType.OTHER, "Controllers, game purchases, subscriptions", 55),
    ("6007", "Salaries", AccountType.OTHER, "Staff wages and compensation", 56),
    ("6008", "Fuel & Travelling", AccountType.OTHER, "Transport, fuel, delivery expenses", 57),
    ("6009", "Bank Charges", AccountType.OTHER, "Account maintenance fees, transfer charges", 58),
    ("6010", "Events & Openings", AccountType.OTHER, "Tournaments, promotions, opening costs", 59),
    ("6011", "Other Expenses", AccountType.OTHER, "Sundry operational expenses", 60),
    ("6012", "Wi-Fi & Internet", AccountType.OTHER, "Monthly Wi-Fi and internet connection charges", 61),
    ("6020", "Interest Expense", AccountType.OTHER, "Interest paid on business or external loans", 62),

    # Distributions (7xxx)
    ("7001", "Owner Distribution — Akash", AccountType.OTHER, "Profit drawings/distributions to Akash", 70),
    ("7002", "Owner Distribution — Pasan", AccountType.OTHER, "Profit drawings/distributions to Pasan", 71),
    ("7003", "Owner Distribution — Vishwa", AccountType.OTHER, "Profit drawings/distributions to Vishwa", 72),
]

EXPENSE_CATEGORIES = [
    ("Electricity", "6001", "Monthly electricity utility charges"),
    ("Water", "6002", "Monthly water utility charges"),
    ("Rent", "6003", "Commercial hall monthly rent"),
    ("Pool Equipment & Maintenance", "6004", "Cue repairs, chalk, table felt, balls"),
    ("Building Maintenance & Repairs", "6005", "Hall lighting, AC repairs, plumbing"),
    ("PS4 Games & Equipment", "6006", "Controllers, disc purchases, subscriptions"),
    ("Salaries", "6007", "Employee and assistant salaries"),
    ("Fuel & Travelling", "6008", "Travel and transport expenses"),
    ("Bank Charges", "6009", "Bank fees and transaction charges"),
    ("Events & Openings", "6010", "Tournaments and promotional events"),
    ("Wi-Fi Bill", "6012", "Monthly Wi-Fi and internet connection charges"),
    ("Other Expenses", "6011", "General unclassified operational expenses"),
    ("Interest Expense", "6020", "Financing and loan interest charges"),
]

OWNERS = [
    ("Akash", 2000),   # 20.00%
    ("Pasan", 2000),   # 20.00%
    ("Vishwa", 2000),  # 20.00%
]

DEFAULT_SETTINGS = [
    ("business_name", json.dumps("Pool Town"), "Official Business Name"),
    ("historical_start_date", json.dumps("2026-01-01"), "Earliest allowed operating transaction date"),
    ("currency_code", json.dumps("LKR"), "Standard currency code"),
    ("currency_symbol", json.dumps("Rs."), "Currency display symbol"),
    ("pool_base_charge_paise", json.dumps(50000), "Pool table base charge up to 60 mins (paise)"),
    ("pool_block_charge_paise", json.dumps(30000), "Pool table charge per 30 mins after 60 mins (paise)"),
    ("ps4_1player_rate_paise", json.dumps(40000), "PS4 1-player hourly rate (paise)"),
    ("ps4_2players_rate_paise", json.dumps(50000), "PS4 2-player hourly rate (paise)"),
    ("savings_allocation_bps", json.dumps(4000), "Savings allocation from net profit in basis points (40%)"),
]


def seed_master_data(db: Session) -> dict[str, int]:
    """
    Idempotent seed function. Inserts missing master data without touching existing records.
    Returns counts of newly created items.
    """
    counts = {"accounts": 0, "categories": 0, "owners": 0, "settings": 0}

    # 1. Accounts
    for code, name, acct_type, desc, order in CHART_OF_ACCOUNTS:
        existing = db.query(FinancialAccount).filter(FinancialAccount.code == code).first()
        if not existing:
            account = FinancialAccount(
                code=code,
                name=name,
                account_type=acct_type,
                description=desc,
                display_order=order,
                is_active=True,
            )
            db.add(account)
            counts["accounts"] += 1

    # 2. Expense Categories
    for name, acct_code, desc in EXPENSE_CATEGORIES:
        existing = db.query(ExpenseCategory).filter(ExpenseCategory.name == name).first()
        if not existing:
            category = ExpenseCategory(
                name=name,
                account_code=acct_code,
                description=desc,
                is_active=True,
            )
            db.add(category)
            counts["categories"] += 1

    # 3. Owners
    for name, share_bps in OWNERS:
        existing = db.query(Owner).filter(Owner.name == name).first()
        if not existing:
            owner = Owner(
                name=name,
                profit_share_bps=share_bps,
                is_active=True,
            )
            db.add(owner)
            counts["owners"] += 1

    # 4. Settings
    for key, value, desc in DEFAULT_SETTINGS:
        existing = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not existing:
            setting = AppSetting(
                key=key,
                value=value,
                description=desc,
                updated_by="system",
            )
            db.add(setting)
            counts["settings"] += 1

    db.commit()
    return counts
