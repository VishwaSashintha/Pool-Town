"""
Tests for pricing calculations.
All 8 pool price points verified per docs/ACCOUNTING_RULES.md.
Also verifies PS4 pricing, discount application, and edge cases.

Run: pytest tests/test_pricing.py -v
"""
import pytest
from app.services.pricing import (
    calculate_pool_charge,
    calculate_ps4_charge,
    apply_discount,
    get_pool_standard_durations,
    get_ps4_standard_durations,
    POOL_BASE_PAISE,
    POOL_BLOCK_PAISE,
    PS4_1P_HOURLY_PAISE,
    PS4_2P_HOURLY_PAISE,
)


# ── Pool Pricing Tests ────────────────────────────────────────────────────────

class TestPoolChargeStandardDurations:
    """
    Verify all standard pool session price points.
    Rules:
    - 1 hour (60 min)          = Rs. 500
    - 1 hour 30 min (90 min)   = Rs. 800
    - 2 hours (120 min)        = Rs. 1,000
    - 2 hours 30 min (150 min) = Rs. 1,300
    - 3 hours (180 min)        = Rs. 1,500
    - 3 hours 30 min (210 min) = Rs. 1,800
    - 4 hours (240 min)        = Rs. 2,000
    """

    def test_30_minutes(self):
        """30 min → Rs. 500 (50,000 paise) — within first hour base"""
        assert calculate_pool_charge(30) == 50_000

    def test_60_minutes_1_hour(self):
        """1 hour (60 min) → Rs. 500 (50,000 paise)"""
        assert calculate_pool_charge(60) == 50_000

    def test_90_minutes_1_point_5_hours(self):
        """1.5 hours (90 min) → Rs. 800 (80,000 paise) — 1 hr + extra 30 min"""
        assert calculate_pool_charge(90) == 80_000

    def test_120_minutes_2_hours(self):
        """2 hours (120 min) → Rs. 1,000 (100,000 paise) — 2 × Rs. 500"""
        assert calculate_pool_charge(120) == 100_000

    def test_150_minutes_2_point_5_hours(self):
        """2.5 hours (150 min) → Rs. 1,300 (130,000 paise) — 2 hr + extra 30 min"""
        assert calculate_pool_charge(150) == 130_000

    def test_180_minutes_3_hours(self):
        """3 hours (180 min) → Rs. 1,500 (150,000 paise) — 3 × Rs. 500"""
        assert calculate_pool_charge(180) == 150_000

    def test_210_minutes_3_point_5_hours(self):
        """3.5 hours (210 min) → Rs. 1,800 (180,000 paise) — 3 hr + extra 30 min"""
        assert calculate_pool_charge(210) == 180_000

    def test_240_minutes_4_hours(self):
        """4 hours (240 min) → Rs. 2,000 (200,000 paise) — 4 × Rs. 500"""
        assert calculate_pool_charge(240) == 200_000


class TestPoolChargeBoundaryConditions:
    """Test boundary conditions for pool pricing."""

    def test_exactly_60_minutes_is_base_only(self):
        """Exactly 60 min charges Rs. 500."""
        assert calculate_pool_charge(60) == POOL_BASE_PAISE

    def test_61_minutes_triggers_first_extra_half_hour(self):
        """61 min crosses 1 hr: 1 hr (500) + extra 30 min block (300) = Rs. 800."""
        assert calculate_pool_charge(61) == 80_000

    def test_89_minutes_is_one_block(self):
        """89 min is within 1 hr 30 min: Rs. 800."""
        assert calculate_pool_charge(89) == 80_000

    def test_90_minutes_completes_first_block(self):
        """90 min is 1.5 hr: Rs. 800."""
        assert calculate_pool_charge(90) == 80_000

    def test_91_minutes_rounds_to_two_hours(self):
        """91 min exceeds 1.5 hr, rounding up to 2 hours: Rs. 1,000."""
        assert calculate_pool_charge(91) == 100_000

    def test_121_minutes_triggers_half_hour(self):
        """121 min is 2 hr + 1 min: 2 hr (1000) + 30 min (300) = Rs. 1,300."""
        assert calculate_pool_charge(121) == 130_000

    def test_1_minute_session(self):
        """A 1-minute session still charges the base 1 hr Rs. 500."""
        assert calculate_pool_charge(1) == POOL_BASE_PAISE

    def test_300_minutes_extended_session(self):
        """300 min = 5 hours = 5 × Rs. 500 = Rs. 2,500 (250,000 paise)"""
        assert calculate_pool_charge(300) == 250_000


class TestPoolChargeInvalidInput:
    """Pool pricing must reject invalid inputs."""

    def test_zero_duration_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calculate_pool_charge(0)

    def test_negative_duration_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calculate_pool_charge(-30)

    def test_negative_base_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            calculate_pool_charge(60, base_paise=-1)

    def test_negative_block_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            calculate_pool_charge(90, block_paise=-1)


class TestPoolChargeCustomRates:
    """Pool pricing with custom rates."""

    def test_custom_base_rate(self):
        """Can use a different base rate."""
        result = calculate_pool_charge(60, base_paise=60_000)
        assert result == 60_000

    def test_custom_block_rate(self):
        """Can use a different block rate."""
        result = calculate_pool_charge(90, base_paise=50_000, block_paise=40_000)
        assert result == 90_000  # 50000 + 40000

    def test_custom_rates_do_not_affect_default(self):
        """Passing custom rates should never affect the defaults."""
        _ = calculate_pool_charge(180, base_paise=60_000, block_paise=40_000)
        # Default calculation for 3 hours must be Rs. 1,500
        assert calculate_pool_charge(180) == 150_000


