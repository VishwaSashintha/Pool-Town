"""
Equipment purchases and damage charges router.
"""
from __future__ import annotations

from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import desc, func

from app.database import get_db
from app.models.equipment import (
    EquipmentPurchase, EquipmentCategory, EquipmentPaymentStatus,
    DamageCharge, DamageStatus, DamagePayment,
)
from app.models.accounts import FinancialAccount
from app.services.journal import JournalService, JournalLineInput

router = APIRouter(prefix="/api/equipment", tags=["Equipment & Damage"])


# ── Schemas ──────────────────────────────────────────────────────────

class EquipmentPurchaseCreate(BaseModel):
    purchase_date: date
    category: EquipmentCategory
    item_name: str = Field(..., min_length=1)
    description: Optional[str] = None
    quantity: int = Field(default=1, ge=1)
    amount_paise: int = Field(..., gt=0)
    supplier: Optional[str] = None
    payment_status: EquipmentPaymentStatus = EquipmentPaymentStatus.PAID
    account_id: Optional[int] = None
    notes: Optional[str] = None


class DamageChargeCreate(BaseModel):
    damage_date: date
    player_id: Optional[int] = None
    player_name_override: Optional[str] = None
    damaged_item: str = Field(..., min_length=1)
    description: Optional[str] = None
    charge_amount_paise: int = Field(..., gt=0)
    notes: Optional[str] = None


class DamagePaymentCreate(BaseModel):
    payment_date: date
    amount_paise: int = Field(..., gt=0)
    payment_method: str = "cash"
    account_id: Optional[int] = None
    notes: Optional[str] = None


class DamageWaiveRequest(BaseModel):
    resolution_notes: str
    status: DamageStatus = DamageStatus.WAIVED


# ── Equipment Purchases ──────────────────────────────────────────────

