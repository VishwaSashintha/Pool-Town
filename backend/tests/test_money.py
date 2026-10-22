"""
Tests for monetary utility functions.
"""
import pytest
from decimal import Decimal
from app.utils.money import (
    paise_to_rupees,
    rupees_to_paise,
    format_lkr,
    percentage_of_paise,
    validate_journal_balance,
    allocate_profit,
    update_weighted_average_cost,
)


class TestPaiseRupeeConversion:
    def test_paise_to_rupees_basic(self):
        assert paise_to_rupees(50_000) == Decimal("500.00")

    def test_paise_to_rupees_zero(self):
        assert paise_to_rupees(0) == Decimal("0.00")

    def test_rupees_to_paise_basic(self):
        assert rupees_to_paise(Decimal("500")) == 50_000

    def test_rupees_to_paise_from_string(self):
        assert rupees_to_paise("1700.00") == 170_000

    def test_rupees_to_paise_rounding(self):
        # 0.005 → rounds up to 1 paise
        assert rupees_to_paise("0.005") == 1

    def test_roundtrip(self):
        paise = 170_000
        assert rupees_to_paise(paise_to_rupees(paise)) == paise


class TestFormatLKR:
    def test_format_500(self):
        assert format_lkr(50_000) == "Rs. 500.00"

    def test_format_1700(self):
        assert format_lkr(170_000) == "Rs. 1,700.00"

    def test_format_zero(self):
        assert format_lkr(0) == "Rs. 0.00"


class TestPercentageOfPaise:
    def test_20_percent(self):
        """20% of Rs. 1000 = Rs. 200"""
        assert percentage_of_paise(100_000, 2000) == 20_000

    def test_40_percent(self):
        """40% of Rs. 1000 = Rs. 400"""
        assert percentage_of_paise(100_000, 4000) == 40_000

    def test_100_percent(self):
        assert percentage_of_paise(50_000, 10_000) == 50_000

    def test_rounding(self):
        """Test that rounding is half-up, not float."""
        # 1 paise × 3333 bps / 10000 = 0.3333 → rounds to 0
        assert percentage_of_paise(1, 3333) == 0
        # 5 paise × 3333 bps / 10000 = 1.6665 → rounds to 2
        assert percentage_of_paise(5, 3333) == 2


class TestJournalBalance:
    def test_balanced(self):
        assert validate_journal_balance([50_000, 30_000], [80_000]) is True

    def test_unbalanced(self):
        assert validate_journal_balance([50_000], [40_000]) is False

    def test_single_pair(self):
        assert validate_journal_balance([100_000], [100_000]) is True

    def test_empty_both_zero(self):
        assert validate_journal_balance([], []) is True


class TestAllocateProfit:
    def test_standard_allocation(self):
        """40% savings, 20% each owner from Rs. 10,000 profit"""
        allocations = {"savings": 4000, "akash": 2000, "pasan": 2000, "vishwa": 2000}
        result = allocate_profit(1_000_000, allocations)  # Rs. 10,000
        
        assert result["savings"] == 400_000   # Rs. 4,000
        assert result["akash"] == 200_000     # Rs. 2,000
        assert result["pasan"] == 200_000     # Rs. 2,000
        assert result["vishwa"] == 200_000    # Rs. 2,000
        assert sum(result.values()) == 1_000_000

    def test_allocation_totals_exactly(self):
        """Sum of allocations must equal net profit exactly (no rounding leakage)."""
        # Use an odd number to force rounding
        net_profit = 999_999  # Rs. 9,999.99
        allocations = {"savings": 4000, "akash": 2000, "pasan": 2000, "vishwa": 2000}
        result = allocate_profit(net_profit, allocations)
        assert sum(result.values()) == net_profit

    def test_invalid_percentages_raise(self):
        with pytest.raises(ValueError, match="10000"):
            allocate_profit(100_000, {"savings": 4000, "akash": 2000})  # only 6000 bps

    def test_zero_profit(self):
        allocations = {"savings": 4000, "akash": 2000, "pasan": 2000, "vishwa": 2000}
        result = allocate_profit(0, allocations)
        assert all(v == 0 for v in result.values())


class TestWeightedAverageCost:
    def test_simple_purchase(self):
        """No existing stock: avg cost = purchase cost"""
        result = update_weighted_average_cost(0, 0, 10, 8_000)
        assert result == 8_000  # Rs. 80

    def test_same_cost_purchase(self):
        """Adding stock at same cost: avg cost unchanged"""
        result = update_weighted_average_cost(10, 8_000, 10, 8_000)
        assert result == 8_000

    def test_different_cost_purchase(self):
        """Mix of costs: (10 × 8000 + 10 × 9000) / 20 = 8500"""
        result = update_weighted_average_cost(10, 8_000, 10, 9_000)
        assert result == 8_500

    def test_rounding_consistency(self):
        """Result must be integer paise."""
        result = update_weighted_average_cost(3, 8_000, 2, 9_500)
        assert isinstance(result, int)
        # (3 × 8000 + 2 × 9500) / 5 = (24000 + 19000) / 5 = 43000 / 5 = 8600
        assert result == 8_600
