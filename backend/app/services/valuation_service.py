"""통화 단위를 명시적으로 관리하는 순수 자산 평가 로직."""
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, Optional


PriceStatus = Literal["live", "close", "cached", "stale", "manual", "unavailable"]


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
    native_profit_rate: Optional[Decimal] = None
    fx_change_rate: Optional[Decimal] = None
    asset_price_effect_krw: Optional[Decimal] = None
    fx_effect_krw: Optional[Decimal] = None
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
    has_explicit_purchase_rate = (
        currency == "USD" and asset.get("purchase_exchange_rate") is not None
    )
    purchase_rate = exchange_rate
    if has_explicit_purchase_rate:
        purchase_rate = _positive_rate(asset["purchase_exchange_rate"], "purchase_exchange_rate")

    ticker = asset.get("ticker")
    current_price: Optional[Decimal] = None
    unit_price_krw: Optional[Decimal] = None
    market_native: Optional[Decimal] = None
    market_krw: Optional[Decimal] = None
    status: PriceStatus
    as_of = None
    source = None
    valuation_error = None

    if ticker and quote and quote.get("current_price") is not None:
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
        if quote.get("stale"):
            status = "stale"
        elif quote.get("price_kind") == "close":
            status = "close"
        else:
            status = "cached" if quote.get("cached") else "live"
        as_of = quote.get("timestamp")
        source = quote.get("source")
    else:
        current_value = _decimal(asset.get("current_value"), "current_value", allow_none=True)
        if current_value is None:
            cost_basis = average_price * quantity * (purchase_rate if currency == "USD" else Decimal("1"))
            quote_error = quote.get("error") if ticker and quote else None
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
                valuation_error=quote_error or (
                    "현재 시세를 조회할 수 없습니다"
                    if ticker
                    else "수동 평가액이 입력되지 않았습니다"
                ),
            )
        if current_value < 0:
            raise ValueError("current_value 값은 0 이상이어야 합니다")
        market_native = current_value
        market_krw = current_value * exchange_rate if currency == "USD" else current_value
        status = "manual"
        source = "manual fallback" if ticker else "manual"
        if ticker and quote:
            valuation_error = quote.get("error")

    assert market_native is not None
    market_usd = market_native if currency == "USD" else None
    native_profit_rate = None
    fx_change_rate = None
    asset_price_effect_krw = None
    fx_effect_krw = None
    if asset.get("asset_type") == "cash":
        cost_basis_krw = market_krw
    else:
        cost_basis_native = average_price * quantity
        cost_basis_krw = cost_basis_native * purchase_rate if currency == "USD" else cost_basis_native
        if currency == "USD":
            native_profit = market_native - cost_basis_native
            if cost_basis_native > 0:
                native_profit_rate = native_profit / cost_basis_native * Decimal("100")

            # 환율 기준이 실제로 입력된 경우에만 두 효과를 분리한다. 매입 환율이
            # 없으면 현재 환율을 대입해 평가하므로 환율 효과 0으로 표시하면 오해를 준다.
            if has_explicit_purchase_rate:
                fx_change_rate = (
                    (exchange_rate - purchase_rate) / purchase_rate * Decimal("100")
                )
                # 매입 환율에서 자산 가격만 먼저 바꾸고, 그 다음 현재 환율을 적용한다.
                # 이 순서라면 두 효과의 합이 최종 원화 손익과 정확히 일치한다.
                asset_price_effect_krw = native_profit * purchase_rate
                fx_effect_krw = market_native * (exchange_rate - purchase_rate)

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
        native_profit_rate=native_profit_rate,
        fx_change_rate=fx_change_rate,
        asset_price_effect_krw=asset_price_effect_krw,
        fx_effect_krw=fx_effect_krw,
        price_as_of=as_of,
        price_source=source,
        valuation_error=valuation_error,
    )

