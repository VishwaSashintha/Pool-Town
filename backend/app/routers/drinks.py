"""
Soft Drinks router — dedicated API for the drinks inventory, daily stock counts, 
new stock deliveries, and daily sales entries.

Uses existing Product, StockMovement, PhysicalStockCount, and ProductSale models.
All drinks are products with category_id matching the 'Soft Drinks' category.
"""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from app.database import get_db
from app.models.inventory import (
    Product, ProductCategory, StockMovement, StockMovementType,
    PhysicalStockCount, ProductSale
)
from app.models.accounts import FinancialAccount
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/drinks", tags=["Soft Drinks"])

DRINKS_CATEGORY_NAME = "Soft Drinks"


def _get_or_create_drinks_category(db: Session) -> ProductCategory:
    cat = db.query(ProductCategory).filter(ProductCategory.name == DRINKS_CATEGORY_NAME).first()
    if not cat:
        cat = ProductCategory(name=DRINKS_CATEGORY_NAME, description="Soft drinks and beverages")
        db.add(cat)
        db.flush()
    return cat


def _get_stock_on_hand(db: Session, product_id: int, as_of_date: date | None = None) -> int:
    """Calculate current stock from all movements up to as_of_date."""
    query = db.query(func.coalesce(func.sum(StockMovement.quantity_change), 0)).filter(
        StockMovement.product_id == product_id
    )
    if as_of_date:
        query = query.filter(StockMovement.event_date <= as_of_date)
    result = query.scalar()
    return result or 0


# ── Schemas ───────────────────────────────────────────────────────────────────

class DrinkProductCreate(BaseModel):
    name: str
    purchase_cost_paise: int = Field(ge=0)
    selling_price_paise: int = Field(ge=0)
    opening_stock: int = Field(default=0, ge=0)
    opening_date: date = date.today().__class__.today()
    notes: Optional[str] = None


class DrinkProductUpdate(BaseModel):
    name: Optional[str] = None
    purchase_cost_paise: Optional[int] = None
    selling_price_paise: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class DrinkProductResponse(BaseModel):
    id: int
    name: str
    purchase_cost_paise: int
    selling_price_paise: int
    current_stock: int
    is_active: bool
    notes: Optional[str] = None

    model_config = {"from_attributes": True}


class StockCountEntry(BaseModel):
    product_id: int
    counted_quantity: int = Field(ge=0)


class StockCountRequest(BaseModel):
    count_date: date
    entries: list[StockCountEntry]
    notes: Optional[str] = None


class StockDeliveryRequest(BaseModel):
    product_id: int
    delivery_date: date
    quantity: int = Field(gt=0)
    unit_cost_paise: Optional[int] = Field(default=None, ge=0)
    notes: Optional[str] = None


class DailySalesEntry(BaseModel):
    product_id: int
    quantity_sold: int = Field(gt=0)
    unit_price_paise: Optional[int] = None  # defaults to product selling price


class DailySalesRequest(BaseModel):
    sale_date: date
    entries: list[DailySalesEntry]
    notes: Optional[str] = None


class StockDiscrepancy(BaseModel):
    product_id: int
    product_name: str
    count_date: str
    expected_stock: int
    actual_stock: int
    difference: int
    estimated_value_paise: int
    status: str  # "over", "short", "match"
    notes: Optional[str] = None
    investigated: bool


# ── Products ──────────────────────────────────────────────────────────────────

@router.get("/products", response_model=list[DrinkProductResponse])
def list_drink_products(
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
):
    cat = _get_or_create_drinks_category(db)
    db.commit()

    query = db.query(Product).filter(Product.category_id == cat.id)
    if not include_inactive:
        query = query.filter(Product.is_active == True)

    products = query.order_by(Product.name.asc()).all()

    results = []
    for p in products:
        stock = _get_stock_on_hand(db, p.id)
        results.append(DrinkProductResponse(
            id=p.id,
            name=p.name,
            purchase_cost_paise=p.purchase_price_paise,
            selling_price_paise=p.selling_price_paise,
            current_stock=stock,
            is_active=p.is_active,
            notes=p.notes,
        ))
    return results


