"""
Audit log model — append-only record of all significant actions.
Never delete or update audit records.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, utcnow


class AuditLog(Base):
    """
    Immutable audit record.
    No updated_at — audit records are never modified.
    """
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, nullable=False, index=True
    )
    user: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    old_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    new_values: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    ip_address: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    def __repr__(self) -> str:
        return f"<AuditLog id={self.id} action={self.action} entity={self.entity_type}:{self.entity_id}>"


class AppSetting(Base):
    """
    Application configuration settings stored in the database.
    key: unique setting identifier
    value: JSON-serialized value
    """
    __tablename__ = "app_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    key: Mapped[str] = mapped_column(String(200), unique=True, nullable=False)
    value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON
    description: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    updated_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow, nullable=False
    )
