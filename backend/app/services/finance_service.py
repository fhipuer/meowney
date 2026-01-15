"""
Finance Service - yfinance 연동 냥~ 🐱
실시간 주가 조회 및 계산 담당
"""
import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

from app.config import settings


class FinanceService:
    """
    금융 데이터 서비스 냥~ 🐱
    yfinance를 사용하여 실시간 주가 조회
    """

    def __init__(self):
        self._executor = ThreadPoolExecutor(max_workers=5)
        self._price_cache: dict[str, dict] = {}  # 간단한 메모리 캐시

    def _get_stock_info_sync(self, ticker: str) -> dict:
        """
        동기 방식으로 주식 정보 조회
        yfinance는 동기 라이브러리라서 별도 스레드에서 실행
        """
        try:
            stock = yf.Ticker(ticker)
            info = stock.info

            # 현재가 가져오기 (여러 필드 시도)
            current_price = (
                info.get("currentPrice")
                or info.get("regularMarketPrice")
                or info.get("previousClose")
                or info.get("open")
            )

            return {
                "ticker": ticker,
                "current_price": current_price,
                "currency": info.get("currency", "USD"),
                "name": info.get("shortName") or info.get("longName"),
                "exchange": info.get("exchange"),
                "valid": current_price is not None,
            }
        except Exception as e:
            print(f"🙀 티커 조회 실패 냥: {ticker} - {e}")
            return {
                "ticker": ticker,
                "current_price": None,
                "currency": None,
                "name": None,
                "valid": False,
                "error": str(e),
            }

    async def get_stock_price(self, ticker: str) -> dict:
        """
        비동기로 주식 가격 조회 냥~
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            self._get_stock_info_sync,
            ticker
        )
        return result

    async def get_multiple_prices(self, tickers: list[str]) -> dict[str, dict]:
        """
        여러 종목 동시 조회 냥~ 🐱
        병렬로 조회해서 빠르게!
        """
        if not tickers:
            return {}

        tasks = [self.get_stock_price(ticker) for ticker in tickers]
        results = await asyncio.gather(*tasks)

        return {result["ticker"]: result for result in results}

    async def validate_ticker(self, ticker: str) -> bool:
        """
        티커 유효성 검증 냥~
        """
        result = await self.get_stock_price(ticker)
        return result.get("valid", False)

    async def validate_ticker_with_info(self, ticker: str) -> dict:
        """
        티커 검증 및 상세 정보 반환 냥~
        프론트엔드에서 검증 결과를 표시하기 위한 상세 정보 포함
        """
        result = await self.get_stock_price(ticker)

        return {
            "valid": result.get("valid", False),
            "ticker": ticker,
            "name": result.get("name"),
            "current_price": Decimal(str(result["current_price"])) if result.get("current_price") else None,
            "currency": result.get("currency"),
            "exchange": result.get("exchange"),
            "error": result.get("error") if not result.get("valid") else None,
        }

    async def enrich_assets_with_prices(self, assets: list[dict]) -> list[dict]:
        """
        자산 목록에 실시간 가격 정보 추가 냥~ 🐱

        - 주식: yfinance에서 현재가 조회
        - 현금: current_value 사용
        - 계산: 평가금액, 손익, 수익률
        - 환율: USD 자산의 원화 환산 매입가 계산
        """
        # 티커가 있는 자산만 필터링
        tickers = [
            asset["ticker"]
            for asset in assets
            if asset.get("ticker")
        ]

        # 일괄 조회
        prices = await self.get_multiple_prices(list(set(tickers)))

        # 현재 환율 조회 (USD 자산이 있을 경우)
        current_exchange_rate = await self.get_exchange_rate()

        enriched = []
        for asset in assets:
            asset_copy = dict(asset)
            ticker = asset.get("ticker")
            quantity = Decimal(str(asset.get("quantity", 0)))
            avg_price = Decimal(str(asset.get("average_price", 0)))
            currency = asset.get("currency", "KRW")

            # 현재 환율 추가
            asset_copy["current_exchange_rate"] = Decimal(str(current_exchange_rate))

            # 현재가 결정
            if ticker and ticker in prices:
                price_info = prices[ticker]
                current_price = price_info.get("current_price")

                if current_price:
                    # USD 자산인 경우 원화 환산 (선택적)
                    if price_info.get("currency") == "USD" and currency == "KRW":
                        current_price = float(current_price) * current_exchange_rate

                    asset_copy["current_price"] = Decimal(str(current_price))
                else:
                    asset_copy["current_price"] = None
            elif asset.get("current_value"):
                # 티커 없는 자산 (현금, 금현물, 예금 등)
                # current_value가 총 가치를 나타냄
                asset_copy["current_price"] = None  # 단가는 없음
                asset_copy["manual_value"] = True  # 수동 입력 표시
            else:
                asset_copy["current_price"] = None

            # USD 자산의 원화 환산 매입가 계산
            if currency == "USD" and quantity > 0:
                # 매수 시점 환율이 있으면 사용, 없으면 현재 환율 사용
                purchase_rate = asset.get("purchase_exchange_rate")
                if purchase_rate:
                    purchase_rate = Decimal(str(purchase_rate))
                else:
                    purchase_rate = Decimal(str(current_exchange_rate))

                # 원화 환산 매입가 = 평균매수가(USD) × 수량 × 매수시점환율
                asset_copy["cost_basis_krw"] = avg_price * quantity * purchase_rate
            else:
                asset_copy["cost_basis_krw"] = None

            # 평가금액, 손익, 수익률 계산
            if asset_copy.get("current_price") and quantity > 0:
                # 티커가 있는 자산: 현재가 × 수량
                current_price = Decimal(str(asset_copy["current_price"]))
                market_value = current_price * quantity
                principal = avg_price * quantity
                profit_loss = market_value - principal

                asset_copy["market_value"] = market_value
                asset_copy["profit_loss"] = profit_loss

                if principal > 0:
                    asset_copy["profit_rate"] = float((profit_loss / principal) * 100)
                else:
                    asset_copy["profit_rate"] = 0.0
            elif asset.get("current_value"):
                # 티커 없는 자산 (금현물, 현금, 예금 등)
                # current_value = 현재 총 가치, average_price × quantity = 원금
                current_value = Decimal(str(asset["current_value"]))
                principal = avg_price * quantity

                asset_copy["market_value"] = current_value
                asset_copy["profit_loss"] = current_value - principal

                if principal > 0:
                    asset_copy["profit_rate"] = float(((current_value - principal) / principal) * 100)
                else:
                    asset_copy["profit_rate"] = 0.0
            else:
                asset_copy["market_value"] = Decimal("0")
                asset_copy["profit_loss"] = Decimal("0")
                asset_copy["profit_rate"] = 0.0

            enriched.append(asset_copy)

        return enriched

    async def get_exchange_rate(self, from_currency: str = "USD", to_currency: str = "KRW") -> float:
        """
        환율 조회 냥~ (USDKRW=X 티커 사용)
        """
        ticker = f"{from_currency}{to_currency}=X"
        result = await self.get_stock_price(ticker)

        if result.get("valid") and result.get("current_price"):
            return float(result["current_price"])

        # 실패시 기본값 반환
        return settings.default_usd_krw_rate

    def _get_benchmark_history_sync(
        self,
        ticker: str,
        start_date: date,
        end_date: date
    ) -> list[dict]:
        """
        동기 방식으로 벤치마크 히스토리 조회 냥~
        """
        try:
            stock = yf.Ticker(ticker)
            history = stock.history(
                start=start_date.isoformat(),
                end=(end_date + timedelta(days=1)).isoformat()
            )

            if history.empty:
                return []

            data = []
            first_close = None

            for idx, row in history.iterrows():
                close = float(row["Close"])
                if first_close is None:
                    first_close = close

                # 시작점 대비 수익률 계산
                return_rate = ((close - first_close) / first_close) * 100 if first_close else 0

                data.append({
                    "date": idx.date(),
                    "close": Decimal(str(round(close, 2))),
                    "return_rate": round(return_rate, 2)
                })

            return data
        except Exception as e:
            print(f"🙀 벤치마크 조회 실패 냥: {ticker} - {e}")
            return []

    async def get_benchmark_history(
        self,
        ticker: str,
        start_date: date,
        end_date: date
    ) -> dict:
        """
        벤치마크 히스토리 조회 냥~ 🐱
        KOSPI: ^KS11, S&P500: ^GSPC
        """
        # 벤치마크 이름 매핑
        benchmark_names = {
            "^KS11": "KOSPI",
            "^GSPC": "S&P 500",
            "^IXIC": "NASDAQ",
            "^DJI": "Dow Jones",
        }

        loop = asyncio.get_event_loop()
        data = await loop.run_in_executor(
            self._executor,
            self._get_benchmark_history_sync,
            ticker,
            start_date,
            end_date
        )

        return {
            "ticker": ticker,
            "name": benchmark_names.get(ticker, ticker),
            "data": data
        }


# 싱글톤 인스턴스 (필요시 사용)
_finance_service: FinanceService | None = None


def get_finance_service() -> FinanceService:
    global _finance_service
    if _finance_service is None:
        _finance_service = FinanceService()
    return _finance_service
