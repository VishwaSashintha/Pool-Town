from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class FinancialAccountResponse(BaseModel):
    id: int
    code: str
    name: str
    account_type: str
    description: Optional[str] = None
    is_active: bool
    current_balance_paise: Optional[int] = 0

    model_config = {"from_attributes": True}


class AccountTransferCreate(BaseModel):
    transfer_date: date
    from_account_id: int
    to_account_id: int
    amount_paise: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=500)


class AccountTransferResponse(BaseModel):
    id: int
    reference: str
    transfer_date: date
    from_account_id: int
    from_account_code: str
    from_account_name: str
    to_account_id: int
    to_account_code: str
    to_account_name: str
    amount_paise: int
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TrialBalanceResponse(BaseModel):
    account_code: str
    account_name: str
    total_debit_paise: int
    total_credit_paise: int
    net_balance_paise: int


class CashCountCreate(BaseModel):
    count_date: date
    counted_paise: int = Field(ge=0)
    notes: Optional[str] = None
    investigated_by: Optional[str] = None


class CashCountResponse(BaseModel):
    id: int
    count_date: date
    account_id: int
    account_code: str
    account_name: str
    counted_paise: int
    expected_paise: int
    difference_paise: int
    notes: Optional[str] = None
    investigated_by: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BankReconciliationCreate(BaseModel):
    reconciliation_date: date
    account_id: int
    statement_balance_paise: int
    notes: Optional[str] = None


class BankReconciliationResponse(BaseModel):
    id: int
    reconciliation_date: date
    account_id: int
    account_code: str
    account_name: str
    statement_balance_paise: int
    book_balance_paise: int
    difference_paise: int
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class AccountingPeriodResponse(BaseModel):
    id: int
    year: int
    month: int
    is_closed: bool
    closed_at: Optional[datetime] = None
    closed_by: Optional[str] = None
    reopen_reason: Optional[str] = None
    reopened_by: Optional[str] = None

    model_config = {"from_attributes": True}


class PeriodCloseRequest(BaseModel):
    closed_by: Optional[str] = "Admin"


class PeriodReopenRequest(BaseModel):
    reason: str = Field(min_length=5, max_length=500)
    reopened_by: Optional[str] = "Admin"


class OpeningBalanceItem(BaseModel):
    account_code: str
    amount_paise: int = Field(gt=0)
    is_debit: bool  # True = Debit (Asset), False = Credit (Liability/Equity)


class OpeningBalanceCreate(BaseModel):
    effective_date: date = Field(default=date(2025, 12, 31))
    items: list[OpeningBalanceItem]
    notes: Optional[str] = "Opening Balance as of 31 Dec 2025"

