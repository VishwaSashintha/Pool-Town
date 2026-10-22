"""
Payment models — session payments, expense payments.
Amounts stored as INTEGER paise.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    String, Integer, Date, Text, Boolean, ForeignKey,
    CheckConstraint, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.expenses import Expense


class PaymentMethod(str, enum.Enum):
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    OTHER = "other"


class PaymentStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    REVERSED = "reversed"
    PENDING = "pending"


class SessionPayment(Base, TimestampMixin):
    """
    A payment received against a pool or PS4 session.
    
    session_type: 'pool' or 'ps4'
    session_id: ID in the respective session table
    
    Outstanding = final_charge - sum(confirmed payments) - sum(approved adjustments)
    """
    __tablename__ = "session_payments"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_payment_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Which session this payment is for
    session_type: Mapped[str] = mapped_column(String(10), nullable=False)  # 'pool' or 'ps4'
    session_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)

    # When money was actually collected
    collection_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Amount (paise)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    # How and where
    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod), nullable=False
    )
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )

    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus), default=PaymentStatus.CONFIRMED, nullable=False
    )

    # If this payment was reversed, which reversal entry?
    reversed_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("session_payments.id"), nullable=True
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    def __repr__(self) -> str:
        return f"<SessionPayment id={self.id} ref={self.reference} amount={self.amount_paise}>"


class ExpensePayment(Base, TimestampMixin):
    """
    A payment made against an expense bill.
    Recording this payment does NOT create a new expense — it reduces the payable.
    """
    __tablename__ = "expense_payments"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_exp_payment_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    expense_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("expenses.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    payment_method: Mapped[PaymentMethod] = mapped_column(
        SAEnum(PaymentMethod), nullable=False
    )
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )

    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus), default=PaymentStatus.CONFIRMED, nullable=False
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    expense: Mapped["Expense"] = relationship(
        "Expense", back_populates="payments"
    )
