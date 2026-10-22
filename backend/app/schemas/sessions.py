from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field

from app.schemas.players import PlayerResponse


class PoolSessionCreate(BaseModel):
    session_date: date
    player_id: Optional[int] = None
    customer_name: Optional[str] = None
    chargeable_minutes: int = Field(gt=0)
    actual_minutes: Optional[int] = None
    custom_standard_charge_paise: Optional[int] = None
    discount_paise: int = Field(default=0, ge=0)
    initial_payment_paise: int = Field(default=0, ge=0)
    initial_payment_method: str = "cash"
    initial_payment_account_id: Optional[int] = None
    notes: Optional[str] = None


class PoolSessionResponse(BaseModel):
    id: int
    reference: str
    session_date: date
    player_id: Optional[int] = None
    player: Optional[PlayerResponse] = None
    customer_name: Optional[str] = None
    actual_minutes: int
    chargeable_minutes: int
    standard_charge_paise: int
    discount_paise: int
    final_charge_paise: int
    paid_amount_paise: int
    outstanding_paise: int
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PS4SessionCreate(BaseModel):
    session_date: date
    player_count: int = Field(ge=1, le=2)
    player1_id: Optional[int] = None
    player2_id: Optional[int] = None
    customer_name: Optional[str] = None
    minutes: int = Field(gt=0)
    discount_paise: int = Field(default=0, ge=0)
    initial_payment_paise: int = Field(default=0, ge=0)
    initial_payment_method: str = "cash"
    initial_payment_account_id: Optional[int] = None
    notes: Optional[str] = None


class PS4SessionResponse(BaseModel):
    id: int
    reference: str
    session_date: date
    player_count: int
    player1_id: Optional[int] = None
    player1: Optional[PlayerResponse] = None
    player2_id: Optional[int] = None
    player2: Optional[PlayerResponse] = None
    customer_name: Optional[str] = None
    minutes: int
    standard_charge_paise: int
    discount_paise: int
    final_charge_paise: int
    paid_amount_paise: int
    outstanding_paise: int
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
