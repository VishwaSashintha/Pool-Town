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


    __tablename__ = "cash_counts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    count_date: Mapped[date] = mapped_column(Date, nullable=False)
    account_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=False
    )
    counted_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    difference_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    investigated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    investigation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class BankReconciliation(Base, TimestampMixin):


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
