"""yfinance 및 KRX OPEN API 시세 조회와 자산 평가를 담당한다."""
import asyncio
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Any
from concurrent.futures import ThreadPoolExecutor

import yfinance as yf

from app.config import settings
from app.services.krx_gold_service import (
    KrxGoldService,
    is_krx_gold_ticker,
    normalize_krx_gold_ticker,
)
from app.services.valuation_service import calculate_asset_valuation


class FinanceService:
    """
    금융 데이터 서비스 냥~ 🐱
    일반 종목은 yfinance, KRX 금현물은 공식 KRX OPEN API로 조회한다.
    """

    # 클래스 레벨 환율 캐시 (인스턴스 간 공유)
    _exchange_rate_cache: dict[str, dict] = {}
    # 요청마다 서비스 인스턴스가 만들어져도 시세는 프로세스 전체에서 공유한다.
    _price_cache: dict[str, dict] = {}
    _inflight_price_tasks: dict[str, asyncio.Task] = {}
    _price_cache_ttl = timedelta(minutes=5)
    _stale_price_ttl = timedelta(hours=24)

    def __init__(self, krx_gold_service: KrxGoldService | None = None):
        self._executor = ThreadPoolExecutor(max_workers=5)
        self._krx_gold_service = krx_gold_service or KrxGoldService()

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
                "currency": info.get("currency"),  # None 유지 - 기본값 USD 가정하면 KRW 자산에 환율 곱히는 버그 발생
                "name": info.get("shortName") or info.get("longName"),
                "exchange": info.get("exchange"),
                "valid": current_price is not None,
                "timestamp": datetime.now(),
                "source": "yfinance",
                "cached": False,
                "stale": False,
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
        ticker = normalize_krx_gold_ticker(ticker) or ticker.strip().upper()
        now = datetime.now()
        cached = FinanceService._price_cache.get(ticker)
        if cached and now - cached["timestamp"] <= self._price_cache_ttl:
            return {**cached["data"], "cached": True, "stale": False}

        # 여러 API가 같은 종목을 동시에 요청해도 외부 호출은 하나만 수행한다.
        inflight = FinanceService._inflight_price_tasks.get(ticker)
        if inflight:
            return await asyncio.shield(inflight)

        task = asyncio.create_task(self._fetch_and_cache_stock_price(ticker, cached))
        FinanceService._inflight_price_tasks[ticker] = task
        try:
            return await asyncio.shield(task)
        finally:
            if FinanceService._inflight_price_tasks.get(ticker) is task:
                FinanceService._inflight_price_tasks.pop(ticker, None)

    async def _fetch_and_cache_stock_price(self, ticker: str, cached: dict | None) -> dict:
        if is_krx_gold_ticker(ticker):
            result = await self._krx_gold_service.get_price(ticker)
        else:
            loop = asyncio.get_running_loop()
            result = await loop.run_in_executor(self._executor, self._get_stock_info_sync, ticker)
        now = datetime.now()
        if result.get("valid") and result.get("current_price") is not None:
            result = {
                **result,
                "timestamp": result.get("timestamp") or now,
                "source": result.get("source") or "yfinance",
                "cached": False,
                "stale": False,
            }
            FinanceService._price_cache[ticker] = {"data": result, "timestamp": now}
            return result

        if cached and now - cached["timestamp"] <= self._stale_price_ttl:
            return {**cached["data"], "cached": True, "stale": True}
        return {**result, "cached": False, "stale": False}

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
        # 지원이 확정된 KRX 상품은 일시적인 API 장애나 승인 대기 때문에
        # 자산 수정 자체가 막히지 않도록 코드만으로 유효성을 판단한다.
        if is_krx_gold_ticker(ticker):
            return True
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
            "ticker": result.get("ticker") or ticker,
            "name": result.get("name"),
            "current_price": Decimal(str(result["current_price"])) if result.get("current_price") is not None else None,
            "currency": result.get("currency"),
            "exchange": result.get("exchange"),
            "error": result.get("error") if not result.get("valid") else None,
        }

    async def enrich_assets_with_prices(self, assets: list[dict]) -> list[dict]:
        """
        자산 목록에 자동 또는 수동 가격 정보를 추가한다.

        - 주식: yfinance에서 현재가 조회
        - KRX 금현물: KRX OPEN API에서 최근 공식 종가 조회
        - 현금: current_value 사용
        - 계산: 평가금액, 손익, 수익률
        - 환율: USD 자산의 원화 환산 매입가 계산
        """
        tickers = []
        for asset in assets:
            ticker = asset.get("ticker")
            if ticker:
                tickers.append(normalize_krx_gold_ticker(ticker) or str(ticker).strip().upper())

        # 일괄 조회
        prices = await self.get_multiple_prices(list(set(tickers)))

        # 현재 환율 조회 (USD 자산이 있을 경우)
        current_exchange_rate = await self.get_exchange_rate()

        enriched = []
        for asset in assets:
            asset_copy = dict(asset)
            raw_ticker = asset.get("ticker")
            ticker = (
                normalize_krx_gold_ticker(raw_ticker) or str(raw_ticker).strip().upper()
                if raw_ticker
                else None
            )

            # 현재 환율 추가
            asset_copy["current_exchange_rate"] = Decimal(str(current_exchange_rate))

            valuation = calculate_asset_valuation(
                asset,
                prices.get(ticker) if ticker else None,
                Decimal(str(current_exchange_rate)),
            )
            asset_copy.update({
                "current_price": valuation.current_price,
                "unit_price_krw": valuation.unit_price_krw,
                "market_value": valuation.market_value_krw,
                "market_value_usd": valuation.market_value_usd,
                "cost_basis_krw": valuation.cost_basis_krw,
                "profit_loss": valuation.profit_loss_krw,
                "profit_rate": float(valuation.profit_rate) if valuation.profit_rate is not None else None,
                "native_profit_rate": (
                    float(valuation.native_profit_rate)
                    if valuation.native_profit_rate is not None
                    else None
                ),
                "fx_change_rate": (
                    float(valuation.fx_change_rate)
                    if valuation.fx_change_rate is not None
                    else None
                ),
                "asset_price_effect_krw": valuation.asset_price_effect_krw,
                "fx_effect_krw": valuation.fx_effect_krw,
                "price_status": valuation.price_status,
                "price_as_of": valuation.price_as_of,
                "price_source": valuation.price_source,
                "valuation_error": valuation.valuation_error,
            })
            enriched.append(asset_copy)

        return enriched

    async def get_exchange_rate(self, from_currency: str = "USD", to_currency: str = "KRW") -> float:
        """
        환율 조회 냥~ (USDKRW=X 티커 사용)
        실패 시 캐시된 환율 사용, 캐시도 없으면 기본값 사용
        """
        cache_key = f"{from_currency}{to_currency}"
        ticker = f"{cache_key}=X"

        result = await self.get_stock_price(ticker)

        if result.get("valid") and result.get("current_price"):
            rate = float(result["current_price"])
            # 지연 시세를 새 시세처럼 갱신하지 않는다.
            if not result.get("stale"):
                FinanceService._exchange_rate_cache[cache_key] = {
                    "rate": rate,
                    "timestamp": datetime.now(),
                    "source": "yfinance"
                }
            return rate

        # 실패 시 캐시된 환율 사용
        cached = FinanceService._exchange_rate_cache.get(cache_key)
        if cached and datetime.now() - cached["timestamp"] <= self._stale_price_ttl:
            print(f"⚠️ 환율 조회 실패, 캐시된 환율 사용 냥: {cached['rate']} ({cached['source']})")
            return cached["rate"]

        # 캐시도 없으면 기본값 반환
        print(f"⚠️ 환율 조회 실패, 기본값 사용 냥: {settings.default_usd_krw_rate}")
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

    def _get_ticker_history_sync(
        self,
        ticker: str,
        days: int = 30
    ) -> dict:
        """
        동기 방식으로 티커 히스토리 조회 (Sparkline용) 냥~
        """
        try:
            stock = yf.Ticker(ticker)
            end_date = date.today()
            start_date = end_date - timedelta(days=days)

            history = stock.history(
                start=start_date.isoformat(),
                end=(end_date + timedelta(days=1)).isoformat()
            )

            if history.empty:
                return {"ticker": ticker, "data": [], "change_rate": 0.0}

            data = []
            first_close = None
            last_close = None

            for idx, row in history.iterrows():
                close = float(row["Close"])
                if first_close is None:
                    first_close = close
                last_close = close

                data.append({
                    "date": idx.date().isoformat(),
                    "close": round(close, 2)
                })

            # 변화율 계산
            change_rate = 0.0
            if first_close and last_close:
                change_rate = ((last_close - first_close) / first_close) * 100

            return {
                "ticker": ticker,
                "data": data,
                "change_rate": round(change_rate, 2)
            }
        except Exception as e:
            print(f"🙀 티커 히스토리 조회 실패 냥: {ticker} - {e}")
            return {"ticker": ticker, "data": [], "change_rate": 0.0}

    async def get_ticker_history(
        self,
        ticker: str,
        days: int = 30
    ) -> dict:
        """
        티커 히스토리 조회 (Sparkline용) 냥~ 🐱
        최근 N일간의 종가 데이터와 변화율 반환
        """
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self._executor,
            self._get_ticker_history_sync,
            ticker,
            days
        )
        return result

    def _get_gold_silver_ratio_sync(self) -> dict:
        """
        금/은 비율 조회 냥~ (GC=F / SI=F)
        """
        try:
            gold = yf.Ticker("GC=F")
            silver = yf.Ticker("SI=F")

            gold_info = gold.info
            silver_info = silver.info

            gold_price = (
                gold_info.get("regularMarketPrice")
                or gold_info.get("currentPrice")
                or gold_info.get("previousClose")
            )
            silver_price = (
                silver_info.get("regularMarketPrice")
                or silver_info.get("currentPrice")
                or silver_info.get("previousClose")
            )

            if gold_price and silver_price and float(silver_price) > 0:
                ratio = float(gold_price) / float(silver_price)
                return {
                    "gold_price": float(gold_price),
                    "silver_price": float(silver_price),
                    "ratio": round(ratio, 2),
                    "valid": True,
                }
            return {"valid": False, "ratio": None, "gold_price": None, "silver_price": None}
        except Exception as e:
            print(f"🙀 금/은 비율 조회 실패 냥: {e}")
            return {"valid": False, "ratio": None, "gold_price": None, "silver_price": None}

    async def get_gold_silver_ratio(self) -> dict:
        """금/은 현물 가격비 비동기 조회 냥~ 🐱"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._get_gold_silver_ratio_sync)

    def _get_index_per_sync(self) -> dict:
        """
        주요 지수 PER 조회 냥~
        - S&P 500: ^GSPC trailingPE
        - NASDAQ: QQQ ETF trailingPE (나스닥 직접 PER 없음)
        - KOSPI: 069500.KS (KODEX 200 ETF) trailingPE
        """
        results = {}

        sources = [
            ("sp500", "SPY", "S&P 500 (SPY)"),
            ("nasdaq", "QQQ", "NASDAQ (QQQ)"),
            ("kospi", "EWY", "KOSPI (EWY)"),
        ]

        for key, ticker, label in sources:
            try:
                t = yf.Ticker(ticker)
                info = t.info
                pe = info.get("trailingPE") or info.get("forwardPE")
                results[key] = {
                    "label": label,
                    "ticker": ticker,
                    "per": round(float(pe), 2) if pe else None,
                    "type": "trailing" if info.get("trailingPE") else ("forward" if info.get("forwardPE") else None),
                    "valid": pe is not None,
                }
            except Exception as e:
                print(f"🙀 PER 조회 실패 냥: {ticker} - {e}")
                results[key] = {"label": label, "ticker": ticker, "per": None, "type": None, "valid": False}

        return results

    async def get_index_per(self) -> dict:
        """주요 지수 PER 비동기 조회 냥~ 🐱"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(self._executor, self._get_index_per_sync)


# 싱글톤 인스턴스 (필요시 사용)
_finance_service: FinanceService | None = None


def get_finance_service() -> FinanceService:
    global _finance_service
    if _finance_service is None:
        _finance_service = FinanceService()
    return _finance_service
