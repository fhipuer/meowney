"""
FinanceService 단위 테스트 냥~ 🐱
v0.7.2: current_value 자산(현금, 금 등) 처리 테스트
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, AsyncMock, patch

from app.services.finance_service import FinanceService


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

        # current_value가 USD이므로 그대로 저장 (원화 환산은 summary에서)
        assert usd_cash["market_value"] == Decimal("1000")
