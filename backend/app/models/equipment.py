"""
Equipment purchases and damage charge models.
Equipment purchases: cue sticks, tables, PS4 controllers, repairs.
Damage charges: player-caused damage with collection tracking.
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


class EquipmentCategory(str, enum.Enum):
    CUE_STICK = "cue_stick"
    TABLE = "table"
    PS4 = "ps4"
    CONTROLLER = "controller"
    ACCESSORY = "accessory"
    REPAIR = "repair"
    OTHER = "other"


class EquipmentPaymentStatus(str, enum.Enum):
    PAID = "paid"
    UNPAID = "unpaid"
    PARTIAL = "partial"


class EquipmentPurchase(Base, TimestampMixin):
    """
    Equipment and repair purchase records.
    Separate from damage recoveries — these are costs to the business.
    """
    __tablename__ = "equipment_purchases"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_equip_amount_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    category: Mapped[EquipmentCategory] = mapped_column(SAEnum(EquipmentCategory), nullable=False)
    item_name: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    supplier: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    payment_status: Mapped[EquipmentPaymentStatus] = mapped_column(
        SAEnum(EquipmentPaymentStatus), default=EquipmentPaymentStatus.PAID, nullable=False
    )
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)


class DamageStatus(str, enum.Enum):
    OUTSTANDING = "outstanding"
    PARTIAL = "partial"
    RECOVERED = "recovered"
    WAIVED = "waived"
    WRITTEN_OFF = "written_off"


class DamageCharge(Base, TimestampMixin):
    """
    Damage charge raised against a player.
    Payment status tracked separately from equipment purchases.
    """
    __tablename__ = "damage_charges"
    __table_args__ = (
        CheckConstraint("charge_amount_paise > 0", name="ck_damage_charge_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    damage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    player_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("players.id"), nullable=True
    )
    player_name_override: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    damaged_item: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    charge_amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    collected_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[DamageStatus] = mapped_column(
        SAEnum(DamageStatus), default=DamageStatus.OUTSTANDING, nullable=False
    )
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    player: Mapped[Optional["Player"]] = relationship("Player", foreign_keys=[player_id])


class DamagePayment(Base, TimestampMixin):
    """A payment collected towards a damage charge."""
    __tablename__ = "damage_payments"
    __table_args__ = (
        CheckConstraint("amount_paise > 0", name="ck_damage_pay_positive"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    damage_charge_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("damage_charges.id"), nullable=False, index=True
    )
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(50), default="cash", nullable=False)
    account_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("financial_accounts.id"), nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    damage_charge: Mapped["DamageCharge"] = relationship("DamageCharge")
