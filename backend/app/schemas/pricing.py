from pydantic import BaseModel, Field


class PoolPricingRequest(BaseModel):
    chargeable_minutes: int = Field(gt=0, description="Session duration in minutes")
    discount_paise: int = Field(default=0, ge=0, description="Discount amount in paise")


class PoolPricingResponse(BaseModel):
    duration_minutes: int
    standard_charge_paise: int
    discount_paise: int
    final_charge_paise: int
    calculation_breakdown: str


class PS4PricingRequest(BaseModel):
    minutes: int = Field(gt=0, description="Session duration in minutes")
    player_count: int = Field(ge=1, le=2, description="1 or 2 players")
    discount_paise: int = Field(default=0, ge=0, description="Discount amount in paise")


class PS4PricingResponse(BaseModel):
    duration_minutes: int
    player_count: int
    standard_charge_paise: int
    discount_paise: int
    final_charge_paise: int
