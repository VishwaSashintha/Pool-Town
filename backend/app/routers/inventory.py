from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.inventory import Product, StockMovement, StockMovementType
from app.schemas.inventory import ProductCreate, ProductResponse

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


def _get_product_stock(db: Session, product_id: int) -> int:
    stock = db.query(
        func.coalesce(func.sum(StockMovement.quantity_change), 0)
    ).filter(StockMovement.product_id == product_id).scalar()
    return stock or 0


@router.get("/products", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    products = db.query(Product).order_by(Product.name.asc()).all()
    results = []
    for p in products:
        stock = _get_product_stock(db, p.id)
        results.append(
            ProductResponse(
                id=p.id,
                name=p.name,
                category_id=p.category_id,
                unit=p.unit,
                selling_price_paise=p.selling_price_paise,
                average_cost_paise=p.current_avg_cost_paise,
                reorder_level=p.min_stock_qty,
                current_stock=stock,
                is_active=p.is_active,
            )
        )
    return results


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = Product(
        name=payload.name.strip(),
        category_id=payload.category_id,
        unit=payload.unit,
        selling_price_paise=payload.selling_price_paise,
        purchase_price_paise=payload.average_cost_paise,
        current_avg_cost_paise=payload.average_cost_paise,
        min_stock_qty=payload.reorder_level,
        is_active=True,
    )
    db.add(product)
    db.flush()

    # Record opening stock movement if provided
    if payload.opening_stock > 0:
        movement = StockMovement(
            product_id=product.id,
            movement_type=StockMovementType.OPENING,
            quantity_change=payload.opening_stock,
            unit_cost_paise=payload.average_cost_paise,
            event_date=date(2026, 1, 1),
            notes="Opening stock entry",
        )
        db.add(movement)

    db.commit()
    db.refresh(product)

    return ProductResponse(
        id=product.id,
        name=product.name,
        category_id=product.category_id,
        unit=product.unit,
        selling_price_paise=product.selling_price_paise,
        average_cost_paise=product.current_avg_cost_paise,
        reorder_level=product.min_stock_qty,
        current_stock=payload.opening_stock,
        is_active=product.is_active,
    )
