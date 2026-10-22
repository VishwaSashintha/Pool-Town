"""
Pydantic schemas for financial and operational reports.
All monetary amounts are in integer paise (1 LKR = 100 paise).
"""
from __future__ import annotations

from datetime import date
from typing import List, Optional
from pydantic import BaseModel, Field


class DailySessionSummary(BaseModel):
    service: str  # "Pool Table" or "PS4 Gaming"
    total_sessions: int
    chargeable_minutes: int
    total_charge_paise: int
    total_discount_paise: int
    net_charge_paise: int
    initial_cash_collected_paise: int
    initial_bank_collected_paise: int
    unpaid_paise: int


class DailyDrinksSummary(BaseModel):
    total_units_sold: int
    total_sales_revenue_paise: int
    total_cogs_paise: int
    gross_margin_paise: int
    cash_collected_paise: int
    bank_collected_paise: int


class DailyCollectionsSummary(BaseModel):
    cash_session_collections_paise: int
    bank_session_collections_paise: int
    past_session_collections_paise: int
    total_cash_inflow_paise: int
    total_bank_inflow_paise: int


class DailyExpenseItem(BaseModel):
    category_name: str
    description: str
    amount_paise: int
    payment_method: str  # "cash" or "bank"


class DailyClosingReport(BaseModel):
    report_date: date
    sessions: List[DailySessionSummary]
    drinks: DailyDrinksSummary
    collections: DailyCollectionsSummary
    expenses: List[DailyExpenseItem]
    total_revenue_paise: int
    total_cogs_paise: int
    gross_profit_paise: int
    total_expenses_paise: int
    net_operating_profit_paise: int
    # Cash reconciliation for the day
    opening_cash_paise: int
    cash_inflows_paise: int
    cash_outflows_paise: int
    expected_closing_cash_paise: int
    actual_counted_cash_paise: Optional[int] = None
    cash_discrepancy_paise: Optional[int] = None


class WeeklyDaySummary(BaseModel):
    date: date
    day_name: str
    pool_revenue_paise: int
    ps4_revenue_paise: int
    drinks_revenue_paise: int
    total_revenue_paise: int
    expenses_paise: int
    net_paise: int
    pool_sessions_count: int
    ps4_sessions_count: int


class WeeklyReport(BaseModel):
    start_date: date
    end_date: date
    days: List[WeeklyDaySummary]
    total_pool_revenue_paise: int
    total_ps4_revenue_paise: int
    total_drinks_revenue_paise: int
    total_revenue_paise: int
    total_cogs_paise: int
    gross_profit_paise: int
    total_expenses_paise: int
    net_profit_paise: int
    expenses_by_category: List[dict]


class MonthlyPnLItem(BaseModel):
    account_code: str
    name: str
    current_month_paise: int
    previous_month_paise: int
    change_paise: int


class MonthlyComparativePnL(BaseModel):
    year: int
    month: int
    period_label: str
    previous_period_label: str
    revenue_items: List[MonthlyPnLItem]
    total_revenue_paise: int
    prev_total_revenue_paise: int
    cogs_items: List[MonthlyPnLItem]
    total_cogs_paise: int
    prev_total_cogs_paise: int
    gross_profit_paise: int
    prev_gross_profit_paise: int
    operating_expense_items: List[MonthlyPnLItem]
    total_operating_expenses_paise: int
    prev_total_operating_expenses_paise: int
    net_profit_paise: int
    prev_net_profit_paise: int
    # Profit allocations (Decision D-009)
    savings_allocation_paise: int
    akash_allocation_paise: int
    pasan_allocation_paise: int
    vishwa_allocation_paise: int


class PlayerDebtItem(BaseModel):
    player_id: Optional[int]
    player_name: str
    phone: Optional[str]
    total_sessions: int
    total_charged_paise: int
    total_paid_paise: int
    total_outstanding_paise: int
    current_bucket_paise: int   # 0-30 days
    bucket_31_60_paise: int     # 31-60 days
    bucket_61_90_paise: int     # 61-90 days
    bucket_90_plus_paise: int   # 90+ days
    last_session_date: Optional[date]
    last_payment_date: Optional[date]


class DebtAgingReport(BaseModel):
    as_of_date: date
    total_outstanding_paise: int
    total_current_paise: int
    total_31_60_paise: int
    total_61_90_paise: int
    total_90_plus_paise: int
    players: List[PlayerDebtItem]


class InventoryValuationItem(BaseModel):
    product_id: int
    product_name: str
    category_name: str
    current_stock: int
    reorder_level: int
    average_cost_paise: int
    selling_price_paise: int
    total_cost_value_paise: int
    total_retail_value_paise: int
    potential_margin_paise: int
    is_low_stock: bool


class InventoryValuationReport(BaseModel):
    as_of_date: date
    total_products_count: int
    total_units_in_stock: int
    total_cost_value_paise: int
    total_retail_value_paise: int
    potential_gross_margin_paise: int
    low_stock_count: int
    items: List[InventoryValuationItem]
