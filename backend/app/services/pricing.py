"""
Pricing service — authoritative pool and PS4 charge calculations.
All amounts in INTEGER PAISE (1 LKR = 100 paise).

See docs/ACCOUNTING_RULES.md for formulas.
See docs/DECISIONS.md D-001 for the 3-hour pricing discrepancy resolution.
"""
from __future__ import annotations

import math
from dataclasses import dataclass


# ── Default pricing constants (paise) ────────────────────────────────────────

POOL_BASE_PAISE = 50_000         # Rs. 500 for first 60 minutes
POOL_BLOCK_PAISE = 30_000        # Rs. 300 per additional 30-minute block
POOL_BASE_THRESHOLD_MINUTES = 60
POOL_BLOCK_MINUTES = 30

PS4_1P_HOURLY_PAISE = 40_000     # Rs. 400/hour for 1 player
PS4_2P_HOURLY_PAISE = 50_000     # Rs. 500/hour for 2 players


# ── Pool pricing ─────────────────────────────────────────────────────────────

def calculate_pool_charge(
    duration_minutes: int,
    base_paise: int = POOL_BASE_PAISE,
    block_paise: int = POOL_BLOCK_PAISE,
    base_threshold_minutes: int = POOL_BASE_THRESHOLD_MINUTES,
    block_minutes: int = POOL_BLOCK_MINUTES,
) -> int:
    """
    Calculate pool session charge in paise.

    Correct pricing rules:
    - 1 hour (60 min)          = Rs. 500   (50,000 paise)
    - 1 hour 30 min (90 min)   = Rs. 800   (80,000 paise)
    - 2 hours (120 min)        = Rs. 1,000 (100,000 paise)
    - 2 hours 30 min (150 min) = Rs. 1,300 (130,000 paise)
    - 3 hours (180 min)        = Rs. 1,500 (150,000 paise)
    - 3 hours 30 min (210 min) = Rs. 1,800 (180,000 paise)
    - 4 hours (240 min)        = Rs. 2,000 (200,000 paise)

    Pricing formula:
    - First 1 hour costs Rs. 500 (base_paise).
    - Every additional 30 minutes costs Rs. 300 (block_paise).
    - Each full hour is charged at Rs. 500/hr.
    - Additional duration up to 30 minutes adds Rs. 300.
    - Any additional duration beyond 30 minutes rounds up to the next full hour.

    Args:
        duration_minutes: total playing duration (must be > 0)
        base_paise: charge for first base_threshold_minutes (Rs. 500)
        block_paise: charge per additional 30-min block (Rs. 300)
        base_threshold_minutes: minutes included in base charge (60 min)
        block_minutes: size of each additional block (30 min)

    Returns:
        Charge in integer paise.

    Raises:
        ValueError: if duration_minutes <= 0 or negative rates passed
    """
    if duration_minutes <= 0:
        raise ValueError(f"Duration must be positive, got {duration_minutes}")
    if base_paise < 0:
        raise ValueError(f"Base charge must be non-negative, got {base_paise}")
    if block_paise < 0:
        raise ValueError(f"Block charge must be non-negative, got {block_paise}")

    if duration_minutes <= base_threshold_minutes:
        return base_paise

    full_hours = duration_minutes // base_threshold_minutes
    rem_minutes = duration_minutes % base_threshold_minutes

    if rem_minutes == 0:
        return full_hours * base_paise
    elif rem_minutes <= block_minutes:
        return full_hours * base_paise + block_paise
    else:
        return (full_hours + 1) * base_paise


def get_pool_standard_durations() -> list[dict]:
    """
    Return standard selectable pool durations with pre-calculated charges.
    """
    durations = [30, 60, 90, 120, 150, 180, 210, 240]
    return [
        {
            "minutes": m,
            "label": _format_duration(m),
            "charge_paise": calculate_pool_charge(m),
        }
        for m in durations
    ]


# ── PS4 pricing ──────────────────────────────────────────────────────────────

def calculate_ps4_charge(
    duration_minutes: int,
    num_players: int,
    rate_1p_paise: int = PS4_1P_HOURLY_PAISE,
    rate_2p_paise: int = PS4_2P_HOURLY_PAISE,
) -> int:
    """
    Calculate PS4 session charge in paise.

    Rule: hourly rate × ceil(duration_minutes / 60)
    Rates: 1 player = Rs. 400/hr, 2 players = Rs. 500/hr

    Args:
        duration_minutes: playing duration (must be > 0)
        num_players: 1 or 2
        rate_1p_paise: 1-player hourly rate in paise
        rate_2p_paise: 2-player hourly rate in paise

    Returns:
        Charge in integer paise.

    Raises:
        ValueError: if num_players not in {1, 2} or duration <= 0
    """
    if duration_minutes <= 0:
        raise ValueError(f"Duration must be positive, got {duration_minutes}")
    if num_players not in (1, 2):
        raise ValueError(f"num_players must be 1 or 2, got {num_players}")

    rate = rate_1p_paise if num_players == 1 else rate_2p_paise
    hours = math.ceil(duration_minutes / 60)
    return hours * rate


def get_ps4_standard_durations(num_players: int = 1) -> list[dict]:
    """
    Return standard selectable PS4 durations with pre-calculated charges.
    """
    durations = [30, 60, 90, 120, 150, 180, 240]
    return [
        {
            "minutes": m,
            "label": _format_duration(m),
            "charge_paise": calculate_ps4_charge(m, num_players),
        }
        for m in durations
    ]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_duration(minutes: int) -> str:
    """Format minutes into human-readable label: '30 min', '1 hr', '1 hr 30 min'."""
    hours = minutes // 60
    mins = minutes % 60
    if hours == 0:
        return f"{mins} min"
    elif mins == 0:
        return f"{hours} hr"
    else:
        return f"{hours} hr {mins} min"


def apply_discount(charge_paise: int, discount_paise: int) -> int:
    """
    Apply a discount to a charge. Final charge cannot be negative.
    
    Args:
        charge_paise: original charge (must be >= 0)
        discount_paise: discount to apply (must be >= 0)
    
    Returns:
        Final charge in paise (minimum 0).
    
    Raises:
        ValueError: if either value is negative.
    """
    if charge_paise < 0:
        raise ValueError(f"Charge must be non-negative, got {charge_paise}")
    if discount_paise < 0:
        raise ValueError(f"Discount must be non-negative, got {discount_paise}")
    return max(0, charge_paise - discount_paise)


@dataclass
class SessionCharge:
    """Result of a charge calculation with full breakdown."""
    standard_charge_paise: int
    discount_paise: int
    final_charge_paise: int

    @property
    def standard_charge_rupees(self) -> str:
        from app.utils.money import format_lkr
        return format_lkr(self.standard_charge_paise)

    @property
    def final_charge_rupees(self) -> str:
        from app.utils.money import format_lkr
        return format_lkr(self.final_charge_paise)
