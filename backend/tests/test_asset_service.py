"""
AssetService 단위 테스트 냥~ 🐱
v0.6.0: USD 원화 환산 테스트 추가 (exchange_rate 파라미터 방식)
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock

from app.services.asset_service import AssetService


class TestCalculateSummary:
    """calculate_summary 메서드 테스트"""

    @pytest.fixture
    def mock_db(self):
        """Mock Supabase client"""
        return MagicMock()

    @pytest.fixture
    def service(self, mock_db):
        """AssetService 인스턴스"""
        return AssetService(mock_db)

    @pytest.mark.asyncio
    async def test_krw_only_assets(self, service):
        """KRW 자산만 있을 때 정상 계산 확인"""
        enriched_assets = [
            {
                "market_value": 1000000,
                "quantity": 10,
                "average_price": 80000,
                "currency": "KRW",
                "category_name": "ETF",
                "category_color": "#6366f1",
                "category_id": None,
            },
            {
                "market_value": 2000000,
                "quantity": 20,
                "average_price": 90000,
                "currency": "KRW",
                "category_name": "채권",
                "category_color": "#8b5cf6",
                "category_id": None,
            },
        ]

        # 환율 전달 (KRW 자산만 있어서 영향 없음)
        summary = await service.calculate_summary(
            enriched_assets, exchange_rate=Decimal("1300")
        )

        assert summary.total_value == Decimal("3000000")
        assert summary.total_principal == Decimal("2600000")  # 10*80000 + 20*90000
        assert summary.asset_count == 2

    @pytest.mark.asyncio
    async def test_usd_assets_conversion(self, service):
        """USD 자산이 원화로 환산되는지 확인 냥~"""
        exchange_rate = Decimal("1300")

        enriched_assets = [
            {
                "market_value": 1000000,  # KRW
                "quantity": 10,
                "average_price": 80000,
                "currency": "KRW",
                "category_name": "ETF",
                "category_color": "#6366f1",
                "category_id": None,
            },
            {
                "market_value": 1000,  # USD
                "quantity": 10,
                "average_price": 80,  # USD
                "currency": "USD",
                "category_name": "해외주식",
                "category_color": "#ec4899",
                "category_id": None,
            },
        ]

        # 환율을 파라미터로 전달
        summary = await service.calculate_summary(
            enriched_assets, exchange_rate=exchange_rate
        )

        # KRW: 1,000,000 + USD: 1,000 * 1,300 = 2,300,000
        expected_total_value = Decimal("1000000") + Decimal("1000") * exchange_rate
        assert summary.total_value == expected_total_value

        # 원금: KRW 800,000 + USD 800 * 1,300 = 1,840,000
        expected_principal = Decimal("800000") + Decimal("800") * exchange_rate
        assert summary.total_principal == expected_principal

    @pytest.mark.asyncio
    async def test_usd_default_exchange_rate(self, service):
        """환율 파라미터 없을 때 기본값(1300) 사용 확인"""
        enriched_assets = [
            {
                "market_value": 100,  # USD
                "quantity": 1,
                "average_price": 90,
                "currency": "USD",
                "category_name": "해외주식",
                "category_color": "#ec4899",
                "category_id": None,
            },
        ]

        # 환율 파라미터 없이 호출
        summary = await service.calculate_summary(enriched_assets)

        # 100 USD * 1300 (기본값) = 130,000 KRW
        assert summary.total_value == Decimal("130000")
        assert summary.total_principal == Decimal("117000")  # 90 * 1 * 1300

    @pytest.mark.asyncio
    async def test_mixed_currencies_total(self, service):
        """다양한 통화가 섞여있을 때 총합 계산 확인"""
        exchange_rate = Decimal("1473.30")

        enriched_assets = [
            {
                "market_value": 28235200,  # KRW
                "quantity": 560,
                "average_price": 30799,
                "currency": "KRW",
                "category_name": "ETF",
                "category_color": "#6366f1",
                "category_id": None,
            },
            {
                "market_value": 25107600,  # KRW
                "quantity": 490,
                "average_price": 51239,
                "currency": "KRW",
                "category_name": "채권",
                "category_color": "#8b5cf6",
                "category_id": None,
            },
            {
                "market_value": 10810.53,  # USD
                "quantity": 27,
                "average_price": 379.12,
                "currency": "USD",
                "category_name": "해외ETF",
                "category_color": "#ec4899",
                "category_id": None,
            },
            {
                "market_value": 27553.44,  # USD
                "quantity": 274,
                "average_price": 100.42,
                "currency": "USD",
                "category_name": "해외채권",
                "category_color": "#f43f5e",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(
            enriched_assets, exchange_rate=exchange_rate
        )

        # 계산 검증
        krw_total = Decimal("28235200") + Decimal("25107600")
        usd_total = (Decimal("10810.53") + Decimal("27553.44")) * exchange_rate
        expected_total = krw_total + usd_total

        # 소수점 오차 허용 (1원 이내)
        assert abs(summary.total_value - expected_total) < Decimal("1")

    @pytest.mark.asyncio
    async def test_empty_assets(self, service):
        """빈 자산 목록일 때 처리 확인"""
        summary = await service.calculate_summary([])

        assert summary.total_value == Decimal("0")
        assert summary.total_principal == Decimal("0")
        assert summary.asset_count == 0
        assert summary.allocations == []

    @pytest.mark.asyncio
    async def test_category_allocation_with_usd(self, service):
        """카테고리별 배분이 원화 기준으로 계산되는지 확인"""
        exchange_rate = Decimal("1300")

        enriched_assets = [
            {
                "market_value": 1000000,
                "quantity": 10,
                "average_price": 80000,
                "currency": "KRW",
                "category_name": "국내ETF",
                "category_color": "#6366f1",
                "category_id": None,
            },
            {
                "market_value": 1000,  # USD -> 1,300,000 KRW
                "quantity": 10,
                "average_price": 80,
                "currency": "USD",
                "category_name": "해외ETF",
                "category_color": "#ec4899",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(
            enriched_assets, exchange_rate=exchange_rate
        )

        # 총 자산: 1,000,000 + 1,300,000 = 2,300,000
        assert summary.total_value == Decimal("2300000")

        # 카테고리별 배분 확인
        assert len(summary.allocations) == 2

        # 국내ETF: 1,000,000 / 2,300,000 ≈ 43.48%
        # 해외ETF: 1,300,000 / 2,300,000 ≈ 56.52%
        allocations_dict = {a.category_name: a for a in summary.allocations}
        assert allocations_dict["국내ETF"].percentage == pytest.approx(43.48, rel=0.01)
        assert allocations_dict["해외ETF"].percentage == pytest.approx(56.52, rel=0.01)
