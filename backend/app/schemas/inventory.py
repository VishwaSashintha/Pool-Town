from typing import Optional
from pydantic import BaseModel, Field


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category_id: Optional[int] = None
    unit: str = Field(default="bottle", max_length=50)
    selling_price_paise: int = Field(ge=0)
    average_cost_paise: int = Field(default=0, ge=0)
    reorder_level: int = Field(default=10, ge=0)


class ProductCreate(ProductBase):
    opening_stock: int = Field(default=0, ge=0)


class ProductResponse(ProductBase):
    id: int
    current_stock: int
    is_active: bool

    model_config = {"from_attributes": True}
