"""KRX 금시장 일별 종가 조회 서비스."""

from __future__ import annotations

from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Callable

import httpx

from app.config import settings


KRX_GOLD_ENDPOINT = "https://data-dbg.krx.co.kr/svc/apis/gen/gold_bydd_trd.json"
KRX_GOLD_SOURCE = "KRX Open API"
KRX_GOLD_EXCHANGE = "KRX 금시장"
KRX_GOLD_PRODUCTS = {
    "M04020000": "금 99.99_1kg",
    "M04020100": "미니금 99.99_100g",
}
KST = timezone(timedelta(hours=9), "Asia/Seoul")


def normalize_krx_gold_ticker(ticker: str) -> str | None:
    """KRX 금 상품코드를 canonical M-prefixed 코드로 정규화한다."""
    normalized = str(ticker or "").strip().upper()
    if normalized in KRX_GOLD_PRODUCTS:
        return normalized
    with_prefix = f"M{normalized}"
    return with_prefix if with_prefix in KRX_GOLD_PRODUCTS else None


def is_krx_gold_ticker(ticker: str) -> bool:
    return normalize_krx_gold_ticker(ticker) is not None


def _code_variants(ticker: str) -> set[str]:
    without_prefix = ticker.removeprefix("M")
    return {ticker, without_prefix, without_prefix.removesuffix("00")}


def _parse_close(value: Any) -> Decimal | None:
    try:
        parsed = Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, AttributeError, TypeError, ValueError):
        return None
    return parsed if parsed.is_finite() and parsed > 0 else None


def _parse_trade_date(value: Any, fallback: date) -> date:
    text = str(value or "").strip().replace("-", "")
    try:
        return datetime.strptime(text, "%Y%m%d").date()
    except ValueError:
        return fallback


class KrxGoldService:
    """공식 KRX OPEN API에서 가장 최근 금시장 종가를 가져온다."""

    def __init__(
        self,
        api_key: str | None = None,
        *,
        client_factory: Callable[..., httpx.AsyncClient] = httpx.AsyncClient,
        today_provider: Callable[[], date] | None = None,
        lookback_days: int = 10,
    ) -> None:
        self.api_key = api_key if api_key is not None else settings.krx_api_key
        self.client_factory = client_factory
        self.today_provider = today_provider or (lambda: datetime.now(KST).date())
        self.lookback_days = lookback_days

    @staticmethod
    def _error(ticker: str, message: str) -> dict[str, Any]:
        return {
            "ticker": ticker,
            "current_price": None,
            "currency": "KRW",
            "name": KRX_GOLD_PRODUCTS.get(ticker),
            "exchange": KRX_GOLD_EXCHANGE,
            "valid": False,
            "source": KRX_GOLD_SOURCE,
            "cached": False,
            "stale": False,
            "error": message,
        }

    @staticmethod
    def _find_product_row(rows: Any, ticker: str) -> dict[str, Any] | None:
        if not isinstance(rows, list):
            return None
        variants = _code_variants(ticker)
        expected_name = KRX_GOLD_PRODUCTS[ticker]
        for row in rows:
            if not isinstance(row, dict):
                continue
            code = str(row.get("ISU_CD") or "").strip().upper()
            name = str(row.get("ISU_NM") or "").strip()
            if code in variants or name == expected_name:
                return row
        return None

    async def get_price(self, ticker: str) -> dict[str, Any]:
        canonical = normalize_krx_gold_ticker(ticker)
        if canonical is None:
            return self._error(
                str(ticker or "").strip().upper(),
                f"지원하지 않는 KRX 금 상품코드입니다: {ticker}",
            )
        if not self.api_key:
            return self._error(canonical, "KRX_API_KEY가 설정되지 않았습니다.")

        start_date = self.today_provider()
        try:
            async with self.client_factory(timeout=15, follow_redirects=True) as client:
                for offset in range(self.lookback_days + 1):
                    business_date = start_date - timedelta(days=offset)
                    if business_date.weekday() >= 5:
                        continue

                    response = await client.get(
                        KRX_GOLD_ENDPOINT,
                        params={"basDd": business_date.strftime("%Y%m%d")},
                        headers={"AUTH_KEY": self.api_key},
                    )
                    if response.status_code in {401, 403}:
                        return self._error(
                            canonical,
                            "KRX 인증키에 '금시장 일별매매정보' 이용 권한이 없습니다. "
                            "KRX OPEN API의 서비스 이용신청 및 승인을 확인해주세요.",
                        )
                    response.raise_for_status()
                    payload = response.json()
                    if not isinstance(payload, dict):
                        continue
                    if str(payload.get("respCode") or "200") not in {"200", "0"}:
                        return self._error(
                            canonical,
                            str(payload.get("respMsg") or "KRX API가 오류를 반환했습니다."),
                        )

                    row = self._find_product_row(payload.get("OutBlock_1"), canonical)
                    if row is None:
                        continue
                    close = _parse_close(row.get("TDD_CLSPRC"))
                    if close is None:
                        continue

                    trade_date = _parse_trade_date(row.get("BAS_DD"), business_date)
                    return {
                        "ticker": canonical,
                        "current_price": close,
                        "currency": "KRW",
                        "name": row.get("ISU_NM") or KRX_GOLD_PRODUCTS[canonical],
                        "exchange": KRX_GOLD_EXCHANGE,
                        "valid": True,
                        "timestamp": datetime.combine(trade_date, time(15, 30), tzinfo=KST),
                        "source": KRX_GOLD_SOURCE,
                        "price_kind": "close",
                        "cached": False,
                        "stale": False,
                    }
        except (httpx.HTTPError, ValueError) as exc:
            return self._error(canonical, f"KRX 금 종가 조회 실패: {exc}")

        return self._error(
            canonical,
            f"최근 {self.lookback_days + 1}일 이내 KRX 금 종가를 찾지 못했습니다.",
        )
