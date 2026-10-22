"""
Inventory models — products, suppliers, stock movements, physical counts.
All amounts in INTEGER paise.
"""
from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    String, Integer, Date, Text, Boolean, ForeignKey,
    CheckConstraint, Enum as SAEnum, Numeric
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class StockMovementType(str, enum.Enum):
    OPENING = "opening"
    PURCHASE = "purchase"
    SALE = "sale"
    DAMAGED = "damaged"
    COMPLIMENTARY = "complimentary"
    INTERNAL = "internal"
    SUPPLIER_RETURN = "supplier_return"
    CORRECTION = "correction"
    PHYSICAL_COUNT = "physical_count"


class ProductCategory(Base, TimestampMixin):
    __tablename__ = "product_categories"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    products: Mapped[list["Product"]] = relationship("Product", back_populates="category")


class Supplier(Base, TimestampMixin):
    __tablename__ = "suppliers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    purchases: Mapped[list["StockPurchase"]] = relationship("StockPurchase", back_populates="supplier")


class Product(Base, TimestampMixin):
    """
    A product in the catalogue.
    current_avg_cost_paise: weighted-average unit cost (paise), updated on each purchase.
    """
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("purchase_price_paise >= 0", name="ck_product_purchase_nonneg"),
        CheckConstraint("selling_price_paise >= 0", name="ck_product_selling_nonneg"),
        CheckConstraint("min_stock_qty >= 0", name="ck_product_min_stock_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    sku: Mapped[Optional[str]] = mapped_column(String(100), unique=True, nullable=True)
    unit: Mapped[str] = mapped_column(String(50), default="bottle", nullable=False)
    category_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("product_categories.id"), nullable=True
    )
    purchase_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    selling_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    current_avg_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    min_stock_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    category: Mapped[Optional["ProductCategory"]] = relationship(
        "ProductCategory", back_populates="products"
    )
    stock_movements: Mapped[list["StockMovement"]] = relationship(
        "StockMovement", back_populates="product"
    )

    def __repr__(self) -> str:
        return f"<Product id={self.id} name={self.name!r}>"


class StockPurchase(Base, TimestampMixin):
    """
    A purchase order from a supplier.
    Creates StockMovement records when received.
    """
    __tablename__ = "stock_purchases"
    __table_args__ = (
        CheckConstraint("total_cost_paise >= 0", name="ck_purchase_total_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    purchase_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("suppliers.id"), nullable=True
    )
    total_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    is_paid: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    supplier: Mapped[Optional["Supplier"]] = relationship("Supplier", back_populates="purchases")
    items: Mapped[list["StockPurchaseItem"]] = relationship(
        "StockPurchaseItem", back_populates="purchase", cascade="all, delete-orphan"
    )


class StockPurchaseItem(Base):
    __tablename__ = "stock_purchase_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_item_qty_positive"),
        CheckConstraint("unit_cost_paise >= 0", name="ck_purchase_item_cost_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    purchase_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("stock_purchases.id", ondelete="CASCADE"), nullable=False
    )
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    total_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)

    purchase: Mapped["StockPurchase"] = relationship("StockPurchase", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


class StockMovement(Base, TimestampMixin):
    """
    A single stock change event.
    quantity_change: positive = stock in, negative = stock out.
    
    This is the ledger; never overwrite a previous movement.
    Calculate on-hand from all movements.
    """
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    movement_type: Mapped[StockMovementType] = mapped_column(
        SAEnum(StockMovementType), nullable=False
    )
    quantity_change: Mapped[int] = mapped_column(Integer, nullable=False)  # +in / -out
    unit_cost_paise: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # When the stock event actually occurred
    event_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # When this was recorded in the system
    # (created_at from TimestampMixin serves as record_date)

    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    source_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    product: Mapped["Product"] = relationship("Product", back_populates="stock_movements")

    def __repr__(self) -> str:
        return f"<StockMovement product_id={self.product_id} qty={self.quantity_change} type={self.movement_type}>"


class PhysicalStockCount(Base, TimestampMixin):
    """
    A physical stock count on a specific date.
    Records: counted quantity vs expected quantity.
    Does NOT auto-create stock movements; requires explicit correction entry.
    """
    __tablename__ = "physical_stock_counts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    count_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    counted_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    expected_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    discrepancy: Mapped[int] = mapped_column(Integer, nullable=False)  # counted - expected
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    investigated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    investigation_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correction_movement_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("stock_movements.id"), nullable=True
    )
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    product: Mapped["Product"] = relationship("Product")


class ProductSale(Base, TimestampMixin):
    """
    A product sale record.
    Creates stock movement (−qty) and journal entries (DR AR, CR Revenue; DR COGS, CR Inventory).
    """
    __tablename__ = "product_sales"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_sale_qty_positive"),
        CheckConstraint("unit_price_paise >= 0", name="ck_sale_price_nonneg"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    sale_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("products.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    total_revenue_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_cost_paise: Mapped[int] = mapped_column(Integer, nullable=False)  # avg cost at time of sale
    total_cogs_paise: Mapped[int] = mapped_column(Integer, nullable=False)
    collected_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    journal_entry_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("journal_entries.id"), nullable=True
    )

    product: Mapped["Product"] = relationship("Product")
