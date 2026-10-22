"""
Monetary arithmetic utilities.
All amounts are in INTEGER PAISE (1 LKR = 100 paise).
Use Decimal for intermediate calculations; always convert to int for storage.

NEVER use float for money.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Union


def paise_to_rupees(paise: int) -> Decimal:
    """Convert integer paise to Decimal rupees."""
    return Decimal(paise) / Decimal(100)


def rupees_to_paise(rupees: Union[Decimal, str, int]) -> int:
    """Convert rupees (Decimal/str/int) to integer paise, rounding half-up."""
    d = Decimal(str(rupees))
    return int((d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def format_lkr(paise: int) -> str:
    """Format paise as a display string: 'Rs. X,XXX.XX'"""
    rupees = paise_to_rupees(paise)
    # Format with thousand separator and 2 decimal places
    return f"Rs. {rupees:,.2f}"


def add_paise(*amounts: int) -> int:
    """Add multiple paise amounts safely."""
    return sum(amounts)


def percentage_of_paise(paise: int, percentage_bps: int) -> int:
    """
    Calculate percentage of a paise amount.
    percentage_bps: basis points (10000 = 100%, 2000 = 20%, 4000 = 40%)
    Returns integer paise, rounded half-up.
    """
    result = Decimal(paise) * Decimal(percentage_bps) / Decimal(10000)
    return int(result.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_journal_balance(debits: list[int], credits: list[int]) -> bool:
    """
    Validate that total debits equal total credits.
    Returns True if balanced, False otherwise.
    All amounts must be positive integers (paise).
    """
    return sum(debits) == sum(credits)


def allocate_profit(
    net_profit_paise: int,
    allocations: dict[str, int],  # recipient -> basis_points
) -> dict[str, int]:
    """
    Calculate profit allocation in paise.
    allocations: e.g., {'savings': 4000, 'akash': 2000, 'pasan': 2000, 'vishwa': 2000}
    Total basis points must equal 10000 (100%).
    
    The LAST recipient receives the remainder to avoid rounding errors.
    Per DECISIONS.md D-009: Vishwa receives the remainder.
    
    Returns dict of recipient -> paise amount.
    """
    total_bps = sum(allocations.values())
    if total_bps != 10000:
        raise ValueError(f"Allocation percentages must total 10000 basis points, got {total_bps}")
    
    result: dict[str, int] = {}
    allocated = 0
    recipients = list(allocations.items())
    
    for recipient, bps in recipients[:-1]:
        amount = percentage_of_paise(net_profit_paise, bps)
        result[recipient] = amount
        allocated += amount
    
    # Last recipient gets the remainder (no rounding error)
    last_recipient = recipients[-1][0]
    result[last_recipient] = net_profit_paise - allocated
    
    return result


def update_weighted_average_cost(
    current_qty: int,
    current_avg_cost_paise: int,
    purchase_qty: int,
    purchase_unit_cost_paise: int,
) -> int:
    """
    Calculate new weighted average cost after a purchase.
    Returns new average cost per unit in paise, rounded half-up.
    """
    total_units = current_qty + purchase_qty
    if total_units == 0:
        return 0
    total_value = Decimal(current_qty * current_avg_cost_paise) + Decimal(purchase_qty * purchase_unit_cost_paise)
    avg = total_value / Decimal(total_units)
    return int(avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
