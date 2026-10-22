"""
Player model — reusable player records for sessions.
"""
from __future__ import annotations

from datetime import date
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Boolean, Date, Text, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.sessions import PoolSession, PS4Session


class Player(Base, TimestampMixin):
    """
    A reusable player record.
    One player can appear in many sessions.
    Duplicate players are warned about but not auto-merged.
    """
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # If this player was merged into another, point to the canonical record
    merged_into_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Relationships
    pool_sessions: Mapped[list["PoolSession"]] = relationship(
        "PoolSession", back_populates="player", foreign_keys="PoolSession.player_id"
    )
    ps4_sessions_p1: Mapped[list["PS4Session"]] = relationship(
        "PS4Session", back_populates="player1", foreign_keys="PS4Session.player1_id"
    )
    ps4_sessions_p2: Mapped[list["PS4Session"]] = relationship(
        "PS4Session", back_populates="player2", foreign_keys="PS4Session.player2_id"
    )
    aliases: Mapped[list["PlayerAlias"]] = relationship(
        "PlayerAlias", back_populates="player"
    )

    def __repr__(self) -> str:
        return f"<Player id={self.id} name={self.name!r}>"


class PlayerAlias(Base, TimestampMixin):
    """
    Alternative names for a player (e.g., nicknames, old names before merge).
    Preserved after player merges for audit purposes.
    """
    __tablename__ = "player_aliases"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("players.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    alias: Mapped[str] = mapped_column(String(200), nullable=False)
    alias_normalized: Mapped[str] = mapped_column(String(200), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    player: Mapped["Player"] = relationship("Player", back_populates="aliases")
