"""통화 단위를 명시적으로 관리하는 순수 자산 평가 로직."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, Optional


PriceStatus = Literal["live", "cached", "stale", "manual", "unavailable"]


@dataclass(frozen=True)
class AssetValuation:
    current_price: Optional[Decimal]
    unit_price_krw: Optional[Decimal]
    market_value_native: Optional[Decimal]
    market_value_krw: Optional[Decimal]
    market_value_usd: Optional[Decimal]
    cost_basis_krw: Decimal
    profit_loss_krw: Optional[Decimal]
    profit_rate: Optional[Decimal]
    price_status: PriceStatus
    price_as_of: Optional[datetime] = None
    price_source: Optional[str] = None
    valuation_error: Optional[str] = None


def _decimal(value: Any, field: str, *, allow_none: bool = False) -> Optional[Decimal]:
    if value is None and allow_none:
        return None
    try:
        result = Decimal(str(value if value is not None else 0))
    except (InvalidOperation, ValueError, TypeError) as exc:
        raise ValueError(f"{field} 값이 숫자가 아닙니다: {value!r}") from exc
    if not result.is_finite():
        raise ValueError(f"{field} 값은 유한한 숫자여야 합니다")
    return result


def _non_negative(value: Any, field: str) -> Decimal:
    result = _decimal(value, field)
    assert result is not None
    if result < 0:
        raise ValueError(f"{field} 값은 0 이상이어야 합니다")
    return result


def _positive_rate(value: Any, field: str) -> Decimal:
    result = _decimal(value, field)
    assert result is not None
    if result <= 0:
        raise ValueError(f"{field} 값은 0보다 커야 합니다")
    return result


def calculate_asset_valuation(
    asset: dict[str, Any],
    quote: Optional[dict[str, Any]],
    current_exchange_rate: Decimal,
) -> AssetValuation:
    """자산 하나를 평가한다. 반환되는 합산용 금액은 항상 KRW다."""
    quantity = _non_negative(asset.get("quantity", 0), "quantity")
    average_price = _non_negative(asset.get("average_price", 0), "average_price")
    currency = str(asset.get("currency") or "KRW").upper()
    if currency not in {"KRW", "USD"}:
        raise ValueError(f"지원하지 않는 통화입니다: {currency}")

    exchange_rate = _positive_rate(current_exchange_rate, "current_exchange_rate")
    purchase_rate = exchange_rate
    if currency == "USD" and asset.get("purchase_exchange_rate") is not None:
        purchase_rate = _positive_rate(asset["purchase_exchange_rate"], "purchase_exchange_rate")

    ticker = asset.get("ticker")
    current_price: Optional[Decimal] = None
    unit_price_krw: Optional[Decimal] = None
    market_native: Optional[Decimal] = None
    market_krw: Optional[Decimal] = None
    status: PriceStatus
    as_of = None
    source = None

    if ticker:
        if not quote or quote.get("current_price") is None:
            cost_basis = average_price * quantity * (purchase_rate if currency == "USD" else Decimal("1"))
            return AssetValuation(
                current_price=None,
                unit_price_krw=None,
                market_value_native=None,
                market_value_krw=None,
                market_value_usd=None,
                cost_basis_krw=cost_basis,
                profit_loss_krw=None,
                profit_rate=None,
                price_status="unavailable",
                valuation_error="현재 시세를 조회할 수 없습니다",
            )

        quoted_price = _non_negative(quote["current_price"], "current_price")
        quote_currency = str(quote.get("currency") or currency).upper()
        if quote_currency == currency:
            current_price = quoted_price
        elif quote_currency == "USD" and currency == "KRW":
            current_price = quoted_price * exchange_rate
        elif quote_currency == "KRW" and currency == "USD":
            current_price = quoted_price / exchange_rate
        else:
            raise ValueError(f"지원하지 않는 시세 통화 변환입니다: {quote_currency} -> {currency}")

        market_native = current_price * quantity
        market_krw = market_native * exchange_rate if currency == "USD" else market_native
        unit_price_krw = current_price * exchange_rate if currency == "USD" else current_price
        status = "stale" if quote.get("stale") else ("cached" if quote.get("cached") else "live")
        as_of = quote.get("timestamp")
        source = quote.get("source")
    else:
        current_value = _decimal(asset.get("current_value"), "current_value", allow_none=True)
        if current_value is None:
            cost_basis = average_price * quantity * (purchase_rate if currency == "USD" else Decimal("1"))
            return AssetValuation(
                current_price=None,
                unit_price_krw=None,
                market_value_native=None,
                market_value_krw=None,
                market_value_usd=None,
                cost_basis_krw=cost_basis,
                profit_loss_krw=None,
                profit_rate=None,
                price_status="unavailable",
                valuation_error="수동 평가액이 입력되지 않았습니다",
            )
        if current_value < 0:
            raise ValueError("current_value 값은 0 이상이어야 합니다")
        market_native = current_value
        market_krw = current_value * exchange_rate if currency == "USD" else current_value
        status = "manual"

    market_usd = market_native if currency == "USD" else None
    if asset.get("asset_type") == "cash":
        cost_basis_krw = market_krw
    else:
        cost_basis_native = average_price * quantity
        cost_basis_krw = cost_basis_native * purchase_rate if currency == "USD" else cost_basis_native

    assert market_krw is not None
    profit_loss = market_krw - cost_basis_krw
    profit_rate = profit_loss / cost_basis_krw * Decimal("100") if cost_basis_krw > 0 else Decimal("0")

    return AssetValuation(
        current_price=current_price,
        unit_price_krw=unit_price_krw,
        market_value_native=market_native,
        market_value_krw=market_krw,
        market_value_usd=market_usd,
        cost_basis_krw=cost_basis_krw,
        profit_loss_krw=profit_loss,
        profit_rate=profit_rate,
        price_status=status,
        price_as_of=as_of,
        price_source=source,
    )

