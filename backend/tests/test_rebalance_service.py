"""
RebalanceService 단위 테스트 냥~ 🐱
v0.7.2: 그룹 매칭 및 current_value 자산 처리 테스트
"""
import pytest
from decimal import Decimal
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import UUID

from app.services.rebalance_service import RebalanceService


class TestRebalanceValuationSafety:
    @pytest.mark.asyncio
    async def test_unavailable_quote_blocks_partial_rebalance(self):
        plan_id = UUID("550e8400-e29b-41d4-a716-446655440000")
        portfolio_id = UUID("550e8400-e29b-41d4-a716-446655440001")
        asset = {"id": "asset-1", "ticker": "MISSING", "name": "Missing"}

        with patch("app.services.rebalance_service.get_database_client"):
            service = RebalanceService()
        service.get_plan = AsyncMock(return_value={
            "name": "Safety plan",
            "portfolio_id": str(portfolio_id),
            "allocations": [{"ticker": "MISSING", "target_percentage": 100}],
            "groups": [],
        })
        service._get_asset_values = AsyncMock(return_value=(
            Decimal("0"),
            {"asset-1": {
                "asset": asset,
                "market_value": Decimal("0"),
                "price_status": "unavailable",
            }},
        ))

        asset_service = MagicMock()
        asset_service.get_assets = AsyncMock(return_value=[asset])
        with patch("app.services.asset_service.AssetService", return_value=asset_service):
            result = await service.calculate_rebalance_by_plan(plan_id, portfolio_id)

        assert result["valuation_complete"] is False
        assert result["unavailable_asset_count"] == 1
        assert result["suggestions"] == []
        assert result["group_suggestions"] == []


