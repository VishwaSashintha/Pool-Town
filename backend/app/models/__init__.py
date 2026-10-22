"""
Models package — import all models so Alembic can discover them.
"""
from app.models.base import Base, TimestampMixin
from app.models.players import Player, PlayerAlias
from app.models.sessions import PoolSession, PS4Session, SessionStatus
from app.models.payments import SessionPayment, ExpensePayment, PaymentMethod, PaymentStatus
from app.models.journal import JournalEntry, JournalLine, JournalEntryStatus, AccountingPeriod
from app.models.accounts import (
    FinancialAccount, AccountType, AccountTransfer, CashCount, BankReconciliation
)
from app.models.inventory import (
    ProductCategory, Supplier, Product, StockPurchase, StockPurchaseItem,
    StockMovement, StockMovementType, PhysicalStockCount, ProductSale
)
from app.models.expenses import ExpenseCategory, Expense, ExpenseStatus
from app.models.owners import (
    Owner, OwnerTransaction, OwnerTransactionType,
    ProfitAllocation, ProfitAllocationLine,
    Loan, LoanTransaction, LoanType, LoanStatus, LoanTransactionType
)
from app.models.audit import AuditLog, AppSetting
from app.models.equipment import (
    EquipmentPurchase, EquipmentCategory, EquipmentPaymentStatus,
    DamageCharge, DamageStatus, DamagePayment,
)

__all__ = [
    "Base",
    "Player", "PlayerAlias",
    "PoolSession", "PS4Session", "SessionStatus",
    "SessionPayment", "ExpensePayment", "PaymentMethod", "PaymentStatus",
    "JournalEntry", "JournalLine", "JournalEntryStatus", "AccountingPeriod",
    "FinancialAccount", "AccountType", "AccountTransfer", "CashCount", "BankReconciliation",
    "ProductCategory", "Supplier", "Product", "StockPurchase", "StockPurchaseItem",
    "StockMovement", "StockMovementType", "PhysicalStockCount", "ProductSale",
    "ExpenseCategory", "Expense", "ExpenseStatus",
    "Owner", "OwnerTransaction", "OwnerTransactionType",
    "ProfitAllocation", "ProfitAllocationLine",
    "Loan", "LoanTransaction", "LoanType", "LoanStatus", "LoanTransactionType",
    "AuditLog", "AppSetting",
    "EquipmentPurchase", "EquipmentCategory", "EquipmentPaymentStatus",
    "DamageCharge", "DamageStatus", "DamagePayment",
]
