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


class TestPoolChargeStandardDurations:


    def test_30_minutes(self):

        assert calculate_pool_charge(30) == 50_000

    def test_60_minutes_1_hour(self):

        assert calculate_pool_charge(60) == 50_000

    def test_90_minutes_1_point_5_hours(self):

        assert calculate_pool_charge(90) == 80_000

    def test_120_minutes_2_hours(self):

        assert calculate_pool_charge(120) == 100_000

    def test_150_minutes_2_point_5_hours(self):

        assert calculate_pool_charge(150) == 130_000

    def test_180_minutes_3_hours(self):

        assert calculate_pool_charge(180) == 150_000

    def test_210_minutes_3_point_5_hours(self):

        assert calculate_pool_charge(210) == 180_000

    def test_240_minutes_4_hours(self):

        assert calculate_pool_charge(240) == 200_000


class TestPoolChargeBoundaryConditions:


    def test_exactly_60_minutes_is_base_only(self):

        assert calculate_pool_charge(60) == POOL_BASE_PAISE

    def test_61_minutes_triggers_first_extra_half_hour(self):

        assert calculate_pool_charge(61) == 80_000

    def test_89_minutes_is_one_block(self):

        assert calculate_pool_charge(89) == 80_000

    def test_90_minutes_completes_first_block(self):

        assert calculate_pool_charge(90) == 80_000

    def test_91_minutes_rounds_to_two_hours(self):

        assert calculate_pool_charge(91) == 100_000

    def test_121_minutes_triggers_half_hour(self):

        assert calculate_pool_charge(121) == 130_000

    def test_1_minute_session(self):

        assert calculate_pool_charge(1) == POOL_BASE_PAISE

    def test_300_minutes_extended_session(self):

        assert calculate_pool_charge(300) == 250_000


class TestPoolChargeInvalidInput:


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


    def test_custom_base_rate(self):

        result = calculate_pool_charge(60, base_paise=60_000)
        assert result == 60_000

    def test_custom_block_rate(self):

        result = calculate_pool_charge(90, base_paise=50_000, block_paise=40_000)
        assert result == 90_000

    def test_custom_rates_do_not_affect_default(self):

        _ = calculate_pool_charge(180, base_paise=60_000, block_paise=40_000)

        assert calculate_pool_charge(180) == 150_000


class TestPS4Charge1Player:


    def test_30_minutes_1_player(self):

        assert calculate_ps4_charge(30, 1) == 40_000

    def test_60_minutes_1_player(self):

        assert calculate_ps4_charge(60, 1) == 40_000

    def test_61_minutes_1_player(self):

        assert calculate_ps4_charge(61, 1) == 80_000

    def test_90_minutes_1_player(self):

        assert calculate_ps4_charge(90, 1) == 80_000

    def test_120_minutes_1_player(self):

        assert calculate_ps4_charge(120, 1) == 80_000

    def test_180_minutes_1_player(self):

        assert calculate_ps4_charge(180, 1) == 120_000


class TestPS4Charge2Players:


    def test_60_minutes_2_players(self):

        assert calculate_ps4_charge(60, 2) == 50_000

    def test_90_minutes_2_players(self):

        assert calculate_ps4_charge(90, 2) == 100_000

    def test_120_minutes_2_players(self):

        assert calculate_ps4_charge(120, 2) == 100_000

    def test_180_minutes_2_players(self):

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


class TestApplyDiscount:
    def test_no_discount(self):
        assert apply_discount(50_000, 0) == 50_000

    def test_partial_discount(self):
        assert apply_discount(50_000, 10_000) == 40_000

    def test_full_discount(self):
        assert apply_discount(50_000, 50_000) == 0

    def test_discount_cannot_make_charge_negative(self):

        assert apply_discount(50_000, 60_000) == 0

    def test_negative_charge_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            apply_discount(-1, 0)

    def test_negative_discount_raises(self):
        with pytest.raises(ValueError, match="non-negative"):
            apply_discount(50_000, -1)


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


        initial = get_rates(db=db)
        assert initial.pool_base_charge_paise == 50000
        assert initial.ps4_1player_rate_paise == 40000


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


        fetched = get_rates(db=db)
        assert fetched.pool_base_charge_paise == 60000
        assert fetched.ps4_1player_rate_paise == 45000