class TestMatchItemToAsset:
    """match_item_to_asset 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """RebalanceService 인스턴스 (DB 모킹)"""
        with patch("app.services.rebalance_service.get_database_client"):
            return RebalanceService()

    def test_match_by_asset_id_string(self, service):
        """asset_id (문자열)로 매칭 테스트 냥~"""
        assets = [
            {"id": "asset-123", "name": "삼성전자", "ticker": "005930.KS"},
            {"id": "asset-456", "name": "현금", "ticker": None},
        ]

        item = {"asset_id": "asset-123"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None
        assert matched["id"] == "asset-123"
        assert matched["name"] == "삼성전자"

    def test_match_by_asset_id_uuid(self, service):
        """
        버그 #2 핵심 테스트: UUID 타입의 asset_id 매칭 냥~

        assets 리스트의 id가 UUID 객체일 때도 매칭되어야 함
        """
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"
        uuid_obj = UUID(uuid_str)

        assets = [
            {"id": uuid_obj, "name": "현금", "ticker": None, "current_value": 5000000},
        ]

        # item의 asset_id는 문자열
        item = {"asset_id": uuid_str}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None, "UUID 자산이 매칭되지 않음!"
        assert matched["name"] == "현금"

    def test_match_by_ticker(self, service):
        """ticker로 매칭 테스트 냥~"""
        assets = [
            {"id": "asset-1", "name": "KODEX 200", "ticker": "069500.KS"},
            {"id": "asset-2", "name": "현금", "ticker": None},
        ]

        item = {"ticker": "069500.KS"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None
        assert matched["id"] == "asset-1"

    def test_match_by_alias(self, service):
        """alias로 매칭 테스트 냥~"""
        assets = [
            {"id": "asset-1", "name": "삼성전자 보통주", "ticker": "005930.KS"},
        ]

        item = {"alias": "삼성전자"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None
        assert matched["id"] == "asset-1"

    def test_no_match(self, service):
        """매칭 실패 테스트 냥~"""
        assets = [
            {"id": "asset-1", "name": "삼성전자", "ticker": "005930.KS"},
        ]

        item = {"asset_id": "nonexistent", "ticker": "INVALID"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is None

    def test_match_by_name_when_ticker_contains_name(self, service):
        """
        버그 수정: ticker 필드에 자산명이 저장된 경우 name으로 매칭 냥~

        시나리오: 사용자가 그룹 아이템 추가 시 ticker 입력란에 '국내 금현물' 입력
        실제 자산: ticker=null, name='국내 금현물'
        """
        assets = [
            {"id": "gold-1", "name": "국내 금현물", "ticker": None, "current_value": 27363810},
            {"id": "etf-1", "name": "GDX", "ticker": "GDX"},
        ]

        # ticker 필드에 자산명이 저장된 아이템
        item = {"ticker": "국내 금현물"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None, "ticker에 name이 저장된 경우 매칭되어야 함"
        assert matched["id"] == "gold-1"
        assert matched["name"] == "국내 금현물"

    def test_match_ticker_first_then_name(self, service):
        """ticker 매칭 우선, 실패 시 name 매칭 냥~"""
        assets = [
            {"id": "asset-1", "name": "삼성전자", "ticker": "005930.KS"},
            {"id": "asset-2", "name": "TIGER 코스피", "ticker": None},
        ]

        # ticker가 실제로 존재하는 경우 → ticker 매칭
        item1 = {"ticker": "005930.KS"}
        matched1 = service.match_item_to_asset(item1, assets)
        assert matched1["id"] == "asset-1"

        # ticker 값이 실제로는 name인 경우 → name 폴백 매칭
        item2 = {"ticker": "TIGER 코스피"}
        matched2 = service.match_item_to_asset(item2, assets)
        assert matched2 is not None
        assert matched2["id"] == "asset-2"

    def test_match_current_value_asset_by_name(self, service):
        """current_value 자산(현금)이 name으로 매칭되는지 테스트 냥~"""
        assets = [
            {
                "id": "cash-1",
                "name": "현금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 27342062,
            },
        ]

        # 플랜 개별 배분에서 ticker에 '현금' 저장된 경우
        item = {"ticker": "현금"}
        matched = service.match_item_to_asset(item, assets)

        assert matched is not None, "현금 자산이 name으로 매칭되어야 함"
        assert matched["id"] == "cash-1"


class TestGetAssetValues:
    """_get_asset_values 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """RebalanceService 인스턴스"""
        with patch("app.services.rebalance_service.get_database_client"):
            svc = RebalanceService()
            svc.finance_service = MagicMock()
            return svc

    @pytest.mark.asyncio
    async def test_current_value_asset_included(self, service):
        """
        버그 #2 재현: current_value 자산이 asset_values에 올바르게 포함되는지 테스트 냥~
        """
        assets = [
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 5000000,
                "currency": "KRW",
            },
        ]

        service.finance_service.enrich_assets_with_prices = AsyncMock(return_value=[{
            **assets[0], "market_value": Decimal("5000000"), "current_price": None,
            "unit_price_krw": None, "price_status": "manual",
        }])

        total_value, asset_values = await service._get_asset_values(assets)

        assert total_value == Decimal("5000000")
        assert "cash-1" in asset_values
        assert asset_values["cash-1"]["market_value"] == Decimal("5000000")

    @pytest.mark.asyncio
    async def test_mixed_assets_total_value(self, service):
        """
        주식 + 현금 혼합 자산의 총 가치 계산 테스트 냥~
        """
        assets = [
            {
                "id": "stock-1",
                "name": "삼성전자",
                "ticker": "005930.KS",
                "quantity": 100,
                "average_price": 50000,
                "current_value": None,
                "currency": "KRW",
            },
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 5000000,
                "currency": "KRW",
            },
        ]

        service.finance_service.enrich_assets_with_prices = AsyncMock(return_value=[
            {**assets[0], "market_value": Decimal("5000000"), "current_price": Decimal("50000"),
             "unit_price_krw": Decimal("50000"), "price_status": "live"},
            {**assets[1], "market_value": Decimal("5000000"), "current_price": None,
             "unit_price_krw": None, "price_status": "manual"},
        ])

        total_value, asset_values = await service._get_asset_values(assets)

        # 주식: 50,000 × 100 = 5,000,000
        # 현금: 5,000,000
        # 총: 10,000,000
        assert total_value == Decimal("10000000")
        assert asset_values["stock-1"]["market_value"] == Decimal("5000000")
        assert asset_values["cash-1"]["market_value"] == Decimal("5000000")

    @pytest.mark.asyncio
    async def test_uuid_key_consistency(self, service):
        """
        asset_values 딕셔너리 키 일관성 테스트 냥~

        수정: 키를 문자열로 통일하여 UUID 객체/문자열 혼용 문제 해결
        """
        uuid_obj = UUID("550e8400-e29b-41d4-a716-446655440000")
        uuid_str = "550e8400-e29b-41d4-a716-446655440000"

        assets = [
            {
                "id": uuid_obj,  # UUID 객체
                "name": "현금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 3000000,
                "currency": "KRW",
            },
        ]

        service.finance_service.enrich_assets_with_prices = AsyncMock(return_value=[{
            **assets[0], "market_value": Decimal("3000000"), "current_price": None,
            "unit_price_krw": None, "price_status": "manual",
        }])

        total_value, asset_values = await service._get_asset_values(assets)

        # 키가 문자열로 통일됨 (UUID 객체 → 문자열)
        assert uuid_str in asset_values
        assert asset_values[uuid_str]["market_value"] == Decimal("3000000")


