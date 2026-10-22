"""
Journal entry models — the core accounting ledger.
Every financial event posts balanced debit/credit entries here.
Rule: Sum(debits) = Sum(credits) for every journal entry (enforced at service layer).
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Date, Text, Boolean, ForeignKey,
    CheckConstraint, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class JournalEntryStatus(str, enum.Enum):
    POSTED = "posted"
    REVERSED = "reversed"
    DRAFT = "draft"


class JournalEntry(Base, TimestampMixin):
    """
    A posted accounting journal entry.
    May contain 2 or more JournalLines.
    Must satisfy: sum(debit lines) = sum(credit lines).
    """
    __tablename__ = "journal_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Business date (when the event occurred)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    description: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[JournalEntryStatus] = mapped_column(
        SAEnum(JournalEntryStatus), default=JournalEntryStatus.POSTED, nullable=False
    )

    # Link to source document
    source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    source_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # If this entry reverses another
    reverses_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    # Accounting period
    period_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("accounting_periods.id"), nullable=True
    )

    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    lines: Mapped[list["JournalLine"]] = relationship(
        "JournalLine", back_populates="entry", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<JournalEntry id={self.id} ref={self.reference} date={self.entry_date}>"


class JournalLine(Base):
    """
    A single debit or credit line in a journal entry.
    amount_paise is always positive; is_debit determines direction.
    """
    __tablename__ = "journal_lines"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_jline_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("journal_entries.id", ondelete="CASCADE"), nullable=False, index=True
    )
    account_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    account_name: Mapped[str] = mapped_column(String(200), nullable=False)
    is_debit: Mapped[bool] = mapped_column(Boolean, nullable=False)  # True=DR, False=CR
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    entry: Mapped["JournalEntry"] = relationship("JournalEntry", back_populates="lines")

    @property
    def debit_paise(self) -> int:
        return self.amount_paise if self.is_debit else 0

    @property
    def credit_paise(self) -> int:
        return 0 if self.is_debit else self.amount_paise

    def __repr__(self) -> str:
        direction = "DR" if self.is_debit else "CR"
        return f"<JournalLine {direction} {self.account_code} {self.amount_paise}>"


class AccountingPeriod(Base, TimestampMixin):
    """
    A calendar month accounting period.
    Once closed, transactions cannot be posted to this period without authorization.
    """
    __tablename__ = "accounting_periods"
    __table_args__ = (
        CheckConstraint("year >= 2026", name="ck_period_year_valid"),
        CheckConstraint("month BETWEEN 1 AND 12", name="ck_period_month_valid"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    closed_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    reopen_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reopened_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    def __repr__(self) -> str:
        return f"<AccountingPeriod {self.year}-{self.month:02d} closed={self.is_closed}>"