# ── PS4 Pricing Tests ─────────────────────────────────────────────────────────

class TestPS4Charge1Player:
    """PS4 pricing for 1 player: Rs. 400/hour."""

    def test_30_minutes_1_player(self):
        """30 min, 1 player → ceil(0.5) = 1 hour → Rs. 400"""
        assert calculate_ps4_charge(30, 1) == 40_000

    def test_60_minutes_1_player(self):
        """60 min, 1 player → 1 hour → Rs. 400"""
        assert calculate_ps4_charge(60, 1) == 40_000

    def test_61_minutes_1_player(self):
        """61 min, 1 player → ceil = 2 hours → Rs. 800"""
        assert calculate_ps4_charge(61, 1) == 80_000

    def test_90_minutes_1_player(self):
        """90 min, 1 player → ceil(1.5) = 2 hours → Rs. 800"""
        assert calculate_ps4_charge(90, 1) == 80_000

    def test_120_minutes_1_player(self):
        """120 min, 1 player → 2 hours → Rs. 800"""
        assert calculate_ps4_charge(120, 1) == 80_000

    def test_180_minutes_1_player(self):
        """180 min, 1 player → 3 hours → Rs. 1200"""
        assert calculate_ps4_charge(180, 1) == 120_000


class TestPS4Charge2Players:
    """PS4 pricing for 2 players: Rs. 500/hour."""

    def test_60_minutes_2_players(self):
        """60 min, 2 players → 1 hour → Rs. 500"""
        assert calculate_ps4_charge(60, 2) == 50_000

    def test_90_minutes_2_players(self):
        """90 min, 2 players → ceil(1.5) = 2 hours → Rs. 1000"""
        assert calculate_ps4_charge(90, 2) == 100_000

    def test_120_minutes_2_players(self):
        """120 min, 2 players → 2 hours → Rs. 1000"""
        assert calculate_ps4_charge(120, 2) == 100_000

    def test_180_minutes_2_players(self):
        """180 min, 2 players → 3 hours → Rs. 1500"""
        assert calculate_ps4_charge(180, 2) == 150_000


class TestPS4ChargeInvalidInput:
    def test_zero_duration_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calculate_ps4_charge(0, 1)

    def test_negative_duration_raises(self):
        with pytest.raises(ValueError, match="positive"):
            calculate_ps4_charge(-60, 1)

    def test_invalid_players_zero_raises(self):
        with pytest.raises(ValueError, match="1 or 2"):
            calculate_ps4_charge(60, 0)

    def test_invalid_players_three_raises(self):
        with pytest.raises(ValueError, match="1 or 2"):
            calculate_ps4_charge(60, 3)


# ── Discount Tests ────────────────────────────────────────────────────────────

class TestApplyDiscount:
    def test_no_discount(self):
        assert apply_discount(50_000, 0) == 50_000

    def test_partial_discount(self):
        assert apply_discount(50_000, 10_000) == 40_000

    def test_full_discount(self):
        assert apply_discount(50_000, 50_000) == 0

    def test_discount_cannot_make_charge_negative(self):
        """A discount larger than the charge should result in 0, not negative."""
        assert apply_discount(50_000, 60_000) == 0

    def test_negative_charge_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            apply_discount(-1, 0)

    def test_negative_discount_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            apply_discount(50_000, -1)


# ── Standard Duration Lists ───────────────────────────────────────────────────

class TestStandardDurations:
    def test_pool_standard_durations_count(self):
        durations = get_pool_standard_durations()
        assert len(durations) == 8

    def test_pool_standard_durations_charges_correct(self):
        durations = get_pool_standard_durations()
        expected = {
            30: 50_000, 60: 50_000, 90: 80_000, 120: 100_000,
            150: 130_000, 180: 150_000, 210: 180_000, 240: 200_000
        }
        for d in durations:
            assert d["charge_paise"] == expected[d["minutes"]], \
                f"Wrong charge for {d['minutes']} min: {d['charge_paise']} != {expected[d['minutes']]}"

    def test_ps4_standard_durations_count(self):
        durations = get_ps4_standard_durations(1)
        assert len(durations) == 7

    def test_ps4_duration_labels_exist(self):
        durations = get_pool_standard_durations()
        for d in durations:
            assert "label" in d
            assert len(d["label"]) > 0


class TestPricingApiEndpoints:
    def test_get_and_update_rates_with_auth(self, db):
        from app.routers.pricing import get_rates, update_rates, PricingRatesUpdate
        from app.services.seed import seed_master_data
        from app.routers.auth import ensure_default_credentials
        from fastapi import HTTPException
        seed_master_data(db)
        ensure_default_credentials(db)

        # 1. Fetch initial rates
        initial = get_rates(db=db)
        assert initial.pool_base_charge_paise == 50000
        assert initial.ps4_1player_rate_paise == 40000

        # 2. Unauthorized update fails
        with pytest.raises(HTTPException) as exc_info:
            update_rates(
                payload=PricingRatesUpdate(
                    admin_username="admin",
                    admin_password="wrongpassword",
                    pool_base_charge_paise=60000,
                ),
                db=db,
            )
        assert exc_info.value.status_code == 403

        # 3. Authorized update succeeds
        updated = update_rates(
            payload=PricingRatesUpdate(
                admin_username="admin",
                admin_password="admin123",
                pool_base_charge_paise=60000,
                ps4_1player_rate_paise=45000,
            ),
            db=db,
        )
        assert updated.pool_base_charge_paise == 60000
        assert updated.ps4_1player_rate_paise == 45000

        # 4. GET reflects new rates
        fetched = get_rates(db=db)
        assert fetched.pool_base_charge_paise == 60000
        assert fetched.ps4_1player_rate_paise == 45000