@router.post("/products", response_model=DrinkProductResponse, status_code=201)
def create_drink_product(payload: DrinkProductCreate, db: Session = Depends(get_db)):
    cat = _get_or_create_drinks_category(db)

    product = Product(
        name=payload.name.strip(),
        category_id=cat.id,
        unit="bottle",
        purchase_price_paise=payload.purchase_cost_paise,
        selling_price_paise=payload.selling_price_paise,
        current_avg_cost_paise=payload.purchase_cost_paise,
        min_stock_qty=0,
        is_active=True,
        notes=payload.notes,
    )
    db.add(product)
    db.flush()

    # Record opening stock if provided
    if payload.opening_stock > 0:
        movement = StockMovement(
            product_id=product.id,
            movement_type=StockMovementType.OPENING,
            quantity_change=payload.opening_stock,
            unit_cost_paise=payload.purchase_cost_paise,
            event_date=payload.opening_date,
            notes=f"Opening stock for {payload.name}",
        )
        db.add(movement)

    db.commit()
    db.refresh(product)

    stock = _get_stock_on_hand(db, product.id)
    return DrinkProductResponse(
        id=product.id,
        name=product.name,
        purchase_cost_paise=product.purchase_price_paise,
        selling_price_paise=product.selling_price_paise,
        current_stock=stock,
        is_active=product.is_active,
        notes=product.notes,
    )


@router.put("/products/{product_id}", response_model=DrinkProductResponse)
def update_drink_product(product_id: int, payload: DrinkProductUpdate, db: Session = Depends(get_db)):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.name is not None:
        product.name = payload.name.strip()
    if payload.purchase_cost_paise is not None:
        product.purchase_price_paise = payload.purchase_cost_paise
    if payload.selling_price_paise is not None:
        product.selling_price_paise = payload.selling_price_paise
    if payload.is_active is not None:
        product.is_active = payload.is_active
    if payload.notes is not None:
        product.notes = payload.notes

    db.commit()
    db.refresh(product)
    stock = _get_stock_on_hand(db, product.id)
    return DrinkProductResponse(
        id=product.id,
        name=product.name,
        purchase_cost_paise=product.purchase_price_paise,
        selling_price_paise=product.selling_price_paise,
        current_stock=stock,
        is_active=product.is_active,
        notes=product.notes,
    )


# ── Stock Counts ──────────────────────────────────────────────────────────────

@router.post("/stock-count", status_code=201)
def record_stock_count(payload: StockCountRequest, db: Session = Depends(get_db)):
    """Record a physical stock count for multiple products on a given date.
    This does NOT create stock movements — it records what was physically counted.
    """
    created = []
    for entry in payload.entries:
        product = db.query(Product).filter(Product.id == entry.product_id).first()
        if not product:
            continue

        expected = _get_stock_on_hand(db, entry.product_id, as_of_date=payload.count_date)
        discrepancy = entry.counted_quantity - expected

        # Delete any existing count for same product+date (allow re-count)
        db.query(PhysicalStockCount).filter(
            PhysicalStockCount.product_id == entry.product_id,
            PhysicalStockCount.count_date == payload.count_date,
        ).delete()

        count = PhysicalStockCount(
            count_date=payload.count_date,
            product_id=entry.product_id,
            counted_quantity=entry.counted_quantity,
            expected_quantity=expected,
            discrepancy=discrepancy,
            notes=payload.notes,
        )
        db.add(count)
        created.append({"product_id": entry.product_id, "counted": entry.counted_quantity,
                         "expected": expected, "discrepancy": discrepancy})

    db.commit()
    return {"message": f"Stock count recorded for {len(created)} products", "entries": created}


