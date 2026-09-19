"""
FinanceService 단위 테스트 냥~ 🐱
v0.7.2: current_value 자산(현금, 금 등) 처리 테스트
"""
import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.finance_service import FinanceService


class TestPriceCache:
    @pytest.fixture(autouse=True)
    def clear_shared_cache(self):
        FinanceService._price_cache.clear()
        FinanceService._inflight_price_tasks.clear()
        yield
        FinanceService._price_cache.clear()
        FinanceService._inflight_price_tasks.clear()

    @pytest.mark.asyncio
    async def test_fresh_price_is_reused_across_service_instances(self):
        first = FinanceService()
        second = FinanceService()
        quote = {"ticker": "TEST", "current_price": 100, "currency": "USD", "valid": True}

        with patch.object(first, "_get_stock_info_sync", return_value=quote) as fetch:
            assert (await first.get_stock_price("TEST"))["current_price"] == 100
            assert (await second.get_stock_price("TEST"))["current_price"] == 100

        assert fetch.call_count == 1

    @pytest.mark.asyncio
    async def test_concurrent_requests_are_merged(self):
        service = FinanceService()
        calls = 0

        def fetch(_ticker):
            nonlocal calls
            calls += 1
            return {"ticker": "TEST", "current_price": 100, "currency": "USD", "valid": True}

        with patch.object(service, "_get_stock_info_sync", side_effect=fetch):
            results = await asyncio.gather(*[service.get_stock_price("TEST") for _ in range(10)])

        assert calls == 1
        assert all(result["current_price"] == 100 for result in results)

    @pytest.mark.asyncio
    async def test_failed_refresh_uses_last_price_for_up_to_24_hours(self):
        service = FinanceService()
        cached_quote = {
            "ticker": "TEST",
            "current_price": 100,
            "currency": "USD",
            "valid": True,
            "timestamp": datetime.now() - timedelta(minutes=10),
            "source": "yfinance",
        }
        FinanceService._price_cache["TEST"] = {
            "data": cached_quote,
            "timestamp": datetime.now() - timedelta(minutes=10),
        }

        with patch.object(service, "_get_stock_info_sync", return_value={"ticker": "TEST", "valid": False}):
            result = await service.get_stock_price("TEST")

        assert result["current_price"] == 100
        assert result["stale"] is True

    @pytest.mark.asyncio
    async def test_krx_gold_ticker_is_routed_to_krx_provider(self):
        provider = MagicMock()
        provider.get_price = AsyncMock(return_value={
            "ticker": "M04020100",
            "current_price": Decimal("195400"),
            "currency": "KRW",
            "valid": True,
            "price_kind": "close",
            "source": "KRX Open API",
        })
        service = FinanceService(krx_gold_service=provider)

        with patch.object(service, "_get_stock_info_sync") as yfinance_fetch:
            result = await service.get_stock_price("m04020100")

        provider.get_price.assert_awaited_once_with("M04020100")
        yfinance_fetch.assert_not_called()
        assert result["current_price"] == Decimal("195400")


