"""
Expense models — expense categories, expenses, and payments.
"""
from __future__ import annotations

import enum
from datetime import date
from typing import Optional
from sqlalchemy import (
    String, Integer, Date, Text, Boolean, ForeignKey,
    CheckConstraint, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ExpenseStatus(str, enum.Enum):
    UNPAID = "unpaid"
    PARTIAL = "partial"
    PAID = "paid"
    CANCELLED = "cancelled"


class ExpenseCategory(Base, TimestampMixin):
    __tablename__ = "expense_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    account_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="category")


class Expense(Base, TimestampMixin):
    """
    An expense bill/event.
    Payment is tracked separately via ExpensePayment records.
    Recording a payment does NOT create a new Expense.
    """
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_expense_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    expense_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("expense_categories.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    payee: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    status: Mapped[ExpenseStatus] = mapped_column(
        SAEnum(ExpenseStatus), default=ExpenseStatus.UNPAID, nullable=False, index=True
    )

    # Is this asset purchase (not operating expense)?
    is_asset: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    asset_account_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    category: Mapped["ExpenseCategory"] = relationship(
        "ExpenseCategory", back_populates="expenses"
    )
    payments: Mapped[list["ExpensePayment"]] = relationship(
        "ExpensePayment", back_populates="expense"
    )

    def __repr__(self) -> str:
        return f"<Expense id={self.id} ref={self.reference} amount={self.amount_paise}>"
