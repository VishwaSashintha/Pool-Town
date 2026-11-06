from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import Union


def paise_to_rupees(paise: int) -> Decimal:

    return Decimal(paise) / Decimal(100)


def rupees_to_paise(rupees: Union[Decimal, str, int]) -> int:

    d = Decimal(str(rupees))
    return int((d * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def format_lkr(paise: int) -> str:

    rupees = paise_to_rupees(paise)

    return f"Rs. {rupees:,.2f}"


def add_paise(*amounts: int) -> int:

    return sum(amounts)


def percentage_of_paise(paise: int, percentage_bps: int) -> int:


    result = Decimal(paise) * Decimal(percentage_bps) / Decimal(10000)
    return int(result.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def validate_journal_balance(debits: list[int], credits: list[int]) -> bool:


    return sum(debits) == sum(credits)


def allocate_profit(
    net_profit_paise: int,
    allocations: dict[str, int],
) -> dict[str, int]:


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


    last_recipient = recipients[-1][0]
    result[last_recipient] = net_profit_paise - allocated

    return result


def update_weighted_average_cost(
    current_qty: int,
    current_avg_cost_paise: int,
    purchase_qty: int,
    purchase_unit_cost_paise: int,
) -> int:


    total_units = current_qty + purchase_qty
    if total_units == 0:
        return 0
    total_value = Decimal(current_qty * current_avg_cost_paise) + Decimal(purchase_qty * purchase_unit_cost_paise)
    avg = total_value / Decimal(total_units)
    return int(avg.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
