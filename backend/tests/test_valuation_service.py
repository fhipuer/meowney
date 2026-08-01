from datetime import datetime
from decimal import Decimal

import pytest

from app.services.valuation_service import calculate_asset_valuation


RATE = Decimal("1300")


def test_krw_ticker_uses_price_times_quantity():
    result = calculate_asset_valuation(
        {"ticker": "TEST.KS", "currency": "KRW", "quantity": "2.5", "average_price": "9000"},
        {"current_price": "10000", "currency": "KRW", "timestamp": datetime(2026, 1, 1)},
        RATE,
    )
    assert result.market_value_krw == Decimal("25000.0")
    assert result.cost_basis_krw == Decimal("22500.0")
    assert result.profit_loss_krw == Decimal("2500.0")


def test_usd_ticker_converts_market_and_cost_with_different_rates():
    result = calculate_asset_valuation(
        {
            "ticker": "TEST",
            "currency": "USD",
            "quantity": "3",
            "average_price": "80",
            "purchase_exchange_rate": "1200",
        },
        {"current_price": "100", "currency": "USD"},
        RATE,
    )
    assert result.market_value_usd == Decimal("300")
    assert result.market_value_krw == Decimal("390000")
    assert result.cost_basis_krw == Decimal("288000")
    assert result.profit_loss_krw == Decimal("102000")
    assert result.unit_price_krw == Decimal("130000")


def test_usd_manual_cash_current_value_is_total_dollars_without_quantity_multiplication():
    result = calculate_asset_valuation(
        {
            "ticker": None,
            "asset_type": "cash",
            "currency": "USD",
            "quantity": "999",
            "average_price": "123",
            "current_value": "1000",
        },
        None,
        RATE,
    )
    assert result.market_value_usd == Decimal("1000")
    assert result.market_value_krw == Decimal("1300000")
    assert result.cost_basis_krw == Decimal("1300000")
    assert result.profit_loss_krw == Decimal("0")
    assert result.price_status == "manual"


def test_usd_manual_non_cash_converts_current_value_and_purchase_cost():
    result = calculate_asset_valuation(
        {
            "ticker": None,
            "asset_type": "gold",
            "currency": "USD",
            "quantity": "2",
            "average_price": "400",
            "purchase_exchange_rate": "1100",
            "current_value": "1000",
        },
        None,
        RATE,
    )
    assert result.market_value_krw == Decimal("1300000")
    assert result.cost_basis_krw == Decimal("880000")
    assert result.profit_loss_krw == Decimal("420000")


def test_missing_quote_is_unavailable_not_zero():
    result = calculate_asset_valuation(
        {"ticker": "TEST", "currency": "USD", "quantity": "2", "average_price": "10"},
        None,
        RATE,
    )
    assert result.market_value_krw is None
    assert result.profit_loss_krw is None
    assert result.price_status == "unavailable"


def test_stale_quote_status_is_preserved():
    result = calculate_asset_valuation(
        {"ticker": "TEST", "currency": "USD", "quantity": "1", "average_price": "100"},
        {"current_price": "101", "currency": "USD", "stale": True},
        RATE,
    )
    assert result.price_status == "stale"


@pytest.mark.parametrize("field,value", [
    ("quantity", "NaN"),
    ("quantity", "Infinity"),
    ("quantity", "-1"),
    ("average_price", "-0.1"),
])
def test_invalid_numeric_inputs_are_rejected(field, value):
    asset = {"ticker": "TEST", "currency": "KRW", "quantity": "1", "average_price": "1"}
    asset[field] = value
    with pytest.raises(ValueError):
        calculate_asset_valuation(asset, {"current_price": "1", "currency": "KRW"}, RATE)


def test_zero_exchange_rate_is_rejected():
    with pytest.raises(ValueError):
        calculate_asset_valuation(
            {"ticker": None, "currency": "USD", "quantity": 0, "average_price": 0, "current_value": 100},
            None,
            Decimal("0"),
        )
