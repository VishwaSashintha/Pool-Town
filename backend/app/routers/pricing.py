from fastapi import APIRouter, HTTPException
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
)

router = APIRouter(prefix="/api/pricing", tags=["Pricing"])


@router.post("/pool/calculate", response_model=PoolPricingResponse)
def calculate_pool(req: PoolPricingRequest):
    try:
        standard_paise = calculate_pool_charge(req.chargeable_minutes)
        final_paise = apply_discount(standard_paise, req.discount_paise)

        # Build readable calculation breakdown
        if req.chargeable_minutes <= 60:
            breakdown = "Base rate: Rs. 500 for up to 60 mins"
        else:
            full_hours = req.chargeable_minutes // 60
            rem = req.chargeable_minutes % 60
            if rem == 0:
                breakdown = f"{full_hours} hour(s) @ Rs. 500/hr = Rs. {standard_paise // 100}"
            elif rem <= 30:
                breakdown = f"{full_hours} hr(s) @ Rs. 500/hr + 30-min block @ Rs. 300 = Rs. {standard_paise // 100}"
            else:
                breakdown = f"{full_hours + 1} hr(s) @ Rs. 500/hr = Rs. {standard_paise // 100}"

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
def calculate_ps4(req: PS4PricingRequest):
    try:
        standard_paise = calculate_ps4_charge(req.minutes, req.player_count)
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
