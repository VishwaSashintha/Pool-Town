from __future__ import annotations

import math
from dataclasses import dataclass


POOL_BASE_PAISE = 50_000
POOL_BLOCK_PAISE = 30_000
POOL_BASE_THRESHOLD_MINUTES = 60
POOL_BLOCK_MINUTES = 30

PS4_1P_HOURLY_PAISE = 40_000
PS4_2P_HOURLY_PAISE = 50_000


def calculate_pool_charge(
    duration_minutes: int,
    base_paise: int = POOL_BASE_PAISE,
    block_paise: int = POOL_BLOCK_PAISE,
    base_threshold_minutes: int = POOL_BASE_THRESHOLD_MINUTES,
    block_minutes: int = POOL_BLOCK_MINUTES,
) -> int:


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


    durations = [30, 60, 90, 120, 150, 180, 210, 240]
    return [
        {
            "minutes": m,
            "label": _format_duration(m),
            "charge_paise": calculate_pool_charge(m),
        }
        for m in durations
    ]


def calculate_ps4_charge(
    duration_minutes: int,
    num_players: int,
    rate_1p_paise: int = PS4_1P_HOURLY_PAISE,
    rate_2p_paise: int = PS4_2P_HOURLY_PAISE,
) -> int:


    if duration_minutes <= 0:
        raise ValueError(f"Duration must be positive, got {duration_minutes}")
    if num_players not in (1, 2):
        raise ValueError(f"num_players must be 1 or 2, got {num_players}")

    rate = rate_1p_paise if num_players == 1 else rate_2p_paise
    hours = math.ceil(duration_minutes / 60)
    return hours * rate


def get_ps4_standard_durations(num_players: int = 1) -> list[dict]:


    durations = [30, 60, 90, 120, 150, 180, 240]
    return [
        {
            "minutes": m,
            "label": _format_duration(m),
            "charge_paise": calculate_ps4_charge(m, num_players),
        }
        for m in durations
    ]


def _format_duration(minutes: int) -> str:

    hours = minutes // 60
    mins = minutes % 60
    if hours == 0:
        return f"{mins} min"
    elif mins == 0:
        return f"{hours} hr"
    else:
        return f"{hours} hr {mins} min"


def apply_discount(charge_paise: int, discount_paise: int) -> int:


    if charge_paise < 0:
        raise ValueError(f"Charge must be non-negative, got {charge_paise}")
    if discount_paise < 0:
        raise ValueError(f"Discount must be non-negative, got {discount_paise}")
    return max(0, charge_paise - discount_paise)


@dataclass
class SessionCharge:

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


def get_pricing_rates(db) -> dict[str, int]:

    import json
    from app.models.audit import AppSetting

    def _read_int(key: str, default: int) -> int:
        s = db.query(AppSetting).filter(AppSetting.key == key).first()
        if not s:
            return default
        try:
            val = json.loads(s.value)
            return int(val) if val is not None else default
        except Exception:
            return default

    return {
        "pool_base_charge_paise": _read_int("pool_base_charge_paise", POOL_BASE_PAISE),
        "pool_block_charge_paise": _read_int("pool_block_charge_paise", POOL_BLOCK_PAISE),
        "ps4_1player_rate_paise": _read_int("ps4_1player_rate_paise", PS4_1P_HOURLY_PAISE),
        "ps4_2players_rate_paise": _read_int("ps4_2players_rate_paise", PS4_2P_HOURLY_PAISE),
    }