class TestCalculateGroupSuggestion:
    """_calculate_group_suggestion 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """RebalanceService 인스턴스"""
        with patch("app.services.rebalance_service.get_database_client"):
            svc = RebalanceService()
            svc.finance_service = MagicMock()
            return svc

    @pytest.mark.asyncio
    async def test_group_with_current_value_asset(self, service):
        """
        버그 #2 핵심 테스트: 그룹에 현금/금 등 current_value 자산이 포함될 때 냥~

        시나리오:
        - 그룹: "안전자산" (목표 30%)
        - 그룹 아이템: 현금 (asset_id로 연결)
        - 현금 market_value: 3,000,000원
        - 총 자산: 10,000,000원
        - 기대: 그룹 현재 비율 30%, 현재 가치 3,000,000원
        """
        assets = [
            {
                "id": "stock-1",
                "name": "주식",
                "ticker": "005930.KS",
                "quantity": 100,
                "average_price": 70000,
                "current_value": None,
                "currency": "KRW",
            },
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 3000000,  # 현금 300만원
                "currency": "KRW",
            },
        ]

        # 자산 가치 딕셔너리 (주식 700만 + 현금 300만 = 총 1000만)
        asset_values = {
            "stock-1": {"asset": assets[0], "market_value": Decimal("7000000"), "current_price": Decimal("70000")},
            "cash-1": {"asset": assets[1], "market_value": Decimal("3000000"), "current_price": None},
        }
        total_value = Decimal("10000000")

        group = {
            "id": "group-1",
            "name": "안전자산",
            "target_percentage": 30.0,
            "items": [
                {"asset_id": "cash-1"},  # 현금을 asset_id로 연결
            ],
        }

        suggestion = await service._calculate_group_suggestion(
            group, assets, asset_values, total_value
        )

        # 핵심 검증: 현금이 포함된 그룹의 현재 가치
        assert suggestion["current_value"] == Decimal("3000000"), \
            f"그룹 현재 가치가 {suggestion['current_value']}원 (기대: 3,000,000원)"
        assert suggestion["current_percentage"] == 30.0, \
            f"그룹 현재 비율이 {suggestion['current_percentage']}% (기대: 30%)"

    @pytest.mark.asyncio
    async def test_group_item_not_matched(self, service):
        """그룹 아이템이 매칭되지 않을 때 테스트 냥~"""
        assets = [
            {"id": "stock-1", "name": "삼성전자", "ticker": "005930.KS"},
        ]

        asset_values = {
            "stock-1": {"asset": assets[0], "market_value": Decimal("10000000"), "current_price": Decimal("50000")},
        }
        total_value = Decimal("10000000")

        group = {
            "id": "group-1",
            "name": "안전자산",
            "target_percentage": 30.0,
            "items": [
                {"asset_id": "nonexistent-asset"},  # 존재하지 않는 자산
            ],
        }

        suggestion = await service._calculate_group_suggestion(
            group, assets, asset_values, total_value
        )

        # 매칭 실패 시 0원
        assert suggestion["current_value"] == Decimal("0")
        assert suggestion["items"][0]["is_matched"] is False


class TestCalculateAllocationSuggestion:
    """_calculate_allocation_suggestion 메서드 테스트"""

    @pytest.fixture
    def service(self):
        """RebalanceService 인스턴스"""
        with patch("app.services.rebalance_service.get_database_client"):
            svc = RebalanceService()
            svc.finance_service = MagicMock()
            svc.finance_service.get_exchange_rate = AsyncMock(return_value=1300.0)
            return svc

    @pytest.mark.asyncio
    async def test_allocation_with_current_value_asset(self, service):
        """
        current_value 자산의 개별 배분 제안 테스트 냥~
        """
        assets = [
            {
                "id": "cash-1",
                "name": "비상금",
                "ticker": None,
                "quantity": 0,
                "average_price": 0,
                "current_value": 2000000,
                "currency": "KRW",
            },
        ]

        asset_values = {
            "cash-1": {"asset": assets[0], "market_value": Decimal("2000000"), "current_price": None},
        }
        total_value = Decimal("10000000")

        alloc = {
            "asset_id": "cash-1",
            "target_percentage": 30.0,
        }

        suggestion = await service._calculate_allocation_suggestion(
            alloc, assets, asset_values, total_value
        )

        # 현재 가치 200만원, 목표 300만원 (30%)
        assert suggestion["current_value"] == Decimal("2000000")
        assert suggestion["current_percentage"] == 20.0  # 2,000,000 / 10,000,000 * 100
        assert suggestion["target_percentage"] == 30.0
        assert suggestion["suggested_amount"] == Decimal("1000000")  # 100만원 추가 필요
        assert suggestion["is_matched"] is True
