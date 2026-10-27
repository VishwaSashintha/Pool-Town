from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel, Field


class OwnerResponse(BaseModel):
    id: int
    name: str
    profit_share_bps: int
    profit_share_percent: str
    capital_account_code: str
    capital_balance_paise: int
    distribution_account_code: str
    distributions_total_paise: int
    owner_loan_balance_paise: int

    model_config = {"from_attributes": True}


class OwnerTransactionCreate(BaseModel):
    owner_id: int
    transaction_date: date
    transaction_type: str  # initial_capital, additional_capital, withdrawal, distribution, advance
    amount_paise: int = Field(gt=0)
    account_id: int  # 1 (Cash) or 2 (Bank)
    description: str = Field(min_length=2, max_length=500)
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    notes: Optional[str] = None


class OwnerTransactionResponse(BaseModel):
    id: int
    reference: str
    owner_id: int
    owner_name: str
    transaction_date: date
    transaction_type: str
    amount_paise: int
    account_id: Optional[int] = None
    account_name: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    description: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class PartnerMonthlyDetail(BaseModel):
    owner_id: int
    owner_name: str
    profit_share_percent: str
    capital_balance_paise: int
    monthly_allocation_paise: int
    advances_paid_paise: int
    distributions_paid_paise: int
    remaining_payable_paise: int


class PartnerMonthlyDistributionSummary(BaseModel):
    year: int
    month: int
    period_label: str
    net_profit_paise: int
    savings_allocation_paise: int
    total_partner_allocations_paise: int
    total_advances_paid_paise: int
    total_distributions_paid_paise: int
    total_remaining_payable_paise: int
    partners: list[PartnerMonthlyDetail]



class LoanCreate(BaseModel):
    lender_name: str = Field(min_length=2, max_length=200)
    loan_type: str  # bank, external, owner
    original_principal_paise: int = Field(gt=0)
    start_date: date
    interest_rate_bps: int = Field(ge=0, default=0)
    repayment_terms: Optional[str] = None
    owner_id: Optional[int] = None
    disburse_to_account_id: Optional[int] = None  # Cash 1001 or Bank 1002
    notes: Optional[str] = None


class LoanResponse(BaseModel):
    id: int
    reference: str
    lender_name: str
    loan_type: str
    original_principal_paise: int
    current_outstanding_paise: int
    start_date: date
    interest_rate_bps: int
    repayment_terms: Optional[str] = None
    status: str
    owner_id: Optional[int] = None
    owner_name: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LoanRepaymentCreate(BaseModel):
    repayment_date: date
    principal_amount_paise: int = Field(ge=0, default=0)
    interest_amount_paise: int = Field(ge=0, default=0)
    account_id: int  # Cash 1001 or Bank 1002
    notes: Optional[str] = None


class LoanTransactionResponse(BaseModel):
    id: int
    reference: str
    loan_id: int
    transaction_date: date
    transaction_type: str
    amount_paise: int
    account_id: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ProfitAllocationPreview(BaseModel):
    year: int
    month: int
    period_label: str
    revenue_paise: int
    cogs_paise: int
    expenses_paise: int
    net_distributable_profit_paise: int
    savings_share_paise: int
    akash_share_paise: int
    pasan_share_paise: int
    vishwa_share_paise: int
    is_already_posted: bool = False


class ProfitAllocationPost(BaseModel):
    year: int
    month: int
    approved_by: str = Field(default="Owners (Akash, Pasan, Vishwa)")
    notes: Optional[str] = None


class OwnerCollectionCreate(BaseModel):
    collector_name: str = Field(min_length=1, max_length=100)
    owner_id: Optional[int] = None
    collection_date: date
    amount_paise: Optional[int] = Field(default=None, ge=1)
    destination_account_id: int
    source_category: str = Field(min_length=1, max_length=100)
    notes: Optional[str] = None
    is_unknown_amount: bool = False


class OwnerCollectionConfirm(BaseModel):
    amount_paise: int = Field(gt=0)
    notes: Optional[str] = None
    confirmed_date: Optional[date] = None


class OwnerCollectionUpdate(BaseModel):
    notes: Optional[str] = None
    source_category: Optional[str] = None
    destination_account_id: Optional[int] = None


class OwnerCollectionResponse(BaseModel):
    id: int
    reference: str
    collector_name: str
    owner_id: Optional[int] = None
    collection_date: date
    amount_paise: Optional[int] = None
    status: str
    destination_account_id: int
    destination_account_name: Optional[str] = None
    source_category: str
    notes: Optional[str] = None
    created_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    journal_entry_id: Optional[int] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