@router.get("/stock-count")
def get_stock_counts(
    count_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get stock count records, optionally filtered by date."""
    cat = _get_or_create_drinks_category(db)
    drink_product_ids = [p.id for p in db.query(Product.id).filter(
        Product.category_id == cat.id
    ).all()]

    query = db.query(PhysicalStockCount).filter(
        PhysicalStockCount.product_id.in_(drink_product_ids)
    )
    if count_date:
        query = query.filter(PhysicalStockCount.count_date == count_date)

    counts = query.order_by(PhysicalStockCount.count_date.desc()).all()

    results = []
    for c in counts:
        results.append({
            "id": c.id,
            "count_date": str(c.count_date),
            "product_id": c.product_id,
            "product_name": c.product.name if c.product else "Unknown",
            "counted_quantity": c.counted_quantity,
            "expected_quantity": c.expected_quantity,
            "discrepancy": c.discrepancy,
            "notes": c.notes,
            "investigated": c.investigated,
            "investigation_notes": c.investigation_notes,
        })
    return results


# ── New Stock Delivery ────────────────────────────────────────────────────────

@router.post("/stock-delivery", status_code=201)
def record_stock_delivery(payload: StockDeliveryRequest, db: Session = Depends(get_db)):
    """Record new stock received (a delivery or purchase).
    This is a PURCHASE movement, not a physical count.
    """
    product = db.query(Product).filter(Product.id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    unit_cost = payload.unit_cost_paise if payload.unit_cost_paise is not None else product.purchase_price_paise

    movement = StockMovement(
        product_id=product.id,
        movement_type=StockMovementType.PURCHASE,
        quantity_change=payload.quantity,
        unit_cost_paise=unit_cost,
        event_date=payload.delivery_date,
        notes=payload.notes or f"Stock delivery: {payload.quantity} × {product.name}",
    )
    db.add(movement)

    # Update product average cost
    current_stock = _get_stock_on_hand(db, product.id)
    new_stock = current_stock + payload.quantity
    if new_stock > 0:
        current_value = current_stock * product.current_avg_cost_paise
        new_value = payload.quantity * unit_cost
        product.current_avg_cost_paise = (current_value + new_value) // new_stock

    db.commit()

    return {
        "message": f"Delivery of {payload.quantity} × {product.name} recorded",
        "new_stock": new_stock,
    }


# ── Daily Sales ───────────────────────────────────────────────────────────────

@router.post("/sales", status_code=201)
def record_daily_sales(payload: DailySalesRequest, db: Session = Depends(get_db)):
    """Record soft drink sales for one or more products on a given date."""
    created = []
    date_str = payload.sale_date.strftime("%Y%m%d")

    for entry in payload.entries:
        product = db.query(Product).filter(Product.id == entry.product_id).first()
        if not product:
            continue

        unit_price = entry.unit_price_paise if entry.unit_price_paise is not None else product.selling_price_paise
        unit_cost = product.current_avg_cost_paise
        total_revenue = unit_price * entry.quantity_sold
        total_cogs = unit_cost * entry.quantity_sold

        # Check stock
        current_stock = _get_stock_on_hand(db, entry.product_id)
        if current_stock < entry.quantity_sold:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}. Available: {current_stock}, Requested: {entry.quantity_sold}"
            )

        count = db.query(ProductSale).filter(
            ProductSale.reference.like(f"SALE-{date_str}-{entry.product_id}-%")
        ).count()
        reference = f"SALE-{date_str}-{entry.product_id}-{count + 1:04d}"

        sale = ProductSale(
            reference=reference,
            sale_date=payload.sale_date,
            product_id=entry.product_id,
            quantity=entry.quantity_sold,
            unit_price_paise=unit_price,
            total_revenue_paise=total_revenue,
            unit_cost_paise=unit_cost,
            total_cogs_paise=total_cogs,
            collected_paise=total_revenue,  # assume collected at sale
            notes=payload.notes,
        )
        db.add(sale)
        db.flush()

        # Stock movement (outgoing)
        movement = StockMovement(
            product_id=entry.product_id,
            movement_type=StockMovementType.SALE,
            quantity_change=-entry.quantity_sold,
            unit_cost_paise=unit_cost,
            event_date=payload.sale_date,
            reference=reference,
            source_type="product_sale",
            source_id=sale.id,
            notes=f"Sale: {entry.quantity_sold} × {product.name}",
        )
        db.add(movement)
        db.flush()

        # Journal entry: DR Cash 1001, CR Revenue 4003; DR COGS 5001, CR Inventory 1020
        if total_revenue > 0:
            rev_entry = JournalService.post_entry(
                db,
                entry_date=payload.sale_date,
                description=f"Drinks sale {reference}: {entry.quantity_sold} × {product.name}",
                lines=[
                    JournalLineInput("1001", "Cash in Hand", True, total_revenue),
                    JournalLineInput("4003", "Product Sales Revenue", False, total_revenue),
                ],
                source_type="product_sale",
                source_id=sale.id,
            )
            sale.journal_entry_id = rev_entry.id

        if total_cogs > 0:
            JournalService.post_entry(
                db,
                entry_date=payload.sale_date,
                description=f"COGS {reference}: {product.name}",
                lines=[
                    JournalLineInput("5001", "Cost of Goods Sold — Drinks", True, total_cogs),
                    JournalLineInput("1020", "Inventory — Drinks", False, total_cogs),
                ],
                source_type="product_sale_cogs",
                source_id=sale.id,
            )

        created.append({
            "reference": reference,
            "product_name": product.name,
            "quantity": entry.quantity_sold,
            "unit_price_paise": unit_price,
            "total_revenue_paise": total_revenue,
        })

    db.commit()
    return {"message": f"Sales recorded for {len(created)} products", "sales": created}


@router.get("/sales")
def list_sales(
    sale_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """List soft drink sales, optionally filtered by date."""
    cat = _get_or_create_drinks_category(db)
    drink_product_ids = [p.id for p in db.query(Product.id).filter(
        Product.category_id == cat.id
    ).all()]

    query = db.query(ProductSale).filter(ProductSale.product_id.in_(drink_product_ids))
    if sale_date:
        query = query.filter(ProductSale.sale_date == sale_date)

    sales = query.order_by(ProductSale.sale_date.desc(), ProductSale.id.desc()).all()

    return [
        {
            "id": s.id,
            "reference": s.reference,
            "sale_date": str(s.sale_date),
            "product_id": s.product_id,
            "product_name": s.product.name if s.product else "Unknown",
            "quantity": s.quantity,
            "unit_price_paise": s.unit_price_paise,
            "total_revenue_paise": s.total_revenue_paise,
            "unit_cost_paise": s.unit_cost_paise,
            "total_cogs_paise": s.total_cogs_paise,
            "notes": s.notes,
        }
        for s in sales
    ]


# ── Stock Issues / Discrepancy Report ────────────────────────────────────────

@router.get("/issues", response_model=list[StockDiscrepancy])
def get_stock_issues(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    product_id: Optional[int] = Query(None),
    unresolved_only: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Return stock discrepancies from physical counts vs expected stock."""
    cat = _get_or_create_drinks_category(db)
    drink_product_ids = [p.id for p in db.query(Product.id).filter(
        Product.category_id == cat.id
    ).all()]

    query = db.query(PhysicalStockCount).filter(
        PhysicalStockCount.product_id.in_(drink_product_ids),
        PhysicalStockCount.discrepancy != 0,
    )
    if start_date:
        query = query.filter(PhysicalStockCount.count_date >= start_date)
    if end_date:
        query = query.filter(PhysicalStockCount.count_date <= end_date)
    if product_id:
        query = query.filter(PhysicalStockCount.product_id == product_id)
    if unresolved_only:
        query = query.filter(PhysicalStockCount.investigated == False)

    counts = query.order_by(PhysicalStockCount.count_date.desc()).all()

    results = []
    for c in counts:
        product = db.query(Product).filter(Product.id == c.product_id).first()
        unit_cost = product.current_avg_cost_paise if product else 0
        abs_diff = abs(c.discrepancy)
        est_value = abs_diff * unit_cost
        status = "over" if c.discrepancy > 0 else "short"

        results.append(StockDiscrepancy(
            product_id=c.product_id,
            product_name=product.name if product else "Unknown",
            count_date=str(c.count_date),
            expected_stock=c.expected_quantity,
            actual_stock=c.counted_quantity,
            difference=c.discrepancy,
            estimated_value_paise=est_value,
            status=status,
            notes=c.notes,
            investigated=c.investigated,
        ))
    return results


@router.patch("/issues/{count_id}/resolve")
def resolve_stock_issue(count_id: int, notes: str, db: Session = Depends(get_db)):
    """Mark a stock discrepancy as investigated with resolution notes."""
    count = db.query(PhysicalStockCount).filter(PhysicalStockCount.id == count_id).first()
    if not count:
        raise HTTPException(status_code=404, detail="Stock count not found")

    count.investigated = True
    count.investigation_notes = notes
    db.commit()
    return {"message": "Issue marked as resolved"}


@router.get("/movements")
def list_stock_movements(
    product_id: Optional[int] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """List all stock movements (for audit trail)."""
    cat = _get_or_create_drinks_category(db)
    drink_product_ids = [p.id for p in db.query(Product.id).filter(
        Product.category_id == cat.id
    ).all()]

    query = db.query(StockMovement).filter(StockMovement.product_id.in_(drink_product_ids))
    if product_id:
        query = query.filter(StockMovement.product_id == product_id)
    if start_date:
        query = query.filter(StockMovement.event_date >= start_date)
    if end_date:
        query = query.filter(StockMovement.event_date <= end_date)

    movements = query.order_by(StockMovement.event_date.desc(), StockMovement.id.desc()).all()

    return [
        {
            "id": m.id,
            "product_id": m.product_id,
            "product_name": m.product.name if m.product else "Unknown",
            "movement_type": m.movement_type.value,
            "quantity_change": m.quantity_change,
            "unit_cost_paise": m.unit_cost_paise,
            "event_date": str(m.event_date),
            "reference": m.reference,
            "notes": m.notes,
        }
        for m in movements
    ]
