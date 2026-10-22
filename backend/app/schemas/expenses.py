from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class ExpenseCategoryResponse(BaseModel):
    id: int
    name: str
    account_code: Optional[str] = None
    description: Optional[str] = None
    is_active: bool

    model_config = {"from_attributes": True}


class ExpenseCreate(BaseModel):
    expense_date: date
    category_id: int
    description: str = Field(min_length=1, max_length=500)
    amount_paise: int = Field(gt=0)
    payee: Optional[str] = None
    is_asset: bool = False
    asset_account_code: Optional[str] = None
    notes: Optional[str] = None


class ExpenseResponse(BaseModel):
    id: int
    reference: str
    expense_date: date
    category_id: int
    category_name: Optional[str] = None
    description: str
    amount_paise: int
    payee: Optional[str] = None
    status: str
    paid_amount_paise: int
    is_asset: bool
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}
