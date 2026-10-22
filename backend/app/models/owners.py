"""
Owner and loan models — capital, distributions, profit allocations, loans.
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


class OwnerTransactionType(str, enum.Enum):
    INITIAL_CAPITAL = "initial_capital"
    ADDITIONAL_CAPITAL = "additional_capital"
    RETURN_OF_CAPITAL = "return_of_capital"
    OWNER_LOAN = "owner_loan"           # Owner lends to business → liability
    LOAN_REPAYMENT = "loan_repayment"  # Business repays owner loan
    PROFIT_ALLOCATION = "profit_allocation"
    DISTRIBUTION = "distribution"
    WITHDRAWAL = "withdrawal"
    REIMBURSEMENT = "reimbursement"
    CORRECTION = "correction"


class Owner(Base, TimestampMixin):
    __tablename__ = "owners"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    profit_share_bps: Mapped[int] = mapped_column(Integer, nullable=False)  # basis points (2000 = 20%)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)

    transactions: Mapped[list["OwnerTransaction"]] = relationship(
        "OwnerTransaction", back_populates="owner"
    )

    def __repr__(self) -> str:
        return f"<Owner id={self.id} name={self.name!r} share={self.profit_share_bps}bps>"


class OwnerTransaction(Base, TimestampMixin):
    """Every financial event involving an owner's capital account."""
    __tablename__ = "owner_transactions"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_owner_tx_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    owner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=False, index=True
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    transaction_type: Mapped[OwnerTransactionType] = mapped_column(
        SAEnum(OwnerTransactionType), nullable=False
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    owner: Mapped["Owner"] = relationship("Owner", back_populates="transactions")


class ProfitAllocation(Base, TimestampMixin):
    """
    A formal profit allocation event (posted after period close, not automatic).
    allocation_basis_paise: the net profit amount being allocated.
    """
    __tablename__ = "profit_allocations"
    __table_args__ = (
        CheckConstraint("allocation_basis_paise >= 0", name="ck_palloc_basis_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    allocation_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)
    allocation_basis_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    approved_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    lines: Mapped[list["ProfitAllocationLine"]] = relationship(
        "ProfitAllocationLine", back_populates="allocation", cascade="all, delete-orphan"
    )


class ProfitAllocationLine(Base):
    __tablename__ = "profit_allocation_lines"
    __table_args__ = (
        CheckConstraint("amount_paise >= 0", name="ck_palloc_line_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    allocation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("profit_allocations.id", ondelete="CASCADE"), nullable=False
    )
    recipient: Mapped[str] = mapped_column(String(100), nullable=False)  # 'savings', 'akash', etc.
    share_bps: Mapped[int] = mapped_column(Integer, nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    allocation: Mapped["ProfitAllocation"] = relationship(
        "ProfitAllocation", back_populates="lines"
    )


class LoanType(str, enum.Enum):
    BANK = "bank"
    EXTERNAL = "external"
    OWNER = "owner"


class LoanStatus(str, enum.Enum):
    ACTIVE = "active"
    SETTLED = "settled"
    WRITTEN_OFF = "written_off"


class Loan(Base, TimestampMixin):
    """A loan from a bank, external lender, or owner."""
    __tablename__ = "loans"
    __table_args__ = (
        CheckConstraint("original_principal_paise > 0", name="ck_loan_principal_positive"),
        CheckConstraint("interest_rate_bps >= 0", name="ck_loan_rate_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    lender_name: Mapped[str] = mapped_column(String(200), nullable=False)
    loan_type: Mapped[LoanType] = mapped_column(SAEnum(LoanType), nullable=False)
    original_principal_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    opening_outstanding_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    interest_rate_bps: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # per annum
    repayment_terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[LoanStatus] = mapped_column(
        SAEnum(LoanStatus), default=LoanStatus.ACTIVE, nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    # Owner link if loan_type == OWNER
    owner_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("owners.id"), nullable=True
    )

    transactions: Mapped[list["LoanTransaction"]] = relationship(
        "LoanTransaction", back_populates="loan"
    )


class LoanTransactionType(str, enum.Enum):
    RECEIPT = "receipt"           # Received loan funds
    PRINCIPAL_REPAYMENT = "principal_repayment"
    INTEREST_PAYMENT = "interest_payment"
    FEE = "fee"
    ADDITIONAL_BORROWING = "additional_borrowing"
    CORRECTION = "correction"
    SETTLEMENT = "settlement"


class LoanTransaction(Base, TimestampMixin):
    """
    A single transaction against a loan.
    If a payment includes both principal and interest,
    record two separate LoanTransaction records.
    """
    __tablename__ = "loan_transactions"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_loan_tx_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    loan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("loans.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    transaction_type: Mapped[LoanTransactionType] = mapped_column(
        SAEnum(LoanTransactionType), nullable=False
    )
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    loan: Mapped["Loan"] = relationship("Loan", back_populates="transactions")
