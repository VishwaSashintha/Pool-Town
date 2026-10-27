import json
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.audit import AppSetting, AuditLog
from app.schemas.pricing import (
    PoolPricingRequest,
    PoolPricingResponse,
    PS4PricingRequest,
    PS4PricingResponse,
)
from app.services.pricing import (
    calculate_pool_charge,
    calculate_ps4_charge,
    apply_discount,
    get_pricing_rates,
)
from app.routers.sessions import _verify_admin_credentials

router = APIRouter(prefix="/api/pricing", tags=["Pricing"])


class PricingRatesResponse(BaseModel):
    pool_base_charge_paise: int
    pool_block_charge_paise: int
    ps4_1player_rate_paise: int
    ps4_2players_rate_paise: int


class PricingRatesUpdate(BaseModel):
    admin_username: str
    admin_password: str
    pool_base_charge_paise: Optional[int] = Field(None, ge=0)
    pool_block_charge_paise: Optional[int] = Field(None, ge=0)
    ps4_1player_rate_paise: Optional[int] = Field(None, ge=0)
    ps4_2players_rate_paise: Optional[int] = Field(None, ge=0)


def _set_setting(db: Session, key: str, value: int, description: str, updated_by: str) -> None:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    json_val = json.dumps(value)
    if setting:
        setting.value = json_val
        setting.updated_at = datetime.now(timezone.utc)
        setting.updated_by = updated_by
    else:
        db.add(AppSetting(
            key=key,
            value=json_val,
            description=description,
            updated_by=updated_by,
        ))


@router.get("/rates", response_model=PricingRatesResponse)
def get_rates(db: Session = Depends(get_db)):
    """Fetch current active pricing rates for Pool and PS4."""
    rates = get_pricing_rates(db)
    return PricingRatesResponse(**rates)


@router.put("/rates", response_model=PricingRatesResponse)
def update_rates(payload: PricingRatesUpdate, db: Session = Depends(get_db)):
    """
    Update Pool and PS4 rates. Requires admin credentials.
    Future sessions will use the updated rates; historical records remain untouched.
    """
    _verify_admin_credentials(db, payload.admin_username, payload.admin_password)

    changes = []
    if payload.pool_base_charge_paise is not None:
        _set_setting(db, "pool_base_charge_paise", payload.pool_base_charge_paise, "Pool table base charge up to 60 mins (paise)", payload.admin_username)
        changes.append(f"Pool base: Rs. {payload.pool_base_charge_paise / 100:.2f}")

    if payload.pool_block_charge_paise is not None:
        _set_setting(db, "pool_block_charge_paise", payload.pool_block_charge_paise, "Pool table charge per 30 mins after 60 mins (paise)", payload.admin_username)
        changes.append(f"Pool block: Rs. {payload.pool_block_charge_paise / 100:.2f}")

    if payload.ps4_1player_rate_paise is not None:
        _set_setting(db, "ps4_1player_rate_paise", payload.ps4_1player_rate_paise, "PS4 1-player hourly rate (paise)", payload.admin_username)
        changes.append(f"PS4 1P: Rs. {payload.ps4_1player_rate_paise / 100:.2f}")

    if payload.ps4_2players_rate_paise is not None:
        _set_setting(db, "ps4_2players_rate_paise", payload.ps4_2players_rate_paise, "PS4 2-player hourly rate (paise)", payload.admin_username)
        changes.append(f"PS4 2P: Rs. {payload.ps4_2players_rate_paise / 100:.2f}")

    if changes:
        db.add(AuditLog(
            entity_type="pricing_rates",
            entity_id=0,
            action="update_rates",
            description=f"Updated rates: {', '.join(changes)}",
            user=payload.admin_username,
        ))
        db.commit()

    return PricingRatesResponse(**get_pricing_rates(db))


@router.post("/pool/calculate", response_model=PoolPricingResponse)
def calculate_pool(req: PoolPricingRequest, db: Session = Depends(get_db)):
    try:
        rates = get_pricing_rates(db)
        base_paise = rates["pool_base_charge_paise"]
        block_paise = rates["pool_block_charge_paise"]
        base_rs = base_paise // 100
        block_rs = block_paise // 100

        standard_paise = calculate_pool_charge(
            req.chargeable_minutes,
            base_paise=base_paise,
            block_paise=block_paise,
        )
        final_paise = apply_discount(standard_paise, req.discount_paise)

        # Build readable calculation breakdown
        if req.chargeable_minutes <= 60:
            breakdown = f"Base rate: Rs. {base_rs} for up to 60 mins"
        else:
            full_hours = req.chargeable_minutes // 60
            rem = req.chargeable_minutes % 60
            if rem == 0:
                breakdown = f"{full_hours} hour(s) @ Rs. {base_rs}/hr = Rs. {standard_paise // 100}"
            elif rem <= 30:
                breakdown = f"{full_hours} hr(s) @ Rs. {base_rs}/hr + 30-min block @ Rs. {block_rs} = Rs. {standard_paise // 100}"
            else:
                breakdown = f"{full_hours + 1} hr(s) @ Rs. {base_rs}/hr = Rs. {standard_paise // 100}"

        if req.discount_paise > 0:
            breakdown += f" (Discount applied: Rs. {req.discount_paise / 100:.2f})"

        return PoolPricingResponse(
            duration_minutes=req.chargeable_minutes,
            standard_charge_paise=standard_paise,
            discount_paise=req.discount_paise,
            final_charge_paise=final_paise,
            calculation_breakdown=breakdown,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/ps4/calculate", response_model=PS4PricingResponse)
def calculate_ps4(req: PS4PricingRequest, db: Session = Depends(get_db)):
    try:
        rates = get_pricing_rates(db)
        rate_1p = rates["ps4_1player_rate_paise"]
        rate_2p = rates["ps4_2players_rate_paise"]

        standard_paise = calculate_ps4_charge(
            req.minutes,
            req.player_count,
            rate_1p_paise=rate_1p,
            rate_2p_paise=rate_2p,
        )
        final_paise = apply_discount(standard_paise, req.discount_paise)

        return PS4PricingResponse(
            duration_minutes=req.minutes,
            player_count=req.player_count,
            standard_charge_paise=standard_paise,
            discount_paise=req.discount_paise,
            final_charge_paise=final_paise,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
