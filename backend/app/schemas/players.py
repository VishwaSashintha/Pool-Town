from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class PlayerBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=50)
    email: Optional[str] = Field(default=None, max_length=200)
    notes: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class PlayerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class PlayerResponse(PlayerBase):
    id: int
    is_active: bool
    total_sessions: Optional[int] = 0
    total_charges_paise: Optional[int] = 0
    total_paid_paise: Optional[int] = 0
    outstanding_balance_paise: Optional[int] = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
