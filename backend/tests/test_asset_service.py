"""
AssetService 단위 테스트 냥~ 🐱
v0.6.0: USD 원화 환산 테스트 추가 (exchange_rate 파라미터 방식)
"""
import pytest
from datetime import date
from decimal import Decimal
from unittest.mock import MagicMock
from uuid import UUID

from app.services.asset_service import AssetService


class HistoryQueryStub:
    def __init__(self, rows):
        self.data = rows

    def table(self, _name):
        return self

    def select(self, _columns):
        return self

    def eq(self, _column, _value):
        return self

    def gte(self, _column, _value):
        return self

    def lte(self, _column, _value):
        return self

    def execute(self):
        return self


class TestAnnualAssetChange:
    @pytest.mark.asyncio
    async def test_uses_snapshot_closest_to_start_of_year(self):
        db = HistoryQueryStub([
            {"snapshot_date": "2025-12-31", "total_value": "1000000"},
            {"snapshot_date": "2026-01-03", "total_value": "1200000"},
        ])
        service = AssetService(db)

        rate, baseline_value, baseline_date = await service.get_annual_asset_change(
            UUID("00000000-0000-0000-0000-000000000001"),
            Decimal("1250000"),
            date(2026, 8, 1),
        )

        assert rate == 25.0
        assert baseline_value == Decimal("1000000")
        assert baseline_date == date(2025, 12, 31)

    @pytest.mark.asyncio
    async def test_returns_none_without_history(self):
        service = AssetService(HistoryQueryStub([]))

        result = await service.get_annual_asset_change(
            UUID("00000000-0000-0000-0000-000000000001"),
            Decimal("1250000"),
            date(2026, 8, 1),
        )

        assert result == (None, None, None)

    @pytest.mark.asyncio
    async def test_zero_baseline_has_no_rate(self):
        service = AssetService(HistoryQueryStub([
            {"snapshot_date": "2026-01-01", "total_value": "0"},
        ]))

        rate, baseline_value, baseline_date = await service.get_annual_asset_change(
            UUID("00000000-0000-0000-0000-000000000001"),
            Decimal("100"),
            date(2026, 8, 1),
        )

        assert rate is None
        assert baseline_value == Decimal("0")
        assert baseline_date == date(2026, 1, 1)


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
                "market_value": 1300000,  # 평가 엔진에서 이미 KRW로 환산됨
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

        # summary는 통화 변환 없이 KRW 평가액만 합산한다.
        expected_total_value = Decimal("1000000") + Decimal("1000") * exchange_rate
        assert summary.total_value == expected_total_value

        # 원금: KRW 800,000 + USD 800 * 1,300 = 1,840,000
        expected_principal = Decimal("800000") + Decimal("800") * exchange_rate
        assert summary.total_principal == expected_principal

    @pytest.mark.asyncio
    async def test_usd_enriched_cost_basis_is_used(self, service):
        """평가 엔진이 계산한 원화 원금을 summary가 그대로 사용하는지 확인"""
        enriched_assets = [
            {
                "market_value": 130000,  # 평가 엔진에서 이미 KRW로 환산됨
                "cost_basis_krw": 117000,
                "quantity": 1,
                "average_price": 90,
                "currency": "USD",
                "category_name": "해외주식",
                "category_color": "#ec4899",
                "category_id": None,
            },
        ]

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
                "market_value": Decimal("10810.53") * exchange_rate,
                "quantity": 27,
                "average_price": 379.12,
                "currency": "USD",
                "category_name": "해외ETF",
                "category_color": "#ec4899",
                "category_id": None,
            },
            {
                "market_value": Decimal("27553.44") * exchange_rate,
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
                "market_value": 1300000,  # 평가 엔진에서 이미 KRW로 환산됨
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

    @pytest.mark.asyncio
    async def test_current_value_asset_in_summary(self, service):
        """
        current_value 자산(현금)이 대시보드 요약에 올바르게 포함되는지 확인 냥~

        시나리오:
        - 주식: market_value = 5,000,000 (50%)
        - 현금: market_value = 5,000,000 (50%)
        - 총 자산: 10,000,000
        """
        enriched_assets = [
            {
                "market_value": 5000000,  # 이미 계산된 평가금액
                "quantity": 100,
                "average_price": 50000,
                "currency": "KRW",
                "category_name": "국내주식",
                "category_color": "#3b82f6",
                "category_id": None,  # UUID 형식이 필요하므로 None 사용
            },
            {
                "market_value": 5000000,  # 현금 (current_value에서 복사됨)
                "quantity": 0,  # 현금은 수량 0
                "average_price": 0,  # 현금은 매입가 0
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": None,  # UUID 형식이 필요하므로 None 사용
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        # 총 자산가치 검증
        assert summary.total_value == Decimal("10000000")

        # 카테고리별 배분 검증
        assert len(summary.allocations) == 2

        allocations_dict = {a.category_name: a for a in summary.allocations}

        # 주식 50%, 현금 50%
        assert allocations_dict["국내주식"].percentage == 50.0
        assert allocations_dict["현금"].percentage == 50.0
        assert allocations_dict["현금"].market_value == Decimal("5000000")

    @pytest.mark.asyncio
    async def test_zero_quantity_current_value_asset(self, service):
        """
        quantity=0, average_price=0인 현금 자산의 원금 처리 확인 냥~

        현금은 수량/매입가가 없으므로 원금 = 0 (손익계산 제외)
        """
        enriched_assets = [
            {
                "market_value": 10000000,  # CMA 1천만원
                "quantity": 0,
                "average_price": 0,
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        # 총 자산가치는 1천만원
        assert summary.total_value == Decimal("10000000")
        # 원금은 0 (수량 × 매입가)
        assert summary.total_principal == Decimal("0")
        # 수익은 계산 불가 (0으로 나누기 방지)
        assert summary.profit_rate == 0.0

    @pytest.mark.asyncio
    async def test_mixed_stock_and_cash_profit_calculation(self, service):
        """
        주식과 현금이 혼합된 포트폴리오의 수익률 계산 확인 냥~
        """
        enriched_assets = [
            {
                "market_value": 6000000,  # 주식 평가금액 600만원
                "quantity": 100,
                "average_price": 50000,  # 원금 500만원
                "currency": "KRW",
                "category_name": "국내주식",
                "category_color": "#3b82f6",
                "category_id": None,
            },
            {
                "market_value": 4000000,  # 현금 400만원
                "quantity": 0,
                "average_price": 0,
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        # 총 자산: 600만 + 400만 = 1000만
        assert summary.total_value == Decimal("10000000")
        # 원금: 주식만 계산 = 500만
        assert summary.total_principal == Decimal("5000000")
        # 수익: 1000만 - 500만 = 500만
        assert summary.total_profit == Decimal("5000000")
        # 수익률: 500만 / 500만 × 100 = 100%
        assert summary.profit_rate == 100.0


class TestEdgeCases:
    """엣지 케이스 테스트 냥~ 🐱"""

    @pytest.fixture
    def mock_db(self):
        """Mock Supabase client"""
        return MagicMock()

    @pytest.fixture
    def service(self, mock_db):
        """AssetService 인스턴스"""
        return AssetService(mock_db)

    @pytest.mark.asyncio
    async def test_all_cash_portfolio(self, service):
        """현금만 있는 포트폴리오 처리 확인"""
        enriched_assets = [
            {
                "market_value": 5000000,
                "quantity": 0,
                "average_price": 0,
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": None,
            },
            {
                "market_value": 3000000,
                "quantity": 0,
                "average_price": 0,
                "currency": "KRW",
                "category_name": "현금",
                "category_color": "#22c55e",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        assert summary.total_value == Decimal("8000000")
        assert summary.total_principal == Decimal("0")
        assert summary.profit_rate == 0.0
        # 같은 카테고리는 합쳐져야 함
        assert len(summary.allocations) == 1
        assert summary.allocations[0].percentage == 100.0

    @pytest.mark.asyncio
    async def test_very_small_values(self, service):
        """매우 작은 금액 처리 확인 (소수점 정밀도)"""
        enriched_assets = [
            {
                "market_value": 0.01,  # 1원 미만
                "quantity": 0.001,
                "average_price": 10,
                "currency": "KRW",
                "category_name": "테스트",
                "category_color": "#000000",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        assert summary.total_value == Decimal("0.01")
        assert summary.asset_count == 1

    @pytest.mark.asyncio
    async def test_very_large_values(self, service):
        """매우 큰 금액 처리 확인 (억 단위)"""
        enriched_assets = [
            {
                "market_value": 100000000000,  # 1000억
                "quantity": 1000000,
                "average_price": 100000,
                "currency": "KRW",
                "category_name": "대형주",
                "category_color": "#000000",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        assert summary.total_value == Decimal("100000000000")
        assert summary.total_principal == Decimal("100000000000")

    @pytest.mark.asyncio
    async def test_negative_profit(self, service):
        """손실이 발생한 경우 음수 수익률 확인"""
        enriched_assets = [
            {
                "market_value": 800000,  # 현재 80만원
                "quantity": 10,
                "average_price": 100000,  # 매입가 100만원
                "currency": "KRW",
                "category_name": "주식",
                "category_color": "#000000",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        assert summary.total_value == Decimal("800000")
        assert summary.total_principal == Decimal("1000000")
        assert summary.total_profit == Decimal("-200000")  # -20만원 손실
        assert summary.profit_rate == -20.0

    @pytest.mark.asyncio
    async def test_multiple_same_category(self, service):
        """같은 카테고리의 여러 자산 합산 확인"""
        enriched_assets = [
            {
                "market_value": 1000000,
                "quantity": 10,
                "average_price": 100000,
                "currency": "KRW",
                "category_name": "국내주식",
                "category_color": "#3b82f6",
                "category_id": None,
            },
            {
                "market_value": 2000000,
                "quantity": 20,
                "average_price": 100000,
                "currency": "KRW",
                "category_name": "국내주식",
                "category_color": "#3b82f6",
                "category_id": None,
            },
            {
                "market_value": 2000000,
                "quantity": 10,
                "average_price": 200000,
                "currency": "KRW",
                "category_name": "해외주식",
                "category_color": "#ec4899",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        # 총 5백만원
        assert summary.total_value == Decimal("5000000")
        # 2개 카테고리
        assert len(summary.allocations) == 2

        allocations_dict = {a.category_name: a for a in summary.allocations}
        # 국내주식: 3백만원 (60%)
        assert allocations_dict["국내주식"].market_value == Decimal("3000000")
        assert allocations_dict["국내주식"].percentage == 60.0
        # 해외주식: 2백만원 (40%)
        assert allocations_dict["해외주식"].market_value == Decimal("2000000")
        assert allocations_dict["해외주식"].percentage == 40.0

    @pytest.mark.asyncio
    async def test_string_numeric_values(self, service):
        """문자열 숫자값 처리 확인 (DB에서 가져온 데이터)"""
        enriched_assets = [
            {
                "market_value": "1000000",  # 문자열
                "quantity": "10",  # 문자열
                "average_price": "100000",  # 문자열
                "currency": "KRW",
                "category_name": "주식",
                "category_color": "#000000",
                "category_id": None,
            },
        ]

        summary = await service.calculate_summary(enriched_assets)

        assert summary.total_value == Decimal("1000000")
        assert summary.total_principal == Decimal("1000000")
