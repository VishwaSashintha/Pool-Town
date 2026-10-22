from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class SessionPaymentCreate(BaseModel):
    session_type: str = Field(pattern="^(pool|ps4)$")
    session_id: int = Field(gt=0)
    collection_date: date
    amount_paise: int = Field(gt=0, description="Amount paid in integer paise")
    payment_method: str = Field(default="cash", pattern="^(cash|bank_transfer|other)$")
    account_id: Optional[int] = None
    notes: Optional[str] = None


class SessionPaymentResponse(BaseModel):
    id: int
    reference: str
    session_type: str
    session_id: int
    collection_date: date
    amount_paise: int
    payment_method: str
    account_id: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