@router.get("/purchases")
def list_equipment_purchases(
    category: Optional[str] = Query(None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(EquipmentPurchase)
    if category:
        try:
            cat_enum = EquipmentCategory(category)
            q = q.filter(EquipmentPurchase.category == cat_enum)
        except ValueError:
            pass
    purchases = q.order_by(desc(EquipmentPurchase.purchase_date), desc(EquipmentPurchase.id)).limit(limit).all()
    return [
        {
            "id": p.id,
            "reference": p.reference,
            "purchase_date": p.purchase_date.isoformat(),
            "category": p.category.value,
            "item_name": p.item_name,
            "description": p.description,
            "quantity": p.quantity,
            "amount_paise": p.amount_paise,
            "supplier": p.supplier,
            "payment_status": p.payment_status.value,
            "notes": p.notes,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in purchases
    ]


@router.post("/purchases", status_code=201)
def create_equipment_purchase(payload: EquipmentPurchaseCreate, db: Session = Depends(get_db)):
    date_str = payload.purchase_date.strftime("%Y%m%d")
    count = db.query(EquipmentPurchase).filter(
        EquipmentPurchase.reference.like(f"EQP-{date_str}-%")
    ).count()
    reference = f"EQP-{date_str}-{count + 1:04d}"

    purchase = EquipmentPurchase(
        reference=reference,
        purchase_date=payload.purchase_date,
        category=payload.category,
        item_name=payload.item_name,
        description=payload.description,
        quantity=payload.quantity,
        amount_paise=payload.amount_paise,
        supplier=payload.supplier,
        payment_status=payload.payment_status,
        account_id=payload.account_id,
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(purchase)
    db.flush()

    # Post journal entry if paid: DR Equipment Expense, CR Cash/Bank
    if payload.payment_status == EquipmentPaymentStatus.PAID:
        acct_code = "1001"
        acct_name = "Cash in Hand"
        if payload.account_id:
            fa = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
            if fa:
                acct_code = fa.code
                acct_name = fa.name

        entry = JournalService.post_entry(
            db,
            entry_date=payload.purchase_date,
            description=f"Equipment purchase: {payload.item_name} ({reference})",
            lines=[
                JournalLineInput("5010", "Equipment & Repairs Expense", True, payload.amount_paise),
                JournalLineInput(acct_code, acct_name, False, payload.amount_paise),
            ],
            source_type="equipment_purchase",
            source_id=purchase.id,
        )
        purchase.journal_entry_id = entry.id

    db.commit()
    db.refresh(purchase)
    return {"message": "Equipment purchase recorded", "reference": reference, "id": purchase.id}


# ── Damage Charges ────────────────────────────────────────────────────

@router.get("/damage-charges")
def list_damage_charges(
    status: Optional[str] = Query(None),
    player_id: Optional[int] = Query(None),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    q = db.query(DamageCharge)
    if status:
        try:
            q = q.filter(DamageCharge.status == DamageStatus(status))
        except ValueError:
            pass
    if player_id:
        q = q.filter(DamageCharge.player_id == player_id)

    charges = q.order_by(desc(DamageCharge.damage_date), desc(DamageCharge.id)).limit(limit).all()
    results = []
    for c in charges:
        # Reload collected amount from payments
        payments_total = db.query(
            func.coalesce(func.sum(DamagePayment.amount_paise), 0)
        ).filter(DamagePayment.damage_charge_id == c.id).scalar() or 0

        player_name = c.player_name_override
        if not player_name and c.player_id and c.player:
            player_name = c.player.name

        results.append({
            "id": c.id,
            "reference": c.reference,
            "damage_date": c.damage_date.isoformat(),
            "player_id": c.player_id,
            "player_name": player_name or "Unknown",
            "damaged_item": c.damaged_item,
            "description": c.description,
            "charge_amount_paise": c.charge_amount_paise,
            "collected_paise": payments_total,
            "outstanding_paise": max(0, c.charge_amount_paise - payments_total),
            "status": c.status.value,
            "resolution_notes": c.resolution_notes,
            "notes": c.notes,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })
    return results


@router.post("/damage-charges", status_code=201)
def create_damage_charge(payload: DamageChargeCreate, db: Session = Depends(get_db)):
    if not payload.player_id and not payload.player_name_override:
        raise HTTPException(status_code=400, detail="Either player_id or player_name_override must be provided")

    date_str = payload.damage_date.strftime("%Y%m%d")
    count = db.query(DamageCharge).filter(DamageCharge.reference.like(f"DMG-{date_str}-%")).count()
    reference = f"DMG-{date_str}-{count + 1:04d}"

    charge = DamageCharge(
        reference=reference,
        damage_date=payload.damage_date,
        player_id=payload.player_id,
        player_name_override=payload.player_name_override,
        damaged_item=payload.damaged_item,
        description=payload.description,
        charge_amount_paise=payload.charge_amount_paise,
        collected_paise=0,
        status=DamageStatus.OUTSTANDING,
        notes=payload.notes,
        created_by="Admin",
    )
    db.add(charge)
    db.commit()
    db.refresh(charge)
    return {"message": "Damage charge recorded", "reference": reference, "id": charge.id}


@router.post("/damage-charges/{charge_id}/payments", status_code=201)
def record_damage_payment(charge_id: int, payload: DamagePaymentCreate, db: Session = Depends(get_db)):
    charge = db.query(DamageCharge).filter(DamageCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Damage charge not found")
    if charge.status in (DamageStatus.WAIVED, DamageStatus.WRITTEN_OFF):
        raise HTTPException(status_code=400, detail=f"Charge is already {charge.status.value}")

    # Calculate current outstanding
    paid_so_far = db.query(
        func.coalesce(func.sum(DamagePayment.amount_paise), 0)
    ).filter(DamagePayment.damage_charge_id == charge_id).scalar() or 0
    outstanding = charge.charge_amount_paise - paid_so_far

    if payload.amount_paise > outstanding:
        raise HTTPException(
            status_code=400,
            detail=f"Payment {payload.amount_paise} exceeds outstanding balance {outstanding}",
        )

    date_str = payload.payment_date.strftime("%Y%m%d")
    count = db.query(DamagePayment).filter(DamagePayment.reference.like(f"DPAY-{date_str}-%")).count()
    ref = f"DPAY-{date_str}-{count + 1:04d}"

    acct_code = "1001"
    acct_name = "Cash in Hand"
    if payload.account_id:
        fa = db.query(FinancialAccount).filter(FinancialAccount.id == payload.account_id).first()
        if fa:
            acct_code = fa.code
            acct_name = fa.name

    payment = DamagePayment(
        reference=ref,
        damage_charge_id=charge_id,
        payment_date=payload.payment_date,
        amount_paise=payload.amount_paise,
        payment_method=payload.payment_method,
        account_id=payload.account_id,
        notes=payload.notes,
    )
    db.add(payment)
    db.flush()

    # Post journal: DR Cash/Bank, CR Damage Recovery Income
    entry = JournalService.post_entry(
        db,
        entry_date=payload.payment_date,
        description=f"Damage recovery from {charge.reference} ({ref})",
        lines=[
            JournalLineInput(acct_code, acct_name, True, payload.amount_paise),
            JournalLineInput("4040", "Damage Charge Recoveries", False, payload.amount_paise),
        ],
        source_type="damage_payment",
        source_id=payment.id,
    )
    payment.journal_entry_id = entry.id

    # Update charge status
    new_total = paid_so_far + payload.amount_paise
    charge.collected_paise = new_total
    if new_total >= charge.charge_amount_paise:
        charge.status = DamageStatus.RECOVERED
    elif new_total > 0:
        charge.status = DamageStatus.PARTIAL

    db.commit()
    return {"message": "Damage payment recorded", "reference": ref}


@router.post("/damage-charges/{charge_id}/resolve", status_code=200)
def resolve_damage_charge(charge_id: int, payload: DamageWaiveRequest, db: Session = Depends(get_db)):
    charge = db.query(DamageCharge).filter(DamageCharge.id == charge_id).first()
    if not charge:
        raise HTTPException(status_code=404, detail="Damage charge not found")

    charge.status = payload.status
    charge.resolution_notes = payload.resolution_notes
    from datetime import date as d_
    charge.resolved_at = d_.today()
    db.commit()
    return {"message": f"Damage charge marked as {payload.status.value}"}


@router.get("/damage-charges/{charge_id}/payments")
def list_damage_payments(charge_id: int, db: Session = Depends(get_db)):
    payments = db.query(DamagePayment).filter(
        DamagePayment.damage_charge_id == charge_id
    ).order_by(desc(DamagePayment.payment_date)).all()
    return [
        {
            "id": p.id,
            "reference": p.reference,
            "payment_date": p.payment_date.isoformat(),
            "amount_paise": p.amount_paise,
            "payment_method": p.payment_method,
            "notes": p.notes,
        }
        for p in payments
    ]
