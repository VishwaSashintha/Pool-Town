"""
Financial account models — Cash, Bank, Savings, etc.
Account balances are NEVER stored; they are always calculated from transactions.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Date, Text, Boolean, ForeignKey,
    CheckConstraint, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AccountType(str, enum.Enum):
    CASH = "cash"
    BANK = "bank"
    SAVINGS = "savings"
    OTHER = "other"


class FinancialAccount(Base, TimestampMixin):
    """
    A logical financial account (Cash in Hand, Main Bank, Savings, etc.).
    Balance = opening_balance + sum of all credit journal lines - sum of all debit journal lines
    (for liability/equity accounts) or the reverse for asset accounts.
    
    IMPORTANT: Never store a current_balance field here. Always calculate from journal entries.
    """
    __tablename__ = "financial_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    account_type: Mapped[AccountType] = mapped_column(SAEnum(AccountType), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    def __repr__(self) -> str:
        return f"<FinancialAccount code={self.code} name={self.name!r}>"


class AccountTransfer(Base, TimestampMixin):
    """
    A transfer between two financial accounts.
    Creates two balanced journal entries (DR destination, CR source).
    This is NOT new income or a new expense.
    """
    __tablename__ = "account_transfers"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_transfer_amount_positive"),
        CheckConstraint("from_account_id != to_account_id", name="ck_transfer_different_accounts"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    transfer_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    from_account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=False
    )
    to_account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=False
    )

    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    from_account: Mapped["FinancialAccount"] = relationship(
        "FinancialAccount", foreign_keys=[from_account_id]
    )
    to_account: Mapped["FinancialAccount"] = relationship(
        "FinancialAccount", foreign_keys=[to_account_id]
    )


class CashCount(Base, TimestampMixin):
    """
    A physical cash count recorded by the user.
    Difference = counted_paise - expected_paise (calculated at time of count).
    Never auto-adjusted.
    """
    __tablename__ = "cash_counts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=False
    )
    counted_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    difference_paise: Mapped[int] = mapped_column(Integer, nullable=False)  # counted - expected
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    investigated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    investigation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class BankReconciliation(Base, TimestampMixin):
    """
    A bank statement reconciliation.
    statement_balance_paise: amount shown on the bank statement.
    book_balance_paise: our calculated balance from journal entries.
    """
    __tablename__ = "bank_reconciliations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reconciliation_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=False
    )
    statement_balance_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    book_balance_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    difference_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
