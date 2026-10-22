"""
Session models — Pool Table and PS4 sessions.
Amounts stored as INTEGER paise (1 LKR = 100 paise).
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import (
    String, Integer, Date, Text, Boolean,
    ForeignKey, CheckConstraint, Enum as SAEnum, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.players import Player
    from app.models.payments import SessionPayment


class SessionStatus(str, enum.Enum):
    PENDING = "pending"           # No payment received
    PARTIAL = "partial"           # Some payment received
    PAID = "paid"                 # Fully paid
    CANCELLED = "cancelled"       # Session cancelled
    ADJUSTED = "adjusted"         # Formal adjustment applied


class PoolSession(Base, TimestampMixin):
    """
    A pool table playing session.
    Amounts in INTEGER paise. Duration in minutes.
    
    Pricing rule (authoritative — see DECISIONS.md D-001):
    - Up to 60 minutes: Rs. 500 (50000 paise)
    - Each additional 30-minute block: Rs. 300 (30000 paise)
    """
    __tablename__ = "pool_sessions"
    __table_args__ = (
        CheckConstraint("actual_duration_minutes > 0", name="ck_pool_duration_positive"),
        CheckConstraint("standard_charge_paise >= 0", name="ck_pool_standard_charge_nonneg"),
        CheckConstraint("discount_paise >= 0", name="ck_pool_discount_nonneg"),
        CheckConstraint("final_charge_paise >= 0", name="ck_pool_final_charge_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    # Business date (when the session occurred — may differ from created_at)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Player link
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Duration (minutes)
    actual_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    chargeable_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Amounts (paise)
    standard_charge_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    final_charge_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.PENDING, nullable=False, index=True
    )

    # Notes
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Linked journal entry
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    # Relationships
    player: Mapped["Player"] = relationship("Player", back_populates="pool_sessions",
                                             foreign_keys=[player_id])
    payments: Mapped[list["SessionPayment"]] = relationship(
        "SessionPayment",
        primaryjoin="and_(SessionPayment.session_type=='pool', "
                    "SessionPayment.session_id==PoolSession.id)",
        foreign_keys="[SessionPayment.session_id]",
        viewonly=True,
        overlaps="pool_session",
    )

    def __repr__(self) -> str:
        return f"<PoolSession id={self.id} ref={self.reference} date={self.session_date}>"


class PS4Session(Base, TimestampMixin):
    """
    A PS4 gaming session.
    Amounts in INTEGER paise. Duration in minutes.
    
    Pricing rule:
    - 1 player: Rs. 400/hour (40000 paise)
    - 2 players: Rs. 500/hour (50000 paise)
    """
    __tablename__ = "ps4_sessions"
    __table_args__ = (
        CheckConstraint("actual_duration_minutes > 0", name="ck_ps4_duration_positive"),
        CheckConstraint("num_players IN (1, 2)", name="ck_ps4_players_valid"),
        CheckConstraint("standard_charge_paise >= 0", name="ck_ps4_standard_charge_nonneg"),
        CheckConstraint("discount_paise >= 0", name="ck_ps4_discount_nonneg"),
        CheckConstraint("final_charge_paise >= 0", name="ck_ps4_final_charge_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)

    session_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    # Players (1 or 2)
    num_players: Mapped[int] = mapped_column(Integer, nullable=False)
    player1_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    player2_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=True, index=True
    )

    # Duration (minutes)
    actual_duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)

    # Amounts (paise)
    standard_charge_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    discount_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    final_charge_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    # Status
    status: Mapped[SessionStatus] = mapped_column(
        SAEnum(SessionStatus), default=SessionStatus.PENDING, nullable=False, index=True
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_historical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    player1: Mapped["Player"] = relationship("Player", back_populates="ps4_sessions_p1",
                                              foreign_keys=[player1_id])
    player2: Mapped[Optional["Player"]] = relationship("Player", back_populates="ps4_sessions_p2",
                                                        foreign_keys=[player2_id])

    def __repr__(self) -> str:
        return f"<PS4Session id={self.id} ref={self.reference} date={self.session_date}>"