class TestEnrichAssetsWithPrices:
    """enrich_assets_with_prices 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """FinanceService 인스턴스"""
        return FinanceService()

    @pytest.mark.asyncio
    async def test_current_value_asset_has_market_value(self, service):
        """
        버그 #1 재현: current_value 자산(현금)의 market_value가 정상 설정되는지 확인 냥~

        시나리오:
        - 현금 자산: quantity=0, average_price=0, current_value=5,000,000
        - 기대: market_value = 5,000,000

        버그 상황: market_value가 0으로 설정되어 비율이 깨짐
        """
        # 현금 자산 (quantity=0, ticker 없음, current_value 직접 입력)
        assets = [
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,  # 현금은 수량 0
                "average_price": 0,  # 현금은 매입가 0
                "current_value": 5000000,  # 직접 입력한 현재가치
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": "cat-cash",
            }
        ]

        # Mock: yfinance 호출 방지
        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {}
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        assert len(enriched) == 1
        cash_asset = enriched[0]

        # 핵심 검증: market_value가 current_value와 동일해야 함
        assert cash_asset["market_value"] == Decimal("5000000"), \
            f"현금 자산의 market_value가 {cash_asset['market_value']}로 설정됨 (기대: 5000000)"

    @pytest.mark.asyncio
    async def test_current_value_asset_profit_calculation(self, service):
        """
        current_value 자산의 손익 계산 테스트 냥~

        시나리오:
        - 금현물: quantity=10, average_price=90,000, current_value=1,000,000
        - 원금: 10 × 90,000 = 900,000
        - 손익: 1,000,000 - 900,000 = 100,000 (11.11% 수익)
        """
        assets = [
            {
                "id": "gold-1",
                "name": "금현물",
                "ticker": None,
                "quantity": 10,  # 10돈
                "average_price": 90000,  # 돈당 9만원
                "current_value": 1000000,  # 현재 총 가치 100만원
                "currency": "KRW",
                "category_name": "대체투자",
                "category_color": "#f59e0b",
                "category_id": "cat-alt",
            }
        ]

        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {}
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        gold_asset = enriched[0]

        assert gold_asset["market_value"] == Decimal("1000000")
        assert gold_asset["profit_loss"] == Decimal("100000")  # 1,000,000 - 900,000
        assert abs(gold_asset["profit_rate"] - 11.11) < 0.1  # 약 11.11%

    @pytest.mark.asyncio
    async def test_mixed_assets_with_current_value(self, service):
        """
        주식과 현금이 혼합된 포트폴리오에서 비율 계산 테스트 냥~

        시나리오:
        - 주식: market_value = 5,000,000 (50%)
        - 현금: current_value = 5,000,000 (50%)
        - 총: 10,000,000
        """
        assets = [
            {
                "id": "stock-1",
                "name": "삼성전자",
                "ticker": "005930.KS",
                "quantity": 100,
                "average_price": 50000,
                "current_value": None,  # 주식은 current_value 없음
                "currency": "KRW",
                "category_name": "국내주식",
                "category_color": "#3b82f6",
                "category_id": "cat-stock",
            },
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 5000000,  # 현금
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": "cat-cash",
            },
        ]

        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                # 삼성전자 현재가 50,000원
                mock_prices.return_value = {
                    "005930.KS": {
                        "ticker": "005930.KS",
                        "current_price": 50000,
                        "currency": "KRW",
                        "valid": True,
                    }
                }
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        # 주식 검증
        stock = next(a for a in enriched if a["id"] == "stock-1")
        assert stock["market_value"] == Decimal("5000000")  # 50,000 × 100

        # 현금 검증
        cash = next(a for a in enriched if a["id"] == "cash-1")
        assert cash["market_value"] == Decimal("5000000")

        # 총 자산 검증
        total = sum(Decimal(str(a["market_value"])) for a in enriched)
        assert total == Decimal("10000000")

    @pytest.mark.asyncio
    async def test_zero_quantity_with_current_value(self, service):
        """
        quantity=0이고 current_value만 있는 자산 테스트 냥~
        (예: CMA, 예금, 현금 등)

        이 케이스가 버그 #1의 핵심 시나리오!
        """
        assets = [
            {
                "id": "cma-1",
                "name": "CMA",
                "ticker": None,
                "quantity": 0,  # 수량 없음
                "average_price": 0,  # 매입가 없음
                "current_value": 10000000,  # 1천만원
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": "cat-cash",
            }
        ]

        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {}
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        cma = enriched[0]

        # 핵심: market_value가 current_value와 같아야 함
        assert cma["market_value"] == Decimal("10000000")
        # 원금이 0이므로 손익도 current_value와 같음
        assert cma["profit_loss"] == Decimal("10000000")
        # 원금 0이면 수익률 0
        assert cma["profit_rate"] == 0.0

    @pytest.mark.asyncio
    async def test_ticker_asset_without_current_value(self, service):
        """
        티커가 있고 current_value가 없는 일반 주식 자산 테스트 냥~
        """
        assets = [
            {
                "id": "stock-1",
                "name": "KODEX 200",
                "ticker": "069500.KS",
                "quantity": 100,
                "average_price": 30000,
                "current_value": None,
                "currency": "KRW",
                "category_name": "ETF",
                "category_color": "#6366f1",
                "category_id": "cat-etf",
            }
        ]

        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {
                    "069500.KS": {
                        "ticker": "069500.KS",
                        "current_price": 35000,
                        "currency": "KRW",
                        "valid": True,
                    }
                }
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        etf = enriched[0]

        # market_value = 현재가 × 수량
        assert etf["market_value"] == Decimal("3500000")  # 35,000 × 100
        # 손익 = 평가금액 - 원금
        assert etf["profit_loss"] == Decimal("500000")  # 3,500,000 - 3,000,000
        # 수익률 = (손익 / 원금) × 100
        assert abs(etf["profit_rate"] - 16.67) < 0.1  # 약 16.67%

    @pytest.mark.asyncio
    async def test_krx_mini_gold_uses_close_per_gram_over_manual_fallback(self, service):
        assets = [{
            "id": "gold-1",
            "name": "국내 금현물",
            "ticker": "M04020100",
            "asset_type": "gold",
            "quantity": 148,
            "average_price": 175179.25,
            "current_value": 28223600,
            "currency": "KRW",
        }]

        with patch.object(service, "get_multiple_prices", new_callable=AsyncMock) as mock_prices:
            with patch.object(service, "get_exchange_rate", new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {
                    "M04020100": {
                        "ticker": "M04020100",
                        "current_price": Decimal("195400"),
                        "currency": "KRW",
                        "valid": True,
                        "price_kind": "close",
                        "source": "KRX Open API",
                    }
                }
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        gold = enriched[0]
        assert gold["current_price"] == Decimal("195400")
        assert gold["unit_price_krw"] == Decimal("195400")
        assert gold["market_value"] == Decimal("28919200")
        assert gold["profit_loss"] == Decimal("2992671.00")
        assert gold["price_status"] == "close"
        assert gold["price_source"] == "KRX Open API"

    @pytest.mark.asyncio
    async def test_usd_asset_exposes_native_and_fx_return_breakdown(self, service):
        assets = [{
            "id": "usd-stock-1",
            "name": "USD 테스트 자산",
            "ticker": "TEST",
            "asset_type": "stock",
            "quantity": 3,
            "average_price": 80,
            "purchase_exchange_rate": 1200,
            "currency": "USD",
        }]

        with patch.object(service, "get_multiple_prices", new_callable=AsyncMock) as mock_prices:
            with patch.object(service, "get_exchange_rate", new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {
                    "TEST": {
                        "ticker": "TEST",
                        "current_price": 100,
                        "currency": "USD",
                        "valid": True,
                    }
                }
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        asset = enriched[0]
        assert asset["native_profit_rate"] == 25.0
        assert asset["fx_change_rate"] == pytest.approx(8.3333333333)
        assert asset["asset_price_effect_krw"] == Decimal("72000")
        assert asset["fx_effect_krw"] == Decimal("30000")
        assert asset["asset_price_effect_krw"] + asset["fx_effect_krw"] == asset["profit_loss"]

    @pytest.mark.asyncio
    async def test_krx_mini_gold_keeps_manual_value_when_api_is_unavailable(self, service):
        assets = [{
            "id": "gold-1",
            "name": "국내 금현물",
            "ticker": "M04020100",
            "asset_type": "gold",
            "quantity": 148,
            "average_price": 175179.25,
            "current_value": 28223600,
            "currency": "KRW",
        }]

        with patch.object(service, "get_multiple_prices", new_callable=AsyncMock) as mock_prices:
            with patch.object(service, "get_exchange_rate", new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {
                    "M04020100": {
                        "ticker": "M04020100",
                        "current_price": None,
                        "valid": False,
                        "error": "권한 승인 대기 중",
                    }
                }
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        gold = enriched[0]
        assert gold["market_value"] == Decimal("28223600")
        assert gold["price_status"] == "manual"
        assert gold["price_source"] == "manual fallback"
        assert gold["valuation_error"] == "권한 승인 대기 중"

    @pytest.mark.asyncio
    async def test_usd_asset_current_value(self, service):
        """
        USD 현금 자산의 current_value 처리 테스트 냥~
        (예: 외화 예금)
        """
        assets = [
            {
                "id": "usd-cash-1",
                "name": "달러 예금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 1000,  # $1,000
                "currency": "USD",  # USD로 표시
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": "cat-cash",
            }
        ]

        with patch.object(service, 'get_multiple_prices', new_callable=AsyncMock) as mock_prices:
            with patch.object(service, 'get_exchange_rate', new_callable=AsyncMock) as mock_rate:
                mock_prices.return_value = {}
                mock_rate.return_value = 1300.0

                enriched = await service.enrich_assets_with_prices(assets)

        usd_cash = enriched[0]

        # current_value는 총 달러 잔액이고 market_value는 항상 KRW다.
        assert usd_cash["market_value_usd"] == Decimal("1000")
        assert usd_cash["market_value"] == Decimal("1300000.0")
