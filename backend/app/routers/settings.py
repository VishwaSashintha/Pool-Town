"""
Settings router — Business profile, formatting preferences, and receipt configurations.
Stores persistent business configuration in the AppSetting table.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AppSetting, AuditLog
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/settings", tags=["Settings"])


def _get_val(db: Session, key: str, default: str = "") -> str:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not setting:
        return default
    try:
        val = json.loads(setting.value)
        return str(val) if val is not None else default
    except Exception:
        return setting.value or default


def _set_val(db: Session, key: str, value: str, description: str = "", username: str = "system") -> None:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    json_val = json.dumps(value)
    if setting:
        setting.value = json_val
        setting.updated_at = datetime.now(timezone.utc)
        setting.updated_by = username
    else:
        db.add(AppSetting(
            key=key,
            value=json_val,
            description=description,
            updated_by=username,
        ))


class BusinessProfileResponse(BaseModel):
    business_name: str
    business_address: str
    business_phone: str
    business_email: str
    business_tax_number: str
    currency_code: str
    currency_symbol: str
    timezone: str
    date_format: str
    receipt_header: str
    receipt_footer: str


class BusinessProfileUpdate(BaseModel):
    business_name: Optional[str] = None
    business_address: Optional[str] = None
    business_phone: Optional[str] = None
    business_email: Optional[str] = None
    business_tax_number: Optional[str] = None
    currency_code: Optional[str] = None
    currency_symbol: Optional[str] = None
    timezone: Optional[str] = None
    date_format: Optional[str] = None
    receipt_header: Optional[str] = None
    receipt_footer: Optional[str] = None


@router.get("/profile", response_model=BusinessProfileResponse)
def get_business_profile(db: Session = Depends(get_db)):
    """Fetch current business profile and preferences."""
    return BusinessProfileResponse(
        business_name=_get_val(db, "business_name", "Pool Town"),
        business_address=_get_val(db, "business_address", ""),
        business_phone=_get_val(db, "business_phone", ""),
        business_email=_get_val(db, "business_email", ""),
        business_tax_number=_get_val(db, "business_tax_number", ""),
        currency_code=_get_val(db, "currency_code", "LKR"),
        currency_symbol=_get_val(db, "currency_symbol", "Rs."),
        timezone=_get_val(db, "timezone", "Asia/Colombo"),
        date_format=_get_val(db, "date_format", "YYYY-MM-DD"),
        receipt_header=_get_val(db, "receipt_header", "Thank you for visiting Pool Town!"),
        receipt_footer=_get_val(db, "receipt_footer", "Please come again."),
    )


@router.put("/profile", response_model=BusinessProfileResponse)
def update_business_profile(
    payload: BusinessProfileUpdate,
    db: Session = Depends(get_db),
    current_user: str = Depends(get_current_user),
):
    """
    Update business profile and preferences.
    Requires authentication.
    """
    if payload.business_name is not None and payload.business_name.strip():
        _set_val(db, "business_name", payload.business_name.strip(), "Official Business Name", current_user)
    if payload.business_address is not None:
        _set_val(db, "business_address", payload.business_address.strip(), "Business Address", current_user)
    if payload.business_phone is not None:
        _set_val(db, "business_phone", payload.business_phone.strip(), "Contact Telephone", current_user)
    if payload.business_email is not None:
        _set_val(db, "business_email", payload.business_email.strip(), "Contact Email", current_user)
    if payload.business_tax_number is not None:
        _set_val(db, "business_tax_number", payload.business_tax_number.strip(), "Business Registration / Tax ID", current_user)
    if payload.currency_code is not None and payload.currency_code.strip():
        _set_val(db, "currency_code", payload.currency_code.strip(), "Standard Currency Code", current_user)
    if payload.currency_symbol is not None and payload.currency_symbol.strip():
        _set_val(db, "currency_symbol", payload.currency_symbol.strip(), "Currency Symbol", current_user)
    if payload.timezone is not None and payload.timezone.strip():
        _set_val(db, "timezone", payload.timezone.strip(), "Operating Timezone", current_user)
    if payload.date_format is not None and payload.date_format.strip():
        _set_val(db, "date_format", payload.date_format.strip(), "Date Format Preference", current_user)
    if payload.receipt_header is not None:
        _set_val(db, "receipt_header", payload.receipt_header.strip(), "Receipt Header Message", current_user)
    if payload.receipt_footer is not None:
        _set_val(db, "receipt_footer", payload.receipt_footer.strip(), "Receipt Footer Message", current_user)

    db.add(AuditLog(
        entity_type="settings",
        entity_id=0,
        action="update_profile",
        description="Updated business profile settings",
        user=current_user,
    ))
    db.commit()

    return get_business_profile(db)
